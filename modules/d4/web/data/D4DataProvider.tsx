"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { KpiCatalogSet } from "../../kpi/catalog";
import { createD4BrowserClient } from "../../supabase/client";
import type { D4LiveSnapshot } from "../../supabase/types";
import { ApiError } from "../../shared/errors";
import { msg } from "../../shared/text";
import { useLanguage } from "../i18n/LanguageProvider";
import { apiSource, D4RequestError } from "./api-source";
import type { D4DataSource } from "./source";

export type ToastMessage = { id: number; tone: "success" | "error"; text: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type D4Data = {
  mode: D4DataSource["mode"];
  status: "loading" | "ready" | "error";
  error: string;
  snapshot: D4LiveSnapshot | null;
  catalog: KpiCatalogSet | null;
  busy: boolean;
  reload: () => void;
  /**
   * Runs a write, refreshes the snapshot, and shows a toast. Returns the error message for inline form feedback.
   * `success` may depend on the result, e.g. how many rows a bulk action saved.
   */
  run: <T>(operation: (source: D4DataSource) => Promise<T>, success: string | ((value: T) => string), options?: { refreshInBackground?: boolean }) => Promise<Result<T>>;
  toasts: ToastMessage[];
  dismissToast: (id: number) => void;
  /** A toast for an action outside the D4 data, such as a password change, which has no snapshot to reload. */
  notify: (tone: ToastMessage["tone"], text: string) => void;
};

const Context = createContext<D4Data | null>(null);

// Kept untranslated in state and translated where it is shown (D4App), so the load effect does not depend on the language.
const LOAD_FAILED = msg("Gagal memuat data D4.");

export function useD4() {
  const value = useContext(Context);
  if (!value) throw new Error("useD4 must be used inside D4DataProvider");
  return value;
}

/** Same snapshot as useD4, but only for screens rendered after the shell has finished loading. */
export function useSnapshot() {
  const { snapshot } = useD4();
  if (!snapshot) throw new Error("Snapshot not loaded yet");
  return snapshot;
}

export function D4DataProvider({ children, mode }: { children: ReactNode; mode: "live" | "fixture" }) {
  const router = useRouter();
  const { t } = useLanguage();
  // The fixture source is loaded on demand. The NODE_ENV check is inlined at build time, so production
  // bundles drop this import and never contain the fictional records.
  const source = useMemo<Promise<D4DataSource>>(() => process.env.NODE_ENV === "development" && mode === "fixture"
    ? import("./fixture-source").then((fixture) => fixture.createFixtureSource()) : Promise.resolve(apiSource), [mode]);
  const [status, setStatus] = useState<D4Data["status"]>("loading");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<D4LiveSnapshot | null>(null);
  const [catalog, setCatalog] = useState<KpiCatalogSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Set synchronously, unlike `busy`, so a second click before the re-render cannot start another POST.
  const writing = useRef(false);

  const pushToast = useCallback((tone: ToastMessage["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
  }, []);

  useEffect(() => {
    let active = true;
    source.then((data) => Promise.all([data.loadSnapshot(), data.loadKpiCatalog()])).then(([nextSnapshot, nextCatalog]) => {
      if (!active) return;
      setSnapshot(nextSnapshot); setCatalog(nextCatalog); setStatus("ready"); setError("");
    }).catch((cause: unknown) => {
      if (!active) return;
      setStatus("error");
      setError(cause instanceof Error ? cause.message : LOAD_FAILED);
      // Session expired: leave the loading screen and go to /login. The stale session is cleared first, because
      // the proxy sends a still-signed-in user from /login back to /dashboard and the two pages would bounce.
      if (cause instanceof D4RequestError && cause.status === 401) {
        void Promise.resolve().then(() => createD4BrowserClient().auth.signOut()).catch(() => undefined)
          .finally(() => { router.replace("/login"); router.refresh(); });
      }
    });
    return () => { active = false; };
  }, [source, router, attempt]);

  const run = useCallback(async <T,>(operation: (data: D4DataSource) => Promise<T>, successText: string | ((value: T) => string), options?: { refreshInBackground?: boolean }): Promise<Result<T>> => {
    if (writing.current) return { ok: false, error: t("Penyimpanan sebelumnya masih diproses.") };
    writing.current = true;
    setBusy(true);
    let data: D4DataSource;
    let value: T;
    try {
      data = await source;
      value = await operation(data);
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : t("Gagal menyimpan.");
      // 409: a newer record was saved elsewhere (another tab or device). Load it, so the next save builds on it.
      const conflict = (cause instanceof D4RequestError && cause.status === 409) || (cause instanceof ApiError && cause.code === "CONFLICT");
      if (conflict) {
        try { setSnapshot(await (await source).loadSnapshot()); message = t("{message} Data terbaru sudah dimuat; periksa lalu simpan lagi.", { message }); } catch { /* the save error above still stands */ }
      }
      pushToast("error", message);
      writing.current = false;
      setBusy(false);
      return { ok: false, error: message };
    }
    // The write already succeeded; a failed refresh must not read as a failed save, or the user may submit twice.
    const success = typeof successText === "function" ? successText(value) : successText;
    const refresh = (async () => {
      try {
        setSnapshot(await data.loadSnapshot());
        pushToast("success", success);
      } catch {
        pushToast("error", t("{success} Namun data terbaru gagal dimuat; muat ulang halaman sebelum menyimpan lagi.", { success }));
      }
      writing.current = false;
      setBusy(false);
    })();
    // PST 2: the whole snapshot reload took seconds on production while the form stayed open. With this option the
    // form closes once the write is in; saving stays locked (busy) until the new data has arrived.
    if (!options?.refreshInBackground) await refresh;
    return { ok: true, value };
  }, [source, pushToast, t]);

  const value = useMemo<D4Data>(() => ({
    mode, status, error, snapshot, catalog, busy, run, toasts, notify: pushToast,
    reload: () => { setStatus("loading"); setAttempt((count) => count + 1); },
    dismissToast: (id) => setToasts((items) => items.filter((item) => item.id !== id)),
  }), [mode, status, error, snapshot, catalog, busy, run, toasts, pushToast]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

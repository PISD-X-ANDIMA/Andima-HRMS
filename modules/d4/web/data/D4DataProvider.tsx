"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { KpiCatalog } from "../../kpi/catalog";
import { createD4BrowserClient } from "../../supabase/client";
import type { D4LiveSnapshot } from "../../supabase/types";
import { apiSource, D4RequestError } from "./api-source";
import type { D4DataMode } from "./mode";
import type { D4DataSource } from "./source";

export type ToastMessage = { id: number; tone: "success" | "error"; text: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type D4Data = {
  mode: D4DataSource["mode"];
  status: "loading" | "ready" | "error";
  error: string;
  snapshot: D4LiveSnapshot | null;
  catalog: KpiCatalog | null;
  busy: boolean;
  reload: () => void;
  /** Runs a write, refreshes the snapshot, and shows a toast. Returns the error message for inline form feedback. */
  run: <T>(operation: (source: D4DataSource) => Promise<T>, success: string) => Promise<Result<T>>;
  toasts: ToastMessage[];
  dismissToast: (id: number) => void;
};

const Context = createContext<D4Data | null>(null);

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

export function D4DataProvider({ children, mode }: { children: ReactNode; mode: D4DataMode }) {
  const router = useRouter();
  // The fixture source is loaded on demand. The NODE_ENV check is inlined at build time, so production
  // bundles drop this import and never contain the fictional records.
  // The demo dataset is likewise only imported by the public demo deployment.
  const source = useMemo<Promise<D4DataSource>>(() => process.env.NODE_ENV === "development" && mode === "fixture"
    ? import("./fixture-source").then((fixture) => fixture.createFixtureSource())
    : mode === "demo" ? import("../../demo/demo-source").then((demo) => demo.createDemoSource()) : Promise.resolve(apiSource), [mode]);
  const [status, setStatus] = useState<D4Data["status"]>("loading");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<D4LiveSnapshot | null>(null);
  const [catalog, setCatalog] = useState<KpiCatalog | null>(null);
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
      setError(cause instanceof Error ? cause.message : "Data D4 gagal dimuat.");
      // Session expired: leave the loading screen and go to /login. The stale session is cleared first, because
      // the proxy sends a still-signed-in user from /login back to /dashboard and the two pages would bounce.
      if (cause instanceof D4RequestError && cause.status === 401) {
        void Promise.resolve().then(() => createD4BrowserClient().auth.signOut()).catch(() => undefined)
          .finally(() => { router.replace("/login"); router.refresh(); });
      }
    });
    return () => { active = false; };
  }, [source, router, attempt]);

  const run = useCallback(async <T,>(operation: (data: D4DataSource) => Promise<T>, success: string): Promise<Result<T>> => {
    if (writing.current) return { ok: false, error: "Penyimpanan sebelumnya masih diproses." };
    writing.current = true;
    setBusy(true);
    let data: D4DataSource;
    let value: T;
    try {
      data = await source;
      value = await operation(data);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Penyimpanan gagal.";
      pushToast("error", message);
      writing.current = false;
      setBusy(false);
      return { ok: false, error: message };
    }
    // The write already succeeded; a failed refresh must not read as a failed save, or the user may submit twice.
    try {
      setSnapshot(await data.loadSnapshot());
      pushToast("success", success);
    } catch {
      pushToast("error", `${success} Namun data terbaru gagal dimuat, muat ulang halaman sebelum menyimpan lagi.`);
    }
    writing.current = false;
    setBusy(false);
    return { ok: true, value };
  }, [source, pushToast]);

  const value = useMemo<D4Data>(() => ({
    mode, status, error, snapshot, catalog, busy, run, toasts,
    reload: () => { setStatus("loading"); setAttempt((count) => count + 1); },
    dismissToast: (id) => setToasts((items) => items.filter((item) => item.id !== id)),
  }), [mode, status, error, snapshot, catalog, busy, run, toasts]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

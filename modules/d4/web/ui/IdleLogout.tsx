"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createD4BrowserClient } from "../../supabase/client";
import { useD4 } from "../data/D4DataProvider";
import { clockTime, IDLE_LIMIT_MS, IDLE_LOGOUT_KEY, idlePhase, LAST_ACTIVITY_KEY, type IdlePhase } from "../data/idle";
import { endPreviewSession } from "../data/preview-session";
import { useLanguage } from "../i18n/LanguageProvider";
import { Button } from "./primitives";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
// Writing on every key press would be wasted work; a few seconds of drift does not matter against 30 minutes.
const WRITE_EVERY_MS = 10_000;

// Storage can be blocked (private window, site data cleared); the tab then keeps its own clock.
function readStored(): number | null {
  try { const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY)); return value > 0 ? value : null; } catch { return null; }
}
function writeStored(at: number) {
  try { window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at)); } catch { /* the in-memory clock still runs */ }
}

/**
 * Logs out after IDLE_LIMIT_MS without a click, key or scroll in any tab, with a warning a minute before. Activity
 * while the warning is open does not count: only "Stay signed in" keeps the session, so a bumped mouse cannot.
 */
export function IdleLogout() {
  const router = useRouter();
  const { mode } = useD4();
  const { t } = useLanguage();
  const last = useRef(0);
  const leaving = useRef(false);
  const [phase, setPhase] = useState<IdlePhase>("active");
  const [clock, setClock] = useState({ now: 0, logoutAt: 0 });
  const dialog = useRef<HTMLDivElement>(null);

  const lastActivity = () => Math.max(readStored() ?? 0, last.current);
  const touch = (force = false) => {
    const at = Date.now();
    if (!force && at - lastActivity() < WRITE_EVERY_MS) return;
    last.current = at;
    writeStored(at);
  };

  async function signOut() {
    if (leaving.current) return;
    leaving.current = true;
    try { window.sessionStorage.setItem(IDLE_LOGOUT_KEY, clockTime(new Date(lastActivity() + IDLE_LIMIT_MS))); } catch { /* the login page then says nothing */ }
    try {
      if (mode === "fixture") endPreviewSession();
      else await createD4BrowserClient().auth.signOut({ scope: "local" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  useEffect(() => {
    touch(true);
    // Signed in again: the login page no longer needs to explain the last automatic logout.
    try { window.sessionStorage.removeItem(IDLE_LOGOUT_KEY); } catch { /* nothing stored */ }
    let warning = false;
    const onActivity = () => { if (!warning) touch(); };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    const tick = () => {
      const at = Date.now();
      const next = idlePhase(at, lastActivity());
      warning = next === "warning";
      setPhase(next);
      if (warning) setClock({ now: at, logoutAt: lastActivity() + IDLE_LIMIT_MS });
      if (next === "expired") void signOut();
    };
    // Also on return to the tab: a laptop that slept past the limit logs out at once.
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    };
    // Runs once: touch, lastActivity and signOut only read refs and storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (phase === "warning") dialog.current?.querySelector<HTMLElement>("[data-testid=btn-idle-stay]")?.focus(); }, [phase]);

  if (phase !== "warning") return null;
  const seconds = Math.max(0, Math.ceil((clock.logoutAt - clock.now) / 1000));
  const keep = () => { touch(true); setPhase("active"); };

  return createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4">
    <div ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-text" data-testid="idle-warning"
      onKeyDown={(event) => {
        if (event.key === "Escape") keep();
        if (event.key !== "Tab") return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const next = buttons[(buttons.indexOf(document.activeElement as HTMLButtonElement) + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length];
        event.preventDefault(); next?.focus();
      }}
      className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-modal">
      <h2 id="idle-title" className="font-display text-base font-semibold text-ink">{t("Sesi akan berakhir")}</h2>
      <p id="idle-text" className="mt-1.5 text-sm text-ink-2">
        {t("Anda tidak aktif selama {minutes} menit. Anda akan logout otomatis pukul {time}.", { minutes: Math.round(IDLE_LIMIT_MS / 60_000) - 1, time: clockTime(new Date(clock.logoutAt)) })}
      </p>
      {/* Visible countdown only; a screen reader hears the time once, not every second. */}
      <p aria-hidden="true" data-testid="idle-countdown" className="mt-3 font-display text-2xl font-semibold tabular-nums text-ink">{t("{seconds} detik", { seconds })}</p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" data-testid="btn-idle-logout" onClick={() => void signOut()}>{t("Logout sekarang")}</Button>
        <Button data-testid="btn-idle-stay" onClick={keep}>{t("Tetap masuk")}</Button>
      </div>
    </div>
  </div>, document.body);
}

"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Inbox, Lock, X } from "lucide-react";
import type { ReactNode } from "react";
import { useD4 } from "../data/D4DataProvider";
import { useLanguage } from "../i18n/LanguageProvider";
import { Avatar, Button, cx, StatusBadge } from "./primitives";

/* ---------- Page header ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0"><h1 data-testid="page-title" className="font-display font-semibold text-[28px] leading-9 tracking-[0.01em] text-ink uppercase">{title}</h1><p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p></div>
    {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
  </header>;
}

/* ---------- Detail / history page shell (same for every feature, like D3 "Feedback Detail") ---------- */

export type Crumb = { label: string; href?: string };

// An employee has no team lists (their menu is My Performance and Daily KPI): a link to one leads to their own profile.
const employeeHref = (href: string) => href === "/daily-kpi" || href.startsWith("/daily-kpi/") ? href : "/dashboard";

// NotFound also renders on the app-wide 404 page, outside D4DataProvider, where useD4 throws.
function useIsEmployee() {
  try { return useD4().snapshot?.role === "EMPLOYEE"; } catch { return false; }
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const { t } = useLanguage();
  return <nav aria-label={t("Breadcrumb")} data-testid="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
    {items.map((item, index) => <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
      {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5" />}
      {item.href ? <Link href={item.href} className="hover:text-primary-600 hover:underline">{item.label}</Link> : <span aria-current="page" className="font-semibold text-ink-2">{item.label}</span>}
    </span>)}
  </nav>;
}

export function DetailHeader({ crumbs, backHref, name, meta, status, actions }: {
  crumbs: Crumb[];
  /** Left out on a page that is itself a menu destination, where there is nothing to go back to. */
  backHref?: string;
  name: string;
  meta: string[];
  status?: string;
  actions?: ReactNode;
}) {
  const { t } = useLanguage();
  if (useIsEmployee()) {
    crumbs = crumbs.map((crumb) => crumb.href && employeeHref(crumb.href) === "/dashboard" ? { label: t("My Performance"), href: "/dashboard" } : crumb);
    backHref = backHref && employeeHref(backHref);
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      {backHref && <Link href={backHref} data-testid="btn-back" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink hover:border-primary-500"><ArrowLeft aria-hidden="true" className="size-4" />{t("Back")}</Link>}
      <Breadcrumb items={crumbs} />
    </div>
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="h-2 bg-gradient-to-r from-primary-600 via-primary-500 to-nav-2" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-5 px-6 py-5">
        <Avatar name={name} size="lg" />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-3"><h1 data-testid="detail-name" className="font-display font-semibold text-2xl text-ink">{name}</h1>{status && <StatusBadge status={status} />}</div>
          <p className="mt-1 text-sm text-ink-2">{meta.filter(Boolean).join(" · ")}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  </div>;
}

/* ---------- History timeline ---------- */

export type TimelineEntry = { id: string; date: string; title: string; status?: string; actor: string; body?: ReactNode; href?: string };

export function Timeline({ entries, empty }: { entries: TimelineEntry[]; empty: string }) {
  const { t } = useLanguage();
  if (!entries.length) return <StateView kind="empty" title={t("Belum ada riwayat")} text={empty} />;
  return <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-line">
    {entries.map((entry) => <li key={entry.id} data-testid={`timeline-${entry.id}`} className="relative pl-9">
      <span aria-hidden="true" className="absolute left-0 top-4 flex size-6 items-center justify-center rounded-full border-2 border-primary-500 bg-surface"><span className="size-2 rounded-full bg-primary-500" /></span>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-ink-3">{entry.date}</p>
          {entry.status && <StatusBadge status={entry.status} />}
        </div>
        <p className="mt-1.5 font-semibold text-ink">{entry.href ? <Link href={entry.href} className="hover:text-primary-600 hover:underline">{entry.title}</Link> : entry.title}</p>
        {entry.body && <div className="mt-1.5 break-words text-sm text-ink-2">{entry.body}</div>}
        <p className="mt-2 text-xs text-ink-3">{t("Recorded by {actor}", { actor: entry.actor })}</p>
      </div>
    </li>)}
  </ol>;
}

/* ---------- States ---------- */

export function StateView({ kind, title, text, action }: { kind: "empty" | "error" | "forbidden" | "not-found"; title: string; text: string; action?: ReactNode }) {
  const Icon = kind === "error" ? AlertTriangle : kind === "forbidden" ? Lock : Inbox;
  return <section role={kind === "error" ? "alert" : undefined} data-testid={`state-${kind}`} className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-card">
    <span className={cx("flex size-12 items-center justify-center rounded-full", kind === "error" ? "bg-danger-bg text-danger" : "bg-primary-50 text-primary-600")}><Icon aria-hidden="true" className="size-6" /></span>
    <h2 className="font-display font-semibold text-lg text-ink">{title}</h2>
    <p className="max-w-md text-sm text-ink-2">{text}</p>
    {action}
  </section>;
}

export function LoadingView() {
  const { t } = useLanguage();
  return <div role="status" aria-label={t("Loading D4 data")} className="space-y-6">
    <div className="h-9 w-72 animate-pulse rounded-lg bg-line" />
    <div className="h-16 animate-pulse rounded-2xl bg-surface shadow-card" />
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex gap-6 border-t border-line px-5 py-5 first:border-0">
        <div className="h-3 w-40 animate-pulse rounded bg-line" /><div className="h-3 flex-1 animate-pulse rounded bg-muted" /><div className="h-3 w-24 animate-pulse rounded bg-line" />
      </div>)}
    </div>
    <span className="sr-only">{t("Memuat data performance, KPI, kompetensi, dan training…")}</span>
  </div>;
}

export function NotFound({ what, backHref, backLabel }: { what: string; backHref: string; backLabel: string }) {
  const { t } = useLanguage();
  if (useIsEmployee() && employeeHref(backHref) === "/dashboard") { backHref = "/dashboard"; backLabel = t("Back to My Performance"); }
  return <StateView kind="not-found" title={t("{what} not found", { what })} text={t("Data mungkin sudah tidak ada, atau akun ini tidak memiliki akses ke data tersebut.")} action={<Link href={backHref} className="text-sm font-semibold text-primary-600 hover:underline">{backLabel}</Link>} />;
}

/** The app-wide 404 (app/not-found.tsx), in the chosen language like the D4 screens. */
export function MissingPage() {
  const { t } = useLanguage();
  return <NotFound what={t("Page")} backHref="/dashboard" backLabel={t("Back to People Dashboard")} />;
}

export function Forbidden() {
  const { t } = useLanguage();
  return <StateView kind="forbidden" title={t("Restricted access")} text={t("Hanya HR atau manager yang dapat membuat atau mengubah data ini.")} />;
}

/* ---------- Toasts ---------- */

export function Toasts() {
  const { toasts, dismissToast } = useD4();
  const { t } = useLanguage();
  // Bottom right, so a toast never covers the header bell or its panel (PST 2).
  return <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(451px,calc(100vw-2rem))] flex-col gap-2">
    {/* Design System PISD 6410:132 (Normal state). The error toast follows the same shape in the System/business error red.
        Solid instead of the 70% fill: a toast floats over tables, and their text would show through. Success is white with
        a green check and label: the class agreed on a white success indicator (recording 21 Nov 2026, mas Bram item 6). */}
    {toasts.map((toast) => <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"} data-testid={`toast-${toast.tone}`}
      className={cx("pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 font-display shadow-card", toast.tone === "success" ? "border-line bg-surface" : "border-[#f5b8c2] bg-danger-bg")}>
      {toast.tone === "success" && <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />}
      <div className="min-w-0 flex-1">
        <p className={cx("text-xs font-bold leading-4", toast.tone === "success" ? "text-success" : "text-[#8f1c2d]")}>{toast.tone === "success" ? t("SUCCEED") : t("FAILED")}</p>
        <p className={cx("mt-0.5 text-sm leading-5", toast.tone === "success" ? "text-ink" : "text-[#b42335]")}>{toast.text}</p>
      </div>
      <button type="button" data-testid="btn-toast-close" aria-label={t("Dismiss notification")} onClick={() => dismissToast(toast.id)}
        className={cx("-mr-1 rounded p-1", toast.tone === "success" ? "text-ink-2 hover:bg-muted" : "text-[#b42335] hover:bg-[#f5b8c2]/40")}><X className="size-4" /></button>
    </div>)}
  </div>;
}

export { Button };

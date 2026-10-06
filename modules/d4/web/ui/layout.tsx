"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Inbox, Lock, X } from "lucide-react";
import type { ReactNode } from "react";
import { useD4 } from "../data/D4DataProvider";
import { Avatar, Button, cx, StatusBadge } from "./primitives";

/* ---------- Page header ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0"><h1 data-testid="page-title" className="font-display text-[28px] leading-9 tracking-[0.01em] text-ink uppercase">{title}</h1><p className="mt-1 max-w-3xl text-sm text-ink-2">{subtitle}</p></div>
    {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
  </header>;
}

/* ---------- Detail / history page shell (same for every feature, like D3 "Feedback Detail") ---------- */

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return <nav aria-label="Breadcrumb" data-testid="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
    {items.map((item, index) => <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
      {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5" />}
      {item.href ? <Link href={item.href} className="hover:text-primary-600 hover:underline">{item.label}</Link> : <span aria-current="page" className="font-semibold text-ink-2">{item.label}</span>}
    </span>)}
  </nav>;
}

export function DetailHeader({ crumbs, backHref, name, meta, status, actions }: {
  crumbs: Crumb[];
  backHref: string;
  name: string;
  meta: string[];
  status?: string;
  actions?: ReactNode;
}) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Link href={backHref} data-testid="btn-back" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold text-ink hover:border-primary-500"><ArrowLeft aria-hidden="true" className="size-4" />Back</Link>
      <Breadcrumb items={crumbs} />
    </div>
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="h-2 bg-gradient-to-r from-primary-600 via-primary-500 to-nav-2" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-5 px-6 py-5">
        <Avatar name={name} size="lg" />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-3"><h1 data-testid="detail-name" className="font-display text-2xl text-ink">{name}</h1>{status && <StatusBadge status={status} />}</div>
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
  if (!entries.length) return <StateView kind="empty" title="Belum ada riwayat" text={empty} />;
  return <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-line">
    {entries.map((entry) => <li key={entry.id} data-testid={`timeline-${entry.id}`} className="relative pl-9">
      <span aria-hidden="true" className="absolute left-0 top-4 flex size-6 items-center justify-center rounded-full border-2 border-primary-500 bg-surface"><span className="size-2 rounded-full bg-primary-500" /></span>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-ink-3">{entry.date}</p>
          {entry.status && <StatusBadge status={entry.status} />}
        </div>
        <p className="mt-1.5 font-semibold text-ink">{entry.href ? <Link href={entry.href} className="hover:text-primary-600 hover:underline">{entry.title}</Link> : entry.title}</p>
        {entry.body && <div className="mt-1.5 text-sm text-ink-2">{entry.body}</div>}
        <p className="mt-2 text-xs text-ink-3">Dicatat oleh {entry.actor}</p>
      </div>
    </li>)}
  </ol>;
}

/* ---------- States ---------- */

export function StateView({ kind, title, text, action }: { kind: "empty" | "error" | "forbidden" | "not-found"; title: string; text: string; action?: ReactNode }) {
  const Icon = kind === "error" ? AlertTriangle : kind === "forbidden" ? Lock : Inbox;
  return <section role={kind === "error" ? "alert" : undefined} data-testid={`state-${kind}`} className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-card">
    <span className={cx("flex size-12 items-center justify-center rounded-full", kind === "error" ? "bg-danger-bg text-danger" : "bg-primary-50 text-primary-600")}><Icon aria-hidden="true" className="size-6" /></span>
    <h2 className="font-display text-lg text-ink">{title}</h2>
    <p className="max-w-md text-sm text-ink-2">{text}</p>
    {action}
  </section>;
}

export function LoadingView() {
  return <div role="status" aria-label="Memuat data D4" className="space-y-6">
    <div className="h-9 w-72 animate-pulse rounded-lg bg-line" />
    <div className="h-16 animate-pulse rounded-2xl bg-surface shadow-card" />
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex gap-6 border-t border-line px-5 py-5 first:border-0">
        <div className="h-3 w-40 animate-pulse rounded bg-line" /><div className="h-3 flex-1 animate-pulse rounded bg-muted" /><div className="h-3 w-24 animate-pulse rounded bg-line" />
      </div>)}
    </div>
    <span className="sr-only">Memuat data performance, KPI, kompetensi, dan training…</span>
  </div>;
}

export function NotFound({ what, backHref, backLabel }: { what: string; backHref: string; backLabel: string }) {
  return <StateView kind="not-found" title={`${what} tidak ditemukan`} text="Data mungkin sudah tidak tersedia atau akun ini tidak memiliki akses." action={<Link href={backHref} className="text-sm font-semibold text-primary-600 hover:underline">{backLabel}</Link>} />;
}

export function Forbidden() {
  return <StateView kind="forbidden" title="Akses terbatas" text="Hanya HR atau manager yang dapat membuat atau mengubah data ini." />;
}

/* ---------- Toasts ---------- */

export function Toasts() {
  const { toasts, dismissToast } = useD4();
  return <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
    {toasts.map((toast) => <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"} data-testid={`toast-${toast.tone}`} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-modal">
      <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full", toast.tone === "success" ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>
        {toast.tone === "success" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
      </span>
      <p className="flex-1 pt-1.5 text-sm text-ink">{toast.text}</p>
      <button type="button" data-testid="btn-toast-close" aria-label="Tutup notifikasi" onClick={() => dismissToast(toast.id)} className="rounded p-1 text-ink-3 hover:bg-muted"><X className="size-4" /></button>
    </div>)}
  </div>;
}

export { Button };

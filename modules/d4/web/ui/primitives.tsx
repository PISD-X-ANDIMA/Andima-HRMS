"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" ");

/** Stable data-testid part from a visible label (Katalon XPath): "Add Scorecard" -> "add-scorecard". */
export const slug = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const autoId = (prefix: string, children: ReactNode) => typeof children === "string" ? `${prefix}-${slug(children)}` : undefined;

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 disabled:bg-muted disabled:text-ink-3",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-app disabled:text-ink-3",
  danger: "bg-danger text-white hover:brightness-95 disabled:bg-muted disabled:text-ink-3",
  ghost: "bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:bg-muted disabled:text-ink-3",
};
const buttonBase = "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed";

export function Button({ variant = "primary", icon, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return <button type="button" data-testid={autoId("btn", children)} {...props} className={cx(buttonBase, buttonStyles[variant], className)}>{icon}{children}</button>;
}

export function ButtonLink({ href, variant = "secondary", icon, testId, children }: { href: string; variant?: ButtonVariant; icon?: ReactNode; testId?: string; children: ReactNode }) {
  return <Link href={href} data-testid={testId ? `link-${testId}` : autoId("link", children)} className={cx(buttonBase, buttonStyles[variant])}>{icon}{children}</Link>;
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";
const toneStyles: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
};

// One mapping for every status in D4 so the same word always has the same colour.
// The label is always written out, so meaning never depends on colour alone.
const statusTone: Record<string, Tone> = {
  Completed: "success", Terpenuhi: "success", "On Track": "success",
  "In Progress": "info", Active: "info",
  Planned: "warning", "Needs Review": "warning", Identified: "warning", Draft: "neutral",
  Gap: "danger", Cancelled: "danger", "Needs Attention": "danger",
  "Data Belum Cukup": "neutral", "Bukti Belum Cukup": "neutral", "Not Evaluated": "neutral", "Belum dinilai": "neutral", "Belum Ada Persyaratan": "neutral",
};

// Display labels for status and priority values. Stored values stay English; this only changes what users read.
const STATUS_LABELS: Record<string, string> = {
  Completed: "Selesai", "In Progress": "Sedang Berjalan", Planned: "Direncanakan", Identified: "Teridentifikasi",
  Draft: "Draf", Cancelled: "Dibatalkan", "Not Evaluated": "Belum Dievaluasi", "On Track": "Sesuai Target",
  Active: "Aktif", "Needs Review": "Perlu Ditinjau", "Needs Attention": "Perlu Perhatian", "Bukti Belum Cukup": "Data Belum Cukup",
  High: "Tinggi", Medium: "Sedang", Low: "Rendah",
};

export const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? "neutral";
  return <span data-testid="status-badge" className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none", toneStyles[tone])}>
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{statusLabel(status)}
  </span>;
}

export function SourceChip({ label, reference, href }: { label: string; reference?: string; href?: string | null }) {
  const content = <><Link2 aria-hidden="true" className="size-3 shrink-0" /><span className="font-semibold">{label}</span>{reference && <span className="truncate text-ink-2">{reference}</span>}</>;
  const style = "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-primary-50 px-2.5 py-1 text-[11px] text-primary-600";
  return href ? <Link href={href} className={cx(style, "hover:border-primary-500")}>{content}</Link> : <span className={style}>{content}</span>;
}

export function Card({ title, testId, actions, children, className, padded = true }: { title?: string; testId?: string; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return <section data-testid={title ? `card-${testId ?? slug(title)}` : undefined} className={cx("min-w-0 rounded-2xl border border-line bg-surface shadow-card", padded && "p-6", className)}>
    {(title || actions) && <div className={cx("flex flex-wrap items-center justify-between gap-3", padded ? "mb-5" : "px-6 pt-6 pb-4")}>
      {title && <h2 className="font-display text-lg text-ink">{title}</h2>}{actions}
    </div>}
    {children}
  </section>;
}

export function InfoGrid({ items, columns = 2 }: { items: { label: string; testId?: string; value: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[columns];
  return <dl className={cx("grid gap-x-8 gap-y-5", cols)}>{items.map((item) => <div key={item.label} data-testid={`info-${item.testId ?? slug(item.label)}`} className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">{item.label}</dt>
    <dd className="mt-1 break-words text-sm text-ink">{item.value}</dd>
  </div>)}</dl>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return <span aria-hidden="true" className={cx("flex shrink-0 items-center justify-center rounded-full bg-avatar font-semibold text-white", size === "lg" ? "size-16 text-xl" : "size-9 text-xs")}>{letters || "?"}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return <p className={cx("rounded-xl px-4 py-3 text-xs leading-5", tone === "warning" ? "bg-warning-bg text-warning" : "bg-info-bg text-primary-700")}>{children}</p>;
}

"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Button, cx, slug } from "./primitives";

const control = "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:bg-muted disabled:text-ink-3 aria-[invalid=true]:border-danger";

/* ---------- Filter bar ---------- */

export function FilterBar({ children, onReset, canReset }: { children: ReactNode; onReset?: () => void; canReset?: boolean }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
    {children}
    {onReset && <button type="button" data-testid="btn-filter-reset" onClick={onReset} disabled={!canReset} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold text-primary-600 hover:bg-primary-50 disabled:text-ink-3 disabled:hover:bg-transparent">
      <X aria-hidden="true" className="size-4" />Reset filter
    </button>}
  </div>;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative min-w-[220px] flex-[2_1_260px]">
    <span className="sr-only">{placeholder}</span>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-ink-3" />
    <input type="search" data-testid="input-search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cx(control, "bg-app pl-9")} />
  </label>;
}

export function SelectFilter({ label, testId, value, onChange, options }: { label: string; testId?: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label className="relative min-w-[160px] flex-[1_1_160px]">
    <span className="sr-only">{label}</span>
    <select data-testid={`filter-${testId ?? slug(label)}`} value={value} onChange={(event) => onChange(event.target.value)} className={cx(control, "appearance-none pr-9", !value && "text-ink-2")}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-ink-3" />
  </label>;
}

/* ---------- Form fields ---------- */

function FieldShell({ label, required, error, helper, children, id, className }: { label: string; required?: boolean; error?: string; helper?: string; children: ReactNode; id: string; className?: string }) {
  return <div className={cx("min-w-0", className)}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-2">{label}{required && <span className="text-danger"> *</span>}</label>
    {children}
    {error ? <p id={`${id}-message`} className="mt-1.5 text-xs text-danger">{error}</p> : helper ? <p id={`${id}-message`} className="mt-1.5 text-xs text-ink-3">{helper}</p> : null}
  </div>;
}

/** testId: keeps the Katalon id from the original English label when the visible label is translated. */
type Common = { label: string; testId?: string; required?: boolean; error?: string; helper?: string; className?: string };

export function TextField({ label, testId, required, error, helper, className, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <input id={id} data-testid={`input-${testId ?? slug(label)}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} required={required} {...props} className={control} />
  </FieldShell>;
}

export function SelectField({ label, testId, required, error, helper, className, children, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <div className="relative">
      <select id={id} data-testid={`input-${testId ?? slug(label)}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} required={required} {...props} className={cx(control, "appearance-none pr-9")}>{children}</select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-ink-3" />
    </div>
  </FieldShell>;
}

export function TextAreaField({ label, testId, required, error, helper, className, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <textarea id={id} data-testid={`input-${testId ?? slug(label)}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} required={required} rows={3} {...props} className={cx(control, "h-auto py-2.5")} />
  </FieldShell>;
}

export function ReadOnlyField({ label, testId, value, className }: { label: string; testId?: string; value: ReactNode; className?: string }) {
  return <div className={cx("min-w-0", className)}>
    <p className="mb-1.5 text-sm font-semibold text-ink-2">{label}</p>
    <div data-testid={`readonly-${testId ?? slug(label)}`} className="flex min-h-10 items-center rounded-[10px] bg-muted px-3 text-sm text-ink">{value}</div>
  </div>;
}

/**
 * One active record per employee and period: when one exists, saving is allowed only as an explicit
 * revision of it, so a second record never silently replaces the one shown on the page.
 */
export function RevisionConfirm({ what, existing, checked, onChange, error }: { what: string; existing: string; checked: boolean; onChange: (checked: boolean) => void; error?: string }) {
  const id = useId();
  return <div className={cx("rounded-xl border px-4 py-3 text-xs leading-5", error ? "border-danger bg-danger-bg" : "border-warning/30 bg-warning-bg")}>
    <p className="text-warning">{what} untuk periode ini sudah ada ({existing}). Menyimpan akan membuat <strong>revisi</strong>; versi sebelumnya tetap ada di riwayat.</p>
    <label htmlFor={id} className="mt-2 flex items-center gap-2 font-semibold text-ink">
      <input id={id} type="checkbox" data-testid="checkbox-revision" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary-600" />
      Simpan sebagai revisi
    </label>
    {error && <p className="mt-1 text-danger">{error}</p>}
  </div>;
}

/* ---------- Modal ---------- */

/**
 * Centered form modal (reviewer note K1). 640 px by default, 880 px for the KPI scorecard.
 * Escape, the overlay and X close it — after a confirm once a field was edited, so typed data is not lost
 * by a stray click. Focus starts in the dialog and returns to the page on close.
 */
export function FormModal({ title, description, size = "md", onClose, children, footer }: {
  title: string;
  description?: string;
  size?: "md" | "lg";
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Callers pass an inline onClose, so it changes on every parent render. Keeping it in a ref lets the
  // effect below run once per open; otherwise each re-render (busy flag, toast) would refocus the first field.
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  const dirty = useRef(false);
  const requestClose = useCallback(() => { if (!dirty.current || window.confirm("Tutup tanpa menyimpan perubahan?")) closeRef.current(); }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const body = dialog.current?.querySelector<HTMLElement>("[data-modal-body]");
    (body?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ?? dialog.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]")];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; previous?.focus(); };
  }, [requestClose]);

  return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <div ref={dialog} role="dialog" data-testid="modal" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onInput={() => { dirty.current = true; }}
      className={cx("flex max-h-[88vh] w-full flex-col rounded-2xl bg-surface shadow-modal", size === "lg" ? "max-w-[880px]" : "max-w-[640px]")}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div><h2 id={titleId} data-testid="modal-title" className="font-display text-lg text-ink">{title}</h2>{description && <p className="mt-1 text-xs text-ink-3">{description}</p>}</div>
        <button type="button" data-testid="btn-modal-close" aria-label="Tutup" onClick={requestClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink"><X className="size-5" /></button>
      </header>
      <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer>
    </div>
  </div>, document.body);
}

export function ModalActions({ onCancel, busy, submitLabel, secondary, disabled = false }: { onCancel: () => void; busy: boolean; submitLabel: string; secondary?: ReactNode; disabled?: boolean }) {
  return <>
    <Button variant="secondary" data-testid="btn-modal-cancel" onClick={onCancel}>Batal</Button>
    {secondary}
    <Button type="submit" form="d4-modal-form" data-testid="btn-modal-submit" disabled={busy || disabled}>{busy ? "Menyimpan…" : submitLabel}</Button>
  </>;
}

export function FormError({ message }: { message: string }) {
  return message ? <p role="alert" data-testid="form-error" className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{message}</p> : null;
}

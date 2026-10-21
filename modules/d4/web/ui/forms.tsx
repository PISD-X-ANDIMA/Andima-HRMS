"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Button, cx, slug } from "./primitives";

const control = "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:bg-muted disabled:text-ink-3 aria-[invalid=true]:border-danger";

/* ---------- Filter bar ---------- */

export function FilterBar({ children, onReset, canReset }: { children: ReactNode; onReset?: () => void; canReset?: boolean }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
    {children}
    {/* D3 button variants (Figma PISD node 247:7): solid blue pill once a filter is set, the light "Disable" pill otherwise,
        so it is obvious the button can be pressed after filtering. */}
    {onReset && <button type="button" data-testid="btn-filter-reset" onClick={onReset} disabled={!canReset}
      className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-[20px] bg-[#3b6ff5] px-4 text-sm font-semibold text-white shadow-sm transition hover:shadow-[0_0_15px_2px_rgba(59,111,245,0.45)] disabled:cursor-not-allowed disabled:bg-[#d9e2ec] disabled:text-[#adbed1] disabled:shadow-none">
      <X aria-hidden="true" className="size-4" />Reset filter
    </button>}
  </div>;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative min-w-[200px] flex-[2_1_200px]">
    <span className="sr-only">{placeholder}</span>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-ink-3" />
    <input type="search" data-testid="input-search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cx(control, "bg-app pl-9")} />
  </label>;
}

const FILTER_VISIBLE = 10;

type Option = { value: string; label: string };

// Height of the open list: search box plus at most max-h-64 of options.
const PANEL_MAX = 320;

/**
 * Viewport position of the open list (D4-UI-02). The list is `fixed`, so a scrolling modal body cannot clip it. It
 * opens below the trigger, or above when there is more room there, and its height fits the room left.
 */
export function dropdownPlacement(anchor: { top: number; bottom: number; left: number; width: number }, viewportHeight: number) {
  const below = viewportHeight - anchor.bottom - 12, above = anchor.top - 12; // 4 px from the trigger, 8 px from the edge
  const up = below < PANEL_MAX && above > below;
  return {
    top: up ? "" : `${anchor.bottom + 4}px`, bottom: up ? `${viewportHeight - anchor.top + 4}px` : "",
    left: `${anchor.left}px`, width: `${anchor.width}px`, maxHeight: `${Math.min(PANEL_MAX, up ? above : below)}px`,
  };
}

/**
 * Dropdown with a search box on top (reviewer feedback), shared by list filters and form fields: opening it
 * lists the options, typing narrows them. Only FILTER_VISIBLE options are rendered at once (load test:
 * 1000 departments/employees); the rest are reached by typing. `emptyLabel` adds a "no value" choice.
 */
function SearchableSelect({ label, value, onChange, options, emptyLabel, testId, triggerId, invalid, describedBy, className, wrapperClassName, highlightActive }: {
  label: string; value: string; onChange: (value: string) => void; options: readonly Option[]; emptyLabel?: string; testId: string;
  triggerId?: string; invalid?: boolean; describedBy?: string; className?: string; wrapperClassName?: string; highlightActive?: boolean;
}) {
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = emptyLabel === undefined ? options : [{ value: "", label: emptyLabel }, ...options];
  const term = query.trim().toLowerCase();
  const allMatches = term ? all.filter((option) => option.label.toLowerCase().includes(term)) : all;
  const matches = allMatches.slice(0, FILTER_VISIBLE);
  const hidden = allMatches.length - matches.length;
  const selected = options.find((option) => option.value === value);
  // A list filter that narrows the table stands out, so users can see at a glance which filters are on.
  const active = Boolean(highlightActive && selected);
  const close = () => { setOpen(false); setQuery(""); };
  const pick = (next: string) => { onChange(next); close(); };
  // Arrow keys move between the search box and the options (keyboard use without Tab).
  const moveFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(`[data-search], #${CSS.escape(listId)} button`)];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = items[Math.min(items.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))];
    if (next) { event.preventDefault(); next.focus(); }
  };
  // The list stays inside the wrapper (blur, arrow keys and the modal focus trap rely on it) but is positioned on the
  // viewport, so it follows the trigger while the page or the modal body scrolls.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => { if (wrapper.current && panel.current) Object.assign(panel.current.style, dropdownPlacement(wrapper.current.getBoundingClientRect(), window.innerHeight)); };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  return <div ref={wrapper} className={cx("relative", wrapperClassName)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); close(); } else if (open) moveFocus(event); else if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>
    <button type="button" id={triggerId} data-testid={testId} aria-label={triggerId ? undefined : label} aria-haspopup="listbox" aria-expanded={open} aria-describedby={describedBy}
      data-active={active || undefined} title={selected ? `${label}: ${selected.label}` : undefined}
      onClick={() => open ? close() : setOpen(true)} className={cx(control, "flex items-center justify-between gap-2 text-left", !selected && "text-ink-2",
        active && "border-primary-500 bg-primary-50 font-semibold text-primary-700", invalid && "border-danger", className)}>
      <span className="truncate">{selected?.label ?? emptyLabel ?? label}</span>
      <ChevronDown aria-hidden="true" className={cx("size-4 shrink-0 transition-transform", active ? "text-primary-600" : "text-ink-3", open && "rotate-180")} />
    </button>
    {open && <div ref={panel} className="fixed z-30 flex flex-col rounded-[10px] border border-line bg-surface p-1.5 shadow-card">
      <label className="relative block">
        <span className="sr-only">Search {label}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-3" />
        <input autoFocus data-search data-testid={testId.replace(/^(filter|input)-/, "search-")} role="combobox" aria-controls={listId} aria-expanded aria-autocomplete="list" value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); pick(matches[0].value); } }}
          placeholder="Search…" className="h-9 w-full rounded-lg border border-line-strong bg-app pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-primary-500" />
      </label>
      <ul id={listId} role="listbox" data-testid={testId.replace(/^(filter|input)-/, "options-")} aria-label={label} className="mt-1.5 max-h-64 min-h-0 overflow-y-auto text-sm">
        {matches.length ? matches.map((option) => <li key={option.value || "empty"} role="option" aria-selected={option.value === value}>
          {/* Safari does not focus a clicked button, so without this the input's blur closes the list before the click lands. */}
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(option.value)} className={cx("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-ink hover:bg-primary-50 focus:bg-primary-50 focus:outline-none", option.value === value && "font-semibold text-primary-600")}>
            <Check aria-hidden="true" className={cx("size-4 shrink-0", option.value !== value && "invisible")} />{option.label}
          </button>
        </li>) : <li className="px-2.5 py-2 text-ink-3">Tidak ada yang cocok</li>}
        {hidden > 0 && <li data-testid={testId.replace(/^(filter|input)-/, "more-")} className="px-2.5 py-2 text-xs text-ink-3">+{hidden} lainnya — ketik untuk mempersempit</li>}
      </ul>
    </div>}
  </div>;
}

/** List filter. `emptyOption={false}` drops the "All …" choice for filters that always show one value (the dashboard period). */
export function SelectFilter({ label, testId, value, onChange, options, emptyOption = true }: { label: string; testId?: string; value: string; onChange: (value: string) => void; options: Option[]; emptyOption?: boolean }) {
  return <SearchableSelect label={label} value={value} onChange={onChange} options={options} emptyLabel={emptyOption ? label : undefined}
    testId={`filter-${testId ?? slug(label)}`} wrapperClassName="min-w-[150px] flex-[1_1_150px]" highlightActive={emptyOption} />;
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

/** Form field for long lists (employees, positions): same searchable dropdown as the filters. */
export function SearchSelectField({ label, testId, required, error, helper, className, value, onChange, options, placeholder }: Common & { value: string; onChange: (value: string) => void; options: readonly Option[]; placeholder: string }) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <SearchableSelect label={label} value={value} onChange={onChange} options={options} emptyLabel={placeholder} testId={`input-${testId ?? slug(label)}`}
      triggerId={id} invalid={Boolean(error)} describedBy={error || helper ? `${id}-message` : undefined} />
  </FieldShell>;
}

export function TextAreaField({ label, testId, required, error, helper, className, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <textarea id={id} data-testid={`input-${testId ?? slug(label)}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} required={required} rows={3} {...props} className={cx(control, "h-auto py-2.5")} />
  </FieldShell>;
}

/** A few choices that should all stay visible (fewer than five): radio buttons instead of a dropdown. */
export function RadioField({ label, testId, required, error, helper, className, value, onChange, options }: Common & { value: string; onChange: (value: string) => void; options: readonly (Option & { description?: string; testId?: string })[] }) {
  const id = useId();
  const name = testId ?? slug(label);
  return <fieldset data-testid={`input-${name}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} className={cx("min-w-0", className)}>
    <legend className="mb-1.5 block text-sm font-semibold text-ink-2">{label}{required && <span className="text-danger"> *</span>}</legend>
    <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-strong px-3 py-2.5 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500/15">
      <input type="radio" name={`${id}-${name}`} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} required={required}
        data-testid={`input-${name}-${option.testId ?? slug(option.value)}`} className="mt-0.5 size-4 shrink-0 accent-primary-600" />
      <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{option.label}</span>{option.description && <span className="mt-0.5 block text-xs text-ink-3">{option.description}</span>}</span>
    </label>)}</div>
    {error ? <p id={`${id}-message`} className="mt-1.5 text-xs text-danger">{error}</p> : helper ? <p id={`${id}-message`} className="mt-1.5 text-xs text-ink-3">{helper}</p> : null}
  </fieldset>;
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
      Save as revision
    </label>
    {error && <p className="mt-1 text-danger">{error}</p>}
  </div>;
}

/* ---------- Modal ---------- */

// Lets the footer Cancel button go through the same discard confirm as X / Escape / overlay.
const ModalCloseContext = createContext<(() => void) | null>(null);

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
  // In-app confirm instead of the browser's default window.confirm popup.
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  useLayoutEffect(() => { confirmingRef.current = confirming; });
  const requestClose = useCallback(() => { if (dirty.current) setConfirming(true); else closeRef.current(); }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const body = dialog.current?.querySelector<HTMLElement>("[data-modal-body]");
    (body?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])") ?? dialog.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (confirmingRef.current) setConfirming(false); else requestClose(); }
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
      className={cx("relative flex max-h-[88vh] w-full flex-col rounded-2xl bg-surface shadow-modal", size === "lg" ? "max-w-[880px]" : "max-w-[640px]")}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div><h2 id={titleId} data-testid="modal-title" className="font-display font-semibold text-lg text-ink">{title}</h2>{description && <p className="mt-1 text-xs text-ink-3">{description}</p>}</div>
        <button type="button" data-testid="btn-modal-close" aria-label="Close" onClick={requestClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink"><X className="size-5" /></button>
      </header>
      <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4"><ModalCloseContext.Provider value={requestClose}>{footer}</ModalCloseContext.Provider></footer>
      {confirming && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ink/30 p-6">
        <div role="alertdialog" data-testid="modal-discard-confirm" aria-labelledby={`${titleId}-discard`} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-modal">
          <h3 id={`${titleId}-discard`} className="font-display font-semibold text-base text-ink">Buang perubahan?</h3>
          <p className="mt-1.5 text-sm text-ink-3">Data yang sudah diisi tidak akan disimpan.</p>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" data-testid="btn-discard-keep" autoFocus onClick={() => setConfirming(false)}>Keep editing</Button>
            <Button variant="danger" data-testid="btn-discard-confirm" onClick={() => closeRef.current()}>Discard</Button>
          </div>
        </div>
      </div>}
    </div>
  </div>, document.body);
}

export function ModalActions({ onCancel, busy, submitLabel, secondary, disabled = false }: { onCancel: () => void; busy: boolean; submitLabel: string; secondary?: ReactNode; disabled?: boolean }) {
  const requestClose = useContext(ModalCloseContext);
  return <>
    <Button variant="secondary" data-testid="btn-modal-cancel" onClick={requestClose ?? onCancel}>Cancel</Button>
    {secondary}
    <Button type="submit" form="d4-modal-form" data-testid="btn-modal-submit" disabled={busy || disabled}>{busy ? "Menyimpan…" : submitLabel}</Button>
  </>;
}

export function FormError({ message }: { message: string }) {
  return message ? <p role="alert" data-testid="form-error" className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{message}</p> : null;
}

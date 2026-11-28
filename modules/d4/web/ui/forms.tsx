"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { localToday } from "../../shared/rules";
import type { Language } from "../../shared/text";
import { sourceText, useLanguage } from "../i18n/LanguageProvider";
import { Button, cx, slug } from "./primitives";

const control = "h-10 w-full rounded-2xl border border-ink-3 bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:bg-muted disabled:text-ink-3 aria-[invalid=true]:border-danger";

/* ---------- Filter bar ---------- */

type FilterProps = Parameters<typeof SelectFilter>[0];

// Inside the Filter panel each dropdown carries its field name above it, so its empty choice can read just "All".
const FilterPanelContext = createContext(false);

/**
 * Search, the period, and one Filter button (decisions 13 Nov 2026). The other dropdowns wait in a panel under the row;
 * how many of them are set shows on the Filter button, read from the SelectFilter children, which must be direct
 * children (no fragment). A bar with a single dropdown keeps it in the row: a button for one choice is a wasted click.
 */
export function FilterBar({ search, period, children, onReset, canReset }: { search?: ReactNode; period?: ReactNode; children?: ReactNode; onReset?: () => void; canReset?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const filters = Children.toArray(children).filter((child): child is ReactElement<FilterProps> => isValidElement(child) && child.type === SelectFilter);
  const folded = filters.length > 1;
  const active = filters.filter(({ props }) => props.value && props.emptyOption !== false).length;
  // D3 button (Figma PISD node 247:7), shown only once a filter is set: an always-present disabled pill was clutter.
  // Figma's #3b6ff5 is a shade darker here so white text reaches 4.5:1.
  const reset = onReset && canReset && <button type="button" data-testid="btn-filter-reset" onClick={onReset}
    className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-[20px] bg-[#346af5] px-4 text-sm font-semibold text-white shadow-sm transition hover:shadow-[0_0_15px_2px_rgba(59,111,245,0.45)]">
    <X aria-hidden="true" className="size-4" />{t("Reset filter")}
  </button>;
  return <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
    <div className="flex flex-wrap items-center gap-3">
      {search}
      {period}
      {folded ? <button ref={button} type="button" data-testid="btn-filter" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}
        className={cx("inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border bg-surface px-3 text-sm font-semibold text-ink hover:border-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500", open ? "border-primary-500" : "border-ink-3")}>
        <SlidersHorizontal aria-hidden="true" className="size-4" />{t("Filter")}
        {active > 0 && <span data-testid="filter-count" className="min-w-5 rounded-full bg-primary-600 px-1.5 text-center text-[11px] leading-5 text-white">{active}<span className="sr-only"> {t("active")}</span></span>}
      </button> : <>{children}{reset}</>}
    </div>
    {/* Reset sits in the panel, never beside the Filter button: appearing there it pushed Filter aside, and a second click
        meant to close the panel landed on Reset and wiped the filters just chosen. */}
    {folded && open && <div id={panelId} data-testid="filter-panel" className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3"
      onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } }}>
      <FilterPanelContext.Provider value>{children}</FilterPanelContext.Provider>{reset}
    </div>}
  </div>;
}

/** The period stays beside search, out of the Filter panel (decision 13 Nov 2026): it sets what the page shows and changes often. */
export function PeriodFilter(props: Omit<FilterProps, "icon">) {
  return <SelectFilter {...props} icon={<CalendarDays aria-hidden="true" className="size-4 shrink-0 text-ink-3" />} />;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  // Takes the room the Filter button leaves, so its placeholder is not cut off; on a phone it shares the row with it.
  return <label className="relative min-w-0 flex-1 basis-[180px]">
    <span className="sr-only">{placeholder}</span>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-ink-3" />
    <input type="search" data-testid="input-search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cx(control, "bg-app pl-9")} />
  </label>;
}

const FILTER_VISIBLE = 10;

// Keyboard focus on a list option or calendar cell: a 2 px outline (>= 3:1 on white and on the selected grey), not only a tint.
const focusRing = "focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-primary-600";

// A choice from a dropdown or calendar fires no input event, so FormModal is told directly that the form changed.
const ModalDirtyContext = createContext<() => void>(() => {});

type Option = { value: string; label: string; disabled?: boolean };

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

// Short lists open without a search box, as in the PISD design system; long ones (positions, employees) keep it.
const SEARCH_FROM = 8;

/**
 * Dropdown shared by list filters and form fields. Long lists get a search box on top (reviewer feedback): opening
 * it lists the options, typing narrows them. Only FILTER_VISIBLE options are rendered at once (load test:
 * 1000 departments/employees); the rest are reached by typing. `emptyLabel` adds a "no value" choice.
 */
function SearchableSelect({ label, value, onChange, options, emptyLabel, testId, triggerId, invalid, describedBy, className, wrapperClassName, highlightActive, disabled, icon }: {
  label: string; value: string; onChange: (value: string) => void; options: readonly Option[]; emptyLabel?: string; testId: string;
  triggerId?: string; invalid?: boolean; describedBy?: string; className?: string; wrapperClassName?: string; highlightActive?: boolean; disabled?: boolean; icon?: ReactNode;
}) {
  const { t } = useLanguage();
  const listId = useId(), ownId = useId();
  const buttonId = triggerId ?? ownId;
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const markDirty = useContext(ModalDirtyContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = emptyLabel === undefined ? options : [{ value: "", label: emptyLabel }, ...options];
  const term = query.trim().toLowerCase();
  const found = term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;
  // The "no value" choice does not use up one of the FILTER_VISIBLE places, or one real option hides behind "+1".
  const empty: Option[] = emptyLabel !== undefined && (!term || emptyLabel.toLowerCase().includes(term)) ? [{ value: "", label: emptyLabel }] : [];
  const matches = [...empty, ...found.slice(0, FILTER_VISIBLE)];
  const hidden = found.length - FILTER_VISIBLE;
  const selected = options.find((option) => option.value === value);
  // A list filter that narrows the table stands out, so users can see at a glance which filters are on.
  const active = Boolean(highlightActive && selected);
  const close = () => { setOpen(false); setQuery(""); };
  // Esc and a choice put focus back on the trigger; the focused option or search box is about to unmount.
  const closeToTrigger = () => { close(); document.getElementById(buttonId)?.focus(); };
  const pick = (next: string) => { onChange(next); markDirty(); closeToTrigger(); };
  // Arrow keys move between the search box and the options (keyboard use without Tab).
  const moveFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(`[data-search], #${CSS.escape(listId)} button:not(:disabled)`)];
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
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); closeToTrigger(); } else if (open) moveFocus(event); else if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}>
    <button type="button" id={buttonId} data-testid={testId} aria-label={triggerId ? undefined : label} aria-haspopup="listbox" aria-expanded={open} aria-describedby={describedBy} disabled={disabled}
      data-active={active || undefined} title={selected ? `${label}: ${selected.label}` : undefined}
      // Safari and Firefox on macOS do not focus a clicked button, so pressing it again blurred the search box, the blur
      // closed the list and the click reopened it. Keeping focus where it is lets the click close the list.
      onMouseDown={(event) => { if (open) event.preventDefault(); }}
      onClick={() => open ? closeToTrigger() : setOpen(true)} className={cx(control, "flex items-center justify-between gap-2 text-left", !selected && "text-ink-2",
        active && "border-primary-500 bg-primary-50 font-semibold text-primary-700", invalid && "border-danger", className)}>
      {icon ? <span className="flex min-w-0 items-center gap-2">{icon}<span className="truncate">{selected?.label ?? emptyLabel ?? label}</span></span>
        : <span className="truncate">{selected?.label ?? emptyLabel ?? label}</span>}
      <ChevronDown aria-hidden="true" className={cx("size-4 shrink-0 transition-transform", active ? "text-primary-600" : "text-ink-3", open && "rotate-180")} />
    </button>
    {open && <div ref={panel} className="fixed z-30 flex flex-col rounded-2xl border border-line bg-surface p-1.5 shadow-card">
      {all.length >= SEARCH_FROM && <label className="relative mb-1.5 block">
        <span className="sr-only">{t("Search {label}", { label })}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-3" />
        <input autoFocus data-search data-testid={testId.replace(/^(filter|input)-/, "search-")} role="combobox" aria-controls={listId} aria-expanded aria-autocomplete="list" value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { const first = matches.find((option) => !option.disabled); if (event.key === "Enter" && first) { event.preventDefault(); pick(first.value); } }}
          placeholder={t("Search…")} className="h-9 w-full rounded-xl border border-line-strong bg-app pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-primary-500" />
      </label>}
      <ul id={listId} role="listbox" data-testid={testId.replace(/^(filter|input)-/, "options-")} aria-label={label} className="max-h-64 min-h-0 overflow-y-auto text-sm">
        {matches.length ? matches.map((option) => <li key={option.value || "empty"} role="option" aria-selected={option.value === value}>
          {/* Safari does not focus a clicked button, so without this the input's blur closes the list before the click lands. */}
          <button type="button" disabled={option.disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(option.value)} className={cx("flex w-full items-center rounded-xl px-3 py-2 text-left text-ink hover:bg-muted focus:bg-muted focus:outline-none disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent", focusRing, option.value === value && "bg-selected font-semibold hover:bg-selected focus:bg-selected")}>
            {option.label}
          </button>
        </li>) : <li className="px-2.5 py-2 text-ink-3">{t("Tidak ada yang cocok")}</li>}
        {hidden > 0 && <li data-testid={testId.replace(/^(filter|input)-/, "more-")} className="px-2.5 py-2 text-xs text-ink-3">{t("+{hidden} lainnya, ketik untuk mempersempit", { hidden })}</li>}
      </ul>
    </div>}
  </div>;
}

/**
 * List filter; `label` names the field ("Departments"). In the Filter panel the name stands above the dropdown and the
 * empty choice reads "All"; alone in a row there is nothing above it, so the empty choice reads "All departments".
 * `emptyOption={false}` drops that choice for filters that always show one value (the dashboard period).
 */
export function SelectFilter({ label, testId, value, onChange, options, emptyOption = true, icon }: { label: string; testId?: string; value: string; onChange: (value: string) => void; options: Option[]; emptyOption?: boolean; icon?: ReactNode }) {
  const { t } = useLanguage();
  const inPanel = useContext(FilterPanelContext);
  const id = useId();
  // A fixed width keeps a lone filter on a second row from stretching across the bar; two per row on a phone.
  const width = "w-[calc(50%-6px)] sm:w-[180px]";
  const select = <SearchableSelect label={label} value={value} onChange={onChange} options={options} triggerId={inPanel ? id : undefined}
    emptyLabel={emptyOption ? (inPanel ? t("All") : t("All {label}", { label: label.toLowerCase() })) : undefined}
    testId={`filter-${testId ?? slug(sourceText(label))}`} wrapperClassName={inPanel ? undefined : width} highlightActive={emptyOption} icon={icon} />;
  return inPanel ? <div className={width}><label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</label>{select}</div> : select;
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
    <input id={id} data-testid={`input-${testId ?? slug(sourceText(label))}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} required={required} {...props} className={control} />
  </FieldShell>;
}

/**
 * Form dropdown written with <option> children, rendered with the same PISD-styled list as the filters: the browser's
 * own <select> popup cannot be styled. An option with value "" is the placeholder.
 */
export function SelectField({ label, testId, required, error, helper, className, value, onChange, disabled, children }: Common & {
  value: string; onChange: (event: { target: { value: string } }) => void; disabled?: boolean; children: ReactNode;
}) {
  const id = useId();
  const all = Children.toArray(children).flatMap((child) => isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child)
    ? [{ value: String(child.props.value ?? ""), label: Children.toArray(child.props.children).join(""), disabled: child.props.disabled }] : []);
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <SearchableSelect label={label} value={value} onChange={(next) => onChange({ target: { value: next } })} options={all.filter((option) => option.value !== "")}
      emptyLabel={all.find((option) => option.value === "")?.label} testId={`input-${testId ?? slug(sourceText(label))}`} triggerId={id} invalid={Boolean(error)}
      describedBy={error || helper ? `${id}-message` : undefined} disabled={disabled} />
  </FieldShell>;
}

// Calendar names by language rather than by dictionary, like formatPeriod; Indonesian differs in Mei, Agu, Okt, Des.
const MONTHS: Record<Language, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
};
const WEEKDAYS: Record<Language, string[]> = { en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], id: ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"] };
const pad = (n: number) => String(n).padStart(2, "0");
/** YYYY-MM-DD `days` after `date` (UTC arithmetic, so no time zone shifts the day). */
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const addMonths = (month: string, by: number) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7); };
const readable = (value: string, language: Language) => value.length === 7 ? `${MONTHS[language][Number(value.slice(5)) - 1]} ${value.slice(0, 4)}` : `${Number(value.slice(8))} ${MONTHS[language][Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}`;

/**
 * Date (YYYY-MM-DD) or, with `month`, period (YYYY-MM) picker in the dropdown style. The browser's own calendar
 * cannot be styled and shows 10/11/2026, which reads as 10 Nov or 11 Oct depending on the locale; this one shows
 * "10 Nov 2026" like the rest of the app. Days or months outside `min`/`max` cannot be picked. Same onChange shape as
 * an input, so a form only swaps the component.
 */
export function DateField({ label, testId, required, error, helper, className, value, onChange, min, max, month }: Common & {
  value: string; onChange: (event: { target: { value: string } }) => void; min?: string; max?: string; month?: boolean;
}) {
  const { t, language } = useLanguage();
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const markDirty = useContext(ModalDirtyContext);
  const [open, setOpen] = useState(false);
  const today = localToday();
  const unit = (date: string) => month ? date.slice(0, 7) : date;
  // The cursor is the day (or month) keyboard focus sits on; the view shows its month (or year).
  const [cursor, setCursor] = useState(value || unit(today));
  const lo = min && unit(min), hi = max && unit(max);
  const outside = (item: string) => Boolean((lo && item < lo) || (hi && item > hi));
  const view = month ? cursor.slice(0, 4) : cursor.slice(0, 7);
  const cells = month
    ? MONTHS[language].map((_, index) => `${view}-${pad(index + 1)}`)
    : (() => {
        const first = `${view}-01`, lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
        const length = new Date(Date.UTC(Number(view.slice(0, 4)), Number(view.slice(5)), 0)).getUTCDate();
        return [...Array(lead).fill(""), ...Array.from({ length }, (_, index) => addDays(first, index))];
      })();
  const close = () => setOpen(false);
  const closeToTrigger = () => { close(); document.getElementById(id)?.focus(); };
  const pick = (next: string) => { if (outside(next)) return; onChange({ target: { value: next } }); markDirty(); closeToTrigger(); };
  const step = (by: number) => setCursor((at) => month ? addMonths(at, by) : addDays(at, by));
  const page = (by: number) => setCursor((at) => month ? addMonths(at, by * 12) : `${addMonths(at.slice(0, 7), by)}-01`);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!wrapper.current || !panel.current) return;
      const anchor = wrapper.current.getBoundingClientRect();
      Object.assign(panel.current.style, dropdownPlacement(anchor, window.innerHeight), { width: "296px", maxHeight: "", left: `${Math.max(8, Math.min(anchor.left, window.innerWidth - 304))}px` });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open]);
  // A month outside min/max has only disabled cells; focus then stays on the panel, so Esc and the arrow keys still work.
  useEffect(() => { if (open) (panel.current?.querySelector<HTMLElement>(`[data-cell="${cursor}"]:not(:disabled)`) ?? panel.current)?.focus(); }, [open, cursor]);
  const keys: Record<string, () => void> = month
    ? { ArrowLeft: () => step(-1), ArrowRight: () => step(1), ArrowUp: () => step(-3), ArrowDown: () => step(3), PageUp: () => page(-1), PageDown: () => page(1) }
    : { ArrowLeft: () => step(-1), ArrowRight: () => step(1), ArrowUp: () => step(-7), ArrowDown: () => step(7), PageUp: () => page(-1), PageDown: () => page(1) };
  const navButton = cx("inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-muted focus:bg-muted focus:outline-none", focusRing);
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <div ref={wrapper} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) { event.stopPropagation(); closeToTrigger(); }
        else if (open && keys[event.key] && event.target !== event.currentTarget.querySelector("button")) { event.preventDefault(); keys[event.key](); }
      }}>
      <button type="button" id={id} data-testid={`input-${testId ?? slug(sourceText(label))}`} aria-haspopup="dialog" aria-expanded={open}
        aria-describedby={error || helper ? `${id}-message` : undefined} onClick={() => { setCursor(value || unit(today)); setOpen(!open); }}
        className={cx(control, "flex items-center justify-between gap-2 text-left", !value && "text-ink-2", error && "border-danger")}>
        <span className="truncate">{value ? readable(value, language) : month ? t("Select period") : t("Select date")}</span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
      </button>
      {open && <div ref={panel} role="dialog" aria-label={label} tabIndex={-1} data-testid={`calendar-${testId ?? slug(sourceText(label))}`} className="fixed z-30 rounded-2xl border border-line bg-surface p-3 shadow-card outline-none">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label={month ? t("Previous year") : t("Previous month")} data-testid="calendar-prev" onMouseDown={(event) => event.preventDefault()} onClick={() => page(-1)} className={navButton}><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-semibold text-ink">{month ? view : readable(view, language)}</span>
          <button type="button" aria-label={month ? t("Next year") : t("Next month")} data-testid="calendar-next" onMouseDown={(event) => event.preventDefault()} onClick={() => page(1)} className={navButton}><ChevronRight className="size-4" /></button>
        </div>
        {!month && <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-3">{WEEKDAYS[language].map((day) => <span key={day} className="py-1">{day}</span>)}</div>}
        <div className={cx("grid gap-0.5 text-sm", month ? "grid-cols-3" : "grid-cols-7")}>
          {cells.map((cell, index) => cell ? <button key={cell} type="button" data-cell={cell} data-testid={`${month ? "month" : "day"}-${cell}`} tabIndex={cell === cursor ? 0 : -1}
            disabled={outside(cell)} aria-pressed={cell === value} aria-label={readable(cell, language)} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(cell)}
            className={cx("rounded-xl text-ink hover:bg-muted focus:bg-muted focus:outline-none disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent", focusRing, month ? "h-10" : "h-9",
              cell === unit(today) && "ring-1 ring-inset ring-primary-500", cell === value && "bg-selected font-semibold hover:bg-selected focus:bg-selected")}>
            {month ? MONTHS[language][Number(cell.slice(5)) - 1] : Number(cell.slice(8))}
          </button> : <span key={`lead-${index}`} />)}
        </div>
        {!outside(unit(today)) && <button type="button" data-testid="calendar-today" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(unit(today))}
          className={cx("mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold text-primary-600 hover:bg-muted focus:bg-muted focus:outline-none", focusRing)}>{month ? t("This month") : t("Today")}</button>}
      </div>}
    </div>
  </FieldShell>;
}

/** Free text with suggestions shown in the same list style as the dropdowns (the browser's datalist popup cannot be styled). */
export function SuggestField({ label, testId, required, error, helper, className, value, onChange, suggestions, maxLength, placeholder }: Common & {
  value: string; onChange: (value: string) => void; suggestions: readonly string[]; maxLength?: number; placeholder?: string;
}) {
  const id = useId(), listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLUListElement>(null);
  const markDirty = useContext(ModalDirtyContext);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = value.trim().toLowerCase();
  // A value that is already one of the suggestions lists them all, so it can be swapped for another.
  const matches = !term || suggestions.some((item) => item.toLowerCase() === term) ? suggestions : suggestions.filter((item) => item.toLowerCase().includes(term));
  const shown = open && matches.length > 0;
  const pick = (next: string) => { onChange(next); markDirty(); setOpen(false); setActive(-1); };
  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => { if (wrapper.current && panel.current) Object.assign(panel.current.style, dropdownPlacement(wrapper.current.getBoundingClientRect(), window.innerHeight)); };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [shown]);
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <div ref={wrapper} className="relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input id={id} data-testid={`input-${testId ?? slug(sourceText(label))}`} role="combobox" aria-expanded={shown} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined}
        autoComplete="off" required={required} maxLength={maxLength} value={value} placeholder={placeholder} className={cx(control, "pr-9")}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((at) => Math.min(matches.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1))));
          } else if (event.key === "Enter" && shown && active >= 0) { event.preventDefault(); pick(matches[active]); }
          else if (event.key === "Escape" && shown) { event.stopPropagation(); setOpen(false); }
        }} />
      {/* Without the dropdown's chevron an empty field next to a dropdown read as a broken box, not a list (24 Nov 2026). */}
      <ChevronDown aria-hidden="true" className={cx("pointer-events-none absolute right-3 top-3 size-4 text-ink-3 transition-transform", shown && "rotate-180")} />
      {shown && <ul ref={panel} id={listId} role="listbox" aria-label={label} className="fixed z-30 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-sm shadow-card">
        {matches.map((item, index) => <li key={item} id={`${listId}-${index}`} role="option" aria-selected={item === value}>
          <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(item)}
            className={cx("flex w-full items-center rounded-xl px-3 py-2 text-left text-ink hover:bg-muted", index === active && "bg-muted outline-2 -outline-offset-2 outline-primary-600", item === value && "bg-selected font-semibold hover:bg-selected")}>
            {item}
          </button>
        </li>)}
      </ul>}
    </div>
  </FieldShell>;
}

/** Form field for long lists of names (employees, positions): same searchable dropdown as the filters, sorted A-Z. */
export function SearchSelectField({ label, testId, required, error, helper, className, value, onChange, options, placeholder }: Common & { value: string; onChange: (value: string) => void; options: readonly Option[]; placeholder: string }) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    <SearchableSelect label={label} value={value} onChange={onChange} options={[...options].sort((a, b) => a.label.localeCompare(b.label))} emptyLabel={placeholder} testId={`input-${testId ?? slug(sourceText(label))}`}
      triggerId={id} invalid={Boolean(error)} describedBy={error || helper ? `${id}-message` : undefined} />
  </FieldShell>;
}

export function TextAreaField({ label, testId, required, error, helper, className, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return <FieldShell {...{ label, required, error, helper, id, className }}>
    {/* 2000 is the server limit of notes; a field with a larger one (general notes, 4000) passes its own. */}
    <textarea id={id} data-testid={`input-${testId ?? slug(sourceText(label))}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} required={required} rows={3} maxLength={2000} {...props} className={cx(control, "h-auto py-2.5")} />
  </FieldShell>;
}

/** A few choices that should all stay visible (fewer than five): radio buttons instead of a dropdown. */
export function RadioField({ label, testId, required, error, helper, className, value, onChange, options }: Common & { value: string; onChange: (value: string) => void; options: readonly (Option & { description?: string; testId?: string })[] }) {
  const id = useId();
  const name = testId ?? slug(sourceText(label));
  return <fieldset data-testid={`input-${name}`} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-message` : undefined} className={cx("min-w-0", className)}>
    <legend className="mb-1.5 block text-sm font-semibold text-ink-2">{label}{required && <span className="text-danger"> *</span>}</legend>
    <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-strong px-3 py-2.5 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500/15 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-muted has-[:disabled]:opacity-70">
      <input type="radio" name={`${id}-${name}`} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} required={required} disabled={option.disabled}
        data-testid={`input-${name}-${option.testId ?? slug(option.value)}`} className="mt-0.5 size-4 shrink-0 accent-primary-600" />
      <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{option.label}</span>{option.description && <span className="mt-0.5 block text-xs text-ink-3">{option.description}</span>}</span>
    </label>)}</div>
    {error ? <p id={`${id}-message`} className="mt-1.5 text-xs text-danger">{error}</p> : helper ? <p id={`${id}-message`} className="mt-1.5 text-xs text-ink-3">{helper}</p> : null}
  </fieldset>;
}

// Same border and corner as a disabled input: without them it read as a dropdown with its border missing (practice with
// Mas Bram, 13 Nov 2026). The muted fill still says it cannot be changed.
export function ReadOnlyField({ label, testId, value, className, helper }: { label: string; testId?: string; value: ReactNode; className?: string; helper?: string }) {
  return <div className={cx("min-w-0", className)}>
    <p className="mb-1.5 text-sm font-semibold text-ink-2">{label}</p>
    <div data-testid={`readonly-${testId ?? slug(sourceText(label))}`} className="flex min-h-10 items-center rounded-2xl border border-ink-3 bg-muted px-3 text-sm text-ink">{value}</div>
    {helper && <p className="mt-1.5 text-xs text-ink-3">{helper}</p>}
  </div>;
}

/**
 * One active record per employee and period: when one exists, saving is allowed only as an explicit
 * revision of it, so a second record never silently replaces the one shown on the page.
 */
export function RevisionConfirm({ what, existing, checked, onChange, error }: { what: string; existing: string; checked: boolean; onChange: (checked: boolean) => void; error?: string }) {
  const { t } = useLanguage();
  const id = useId();
  // {revision} is left unfilled by t, so the bold word can be set between the two halves.
  const [before, after] = t("{what} untuk periode ini sudah ada ({existing}). Menyimpan akan membuat {revision}; versi sebelumnya tetap ada di riwayat.", { what, existing }).split("{revision}");
  return <div className={cx("rounded-xl border px-4 py-3 text-xs leading-5", error ? "border-danger bg-danger-bg" : "border-warning/30 bg-warning-bg")}>
    <p className="text-warning">{before}<strong>{t("revisi")}</strong>{after}</p>
    <label htmlFor={id} className="mt-2 flex items-center gap-2 font-semibold text-ink">
      <input id={id} type="checkbox" data-testid="checkbox-revision" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary-600" />
      {t("Save as revision")}
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
  const { t } = useLanguage();
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
  const markDirty = useCallback(() => { dirty.current = true; }, []);
  const requestClose = useCallback(() => { if (dirty.current) setConfirming(true); else closeRef.current(); }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const body = dialog.current?.querySelector<HTMLElement>("[data-modal-body]");
    // Buttons count: Employee, Period and Date are dropdown and calendar buttons, and they come before the text fields.
    (body?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])") ?? dialog.current)?.focus();
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
        <button type="button" data-testid="btn-modal-close" aria-label={t("Close")} onClick={requestClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink"><X className="size-5" /></button>
      </header>
      <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><ModalDirtyContext.Provider value={markDirty}>{children}</ModalDirtyContext.Provider></div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4"><ModalCloseContext.Provider value={requestClose}>{footer}</ModalCloseContext.Provider></footer>
      {confirming && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-ink/30 p-6">
        <div role="alertdialog" data-testid="modal-discard-confirm" aria-labelledby={`${titleId}-discard`} className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-modal">
          <h3 id={`${titleId}-discard`} className="font-display font-semibold text-base text-ink">{t("Buang perubahan?")}</h3>
          <p className="mt-1.5 text-sm text-ink-3">{t("Data yang sudah diisi tidak akan disimpan.")}</p>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" data-testid="btn-discard-keep" autoFocus onClick={() => setConfirming(false)}>{t("Keep editing")}</Button>
            <Button variant="danger" data-testid="btn-discard-confirm" onClick={() => closeRef.current()}>{t("Discard")}</Button>
          </div>
        </div>
      </div>}
    </div>
  </div>, document.body);
}

export function ModalActions({ onCancel, busy, submitLabel, secondary, disabled = false }: { onCancel: () => void; busy: boolean; submitLabel: string; secondary?: ReactNode; disabled?: boolean }) {
  const { t } = useLanguage();
  const requestClose = useContext(ModalCloseContext);
  return <>
    <Button variant="secondary" data-testid="btn-modal-cancel" onClick={requestClose ?? onCancel}>{t("Cancel")}</Button>
    {secondary}
    <Button type="submit" form="d4-modal-form" data-testid="btn-modal-submit" disabled={busy || disabled}>{busy ? t("Menyimpan…") : submitLabel}</Button>
  </>;
}

export function FormError({ message }: { message: string }) {
  return message ? <p role="alert" data-testid="form-error" className="mb-5 rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{message}</p> : null;
}

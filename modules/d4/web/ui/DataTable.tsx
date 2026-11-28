"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, MoveHorizontal, SearchX } from "lucide-react";
import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { pinJustSaved } from "../data/selectors";
import { useLanguage } from "../i18n/LanguageProvider";
import { cx } from "./primitives";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Allow text to wrap (long text columns). Other cells stay on one line. */
  wrap?: boolean;
  /** Secondary column: hidden below 1400 px so the primary columns keep their room (matches Figma frame 28). */
  secondary?: boolean;
  /** Hidden below 1280 px, where the table shares a small laptop screen with the sidebar; the cell stays in the DOM. */
  optional?: boolean;
};

const secondaryCell = (column: { secondary?: boolean; optional?: boolean }) =>
  column.secondary ? "hidden min-[1400px]:table-cell" : column.optional && "hidden min-[1280px]:table-cell";

/**
 * Bulk select (interview 13 Nov 2026, 1:11:44): a checkbox left of each row `selectable` allows, select all over every
 * page of the current rows, and the page's action buttons in a bar above the table (buttons, not the ⋮ menu).
 */
export type Selection<T> = {
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  selectable: (row: T) => boolean;
  /** Accessible name of a row's checkbox, e.g. the employee and the training. */
  rowLabel: (row: T) => string;
  actions: ReactNode;
};

const PAGE_SIZES = [10, 20, 50, 100] as const;

// Below 640 px a row is a card: on a 390 px phone the pinned name and ⋮ columns left about 110 px for everything else.
// Only one of the two layouts is rendered, so test ids stay unique; the server and tests (no matchMedia) get the table.
const PHONE = "(max-width: 639px)";
const onPhoneChange = (listener: () => void) => {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(PHONE) : null;
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
};
const isPhone = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(PHONE).matches);

// The ⋮ column stays pinned to the right edge, so row actions remain reachable when long names push the table wider than the screen.
// Its edge shadow shows only while columns are actually scrolled underneath it.
const stickyAction = "sticky right-0 z-[1] transition-shadow group-data-[covered=true]:shadow-[-8px_0_8px_-8px_rgba(15,35,66,0.18)]";
// The first (name) column stays pinned on the left for the same reason: on a phone a scrolled row still says whose it is.
const stickyFirst = "sticky left-0 z-[1] transition-shadow group-data-[scrolled=true]:shadow-[8px_0_8px_-8px_rgba(15,35,66,0.18)]";
// Below 1400 px the sidebar leaves 700-1080 px for the table; 16 px cell padding keeps Development (1024 px) and
// Competency Gap (1280 px) from scrolling sideways. 20 px from 1400 px, as in the Figma frames (1440 px).
const cellX = "px-4 min-[1400px]:px-5";

/**
 * Page buttons to show: first, last, and the current page ±1, with gaps (load test: 1000 rows = 100 pages).
 * A gap stands for two or more pages; a single missing page is shown as its number instead.
 */
export function pageWindow(current: number, count: number): (number | "gap")[] {
  const pages = [...new Set([1, current - 1, current, current + 1, count])].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  return pages.flatMap((page, index) => {
    const step = index ? page - pages[index - 1] : 1;
    return step === 2 ? [page - 1, page] : step > 2 ? ["gap" as const, page] : [page];
  });
}

/**
 * Standard D4 table: caps header, 56 px rows, ⋮ action column last, pagination bottom right.
 * Clicking a row opens its detail page (same as "View Detail" in the menu).
 */
export function DataTable<T>({ rows: sorted, columns, rowKey, actions, emptyTitle, emptyText, noun, label, justSaved, selection }: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  emptyTitle: string;
  emptyText: string;
  noun: string;
  /** Accessible name of the table; defaults to the noun ("Employees"). */
  label?: string;
  /** Row just saved by the page, taken from its unfiltered rows: shown first and marked whatever the filters (pinJustSaved). */
  justSaved?: T;
  selection?: Selection<T>;
}) {
  const { t } = useLanguage();
  const rows = pinJustSaved(sorted, rowKey, justSaved);
  const things = t(noun);
  const tableLabel = label ?? things.charAt(0).toUpperCase() + things.slice(1);
  const phone = useSyncExternalStore(onPhoneChange, isPhone, () => false);
  const cards = phone && rows.length > 0;
  const pinned = justSaved && rows[0];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Other rows (a search or filter) start again at page 1; a re-render with the same rows (toast, saved edit) keeps the page.
  const signature = rows.map(rowKey).join("\n");
  const [pagedRows, setPagedRows] = useState(signature);
  if (pagedRows !== signature) { setPagedRows(signature); setPage(1); }
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const first = rows.length ? (current - 1) * pageSize + 1 : 0;
  const scroller = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [wide, setWide] = useState(false);
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    setCovered(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setScrolled(el.scrollLeft > 0);
    setWide(el.scrollWidth > el.clientWidth + 1);
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [cards]);
  // Keys selected among the current rows; a selection hidden by a filter is not acted on.
  const selectableKeys = selection ? rows.filter(selection.selectable).map(rowKey) : [];
  const chosen = selection ? selectableKeys.filter((key) => selection.selected.has(key)) : [];
  const allChosen = selectableKeys.length > 0 && chosen.length === selectableKeys.length;
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selection!.selected);
    if (on) next.add(key); else next.delete(key);
    selection!.onChange(next);
  };
  const toggleAll = () => {
    const next = new Set(selection!.selected);
    for (const key of selectableKeys) if (allChosen) next.delete(key); else next.add(key);
    selection!.onChange(next);
  };

  return <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    {selection && chosen.length > 0 && <div data-testid="selection-bar" className={cx("flex flex-wrap items-center gap-3 border-b border-line bg-primary-50 py-3", cellX)}>
      <span data-testid="selection-count" className="text-sm font-semibold text-ink">{t("{count} {noun} selected", { count: chosen.length, noun: t(noun, { count: chosen.length }) })}</span>
      {selection.actions}
      <button type="button" data-testid="btn-clear-selection" onClick={() => selection.onChange(new Set())}
        className="ml-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-600 hover:underline focus-visible:outline-2 focus-visible:outline-primary-500">{t("Clear selection")}</button>
    </div>}
    {cards && <PhoneRows rows={visible} columns={columns} rowKey={rowKey} actions={actions} pinned={pinned} things={things} label={tableLabel}
      selection={selection && { ...selection, toggle, toggleAll, allChosen, some: chosen.length > 0 && !allChosen, none: !selectableKeys.length }} />}
    {/* Stays while the table is wider than the screen, so it does not jump away as the user scrolls. */}
    {!cards && wide && <p data-testid="table-scroll-hint" className={cx("flex items-center gap-1.5 border-b border-line py-2 text-xs text-ink-2", cellX)}><MoveHorizontal aria-hidden="true" className="size-4 shrink-0" />{t("Scroll sideways to see all columns")}</p>}
    {!cards && <div ref={scroller} onScroll={measure} data-covered={covered} data-scrolled={scrolled} className="group overflow-x-auto">
      <table data-testid="data-table" aria-label={tableLabel} className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-app">
          <tr>{columns.map((column, index) => <th key={column.key} scope="col" className={cx(cellX, "py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3", index === 0 && cx(stickyFirst, "bg-app"), secondaryCell(column), column.className)}>
            {index === 0 && selection ? <span className="flex items-center gap-3">
              <SelectBox testId="checkbox-select-all" label={t("Select all {noun}", { noun: things })} checked={allChosen} indeterminate={chosen.length > 0 && !allChosen} disabled={!selectableKeys.length} onChange={toggleAll} />{column.header}
            </span> : column.header}</th>)}
            {actions && <th scope="col" className={cx(stickyAction, cellX, "w-16 bg-app py-3 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3")}>{t("Actions")}</th>}</tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const marked = row === pinned;
            const cellBg = marked ? "bg-primary-50" : "bg-surface";
            // Rows are not clickable: details open only from the ⋮ menu (View Detail / View History).
            return <tr key={rowKey(row)} data-testid={`row-${rowKey(row)}`} data-highlighted={marked || undefined} className={cx("h-14 border-t border-line", marked ? "bg-primary-50 [&_.text-ink-3]:text-ink-2" : "hover:bg-primary-50/40")}>
              {columns.map((column, index) => {
                const content = <>{column.cell(row)}{marked && index === 0 && <span data-testid="row-just-saved" className="mt-1 inline-block rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-semibold text-white">{t("Just saved")}</span>}</>;
                return <td key={column.key} data-testid={`cell-${column.key}`} className={cx(cellX, "py-3 align-middle text-ink", index === 0 && cx(stickyFirst, cellBg), !column.wrap && "whitespace-nowrap", secondaryCell(column), column.className)}>
                  {index === 0 && selection ? <div className="flex items-start gap-3">
                    {/* A row that cannot be selected keeps the space, so the names stay aligned. */}
                    {selection.selectable(row) ? <SelectBox testId={`checkbox-row-${rowKey(row)}`} label={t("Select {row}", { row: selection.rowLabel(row) })} checked={selection.selected.has(rowKey(row))} onChange={(on) => toggle(rowKey(row), on)} />
                      : <span aria-hidden="true" className="size-4 shrink-0" />}
                    <div className="min-w-0">{content}</div>
                  </div> : content}
                </td>;
              })}
              {actions && <td className={cx(stickyAction, cellBg, cellX, "py-3 text-right")}>{actions(row)}</td>}
            </tr>;
          })}
        </tbody>
      </table>
      {!rows.length && <div data-testid="table-empty" className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <SearchX aria-hidden="true" className="size-8 text-ink-3" />
        <p className="text-sm font-semibold text-ink">{emptyTitle}</p>
        <p className="max-w-md text-xs text-ink-3">{emptyText}</p>
      </div>}
    </div>}
    {rows.length > 0 && <footer className={cx("flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 text-xs text-ink-2", cellX)}>
      <div className="flex flex-wrap items-center gap-3">
        <span data-testid="table-count">{t("Showing {first}–{last} of {total} {noun}", { first, last: Math.min(current * pageSize, rows.length), total: rows.length, noun: t(noun, { count: rows.length }) })}</span>
        {/* Picker first, then its unit ("10 per page"), as in the reference of 24 Nov 2026. */}
        <span className="flex items-center gap-2.5 text-sm"><PageSizeSelect value={pageSize} onChange={(size) => { setPageSize(size); setPage(1); }} />{t("per page")}</span>
      </div>
      <nav aria-label={t("Pagination")} className="flex items-center gap-1">
        <button type="button" data-testid="btn-page-prev" aria-label={t("Previous page")} disabled={current === 1} onClick={() => setPage(current - 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface disabled:opacity-40"><ChevronLeft className="size-4" /></button>
        {pageWindow(current, pageCount).map((number, index) => number === "gap" ? <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-3">…</span> :
          <button key={number} type="button" data-testid={`btn-page-${number}`} aria-current={number === current ? "page" : undefined} onClick={() => setPage(number)}
            className={cx("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-semibold", number === current ? "bg-primary-600 text-white" : "border border-line bg-surface text-ink")}>{number}</button>)}
        <button type="button" data-testid="btn-page-next" aria-label={t("Next page")} disabled={current === pageCount} onClick={() => setPage(current + 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface disabled:opacity-40"><ChevronRight className="size-4" /></button>
      </nav>
    </footer>}
  </section>;
}

/** Phone layout of DataTable: the first column heads the card beside its checkbox and ⋮, the other columns follow as label and value. */
function PhoneRows<T>({ rows, columns, rowKey, actions, pinned, things, label, selection }: {
  rows: readonly T[]; columns: Column<T>[]; rowKey: (row: T) => string; actions?: (row: T) => ReactNode; pinned?: T | false; things: string; label: string;
  selection?: Selection<T> & { toggle: (key: string, on: boolean) => void; toggleAll: () => void; allChosen: boolean; some: boolean; none: boolean };
}) {
  const { t } = useLanguage();
  const [head, ...rest] = columns;
  return <>
    {selection && <div className={cx("flex items-center gap-3 border-b border-line bg-app py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3", cellX)}>
      <SelectBox testId="checkbox-select-all" label={t("Select all {noun}", { noun: things })} checked={selection.allChosen} indeterminate={selection.some} disabled={selection.none} onChange={selection.toggleAll} />{t("Select all")}
    </div>}
    {/* Compact copies (…-compact) stand in for columns a narrow table hides; a card shows every column, so they would repeat. */}
    <ul data-testid="data-cards" aria-label={label} className="divide-y divide-line [&_[data-testid$=-compact]]:hidden">
      {rows.map((row) => {
        const key = rowKey(row);
        const marked = row === pinned;
        return <li key={key} data-testid={`row-${key}`} data-highlighted={marked || undefined} className={cx("py-3.5", cellX, marked && "bg-primary-50 [&_.text-ink-3]:text-ink-2")}>
          <div className="flex items-start gap-3">
            {selection && (selection.selectable(row)
              ? <SelectBox testId={`checkbox-row-${key}`} label={t("Select {row}", { row: selection.rowLabel(row) })} checked={selection.selected.has(key)} onChange={(on) => selection.toggle(key, on)} />
              : <span aria-hidden="true" className="size-4 shrink-0" />)}
            <div className="min-w-0 flex-1 text-sm text-ink">{head.cell(row)}
              {marked && <span data-testid="row-just-saved" className="mt-1 inline-block rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-semibold text-white">{t("Just saved")}</span>}</div>
            {actions && <div className="-mr-2 -mt-1 shrink-0">{actions(row)}</div>}
          </div>
          <dl className={cx("mt-2.5 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm", selection && "pl-7")}>
            {rest.map((column) => <Fragment key={column.key}>
              <dt className="pt-0.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-ink-3">{column.header}</dt>
              <dd data-testid={`cell-${column.key}`} className="min-w-0 break-words text-ink">{column.cell(row)}</dd>
            </Fragment>)}
          </dl>
        </li>;
      })}
    </ul>
  </>;
}

/**
 * Rows-per-page picker in the same dropdown style as the filters instead of the OS-native <select>.
 * Portalled with fixed position (like RowActionMenu) because the table card clips overflow.
 */
function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const { t } = useLanguage();
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !trigger.current?.contains(target)) setPosition(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setPosition(null); trigger.current?.focus(); } };
    const close = () => setPosition(null);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    list.current?.querySelector<HTMLElement>("[aria-selected=true] button")?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    if (open) { setPosition(null); return; }
    const rect = trigger.current!.getBoundingClientRect();
    const height = PAGE_SIZES.length * 36 + 12;
    // Opens upward: the picker sits in the table footer, usually near the bottom of the screen.
    const top = rect.top - height - 4 >= 8 ? rect.top - height - 4 : rect.bottom + 4;
    setPosition({ top, left: rect.left, width: rect.width });
  }

  function onListKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[Math.min(items.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  return <>
    <button ref={trigger} type="button" data-testid="select-page-size" aria-label={t("Rows per page")} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={toggle}
      className="inline-flex h-9 w-[84px] items-center justify-between rounded-lg border border-line bg-surface pl-3.5 pr-2 text-sm font-semibold text-ink hover:border-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500">
      {value}<ChevronDown aria-hidden="true" className={cx("size-4 text-ink-2 transition-transform", open && "rotate-180")} />
    </button>
    {open && createPortal(<ul ref={list} id={listId} role="listbox" data-testid="options-page-size" aria-label={t("Rows per page")} onKeyDown={onListKey}
      style={{ top: position.top, left: position.left, width: position.width }} className="fixed z-[70] rounded-[10px] border border-line bg-surface p-1.5 text-sm shadow-card">
      {PAGE_SIZES.map((size) => <li key={size} role="option" aria-selected={size === value}>
        <button type="button" data-testid={`option-page-size-${size}`} onClick={() => { onChange(size); setPosition(null); trigger.current?.focus(); }}
          className={cx("flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-ink hover:bg-primary-50 focus:bg-primary-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-primary-600", size === value && "font-semibold text-primary-600")}>
          <Check aria-hidden="true" className={cx("size-4 shrink-0", size !== value && "invisible")} />{size}
        </button>
      </li>)}
    </ul>, document.body)}
  </>;
}

/** Row or select-all checkbox. The label pads the 16 px box to a 36 px click area (UI-D4-001 §2) without moving the row. */
function SelectBox({ testId, label, checked, indeterminate = false, disabled, onChange }: { testId: string; label: string; checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (box.current) box.current.indeterminate = indeterminate; }, [indeterminate]);
  return <label className={cx("-m-2.5 inline-flex shrink-0 p-2.5", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
    <input ref={box} type="checkbox" data-testid={testId} aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)}
      className="size-4 accent-primary-600 disabled:opacity-40" />
  </label>;
}

/** First column content: name + employee code. */
export function PersonCell({ name, code }: { name: string; code: string }) {
  return <span className="block min-w-[140px]"><strong className="block whitespace-normal break-words font-semibold text-ink">{name}</strong><span className="block text-xs text-ink-3">{code}</span></span>;
}

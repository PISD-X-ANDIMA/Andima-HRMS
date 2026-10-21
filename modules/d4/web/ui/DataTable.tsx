"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
};

const secondaryCell = (column: { secondary?: boolean }) => column.secondary && "hidden min-[1400px]:table-cell";

const PAGE_SIZES = [10, 20, 50, 100] as const;

// The ⋮ column stays pinned to the right edge, so row actions remain reachable when long names push the table wider than the screen.
// Its edge shadow shows only while columns are actually scrolled underneath it.
const stickyAction = "sticky right-0 z-[1] transition-shadow group-data-[covered=true]:shadow-[-8px_0_8px_-8px_rgba(15,35,66,0.18)]";

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
export function DataTable<T>({ rows, columns, rowKey, actions, emptyTitle, emptyText, noun }: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  emptyTitle: string;
  emptyText: string;
  noun: string;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const first = rows.length ? (current - 1) * pageSize + 1 : 0;
  const scroller = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState(false);
  const measure = () => {
    const el = scroller.current;
    if (el) setCovered(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <div ref={scroller} onScroll={measure} data-covered={covered} className="group overflow-x-auto">
      <table data-testid="data-table" className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-app">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={cx("px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3", secondaryCell(column), column.className)}>{column.header}</th>)}
            {actions && <th scope="col" className={cx(stickyAction, "w-16 bg-app px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3")}>Actions</th>}</tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            // Rows are not clickable: details open only from the ⋮ menu (View Detail / View History).
            return <tr key={rowKey(row)} data-testid={`row-${rowKey(row)}`} className="h-14 border-t border-line hover:bg-primary-50/40">
              {columns.map((column) => <td key={column.key} data-testid={`cell-${column.key}`} className={cx("px-5 py-3 align-middle text-ink", !column.wrap && "whitespace-nowrap", secondaryCell(column), column.className)}>{column.cell(row)}</td>)}
              {actions && <td className={cx(stickyAction, "bg-surface px-5 py-3 text-right")}>{actions(row)}</td>}
            </tr>;
          })}
        </tbody>
      </table>
      {!rows.length && <div data-testid="table-empty" className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <SearchX aria-hidden="true" className="size-8 text-ink-3" />
        <p className="text-sm font-semibold text-ink">{emptyTitle}</p>
        <p className="max-w-md text-xs text-ink-3">{emptyText}</p>
      </div>}
    </div>
    {rows.length > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-2">
      <div className="flex flex-wrap items-center gap-3">
        <span data-testid="table-count">Showing {first}–{Math.min(current * pageSize, rows.length)} of {rows.length} {noun}</span>
        <span className="flex items-center gap-1.5">Rows per page<PageSizeSelect value={pageSize} onChange={(size) => { setPageSize(size); setPage(1); }} /></span>
      </div>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button type="button" data-testid="btn-page-prev" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface disabled:opacity-40"><ChevronLeft className="size-4" /></button>
        {pageWindow(current, pageCount).map((number, index) => number === "gap" ? <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-3">…</span> :
          <button key={number} type="button" data-testid={`btn-page-${number}`} aria-current={number === current ? "page" : undefined} onClick={() => setPage(number)}
            className={cx("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-semibold", number === current ? "bg-primary-600 text-white" : "border border-line bg-surface text-ink")}>{number}</button>)}
        <button type="button" data-testid="btn-page-next" aria-label="Next page" disabled={current === pageCount} onClick={() => setPage(current + 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface disabled:opacity-40"><ChevronRight className="size-4" /></button>
      </nav>
    </footer>}
  </section>;
}

/**
 * "Rows per page" picker in the same dropdown style as the filters instead of the OS-native <select>.
 * Portalled with fixed position (like RowActionMenu) because the table card clips overflow.
 */
function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
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
    setPosition({ top, left: rect.left });
  }

  function onListKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[Math.min(items.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  return <>
    <button ref={trigger} type="button" data-testid="select-page-size" aria-label="Rows per page" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={toggle}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface pl-2.5 pr-2 font-semibold text-ink hover:border-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500">
      {value}<ChevronDown aria-hidden="true" className={cx("size-4 text-ink-3 transition-transform", open && "rotate-180")} />
    </button>
    {open && createPortal(<ul ref={list} id={listId} role="listbox" data-testid="options-page-size" aria-label="Rows per page" onKeyDown={onListKey}
      style={{ top: position.top, left: position.left }} className="fixed z-[70] w-24 rounded-[10px] border border-line bg-surface p-1.5 text-sm shadow-card">
      {PAGE_SIZES.map((size) => <li key={size} role="option" aria-selected={size === value}>
        <button type="button" data-testid={`option-page-size-${size}`} onClick={() => { onChange(size); setPosition(null); trigger.current?.focus(); }}
          className={cx("flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-ink hover:bg-primary-50 focus:bg-primary-50 focus:outline-none", size === value && "font-semibold text-primary-600")}>
          <Check aria-hidden="true" className={cx("size-4 shrink-0", size !== value && "invisible")} />{size}
        </button>
      </li>)}
    </ul>, document.body)}
  </>;
}

/** First column content: name + employee code. */
export function PersonCell({ name, code }: { name: string; code: string }) {
  return <span className="block min-w-[140px]"><strong className="block whitespace-normal break-words font-semibold text-ink">{name}</strong><span className="block text-xs text-ink-3">{code}</span></span>;
}

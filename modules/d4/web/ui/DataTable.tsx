"use client";

import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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

const PAGE_SIZE = 8;

/**
 * Standard D4 table: caps header, 56 px rows, ⋮ action column last, pagination bottom right.
 * Clicking a row opens its detail page (same as "View Detail" in the menu).
 */
export function DataTable<T>({ rows, columns, rowKey, rowHref, actions, emptyTitle, emptyText, noun }: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | null;
  actions?: (row: T) => ReactNode;
  emptyTitle: string;
  emptyText: string;
  noun: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const first = rows.length ? (current - 1) * PAGE_SIZE + 1 : 0;

  return <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-app">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className={cx("px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3", secondaryCell(column), column.className)}>{column.header}</th>)}
            {actions && <th scope="col" className="w-16 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">Action</th>}</tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const href = rowHref?.(row);
            return <tr key={rowKey(row)} onClick={href ? () => router.push(href) : undefined}
              className={cx("h-14 border-t border-line", href && "cursor-pointer hover:bg-primary-50/60")}>
              {columns.map((column) => <td key={column.key} className={cx("px-5 py-3 align-middle text-ink", !column.wrap && "whitespace-nowrap", secondaryCell(column), column.className)}>{column.cell(row)}</td>)}
              {actions && <td className="px-5 py-3 text-right">{actions(row)}</td>}
            </tr>;
          })}
        </tbody>
      </table>
      {!rows.length && <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <SearchX aria-hidden="true" className="size-8 text-ink-3" />
        <p className="text-sm font-semibold text-ink">{emptyTitle}</p>
        <p className="max-w-md text-xs text-ink-3">{emptyText}</p>
      </div>}
    </div>
    {rows.length > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-2">
      <span>Showing {first}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length} {noun}</span>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button type="button" aria-label="Halaman sebelumnya" disabled={current === 1} onClick={() => setPage(current - 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface disabled:opacity-40"><ChevronLeft className="size-4" /></button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) =>
          <button key={number} type="button" aria-current={number === current ? "page" : undefined} onClick={() => setPage(number)}
            className={cx("inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-semibold", number === current ? "bg-primary-600 text-white" : "border border-line bg-surface text-ink")}>{number}</button>)}
        <button type="button" aria-label="Halaman berikutnya" disabled={current === pageCount} onClick={() => setPage(current + 1)} className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface disabled:opacity-40"><ChevronRight className="size-4" /></button>
      </nav>
    </footer>}
  </section>;
}

/** First column content: name + employee code. */
export function PersonCell({ name, code }: { name: string; code: string }) {
  return <span className="block min-w-0"><strong className="block truncate font-semibold text-ink">{name}</strong><span className="block text-xs text-ink-3">{code}</span></span>;
}

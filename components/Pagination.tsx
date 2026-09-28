"use client";

import React from "react";

export interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 24,
  onPageChange,
  className = "",
}) => {
  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange?.(page);
    }
  };

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`inline-flex items-center gap-2 font-sans select-none ${className}`}
    >
      {/* Previous Button */}
      <button
        type="button"
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          currentPage <= 1
            ? "border border-slate-100 text-slate-300 bg-white cursor-not-allowed"
            : "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-xs"
        }`}
        aria-label="Previous Page"
      >
        <svg
          className="w-4 h-4 stroke-[2.2]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {(() => {
          if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => handlePageClick(page)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${
                  currentPage === page
                    ? "bg-[#0F172A] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                }`}
              >
                {page}
              </button>
            ));
          }

          const pages: (number | string)[] = [];
          if (currentPage <= 4) {
            pages.push(1, 2, 3, 4, 5, "...", totalPages);
          } else if (currentPage >= totalPages - 3) {
            pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
          } else {
            pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
          }

          return pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-8 h-10 flex items-center justify-center text-slate-400 font-bold tracking-wider text-sm select-none"
                >
                  ...
                </span>
              );
            }
            const pageNum = Number(p);
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => handlePageClick(pageNum)}
                className={`w-10 h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${
                  currentPage === pageNum
                    ? "bg-[#0F172A] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 cursor-pointer"
                }`}
              >
                {pageNum}
              </button>
            );
          });
        })()}
      </div>

      {/* Next Button */}
      <button
        type="button"
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          currentPage >= totalPages
            ? "border border-slate-100 text-slate-300 bg-white cursor-not-allowed"
            : "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-xs"
        }`}
        aria-label="Next Page"
      >
        <svg
          className="w-4 h-4 stroke-[2.2]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
};

export default Pagination;

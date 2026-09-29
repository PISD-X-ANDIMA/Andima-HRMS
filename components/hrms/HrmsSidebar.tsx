"use client";

import Link from "next/link";
import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquareHeart,
  Users,
} from "lucide-react";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

interface HrmsSidebarProps {
  userEmail?: string;
}

function initialsFromEmail(email?: string) {
  if (!email) return "HR";

  return (
    email
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "HR"
  );
}

function InactiveMenuItem({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#D9E2FC]/60">
      <Icon className="size-4" strokeWidth={1.8} />
      {children}
    </span>
  );
}

import { usePathname } from "next/navigation";

export default function HrmsSidebar({ userEmail }: HrmsSidebarProps) {
  const pathname = usePathname();
  const [isPosOpen, setIsPosOpen] = useState(true);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-white/10 bg-[#0F2342] px-4 py-6 text-[#D9E2FC] lg:flex">
      <div className="border-b border-white/10 px-3 pb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#D9E2FC]/65">
          PT ANDIMA
        </p>
        <p className="mt-1 text-sm font-bold tracking-wide text-white">
          TRANSPORTINDO
        </p>
      </div>

      <nav className="mt-8 space-y-6 overflow-y-auto" aria-label="Main menu">
        <div>
          <p className="px-3 text-[11px] font-bold tracking-[0.16em] text-[#D9E2FC]/55">
            MAIN MENU
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white">
              <Users className="size-4" strokeWidth={2} />
              <span className="flex-1">Employee Management</span>
              <ChevronRight className="size-4 text-[#D9E2FC]/70" />
            </div>
            <Link
              href="/employees"
              className={`ml-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm transition ${
                pathname === "/employees"
                  ? "bg-[#1E3765] text-white"
                  : "text-[#D9E2FC]/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="size-1.5 rounded-full bg-[#D9E2FC]" />
              Employee Profile
            </Link>
            <div className="ml-4 space-y-1 pt-1">
              <InactiveMenuItem icon={CalendarDays}>
                Attendance History
              </InactiveMenuItem>
              <InactiveMenuItem icon={BarChart3}>
                Attendance &amp; Productivity
              </InactiveMenuItem>
              <InactiveMenuItem icon={MessageSquareHeart}>
                Feedback &amp; Reward
              </InactiveMenuItem>
              <Link
                href="/employee-report-ticket"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  pathname === "/employee-report-ticket"
                    ? "bg-[#1E3765] text-white font-bold"
                    : "text-[#D9E2FC]/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <FileText className="size-4" strokeWidth={1.8} />
                Report &amp; Ticket
              </Link>
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setIsPosOpen((val) => !val)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <Award className="size-4 text-[#D9E2FC]" strokeWidth={2} />
            <span className="flex-1 text-left">Manajemen Posisi &amp; Kompetensi</span>
            <ChevronDown
              className={`size-4 text-[#D9E2FC]/70 transition-transform ${
                isPosOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
          {isPosOpen && (
            <div className="ml-4 space-y-1 pt-1">
              <Link
                href="/manajemen-posisi-dan-kompetensi/posisi"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  pathname === "/manajemen-posisi-dan-kompetensi/posisi"
                    ? "bg-[#1E3765] font-bold text-white"
                    : "text-[#D9E2FC]/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="size-1.5 rounded-full bg-[#D9E2FC]/50" />
                Daftar Posisi Pekerjaan
              </Link>
              <Link
                href="/manajemen-posisi-dan-kompetensi/kpi"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  pathname === "/manajemen-posisi-dan-kompetensi/kpi"
                    ? "bg-[#1E3765] font-bold text-white"
                    : "text-[#D9E2FC]/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="size-1.5 rounded-full bg-[#D9E2FC]/50" />
                Definisi KPI
              </Link>
              <Link
                href="/manajemen-posisi-dan-kompetensi/gap-analysis"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  pathname === "/manajemen-posisi-dan-kompetensi/gap-analysis"
                    ? "bg-[#1E3765] font-bold text-white"
                    : "text-[#D9E2FC]/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="size-1.5 rounded-full bg-[#D9E2FC]/50" />
                Analisis Kesenjangan (Gap Analysis)
              </Link>
              <Link
                href="/manajemen-posisi-dan-kompetensi/laporan"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  pathname === "/manajemen-posisi-dan-kompetensi/laporan"
                    ? "bg-[#1E3765] font-bold text-white"
                    : "text-[#D9E2FC]/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="size-1.5 rounded-full bg-[#D9E2FC]/50" />
                Laporan &amp; Ekspor
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="mt-auto rounded-xl border border-white/10 bg-[#1E3765]/70 p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D9E2FC] text-xs font-bold text-[#0F2342]">
            {initialsFromEmail(userEmail)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {userEmail?.split("@")[0] || "Authenticated User"}
            </p>
            <p className="truncate text-xs text-[#D9E2FC]/70">
              {userEmail || "HRMS session"}
            </p>
          </div>
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

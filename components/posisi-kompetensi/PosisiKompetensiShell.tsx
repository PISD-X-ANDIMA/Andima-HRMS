"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Menu,
  Search,
  Award,
  Briefcase,
  FileSpreadsheet,
  LineChart,
} from "lucide-react";
import { createContext, useContext, useState } from "react";
import Sidebar from "@/components/Sidebar";

export type ViewRole = "manager" | "employee";

interface PosisiKompetensiContextType {
  viewRole: ViewRole;
  setViewRole: (role: ViewRole) => void;
}

const PosisiKompetensiContext = createContext<PosisiKompetensiContextType>({
  viewRole: "manager",
  setViewRole: () => {},
});

export const usePosisiKompetensiRole = () => useContext(PosisiKompetensiContext);

export default function PosisiKompetensiShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewRole, setViewRole] = useState<ViewRole>("manager");
  const [query, setQuery] = useState("");

  const tabs = [
    {
      id: "posisi",
      label: "Daftar Posisi Pekerjaan",
      href: "/manajemen-posisi-dan-kompetensi/posisi",
      icon: Briefcase,
    },
    {
      id: "kpi",
      label: "Definisi KPI",
      href: "/manajemen-posisi-dan-kompetensi/kpi",
      icon: Award,
    },
    {
      id: "gap-analysis",
      label: "Analisis Kesenjangan (Gap)",
      href: "/manajemen-posisi-dan-kompetensi/gap-analysis",
      icon: LineChart,
    },
    {
      id: "laporan",
      label: "Laporan & Ekspor",
      href: "/manajemen-posisi-dan-kompetensi/laporan",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <PosisiKompetensiContext.Provider value={{ viewRole, setViewRole }}>
      <main className="min-h-screen bg-[#f7f8ff] text-[#121b2e]">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <section className="min-h-screen lg:pl-[260px]">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#d9e2fc] bg-white px-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded p-1.5 text-[#1e3765] lg:hidden"
                aria-label="Buka navigasi"
              >
                <Menu size={20} />
              </button>
              <div className="hidden items-center gap-2 sm:flex text-xs font-semibold">
                <span className="font-bold text-[#0f2342]">ANDIMA HRMS</span>
                <span className="text-[#d9e2fc]">|</span>
                <span className="text-[#4d5f81]">Manajemen Posisi & Kompetensi</span>
                <ChevronRight size={13} className="text-[#4d5f81]/50" />
                <span className="truncate font-bold text-[#006838]">
                  {tabs.find((t) => t.href === pathname)?.label || "Modul"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Role Switcher */}
              <div className="flex items-center gap-2 rounded-lg border border-[#becabd]/60 bg-[#f1f3ff] px-2.5 py-1 text-xs font-semibold text-[#1e3765]">
                <span className="text-[11px] text-[#4d5f81] hidden sm:inline">Pratinjau Role:</span>
                <select
                  value={viewRole}
                  onChange={(e) => setViewRole(e.target.value as ViewRole)}
                  className="bg-transparent font-bold text-[#16834b] outline-none cursor-pointer"
                >
                  <option value="manager">HR / Manager</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              <button
                className="relative grid size-9 place-items-center rounded-lg text-[#4d5f81] hover:bg-[#f1f3ff]"
                aria-label="Notifikasi"
              >
                <Bell size={17} />
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64545]" />
              </button>
              <button
                className="grid size-9 place-items-center rounded-lg text-[#4d5f81] hover:bg-[#f1f3ff]"
                aria-label="Bantuan"
              >
                <CircleHelp size={17} />
              </button>

              <div className="hidden items-center gap-2 border-l border-[#d9e2fc] pl-3 sm:flex">
                <span className="grid size-8 place-items-center rounded-full border border-[#006838]/30 bg-[#16834b]/15 text-xs font-bold text-[#006838]">
                  NN
                </span>
                <div className="text-left">
                  <p className="text-xs font-bold">Nick Nelson</p>
                  <p className="text-[10px] text-[#4d5f81]">
                    {viewRole === "manager" ? "HR Manager" : "Employee"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Sub Navigation Bar */}
          <div className="border-b border-[#d9e2fc] bg-white px-4 sm:px-6">
            <div className="mx-auto flex max-w-[1600px] space-x-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-bold transition whitespace-nowrap ${
                      isActive
                        ? "border-[#069494] text-[#006838]"
                        : "border-transparent text-[#4d5f81] hover:border-[#d9e2fc] hover:text-[#121b2e]"
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Role preview alert banner if Employee */}
          {viewRole === "employee" && (
            <div className="bg-[#fef9c3] border-b border-[#fde68a] px-4 py-2.5 text-center text-xs font-semibold text-[#b7791f]">
              ℹ️ Anda berada dalam mode <b>Pratinjau Employee</b> (Akses terbatas/baca saja). Ubah opsi role di kanan atas ke <b>HR / Manager</b> untuk mengaktifkan fitur edit & manajemen.
            </div>
          )}

          {/* Page Content */}
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
            {children}
          </div>
        </section>
      </main>
    </PosisiKompetensiContext.Provider>
  );
}

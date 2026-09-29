"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";

type SidebarProps = {
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
};

type NavigationItemProps = {
  icon: ReactNode;
  label: string;
  href?: string;
  suffix?: ReactNode;
};

type Account = {
  name: string;
  role: string;
  initials: string;
};

const fallbackAccount: Account = {
  name: "Andima User",
  role: "HRMS User",
  initials: "AU",
};

function NavigationItem({ icon, label, href = "#", suffix }: NavigationItemProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[#d9e2fc] transition-colors hover:bg-[#1e3765] hover:text-white"
    >
      <span className="flex items-center gap-3">{icon}{label}</span>
      {suffix}
    </Link>
  );
}

function HrmsLink({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex w-full items-center rounded-md px-3 py-2 text-xs transition-colors ${
        isActive ? "bg-[#1e3765] text-white" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function PlannedD3Item({ label }: { label: string }) {
  return (
    <span
      className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-xs text-[#d9e2fc]/45"
      title="Halaman fitur belum tersedia"
      aria-disabled="true"
    >
      <span>{label}</span>
      <span className="text-[9px] font-medium uppercase tracking-wide">Segera</span>
    </span>
  );
}

function PlannedD1Item({ label }: { label: string }) {
  return (
    <span
      className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-xs text-[#d9e2fc]/45"
      title="Halaman fitur belum tersedia"
      aria-disabled="true"
    >
      <span>{label}</span>
      <span className="text-[9px] font-medium uppercase tracking-wide">Segera</span>
    </span>
  );
}

export default function Sidebar({ userName, userRole, userInitials, onSignOut, isSigningOut = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");
  const isD3Route = [
    "/employee-profile",
    "/attendance",
    "/attendance-productivity",
    "/feedback-reward",
    "/employee-report-ticket",
  ].includes(pathname);
  const isD1Route = [
    "/manajemen-posisi-dan-kompetensi/posisi",
    "/manajemen-posisi-dan-kompetensi/kpi",
    "/manajemen-posisi-dan-kompetensi/gap-analysis",
    "/manajemen-posisi-dan-kompetensi/laporan",
  ].includes(pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHrmsOpen, setIsHrmsOpen] = useState(true);
  const [isD3Open, setIsD3Open] = useState(false);
  const [isD1Open, setIsD1Open] = useState<boolean | null>(null);
  const [isInternalSigningOut, setIsInternalSigningOut] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<Account | null>(null);
  const hasSuppliedAccount = Boolean(userName && userRole && userInitials);
  const suppliedAccount = hasSuppliedAccount
    ? { name: userName, role: userRole, initials: userInitials }
    : null;
  const account = suppliedAccount ?? loadedAccount ?? fallbackAccount;
  const isD3Expanded = isD3Route || isD3Open;
  const isD1Expanded = isD1Open ?? isD1Route;

  useEffect(() => {
    if (isPublicRoute || hasSuppliedAccount) return;

    let isMounted = true;
    async function loadAccount() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user || !isMounted) return;

        const { data: access } = await supabase
          .from("d3_user_access")
          .select("app_role")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const metadataName = user.user_metadata?.full_name;
        const name = typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : user.email?.split("@")[0] ?? "Andima User";
        const role = access?.app_role === "HR" ? "HR" : access?.app_role === "MANAGER" ? "Manager" : access?.app_role === "EMPLOYEE" ? "Employee" : "HRMS User";
        const initials = name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AU";
        if (isMounted) setLoadedAccount({ name, role, initials });
      } catch {
        // The navigation remains available even if the account label cannot load.
      }
    }

    void loadAccount();
    return () => { isMounted = false; };
  }, [hasSuppliedAccount, isPublicRoute]);

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
      return;
    }
    setIsInternalSigningOut(true);
    try {
      await createClient().auth.signOut({ scope: "local" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsInternalSigningOut(false);
    }
  }

  if (isPublicRoute) return null;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f2342] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-lg bg-[#069494] shadow-sm"><BriefcaseBusiness size={19} className="text-white" /></div>
          <div><p className="text-xl font-bold tracking-[-0.5px] text-white">ANDIMA</p><p className="text-xs text-[#d9e2fc]/80">Logistics Suite</p></div>
          <button type="button" onClick={() => setIsSidebarOpen(false)} className="ml-auto rounded p-1 text-[#d9e2fc] lg:hidden" aria-label="Tutup navigasi"><X size={18} /></button>
        </div>

        <nav className="mt-8 space-y-1.5 text-sm font-semibold">
          {/* <NavigationItem icon={<LayoutDashboard size={16} />} label="Dashboard" href="/home" />
          <NavigationItem icon={<BriefcaseBusiness size={16} />} label="POS" />
          <NavigationItem icon={<UsersRound size={16} />} label="CRM" suffix={<ChevronRight size={15} />} /> */}
          <div>
            <button
              type="button"
              onClick={() => setIsHrmsOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg bg-[#069494] px-3 py-2.5 text-white shadow-sm"
            >
              <span className="flex items-center gap-3"><ClipboardList size={17} /> HRMS</span>
              <ChevronDown size={16} className={`transition-transform ${isHrmsOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            {isHrmsOpen && (
              <div className="ml-5 mt-2 border-l border-[#d9e2fc]/20 pl-3">
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setIsD1Open((value) => !(value ?? isD1Route))}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${
                      isD1Route ? "bg-[#1e3765] text-white" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
                    }`}
                    aria-expanded={isD1Expanded}
                  >
                    <span className="flex items-center gap-2"><Layers3 size={14} /> D1</span>
                    <ChevronDown size={14} className={`transition-transform ${isD1Expanded ? "rotate-0" : "-rotate-90"}`} />
                  </button>
                  {isD1Expanded && (
                    <div className="ml-4 mt-1 border-l border-[#d9e2fc]/15 pl-2">
                      {/* <HrmsLink label="Employee Profile Management" href="/employee-profile" />
                      <PlannedD1Item label="Fingerprint Attendance Integration" />
                      <HrmsLink label="Attendance History & Correction" href="/attendance" />
                      <HrmsLink label="Attendance & Productivity Dashboard" href="/attendance-productivity" />
                      <HrmsLink label="Feedback & Reward Management" href="/feedback-reward" />
                      <HrmsLink label="Employee Report & Ticket" href="/employee-report-ticket" /> */}
                      <HrmsLink label="Daftar Posisi Pekerjaan" href="/manajemen-posisi-dan-kompetensi/posisi"  />
                      <HrmsLink label="Definisi KPI" href="/manajemen-posisi-dan-kompetensi/kpi"  />
                      <HrmsLink label="Analisis Kesenjangan (Gap Analysis)" href="/manajemen-posisi-dan-kompetensi/gap-analysis" />
                      <HrmsLink label="Laporan & Ekspor" href="/manajemen-posisi-dan-kompetensi/laporan" />
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => setIsD3Open((value) => !value)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${
                      isD3Route ? "bg-[#1e3765] text-white" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
                    }`}
                    aria-expanded={isD3Expanded}
                  >
                    <span className="flex items-center gap-2"><Layers3 size={14} /> D3</span>
                    <ChevronDown size={14} className={`transition-transform ${isD3Expanded ? "rotate-0" : "-rotate-90"}`} />
                  </button>
                  {isD3Expanded && (
                    <div className="ml-4 mt-1 border-l border-[#d9e2fc]/15 pl-2">
                      <HrmsLink label="Employee Profile Management" href="/employee-profile" />
                      <PlannedD3Item label="Fingerprint Attendance Integration" />
                      <HrmsLink label="Attendance History & Correction" href="/attendance" />
                      <HrmsLink label="Attendance & Productivity Dashboard" href="/attendance-productivity" />
                      <HrmsLink label="Feedback & Reward Management" href="/feedback-reward" />
                      <HrmsLink label="Employee Report & Ticket" href="/employee-report-ticket" />
                    </div>
                  )}

                  
                </div>
              </div>
            )}
          </div>
          {/* <NavigationItem icon={<ShieldCheck size={16} />} label="MID" suffix={<ChevronRight size={15} />} /> */}
        </nav>

        <div className="mt-auto space-y-3">
          {/* <div className="rounded-lg border border-[#d9e2fc]/15 bg-[#1e3765] p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-white"><CircleHelp size={14} className="text-[#77d8cd]" /> Customer Support</div><p className="mt-1 text-[10px] text-[#d9e2fc]/80">24/7 Operations Line</p></div> */}
          <NavigationItem icon={<Settings size={15} />} label="Settings" />
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <span className="grid size-7 place-items-center rounded-full bg-[#16834b] text-[10px] font-bold text-white">{account.initials}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{account.name}</p><p className="text-[10px] text-[#d9e2fc]/75">{account.role}</p></div>
            <button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut || isInternalSigningOut} className="rounded p-1.5 text-[#d9e2fc] transition hover:bg-white/10 disabled:opacity-50" aria-label="Logout" title="Logout"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-lg bg-[#0f2342] p-2 text-white lg:hidden"
        aria-label="Buka navigasi"
      >
        <Menu size={20} />
      </button>
    </>
  );
}

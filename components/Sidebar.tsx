"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Logo from "@/components/image/Logo.png";
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
  SquareTerminal,
  Users

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
  const isActive =
    pathname === href ||
    (href === "/jobs" && (pathname === "/registration-form" || pathname === "/register" || pathname.startsWith("/jobs") || pathname.startsWith("/registration-form") || pathname.startsWith("/register") || pathname.startsWith("/squad-d2/src/app/jobs") || pathname.startsWith("/squad-d2/src/app/register"))) ||
    (href === "/kanban" && (pathname === "/fit-proper" || pathname.startsWith("/kanban") || pathname.startsWith("/fit-proper") || pathname.startsWith("/squad-d2/src/app/kanban") || pathname.startsWith("/squad-d2/src/app/fit-proper")));

  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
        isActive
          ? "bg-[#cbdcf7] text-[#0f2342] font-bold shadow-xs"
          : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-[#069494]" : "bg-transparent"}`} />
      <span>{label}</span>
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
  const isPublicRoute = pathname === "/login" || pathname.startsWith("/auth/");
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
  const isD2Route = [
    "/jobs",
    "/registration-form",
    "/register",
    "/kanban",
    "/fit-proper",
    "/squad-d2/src/app/jobs",
    "/squad-d2/src/app/register",
    "/squad-d2/src/app/kanban",
    "/squad-d2/src/app/fit-proper",
  ].includes(pathname) || pathname.startsWith("/jobs") || pathname.startsWith("/registration-form") || pathname.startsWith("/register") || pathname.startsWith("/kanban") || pathname.startsWith("/fit-proper");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHrmsOpen, setIsHrmsOpen] = useState(true);
  const [isD3Open, setIsD3Open] = useState(false);
  const [isD1Open, setIsD1Open] = useState<boolean | null>(null);
  const [isD2Open, setIsD2Open] = useState<boolean | null>(null);
  const [isInternalSigningOut, setIsInternalSigningOut] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<Account | null>(null);
  const hasSuppliedAccount = Boolean(userName && userRole && userInitials);
  const suppliedAccount = hasSuppliedAccount
    ? { name: userName, role: userRole, initials: userInitials }
    : null;
  const account = suppliedAccount ?? loadedAccount ?? fallbackAccount;
  const isD3Expanded = isD3Route || isD3Open;
  const isD1Expanded = isD1Open ?? isD1Route;
  const isD2Expanded = isD2Open ?? isD2Route;

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

  useEffect(() => {
    const handleOpen = () => setIsSidebarOpen(true);
    const handleClose = () => setIsSidebarOpen(false);
    window.addEventListener("open-sidebar", handleOpen);
    window.addEventListener("close-sidebar", handleClose);
    return () => {
      window.removeEventListener("open-sidebar", handleOpen);
      window.removeEventListener("close-sidebar", handleClose);
    };
  }, []);

  if (isPublicRoute) return null;

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f2342] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div>
            <Image src={Logo} alt="ANDIMA logo" width={40} height={40} className="h-9 w-9 " priority />
          </div>
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
              className="flex w-full items-center justify-between rounded-lg bg-[#0550D7] mb-2 px-3 py-2.5 text-white shadow-sm"
            >
              <span className="flex items-center gap-3"><Users  size={17} /> HRMS</span>
              <ChevronDown size={16} className={`transition-transform ${isHrmsOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            {isHrmsOpen && (
              <div className="ml-5 mt-2 border-l border-[#d9e2fc]/20 pl-3">
                <div className="mt-1">
                  {/* <button
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
                      <HrmsLink label="Employee Profile Management" href="/employee-profile" />
                      <PlannedD1Item label="Fingerprint Attendance Integration" />
                      <HrmsLink label="Attendance History & Correction" href="/attendance" />
                      <HrmsLink label="Attendance & Productivity Dashboard" href="/attendance-productivity" />
                      <HrmsLink label="Feedback & Reward Management" href="/feedback-reward" />
                      <HrmsLink label="Employee Report & Ticket" href="/employee-report-ticket" />
                      <HrmsLink label="Daftar Posisi Pekerjaan" href="/manajemen-posisi-dan-kompetensi/posisi"  />
                      <HrmsLink label="Definisi KPI" href="/manajemen-posisi-dan-kompetensi/kpi"  />
                      <HrmsLink label="Analisis Kesenjangan (Gap Analysis)" href="/manajemen-posisi-dan-kompetensi/gap-analysis" />
                      <HrmsLink label="Laporan & Ekspor" href="/manajemen-posisi-dan-kompetensi/laporan" />
                    </div>
                  )} */}
                  
                  <button
                    type="button"
                    onClick={() => setIsD2Open((value) => !(value ?? isD2Route))}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${
                      isD2Route ? "bg-[#1e3765] text-white" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
                    }`}
                    aria-expanded={isD2Expanded}
                  >
                    <span className="flex items-center gap-2"><Layers3 size={14} /> D2</span>
                    <ChevronDown size={14} className={`transition-transform ${isD2Expanded ? "rotate-0" : "-rotate-90"}`} />
                  </button>
                  {isD2Expanded && (
                    <div className="ml-4 mt-1 border-l border-[#d9e2fc]/15 pl-2 space-y-1">
                      <HrmsLink label="Job List & Register" href="/jobs" />
                      <HrmsLink label="Kanban and Fit & Proper" href="/kanban" />
                    </div>
                  )}
                  
                  {/* <button
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
                  )} */}

                  
                </div>
                
              </div>

              
              
            )}
            {/* <button
              type="button"
              // onClick={() => setIsHrmsOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg mb-2 px-3 py-2.5 text-white shadow-sm"
            >
              <span className="flex items-center gap-3"><SquareTerminal size={17} /> MID</span>
              <ChevronDown size={16} className={`transition-transform -rotate-90`} />
            </button> */}
          </div>
          {/* <NavigationItem icon={<ShieldCheck size={16} />} label="MID" suffix={<ChevronRight size={15} />} /> */}
        </nav>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut || isInternalSigningOut}
            className="w-full flex items-center justify-center gap-3 rounded-full border-2 border-[#D9364F] py-2 px-4 text-xs font-bold text-white hover:bg-[#D9364F]/10 transition-colors"
            aria-label="Logout"
            title="Logout"
          >
            <span>Logout</span>
          </button>
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
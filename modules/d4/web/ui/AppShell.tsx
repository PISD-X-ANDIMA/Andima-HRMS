"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, Box, ChevronUp, Contact, LayoutGrid, LogOut, Menu, Phone, RefreshCw, RotateCcw, Settings, ShoppingBag, Terminal, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { resetState } from "../../demo/storage";
import { createD4BrowserClient } from "../../supabase/client";
import { useD4 } from "../data/D4DataProvider";
import { cx } from "./primitives";

export const D4_MENU = [
  { href: "/performance", label: "Performance Evaluation" },
  { href: "/kpi", label: "KPI Scorecard" },
  { href: "/competency", label: "Competency Gap" },
  { href: "/development", label: "Development Requirement" },
] as const;

const roleLabel: Record<string, string> = { HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" };

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode } = useD4();
  // Other modules are shown for orientation only; D4 owns the HRMS sub-menu. They are dimmed and
  // marked disabled so they do not read as broken links.
  const other = "flex cursor-not-allowed items-center gap-3 rounded-md px-2 py-2 text-xs font-medium text-nav-text opacity-50";
  const pending = { "aria-disabled": true, title: "Modul squad lain — belum terhubung" } as const;
  const section = "px-2 pb-1 pt-4 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-nav-label";

  async function signOut() {
    await createD4BrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <div className="flex h-full flex-col bg-nav px-4 pb-5 pt-9">
    <div className="flex items-center gap-4 px-2 pb-5">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-white"><Box className="size-5" /></span>
      <span className="uppercase leading-none">
        <strong className="block font-display text-xl tracking-[0.03em] text-white">Andima</strong>
        <span className="mt-0.5 block text-base font-semibold tracking-[0.02em] text-white">Transportindo</span>
        <span className="mt-1 block text-[7.5px] font-medium tracking-[0.1em] text-nav-label">Enterprise Digital Ecosystem</span>
      </span>
    </div>
    <hr className="mx-2 border-nav-2" />
    <nav aria-label="Navigasi utama" className="flex flex-1 flex-col overflow-y-auto">
      <p className={section}>Main</p>
      <span className={other} {...pending}><LayoutGrid aria-hidden="true" className="size-4" />General Dashboard</span>
      <p className={section}>Business Modul</p>
      <span className={other} {...pending}><ShoppingBag aria-hidden="true" className="size-4" />POS</span>
      <span className={other} {...pending}><Contact aria-hidden="true" className="size-4" />CRM</span>
      <span className="flex items-center gap-3 px-2 py-2 text-xs font-semibold text-white"><Users aria-hidden="true" className="size-4" /><span className="flex-1">HRMS</span><ChevronUp aria-hidden="true" className="size-4" /></span>
      <div className="pb-2 pl-7">
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-nav-text">Performance &amp; Training</p>
        {D4_MENU.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cx("flex items-center rounded-md px-2 py-2 text-[11px]", active ? "bg-nav-active font-semibold text-white" : "text-white/85 hover:bg-nav-2 hover:text-white")}>
            <span className="flex-1">{item.label}</span>
            {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />}
          </Link>;
        })}
      </div>
      <span className={other} {...pending}><Terminal aria-hidden="true" className="size-4" />MID</span>
      <p className={section}>System</p>
      <span className={other} {...pending}><Settings aria-hidden="true" className="size-4" />Settings</span>
      {mode === "demo" && <>
        <p className={section}>Demo</p>
        <Link href="/panduan" onClick={onNavigate} aria-current={pathname === "/panduan" ? "page" : undefined}
          className={cx("flex items-center gap-3 rounded-md px-2 py-2 text-xs font-medium", pathname === "/panduan" ? "bg-nav-active font-semibold text-white" : "text-white/85 hover:bg-nav-2 hover:text-white")}>
          <BookOpen aria-hidden="true" className="size-4" />Panduan &amp; Alur
        </Link>
        <Link href="/login" className="flex items-center gap-3 rounded-md px-2 py-2 text-xs font-medium text-white/85 hover:bg-nav-2 hover:text-white"><RefreshCw aria-hidden="true" className="size-4" />Ganti peran</Link>
        <button type="button" onClick={() => { if (window.confirm("Kembalikan semua data demo ke kondisi awal? Perubahan yang Anda simpan di browser ini akan hilang.")) { resetState(); window.location.reload(); } }}
          className="flex items-center gap-3 rounded-md px-2 py-2 text-left text-xs font-medium text-white/85 hover:bg-nav-2 hover:text-white"><RotateCcw aria-hidden="true" className="size-4" />Reset data demo</button>
      </>}
      {mode === "live" && <button type="button" onClick={() => void signOut()} className="flex items-center gap-3 rounded-md px-2 py-2 text-left text-xs font-medium text-danger hover:bg-danger/10"><LogOut aria-hidden="true" className="size-4" />Logout</button>}
    </nav>
    {mode !== "live" && <p className="mb-2 rounded-lg border border-nav-2 px-3 py-1.5 text-center text-[11px] text-nav-text">{mode === "demo" ? "Demo · data fiktif" : "Preview mode · data fiktif"}</p>}
    <div className="flex items-center gap-3 rounded-lg border border-primary-500/20 bg-nav-2/60 p-3">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-500"><Phone className="size-4" /></span>
      <span><strong className="block text-[11px] font-semibold text-white">Customer Support</strong><span className="block text-[9px] text-nav-label">24/7 Operations Line</span></span>
    </div>
  </div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { snapshot, mode } = useD4();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = pathname === "/panduan" ? { label: "Panduan & Alur" } : D4_MENU.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const actor = snapshot?.reference.employees.find((item) => item.id === snapshot.actorEmployeeId);
  const name = actor?.fullName ?? "—";

  return <div className="min-h-screen bg-app">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">Lewati ke konten</a>
    {menuOpen && <button type="button" aria-label="Tutup menu" className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMenuOpen(false)} />}
    <aside className={cx("fixed inset-y-0 left-0 z-40 w-[264px] transition-transform lg:translate-x-0", menuOpen ? "translate-x-0" : "-translate-x-full")}>
      <Sidebar onNavigate={() => setMenuOpen(false)} />
    </aside>
    <div className="lg:pl-[264px]">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-surface px-4 sm:px-8">
        <button type="button" aria-label={menuOpen ? "Tutup menu" : "Buka menu"} className="rounded-lg p-2 text-ink-2 hover:bg-muted lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        <strong className="text-sm font-semibold text-ink">ANDIMA HRMS</strong>
        <span aria-hidden="true" className="hidden h-5 w-px bg-line-strong sm:block" />
        <p className="hidden flex-1 truncate text-xs text-ink-2 sm:block">HRMS / {current?.label ?? "Performance & Training"}</p>
        <span className="flex-1 sm:hidden" />
        {mode !== "live" && <span className="hidden rounded-full bg-warning-bg px-2.5 py-1 text-[11px] font-semibold text-warning md:inline">{mode === "demo" ? "Demo" : "Preview"} · data fiktif</span>}
        <span className="rounded-lg p-2 text-ink-2" title="Notifikasi"><Bell aria-hidden="true" className="size-5" /><span className="sr-only">Notifikasi</span></span>
        <span aria-hidden="true" className="h-8 w-px bg-line" />
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-avatar-me-bg text-xs font-semibold text-avatar-me">{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
          <span className="hidden sm:block"><strong className="block text-sm font-semibold leading-5 text-ink">{name}</strong><span className="block text-xs text-ink-2">{roleLabel[snapshot?.role ?? ""] ?? "—"}</span></span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8 sm:px-8">{children}</main>
    </div>
  </div>;
}

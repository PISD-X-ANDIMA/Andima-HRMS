import Link from "next/link";
import { BarChart3, CalendarDays, ChevronRight, FileText, MessageSquareHeart, Users } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

interface HrmsSidebarProps {
  userEmail?: string;
}

function initialsFromEmail(email?: string) {
  if (!email) return "HR";

  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "HR";
}

function InactiveMenuItem({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#D9E2FC]/60">
      <Icon className="size-4" strokeWidth={1.8} />
      {children}
    </span>
  );
}

export default function HrmsSidebar({ userEmail }: HrmsSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-white/10 bg-[#0F2342] px-4 py-6 text-[#D9E2FC] lg:flex">
      <div className="border-b border-white/10 px-3 pb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#D9E2FC]/65">PT ANDIMA</p>
        <p className="mt-1 text-sm font-bold tracking-wide text-white">TRANSPORTINDO</p>
      </div>

      <nav className="mt-8" aria-label="Main menu">
        <p className="px-3 text-[11px] font-bold tracking-[0.16em] text-[#D9E2FC]/55">MAIN MENU</p>
        <div className="mt-4 space-y-1">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white">
            <Users className="size-4" strokeWidth={2} />
            <span className="flex-1">Employee Management</span>
            <ChevronRight className="size-4 text-[#D9E2FC]/70" />
          </div>
          <Link
            href="/employees"
            className="ml-4 flex items-center gap-3 rounded-lg bg-[#1E3765] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#29497f]"
          >
            <span className="size-1.5 rounded-full bg-[#D9E2FC]" />
            Employee Profile
          </Link>
          <div className="ml-4 space-y-1 pt-1">
            <InactiveMenuItem icon={CalendarDays}>Attendance History</InactiveMenuItem>
            <InactiveMenuItem icon={BarChart3}>Attendance &amp; Productivity</InactiveMenuItem>
            <InactiveMenuItem icon={MessageSquareHeart}>Feedback &amp; Reward</InactiveMenuItem>
            <InactiveMenuItem icon={FileText}>Report &amp; Ticket</InactiveMenuItem>
          </div>
        </div>
      </nav>

      <div className="mt-auto rounded-xl border border-white/10 bg-[#1E3765]/70 p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D9E2FC] text-xs font-bold text-[#0F2342]">
            {initialsFromEmail(userEmail)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{userEmail?.split("@")[0] || "Authenticated User"}</p>
            <p className="truncate text-xs text-[#D9E2FC]/70">{userEmail || "HRMS session"}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

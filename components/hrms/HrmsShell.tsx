import type { D3AppRole } from "@/utils/employee-access";
import HeaderAccount from "@/components/HeaderAccount";

interface HrmsShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userRole?: D3AppRole | null;
  contentClassName?: string;
}

export default function HrmsShell({ children, userEmail, userRole, contentClassName }: HrmsShellProps) {
  // AppShell already owns the shared sidebar and header region for every D3 route.
  // Keep this wrapper so the imported D3-001 pages retain their original content.
  void userEmail;
  void userRole;

  return (
    <div className="min-h-screen bg-[#F7F9FC] font-sans text-[#121B2E]">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-[#D9E2FC] bg-white/95 px-5 shadow-[0_1px_8px_rgba(15,35,66,0.04)] backdrop-blur lg:px-8">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4">
          <p className="text-sm font-bold tracking-[0.16em] text-[#1E3765]">ANDIMA HRMS</p>
          <HeaderAccount />
        </div>
      </header>
      <main className={contentClassName ?? "px-5 py-7 lg:px-8 lg:py-8"}>{children}</main>
    </div>
  );
}

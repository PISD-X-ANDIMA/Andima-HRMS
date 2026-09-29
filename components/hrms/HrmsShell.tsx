import HrmsHeader from "@/components/hrms/HrmsHeader";
import HrmsSidebar from "@/components/hrms/HrmsSidebar";
import type { D3AppRole } from "@/utils/employee-access";

interface HrmsShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userRole?: D3AppRole | null;
}

export default function HrmsShell({ children, userEmail, userRole }: HrmsShellProps) {
  return (
    <div className="min-h-screen bg-[#F7F9FC] font-sans text-[#121B2E] lg:pl-[260px]">
      <HrmsSidebar userEmail={userEmail} userRole={userRole} />
      <div className="min-h-screen">
        <HrmsHeader />
        <main className="px-5 py-7 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

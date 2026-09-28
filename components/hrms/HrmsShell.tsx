import HrmsHeader from "@/components/hrms/HrmsHeader";
import HrmsSidebar from "@/components/hrms/HrmsSidebar";

interface HrmsShellProps {
  children: React.ReactNode;
  userEmail?: string;
}

export default function HrmsShell({ children, userEmail }: HrmsShellProps) {
  return (
    <div className="min-h-screen bg-[#F7F9FC] font-sans text-[#121B2E] lg:pl-[260px]">
      <HrmsSidebar userEmail={userEmail} />
      <div className="min-h-screen">
        <HrmsHeader />
        <main className="px-5 py-7 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

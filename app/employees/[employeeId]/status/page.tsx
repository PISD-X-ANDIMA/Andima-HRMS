import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EmployeeStatusForm from "@/components/EmployeeStatusForm";
import EmployeeManagementAccessDenied from "@/components/hrms/EmployeeManagementAccessDenied";
import HrmsShell from "@/components/hrms/HrmsShell";
import { canManageEmployeeProfiles, getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

interface EmployeeStatusPageProps {
  params: Promise<{ employeeId: string }>;
}

interface EmployeeStatusProfile {
  id: string;
  employee_id: string;
  full_name: string;
  employment_status: string | null;
}

export default async function EmployeeStatusPage({ params }: EmployeeStatusPageProps) {
  const { employeeId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = await getD3AppRole(supabase, user.id);

  if (!canManageEmployeeProfiles(userRole)) {
    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <EmployeeManagementAccessDenied title="Change Employment Status" />
      </HrmsShell>
    );
  }

  const { data: employee, error } = await supabase
    .from("d3_view_employee_360")
    .select("id, employee_id, full_name, employment_status")
    .eq("employee_id", employeeId)
    .maybeSingle()
    .returns<EmployeeStatusProfile>();

  if (error) {
    console.error("Employee status profile query failed", {
      code: error.code,
      message: error.message,
    });

    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Change Employment Status</h1>
          <p className="mt-2">Data pegawai belum dapat dimuat. Silakan coba lagi nanti.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  if (!employee) {
    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-3xl rounded-xl border border-[#D9E2FC] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#121B2E]">Change Employment Status</h1>
          <p className="mt-2 text-slate-600">Data pegawai tidak ditemukan.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  return (
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-4xl space-y-7">
        <Link className="inline-flex text-sm font-semibold text-[#1E3765] hover:text-[#155DFC]" href={`/employees/${encodeURIComponent(employee.employee_id)}`}>← Employee Profile</Link>

        <header>
          <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#121B2E] sm:text-[42px]">Change Employment Status</h1>
          <p className="mt-3 text-base text-slate-600">Update an employee status without changing profile data or history.</p>
        </header>

        <EmployeeStatusForm employee={employee} />
      </section>
    </HrmsShell>
  );
}

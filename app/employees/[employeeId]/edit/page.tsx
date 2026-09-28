import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EmployeeEditForm from "@/components/EmployeeEditForm";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { DepartmentOption, EmployeeProfile, PositionOption } from "@/types/employee";
import { createClient } from "@/utils/supabase/server";

interface EditEmployeePageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { employeeId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("d3_view_employee_360")
    .select(
      "id, employee_id, full_name, email, phone, identity_type, identity_number, join_date, employment_status, work_location, position_id, position_title, department_id, department_name, tenure_years, tenure_months"
    )
    .eq("employee_id", employeeId)
    .maybeSingle()
    .returns<EmployeeProfile>();

  if (employeeError) {
    console.error("Employee edit profile query failed", {
      code: employeeError.code,
      message: employeeError.message,
    });

    return (
      <HrmsShell userEmail={user.email}>
        <section className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Edit Employee Profile</h1>
          <p className="mt-2">Profil pegawai belum dapat dimuat. Silakan coba lagi nanti.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  if (!employee) {
    return (
      <HrmsShell userEmail={user.email}>
        <section className="mx-auto max-w-5xl rounded-xl border border-[#D9E2FC] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#121B2E]">Edit Employee Profile</h1>
          <p className="mt-2 text-slate-600">Data pegawai tidak ditemukan.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  const [departmentsResult, positionsResult] = await Promise.all([
    supabase
      .from("departments")
      .select("id, code, name")
      .order("name", { ascending: true })
      .returns<DepartmentOption[]>(),
    supabase
      .from("positions")
      .select("id, code, title, department_id")
      .order("title", { ascending: true })
      .returns<PositionOption[]>(),
  ]);

  if (departmentsResult.error || positionsResult.error) {
    console.error("Employee edit lookup query failed", {
      departments: departmentsResult.error?.code,
      positions: positionsResult.error?.code,
    });

    return (
      <HrmsShell userEmail={user.email}>
        <section className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Edit Employee Profile</h1>
          <p className="mt-2">Pilihan position atau department belum dapat dimuat. Silakan coba lagi nanti.</p>
          <Link
            className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]"
            href={`/employees/${encodeURIComponent(employee.employee_id)}`}
          >
            ← Kembali ke Profil Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  return (
    <HrmsShell userEmail={user.email}>
      <section className="mx-auto max-w-5xl space-y-6">
        <Link className="inline-flex text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href={`/employees/${encodeURIComponent(employee.employee_id)}`}>← Employee Profile</Link>

        <header>
          <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#121B2E]">Edit Employee Profile</h1>
          <p className="mt-2 text-sm text-slate-600">Update profile information for {employee.full_name}.</p>
        </header>

        <EmployeeEditForm
          employee={employee}
          departments={departmentsResult.data ?? []}
          positions={positionsResult.data ?? []}
        />
      </section>
    </HrmsShell>
  );
}

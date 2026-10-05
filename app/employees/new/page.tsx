import Link from "next/link";
import { redirect } from "next/navigation";
import EmployeeCreateForm from "@/components/EmployeeCreateForm";
import EmployeeManagementAccessDenied from "@/components/hrms/EmployeeManagementAccessDenied";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { DepartmentOption, PositionOption } from "@/types/employee";
import { canManageEmployeeProfiles, getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

export default async function NewEmployeePage() {
  const supabase = await createClient();
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
        <EmployeeManagementAccessDenied title="Add a New Employee" />
      </HrmsShell>
    );
  }

  const [departmentsResult, positionsResult] = await Promise.all([
    supabase
      .from("d3_departments")
      .select("id, code, name")
      .order("name", { ascending: true })
      .returns<DepartmentOption[]>(),
    supabase
      .from("d3_positions")
      .select("id, code, title, department_id")
      .order("title", { ascending: true })
      .returns<PositionOption[]>(),
  ]);

  if (departmentsResult.error || positionsResult.error) {
    console.error("Employee create lookup query failed", {
      departments: departmentsResult.error?.code,
      positions: positionsResult.error?.code,
    });

    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Add a New Employee</h1>
          <p className="mt-2">Pilihan position atau department belum dapat dimuat. Silakan coba lagi nanti.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  return (
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-6xl space-y-7">
        <Link className="inline-flex text-sm font-semibold text-[#1E3765] hover:text-[#155DFC]" href="/employees">← Employee Directory</Link>

        <header>
          <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#121B2E] sm:text-[42px]">Add a New Employee</h1>
          <p className="mt-3 text-base text-slate-600">Fill in all required fields to create a new employee profile.</p>
        </header>

        <EmployeeCreateForm
          departments={departmentsResult.data ?? []}
          positions={positionsResult.data ?? []}
        />
      </section>
    </HrmsShell>
  );
}

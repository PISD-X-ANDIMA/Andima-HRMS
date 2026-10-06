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
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#121B2E]/55 p-3 sm:p-6">
        <section className="my-auto w-full max-w-[1185px] rounded-[15px] bg-white p-5 shadow-[4px_4px_10px_rgba(21,93,252,0.5)] sm:p-9">
          <EmployeeCreateForm departments={departmentsResult.data ?? []} positions={positionsResult.data ?? []} />
        </section>
      </div>
    </HrmsShell>
  );
}

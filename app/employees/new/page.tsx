import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EmployeeCreateForm from "@/components/EmployeeCreateForm";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { DepartmentOption, PositionOption } from "@/types/employee";
import { createClient } from "@/utils/supabase/server";

export default async function NewEmployeePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
    console.error("Employee create lookup query failed", {
      departments: departmentsResult.error?.code,
      positions: positionsResult.error?.code,
    });

    return (
      <HrmsShell userEmail={user.email}>
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
    <HrmsShell userEmail={user.email}>
      <section className="mx-auto max-w-5xl space-y-6">
        <Link className="inline-flex text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">← Employee Directory</Link>

        <header>
          <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#121B2E]">Add a New Employee</h1>
          <p className="mt-2 text-sm text-slate-600">Fill in all required fields to create a new employee profile.</p>
        </header>

        <EmployeeCreateForm
          departments={departmentsResult.data ?? []}
          positions={positionsResult.data ?? []}
        />
      </section>
    </HrmsShell>
  );
}

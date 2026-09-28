import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import EmployeeTable from "@/components/EmployeeTable";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { EmployeeListItem } from "@/types/employee";
import { createClient } from "@/utils/supabase/server";

export default async function EmployeesPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("d3_view_employee_360")
    .select(
      "id, employee_id, full_name, position_title, department_name, employment_status, work_location, join_date"
    )
    .order("employee_id", { ascending: true })
    .returns<EmployeeListItem[]>();

  if (error) {
    console.error("Employee list query failed", {
      code: error.code,
      message: error.message,
    });

    return (
      <HrmsShell userEmail={user.email}>
        <section className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold">Employee Directory</h1>
            <Link className="inline-flex h-10 items-center rounded-lg bg-[#1E3765] px-4 text-sm font-bold text-white transition hover:bg-[#0F2342]" href="/employees/new">
              Tambah Pegawai
            </Link>
          </div>
          <p className="mt-2">Data pegawai belum dapat dimuat. Silakan coba lagi nanti.</p>
        </section>
      </HrmsShell>
    );
  }

  const employees = data ?? [];

  return (
    <HrmsShell userEmail={user.email}>
      <section className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#121B2E]">Employee Directory</h1>
            <p className="mt-2 text-sm text-slate-600">Manage 360° profiles for all employees of PT Andima Transportindo.</p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1E3765] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0F2342]"
            href="/employees/new"
          >
            Tambah Pegawai
          </Link>
        </header>

        {employees.length === 0 ? (
          <div className="rounded-xl border border-[#D9E2FC] bg-white p-6 text-slate-600 shadow-sm">
            Belum ada data pegawai.
          </div>
        ) : (
          <EmployeeTable employees={employees} />
        )}
      </section>
    </HrmsShell>
  );
}

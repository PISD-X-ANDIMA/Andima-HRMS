import Link from "next/link";
import { redirect } from "next/navigation";
import EmployeeTable from "@/components/EmployeeTable";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { EmployeeListItem } from "@/types/employee";
import { canManageEmployeeProfiles, getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = await getD3AppRole(supabase, user.id);
  const canManageEmployees = canManageEmployeeProfiles(userRole);

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
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold">Employee Directory</h1>
            {canManageEmployees && (
              <Link className="inline-flex h-11 items-center rounded-[15px] bg-[#155DFC] px-5 text-sm font-bold text-white shadow-[3px_3px_14px_rgba(87,138,252,0.4)] transition hover:bg-[#0D4FDB]" href="/employees/new">
                Tambah Pegawai
              </Link>
            )}
          </div>
          <p className="mt-2">Data pegawai belum dapat dimuat. Silakan coba lagi nanti.</p>
        </section>
      </HrmsShell>
    );
  }

  const employees = data ?? [];

  return (
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-[1240px]">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#121B2E] sm:text-[42px]">Employee Directory</h1>
            <p className="mt-3 text-base text-slate-600">Manage 360° profiles for all employees of PT Andima Transportindo.</p>
          </div>
          {canManageEmployees && (
            <Link
              className="inline-flex h-11 items-center justify-center rounded-[15px] bg-[#155DFC] px-5 text-sm font-bold text-white shadow-[3px_3px_14px_rgba(87,138,252,0.4)] transition hover:bg-[#0D4FDB]"
              href="/employees/new"
            >
              Tambah Pegawai
            </Link>
          )}
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

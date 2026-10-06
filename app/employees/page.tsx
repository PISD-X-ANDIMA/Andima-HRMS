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
  const profileName = typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name
    : user.email?.split("@")[0] ?? "HR Manager";
  const profileRole = userRole === "HR" ? "HR / Manager" : userRole ?? "Employee";
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((name) => name[0]?.toUpperCase()).join("") || "HR";

  return (
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-[1052px]">
        <header className="mb-3 flex items-center justify-between gap-4">
          <h1 className="text-[30px] font-bold tracking-[-0.04em] text-[#121B2E] sm:text-[32px]">Employee Directory</h1>
          {canManageEmployees && (
            <Link
              className="inline-flex h-8 items-center justify-center rounded-md bg-[#155DFC] px-3 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition hover:bg-[#0D4FDB]"
              href="/employees/new"
            >
              + Add Employees
            </Link>
          )}
        </header>

        <div className="flex min-h-[109px] items-center gap-4 rounded-[10px] border border-[#578AFC]/30 bg-white px-5 py-4 shadow-[3px_3px_20px_rgba(87,138,252,0.5)]">
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-[#6DA9CA] text-lg font-bold text-white">{profileInitials}</span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[25px] font-medium leading-7 text-[#27324A]">{profileName}</p><span className="rounded-full border border-[#16A37A]/75 px-1.5 py-px text-[8px] font-medium text-[#16A37A]">active</span></div><p className="mt-1 text-[11px] font-semibold text-[#1E3765]">{profileRole}</p></div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-[#26334F]">Manage 360° profiles for all employees of PT Andima Transportindo.</p>

        {employees.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[#D9E2FC] bg-white p-6 text-slate-600 shadow-sm">
            Belum ada data pegawai.
          </div>
        ) : (
          <EmployeeTable employees={employees} />
        )}
      </section>
    </HrmsShell>
  );
}

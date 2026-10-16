import { redirect } from "next/navigation";
import EmployeeSyncHistory from "@/components/EmployeeSyncHistory";
import EmployeeTable from "@/components/EmployeeTable";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { EmployeeListItem } from "@/types/employee";
import { getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

interface EmployeeSyncEvent {
  id: string;
  event_kind: string;
  message: string;
  created_at: string;
}

export default async function EmployeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = await getD3AppRole(supabase, user.id);
  const [employeesResult, hiddenEmployeesResult, sourcesResult, eventsResult] = await Promise.all([
    supabase
      .from("d3_view_employee_360")
      .select(
        "id, employee_id, full_name, position_title, department_name, employment_status, work_location, join_date"
      )
      .order("employee_id", { ascending: true })
      .returns<EmployeeListItem[]>(),
    supabase
      .from("d3_employee_directory_hidden")
      .select("employee_id")
      .returns<Array<{ employee_id: string }>>(),
    supabase
      .from("d3_b2_employee_sources")
      .select("employee_id")
      .returns<Array<{ employee_id: string }>>(),
    userRole === "HR"
      ? supabase
        .from("d3_employee_sync_events")
        .select("id, event_kind, message, created_at")
        .order("created_at", { ascending: false })
        .limit(12)
        .returns<EmployeeSyncEvent[]>()
      : Promise.resolve({ data: [] as EmployeeSyncEvent[], error: null }),
  ]);
  const { data, error } = employeesResult;
  const hiddenEmployeesError = hiddenEmployeesResult.error;
  const sourcesError = sourcesResult.error;
  const eventsError = eventsResult.error;

  if (error || hiddenEmployeesError || sourcesError || eventsError) {
    console.error("Employee list query failed", {
      code: error?.code ?? hiddenEmployeesError?.code ?? sourcesError?.code ?? eventsError?.code,
      message: error?.message ?? hiddenEmployeesError?.message ?? sourcesError?.message ?? eventsError?.message,
    });

    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Employee Directory</h1>
          <p className="mt-2">Data pegawai belum dapat dimuat. Silakan coba lagi nanti.</p>
        </section>
      </HrmsShell>
    );
  }

  const hiddenEmployeeIds = new Set((hiddenEmployeesResult.data ?? []).map((employee) => employee.employee_id));
  const b2EmployeeIds = new Set((sourcesResult.data ?? []).map((source) => source.employee_id));
  const employees = (data ?? []).filter((employee) => b2EmployeeIds.has(employee.id) && !hiddenEmployeeIds.has(employee.id));
  const profileName = typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name
    : user.email?.split("@")[0] ?? "HR Manager";
  const profileRole = userRole === "HR" ? "HR / Manager" : userRole ?? "Employee";
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((name) => name[0]?.toUpperCase()).join("") || "HR";

  return (
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-[1052px]">
        <header className="mb-3 flex items-start justify-between gap-4">
          <h1 className="text-[30px] font-bold tracking-[-0.04em] text-[#121B2E] sm:text-[32px]">Employee Directory</h1>
        </header>

        <div className="flex min-h-[109px] items-center gap-4 rounded-[10px] border border-[#578AFC]/30 bg-white px-5 py-4 shadow-[3px_3px_20px_rgba(87,138,252,0.5)]">
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-[#6DA9CA] text-lg font-bold text-white">{profileInitials}</span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[25px] font-medium leading-7 text-[#27324A]">{profileName}</p><span className="rounded-full border border-[#16A37A]/75 px-1.5 py-px text-[8px] font-medium text-[#16A37A]">active</span></div><p className="mt-1 text-[11px] font-semibold text-[#1E3765]">{profileRole}</p></div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-[#26334F]">Employee Profile hanya menampilkan data yang telah tersinkronisasi dari registrasi B2.</p>

        {userRole === "HR" && <details className="mt-5 rounded-xl border border-[#D9E2FC] bg-white shadow-sm"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#1E3765] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#155DFC]">Riwayat Sinkronisasi <span className="ml-1 text-xs font-normal text-slate-500">(buka untuk melihat)</span></summary><div className="border-t border-[#D9E2FC] p-5"><EmployeeSyncHistory events={eventsResult.data ?? []} /></div></details>}

        {employees.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#D9E2FC] bg-white p-8 text-center text-slate-600 shadow-sm">
            <p className="text-base font-bold text-[#121B2E]">Belum ada data pegawai</p><p className="mt-1 text-sm">Pegawai dari registrasi B2 akan muncul di sini setelah tersedia.</p>
          </div>
        ) : (
          <EmployeeTable employees={employees} summary={{ total: employees.length, active: employees.filter((employee) => ["PERMANENT", "CONTRACT", "INTERN"].includes(employee.employment_status ?? "")).length, probation: employees.filter((employee) => employee.employment_status === "PROBATION").length, inactive: employees.filter((employee) => ["RESIGNED", "TERMINATED"].includes(employee.employment_status ?? "")).length }} />
        )}
      </section>
    </HrmsShell>
  );
}

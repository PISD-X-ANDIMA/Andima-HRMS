import Link from "next/link";
import { redirect } from "next/navigation";
import EmployeeEditForm from "@/components/EmployeeEditForm";
import EmployeeManagementAccessDenied from "@/components/hrms/EmployeeManagementAccessDenied";
import HrmsShell from "@/components/hrms/HrmsShell";
import type { DepartmentOption, EmployeeProfile, PositionOption } from "@/types/employee";
import { canManageEmployeeProfiles, getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

interface EditEmployeePageProps {
  params: Promise<{ employeeId: string }>;
}

interface D1PositionOption {
  position_id: string;
  position_code: string;
  position_title: string;
  department_id: string;
  department_code: string;
  department_name: string;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { employeeId } = await params;
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
        <EmployeeManagementAccessDenied title="Edit Profil Pegawai" />
      </HrmsShell>
    );
  }

  const { data: employee, error: employeeError } = await supabase
    .from("d3_view_employee_360")
    .select(
      "id, employee_id, full_name, email, phone, join_date, employment_status, work_location, position_id, position_title, department_id, department_name, tenure_years, tenure_months"
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
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Edit Profil Pegawai</h1>
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
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-5xl rounded-xl border border-[#D9E2FC] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#121B2E]">Edit Profil Pegawai</h1>
          <p className="mt-2 text-slate-600">Data pegawai tidak ditemukan.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  const { data: b2Source, error: b2SourceError } = await supabase
    .from("d3_b2_employee_sources")
    .select("employee_id")
    .eq("employee_id", employee.id)
    .maybeSingle();

  if (b2SourceError) {
    console.error("Employee edit B2 source query failed", {
      code: b2SourceError.code,
      message: b2SourceError.message,
    });
  }

  if (b2SourceError || !b2Source) {
    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-5xl rounded-xl border border-[#D9E2FC] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#121B2E]">Edit Profil Pegawai</h1>
          <p className="mt-2 text-slate-600">Data employee dari registrasi B2 tidak ditemukan.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Kembali ke Daftar Pegawai
          </Link>
        </section>
      </HrmsShell>
    );
  }

  const { data: activeOptionsData, error: optionsError } = await supabase
    .rpc("d3_active_d1_position_options")
    .returns<D1PositionOption[]>();
  const activeOptions: D1PositionOption[] = Array.isArray(activeOptionsData) ? activeOptionsData : [];

  const positionsById = new Map(
    activeOptions.map((option) => [option.position_id, {
      id: option.position_id,
      code: option.position_code,
      title: option.position_title,
      department_id: option.department_id,
    }])
  );
  const departmentsById = new Map(
    activeOptions.map((option) => [option.department_id, {
      id: option.department_id,
      code: option.department_code,
      name: option.department_name,
    }])
  );

  // A legacy assignment remains visible so HR can edit other profile fields without
  // silently replacing a position that predates the D1 master mapping.
  const needsLegacyPosition = Boolean(employee.position_id && !positionsById.has(employee.position_id));
  const { data: legacyPosition, error: legacyPositionError } = needsLegacyPosition
    ? await supabase
      .from("d3_positions")
      .select("id, code, title, department_id")
      .eq("id", employee.position_id ?? "")
      .maybeSingle()
      .returns<PositionOption>()
    : { data: null, error: null };
  if (legacyPosition) positionsById.set(legacyPosition.id, legacyPosition);

  const needsLegacyDepartment = Boolean(employee.department_id && !departmentsById.has(employee.department_id));
  const { data: legacyDepartment, error: legacyDepartmentError } = needsLegacyDepartment
    ? await supabase
      .from("d3_departments")
      .select("id, code, name")
      .eq("id", employee.department_id ?? "")
      .maybeSingle()
      .returns<DepartmentOption>()
    : { data: null, error: null };
  if (legacyDepartment) departmentsById.set(legacyDepartment.id, legacyDepartment);

  const departmentsResult = { data: [...departmentsById.values()].sort((a, b) => a.name.localeCompare(b.name)), error: legacyDepartmentError };
  const positionsResult = { data: [...positionsById.values()].sort((a, b) => a.title.localeCompare(b.title)), error: legacyPositionError };

  if (optionsError || departmentsResult.error || positionsResult.error) {
    console.error("Employee edit lookup query failed", {
      options: optionsError?.code,
      departments: departmentsResult.error?.code,
      positions: positionsResult.error?.code,
    });

    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Edit Profil Pegawai</h1>
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
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-6xl space-y-7">
        <Link className="inline-flex text-sm font-semibold text-[#1E3765] hover:text-[#155DFC]" href={`/employees/${encodeURIComponent(employee.employee_id)}`}>← Profil Pegawai</Link>

        <header>
          <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE MANAGEMENT</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#121B2E] sm:text-[42px]">Edit Profil Pegawai</h1>
          <p className="mt-3 text-base text-slate-600">Update profile information for {employee.full_name}.</p>
        </header>

        <EmployeeEditForm
          employee={employee}
          departments={departmentsResult.data}
          positions={positionsResult.data}
        />
      </section>
    </HrmsShell>
  );
}

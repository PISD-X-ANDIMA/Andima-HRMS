"use server";

import { revalidatePath } from "next/cache";
import { getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

const employmentStatuses = new Set([
  "PERMANENT",
  "CONTRACT",
  "PROBATION",
  "INTERN",
  "RESIGNED",
  "TERMINATED",
]);

export interface EmployeeDirectoryVisibilityResult {
  ok: boolean;
  message: string;
}

export interface EmployeeStatusChangeResult {
  ok: boolean;
  employeeId?: string;
  message: string;
}

interface EmployeeStatusRpcResult {
  employee_id: string;
  employment_status: string;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function logActionError(action: string, employeeId: string | null, error: {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}) {
  console.error("D3 employee action failed", {
    action,
    employee_id: employeeId,
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

async function requireHr() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    logActionError("authentication", null, error ?? { message: "Authenticated user is unavailable." });
    return { supabase, user: null, message: "Sesi Anda tidak valid. Silakan masuk kembali." };
  }

  const role = await getD3AppRole(supabase, user.id);
  if (role !== "HR") {
    logActionError("authorization", null, { message: "The current user does not have the HR role." });
    return { supabase, user: null, message: "Anda tidak memiliki izin HR untuk menjalankan aksi ini." };
  }

  return { supabase, user, message: null };
}

export async function setEmployeeDirectoryVisibility(
  employeeUuid: string,
  shouldHide: boolean,
): Promise<EmployeeDirectoryVisibilityResult> {
  if (!isUuid(employeeUuid)) {
    return { ok: false, message: "Data pegawai tidak valid." };
  }

  const { supabase, user, message } = await requireHr();
  if (!user) return { ok: false, message: message ?? "Aksi tidak dapat dijalankan." };

  if (shouldHide) {
    const { error } = await supabase
      .from("d3_employee_directory_hidden")
      .insert({
        employee_id: employeeUuid,
        hidden_by: user.id,
        reason: "Hidden from Employee Directory by HR",
      });

    // Repeating hide is idempotent because the hidden table uses a unique employee key.
    if (error && error.code !== "23505") {
      logActionError("hide_directory_employee", employeeUuid, error);
      return { ok: false, message: "Data pegawai belum dapat disembunyikan dari Employee Directory." };
    }
  } else {
    const { error } = await supabase
      .from("d3_employee_directory_hidden")
      .delete()
      .eq("employee_id", employeeUuid);

    if (error) {
      logActionError("restore_directory_employee", employeeUuid, error);
      return { ok: false, message: "Data pegawai belum dapat ditampilkan kembali di Employee Directory." };
    }
  }

  revalidatePath("/employees");
  revalidatePath("/employees/[employeeId]", "page");
  return {
    ok: true,
    message: shouldHide
      ? "Employee disembunyikan dari Employee Directory. Data profil tetap tersimpan."
      : "Employee ditampilkan kembali di Employee Directory.",
  };
}

export async function updateEmployeeEmploymentStatus(
  employeeUuid: string,
  employmentStatus: string,
): Promise<EmployeeStatusChangeResult> {
  const normalizedStatus = employmentStatus.trim().toUpperCase();
  if (!isUuid(employeeUuid) || !employmentStatuses.has(normalizedStatus)) {
    return { ok: false, message: "Employment Status tidak valid." };
  }

  const { supabase, user, message } = await requireHr();
  if (!user) return { ok: false, message: message ?? "Aksi tidak dapat dijalankan." };

  const { data, error } = await supabase
    .rpc("d3_update_employee_employment_status", {
      p_employee_uuid: employeeUuid,
      p_employment_status: normalizedStatus,
    })
    .maybeSingle()
    .returns<EmployeeStatusRpcResult>();

  if (error || !data) {
    logActionError("update_employment_status", employeeUuid, error ?? { message: "Status RPC returned no employee." });
    if (error?.code === "42501") {
      return { ok: false, message: "Anda tidak memiliki izin untuk mengubah employment status pegawai." };
    }
    if (error?.code === "22023") {
      return {
        ok: false,
        message: error.message.toLowerCase().includes("permanent")
          ? "Employee permanent hanya dapat diubah menjadi RESIGNED atau TERMINATED."
          : "Employment Status tidak valid.",
      };
    }
    return { ok: false, message: "Employment Status belum dapat diperbarui. Silakan coba lagi." };
  }

  revalidatePath("/employees");
  revalidatePath("/employees/[employeeId]", "page");
  revalidatePath(`/employees/${data.employee_id}`);
  return {
    ok: true,
    employeeId: data.employee_id,
    message: normalizedStatus === "TERMINATED"
      ? "Layoff berhasil dicatat dan employment status menjadi TERMINATED."
      : "Employment Status berhasil diperbarui.",
  };
}

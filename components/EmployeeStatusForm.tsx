"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import CustomButton from "@/components/CustomButton";
import { employmentStatuses, type EmploymentStatus } from "@/types/employee";
import { createClient } from "@/utils/supabase/client";

interface EmployeeStatusFormProps {
  employee: {
    id: string;
    employee_id: string;
    full_name: string;
    employment_status: string | null;
  };
}

interface EmployeeStatusUpdateResult {
  employee_id: string;
  employment_status: EmploymentStatus;
}

function isEmploymentStatus(value: string | null): value is EmploymentStatus {
  return employmentStatuses.includes(value as EmploymentStatus);
}

export default function EmployeeStatusForm({ employee }: EmployeeStatusFormProps) {
  const currentStatus = isEmploymentStatus(employee.employment_status) ? employee.employment_status : "";
  const [selectedStatus, setSelectedStatus] = useState<EmploymentStatus | "">(currentStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const profileUrl = `/employees/${encodeURIComponent(employee.employee_id)}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isEmploymentStatus(selectedStatus)) {
      setErrorMessage("Employment Status tidak valid.");
      return;
    }

    if (selectedStatus === employee.employment_status) {
      setSuccessMessage("Employment Status belum berubah.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("employees")
        .update({ employment_status: selectedStatus })
        .eq("id", employee.id)
        .select("employee_id, employment_status")
        .maybeSingle()
        .returns<EmployeeStatusUpdateResult>();

      if (error) {
        if (error.code === "42501") {
          setErrorMessage("Anda tidak memiliki izin untuk mengubah employment status pegawai.");
        } else {
          setErrorMessage("Employment Status belum dapat diperbarui. Silakan coba lagi.");
        }

        setIsSubmitting(false);
        return;
      }

      if (!data) {
        setErrorMessage("Anda tidak memiliki izin untuk mengubah employment status pegawai.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Employment Status berhasil diperbarui. Mengarahkan ke profil pegawai...");
      window.setTimeout(() => {
        router.replace(`/employees/${encodeURIComponent(data.employee_id)}`);
        router.refresh();
      }, 500);
    } catch {
      setErrorMessage("Employment Status belum dapat diperbarui. Silakan coba lagi.");
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <section className="rounded-xl border border-[#D9E2FC] bg-white p-5 shadow-[0_4px_16px_rgba(15,35,66,0.04)]">
        <h2 className="text-base font-bold text-[#121B2E]">Employment Status</h2>
        <dl className="mt-4 grid gap-4 rounded-lg bg-[#F7F9FC] p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Employee ID</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{employee.employee_id}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Nama Employee</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{employee.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Status Saat Ini</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{employee.employment_status ?? "Belum tersedia"}</dd>
          </div>
        </dl>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Employment Status Baru
          <select
            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#121B2E] outline-none transition focus:ring-1 ${
              errorMessage ? "border-red-500 focus:border-red-600 focus:ring-red-600" : "border-[#D9E2FC] focus:border-[#1E3765] focus:ring-[#1E3765]"
            }`}
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as EmploymentStatus | "")}
            disabled={isSubmitting}
            required
          >
            <option value="">Pilih employment status</option>
            {employmentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </section>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {errorMessage}
        </p>
      )}
      {successMessage && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">
          {successMessage}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-[#D9E2FC] pt-5 sm:flex-row sm:justify-end">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#1E3765] bg-white px-4 text-sm font-bold text-[#1E3765] transition hover:bg-[#F2F5FB]"
          href={profileUrl}
        >
          Cancel
        </Link>
        <CustomButton type="submit" fullWidth={false} disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Save Status"}
        </CustomButton>
      </div>
    </form>
  );
}

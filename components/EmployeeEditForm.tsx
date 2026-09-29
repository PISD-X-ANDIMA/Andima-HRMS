"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CustomButton from "@/components/CustomButton";
import type { DepartmentOption, EmployeeProfile, PositionOption } from "@/types/employee";
import { createClient } from "@/utils/supabase/client";

interface EmployeeEditFormProps {
  employee: EmployeeProfile;
  departments: DepartmentOption[];
  positions: PositionOption[];
}

interface EmployeeEditFormState {
  fullName: string;
  email: string;
  phone: string;
  identityType: string;
  identityNumber: string;
  join_date: string;
  positionId: string;
  departmentId: string;
  workLocation: string;
}

interface EmployeeUpdateResult {
  employee_id: string;
}

function fieldClassName(hasError: boolean) {
  return `mt-2 h-11 w-full rounded-[15px] border bg-[#155DFC]/10 px-3.5 text-sm font-medium text-[#121B2E] outline-none transition focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${
    hasError
      ? "border-red-500 focus:border-red-600 focus:ring-red-600"
      : "border-[#D9E2FC] focus:border-[#1E3765] focus:ring-[#1E3765]"
  }`;
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default function EmployeeEditForm({ employee, departments, positions }: EmployeeEditFormProps) {
  const [formData, setFormData] = useState<EmployeeEditFormState>({
    fullName: employee.full_name ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    identityType: employee.identity_type ?? "",
    identityNumber: employee.identity_number ?? "",
    join_date: toDateInputValue(employee.join_date),
    positionId: employee.position_id ?? "",
    departmentId: employee.department_id ?? "",
    workLocation: employee.work_location ?? "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const profileUrl = `/employees/${encodeURIComponent(employee.employee_id)}`;

  const availablePositions = useMemo(
    () => positions.filter((position) => position.department_id === formData.departmentId),
    [formData.departmentId, positions]
  );

  const updateField = <K extends keyof EmployeeEditFormState>(field: K, value: EmployeeEditFormState[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) return "Full Name wajib diisi.";
    if (!formData.email.trim()) return "Email wajib diisi.";
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) return "Format email tidak valid.";
    if (!formData.join_date) return "Join Date wajib diisi.";
    if (!formData.departmentId) return "Department wajib dipilih.";
    if (!formData.positionId) return "Position wajib dipilih.";
    if (!formData.workLocation.trim()) return "Work Location wajib diisi.";

    const position = positions.find((item) => item.id === formData.positionId);
    if (!position || position.department_id !== formData.departmentId) {
      return "Position yang dipilih tidak sesuai dengan department.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("employees")
        .update({
          full_name: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          identity_type: formData.identityType.trim() || null,
          identity_number: formData.identityNumber.trim() || null,
          join_date: formData.join_date,
          position_id: formData.positionId,
          department_id: formData.departmentId,
          work_location: formData.workLocation.trim(),
        })
        .eq("id", employee.id)
        .select("employee_id")
        .maybeSingle()
        .returns<EmployeeUpdateResult>();

      if (error) {
        if (error.code === "42501") {
          setErrorMessage("Anda tidak memiliki izin untuk mengubah data pegawai.");
        } else if (error.code === "23505") {
          setErrorMessage("Email sudah digunakan.");
        } else {
          setErrorMessage("Profil pegawai belum dapat diperbarui. Silakan coba lagi.");
        }

        setIsSubmitting(false);
        return;
      }

      if (!data) {
        setErrorMessage("Anda tidak memiliki izin untuk mengubah data pegawai.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Profil pegawai berhasil diperbarui. Mengarahkan ke profil pegawai...");
      window.setTimeout(() => {
        router.replace(`/employees/${encodeURIComponent(data.employee_id)}`);
        router.refresh();
      }, 500);
    } catch {
      setErrorMessage("Profil pegawai belum dapat diperbarui. Silakan coba lagi.");
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={isSubmitting}>
        <section className="rounded-[18px] border border-[#1E3765]/55 bg-white p-5 shadow-[3px_3px_20px_rgba(87,138,252,0.24)] sm:p-7">
          <div className="flex flex-col gap-1 border-b border-[#D9E2FC] pb-5"><h2 className="text-xl font-extrabold tracking-tight text-[#121B2E]">Profile Information</h2><p className="text-sm text-slate-500">Employee ID is a fixed reference and cannot be changed.</p></div>
          <div className="mt-6 grid gap-x-6 gap-y-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-[#121B2E]">Employee Name <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.fullName.trim()))} value={formData.fullName} onChange={(event) => updateField("fullName", event.target.value)} required /></label>
            <dl className="text-sm font-semibold text-[#121B2E]"><dt>Employee ID</dt><dd className="mt-2 flex h-11 items-center rounded-[15px] border border-[#1E3765]/25 bg-[#1E3765]/5 px-3.5 text-sm font-bold tracking-wide text-[#1E3765]">{employee.employee_id}</dd></dl>
            <label className="text-sm font-semibold text-[#121B2E]">Identity Number<input className={fieldClassName(false)} value={formData.identityNumber} onChange={(event) => updateField("identityNumber", event.target.value)} /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Email <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.email.trim()))} type="email" value={formData.email} onChange={(event) => updateField("email", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Phone Number<input className={fieldClassName(false)} type="tel" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Identity Type<input className={fieldClassName(false)} value={formData.identityType} onChange={(event) => updateField("identityType", event.target.value)} /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Join Date <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.join_date))} type="date" name="join_date" value={formData.join_date} onChange={(event) => updateField("join_date", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Department <span className="text-[#E5484D]">*</span><select className={fieldClassName(Boolean(errorMessage && !formData.departmentId))} value={formData.departmentId} onChange={(event) => { const departmentId = event.target.value; setFormData((current) => ({ ...current, departmentId, positionId: current.positionId && positions.find((position) => position.id === current.positionId)?.department_id === departmentId ? current.positionId : "" })); }} required><option value="">Pilih department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></label>
            <label className="text-sm font-semibold text-[#121B2E]">Position <span className="text-[#E5484D]">*</span><select className={fieldClassName(Boolean(errorMessage && !formData.positionId))} value={formData.positionId} onChange={(event) => updateField("positionId", event.target.value)} disabled={!formData.departmentId} required><option value="">{formData.departmentId ? "Pilih position" : "Pilih department terlebih dahulu"}</option>{availablePositions.map((position) => <option key={position.id} value={position.id}>{position.title} ({position.code})</option>)}</select></label>
            <label className="text-sm font-semibold text-[#121B2E]">Work Location <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.workLocation.trim()))} value={formData.workLocation} onChange={(event) => updateField("workLocation", event.target.value)} required /></label>
          </div>
        </section>
      </fieldset>

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

      <div className="flex flex-col-reverse gap-3 border-t border-[#D9E2FC] pt-6 sm:flex-row sm:justify-end">
        <Link
          className="inline-flex h-11 items-center justify-center rounded-[15px] border border-[#155DFC] bg-[#EEF4FF] px-5 text-sm font-bold text-[#155DFC] transition hover:bg-[#DCE8FF]"
          href={profileUrl}
        >
          Cancel
        </Link>
        <CustomButton type="submit" fullWidth={false} disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Save Changes"}
        </CustomButton>
      </div>
    </form>
  );
}

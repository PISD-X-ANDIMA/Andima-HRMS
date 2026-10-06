"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CustomButton from "@/components/CustomButton";
import {
  employmentStatuses,
  type DepartmentOption,
  type EmploymentStatus,
  type PositionOption,
} from "@/types/employee";
import { createClient } from "@/utils/supabase/client";

interface EmployeeCreateFormProps {
  departments: DepartmentOption[];
  positions: PositionOption[];
}

interface EmployeeCreateResult {
  employee_id: string;
}

interface EmployeeFormState {
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  identityType: string;
  identityNumber: string;
  join_date: string;
  employmentStatus: EmploymentStatus | "";
  positionId: string;
  departmentId: string;
  workLocation: string;
}

const initialFormState: EmployeeFormState = {
  employeeId: "",
  fullName: "",
  email: "",
  phone: "",
  identityType: "",
  identityNumber: "",
  join_date: "",
  employmentStatus: "",
  positionId: "",
  departmentId: "",
  workLocation: "",
};

function fieldClassName(hasError: boolean) {
  return `mt-1 h-11 w-full rounded-[10px] border bg-[#155DFC]/20 px-3.5 text-sm font-medium text-[#1E3765] outline-none transition focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${
    hasError
      ? "border-red-500 focus:border-red-600 focus:ring-red-600"
      : "border-[#D9E2FC] focus:border-[#1E3765] focus:ring-[#1E3765]"
  }`;
}

export default function EmployeeCreateForm({ departments, positions }: EmployeeCreateFormProps) {
  const [formData, setFormData] = useState<EmployeeFormState>(initialFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const availablePositions = useMemo(
    () => positions.filter((position) => position.department_id === formData.departmentId),
    [formData.departmentId, positions]
  );

  const updateField = <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.employeeId.trim()) return "Employee ID wajib diisi.";
    if (!formData.fullName.trim()) return "Full Name wajib diisi.";
    if (!formData.identityNumber.trim()) return "Nomor identitas wajib diisi.";
    if (!formData.phone.trim()) return "Nomor telepon wajib diisi.";
    if (!formData.email.trim()) return "Email wajib diisi.";
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) return "Format email tidak valid.";
    if (!formData.join_date) return "Join Date wajib diisi.";
    if (!formData.employmentStatus) return "Employment Status wajib dipilih.";
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
      const employeeId = formData.employeeId.trim();
      const { error } = await supabase
        .from("d3_employee")
        .insert({
          employee_id: employeeId,
          full_name: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          identity_type: formData.identityType.trim() || null,
          identity_number: formData.identityNumber.trim() || null,
          join_date: formData.join_date,
          employment_status: formData.employmentStatus,
          position_id: formData.positionId,
          department_id: formData.departmentId,
          work_location: formData.workLocation.trim(),
        })
        .select("employee_id")
        .single()
        .returns<EmployeeCreateResult>();

      if (error) {
        const uniqueErrorSource = `${error.message} ${error.details ?? ""}`.toLowerCase();

        if (error.code === "23505" && uniqueErrorSource.includes("employee_id")) {
          setErrorMessage("Employee ID sudah digunakan. Gunakan Employee ID lain.");
        } else if (error.code === "23505" && uniqueErrorSource.includes("email")) {
          setErrorMessage("Email sudah digunakan.");
        } else if (error.code === "23505") {
          setErrorMessage("Employee ID atau email sudah digunakan.");
        } else if (error.code === "42501") {
          setErrorMessage("Anda tidak memiliki izin untuk menambahkan pegawai.");
        } else {
          setErrorMessage("Data pegawai belum dapat disimpan. Silakan coba lagi.");
        }

        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Pegawai berhasil ditambahkan. Mengarahkan ke profil pegawai...");
      window.setTimeout(() => {
        router.replace(`/employees/${encodeURIComponent(employeeId)}`);
        router.refresh();
      }, 700);
    } catch {
      setErrorMessage("Data pegawai belum dapat disimpan. Silakan coba lagi.");
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={isSubmitting}>
        <section>
          <div className="border-b-2 border-[#1E3765]/70 pb-3">
            <h2 className="text-[30px] font-bold tracking-tight text-[#1E3765] sm:text-[38px]">Add a New Employee</h2>
            <p className="text-sm font-semibold text-[#1E3765] sm:text-lg">Fill in all required fields to create a new employee profile.</p>
          </div>
          <div className="mt-3 grid gap-x-5 gap-y-2 md:grid-cols-2">
            <label className="text-sm font-semibold text-[#1E3765] md:col-span-2">Employee ID <span className="text-[#A70407]">*</span><input placeholder="e.g. EMP - XXX" className={fieldClassName(Boolean(errorMessage && !formData.employeeId.trim()))} value={formData.employeeId} onChange={(event) => updateField("employeeId", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#1E3765] md:col-span-2">Employee Name <span className="text-[#A70407]">*</span><input placeholder="Full Name" className={fieldClassName(Boolean(errorMessage && !formData.fullName.trim()))} value={formData.fullName} onChange={(event) => updateField("fullName", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#1E3765] md:col-span-2">Identity Information <span className="text-[#A70407]">*</span><input placeholder="Identity Number" className={fieldClassName(Boolean(errorMessage && !formData.identityNumber.trim()))} value={formData.identityNumber} onChange={(event) => updateField("identityNumber", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#1E3765]">Phone Number <span className="text-[#A70407]">*</span><input placeholder="xxxx-xxxx-xxxx" className={fieldClassName(Boolean(errorMessage && !formData.phone.trim()))} type="tel" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Email <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.email.trim()))} type="email" value={formData.email} onChange={(event) => updateField("email", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Join Date <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.join_date))} type="date" name="join_date" value={formData.join_date} onChange={(event) => updateField("join_date", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#121B2E]">Employment Status <span className="text-[#E5484D]">*</span><select className={fieldClassName(Boolean(errorMessage && !formData.employmentStatus))} value={formData.employmentStatus} onChange={(event) => updateField("employmentStatus", event.target.value as EmploymentStatus | "")} required><option value="">Pilih status</option>{employmentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="text-sm font-semibold text-[#121B2E]">Department <span className="text-[#E5484D]">*</span><select className={fieldClassName(Boolean(errorMessage && !formData.departmentId))} value={formData.departmentId} onChange={(event) => { const departmentId = event.target.value; setFormData((current) => ({ ...current, departmentId, positionId: current.positionId && positions.find((position) => position.id === current.positionId)?.department_id === departmentId ? current.positionId : "" })); }} required><option value="">Pilih department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></label>
            <label className="text-sm font-semibold text-[#121B2E]">Work Location <span className="text-[#E5484D]">*</span><input className={fieldClassName(Boolean(errorMessage && !formData.workLocation.trim()))} value={formData.workLocation} onChange={(event) => updateField("workLocation", event.target.value)} required /></label>
            <label className="text-sm font-semibold text-[#121B2E] md:col-span-2">Position <span className="text-[#E5484D]">*</span><select className={fieldClassName(Boolean(errorMessage && !formData.positionId))} value={formData.positionId} onChange={(event) => updateField("positionId", event.target.value)} disabled={!formData.departmentId} required><option value="">{formData.departmentId ? "Pilih position" : "Pilih department terlebih dahulu"}</option>{availablePositions.map((position) => <option key={position.id} value={position.id}>{position.title} ({position.code})</option>)}</select></label>
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
          href="/employees"
        >
          Cancel
        </Link>
        <CustomButton type="submit" fullWidth={false} disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Save"}
        </CustomButton>
      </div>
    </form>
  );
}

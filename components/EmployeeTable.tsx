"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import HrmsStatusPill from "@/components/hrms/HrmsStatusPill";
import type { EmployeeListItem } from "@/types/employee";

interface EmployeeTableProps {
  employees: EmployeeListItem[];
}

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("") || "EP";
}

export default function EmployeeTable({ employees }: EmployeeTableProps) {
  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department_name).filter((department): department is string => Boolean(department)))).sort(),
    [employees]
  );
  const [selectedDepartment, setSelectedDepartment] = useState("all employees");
  const visibleEmployees = selectedDepartment === "all employees"
    ? employees
    : employees.filter((employee) => employee.department_name === selectedDepartment);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2.5" aria-label="Department filter">
        {["all employees", ...departments].map((department) => {
          const isSelected = selectedDepartment === department;

          return (
            <button
              className={`rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition ${
                isSelected
                  ? "border-[#155DFC] bg-[#155DFC] text-white shadow-[3px_3px_12px_rgba(87,138,252,0.3)]"
                  : "border-[#577CFC]/35 bg-white text-[#1E3765] hover:border-[#155DFC] hover:bg-[#EEF4FF] hover:text-[#155DFC]"
              }`}
              key={department}
              onClick={() => setSelectedDepartment(department)}
              type="button"
            >
              {department}
            </button>
          );
        })}
      </div>

      {visibleEmployees.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#577CFC]/35 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Tidak ada employee pada department ini.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleEmployees.map((employee) => (
            <Link
              className="group relative overflow-hidden rounded-[10px] border border-[rgba(87,138,252,0.25)] bg-white p-5 shadow-[3px_3px_18px_rgba(87,138,252,0.18)] transition duration-200 hover:-translate-y-1 hover:border-[#577CFC]/70 hover:shadow-[5px_6px_24px_rgba(87,138,252,0.35)]"
              href={`/employees/${encodeURIComponent(employee.employee_id)}`}
              key={employee.id}
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#155DFC] via-[#577CFC] to-[#D9E2FC]" />
              <div className="flex items-start justify-between gap-4 pt-2">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#1E3765] text-sm font-extrabold text-white shadow-[0_0_0_4px_rgba(87,138,252,0.13)]">{initials(employee.full_name)}</span>
                <HrmsStatusPill value={employee.employment_status} />
              </div>
              <div className="mt-5">
                <h2 className="text-lg font-extrabold tracking-tight text-[#121B2E] transition group-hover:text-[#155DFC]">{employee.full_name}</h2>
                <p className="mt-2 text-sm font-semibold text-[#1E3765]">{employee.position_title || "Position belum tersedia"}</p>
                <p className="mt-1 text-sm text-slate-600">{employee.department_name || "Department belum tersedia"}</p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#D9E2FC] pt-3">
                <p className="text-xs font-extrabold tracking-[0.08em] text-[#1E3765]">{employee.employee_id}</p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500"><MapPin className="size-3.5 shrink-0 text-[#155DFC]" aria-hidden="true" /><span className="truncate">{employee.work_location || "Lokasi belum tersedia"}</span></p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

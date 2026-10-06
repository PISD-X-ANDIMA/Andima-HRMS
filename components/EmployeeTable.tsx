"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Department filter">
        {["all employees", ...departments].map((department) => {
          const isSelected = selectedDepartment === department;

          return (
            <button
              className={`h-7 min-w-[128px] rounded-full border px-4 text-[10px] font-medium transition ${
                isSelected
                  ? "border-[#155DFC] bg-[#155DFC] text-white shadow-[3px_3px_8px_rgba(87,138,252,0.42)]"
                  : "border-[#578AFC] bg-white text-[#1E3765] hover:border-[#155DFC] hover:bg-[#EEF4FF] hover:text-[#155DFC]"
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
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleEmployees.map((employee) => (
            <Link
              className="group relative min-h-[108px] overflow-hidden rounded-[8px] border border-[#578AFC]/45 bg-white px-5 py-4 shadow-[3px_3px_12px_rgba(87,138,252,0.4)] transition hover:border-[#155DFC]"
              href={`/employees/${encodeURIComponent(employee.employee_id)}`}
              key={employee.id}
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-[#D9E2FC]" />
              <div className="flex items-start gap-3 pt-1">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#65C89C] text-sm font-bold text-white">{initials(employee.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><h2 className="truncate text-[17px] font-bold leading-5 text-[#121B2E] transition group-hover:text-[#155DFC]">{employee.full_name}</h2><HrmsStatusPill value={employee.employment_status} /></div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold leading-4 text-[#1E3765]">{[employee.position_title, employee.department_name].filter(Boolean).join(" · ") || "Position belum tersedia"}</p>
                  <p className="mt-2 text-xs font-bold tracking-[0.08em] text-[#1E3765]">{employee.employee_id}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

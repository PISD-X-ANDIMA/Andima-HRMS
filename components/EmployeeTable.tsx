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
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" aria-label="Department filter">
        {["all employees", ...departments].map((department) => {
          const isSelected = selectedDepartment === department;

          return (
            <button
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                isSelected
                  ? "bg-[#1E3765] text-white shadow-sm"
                  : "border border-[#D9E2FC] bg-white text-[#1E3765] hover:border-[#1E3765]"
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
        <div className="rounded-xl border border-dashed border-[#D9E2FC] bg-white px-5 py-10 text-center text-sm text-slate-500">
          Tidak ada employee pada department ini.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleEmployees.map((employee) => (
            <Link
              className="group rounded-xl border border-[#D9E2FC] bg-white p-5 shadow-[0_4px_16px_rgba(15,35,66,0.05)] transition hover:-translate-y-0.5 hover:border-[#1E3765]/50 hover:shadow-[0_10px_24px_rgba(15,35,66,0.1)]"
              href={`/employees/${encodeURIComponent(employee.employee_id)}`}
              key={employee.id}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#D9E2FC] text-sm font-bold text-[#1E3765]">
                  {initials(employee.full_name)}
                </span>
                <HrmsStatusPill value={employee.employment_status} />
              </div>
              <div className="mt-4">
                <h2 className="text-base font-bold text-[#121B2E] group-hover:text-[#1E3765]">{employee.full_name}</h2>
                <p className="mt-1 min-h-10 text-sm leading-5 text-slate-600">
                  {[employee.position_title, employee.department_name].filter(Boolean).join(" · ") || "Belum tersedia"}
                </p>
              </div>
              <p className="mt-4 border-t border-[#D9E2FC]/70 pt-3 text-xs font-bold tracking-wide text-[#1E3765]">{employee.employee_id}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

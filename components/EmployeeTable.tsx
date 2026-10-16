"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import HrmsStatusPill from "@/components/hrms/HrmsStatusPill";
import type { EmployeeListItem } from "@/types/employee";

interface EmployeeTableProps {
  employees: EmployeeListItem[];
  summary?: { total: number; active: number; probation: number; inactive: number };
}

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("") || "EP";
}

export default function EmployeeTable({ employees, summary }: EmployeeTableProps) {
  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department_name).filter((department): department is string => Boolean(department)))).sort(),
    [employees]
  );
  const [selectedDepartment, setSelectedDepartment] = useState("all employees");
  const [searchQuery, setSearchQuery] = useState("");
  const visibleEmployees = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return employees.filter((employee) => {
      const isInDepartment = selectedDepartment === "all employees" || employee.department_name === selectedDepartment;
      if (!isInDepartment) return false;
      if (!normalizedQuery) return true;

      return [employee.full_name, employee.employee_id, employee.department_name, employee.position_title]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [employees, searchQuery, selectedDepartment]);

  return (
    <div className="mt-5 space-y-5">
      {summary && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-xl border border-[#D9E2FC] bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Total Pegawai</p><p className="mt-1 text-2xl font-bold text-[#121B2E]">{summary.total}</p></div><div className="rounded-xl border border-[#D9E2FC] bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Aktif</p><p className="mt-1 text-2xl font-bold text-emerald-700">{summary.active}</p></div><div className="rounded-xl border border-[#D9E2FC] bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Probation</p><p className="mt-1 text-2xl font-bold text-amber-700">{summary.probation}</p></div><div className="rounded-xl border border-[#D9E2FC] bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Tidak Aktif</p><p className="mt-1 text-2xl font-bold text-slate-600">{summary.inactive}</p></div></div>}
      <label className="relative block">
        <span className="sr-only">Cari employee</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          className="h-10 w-full rounded-[10px] border border-[#D9E2FC] bg-white py-2 pl-10 pr-3 text-sm text-[#121B2E] outline-none transition placeholder:text-slate-400 focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/20"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Cari nama, Employee ID, department, atau position"
          type="search"
          value={searchQuery}
        />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Department filter">
        {["all employees", ...departments].map((department) => {
          const isSelected = selectedDepartment === department;

          return (
            <button
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition ${
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
          Tidak ada employee yang sesuai dengan pencarian atau department ini.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleEmployees.map((employee) => (
            <Link
              className="group relative min-h-[108px] overflow-hidden rounded-[8px] border border-[#578AFC]/45 bg-white px-5 py-4 shadow-[3px_3px_12px_rgba(87,138,252,0.4)] transition hover:border-[#155DFC] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#155DFC]"
              href={`/employees/${encodeURIComponent(employee.employee_id)}`}
              key={employee.id}
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-[#D9E2FC]" />
              <div className="flex items-start gap-3 pt-1">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#65C89C] text-sm font-bold text-white">{initials(employee.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><h2 className="truncate text-[17px] font-bold leading-5 text-[#121B2E] transition group-hover:text-[#155DFC]">{employee.full_name}</h2><HrmsStatusPill value={employee.employment_status} /></div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold leading-4 text-[#1E3765]">{[employee.position_title, employee.department_name].filter(Boolean).join(" · ") || "Position belum tersedia"}</p>
                  <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs font-bold tracking-[0.08em] text-[#1E3765]">{employee.employee_id}</p><span className="text-xs font-bold text-[#155DFC]">Lihat Profil →</span></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

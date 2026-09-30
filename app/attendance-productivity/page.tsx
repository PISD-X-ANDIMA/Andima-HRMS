"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  UsersRound,
  UserCheck,
  UserX,
  CalendarDays,
  TrendingUp,
  ChevronRight,
  Search,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import HeaderAccount from "@/components/HeaderAccount";

type AttendanceStatus = "PRESENT" | "UNDER_MINIMUM" | "ABSENT" | "LEAVE" | string;

type AttendanceRecord = {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  date: string;
  status: AttendanceStatus;
  clock_in: string | null;
  clock_out: string | null;
  work_hours: number | null;
};

type AttendanceEmployee = {
  employee_id: string;
  full_name: string;
  department_id: string | null;
  d3_departments: { name: string } | null;
};

type AttendanceQueryRow = {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus | null;
  d3_employee: AttendanceEmployee | null;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PRESENT: {
    label: "Hadir",
    className: "bg-[#eaf7f0] text-[#16834b]",
  },
  UNDER_MINIMUM: {
    label: "Di bawah 7 jam",
    className: "bg-[#fef9c3] text-[#b7791f]",
  },
  ABSENT: {
    label: "Tidak Hadir",
    className: "bg-[#fff0f0] text-[#d64545]",
  },
  LEAVE: {
    label: "Izin / Cuti",
    className: "bg-[#edf6ff] text-[#1971c2]",
  },
};

export default function AttendanceProductivityPage() {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<AttendanceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [startDate, setStartDate] = useState("2026-09-20");
  const [endDate, setEndDate] = useState("2026-09-30");

  // Fetch real data from Supabase
  async function fetchAttendanceFromSupabase() {
    try {
      setLoading(true);
      setErrorMessage("");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("d3_attendances")
        .select(`
          id,
          employee_id,
          date,
          clock_in,
          clock_out,
          status,
          d3_employee!fk_d3_attendances_d3_employee (
            employee_id,
            full_name,
            department_id,
            d3_departments!fk_d3_employee_d3_departments (
              name
            )
          )
        `)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) {
        console.warn("Supabase query notice:", error.message);
        setErrorMessage(
          error.code === "42501"
            ? "Akses dashboard memerlukan akun HRMS yang telah dipetakan ke data karyawan."
            : "Data kehadiran belum dapat dimuat. Coba kembali atau hubungi HR Admin."
        );
        setAttendances([]);
        setSelectedItem(null);
        return;
      }

      if (data) {
        const formatted: AttendanceRecord[] = (data as unknown as AttendanceQueryRow[]).map((item) => {
          const emp = item.d3_employee;

          let clockInStr: string | null = null;
          if (item.clock_in) {
            const inDate = new Date(item.clock_in);
            clockInStr = !isNaN(inDate.getTime())
              ? inDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
              : String(item.clock_in);
          }

          let clockOutStr: string | null = null;
          if (item.clock_out) {
            const outDate = new Date(item.clock_out);
            clockOutStr = !isNaN(outDate.getTime())
              ? outDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
              : String(item.clock_out);
          }

          const clockInTime = item.clock_in ? new Date(item.clock_in).getTime() : Number.NaN;
          const clockOutTime = item.clock_out ? new Date(item.clock_out).getTime() : Number.NaN;
          const workHours =
            Number.isFinite(clockInTime) && Number.isFinite(clockOutTime) && clockOutTime > clockInTime
              ? Number(((clockOutTime - clockInTime) / 3_600_000).toFixed(1))
              : null;

          const derivedStatus: AttendanceStatus = item.status === "LEAVE"
            ? "LEAVE"
            : workHours !== null && workHours >= 7
              ? "PRESENT"
              : workHours !== null
                ? "UNDER_MINIMUM"
                : "ABSENT";

          return {
            id: item.id || `ATT-${item.employee_id}`,
            employee_id: emp?.employee_id || item.employee_id || "EMP-AND-000",
            full_name: emp?.full_name || "Karyawan",
            department: emp?.d3_departments?.name || "-",
            date: item.date || new Date().toISOString().split("T")[0],
            status: derivedStatus,
            clock_in: clockInStr,
            clock_out: clockOutStr,
            work_hours: workHours,
          };
        });

        setAttendances(formatted);
        setSelectedItem(formatted[0] ?? null);
      }
    } catch (err: unknown) {
      console.error("Fetch Exception:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungkan ke Supabase."
      );
      setAttendances([]);
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAttendanceFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const filteredData = useMemo(() => {
    return attendances.filter((item) => {
      const matchesSearch =
        item.full_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.employee_id
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.department
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesDate =
        item.date >= startDate && item.date <= endDate;

      return matchesSearch && matchesDate;
    });
  }, [attendances, searchQuery, startDate, endDate]);

  const summary = useMemo(() => {
    const present = filteredData.filter(
      (item) => item.status === "PRESENT"
    ).length;

    const underMinimum = filteredData.filter(
      (item) => item.status === "UNDER_MINIMUM"
    ).length;

    const absent = filteredData.filter(
      (item) => item.status === "ABSENT"
    ).length;

    const leave = filteredData.filter(
      (item) => item.status === "LEAVE"
    ).length;

    const totalWorkHours = filteredData.reduce(
      (total, item) => total + (item.work_hours ?? 0),
      0
    );

    const recordsWithHours = filteredData.filter(
      (item) => item.work_hours !== null
    ).length;

    const averageWorkHours =
      recordsWithHours > 0
        ? totalWorkHours / recordsWithHours
        : 0;

    return {
      present,
      underMinimum,
      absent,
      leave,
      averageWorkHours,
    };
  }, [filteredData]);

  const productivitySeries = useMemo(() => {
    const byDate = new Map<string, { total: number; count: number }>();
    const byEmployee = new Map<string, { name: string; total: number; count: number }>();
    filteredData.forEach((item) => {
      if (item.work_hours === null) return;
      const day = byDate.get(item.date) ?? { total: 0, count: 0 };
      day.total += item.work_hours;
      day.count += 1;
      byDate.set(item.date, day);
      const employee = byEmployee.get(item.employee_id) ?? { name: item.full_name, total: 0, count: 0 };
      employee.total += item.work_hours;
      employee.count += 1;
      byEmployee.set(item.employee_id, employee);
    });
    return {
      daily: Array.from(byDate, ([date, value]) => ({ date, hours: value.total / value.count })).sort((a, b) => a.date.localeCompare(b.date)),
      employees: Array.from(byEmployee.values()).map((value) => ({ name: value.name, hours: value.total / value.count })).sort((a, b) => b.hours - a.hours).slice(0, 8),
    };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-[#f7f8ff] text-[#121b2e]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#d9e2fc] bg-white px-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <span className="font-bold text-[#121b2e]">
              ANDIMA HRMS
            </span>

            <span className="h-5 border-l border-[#d9e2fc]" />

            <span className="text-xs font-semibold text-[#3f4940]">
              HRMS
            </span>

            <ChevronRight
              size={13}
              className="text-[#4d5f81]/50"
            />

            <span className="truncate text-xs font-semibold text-[#006838]">
              Attendance & Productivity
            </span>
          </div>

          <span className="text-sm font-bold text-[#121b2e] sm:hidden">
            Attendance & Productivity
          </span>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={fetchAttendanceFromSupabase}
              title="Refresh Data Supabase"
              className="grid size-9 place-items-center rounded-lg text-[#4d5f81] transition hover:bg-[#f1f3ff]"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              type="button"
              className="relative grid size-9 place-items-center rounded-lg text-[#4d5f81] transition hover:bg-[#f1f3ff]"
              aria-label="Notifikasi"
            >
              <Bell size={17} />

              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64545]" />
            </button>

            <HeaderAccount />
          </div>
        </div>
      </header>

      {/* PAGE TITLE */}
      <section className="border-b border-[#d9e2fc] bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.4px] text-[#121b2e]">
                Attendance & Productivity
              </h1>

              <p className="mt-1 max-w-3xl text-sm text-[#4d5f81]">
                Monitor ringkasan kehadiran dan informasi produktivitas karyawan
              </p>
            </div>

            {/* <span className="inline-flex w-fit items-center rounded-full border border-[#006838]/25 bg-[#eaf7f0] px-3 py-1.5 text-xs font-bold text-[#006838]">
              Role: HR / Manager
            </span> */}
          </div>

          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* FILTER */}
          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Dari
                </label>

                <div className="relative">
                  <CalendarDays
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d5f81]"
                  />

                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) =>
                      setStartDate(e.target.value)
                    }
                    className="rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#069494] focus:ring-2 focus:ring-[#069494]/15"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Sampai
                </label>

                <div className="relative">
                  <CalendarDays
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d5f81]"
                  />

                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) =>
                      setEndDate(e.target.value)
                    }
                    className="rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#069494] focus:ring-2 focus:ring-[#069494]/15"
                  />
                </div>
              </div>
            </div>

            <div className="relative w-full xl:w-72">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4d5f81]"
              />

              <input
                type="text"
                placeholder="Cari nama, NIP, departemen..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                className="w-full rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-[#4d5f81]/70 focus:border-[#069494] focus:ring-2 focus:ring-[#069494]/15"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {/* Total Data */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Total Data
                </p>

                <p className="mt-2 text-2xl font-bold text-[#121b2e]">
                  {loading ? "..." : filteredData.length}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Record kehadiran
                </p>
              </div>

              <div className="grid size-9 place-items-center rounded-lg bg-[#edf6ff] text-[#1971c2]">
                <UsersRound size={18} />
              </div>
            </div>
          </div>

          {/* Hadir */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Hadir
                </p>

                <p className="mt-2 text-2xl font-bold text-[#16834b]">
                  {loading ? "..." : summary.present}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Kehadiran tercatat
                </p>
              </div>

              <div className="grid size-9 place-items-center rounded-lg bg-[#eaf7f0] text-[#16834b]">
                <UserCheck size={18} />
              </div>
            </div>
          </div>

          {/* Di bawah minimum */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Di bawah 7 jam
                </p>

                <p className="mt-2 text-2xl font-bold text-[#b7791f]">
                  {loading ? "..." : summary.underMinimum}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Durasi belum memenuhi minimum
                </p>
              </div>

              <div className="grid size-9 place-items-center rounded-lg bg-[#fef9c3] text-[#b7791f]">
                <TrendingUp size={18} />
              </div>
            </div>
          </div>

          {/* Tidak Hadir */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Tidak Hadir
                </p>

                <p className="mt-2 text-2xl font-bold text-[#d64545]">
                  {loading ? "..." : summary.absent}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Tidak ada kehadiran
                </p>
              </div>

              <div className="grid size-9 place-items-center rounded-lg bg-[#fff0f0] text-[#d64545]">
                <UserX size={18} />
              </div>
            </div>
          </div>

          {/* Izin / Cuti */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Izin / Cuti
                </p>

                <p className="mt-2 text-2xl font-bold text-[#1971c2]">
                  {loading ? "..." : summary.leave}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Data izin atau cuti
                </p>
              </div>

              <div className="grid size-9 place-items-center rounded-lg bg-[#edf6ff] text-[#1971c2]">
                <CalendarDays size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* PRODUCTIVITY CHARTS */}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">Tren jam kerja</p><h2 className="mt-1 text-lg font-bold">Rata-rata jam kerja per hari</h2><p className="mt-1 text-xs text-[#4d5f81]">Periode mengikuti filter tanggal di atas.</p></div><TrendingUp size={19} className="text-[#006838]" />
            </div>
            {productivitySeries.daily.length === 0 ? <div className="flex h-48 items-center justify-center text-xs text-[#4d5f81]">Belum ada data jam kerja untuk periode ini.</div> : <div className="mt-6 flex h-52 items-end gap-2 border-b border-l border-[#d9e2fc] px-3 pb-0 pt-4">{productivitySeries.daily.map((point) => { const max = Math.max(...productivitySeries.daily.map((item) => item.hours), 7); const height = Math.max((point.hours / max) * 100, 4); return <div key={point.date} className="group flex h-full min-w-7 flex-1 flex-col items-center justify-end gap-1"><span className="text-[9px] font-bold text-[#4d5f81] opacity-0 transition group-hover:opacity-100">{point.hours.toFixed(1)}j</span><div className="w-full rounded-t-md bg-[#069494] transition group-hover:bg-[#006838]" style={{ height: `${height}%` }} /><span className="text-[9px] text-[#4d5f81]">{point.date.slice(5)}</span></div> })}</div>}
          </div>
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">Perbandingan produktivitas</p><h2 className="mt-1 text-lg font-bold">Rata-rata per karyawan</h2><p className="mt-1 text-xs text-[#4d5f81]">Diurutkan berdasarkan jam kerja rata-rata.</p>
            <div className="mt-5 space-y-3">{productivitySeries.employees.length === 0 ? <p className="py-12 text-center text-xs text-[#4d5f81]">Belum ada data.</p> : productivitySeries.employees.map((employee) => { const width = Math.min((employee.hours / 9) * 100, 100); return <div key={employee.name}><div className="mb-1 flex justify-between gap-2 text-[10px]"><span className="truncate font-semibold text-[#3f4940]">{employee.name}</span><span className="font-bold text-[#121b2e]">{employee.hours.toFixed(1)} jam</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0f7]"><div className="h-full rounded-full bg-[#16834b]" style={{ width: `${width}%` }} /></div></div> })}</div>
          </div>
        </div>

        {/* HISTORY + DETAIL */}
        <div className="mt-5 flex flex-col gap-5 xl:flex-row">
          {/* TABLE */}
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#d9e2fc] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between border-b border-[#d9e2fc] px-5 py-4">
              <div>
                <h2 className="text-sm font-bold text-[#121b2e]">
                  Riwayat Kehadiran
                </h2>

                <p className="mt-0.5 text-[10px] text-[#4d5f81]">
                  {filteredData.length} data ditemukan pada periode terpilih
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[250px] items-center justify-center p-6 text-xs text-[#4d5f81]">
                <RefreshCw size={18} className="mr-2 animate-spin text-[#006838]" />
                <span>Memuat data dari Supabase...</span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex min-h-[250px] items-center justify-center p-6 text-center">
                <div>
                  <CalendarDays
                    size={32}
                    className="mx-auto text-[#becabd]"
                  />

                  <p className="mt-3 text-sm font-bold text-[#121b2e]">
                    Data kehadiran belum tersedia
                  </p>

                  <p className="mt-1 text-xs text-[#4d5f81]">
                    Tidak terdapat data pada periode atau pencarian yang dipilih.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#d9e2fc] bg-[#f7f8ff] text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                      <th className="px-5 py-3">
                        Employee
                      </th>

                      <th className="px-3 py-3">
                        Tanggal
                      </th>

                      <th className="px-3 py-3">
                        Status
                      </th>

                      <th className="px-3 py-3">
                        Clock In / Out
                      </th>

                      <th className="px-3 py-3">
                        Jam Kerja
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((row) => {
                      const isSelected = selectedItem?.id === row.id;

                      const status = STATUS_CONFIG[row.status] || {
                        label: row.status,
                        className: "bg-slate-100 text-slate-700",
                      };

                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedItem(row)}
                          className={`cursor-pointer transition hover:bg-[#f7f8ff] ${
                            isSelected ? "bg-[#eaf7f0]" : ""
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="text-xs font-bold text-[#121b2e]">
                              {row.full_name}
                            </div>

                            <div className="mt-0.5 text-[10px] text-[#4d5f81]">
                              {row.employee_id} • {row.department}
                            </div>
                          </td>

                          <td className="px-3 py-3.5 font-medium text-[#3f4940]">
                            {row.date}
                          </td>

                          <td className="px-3 py-3.5">
                            <span
                              className={`inline-flex rounded px-2 py-1 text-[10px] font-bold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td className="px-3 py-3.5 text-[#4d5f81]">
                            <div>
                              In: {row.clock_in ? `${row.clock_in} WIB` : "-"}
                            </div>

                            <div>
                              Out: {row.clock_out ? `${row.clock_out} WIB` : "-"}
                            </div>
                          </td>

                          <td className="px-3 py-3.5">
                            {row.work_hours !== null ? (
                              <span className="font-semibold text-[#121b2e]">
                                {row.work_hours.toFixed(1)} jam
                              </span>
                            ) : (
                              <span className="text-[#4d5f81]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DETAIL */}
          {selectedItem && (
            <div className="w-full shrink-0 rounded-xl border border-[#d9e2fc] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:w-[360px]">
              <div className="border-b border-[#d9e2fc] pb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Detail Kehadiran
                </span>

                <h3 className="mt-1 text-base font-bold text-[#121b2e]">
                  {selectedItem.full_name}
                </h3>

                <p className="mt-0.5 text-xs text-[#4d5f81]">
                  {selectedItem.employee_id} • {selectedItem.department}
                </p>
              </div>

              <div className="mt-4">
                <span
                  className={`inline-flex rounded px-2.5 py-1 text-[10px] font-bold ${
                    (STATUS_CONFIG[selectedItem.status] || { className: "bg-slate-100 text-slate-700" }).className
                  }`}
                >
                  {(STATUS_CONFIG[selectedItem.status] || { label: selectedItem.status }).label}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <DetailRow
                  label="Tanggal"
                  value={selectedItem.date}
                />

                <DetailRow
                  label="Clock In"
                  value={
                    selectedItem.clock_in
                      ? `${selectedItem.clock_in} WIB`
                      : "Tidak tersedia"
                  }
                />

                <DetailRow
                  label="Clock Out"
                  value={
                    selectedItem.clock_out
                      ? `${selectedItem.clock_out} WIB`
                      : "Tidak tersedia"
                  }
                />

                <DetailRow
                  label="Jam Kerja"
                  value={
                    selectedItem.work_hours !== null
                      ? `${selectedItem.work_hours.toFixed(1)} jam`
                      : "Belum tersedia"
                  }
                />
              </div>

              {/* PRODUCTIVITY */}
              <div className="mt-5 rounded-xl border border-dashed border-[#becabd] bg-[#f7f8ff] p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp
                    size={15}
                    className="text-[#4d5f81]"
                  />

                  <span className="text-xs font-bold text-[#121b2e]">
                    Informasi Produktivitas
                  </span>
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-[#4d5f81]">
                  Penilaian durasi fleksibel: presensi memenuhi target jika total jam kerja minimal 7 jam.
                </p>

                <span className={`mt-3 inline-flex rounded px-2 py-1 text-[9px] font-bold ${selectedItem.work_hours !== null && selectedItem.work_hours >= 7 ? 'bg-[#eaf7f0] text-[#16834b]' : 'bg-[#fef9c3] text-[#b7791f]'}`}>
                  {selectedItem.work_hours !== null && selectedItem.work_hours >= 7 ? 'MEMENUHI 7 JAM' : 'DI BAWAH 7 JAM'}
                </span>
              </div>

              {/* NOTE */}
              <div className="mt-4 rounded-xl border border-[#b9d6ff] bg-[#edf6ff] p-3">
                <p className="text-[10px] font-bold text-[#1971c2]">
                  Informasi
                </p>

                <p className="mt-1 text-[10px] leading-relaxed text-[#4d5f81]">
                  Data attendance digunakan sebagai informasi monitoring dan tidak digunakan untuk menyimpulkan performance karyawan.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* =========================
   COMPONENTS
========================= */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#f0f2f7] pb-2">
      <span className="text-xs text-[#4d5f81]">
        {label}
      </span>

      <span className="text-right text-xs font-semibold text-[#121b2e]">
        {value}
      </span>
    </div>
  );
}

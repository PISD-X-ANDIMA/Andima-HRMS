"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Clock3,
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

type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "LEAVE"
  | string;

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

// Fallback Demo Data saat data Supabase belum terisi atau RLS restrict
const FALLBACK_ATTENDANCES: AttendanceRecord[] = [
  {
    id: "ATT-001",
    employee_id: "EMP-AND-001",
    full_name: "Nadira Putri",
    department: "Operations",
    date: "2026-09-27",
    status: "PRESENT",
    clock_in: "08:02",
    clock_out: "17:10",
    work_hours: 8.1,
  },
  {
    id: "ATT-002",
    employee_id: "EMP-AND-002",
    full_name: "Bagas Ramadhan",
    department: "Logistics",
    date: "2026-09-27",
    status: "LATE",
    clock_in: "08:25",
    clock_out: "17:00",
    work_hours: 7.6,
  },
  {
    id: "ATT-003",
    employee_id: "EMP-AND-004",
    full_name: "Raka Prasetyo",
    department: "Warehouse",
    date: "2026-09-27",
    status: "PRESENT",
    clock_in: "08:00",
    clock_out: "16:30",
    work_hours: 7.5,
  },
  {
    id: "ATT-004",
    employee_id: "EMP-AND-005",
    full_name: "Salsa Maharani",
    department: "HR & Legal",
    date: "2026-09-27",
    status: "LEAVE",
    clock_in: null,
    clock_out: null,
    work_hours: null,
  },
  {
    id: "ATT-005",
    employee_id: "EMP-AND-006",
    full_name: "Dimas Saputra",
    department: "Operations",
    date: "2026-09-27",
    status: "ABSENT",
    clock_in: null,
    clock_out: null,
    work_hours: null,
  },
  {
    id: "ATT-006",
    employee_id: "EMP-AND-007",
    full_name: "Citra Lestari",
    department: "Finance",
    date: "2026-09-27",
    status: "PRESENT",
    clock_in: "07:58",
    clock_out: "17:02",
    work_hours: 8.1,
  },
  {
    id: "ATT-007",
    employee_id: "EMP-AND-008",
    full_name: "Fajar Nugroho",
    department: "Warehouse",
    date: "2026-09-26",
    status: "LATE",
    clock_in: "08:21",
    clock_out: "17:00",
    work_hours: 7.7,
  },
  {
    id: "ATT-008",
    employee_id: "EMP-AND-009",
    full_name: "Maya Sari",
    department: "Logistics",
    date: "2026-09-26",
    status: "PRESENT",
    clock_in: "08:04",
    clock_out: "17:05",
    work_hours: 8.0,
  },
  {
    id: "ATT-009",
    employee_id: "EMP-AND-010",
    full_name: "Rizky Pratama",
    department: "Operations",
    date: "2026-09-26",
    status: "ABSENT",
    clock_in: null,
    clock_out: null,
    work_hours: null,
  },
  {
    id: "ATT-010",
    employee_id: "EMP-AND-011",
    full_name: "Anisa Rahma",
    department: "HR & Legal",
    date: "2026-09-26",
    status: "PRESENT",
    clock_in: "08:01",
    clock_out: "17:00",
    work_hours: 8.0,
  },
];

void FALLBACK_ATTENDANCES;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PRESENT: {
    label: "Hadir",
    className: "bg-[#eaf7f0] text-[#16834b]",
  },
  LATE: {
    label: "Terlambat",
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

          return {
            id: item.id || `ATT-${item.employee_id}`,
            employee_id: emp?.employee_id || item.employee_id || "EMP-AND-000",
            full_name: emp?.full_name || "Karyawan",
            department: emp?.d3_departments?.name || "-",
            date: item.date || new Date().toISOString().split("T")[0],
            status: item.status || "PRESENT",
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

    const late = filteredData.filter(
      (item) => item.status === "LATE"
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
      late,
      absent,
      leave,
      averageWorkHours,
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

            <span className="inline-flex w-fit items-center rounded-full border border-[#006838]/25 bg-[#eaf7f0] px-3 py-1.5 text-xs font-bold text-[#006838]">
              Role: HR / Manager
            </span>
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

          {/* Terlambat */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Terlambat
                </p>

                <p className="mt-2 text-2xl font-bold text-[#b7791f]">
                  {loading ? "..." : summary.late}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Kehadiran terlambat
                </p>
              </div>

              <div className="grid size-9 place-items-center rounded-lg bg-[#fef9c3] text-[#b7791f]">
                <Clock3 size={18} />
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

        {/* PRODUCTIVITY SUMMARY */}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                  Informasi Produktivitas
                </p>

                <h2 className="mt-1 text-lg font-bold text-[#121b2e]">
                  Monitoring Produktivitas Karyawan
                </h2>

                <p className="mt-1 text-xs text-[#4d5f81]">
                  Informasi ditampilkan berdasarkan data presensi real-time dari Supabase database.
                </p>
              </div>

              <div className="grid size-10 place-items-center rounded-lg bg-[#f1f3ff] text-[#4d5f81]">
                <TrendingUp size={19} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#d9e2fc] bg-[#f7f8ff] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#4d5f81]">
                  Status Data
                </p>

                <p className="mt-2 text-sm font-bold text-[#16834b]">
                  Tersambung Supabase
                </p>

                <p className="mt-1 text-[10px] leading-relaxed text-[#4d5f81]">
                  Data karyawan & kehadiran berhasil dimuat dari database.
                </p>
              </div>

              <div className="rounded-lg border border-[#d9e2fc] bg-[#f7f8ff] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#4d5f81]">
                  Rata-rata Jam Kerja
                </p>

                <p className="mt-2 text-xl font-bold text-[#121b2e]">
                  {summary.averageWorkHours > 0
                    ? `${summary.averageWorkHours.toFixed(1)} jam`
                    : "-"}
                </p>

                <p className="mt-1 text-[10px] text-[#4d5f81]">
                  Berdasarkan durasi presensi
                </p>
              </div>

              <div className="rounded-lg border border-[#d9e2fc] bg-[#f7f8ff] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#4d5f81]">
                  Catatan
                </p>

                <p className="mt-2 text-sm font-bold text-[#121b2e]">
                  Monitoring Kehadiran
                </p>

                <p className="mt-1 text-[10px] leading-relaxed text-[#4d5f81]">
                  Data presensi digunakan untuk rekapitulasi operasional HRMS.
                </p>
              </div>
            </div>
          </div>

          {/* ATTENDANCE DISTRIBUTION */}
          <div className="rounded-xl border border-[#d9e2fc] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
              Distribusi Kehadiran
            </p>

            <h2 className="mt-1 text-lg font-bold text-[#121b2e]">
              Status Periode
            </h2>

            <div className="mt-5 space-y-4">
              <StatusProgress
                label="Hadir"
                value={summary.present}
                total={filteredData.length}
                barClass="bg-[#16834b]"
              />

              <StatusProgress
                label="Terlambat"
                value={summary.late}
                total={filteredData.length}
                barClass="bg-[#d6a62c]"
              />

              <StatusProgress
                label="Tidak Hadir"
                value={summary.absent}
                total={filteredData.length}
                barClass="bg-[#d64545]"
              />

              <StatusProgress
                label="Izin / Cuti"
                value={summary.leave}
                total={filteredData.length}
                barClass="bg-[#1971c2]"
              />
            </div>
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
                  Data kehadiran terintegrasi langsung dengan database Supabase HRMS.
                </p>

                <span className="mt-3 inline-flex rounded bg-[#eaf7f0] px-2 py-1 text-[9px] font-bold text-[#16834b]">
                  SUPABASE TERHUBUNG
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

function StatusProgress({
  label,
  value,
  total,
  barClass,
}: {
  label: string;
  value: number;
  total: number;
  barClass: string;
}) {
  const percentage =
    total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#3f4940]">
          {label}
        </span>

        <span className="text-[10px] font-bold text-[#4d5f81]">
          {value} ({percentage}%)
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#edf0f7]">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

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

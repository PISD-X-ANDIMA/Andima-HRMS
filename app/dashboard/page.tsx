"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import UserInput from "@/components/UserInput";
import CustomDropdown, { DropdownItem } from "@/components/CustomDropdown";
import CustomTable, { Column } from "@/components/CustomTable";
import {
  RotateCw,
  Plus,
  Search,
  Database,
  AlertCircle,
  Inbox,
} from "lucide-react";

/* =========================================================================
   d1_competencies 
   =========================================================================

export interface Competency {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
}

// State lama untuk d1_competencies:
// const [competencies, setCompetencies] = useState<Competency[]>([]);
// const [input_nama, setinput_nama] = useState("");
// const [input_departement, setinput_departement] = useState("");
// const [input_status, setinput_status] = useState("");

// Fungsi lama untuk menambah d1_competencies:
// const handleAddDataCompetencies = async () => {
//   if (!input_nama || !input_departement || !input_status) {
//     alert("Harap isi semua field sebelum menambahkan data.");
//     return;
//   }
//   setIsSubmitting(true);
//   try {
//     const generatedCode = `COMP-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
//     const { error: insertError } = await supabase.from("d1_competencies").insert([
//       {
//         code: generatedCode,
//         name: input_nama,
//         category: input_departement,
//       },
//     ]);
//     if (insertError) throw insertError;
//     alert("Data berhasil ditambahkan!");
//     setinput_nama("");
//     setinput_departement("");
//     setinput_status("");
//     fetchCompetencies();
//   } catch (err: any) {
//     console.error("Gagal menambahkan data:", err);
//     alert("Gagal menambahkan data. Silakan coba lagi.");
//   } finally {
//     setIsSubmitting(false);
//   }
// };

// Fungsi lama untuk fetch d1_competencies:
// const fetchCompetencies = useCallback(async () => {
//   setLoading(true);
//   setError(null);
//   try {
//     const { data, error: fetchError } = await supabase
//       .from("d1_competencies")
//       .select("*")
//       .order("created_at", { ascending: false });
//     if (fetchError) throw fetchError;
//     setCompetencies((data as Competency[]) || []);
//   } catch (err: any) {
//     console.error("Gagal mengambil data d1_competencies:", err);
//     setError(err?.message || "Gagal memuat data dari Supabase");
//     setCompetencies([]);
//   } finally {
//     setLoading(false);
//   }
// }, [supabase]);

// Kolom lama untuk d1_competencies:
// const competencyColumns: Column<Competency>[] = [
//   { key: "code", header: "Kode", ... },
//   { key: "name", header: "Nama Kompetensi", ... },
//   { key: "category", header: "Kategori", ... },
//   { key: "status", header: "Status", ... },
//   { key: "created_at", header: "Dibuat", ... },
//   { key: "actions", header: "Aksi", ... },
// ];
========================================================================= */

// Interface untuk d1_job_positions
export interface JobPosition {
  id: string;
  position_code: string;
  name: string;
  department: string;
  level: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export default function DashboardPage() {
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form input states khusus untuk menambah data d1_job_positions
  const [inputPositionCode, setInputPositionCode] = useState("");
  const [inputName, setInputName] = useState("");
  const [inputDepartment, setInputDepartment] = useState("");
  const [inputLevel, setInputLevel] = useState("");
  const [inputStatus, setInputStatus] = useState("ACTIVE");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination dan Table
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const itemsPerPage = 5;

  const supabase = createClient();

  // Handler Tambah Data Khusus d1_job_positions
  const handleAddJobPosition = async () => {
    if (!inputName.trim() || !inputDepartment.trim() || !inputLevel.trim()) {
      alert("Harap isi Nama Posisi, Departemen, dan Level sebelum menambahkan data.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate kode posisi otomatis jika input kosong (contoh: POS-1042)
      const generatedCode =
        inputPositionCode.trim() ||
        `POS-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error: insertError } = await supabase
        .from("d1_job_positions")
        .insert([
          {
            position_code: generatedCode,
            name: inputName.trim(),
            department: inputDepartment.trim(),
            level: inputLevel.trim(),
            status: inputStatus || "ACTIVE",
          },
        ]);

      if (insertError) {
        throw insertError;
      }

      alert("Data posisi jabatan berhasil ditambahkan ke d1_job_positions!");
      // Reset form
      setInputPositionCode("");
      setInputName("");
      setInputDepartment("");
      setInputLevel("");
      setInputStatus("ACTIVE");

      // Refresh data
      fetchJobPositions();
    } catch (err: any) {
      console.error("Gagal menambahkan data ke d1_job_positions:", err);
      alert(
        `Gagal menambahkan data: ${err?.message || "Silakan periksa koneksi Supabase Anda."}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch data dari tabel d1_job_positions
  const fetchJobPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("d1_job_positions")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setJobPositions((data as JobPosition[]) || []);
    } catch (err: any) {
      console.error("Gagal mengambil data d1_job_positions:", err);
      setError(err?.message || "Gagal memuat data d1_job_positions dari Supabase");
      setJobPositions([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchJobPositions();
  }, [fetchJobPositions]);

  // Dropdown list untuk filter Departemen (otomatis diekstrak dari database)
  const departmentItems: DropdownItem[] = useMemo(() => {
    const departments = Array.from(
      new Set(jobPositions.map((j) => j.department).filter(Boolean) as string[])
    );
    return [
      { id: "all", label: "Semua Departemen", subLabel: "Semua" },
      ...departments.map((dept) => ({
        id: dept.toLowerCase(),
        label: dept,
        subLabel: "Departemen",
      })),
    ];
  }, [jobPositions]);

  // Dropdown list untuk filter Level
  const levelItems: DropdownItem[] = useMemo(() => {
    const levels = Array.from(
      new Set(jobPositions.map((j) => j.level).filter(Boolean) as string[])
    );
    return [
      { id: "all", label: "Semua Level", subLabel: "Semua" },
      ...levels.map((lvl) => ({
        id: lvl.toLowerCase(),
        label: lvl,
        subLabel: "Level",
      })),
    ];
  }, [jobPositions]);

  // Dropdown list untuk status
  const statusItems: DropdownItem[] = [
    { id: "all", label: "Semua Status", subLabel: "Semua" },
    { id: "active", label: "ACTIVE", subLabel: "Aktif" },
    { id: "inactive", label: "INACTIVE", subLabel: "Nonaktif" },
  ];

  // Opsi dropdown untuk input form status
  const formStatusOptions: DropdownItem[] = [
    { id: "ACTIVE", label: "ACTIVE", subLabel: "Aktif" },
    { id: "INACTIVE", label: "INACTIVE", subLabel: "Nonaktif" },
  ];

  // Filter dataset
  const filteredData = useMemo(() => {
    return jobPositions.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.position_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.level?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDepartment =
        departmentFilter === "all" ||
        (item.department &&
          item.department.toLowerCase() === departmentFilter.toLowerCase());

      const matchLevel =
        levelFilter === "all" ||
        (item.level &&
          item.level.toLowerCase() === levelFilter.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (item.status &&
          item.status.toLowerCase() === statusFilter.toLowerCase());

      return matchSearch && matchDepartment && matchLevel && matchStatus;
    });
  }, [jobPositions, searchQuery, departmentFilter, levelFilter, statusFilter]);

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  // Kolom Tabel untuk d1_job_positions
  const columns: Column<JobPosition>[] = [
    {
      key: "position_code",
      header: "Kode Posisi",
      width: "140px",
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-wide bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
          {row.position_code || "-"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nama Posisi / Jabatan",
      render: (row) => (
        <div className="py-0.5">
          <div className="font-semibold text-slate-900 text-sm leading-snug">
            {row.name}
          </div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Departemen",
      width: "160px",
      render: (row) => {
        const dept = row.department || "-";
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
            {dept}
          </span>
        );
      },
    },
    {
      key: "level",
      header: "Level",
      width: "130px",
      render: (row) => {
        const lvl = row.level || "-";
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
            {lvl}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "130px",
      render: (row) => {
        const isOk =
          row.status?.toUpperCase() === "ACTIVE" ||
          row.status?.toLowerCase() === "ok";
        if (isOk) {
          return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-[#179C77] text-white">
              ACTIVE
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-[#D68A12] text-white">
            {row.status?.toUpperCase() || "INACTIVE"}
          </span>
        );
      },
    },
    {
      key: "created_at",
      header: "Dibuat",
      width: "130px",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      width: "100px",
      render: (row) => (
        <button
          type="button"
          onClick={() =>
            alert(
              `Detail Job Position:\nKode: ${row.position_code}\nNama: ${row.name}\nDepartemen: ${row.department}\nLevel: ${row.level}\nStatus: ${row.status}`
            )
          }
          className="text-xs font-bold text-[#7A5AF8] hover:text-[#6039E8] px-3 py-1.5 rounded-lg hover:bg-purple-50 transition cursor-pointer"
        >
          Detail
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-6xl flex flex-col gap-6">
        {/* Header Title Section */}
        

        {/* Form Tambah Data Khusus d1_job_positions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span>Tambah Data Posisi Jabatan Kedua</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* <UserInput
              placeholder="Kode (opsional, cth: POS-01)"
              value={inputPositionCode}
              onChange={(e) => setInputPositionCode(e.target.value)}
              showStatusIcon={false}
            /> */}
            <UserInput
              placeholder="Nama Posisi *"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              showStatusIcon={false}
            />
            <UserInput
              placeholder="Departemen *"
              value={inputDepartment}
              onChange={(e) => setInputDepartment(e.target.value)}
              showStatusIcon={false}
            />
            <UserInput
              placeholder="Level (cth: Staff, Senior) *"
              value={inputLevel}
              onChange={(e) => setInputLevel(e.target.value)}
              showStatusIcon={false}
            />
            <div className="w-full">
              <CustomDropdown
                placeholder="Status"
                categoryTitle="STATUS"
                items={formStatusOptions}
                value={inputStatus}
                onChange={(item) => setInputStatus(String(item.id))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleAddJobPosition}
              disabled={isSubmitting || loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#7A5AF8] hover:bg-[#6039E8] shadow-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className={`w-4 h-4 ${isSubmitting ? "animate-spin" : ""}`} />
              {isSubmitting ? "Menyimpan..." : "Tambah Posisi Jabatan"}
            </button>
          </div>
        </div>

        {/* Database Gagal Ambil Data Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Error Supabase: </span>
              {error}
            </div>
          </div>
        )}

        {/* Filter dan Pencarian Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-80">
            <UserInput
              placeholder="Cari kode, posisi, departemen..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              showStatusIcon={false}
            />
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center flex-wrap">
            <div className="w-full sm:w-44">
              <CustomDropdown
                placeholder="Pilih Departemen"
                categoryTitle="DEPARTEMEN"
                categoryBadge={`${departmentItems.length > 1 ? departmentItems.length - 1 : 0} Opsi`}
                items={departmentItems}
                value={departmentFilter}
                onChange={(item) => {
                  setDepartmentFilter(String(item.id));
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="w-full sm:w-40">
              <CustomDropdown
                placeholder="Pilih Level"
                categoryTitle="LEVEL"
                categoryBadge={`${levelItems.length > 1 ? levelItems.length - 1 : 0} Opsi`}
                items={levelItems}
                value={levelFilter}
                onChange={(item) => {
                  setLevelFilter(String(item.id));
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="w-full sm:w-36">
              <CustomDropdown
                placeholder="Pilih Status"
                categoryTitle="STATUS"
                categoryBadge="2 Opsi"
                items={statusItems}
                value={statusFilter}
                onChange={(item) => {
                  setStatusFilter(String(item.id));
                  setCurrentPage(1);
                }}
              />
            </div>

            <button
              onClick={fetchJobPositions}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCw
                className={`w-4 h-4 ${loading ? "animate-spin text-purple-600" : "text-slate-600"}`}
              />
              Segarkan Data
            </button>

            {(searchQuery ||
              departmentFilter !== "all" ||
              levelFilter !== "all" ||
              statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDepartmentFilter("all");
                  setLevelFilter("all");
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline px-2 py-1"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Tabel d1_job_positions */}
        <div className="w-full">
          {loading ? (
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RotateCw className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm font-semibold">
                Mengambil data posisi jabatan dari Supabase...
              </p>
            </div>
          ) : jobPositions.length === 0 ? (
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Tabel d1_job_positions Masih Kosong
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                Belum ada data posisi yang tersimpan di tabel{" "}
                <code className="font-semibold text-slate-700">
                  d1_job_positions
                </code>{" "}
                database Supabase. Gunakan form di atas untuk menambahkan data baru.
              </p>
            </div>
          ) : (
            <CustomTable
              columns={columns}
              data={paginatedData}
              keyExtractor={(item) => item.id}
              selectable={true}
              selectedIds={selectedIds}
              onSelectChange={(ids) => setSelectedIds(ids)}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

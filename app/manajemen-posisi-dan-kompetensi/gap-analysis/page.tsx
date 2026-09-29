"use client";

import { useState, useEffect, useMemo } from "react";
import PosisiKompetensiShell from "@/components/posisi-kompetensi/PosisiKompetensiShell";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  LineChart,
  Search,
  Users,
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const DEPARTMENTS = [
  "Department of Finance and Accounting",
  "Department of Human Capital and Culture",
  "Department of Commercial and Strategic Client Partnership",
];

interface GapItem {
  employee_id: string;
  employee_name: string;
  position_id: string;
  position_name: string;
  competency_id: string;
  competency_name: string;
  category: string;
  level_required: number;
  level_current: number;
  gap: number;
  gap_status: string;
  recommendation: string;
}

interface PositionOption {
  id: string;
  nama_posisi?: string;
  name?: string;
  departemen?: string;
  department?: string;
}

function GapAnalysisContent() {
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [gapData, setGapData] = useState<GapItem[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [loadingGap, setLoadingGap] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [employeeIdInput, setEmployeeIdInput] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Load positions list
  useEffect(() => {
    fetch("/api/d1/positions?limit=100&status=Active")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setPositions(json.data.positions || []);
          if (json.data.positions?.length > 0) {
            setSelectedPositionId(json.data.positions[0].id);
          }
        }
      })
      .finally(() => setLoadingPositions(false));
  }, []);

  const handleRunAnalysis = async () => {
    if (!selectedPositionId) return;
    setLoadingGap(true);
    setError(null);
    try {
      const empId = employeeIdInput.trim() || "mock-employee-001";
      const res = await fetch(`/api/d1/gap-analysis/${empId}?position_id=${selectedPositionId}`);
      const json = await res.json();
      if (json.success) {
        // Flatten gap data for table view
        const flatItems: GapItem[] = json.data.gaps.map((g: any) => ({
          employee_id: json.data.employee_id,
          employee_name: json.data.employee_name,
          position_id: json.data.position_id,
          position_name: json.data.position_name,
          competency_id: g.competency_id,
          competency_name: g.competency_name,
          category: g.category || "Technical",
          level_required: g.level_required,
          level_current: g.level_current,
          gap: g.gap,
          gap_status: g.gap_status,
          recommendation: g.recommendation,
        }));
        setGapData(flatItems);
      } else {
        setError(json.error?.message || "Gagal menjalankan gap analysis.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoadingGap(false);
    }
  };

  const filteredItems = useMemo(() => {
    const selectedPos = positions.find((p) => p.id === selectedPositionId);
    const dept = selectedPos?.departemen || selectedPos?.department || "";
    return gapData.filter((item) => {
      const matchSearch =
        !search.trim() ||
        item.employee_name.toLowerCase().includes(search.toLowerCase()) ||
        item.competency_name.toLowerCase().includes(search.toLowerCase()) ||
        item.position_name.toLowerCase().includes(search.toLowerCase());
      const matchDept = selectedDept === "ALL" || dept === selectedDept;
      const matchStatus = selectedStatus === "ALL" || item.gap_status === selectedStatus;
      return matchSearch && matchDept && matchStatus;
    });
  }, [gapData, search, selectedDept, selectedStatus, positions, selectedPositionId]);

  const totalKompeten = filteredItems.filter((i) => i.gap >= 0).length;
  const totalSedang = filteredItems.filter((i) => i.gap === -1).length;
  const totalSignifikan = filteredItems.filter((i) => i.gap <= -2).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#d9e2fc] pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#121b2e]">
            Analisis Kesenjangan Kompetensi 
          </h1>
          <p className="mt-1 text-sm text-[#4d5f81]">
            Matriks perbandingan standar level posisi dengan data aktual karyawan.
          </p>
        </div>
        {/* <span className="rounded-lg bg-[#eaf7f0] border border-[#bbf0d2] px-3 py-1.5 text-xs font-bold text-[#16834b]">
          Connected to DB
        </span> */}
      </div>

      {/* Run Gap Analysis Panel */}
      <div className="rounded-xl border border-[#becabd]/45 bg-white p-5 shadow-sm space-y-4">
        <p className="text-xs font-bold text-[#121b2e]">Jalankan Gap Analysis</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#4d5f81] mb-1">Pilih Posisi Target</label>
            {loadingPositions ? (
              <div className="text-xs text-[#4d5f81]">Memuat posisi...</div>
            ) : (
              <select
                value={selectedPositionId}
                onChange={(e) => setSelectedPositionId(e.target.value)}
                className="w-full rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-3 py-2.5 text-xs font-semibold text-[#1e3765] outline-none focus:border-[#069494]"
              >
                {positions.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.id} — {pos.nama_posisi || pos.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#4d5f81] mb-1">
              ID Karyawan <span className="font-normal">(opsional, default: test)</span>
            </label>
            <input
              type="text"
              value={employeeIdInput}
              onChange={(e) => setEmployeeIdInput(e.target.value)}
              placeholder="mis: EMP-AND-001"
              className="w-full rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-3 py-2.5 text-xs outline-none focus:border-[#069494]"
            />
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={loadingGap || !selectedPositionId}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3765] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0f2342] disabled:opacity-50"
          >
            {loadingGap ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Jalankan Analisis
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[#fff1f2] border border-[#fecaca] px-4 py-3 text-xs font-semibold text-[#d64545]">
            <AlertCircle size={15} /> {error}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {gapData.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4d5f81]">Total Matriks</span>
              <span className="grid size-8 place-items-center rounded-lg bg-[#f1f3ff] text-[#1e3765]">
                <LineChart size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#121b2e]">{filteredItems.length}</p>
          </div>
          <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4d5f81]">Kompeten</span>
              <span className="grid size-8 place-items-center rounded-lg bg-[#eaf7f0] text-[#16834b]">
                <CheckCircle2 size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#16834b]">{totalKompeten}</p>
          </div>
          <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4d5f81]">Kesenjangan Sedang</span>
              <span className="grid size-8 place-items-center rounded-lg bg-[#fef9c3] text-[#b7791f]">
                <AlertTriangle size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#b7791f]">{totalSedang}</p>
          </div>
          <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4d5f81]">Kesenjangan Signifikan</span>
              <span className="grid size-8 place-items-center rounded-lg bg-[#fff1f2] text-[#d64545]">
                <AlertTriangle size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#d64545]">{totalSignifikan}</p>
          </div>
        </div>
      )}

      {/* Filter Row */}
      {gapData.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm md:flex-row md:items-center text-xs">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-[#4d5f81]/70" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari karyawan, kompetensi, atau posisi..."
              className="w-full rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] py-2 pl-9 pr-3 outline-none focus:border-[#069494]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-2.5 py-1.5 text-[#4d5f81]">
              <Filter size={14} />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-transparent font-semibold text-[#1e3765] outline-none"
              >
                <option value="ALL">Semua Departemen</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-2.5 py-1.5 text-[#4d5f81]">
              <Users size={14} />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent font-semibold text-[#1e3765] outline-none"
              >
                <option value="ALL">Semua Status Gap</option>
                <option value="Kompeten">Kompeten</option>
                <option value="Kesenjangan Sedang">Kesenjangan Sedang</option>
                <option value="Kesenjangan Signifikan">Kesenjangan Signifikan</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Matrix Table */}
      {gapData.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#becabd]/35 bg-[#f7f8ff] text-[11px] font-bold uppercase tracking-wider text-[#4d5f81]">
                <tr>
                  <th className="px-4 py-3.5">Karyawan & Posisi</th>
                  <th className="px-4 py-3.5">Kompetensi</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5 text-center">Level Min</th>
                  <th className="px-4 py-3.5 text-center">Level Aktual</th>
                  <th className="px-4 py-3.5 text-center">Gap (Δ)</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Rekomendasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#becabd]/25">
                {filteredItems.map((item, idx) => (
                  <tr key={`${item.employee_id}-${item.competency_id}-${idx}`} className="transition hover:bg-[#f7f8ff]">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#121b2e]">{item.employee_name}</p>
                      <p className="text-[10px] text-[#4d5f81]">{item.employee_id} · {item.position_name}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#1e3765]">{item.competency_name}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-md bg-[#f1f3ff] px-2 py-0.5 text-[10px] font-bold text-[#1e3765]">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-[#1e3765]">Lvl {item.level_required}</td>
                    <td className="px-4 py-3.5 text-center font-bold text-[#121b2e]">Lvl {item.level_current}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center justify-center size-6 rounded-full font-extrabold ${
                        item.gap >= 0 ? "bg-[#eaf7f0] text-[#16834b]"
                        : item.gap === -1 ? "bg-[#fef9c3] text-[#b7791f]"
                        : "bg-[#fff1f2] text-[#d64545]"
                      }`}>
                        {item.gap > 0 ? `+${item.gap}` : item.gap}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        item.gap_status === "Kompeten" ? "border-[#bbf0d2] bg-[#eaf7f0] text-[#16834b]"
                        : item.gap_status === "Kesenjangan Sedang" ? "border-[#fde68a] bg-[#fef9c3] text-[#b7791f]"
                        : "border-[#fecaca] bg-[#fff1f2] text-[#d64545]"
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" />
                        {item.gap_status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {item.gap < 0 ? <BookOpen size={14} className="text-[#069494] shrink-0" /> : <CheckCircle2 size={14} className="text-[#16834b] shrink-0" />}
                        <span className="text-xs font-semibold text-[#3f4940]">{item.recommendation}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-[#4d5f81]">
                      Tidak ada data yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state before running */}
      {gapData.length === 0 && !loadingGap && !error && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#becabd]/45 bg-white py-16 text-sm text-[#4d5f81]">
          <LineChart size={36} className="text-[#becabd]" />
          <p>Pilih posisi dan klik <b>&quot;Jalankan Analisis&quot;</b> untuk melihat matriks gap kompetensi.</p>
        </div>
      )}
    </div>
  );
}

export default function GapAnalysisPage() {
  return (
    <PosisiKompetensiShell>
      <GapAnalysisContent />
    </PosisiKompetensiShell>
  );
}

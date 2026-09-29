"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import PosisiKompetensiShell, {
  usePosisiKompetensiRole,
} from "@/components/posisi-kompetensi/PosisiKompetensiShell";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Save,
  Clock,
  BarChart3,
  Loader2,
} from "lucide-react";

export interface KpiRow {
  id?: string;
  kpi_name?: string;
  nama_kpi?: string;
  kpi_target?: string;
  target_kpi?: string;
  kpi_weight?: number;
  bobot_kpi?: number;
}

interface PositionOption {
  id: string;
  nama_posisi?: string;
  name?: string;
  departemen?: string;
  department?: string;
}

interface PositionKpiGroup {
  position_id: string;
  positionName: string;
  department: string;
  kpis: KpiRow[];
  totalWeight: number;
  updated_at?: string;
}

function getKpiName(k: KpiRow) { return k.kpi_name || k.nama_kpi || ""; }
function getKpiTarget(k: KpiRow) { return k.kpi_target || k.target_kpi || ""; }
function getKpiWeight(k: KpiRow) { return Number(k.kpi_weight ?? k.bobot_kpi ?? 0); }

function KpiContent() {
  const { viewRole } = usePosisiKompetensiRole();
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [kpiGroups, setKpiGroups] = useState<PositionKpiGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [toast, setToast] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPositionId, setEditPositionId] = useState<string | null>(null);

  const DEPARTMENTS = [
    "Department of Finance and Accounting",
    "Department of Human Capital and Culture",
    "Department of Commercial and Strategic Client Partnership",
  ];

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [posRes, kpiRes] = await Promise.all([
        fetch("/api/d1/positions?limit=100"),
        fetch("/api/d1/kpi"),
      ]);
      const posJson = await posRes.json();
      const kpiJson = await kpiRes.json();

      const posData: PositionOption[] = posJson.success ? posJson.data.positions : [];
      const kpiData: KpiRow[] = kpiJson.success ? kpiJson.data : [];

      setPositions(posData);

      // Group KPIs by position
      const groups: Record<string, PositionKpiGroup> = {};
      for (const pos of posData) {
        const posKpis = kpiData.filter((k: any) => k.position_id === pos.id);
        if (posKpis.length > 0) {
          const totalWeight = posKpis.reduce((s: number, k: KpiRow) => s + getKpiWeight(k), 0);
          groups[pos.id] = {
            position_id: pos.id,
            positionName: pos.nama_posisi || pos.name || "",
            department: pos.departemen || pos.department || "",
            kpis: posKpis,
            totalWeight,
          };
        }
      }
      setKpiGroups(Object.values(groups));
    } catch {
      showNotification("Gagal memuat data dari server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredGroups = useMemo(() => {
    return kpiGroups.filter(
      (g) => selectedDepartment === "ALL" || g.department === selectedDepartment
    );
  }, [kpiGroups, selectedDepartment]);

  const handleSaveKpi = async (posId: string, kpis: KpiRow[]) => {
    // Delete existing KPIs for this position first then re-insert
    try {
      // Fetch existing KPI IDs for this position
      const existingRes = await fetch(`/api/d1/kpi?position_id=${posId}`);
      const existingJson = await existingRes.json();
      if (existingJson.success) {
        // Delete each
        await Promise.all(
          (existingJson.data || []).map((k: any) =>
            fetch(`/api/d1/kpi/${k.id}`, { method: "DELETE" })
          )
        );
      }

      // Insert new KPIs
      const res = await fetch("/api/d1/kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position_id: posId,
          validate_total_weight: false,
          kpis: kpis.map((k) => ({
            kpi_name: getKpiName(k),
            kpi_target: getKpiTarget(k),
            kpi_weight: getKpiWeight(k),
          })),
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchAll();
        setIsModalOpen(false);
        setEditPositionId(null);
        const posName = positions.find((p) => p.id === posId)?.nama_posisi || positions.find((p) => p.id === posId)?.name || posId;
        showNotification(`Definisi KPI untuk "${posName}" berhasil disimpan.`);
      } else {
        showNotification(`Error: ${json.error?.message}`);
      }
    } catch {
      showNotification("Gagal menyimpan KPI.");
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={17} className="text-[#77d8cd]" />
          {toast}
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 border-b border-[#d9e2fc] pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#121b2e]">
            Definisi KPI & Total Bobot
          </h1>
          {/* <p className="mt-1 text-sm text-[#4d5f81]">
            Susun indikator kinerja utama per posisi dengan validasi real-time bobot 100%.
          </p> */}
        </div>
        {viewRole === "manager" ? (
          <button
            onClick={() => { setEditPositionId(null); setIsModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#16834b] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#006838]"
          >
            <Plus size={16} /> Atur / Tambah Definisi KPI
          </button>
        ) : (
          <span className="rounded-lg bg-[#f1f3ff] px-3 py-2 text-xs font-semibold text-[#4d5f81]">
            👁️ Mode Baca Saja
          </span>
        )}
      </div>

      {/* Department Filter */}
      <div className="flex items-center justify-between rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1e3765]">
          <BarChart3 size={16} className="text-[#069494]" />
          <span>Filter Departemen:</span>
        </div>
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-3 py-1.5 text-xs font-semibold text-[#1e3765] outline-none"
        >
          <option value="ALL">Semua Departemen</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#4d5f81]">
          <Loader2 size={20} className="animate-spin" /> Memuat data KPI...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-[#4d5f81] rounded-xl border border-[#becabd]/45 bg-white">
          <Award size={32} className="text-[#becabd]" />
          <p>Belum ada definisi KPI. Klik &quot;Atur / Tambah Definisi KPI&quot; untuk memulai.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((item) => (
            <div
              key={item.position_id}
              className="flex flex-col justify-between rounded-xl border border-[#becabd]/45 bg-white p-5 shadow-sm transition hover:border-[#069494]/50"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-[#becabd]/35 pb-3">
                  <div>
                    {/* <span className="text-[10px] font-bold text-[#069494]">{item.position_id}</span> */}
                    <h3 className="text-base font-bold text-[#121b2e]">{item.positionName}</h3>
                    <p className="text-[11px] text-[#4d5f81]">{item.department}</p>
                  </div>
                  {viewRole === "manager" && (
                    <button
                      onClick={() => { setEditPositionId(item.position_id); setIsModalOpen(true); }}
                      className="rounded p-1 text-[#069494] hover:bg-[#eaf7f0]"
                      title="Edit KPI Posisi Ini"
                    >
                      <Award size={18} />
                    </button>
                  )}
                </div>

                {/* Weight Progress */}
                <div className="my-4">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-[#4d5f81]">Total Bobot KPI:</span>
                    <span className={item.totalWeight === 100 ? "text-[#16834b]" : "text-[#d64545]"}>
                      {item.totalWeight}% {item.totalWeight === 100 ? "(Sesuai)" : "(Perlu Penyesuaian)"}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#f1f3ff] overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        item.totalWeight === 100 ? "bg-[#16834b]" : item.totalWeight > 100 ? "bg-[#d64545]" : "bg-[#b7791f]"
                      }`}
                      style={{ width: `${Math.min(item.totalWeight, 100)}%` }}
                    />
                  </div>
                </div>

                {/* KPI List */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4d5f81]">
                    Indikator Kinerja ({item.kpis.length})
                  </p>
                  {item.kpis.map((kpi, i) => (
                    <div
                      key={kpi.id || i}
                      className="flex items-center justify-between rounded-lg bg-[#f7f8ff] p-2.5 text-xs border border-[#becabd]/30"
                    >
                      <div className="pr-2">
                        <p className="font-semibold text-[#121b2e]">{getKpiName(kpi)}</p>
                        <p className="text-[10px] text-[#4d5f81]">
                          Target: <b className="text-[#1e3765]">{getKpiTarget(kpi)}</b>
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-[#1e3765] px-2 py-1 text-[11px] font-bold text-white">
                        {getKpiWeight(kpi)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {viewRole === "manager" && (
                <div className="mt-5 border-t border-[#becabd]/35 pt-3 text-[10px] text-[#4d5f81] flex justify-end">
                  <button
                    onClick={() => { setEditPositionId(item.position_id); setIsModalOpen(true); }}
                    className="font-bold text-[#069494] hover:underline"
                  >
                    Edit KPI 
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <MultiStepKpiModal
          positions={positions}
          editPositionId={editPositionId}
          existingGroups={kpiGroups}
          onClose={() => { setIsModalOpen(false); setEditPositionId(null); }}
          onSave={handleSaveKpi}
        />
      )}
    </div>
  );
}

function MultiStepKpiModal({
  positions,
  editPositionId,
  existingGroups,
  onClose,
  onSave,
}: {
  positions: PositionOption[];
  editPositionId: string | null;
  existingGroups: PositionKpiGroup[];
  onClose: () => void;
  onSave: (posId: string, kpis: KpiRow[]) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(editPositionId ? 2 : 1);
  const [positionId, setPositionId] = useState(editPositionId || positions[0]?.id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveNotice, setAutoSaveNotice] = useState<string>("");

  const existing = existingGroups.find((g) => g.position_id === positionId);
  const selectedPos = positions.find((p) => p.id === positionId);
  const posName = selectedPos?.nama_posisi || selectedPos?.name || positionId;
  const posDepart = selectedPos?.departemen || selectedPos?.department || "";

  const [kpis, setKpis] = useState<KpiRow[]>(
    existing?.kpis || [
      { id: `k-${Date.now()}-1`, kpi_name: "", kpi_target: "", kpi_weight: 50 },
      { id: `k-${Date.now()}-2`, kpi_name: "", kpi_target: "", kpi_weight: 50 },
    ]
  );

  const totalWeight = useMemo(() => kpis.reduce((s, k) => s + getKpiWeight(k), 0), [kpis]);
  const isValid = totalWeight === 100 && kpis.length > 0 && kpis.every((k) => getKpiName(k).trim() && getKpiTarget(k).trim() && getKpiWeight(k) > 0);

  // Auto-save draft to localStorage every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem("kpi_draft", JSON.stringify({ positionId, kpis }));
      const t = new Date().toLocaleTimeString("id-ID");
      setAutoSaveNotice(`Draft auto-saved pukul ${t}`);
      setTimeout(() => setAutoSaveNotice(""), 4000);
    }, 30000);
    return () => clearInterval(timer);
  }, [positionId, kpis]);

  const handlePositionChange = (id: string) => {
    setPositionId(id);
    const ex = existingGroups.find((g) => g.position_id === id);
    if (ex) setKpis(ex.kpis);
    else setKpis([{ id: `k-${Date.now()}`, kpi_name: "", kpi_target: "", kpi_weight: 100 }]);
  };

  const addRow = () => setKpis([...kpis, { id: `k-${Date.now()}`, kpi_name: "", kpi_target: "", kpi_weight: 10 }]);
  const removeRow = (id: string) => { if (kpis.length > 1) setKpis(kpis.filter((k) => k.id !== id)); };
  const updateRow = (id: string, field: string, value: string | number) => {
    setKpis((prev) => prev.map((k) => k.id === id ? { ...k, [field]: value } : k));
  };

  const handleSave = async () => {
    if (!isValid) return;
    setIsSaving(true);
    await onSave(positionId, kpis);
    localStorage.removeItem("kpi_draft");
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden text-xs">
        <div className="flex items-center justify-between border-b border-[#d9e2fc] px-6 py-4 bg-[#0f2342] text-white">
          <div>
            <h2 className="text-base font-bold">Multi-step Form Definisi KPI </h2>
            <p className="text-[11px] text-[#d9e2fc]/80">
              Step {step} dari 2 - {step === 1 ? "Pilih Posisi Jabatan" : "Definisi Indikator & Bobot"}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#d9e2fc] hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {autoSaveNotice && (
          <div className="bg-[#edf6ff] border-b border-[#b9d6ff] px-6 py-2 text-[11px] font-semibold text-[#1971c2] flex items-center gap-1.5">
            <Clock size={13} /> {autoSaveNotice}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold ${step === 1 ? "bg-[#16834b] text-white" : "bg-[#eaf7f0] text-[#16834b]"}`}>
              <span>1</span> Pilih Posisi
            </div>
            <ChevronRight size={14} className="text-[#4d5f81]" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold ${step === 2 ? "bg-[#16834b] text-white" : "bg-[#f1f3ff] text-[#4d5f81]"}`}>
              <span>2</span> Tambah Row KPI & Validasi 100%
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-[#3f4940] mb-1">Pilih Posisi Jabatan:</label>
                <select
                  value={positionId}
                  onChange={(e) => handlePositionChange(e.target.value)}
                  className="w-full rounded-lg border border-[#becabd]/60 bg-white p-3 text-xs font-semibold outline-none focus:border-[#069494]"
                >
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.id} — {pos.nama_posisi || pos.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg bg-[#f7f8ff] p-4 border border-[#becabd]/35 space-y-2">
                <p className="font-bold text-[#1e3765]">Detail Posisi Terpilih:</p>
                <p>Nama Posisi: <b className="text-[#121b2e]">{posName}</b></p>
                <p>Departemen: <b className="text-[#121b2e]">{posDepart}</b></p>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[#d9e2fc]">
                <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-bold text-[#4d5f81] hover:bg-[#f1f3ff]">Batal</button>
                <button type="button" onClick={() => setStep(2)} className="rounded-lg bg-[#16834b] px-4 py-2 font-bold text-white hover:bg-[#006838]">
                  Lanjut ke Step 2
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <p className="font-bold text-[#121b2e]">Daftar Indikator Kinerja untuk {posName}:</p>
                <button onClick={addRow} className="inline-flex items-center gap-1 text-xs font-bold text-[#16834b] hover:underline">
                  <Plus size={14} /> Tambah Row KPI
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {kpis.map((row, idx) => (
                  <div
                    key={row.id || idx}
                    className="grid grid-cols-[minmax(0,1fr)_140px_90px_32px] gap-2 items-center bg-[#f7f8ff] p-2.5 rounded-lg border border-[#becabd]/35"
                  >
                    <input
                      type="text"
                      value={getKpiName(row)}
                      onChange={(e) => updateRow(row.id!, "kpi_name", e.target.value)}
                      placeholder={`Nama KPI #${idx + 1}...`}
                      className="w-full rounded border border-[#becabd]/60 bg-white px-2.5 py-1.5 outline-none focus:border-[#069494]"
                    />
                    <input
                      type="text"
                      value={getKpiTarget(row)}
                      onChange={(e) => updateRow(row.id!, "kpi_target", e.target.value)}
                      placeholder="Target (mis: ≥ 98%)"
                      className="w-full rounded border border-[#becabd]/60 bg-white px-2.5 py-1.5 outline-none focus:border-[#069494]"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={getKpiWeight(row)}
                        onChange={(e) => updateRow(row.id!, "kpi_weight", Number(e.target.value))}
                        className="w-full rounded border border-[#becabd]/60 bg-white px-2 py-1.5 pr-5 text-right font-bold outline-none focus:border-[#069494]"
                      />
                      <span className="absolute right-1.5 top-1.5 text-[10px] text-[#4d5f81]">%</span>
                    </div>
                    <button
                      onClick={() => removeRow(row.id!)}
                      disabled={kpis.length <= 1}
                      className="text-[#4d5f81] hover:text-[#d64545] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Weight Validation */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                totalWeight === 100 ? "bg-[#eaf7f0] border-[#bbf0d2] text-[#16834b]"
                : totalWeight > 100 ? "bg-[#fff1f2] border-[#fecaca] text-[#d64545]"
                : "bg-[#fef9c3] border-[#fde68a] text-[#b7791f]"
              }`}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} />
                  <div>
                    <p className="font-bold">Total Bobot Saat Ini: {totalWeight}%</p>
                    <p className="text-[11px]">
                      {totalWeight === 100 ? "Valid! Total bobot sudah pas 100%."
                        : totalWeight > 100 ? `Kelebihan ${totalWeight - 100}%. Kurangi bobot KPI.`
                        : `Kurang ${100 - totalWeight}%. Tambahkan bobot KPI hingga 100%.`}
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold">{totalWeight} / 100%</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[#d9e2fc]">
                <button type="button" onClick={() => setStep(1)} className="rounded-lg px-3 py-2 font-bold text-[#4d5f81] hover:bg-[#f1f3ff]">
                  &larr; Kembali ke Step 1
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-bold text-[#4d5f81] hover:bg-[#f1f3ff]">Batal</button>
                  <button
                    type="button"
                    disabled={!isValid || isSaving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-4 py-2 font-bold text-white hover:bg-[#006838] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Simpan Definisi KPI
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KpiPage() {
  return (
    <PosisiKompetensiShell>
      <KpiContent />
    </PosisiKompetensiShell>
  );
}

"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
import PosisiKompetensiShell, {
  usePosisiKompetensiRole,
} from "@/components/posisi-kompetensi/PosisiKompetensiShell";
import {
  Briefcase,
  CheckCircle2,
  Edit2,
  Eye,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
  AlertCircle,
  Building2,
  Award,
  Loader2,
} from "lucide-react";

export interface PositionItem {
  id: string;
  nama_posisi?: string;
  name?: string;
  departemen?: string;
  department?: string;
  deskripsi_posisi?: string;
  deskripsi?: string;
  status_posisi?: "Active" | "Inactive";
  status?: string;
  created_at?: string;
  position_code?: string;
}

function getNamaPosisi(pos: PositionItem) {
  return pos.nama_posisi || pos.name || "";
}
function getDepartemen(pos: PositionItem) {
  return pos.departemen || pos.department || "";
}
function getDeskripsi(pos: PositionItem) {
  return pos.deskripsi_posisi || pos.deskripsi || "";
}
function getStatus(pos: PositionItem): "Active" | "Inactive" {
  return (pos.status_posisi || pos.status || "Active") as "Active" | "Inactive";
}

export const DEPARTMENTS = [
  "Department of Finance and Accounting",
  "Department of Human Capital and Culture",
  "Department of Commercial and Strategic Client Partnership",
] as const;

function PosisiContent() {
  const { viewRole } = usePosisiKompetensiRole();
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [toast, setToast] = useState<string>("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewItem, setViewItem] = useState<PositionItem | null>(null);
  const [editItem, setEditItem] = useState<PositionItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/d1/positions?limit=100");
      const json = await res.json();
      if (json.success) {
        setPositions(json.data.positions || []);
      } else {
        setError(json.error?.message || "Gagal memuat data posisi.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const filteredPositions = useMemo(() => {
    return positions.filter((pos) => {
      const nama = getNamaPosisi(pos).toLowerCase();
      const kode = (pos.position_code || pos.id || "").toLowerCase();
      const matchSearch =
        !search.trim() ||
        nama.includes(search.toLowerCase()) ||
        kode.includes(search.toLowerCase());
      const matchDept =
        departmentFilter === "ALL" || getDepartemen(pos) === departmentFilter;
      const matchStatus =
        statusFilter === "ALL" || getStatus(pos) === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [positions, search, departmentFilter, statusFilter]);

  const handleCreatePosition = async (body: Record<string, string | undefined>) => {
    try {
      const res = await fetch("/api/d1/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        await fetchPositions();
        setIsAddOpen(false);
        showNotification(`Posisi "${body.nama_posisi}" berhasil ditambahkan.`);
      } else {
        showNotification(`Error: ${json.error?.message}`);
      }
    } catch {
      showNotification("Gagal menambahkan posisi.");
    }
  };

  const handleUpdatePosition = async (id: string, body: Record<string, string | undefined>) => {
    try {
      const res = await fetch(`/api/d1/positions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        await fetchPositions();
        setEditItem(null);
        showNotification(`Posisi berhasil diperbarui.`);
      } else {
        showNotification(`Error: ${json.error?.message}`);
      }
    } catch {
      showNotification("Gagal memperbarui posisi.");
    }
  };

  const handleDeletePosition = async (id: string) => {
    setIsDeleting(true);
    try {
      const target = positions.find((p) => p.id === id);
      const res = await fetch(`/api/d1/positions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await fetchPositions();
        setDeleteId(null);
        if (target) showNotification(`Posisi "${getNamaPosisi(target)}" berhasil dihapus.`);
      } else {
        showNotification(`Error: ${json.error?.message}`);
      }
    } catch {
      showNotification("Gagal menghapus posisi.");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = positions.filter((p) => getStatus(p) === "Active").length;
  const deptSet = new Set(positions.map(getDepartemen).filter(Boolean));

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={17} className="text-[#77d8cd]" />
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#d9e2fc] pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#121b2e]">
            Daftar Posisi Pekerjaan 
          </h1>
          <p className="mt-1 text-sm text-[#4d5f81]">
            Kelola data posisi jabatan, struktur departemen, dan tingkat hirarki di PT Andima Transportindo.
          </p>
        </div>
        {viewRole === "manager" ? (
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#16834b] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#006838]"
          >
            <Plus size={16} /> Tambah Posisi Baru
          </button>
        ) : (
          <span className="rounded-lg bg-[#f1f3ff] px-3 py-2 text-xs font-semibold text-[#4d5f81]">
            👁️ Mode Baca Saja
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4d5f81]">Total Posisi</span>
            <span className="grid size-8 place-items-center rounded-lg bg-[#f1f3ff] text-[#1e3765]">
              <Briefcase size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#121b2e]">{positions.length}</p>
        </div>
        <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4d5f81]">Posisi Aktif</span>
            <span className="grid size-8 place-items-center rounded-lg bg-[#eaf7f0] text-[#16834b]">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#16834b]">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4d5f81]">Departemen</span>
            <span className="grid size-8 place-items-center rounded-lg bg-[#f1f3ff] text-[#069494]">
              <Building2 size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#121b2e]">{deptSet.size}</p>
        </div>
        <div className="rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4d5f81]">Posisi Inaktif</span>
            <span className="grid size-8 place-items-center rounded-lg bg-[#fff1f2] text-[#d64545]">
              <Award size={16} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#d64545]">{positions.length - activeCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#becabd]/45 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-[#4d5f81]/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama posisi atau kode..."
            className="w-full rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#069494]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-2.5 py-1.5 text-xs text-[#4d5f81]">
            <Filter size={14} />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent font-semibold text-[#1e3765] outline-none"
            >
              <option value="ALL">Semua Departemen</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-2.5 py-1.5 text-xs text-[#4d5f81]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-semibold text-[#1e3765] outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#4d5f81]">
            <Loader2 size={20} className="animate-spin" /> Memuat data posisi...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#d64545]">
            <AlertCircle size={18} /> {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#becabd]/35 bg-[#f7f8ff] text-[11px] font-bold uppercase tracking-wider text-[#4d5f81]">
                <tr>
                  <th className="px-4 py-3.5">Kode / Nama Posisi</th>
                  <th className="px-4 py-3.5">Departemen</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#becabd]/25">
                {filteredPositions.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#f7f8ff]">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-[#121b2e]">{getNamaPosisi(item)}</p>
                      <p className="text-[10px] text-[#4d5f81]">{item.position_code || item.id}</p>
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3.5 text-[#3f4940]" title={getDepartemen(item)}>
                      {getDepartemen(item)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          getStatus(item) === "Active"
                            ? "border-[#bbf0d2] bg-[#eaf7f0] text-[#16834b]"
                            : "border-[#fecaca] bg-[#fff1f2] text-[#d64545]"
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        {getStatus(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewItem(item)}
                          className="rounded p-1.5 text-[#4d5f81] transition hover:bg-[#f1f3ff] hover:text-[#1e3765]"
                          title="Lihat Detail"
                        >
                          <Eye size={15} />
                        </button>
                        {viewRole === "manager" && (
                          <>
                            <button
                              onClick={() => setEditItem(item)}
                              className="rounded p-1.5 text-[#4d5f81] transition hover:bg-[#f1f3ff] hover:text-[#069494]"
                              title="Edit Posisi"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteId(item.id)}
                              className="rounded p-1.5 text-[#4d5f81] transition hover:bg-[#fff1f2] hover:text-[#d64545]"
                              title="Hapus Posisi"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPositions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#4d5f81]">
                      Tidak ada data posisi yang sesuai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tambah */}
      {isAddOpen && (
        <PositionFormModal
          title="Tambah Posisi Baru"
          onClose={() => setIsAddOpen(false)}
          onSubmit={(vals) => handleCreatePosition(vals)}
        />
      )}

      {/* Modal: Edit */}
      {editItem && (
        <PositionFormModal
          title={`Edit Posisi`}
          initialValues={{
            nama_posisi: getNamaPosisi(editItem),
            departemen: getDepartemen(editItem),
            deskripsi: getDeskripsi(editItem),
            status_posisi: getStatus(editItem),
          }}
          onClose={() => setEditItem(null)}
          onSubmit={(vals) => handleUpdatePosition(editItem.id, vals)}
        />
      )}

      {/* Modal: View Detail */}
      {viewItem && (
        <PositionDetailModal item={viewItem} onClose={() => setViewItem(null)} />
      )}

      {/* Modal: Konfirmasi Hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#d64545]">
              <AlertCircle size={24} />
              <h3 className="text-base font-bold text-[#121b2e]">Konfirmasi Hapus Posisi</h3>
            </div>
            <p className="text-xs text-[#4d5f81] leading-relaxed">
              Apakah Anda yakin ingin menonaktifkan posisi ini? 
              {/* (Soft-delete — status akan diubah ke Inactive) */}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-[#4d5f81] hover:bg-[#f1f3ff]"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeletePosition(deleteId)}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#d64545] px-4 py-2 text-xs font-bold text-white hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                Hapus Posisi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PositionFormModal({
  title,
  initialValues,
  onClose,
  onSubmit,
}: {
  title: string;
  initialValues?: {
    nama_posisi?: string;
    departemen?: string;
    deskripsi?: string;
    status_posisi?: "Active" | "Inactive";
  };
  onClose: () => void;
  onSubmit: (vals: Record<string, string | undefined>) => void;
}) {
  const [namaPosisi, setNamaPosisi] = useState(initialValues?.nama_posisi || "");
  const [departemen, setDepartemen] = useState(initialValues?.departemen || DEPARTMENTS[0]);
  const [deskripsi, setDeskripsi] = useState(initialValues?.deskripsi || "");
  const [statusPosisi, setStatusPosisi] = useState<"Active" | "Inactive">(
    initialValues?.status_posisi || "Active"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ nama_posisi?: string; deskripsi?: string }>({});

  const validate = () => {
    const errs: { nama_posisi?: string; deskripsi?: string } = {};
    if (!namaPosisi.trim() || namaPosisi.trim().length < 3 || namaPosisi.trim().length > 100) {
      errs.nama_posisi = "Nama posisi wajib diisi antara 3 - 100 karakter.";
    }
    if (deskripsi && deskripsi.length > 500) {
      errs.deskripsi = "Deskripsi tidak boleh melebihi 500 karakter.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    await onSubmit({
      nama_posisi: namaPosisi.trim(),
      departemen,
      deskripsi_posisi: deskripsi.trim() || undefined,
      status_posisi: statusPosisi,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#d9e2fc] px-6 py-4">
          <h2 className="text-base font-bold text-[#121b2e]">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-[#4d5f81] hover:bg-[#f1f3ff]">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6 text-xs">
          <div>
            <label className="block font-bold text-[#3f4940] mb-1">
              Nama Posisi <span className="text-[#d64545]">*</span>
            </label>
            <input
              type="text"
              value={namaPosisi}
              onChange={(e) => setNamaPosisi(e.target.value)}
              placeholder="Contoh: Financial Analyst"
              className={`w-full rounded-lg border bg-white px-3 py-2.5 outline-none focus:border-[#069494] ${
                errors.nama_posisi ? "border-[#d64545]" : "border-[#becabd]/60"
              }`}
            />
            {errors.nama_posisi && (
              <p className="mt-1 text-[11px] font-semibold text-[#d64545]">{errors.nama_posisi}</p>
            )}
          </div>
          <div>
            <label className="block font-bold text-[#3f4940] mb-1">
              Departemen <span className="text-[#d64545]">*</span>
            </label>
            <select
              value={departemen}
              onChange={(e) => setDepartemen(e.target.value)}
              className="w-full rounded-lg border border-[#becabd]/60 bg-white px-3 py-2.5 outline-none focus:border-[#069494]"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-[#3f4940]">Deskripsi Posisi</label>
              <span className="text-[10px] text-[#4d5f81]">{deskripsi.length}/500</span>
            </div>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={3}
              placeholder="Jelaskan peran utama dan tanggung jawab posisi..."
              className={`w-full resize-none rounded-lg border bg-white p-3 outline-none focus:border-[#069494] ${
                errors.deskripsi ? "border-[#d64545]" : "border-[#becabd]/60"
              }`}
            />
            {errors.deskripsi && (
              <p className="mt-1 text-[11px] font-semibold text-[#d64545]">{errors.deskripsi}</p>
            )}
          </div>
          <div>
            <label className="block font-bold text-[#3f4940] mb-1">Status Posisi</label>
            <div className="flex gap-4">
              {(["Active", "Inactive"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer font-medium text-[#121b2e]">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={statusPosisi === s}
                    onChange={() => setStatusPosisi(s)}
                    className={s === "Active" ? "accent-[#16834b]" : "accent-[#d64545]"}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#d9e2fc] pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-bold text-[#4d5f81] hover:bg-[#f1f3ff]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-4 py-2 text-xs font-bold text-white hover:bg-[#006838] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Simpan Posisi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PositionDetailModal({ item, onClose }: { item: PositionItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden space-y-4">
        <div className="flex items-center justify-between bg-[#1e3765] px-6 py-4 text-white">
          <div>
            {/* <p className="text-xs text-[#d9e2fc]">{item.position_code || item.id}</p> */}
            <h2 className="text-base font-bold">{getNamaPosisi(item)}</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#d9e2fc] hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-xs text-[#3f4940]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4d5f81]">Departemen</span>
            <p className="font-semibold text-[#121b2e]">{getDepartemen(item)}</p>
          </div>
          <div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4d5f81]">Status</span>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    getStatus(item) === "Active"
                      ? "border-[#bbf0d2] bg-[#eaf7f0] text-[#16834b]"
                      : "border-[#fecaca] bg-[#fff1f2] text-[#d64545]"
                  }`}
                >
                  {getStatus(item)}
                </span>
              </div>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4d5f81]">Deskripsi Posisi</span>
            <p className="mt-1 leading-relaxed bg-[#f7f8ff] p-3 rounded-lg border border-[#becabd]/35">
              {getDeskripsi(item) || "Tidak ada deskripsi rinci yang tersedia."}
            </p>
          </div>
        </div>
        <div className="bg-[#f7f8ff] px-6 py-3 border-t border-[#d9e2fc] flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#1e3765] px-4 py-2 text-xs font-bold text-white hover:bg-[#0f2342]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PosisiPage() {
  return (
    <PosisiKompetensiShell>
      <PosisiContent />
    </PosisiKompetensiShell>
  );
}

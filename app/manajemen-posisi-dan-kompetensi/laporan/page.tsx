"use client";

import { useState } from "react";
import PosisiKompetensiShell, {
  usePosisiKompetensiRole,
} from "@/components/posisi-kompetensi/PosisiKompetensiShell";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  Printer,
  Save,
  Settings,
  Calendar,
  Layers,
  Award,
  LineChart,
} from "lucide-react";

function LaporanContent() {
  const { viewRole } = usePosisiKompetensiRole();
  const [toast, setToast] = useState<string>("");

  // Automated Export Settings state
  const [autoExportEnabled, setAutoExportEnabled] = useState(true);
  const [schedule, setSchedule] = useState("SENIN_0800");
  const [recipientEmail, setRecipientEmail] = useState("hr.andima@transportindo.co.id");

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Export handlers
  const handleDownloadCsv = (reportName: string) => {
    const csvContent =
      "data:text/csv;charset=utf-8,ID,Nama,Departemen,Status,Tanggal\nPOS-001,Financial Analyst,Finance,Active,2026-09-29\nPOS-002,HR Specialist,HR,Active,2026-09-29";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportName.toLowerCase().replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Laporan "${reportName}" berhasil diunduh dalam format CSV.`);
  };

  const handleDownloadExcel = (reportName: string) => {
    const tsvContent =
      "data:application/vnd.ms-excel;charset=utf-8,ID\tNama\tDepartemen\tStatus\tTanggal\nPOS-001\tFinancial Analyst\tFinance\tActive\t2026-09-29";
    const encodedUri = encodeURI(tsvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportName.toLowerCase().replace(/\s+/g, "_")}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Laporan "${reportName}" berhasil diunduh dalam format Excel.`);
  };

  const handleDownloadPdf = (reportName: string) => {
    window.print();
    showNotification(`Window cetak PDF terbuka untuk "${reportName}".`);
  };

  const handleSaveSettings = () => {
    showNotification("Pengaturan ekspor otomatis & ringkasan mingguan berhasil disimpan.");
  };

  const reports = [
    {
      id: "DATABASE_POSISI",
      title: "Database Posisi Pekerjaan",
      description: "Ekspor seluruh master data posisi, departemen, level hirarki, serta status keaktifan.",
      icon: Layers,
      count: "5 Posisi Aktif",
    },
    {
      id: "KPI_BOBOT",
      title: "Definisi KPI & Total Bobot",
      description: "Ekspor rincian indikator kinerja per posisi beserta target dan persentase bobot 100%.",
      icon: Award,
      count: "3 Set Posisi KPI",
    },
    {
      id: "GAP_ANALYSIS",
      title: "Matriks Analisis Kesenjangan",
      description: "Ekspor data perbandingan standar posisi dengan kompetensi aktual karyawan.",
      icon: LineChart,
      count: "7 Matriks Evaluasi",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 size={17} className="text-[#77d8cd]" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#d9e2fc] pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#121b2e]">
            Laporan & Ekspor Data 
          </h1>
          <p className="mt-1 text-sm text-[#4d5f81]">
            Unduh laporan posisi, KPI, dan matriks gap analysis dalam format CSV, Excel, dan PDF.
          </p>
        </div>
      </div>

      {/* Export Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="flex flex-col justify-between rounded-xl border border-[#becabd]/45 bg-white p-5 shadow-sm transition hover:border-[#069494]/60"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#becabd]/35 pb-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-[#eaf7f0] text-[#069494]">
                    <Icon size={20} />
                  </span>
                  <span className="rounded-full bg-[#f1f3ff] px-2.5 py-0.5 text-[10px] font-bold text-[#1e3765]">
                    {report.count}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#121b2e]">{report.title}</h3>
                <p className="mt-1 text-xs text-[#4d5f81] leading-relaxed">{report.description}</p>
              </div>

              <div className="mt-6 border-t border-[#becabd]/35 pt-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#4d5f81]">Pilih Format Unduh:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleDownloadCsv(report.title)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#becabd]/60 bg-[#f7f8ff] px-2 py-2 text-xs font-bold text-[#1e3765] hover:bg-[#d9e2fc]/40"
                  >
                    <Download size={13} /> CSV
                  </button>
                  <button
                    onClick={() => handleDownloadExcel(report.title)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#bbf0d2] bg-[#eaf7f0] px-2 py-2 text-xs font-bold text-[#16834b] hover:bg-[#bbf0d2]/50"
                  >
                    <FileSpreadsheet size={13} /> Excel
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(report.title)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#fecaca] bg-[#fff1f2] px-2 py-2 text-xs font-bold text-[#d64545] hover:bg-[#fecaca]/50"
                  >
                    <Printer size={13} /> PDF
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Settings Section: Automated Export */}
      <div className="rounded-xl border border-[#becabd]/45 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-[#becabd]/35 pb-3">
          <Settings size={18} className="text-[#069494]" />
          <h2 className="text-base font-bold text-[#121b2e]">
            Pengaturan Ekspor Otomatis & Ringkasan Laporan Mingguan
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3 text-xs">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-[#121b2e]">
              <input
                type="checkbox"
                checked={autoExportEnabled}
                onChange={(e) => setAutoExportEnabled(e.target.checked)}
                className="size-4 accent-[#16834b]"
              />
              Aktifkan Pengiriman Laporan Otomatis
            </label>
            <p className="text-[11px] text-[#4d5f81]">
              Sistem akan membuat dan mengirimkan ringkasan berkala secara otomatis ke email terpilih.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-[#3f4940]">Jadwal Pengiriman</label>
            <select
              value={schedule}
              disabled={!autoExportEnabled}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full rounded-lg border border-[#becabd]/60 bg-white p-2.5 outline-none focus:border-[#069494] disabled:opacity-50"
            >
              <option value="SENIN_0800">Setiap Hari Senin (08.00 WIB)</option>
              <option value="AKHIR_BULAN">Setiap Akhir Bulan Calendar</option>
              <option value="KUARTAL">Setiap Akhir Kuartal (3 Bulan)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-[#3f4940]">Email Penerima Notifikasi</label>
            <input
              type="email"
              value={recipientEmail}
              disabled={!autoExportEnabled}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full rounded-lg border border-[#becabd]/60 bg-white p-2.5 outline-none focus:border-[#069494] disabled:opacity-50"
            />
          </div>
        </div>

        {viewRole === "manager" && (
          <div className="flex justify-end pt-3 border-t border-[#becabd]/35">
            <button
              onClick={handleSaveSettings}
              className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#006838]"
            >
              <Save size={15} /> Simpan Pengaturan Ekspor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LaporanPage() {
  return (
    <PosisiKompetensiShell>
      <LaporanContent />
    </PosisiKompetensiShell>
  );
}

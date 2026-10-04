export type RoleKpiRow = {
  readonly role_order: number;
  readonly role_name: string;
  readonly indicator_order: number;
  readonly kpi_name: string;
  readonly target: string | null;
  readonly weight_percent: number;
  readonly source_version: string;
};

export interface KpiCatalog {
  /** Catalog version actually served. V5.1 is preferred; older versions are a fallback until the V5.1 migration is applied. */
  readonly version: string;
  readonly rows: readonly RoleKpiRow[];
}

/** Version used for new KPI assessments (FR-D4-002 baseline). */
export const ACTIVE_KPI_VERSION = "V5.1";

/** KPI Scorecard V5.1, sheet "KPI LIST PER POSISI". Mirrors supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql. */
export const KPI_V51_CATALOG: readonly RoleKpiRow[] = [
  { role_order: 1, role_name: "Vice President / CEO", indicator_order: 1, kpi_name: "Pencapaian Target Laba Bersih Perusahaan", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 1, role_name: "Vice President / CEO", indicator_order: 2, kpi_name: "Pertumbuhan Pendapatan (Revenue Growth) YoY", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 1, role_name: "Vice President / CEO", indicator_order: 3, kpi_name: "Ekspansi Layanan & Strategi Kemitraan", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 1, role_name: "Vice President / CEO", indicator_order: 4, kpi_name: "Tingkat Retensi Karyawan Kunci", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 1, role_name: "Vice President / CEO", indicator_order: 5, kpi_name: "Kepatuhan Hukum & Manajemen Risiko", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 2, role_name: "Director", indicator_order: 1, kpi_name: "Pencapaian Target Pendapatan Operasional", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 2, role_name: "Director", indicator_order: 2, kpi_name: "Eksekusi Rencana Strategis Perusahaan", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 2, role_name: "Director", indicator_order: 3, kpi_name: "Efisiensi Biaya Operasional Keseluruhan", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 2, role_name: "Director", indicator_order: 4, kpi_name: "Indeks Kepuasan Klien / Customer Satisfaction Score", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 2, role_name: "Director", indicator_order: 5, kpi_name: "Pengembangan Inovasi Layanan Baru", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 3, role_name: "Operations Director", indicator_order: 1, kpi_name: "Persentase Pengiriman Tepat Waktu (On-Time Delivery)", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 3, role_name: "Operations Director", indicator_order: 2, kpi_name: "Zero Fatal Customs/Regulatory Penalty", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 3, role_name: "Operations Director", indicator_order: 3, kpi_name: "Optimalisasi Kapasitas Handling & Vendor", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 3, role_name: "Operations Director", indicator_order: 4, kpi_name: "SLA Resolusi Komplain Operasional", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 3, role_name: "Operations Director", indicator_order: 5, kpi_name: "Indeks Produktivitas & Workload Balance Tim Operasional", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 4, role_name: "Branch Manager", indicator_order: 1, kpi_name: "Pencapaian Target Revenue Cabang", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 4, role_name: "Branch Manager", indicator_order: 2, kpi_name: "Pertumbuhan Klien Baru di Cabang", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 4, role_name: "Branch Manager", indicator_order: 3, kpi_name: "Efisiensi Biaya Operasional Cabang", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 4, role_name: "Branch Manager", indicator_order: 4, kpi_name: "SLA Waktu Handling Operasional Cabang", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 4, role_name: "Branch Manager", indicator_order: 5, kpi_name: "Tingkat Retensi Karyawan Cabang", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 5, role_name: "Customs Clearance & PPJK", indicator_order: 1, kpi_name: "Kecepatan Proses Customs Clearance (PIB/PEB)", target: null, weight_percent: 30, source_version: "V5.1" },
  { role_order: 5, role_name: "Customs Clearance & PPJK", indicator_order: 2, kpi_name: "Akurasi Dokumen & Zero Nota Pembetulan", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 5, role_name: "Customs Clearance & PPJK", indicator_order: 3, kpi_name: "Kepatuhan Update Regulasi Bea Cukai", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 5, role_name: "Customs Clearance & PPJK", indicator_order: 4, kpi_name: "Kelancaran Koordinasi Lapangan", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 5, role_name: "Customs Clearance & PPJK", indicator_order: 5, kpi_name: "Efektivitas Penanganan Jalur Merah", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 6, role_name: "Airfreight / Seafreight Ops Staff", indicator_order: 1, kpi_name: "Akurasi Booking Space Maskapai/Pelayaran", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 6, role_name: "Airfreight / Seafreight Ops Staff", indicator_order: 2, kpi_name: "Ketepatan Waktu Penerbitan Dokumen (AWB/BL)", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 6, role_name: "Airfreight / Seafreight Ops Staff", indicator_order: 3, kpi_name: "Keberhasilan Konsolidasi Kargo", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 6, role_name: "Airfreight / Seafreight Ops Staff", indicator_order: 4, kpi_name: "Zero Claim/Damage pada Kargo", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 6, role_name: "Airfreight / Seafreight Ops Staff", indicator_order: 5, kpi_name: "Update Status Shipment Tepat Waktu ke Klien", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 7, role_name: "Warehousing / Logistics Staff", indicator_order: 1, kpi_name: "Akurasi Inventory Gudang", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 7, role_name: "Warehousing / Logistics Staff", indicator_order: 2, kpi_name: "Ketepatan Waktu Proses Inbound/Outbound", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 7, role_name: "Warehousing / Logistics Staff", indicator_order: 3, kpi_name: "Zero Safety Incident di Gudang", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 7, role_name: "Warehousing / Logistics Staff", indicator_order: 4, kpi_name: "Kepatuhan Penanganan Dangerous Goods", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 7, role_name: "Warehousing / Logistics Staff", indicator_order: 5, kpi_name: "Utilisasi Ruang Gudang", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 8, role_name: "Implant Staff (EDI & Manifest Input)", indicator_order: 1, kpi_name: "Akurasi Input Data Sistem Bea Cukai", target: null, weight_percent: 35, source_version: "V5.1" },
  { role_order: 8, role_name: "Implant Staff (EDI & Manifest Input)", indicator_order: 2, kpi_name: "Lead Time Input Data per Job", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 8, role_name: "Implant Staff (EDI & Manifest Input)", indicator_order: 3, kpi_name: "Kehadiran & Disiplin Kerja di Lokasi Klien", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 8, role_name: "Implant Staff (EDI & Manifest Input)", indicator_order: 4, kpi_name: "Meminimalkan Delay Akibat Salah Input", target: null, weight_percent: 10, source_version: "V5.1" },
  { role_order: 8, role_name: "Implant Staff (EDI & Manifest Input)", indicator_order: 5, kpi_name: "Komunikasi Cepat dengan Tim Utama", target: null, weight_percent: 10, source_version: "V5.1" },
  { role_order: 9, role_name: "Sales & Marketing", indicator_order: 1, kpi_name: "Pencapaian Target Volume Penjualan", target: null, weight_percent: 35, source_version: "V5.1" },
  { role_order: 9, role_name: "Sales & Marketing", indicator_order: 2, kpi_name: "Akuisisi Klien Baru", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 9, role_name: "Sales & Marketing", indicator_order: 3, kpi_name: "Akurasi Pemberian Quotation/Penawaran Harga", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 9, role_name: "Sales & Marketing", indicator_order: 4, kpi_name: "Win Rate dari Total Quotation", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 9, role_name: "Sales & Marketing", indicator_order: 5, kpi_name: "Kualitas Serah Terima Order ke Operasional", target: null, weight_percent: 10, source_version: "V5.1" },
  { role_order: 10, role_name: "Finance & Administration", indicator_order: 1, kpi_name: "Kecepatan Penerbitan Invoice (SLA < 24 jam)", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 10, role_name: "Finance & Administration", indicator_order: 2, kpi_name: "Akurasi Pembukuan Sistem & Krishand GL", target: null, weight_percent: 25, source_version: "V5.1" },
  { role_order: 10, role_name: "Finance & Administration", indicator_order: 3, kpi_name: "Ketepatan Waktu Pembayaran & Reimbursement", target: null, weight_percent: 20, source_version: "V5.1" },
  { role_order: 10, role_name: "Finance & Administration", indicator_order: 4, kpi_name: "Efektivitas Collection/Penagihan Piutang", target: null, weight_percent: 15, source_version: "V5.1" },
  { role_order: 10, role_name: "Finance & Administration", indicator_order: 5, kpi_name: "Kerapian Arsip Keuangan & Kepatuhan Pajak", target: null, weight_percent: 15, source_version: "V5.1" },
];
/** Picks the active version when present, otherwise the newest version available in the rows. */
export function selectCatalog(rows: readonly RoleKpiRow[]): KpiCatalog {
  const versions = [...new Set(rows.map((row) => row.source_version))].sort().reverse();
  const version = versions.includes(ACTIVE_KPI_VERSION) ? ACTIVE_KPI_VERSION : versions[0] ?? ACTIVE_KPI_VERSION;
  return { version, rows: rows.filter((row) => row.source_version === version) };
}

export function rolesOf(catalog: KpiCatalog): { order: number; name: string }[] {
  return [...new Map(catalog.rows.map((row) => [row.role_order, row.role_name])).entries()].map(([order, name]) => ({ order, name }));
}

export function indicatorsFor(catalog: KpiCatalog, roleOrder: number): RoleKpiRow[] {
  return catalog.rows.filter((row) => row.role_order === roleOrder).sort((a, b) => a.indicator_order - b.indicator_order);
}

const normalise = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Maps an HR position title to a KPI role. Exact title first, then a keyword match; 0 means the position has no KPI in the catalog (FR-02.11). */
export function roleForPositionTitle(catalog: KpiCatalog, title: string | undefined): number {
  if (!title) return 0;
  const target = normalise(title);
  const roles = rolesOf(catalog);
  const exact = roles.find((role) => normalise(role.name) === target);
  if (exact) return exact.order;
  // Whole words only: a bare substring such as "edi" would also match "Credit" or "Media". "Admin" is not a
  // finance keyword: "HR Administrator" or "Admin Staff" are not Finance & Administration roles.
  const keywords: [RegExp, RegExp][] = [
    [/\b(sales|marketing)\b/, /\bsales\b/], [/\b(finance|accounting)\b/, /\bfinance\b/],
    [/\b(customs|ppjk)\b/, /\bcustoms\b/], [/\b(warehouse|warehousing|logistic|logistics)\b/, /\bwarehous(e|ing)\b/],
    [/\b(air|sea)?freight\b/, /\b(air|sea)?freight\b/], [/\b(implant|edi|manifest)\b/, /\bimplant\b/],
    [/\bbranch\b/, /\bbranch\b/], [/\boperations director\b/, /\boperations director\b/], [/\b(ceo|vice president)\b/, /\bceo\b/], [/^director\b/, /^director\b/],
  ];
  for (const [position, role] of keywords) {
    if (position.test(target)) {
      const match = roles.find((item) => role.test(normalise(item.name)));
      if (match) return match.order;
    }
  }
  return 0;
}

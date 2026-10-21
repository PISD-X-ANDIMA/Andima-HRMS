export type RoleKpiRow = {
  readonly role_order: number;
  readonly role_name: string;
  readonly indicator_order: number;
  readonly kpi_name: string;
  readonly target: string | null;
  readonly weight_percent: number;
  readonly source_version: string;
};

/** A catalog version and the first period (YYYY-MM) it applies to; table d4_kpi_catalog_versions. */
export interface KpiCatalogVersion {
  readonly source_version: string;
  readonly effective_from: string;
}

/** HR mapping of a position to its KPI role within one catalog version; table d4_position_kpi_roles. */
export interface PositionKpiRole {
  readonly source_version: string;
  readonly position_id: string;
  readonly role_order: number;
}

/** Every catalog version with its rows and position mapping, as served by GET /api/d4/kpi-catalog. */
export interface KpiCatalogSet {
  readonly versions: readonly KpiCatalogVersion[];
  readonly rows: readonly RoleKpiRow[];
  readonly positionRoles: readonly PositionKpiRole[];
}

/** The one catalog version that applies to a period. */
export interface KpiCatalog {
  readonly version: string;
  readonly rows: readonly RoleKpiRow[];
  readonly positionRoles: readonly PositionKpiRole[];
}

/**
 * Fixed target of every Core KPI (HR mentor review, 14 Oct 2026: "semua targetnya 85"). The catalog workbook has no
 * targets, so this is the fallback; a target the catalog does carry wins. The scorer never types a target.
 */
export const KPI_TARGET = "85";
export const targetOf = (row: Pick<RoleKpiRow, "target">): string => row.target ?? KPI_TARGET;

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
/** The version in force for a period: the latest one whose effective_from is not after it. Null when none applies yet. */
export function catalogFor(set: KpiCatalogSet, period: string): KpiCatalog | null {
  const version = set.versions.filter((item) => item.effective_from <= period)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]?.source_version;
  if (!version) return null;
  return { version, rows: set.rows.filter((row) => row.source_version === version), positionRoles: set.positionRoles.filter((item) => item.source_version === version) };
}

/** KPI role HR assigned to a position in this version; 0 means the position has no KPI (FR-02.11). */
export function roleForPosition(catalog: KpiCatalog, positionId: string | null | undefined): number {
  return catalog.positionRoles.find((item) => item.position_id === positionId)?.role_order ?? 0;
}

/** First period scored 1–100 (catalog V6). Mirrors supabase/migrations/20261017130000_d4_kpi_scale_100_v6.sql. */
export const KPI_V6_EFFECTIVE_FROM = "2026-11";
const KPI_V6_CATALOG: readonly RoleKpiRow[] = KPI_V51_CATALOG.map((row) => ({ ...row, target: KPI_TARGET, source_version: "V6" }));

/** V5.1 up to 2026-10 and V6 (1–100) from 2026-11, positions mapped by title. Local preview and tests only; live data comes from the tables above. */
export function seedCatalogSet(positions: readonly { id: string; title: string }[]): KpiCatalogSet {
  const rows = [...KPI_V51_CATALOG, ...KPI_V6_CATALOG];
  const roleOf = (position: { title: string }) => roleForPositionTitle({ rows: KPI_V51_CATALOG }, position.title);
  return {
    versions: [{ source_version: "V5.1", effective_from: "2000-01" }, { source_version: "V6", effective_from: KPI_V6_EFFECTIVE_FROM }], rows,
    positionRoles: ["V5.1", "V6"].flatMap((version) => positions.map((position) => ({ source_version: version, position_id: position.id, role_order: roleOf(position) }))).filter((item) => item.role_order > 0),
  };
}

type Rows = Pick<KpiCatalog, "rows">;

export function rolesOf(catalog: Rows): { order: number; name: string }[] {
  return [...new Map(catalog.rows.map((row) => [row.role_order, row.role_name])).entries()].map(([order, name]) => ({ order, name }));
}

export function indicatorsFor(catalog: Rows, roleOrder: number): RoleKpiRow[] {
  return catalog.rows.filter((row) => row.role_order === roleOrder).sort((a, b) => a.indicator_order - b.indicator_order);
}

const normalise = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Guesses a KPI role from a position title (exact, then keyword). Only seeds d4_position_kpi_roles and the local preview; 0 = no KPI. */
export function roleForPositionTitle(catalog: Rows, title: string | undefined): number {
  if (!title) return 0;
  const target = normalise(title);
  const roles = rolesOf(catalog);
  const exact = roles.find((role) => normalise(role.name) === target);
  if (exact) return exact.order;
  // Whole words only: a bare substring such as "edi" would also match "Credit" or "Media". "Admin" is not a
  // finance keyword: "HR Administrator" or "Admin Staff" are not Finance & Administration roles.
  // Cash, tax and customer success follow the roles HR set for those org titles.
  const keywords: [RegExp, RegExp][] = [
    [/\b(sales|marketing|customer success)\b/, /\bsales\b/], [/\b(finance|accounting|cash|tax)\b/, /\bfinance\b/],
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

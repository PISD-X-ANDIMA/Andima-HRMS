import { compareCompetencies } from "../competency/service";
import type { CompetencyAssessment } from "../competency/types";
import type { DevelopmentNeedVersion, DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../development/types";
import { indicatorsFor, KPI_V51_CATALOG, roleForPositionTitle, selectCatalog } from "../kpi/catalog";
import type { PerformanceEvaluation, ReviewStatus } from "../performance/types";
import type {
  CompetencyReference, DepartmentReference, EmployeeReference, EmployeeSkillReference,
  PositionReference, PositionRequirementReference, ReferenceDataSnapshot,
} from "../shared/types";
import type { D4AppRole, D4LiveSnapshot, KpiAssessment, KpiAssessmentLine } from "../supabase/types";
import type { TrainingStatus, TrainingVersion } from "../training/types";

/**
 * Demo dataset for D4 (Performance & Training Development).
 *
 * Company, people and records are FICTIONAL: "PT Arunika Trans Indonesia" (ATI), a freight-forwarding
 * and logistics company (PPJK customs brokerage, air/sea freight, warehousing, implant EDI staff at client
 * sites, sales, finance, HR, branch offices). Any resemblance to real persons is coincidental.
 * Everything is derived deterministically, so every call to createDemoSeed() returns the same data.
 */

export interface DemoPersona {
  readonly key: "hr" | "manager" | "employee";
  readonly role: D4AppRole;
  readonly employeeId: string;
  readonly title: string;
  readonly description: string;
}

export interface DemoLevel {
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
  readonly description: string;
}

export const DEMO_TODAY = "2026-10-03";

/** EXAMPLE proficiency scale for the demo only. The official scale is owned by D1 and not defined yet. */
export const DEMO_LEVEL_SCALE: readonly DemoLevel[] = [
  { level: 1, label: "Dasar / Awareness", description: "Memahami konsep dasar dan istilah; pelaksanaan tugas masih memerlukan arahan penuh." },
  { level: 2, label: "Berkembang / Developing", description: "Menjalankan tugas rutin dengan supervisi; sesekali masih terjadi kesalahan yang perlu dikoreksi." },
  { level: 3, label: "Mahir / Proficient", description: "Mandiri pada tugas standar; hasil konsisten sesuai SOP tanpa supervisi rutin." },
  { level: 4, label: "Lanjut / Advanced", description: "Menangani kasus kompleks dan pengecualian; menjadi rujukan serta membimbing rekan kerja." },
  { level: 5, label: "Ahli / Expert", description: "Menetapkan standar atau kebijakan, memimpin perbaikan proses, diakui sebagai pakar internal maupun eksternal." },
];

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const BLOCK = { dept: "100", pos: "200", emp: "300", comp: "400", req: "500", skill: "600", perf: "700", kpi: "710", assess: "720", need: "730", needVer: "731", trn: "740", trnVer: "741" } as const;
const uid = (block: keyof typeof BLOCK, n: number) => `de000000-0000-4000-8000-${BLOCK[block]}${String(n).padStart(9, "0")}`;
const num = (key: string) => Number(key.slice(1));

/** "2026-07-08 10:00" in WIB → ISO UTC string. */
const at = (local: string) => new Date(`${local.replace(" ", "T")}:00+07:00`).toISOString();

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Deterministic pseudo-random number in [0, 1) for a seed string. */
function rand(seed: string): number {
  let t = hash(seed) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[], seed: string): T => items[hash(seed) % items.length];
const clamp = (value: number, lo = 1, hi = 5) => Math.max(lo, Math.min(hi, value));
const idNum = (value: number, decimals = 1) => value.toFixed(decimals).replace(".", ",");

// ---------------------------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------------------------

const DEPARTMENTS: readonly [key: string, code: string, name: string][] = [
  ["D01", "ATI-BOD", "Direksi"],
  ["D02", "ATI-CUS", "Customs Clearance & PPJK"],
  ["D03", "ATI-FRT", "Air & Sea Freight Operations"],
  ["D04", "ATI-WHS", "Warehousing & Logistics"],
  ["D05", "ATI-IMP", "Implant Services (EDI)"],
  ["D06", "ATI-COM", "Sales & Marketing"],
  ["D07", "ATI-FIN", "Finance & Accounting"],
  ["D08", "ATI-HCS", "Human Capital & General Services"],
  ["D09", "ATI-BRN", "Kantor Cabang (Surabaya & Medan)"],
];

/** [key, code, title, departmentKey, KPI role expected from roleForPositionTitle (0 = no KPI)]. */
export const DEMO_POSITION_ROLES: readonly [key: string, code: string, title: string, dept: string, kpiRole: number][] = [
  ["P01", "BOD-CEO", "Vice President / CEO", "D01", 1],
  ["P02", "BOD-VPS", "Vice President Strategy & Business Development", "D01", 1],
  ["P03", "BOD-DCO", "Director of Commercial", "D01", 2],
  ["P04", "BOD-DCS", "Director of Corporate Services", "D01", 2],
  ["P05", "BOD-OPD", "Operations Director", "D01", 3],
  ["P06", "BOD-DOD", "Deputy Operations Director", "D01", 3],
  ["P07", "BRN-BM", "Branch Manager", "D09", 4],
  ["P08", "CUS-MGR", "Customs Clearance & PPJK Manager", "D02", 5],
  ["P09", "CUS-OFF", "Customs Clearance & PPJK Officer", "D02", 5],
  ["P10", "FRT-MGR", "Freight Operations Manager", "D03", 6],
  ["P11", "FRT-AEX", "Airfreight Export Coordinator", "D03", 6],
  ["P12", "FRT-SIM", "Seafreight Import Staff", "D03", 6],
  ["P13", "WHS-MGR", "Warehouse Manager", "D04", 7],
  ["P14", "WHS-INV", "Warehouse Inventory Controller", "D04", 7],
  ["P15", "WHS-OPR", "Warehousing / Logistics Staff (Forklift Operator)", "D04", 7],
  ["P16", "IMP-COO", "EDI Implant Coordinator", "D05", 8],
  ["P17", "IMP-STF", "Implant Staff (EDI & Manifest Input)", "D05", 8],
  ["P18", "COM-MGR", "Sales Manager", "D06", 9],
  ["P19", "COM-SSE", "Senior Sales Executive", "D06", 9],
  ["P20", "COM-SME", "Sales & Marketing Executive", "D06", 9],
  ["P21", "FIN-MGR", "Finance Manager", "D07", 10],
  ["P22", "FIN-GL", "Accounting Staff (General Ledger)", "D07", 10],
  ["P23", "FIN-TAX", "Finance Tax Officer", "D07", 10],
  ["P24", "FIN-AR", "Finance Staff (AR Collection)", "D07", 10],
  ["P25", "HCS-MGR", "Human Capital Manager", "D08", 0],
  ["P26", "HCS-HRBP", "HR Business Partner", "D08", 0],
  ["P27", "HCS-IT", "IT Support Specialist", "D08", 0],
];

const COMPETENCIES: readonly [key: string, code: string, name: string, category: string][] = [
  ["C01", "CMP-CUS-01", "Customs Clearance & Regulation (PIB/PEB, CEISA)", "Regulatory/Compliance"],
  ["C02", "CMP-CUS-02", "Penanganan Jalur Merah & Pemeriksaan Fisik", "Regulatory/Compliance"],
  ["C03", "CMP-CUS-03", "Klasifikasi HS Code & Tarif (BTKI)", "Technical"],
  ["C04", "CMP-SAF-01", "Dangerous Goods Handling (IATA DGR / IMDG)", "Safety"],
  ["C05", "CMP-FRT-01", "Incoterms & Freight Documentation (AWB/BL)", "Technical"],
  ["C06", "CMP-FRT-02", "Carrier Booking & Cargo Consolidation", "Technical"],
  ["C07", "CMP-WHS-01", "Inventory Control & WMS", "Technical"],
  ["C08", "CMP-SAF-02", "Forklift & Warehouse Safety (K3)", "Safety"],
  ["C09", "CMP-EDI-01", "EDI Manifest Input (INSW/CEISA)", "Technical"],
  ["C10", "CMP-COM-01", "Negotiation & Quotation Pricing", "Interpersonal"],
  ["C11", "CMP-COM-02", "Customer Relationship Management", "Interpersonal"],
  ["C12", "CMP-FIN-01", "Financial Reporting & General Ledger", "Technical"],
  ["C13", "CMP-FIN-02", "Tax Compliance (PPh/PPN, e-Faktur)", "Regulatory/Compliance"],
  ["C14", "CMP-FIN-03", "Accounts Receivable Collection", "Technical"],
  ["C15", "CMP-MGT-01", "People Leadership & Coaching", "Managerial"],
  ["C16", "CMP-MGT-02", "Budgeting & Cost Control", "Managerial"],
  ["C17", "CMP-ANL-01", "Data Analysis (Excel/BI)", "Analytical"],
  ["C18", "CMP-MGT-03", "Strategic Planning & Business Development", "Managerial"],
  ["C19", "CMP-HR-01", "HR Policy & Employee Relations", "Regulatory/Compliance"],
  ["C20", "CMP-IT-01", "IT Service Support & Network", "Technical"],
];

/** Requirements per position: competencyKey:level, "?" suffix = optional (is_mandatory = false). */
const REQUIREMENTS: Record<string, string> = {
  P01: "C18:5 C15:5 C16:4 C11:4?",
  P02: "C18:5 C17:4 C11:4 C15:4",
  P03: "C15:4 C18:4 C10:5 C11:4",
  P04: "C15:4 C16:5 C12:4 C19:3?",
  P05: "C15:4 C16:4 C01:4 C05:4",
  P06: "C15:4 C01:4 C05:4 C17:3?",
  P07: "C15:4 C16:4 C11:3 C01:3",
  P08: "C01:4 C02:4 C03:4 C15:4",
  P09: "C01:3 C02:3 C03:3 C09:2?",
  P10: "C05:4 C06:4 C04:3 C15:4",
  P11: "C05:3 C06:3 C04:3 C11:2?",
  P12: "C05:3 C06:2 C01:2",
  P13: "C07:4 C08:4 C04:3 C15:4",
  P14: "C07:3 C17:3 C08:2",
  P15: "C08:3 C07:2 C04:2?",
  P16: "C09:4 C01:3 C15:3 C11:3?",
  P17: "C09:3 C01:2 C11:2?",
  P18: "C10:4 C11:4 C15:4 C17:3",
  P19: "C10:3 C11:3 C05:3 C17:2?",
  P20: "C10:2 C11:3 C05:2",
  P21: "C12:4 C13:4 C16:4 C15:4",
  P22: "C12:3 C13:2 C17:3",
  P23: "C13:3 C12:3 C17:2?",
  P24: "C14:3 C11:2 C12:2",
  P25: "C19:4 C15:4 C16:3 C17:3?",
  P26: "C19:3 C15:3 C17:2",
  P27: "C20:3 C17:2 C11:2?",
};

type PerfScore = number | null;
interface EmployeeSpec {
  readonly key: string;
  readonly name: string;
  readonly pos: string;
  readonly dept: string;
  readonly mgr: string | null;
  readonly joined: string;
  /** Monthly evaluation score for 2026-07, 2026-08, 2026-09 (null = no record for that month). */
  readonly perf: readonly [PerfScore, PerfScore, PerfScore];
  /**
   * Skill overrides. Unlisted requirements are recorded at the required level with evidence.
   * "C01:2" level 2 with generated evidence, "C01:-" no skill row, "C01:3n" level 3 without evidence,
   * "C15:2" for a non-required competency adds an extra skill row.
   */
  readonly sk?: string;
  /** New hire without any recorded skills. */
  readonly noSkills?: boolean;
}

const EMPLOYEES: readonly EmployeeSpec[] = [
  { key: "E01", name: "Hendro Wibisono Santoso", pos: "P01", dept: "D01", mgr: null, joined: "2011-02-01", perf: [null, null, null], sk: "C11:5" },
  { key: "E02", name: "Lusiana Tjandra", pos: "P02", dept: "D01", mgr: "E01", joined: "2015-06-15", perf: [4, 4, 4], sk: "C18:4" },
  { key: "E03", name: "Marulitua Sitompul", pos: "P03", dept: "D01", mgr: "E01", joined: "2013-09-02", perf: [4, 5, 4], sk: "C18:3 C11:5" },
  { key: "E04", name: "Ratna Kusumawardhani", pos: "P04", dept: "D01", mgr: "E01", joined: "2014-01-06", perf: [4, 4, 4], sk: "C12:3 C19:3n" },
  { key: "E05", name: "Bambang Sutrisno Hadiprojo", pos: "P05", dept: "D01", mgr: "E01", joined: "2012-03-12", perf: [5, 4, 4], sk: "C16:3 C01:5 C18:4" },
  { key: "E06", name: "Yohanes Rumengan", pos: "P06", dept: "D01", mgr: "E05", joined: "2016-08-01", perf: [4, 4, 3], sk: "C17:2" },
  { key: "E07", name: "Dwi Ayu Larasati", pos: "P07", dept: "D09", mgr: "E06", joined: "2017-04-03", perf: [4, 4, 5], sk: "C16:3" },
  { key: "E08", name: "Parlindungan Nainggolan", pos: "P07", dept: "D09", mgr: "E06", joined: "2019-11-04", perf: [3, 3, 3], sk: "C16:3 C01:-" },
  // Customs Clearance & PPJK department: the Manager persona (E09) and six staff.
  { key: "E09", name: "Asep Saepudin Hidayat", pos: "P08", dept: "D02", mgr: "E06", joined: "2014-07-14", perf: [4, 4, 4], sk: "C01:5 C03:5 C15:3" },
  { key: "E10", name: "Fajar Nugroho", pos: "P09", dept: "D02", mgr: "E09", joined: "2021-03-01", perf: [3, 3, 4], sk: "C01:2 C09:3" },
  { key: "E11", name: "Siti Khodijah Lubis", pos: "P09", dept: "D02", mgr: "E09", joined: "2018-10-08", perf: [4, 4, 5] },
  { key: "E12", name: "Ni Kadek Ayu Pradnyani", pos: "P09", dept: "D02", mgr: "E09", joined: "2019-02-18", perf: [5, 4, 5], sk: "C01:4 C09:1" },
  { key: "E13", name: "Teguh Prasetyo", pos: "P09", dept: "D02", mgr: "E09", joined: "2022-06-06", perf: [3, 4, 3], sk: "C03:2 C02:3n" },
  { key: "E45", name: "Sri Wahyuni", pos: "P09", dept: "D02", mgr: "E09", joined: "2020-01-13", perf: [4, 3, 4], sk: "C02:2 C09:-" },
  { key: "E49", name: "Yusuf Effendi", pos: "P09", dept: "D02", mgr: "E09", joined: "2026-06-01", perf: [3, 3, null], sk: "C01:2 C02:- C03:- C09:2" },
  { key: "E14", name: "Andreas Wenas", pos: "P10", dept: "D03", mgr: "E05", joined: "2015-10-05", perf: [4, 4, 4], sk: "C15:3" },
  { key: "E15", name: "Rini Fitriani Harahap", pos: "P11", dept: "D03", mgr: "E14", joined: "2018-05-02", perf: [5, 5, 4], sk: "C05:4 C06:4 C15:2" },
  { key: "E16", name: "Yudi Hermawan", pos: "P11", dept: "D03", mgr: "E14", joined: "2020-09-14", perf: [3, 4, 4], sk: "C04:2 C11:2n" },
  { key: "E17", name: "Meiliana Gunawan", pos: "P12", dept: "D03", mgr: "E14", joined: "2019-07-01", perf: [4, 4, 4], sk: "C06:1 C04:2" },
  { key: "E18", name: "I Made Wirawan", pos: "P12", dept: "D03", mgr: "E14", joined: "2023-01-09", perf: [3, 3, 4], sk: "C05:2 C01:-" },
  { key: "E19", name: "Joko Purnomo", pos: "P13", dept: "D04", mgr: "E05", joined: "2013-02-04", perf: [4, 3, 4], sk: "C15:3" },
  { key: "E20", name: "Febriyanti Saragih", pos: "P14", dept: "D04", mgr: "E19", joined: "2018-03-19", perf: [5, 4, 5], sk: "C17:4 C08:1" },
  { key: "E21", name: "Hendra Kurniawan", pos: "P14", dept: "D04", mgr: "E19", joined: "2020-02-10", perf: [3, 3, 3], sk: "C17:2" },
  { key: "E22", name: "Ujang Suryana", pos: "P15", dept: "D04", mgr: "E19", joined: "2017-08-21", perf: [4, 4, 4], sk: "C07:1 C04:-" },
  { key: "E23", name: "Slamet Riyadi", pos: "P15", dept: "D04", mgr: "E19", joined: "2016-05-09", perf: [3, 2, 3], sk: "C07:1 C04:-" },
  { key: "E24", name: "Robertus Lumban Tobing", pos: "P15", dept: "D04", mgr: "E19", joined: "2022-11-07", perf: [3, 3, 3], sk: "C08:2 C04:2n" },
  { key: "E46", name: "Daniel Simatupang", pos: "P15", dept: "D09", mgr: "E08", joined: "2026-03-16", perf: [3, 3, 4], sk: "C08:1" },
  { key: "E25", name: "Desi Ratnasari Pohan", pos: "P16", dept: "D05", mgr: "E06", joined: "2016-12-05", perf: [4, 4, 4], sk: "C15:2" },
  { key: "E26", name: "Aditya Pratama", pos: "P17", dept: "D05", mgr: "E25", joined: "2026-02-09", perf: [3, 3, 3], sk: "C09:2" },
  { key: "E27", name: "Wulan Septiani", pos: "P17", dept: "D05", mgr: "E25", joined: "2020-06-15", perf: [3, 4, 4], sk: "C11:1" },
  { key: "E28", name: "Stevanus Kaunang", pos: "P17", dept: "D05", mgr: "E25", joined: "2021-10-04", perf: [4, 3, null], sk: "C01:1 C11:2n" },
  { key: "E29", name: "Cut Intan Maulida", pos: "P17", dept: "D05", mgr: "E25", joined: "2019-04-22", perf: [5, 5, 5], sk: "C09:4" },
  { key: "E48", name: "Ilham Akbar Zulkarnain", pos: "P17", dept: "D05", mgr: "E25", joined: "2026-09-01", perf: [null, null, null], noSkills: true },
  { key: "E30", name: "Ferdinand Simanjuntak", pos: "P18", dept: "D06", mgr: "E03", joined: "2015-03-16", perf: [4, 4, 3], sk: "C17:2" },
  { key: "E31", name: "Vivian Halim", pos: "P19", dept: "D06", mgr: "E30", joined: "2017-01-09", perf: [5, 4, 5], sk: "C10:4 C11:4 C15:2" },
  { key: "E32", name: "Ricky Ardiansyah", pos: "P19", dept: "D06", mgr: "E30", joined: "2019-08-05", perf: [3, 3, 3], sk: "C10:2" },
  { key: "E33", name: "Annisa Zahra Nasution", pos: "P20", dept: "D06", mgr: "E30", joined: "2024-02-12", perf: [3, 4, null], sk: "C05:1" },
  { key: "E34", name: "Gede Arya Wiguna", pos: "P20", dept: "D06", mgr: "E30", joined: "2023-07-03", perf: [4, 4, 4], sk: "C10:3 C05:1" },
  { key: "E47", name: "Putri Ramadhani Syafitri", pos: "P20", dept: "D06", mgr: "E30", joined: "2026-08-03", perf: [null, 3, null], sk: "C10:- C05:-" },
  { key: "E35", name: "Linda Setiawati Tan", pos: "P21", dept: "D07", mgr: "E04", joined: "2012-11-12", perf: [4, 5, 4], sk: "C13:5" },
  { key: "E36", name: "Yosephine Mandagi", pos: "P22", dept: "D07", mgr: "E35", joined: "2018-09-03", perf: [4, 4, 4], sk: "C13:1" },
  { key: "E37", name: "Agus Mulyadi", pos: "P22", dept: "D07", mgr: "E35", joined: "2021-01-18", perf: [3, 3, 3], sk: "C12:2 C17:3n" },
  { key: "E38", name: "Fitri Handayani Koto", pos: "P23", dept: "D07", mgr: "E35", joined: "2020-04-06", perf: [4, 4, 4], sk: "C17:2n" },
  { key: "E39", name: "Rahmat Hidayat Chaniago", pos: "P24", dept: "D07", mgr: "E35", joined: "2019-03-11", perf: [4, 4, 5], sk: "C14:4" },
  { key: "E40", name: "Nurlela Sembiring", pos: "P24", dept: "D07", mgr: "E35", joined: "2022-08-01", perf: [3, 3, 2], sk: "C14:1" },
  { key: "E41", name: "Retno Wulandari", pos: "P25", dept: "D08", mgr: "E04", joined: "2014-05-19", perf: [4, 4, 4], sk: "C16:2" },
  { key: "E42", name: "Intan Permatasari", pos: "P26", dept: "D08", mgr: "E41", joined: "2019-09-16", perf: [4, 4, 5], sk: "C17:3" },
  { key: "E43", name: "Bayu Setiadi", pos: "P27", dept: "D08", mgr: "E41", joined: "2021-07-12", perf: [3, 3, 4], sk: "C20:2" },
  { key: "E44", name: "Jonathan Pangemanan", pos: "P27", dept: "D08", mgr: "E41", joined: "2023-03-06", perf: [4, 4, null], sk: "C20:4 C11:1" },
];

/** Skills re-recorded after a completed training (the gap closed only because new evidence was entered). */
const SKILL_EVIDENCE_OVERRIDES: Record<string, string> = {
  "E11:C02": "Lulus Bimtek internal penanganan jalur merah (Agu 2026); observasi atasan: 6 pemeriksaan fisik Sep 2026 selesai ≤ 3 hari kerja tanpa temuan",
  "E22:C08": "SIO Operator Forklift Kelas II Kemnaker terbit 19 Agu 2026, berlaku 5 tahun; P2H forklift 100% terisi Sep 2026",
  "E38:C13": "Lulus Brevet Pajak A & B (Agu 2026); SPT Masa PPN & PPh 23 Agustus dilaporkan tepat waktu tanpa pembetulan",
  "E10:C01": "Observasi atasan: masih perlu pendampingan saat input PIB di CEISA 4.0; 3 nota pembetulan pada Q2 2026",
  "E31:C15": "Membimbing 2 sales trainee sejak Mar 2026; belum pernah memimpin tim penuh atau menyusun target tim",
  "E15:C15": "Menjadi PIC shift malam (3 staf) saat peak season Jun 2026; belum ada pengalaman supervisi formal",
};

const EVIDENCE: Record<string, { met: readonly string[]; gap: readonly string[] }> = {
  C01: {
    met: ["Observasi atasan: menangani 120+ PIB/bulan tanpa nota pembetulan pada Q2 2026", "Lulus ujian Ahli Kepabeanan (sertifikat AK) 2019; PIC PPJK untuk 6 importir aktif", "Review 30 sampel PIB/PEB Agu 2026: 29 sesuai tanpa koreksi", "Menyusun PIB & PEB jalur hijau secara mandiri; checklist dokumen lengkap pada audit internal Jun 2026"],
    gap: ["Observasi atasan: masih perlu pendampingan untuk PIB jalur kuning; 2 nota pembetulan Agu 2026", "Baru menangani PEB; belum pernah memproses PIB secara mandiri di CEISA 4.0"],
  },
  C02: {
    met: ["Mendampingi 14 pemeriksaan fisik jalur merah Q3 2026; seluruh SPPB terbit ≤ 3 hari kerja", "Menyusun tanggapan NHI dan berita acara pemeriksaan tanpa koreksi atasan (Jul 2026)", "Rujukan tim untuk sengketa nilai pabean; 2 keberatan dikabulkan pada 2025"],
    gap: ["Observasi atasan: baru 2 kali mendampingi pemeriksaan fisik; dokumen pendukung belum disiapkan mandiri", "Rata-rata penyelesaian jalur merah 4,5 hari kerja pada Q2 2026 (standar ≤ 3 hari)"],
  },
  C03: {
    met: ["Akurasi klasifikasi HS (BTKI 2022) 98% pada sampling 50 PIB Q2 2026", "Menyusun master HS code untuk 3 klien elektronik; dipakai seluruh tim", "Lulus pelatihan klasifikasi barang BTKI 2022 (Mar 2025)"],
    gap: ["2 penetapan tarif oleh pejabat BC karena salah klasifikasi HS pada Agu 2026", "Masih bergantung pada konfirmasi senior untuk HS code produk baru (mesin & spare part)"],
  },
  C04: {
    met: ["Lulus sertifikasi IATA DGR Cat. 6 (Mar 2025), berlaku s.d. Mar 2027", "Sertifikat IMDG Code awareness (Nov 2025); 0 temuan pada audit DG gudang Q2 2026", "Menangani 40+ shipment lithium battery (UN3481) tanpa penolakan maskapai sepanjang 2026"],
    gap: ["Belum memiliki sertifikat IATA DGR; shipment DG masih diperiksa ulang oleh koordinator", "Sertifikat IATA DGR Cat. 6 kedaluwarsa Jan 2026 dan belum mengikuti recurrent"],
  },
  C05: {
    met: ["Menerbitkan 85+ HAWB/bulan; 0 amandemen karena kesalahan data pada Q3 2026", "Review dokumen L/C & BL untuk 4 klien ekspor tanpa discrepancy (Jun 2026)", "Menyusun panduan Incoterms 2020 internal untuk tim sales"],
    gap: ["Observasi atasan: masih keliru menentukan penanggung biaya pada term FCA vs FOB", "2 draft BL dikoreksi shipping line pada Agu 2026 (consignee & notify party)"],
  },
  C06: {
    met: ["Mengelola alokasi space 3 maskapai rute CGK–SIN/HKG; roll-over < 2% pada Q2 2026", "Load factor konsolidasi LCL rata-rata 88% Jul–Sep 2026", "Negosiasi block space Q4 dengan 2 co-loader; disetujui manajemen"],
    gap: ["Booking sering diajukan H-1 sehingga 3 shipment roll-over pada Agu 2026", "Belum pernah menyusun rencana konsolidasi secara mandiri"],
  },
  C07: {
    met: ["Cycle count Q3 2026: akurasi 99,7% pada 2.400 SKU", "Super-user WMS; melatih 4 operator baru modul putaway & picking", "Rekonsiliasi stok bulanan selesai H+2 sejak Mei 2026"],
    gap: ["Selisih picking 1,2% pada stock opname Jul 2026", "Belum menguasai scan putaway di WMS; lokasi rak sering salah input"],
  },
  C08: {
    met: ["SIO Operator Forklift Kelas II Kemnaker, berlaku s.d. 2029", "0 insiden selama 18 bulan; checklist P2H forklift 100% terisi pada Q3 2026", "Sertifikat Ahli K3 Umum Kemnaker (2023); memimpin safety talk mingguan"],
    gap: ["Belum ada sertifikat K3 forklift; hanya pengalaman kerja", "Near-miss tabrakan rak pada Agu 2026; P2H forklift tidak konsisten diisi"],
  },
  C09: {
    met: ["Input 300+ manifest BC 1.1/bulan di site klien; akurasi 99,6% pada Q3 2026", "Menguasai modul INSW & CEISA 4.0; rujukan tim saat gangguan host-to-host", "Lead time input rata-rata 22 menit/job (Sep 2026)"],
    gap: ["Akurasi input 97,8% pada Agu 2026; 5 koreksi pos manifest", "Masih perlu didampingi saat menangani respon reject dari CEISA"],
  },
  C10: {
    met: ["Win rate quotation 34% pada Q2 2026; margin rata-rata dijaga ≥ 12%", "Menutup kontrak tahunan 2 klien FMCG (Jun 2026) setelah negosiasi rate", "Menyusun kalkulator costing LCL/FCL yang dipakai tim sales"],
    gap: ["Win rate 18% pada Q2 2026; 4 quotation direvisi karena salah hitung surcharge", "Setiap diskon rate masih memerlukan pendampingan manager"],
  },
  C11: {
    met: ["Skor CSAT akun yang dipegang 4,6/5 (survei Jun 2026)", "Mengelola 12 key account; 0 komplain eskalasi ke direksi sepanjang 2026", "Respons email klien rata-rata < 2 jam (log CRM Q3 2026)"],
    gap: ["2 komplain klien terkait keterlambatan update status (Agu 2026)", "Interaksi klien belum konsisten dicatat di CRM"],
  },
  C12: {
    met: ["Closing bulanan selesai H+4 sejak Apr 2026; 0 jurnal koreksi auditor", "Menyusun laporan keuangan konsolidasi cabang Q2 2026 tanpa revisi", "Rekonsiliasi 6 rekening bank tepat waktu Jul–Sep 2026"],
    gap: ["Closing Agu 2026 mundur ke H+9 dengan 3 jurnal koreksi", "Belum menguasai penyusunan jurnal accrual & prepaid secara mandiri"],
  },
  C13: {
    met: ["Lulus Brevet Pajak A & B (2022); SPT Masa PPN & PPh 23 selalu tepat waktu", "Mengelola e-Faktur & e-Bupot untuk 2 entitas; 0 STP sepanjang 2026", "Pendamping pemeriksaan pajak 2025 tanpa koreksi material"],
    gap: ["Observasi atasan: masih keliru tarif PPh 23 jasa freight vs sewa; 2 pembetulan e-Bupot", "Baru memahami PPN; belum pernah menyusun SPT Masa PPh 21"],
  },
  C14: {
    met: ["Collection rate 96% pada Q3 2026; piutang > 90 hari turun dari 9% ke 4%", "Mengelola 80 akun piutang; DSO portofolio 41 hari", "Menyusun aging report mingguan untuk Finance Manager sejak Jan 2026"],
    gap: ["DSO portofolio 58 hari (Q2 2026); follow-up penagihan belum terjadwal", "Belum mampu menegosiasikan rencana cicilan dengan klien bermasalah"],
  },
  C15: {
    met: ["Engagement survey tim 2025: 82% favorable; 0 resign karyawan kunci", "Memimpin tim 8 orang; 1-on-1 bulanan terdokumentasi", "Membina 2 staf hingga promosi supervisor (2024–2025)"],
    gap: ["Observasi atasan: delegasi belum merata; 2 staf lembur > 40 jam/bulan pada Q3 2026", "Belum pernah mengikuti pelatihan kepemimpinan formal; feedback 360 skor 2,8/5"],
  },
  C16: {
    met: ["Opex divisi 2025 terealisasi 97% dari anggaran", "Menyusun RKAP 2026 divisi; disetujui tanpa revisi besar", "Renegosiasi vendor trucking menghemat 6% biaya Q2 2026"],
    gap: ["Biaya Q2 2026 melebihi anggaran 7%; belum ada analisis varians bulanan", "Belum pernah terlibat penyusunan anggaran tahunan"],
  },
  C17: {
    met: ["Membangun dashboard SLA di Power BI yang dipakai rapat mingguan", "Mahir pivot, XLOOKUP & Power Query; laporan bulanan sudah otomatis", "Analisis profitabilitas per rute Q2 2026 dipakai sebagai dasar repricing"],
    gap: ["Laporan masih disusun manual; belum menguasai pivot & lookup", "Analisis varians masih perlu dibantu rekan"],
  },
  C18: {
    met: ["Memimpin penyusunan rencana strategis 2026–2028; disetujui Dewan Komisaris", "Membuka kemitraan gudang berikat di Cikarang (2025)", "Menyusun studi kelayakan cabang Makassar (Mei 2026)"],
    gap: ["Rencana bisnis segmen e-commerce belum memuat analisis pasar & proyeksi", "Belum memimpin inisiatif ekspansi secara end-to-end"],
  },
  C19: {
    met: ["Menyusun revisi Peraturan Perusahaan 2025–2027 hingga disahkan", "Menangani 6 kasus hubungan industrial 2026 tanpa eskalasi ke mediasi", "Memahami PP 35/2021; rujukan penyusunan kontrak PKWT"],
    gap: ["Belum pernah menangani kasus PHK atau mediasi secara mandiri", "Draft PKWT masih perlu koreksi atasan"],
  },
  C20: {
    met: ["Resolusi tiket helpdesk 92% ≤ SLA (Q3 2026)", "Mengelola VPN site-to-site 3 lokasi; uptime 99,5%", "Instalasi & hardening 25 laptop baru (Jul 2026)"],
    gap: ["Belum mampu troubleshooting VPN cabang; selalu eskalasi ke vendor", "Resolusi tiket ≤ SLA 78% pada Agu 2026"],
  },
};

// ---------------------------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------------------------

const deptId = (key: string) => uid("dept", num(key));
const posId = (key: string) => uid("pos", num(key));
const empId = (key: string) => uid("emp", num(key));
const compId = (key: string) => uid("comp", num(key));

const specByKey = new Map(EMPLOYEES.map((item) => [item.key, item]));
const spec = (key: string) => {
  const found = specByKey.get(key);
  if (!found) throw new Error(`Unknown demo employee ${key}`);
  return found;
};
const nameOf = (key: string) => spec(key).name;

type ReqRow = { id: string; pos: string; comp: string; level: number; mandatory: boolean };
const REQ_ROWS: ReqRow[] = (() => {
  const rows: ReqRow[] = [];
  let n = 1;
  for (const [pos] of DEMO_POSITION_ROLES) {
    for (const token of REQUIREMENTS[pos].split(" ")) {
      const [comp, raw] = token.split(":");
      rows.push({ id: uid("req", n++), pos, comp, level: Number(raw.replace("?", "")), mandatory: !raw.endsWith("?") });
    }
  }
  return rows;
})();
const requirementId = (empKey: string, comp: string) => {
  const row = REQ_ROWS.find((item) => item.pos === spec(empKey).pos && item.comp === comp);
  if (!row) throw new Error(`No requirement ${comp} for ${empKey}`);
  return row.id;
};

function buildSkills(): EmployeeSkillReference[] {
  const skills: EmployeeSkillReference[] = [];
  let n = 1;
  for (const employee of EMPLOYEES) {
    if (employee.noSkills) continue;
    const overrides = new Map<string, string>((employee.sk ?? "").split(" ").filter(Boolean).map((token) => token.split(":") as [string, string]));
    const required = REQ_ROWS.filter((item) => item.pos === employee.pos);
    const comps = [...required.map((item) => item.comp), ...[...overrides.keys()].filter((comp) => !required.some((item) => item.comp === comp))];
    for (const comp of comps) {
      const override = overrides.get(comp);
      if (override === "-") continue;
      const requiredLevel = required.find((item) => item.comp === comp)?.level ?? 0;
      const level = override ? Number(override.replace("n", "")) : requiredLevel;
      const bank = EVIDENCE[comp];
      const evidence = override?.endsWith("n") ? null :
        SKILL_EVIDENCE_OVERRIDES[`${employee.key}:${comp}`] ?? pick(level < requiredLevel ? bank.gap : bank.met, `${employee.key}:${comp}`);
      skills.push({ id: uid("skill", n++), employeeId: empId(employee.key), competencyId: compId(comp), proficiencyLevel: level, evidenceNotes: evidence });
    }
  }
  return skills;
}

/** Employee codes follow the HRIS pattern ATI-<join year>-<sequence within year>. */
function employeeCodes(): Map<string, string> {
  const perYear = new Map<string, number>();
  const codes = new Map<string, string>();
  for (const employee of [...EMPLOYEES].sort((a, b) => a.joined.localeCompare(b.joined))) {
    const year = employee.joined.slice(0, 4);
    const seq = (perYear.get(year) ?? 0) + 1 + (hash(employee.key) % 7);
    perYear.set(year, seq);
    codes.set(employee.key, `ATI-${year}-${String(seq).padStart(3, "0")}`);
  }
  return codes;
}

function buildReference(): ReferenceDataSnapshot {
  const codes = employeeCodes();
  const departments: DepartmentReference[] = DEPARTMENTS.map(([key, code, name]) => ({ id: deptId(key), code, name }));
  const positions: PositionReference[] = DEMO_POSITION_ROLES.map(([key, code, title, dept]) => ({ id: posId(key), code, title, departmentId: deptId(dept) }));
  const employees: EmployeeReference[] = EMPLOYEES.map((item) => ({
    id: empId(item.key), employeeId: codes.get(item.key) ?? item.key, fullName: item.name, positionId: posId(item.pos), departmentId: deptId(item.dept),
  }));
  const competencies: CompetencyReference[] = COMPETENCIES.map(([key, code, name, category]) => ({ id: compId(key), code, name, category }));
  const positionRequirements: PositionRequirementReference[] = REQ_ROWS.map((row) => ({
    id: row.id, positionId: posId(row.pos), competencyId: compId(row.comp), minProficiencyLevel: row.level, isMandatory: row.mandatory,
  }));
  return { source: "fixture", departments, positions, employees, competencies, positionRequirements, employeeSkills: buildSkills() };
}

// ---------------------------------------------------------------------------------------------
// Performance evaluations (monthly, integer 1–5)
// ---------------------------------------------------------------------------------------------

type Group = "exec" | "branch" | "customs" | "freight" | "wh" | "implant" | "sales" | "finance" | "hr" | "it";
const GROUP_OF_POSITION: Record<string, Group> = {
  P01: "exec", P02: "exec", P03: "exec", P04: "exec", P05: "exec", P06: "exec", P07: "branch", P08: "customs", P09: "customs",
  P10: "freight", P11: "freight", P12: "freight", P13: "wh", P14: "wh", P15: "wh", P16: "implant", P17: "implant",
  P18: "sales", P19: "sales", P20: "sales", P21: "finance", P22: "finance", P23: "finance", P24: "finance", P25: "hr", P26: "hr", P27: "it",
};

type NoteFn = (month: string, n: number) => string;
const NOTES: Record<Group, { hi: NoteFn[]; mid: NoteFn[]; lo: NoteFn[]; ref: NoteFn[] }> = {
  exec: {
    hi: [
      (m, n) => `${m}: seluruh milestone rencana kerja bulan ini tercapai; rapat review mingguan dengan tim berjalan disiplin dan ${2 + (n % 3)} keputusan lintas divisi dieksekusi tepat waktu.`,
      (m, n) => `Pengendalian biaya ${m} baik (realisasi ${94 + (n % 5)}% dari anggaran). Proaktif mengeskalasi risiko kontrak klien besar sebelum jatuh tempo.`,
    ],
    mid: [
      (m) => `${m}: target utama tercapai, tetapi tindak lanjut hasil rapat manajemen belum terdokumentasi dan dua inisiatif bergeser ke bulan berikutnya.`,
      (m, n) => `Kinerja ${m} sesuai ekspektasi; realisasi biaya ${101 + (n % 3)}% dari anggaran, perlu analisis varians yang lebih cepat.`,
    ],
    lo: [(m) => `${m}: beberapa keputusan strategis tertunda tanpa eskalasi; perlu rencana perbaikan yang terukur.`],
    ref: [(m) => `Dashboard KPI manajemen ${m}`, (m) => `Notulen rapat direksi ${m}`],
  },
  branch: {
    hi: [
      (m, n) => `${m}: revenue cabang ${102 + (n % 8)}% dari target dan ${1 + (n % 3)} klien baru aktif. SLA handling terjaga meski ada lonjakan volume.`,
      (m) => `Koordinasi cabang dengan kantor pusat ${m} sangat baik; laporan mingguan tepat waktu dan tidak ada komplain eskalasi.`,
    ],
    mid: [
      (m, n) => `${m}: revenue cabang ${92 + (n % 6)}% dari target. Biaya trucking lokal di atas anggaran; perlu renegosiasi vendor.`,
      (m) => `Operasional cabang ${m} stabil, tetapi pipeline klien baru tipis dan laporan varians biaya terlambat.`,
    ],
    lo: [(m) => `${m}: 2 komplain klien terkait keterlambatan delivery tidak ditangani ≤ 2x24 jam. Disepakati rencana perbaikan dengan Deputy Operations Director.`],
    ref: [(m) => `Laporan bulanan cabang ${m}`, (m) => `Dashboard SLA cabang ${m}`],
  },
  customs: {
    hi: [
      (m, n) => `${m}: ${90 + n} PIB/PEB diproses, SPPB jalur hijau rata-rata < 1 hari kerja. Proaktif mengecek invoice & packing list sebelum submit.`,
      (m, n) => `Penanganan jalur merah ${m} rapi: ${2 + (n % 3)} pemeriksaan fisik selesai tepat waktu tanpa temuan. Koordinasi dengan petugas lapangan baik.`,
      (m) => `${m}: nol nota pembetulan dan aktif membagikan update PMK/Perdirjen terbaru ke tim serta klien.`,
    ],
    mid: [
      (m, n) => `Volume ${m} tercapai (${70 + n} dokumen) namun masih ada ${1 + (n % 2)} nota pembetulan karena selisih nilai CIF. Perlu double-check sebelum submit.`,
      (m) => `Kinerja ${m} cukup stabil; update regulasi terbaru belum disosialisasikan ke klien tepat waktu.`,
    ],
    lo: [(m) => `${m}: 3 nota pembetulan dan 1 keterlambatan SPPB karena dokumen klien tidak lengkap tidak dieskalasi. Disepakati rencana perbaikan.`],
    ref: [(m) => `Laporan SLA Customs ${m}`, (m) => `Rekap CEISA ${m}`],
  },
  freight: {
    hi: [
      (m, n) => `${m}: ${60 + n} HAWB/HBL terbit tepat waktu tanpa roll-over booking. Update status ke klien konsisten ≤ 4 jam.`,
      (m, n) => `Konsolidasi LCL ${m} efektif (load factor ${85 + (n % 8)}%). Negosiasi space dengan co-loader membantu menghadapi peak season.`,
    ],
    mid: [
      (m, n) => `${m}: dokumen tepat waktu tetapi ${1 + (n % 3)} shipment roll-over karena booking terlambat. Perlu perencanaan H-3.`,
      (m) => `Kinerja ${m} sesuai standar; komunikasi status shipment ke klien masih reaktif.`,
    ],
    lo: [(m) => `${m}: 1 klaim kerusakan kargo karena packing tidak dicek saat receiving dan 2 amandemen AWB. Perlu pendampingan koordinator.`],
    ref: [(m) => `Laporan OTD Freight ${m}`, (_m, n) => `Tiket CS-2026-0${700 + n}`],
  },
  wh: {
    hi: [
      (m, n) => `${m}: akurasi cycle count 99,${6 + (n % 4)}%, inbound/outbound sesuai SLA. Disiplin mengisi P2H dan menjaga area kerja (5R).`,
      (m) => `Kinerja ${m} sangat baik; membantu onboarding operator baru dan nol insiden keselamatan.`,
    ],
    mid: [
      (m, n) => `${m}: target volume tercapai, namun ada selisih ${1 + (n % 3)} SKU pada cycle count. Perlu ketelitian saat putaway.`,
      (m) => `Kinerja ${m} cukup; pengisian checklist P2H forklift belum konsisten setiap shift.`,
    ],
    lo: [(m) => `${m}: terjadi near-miss forklift di area rak C karena tidak membunyikan klakson di persimpangan. Wajib mengikuti refreshment K3.`],
    ref: [(m) => `Stock opname ${m}`, (m) => `Laporan K3 Gudang ${m}`],
  },
  implant: {
    hi: [
      (m, n) => `${m}: input ${250 + n * 3} manifest BC 1.1 di site klien dengan akurasi > 99%. Respons ke tim utama cepat saat ada reject sistem.`,
      (m) => `Kehadiran ${m} 100% di lokasi klien; klien memberi apresiasi atas kecepatan input saat gangguan host-to-host.`,
    ],
    mid: [
      (m, n) => `${m}: lead time input rata-rata ${30 + (n % 8)} menit/job, sedikit di atas standar. Akurasi baik.`,
      (m) => `Kinerja ${m} cukup; masih ada koreksi pos manifest yang terlambat dilaporkan ke koordinator.`,
    ],
    lo: [(m) => `${m}: 2 delay clearance klien akibat salah input nomor kontainer. Perlu double-check sebelum kirim.`],
    ref: [(m) => `Log akurasi manifest ${m}`, (m) => `Absensi site klien ${m}`],
  },
  sales: {
    hi: [
      (m, n) => `${m}: volume ${104 + (n % 10)}% dari target dan ${1 + (n % 2)} klien baru (FMCG & otomotif). Quotation akurat, serah terima ke ops lengkap.`,
      (m, n) => `Win rate ${m} ${30 + (n % 8)}%; berhasil mempertahankan rate kontrak klien utama tanpa diskon tambahan.`,
    ],
    mid: [
      (m, n) => `${m}: volume ${88 + (n % 8)}% dari target. Pipeline cukup, tetapi follow-up quotation sering lewat 3 hari.`,
      (m) => `Kinerja ${m} cukup; 2 quotation direvisi karena surcharge THC/LSS terlewat.`,
    ],
    lo: [(m) => `${m}: volume jauh di bawah target dan 1 order diserahkan ke ops tanpa dokumen lengkap. Perlu coaching mingguan.`],
    ref: [(m) => `Pipeline CRM ${m}`, (m) => `Laporan sales bulanan ${m}`],
  },
  finance: {
    hi: [
      (m, n) => `${m}: closing selesai H+${3 + (n % 2)}, rekonsiliasi bank tanpa selisih. Invoice terbit < 24 jam setelah job close.`,
      (m) => `Kinerja ${m} sangat baik; kepatuhan pajak terjaga dan arsip keuangan siap audit.`,
    ],
    mid: [
      (m, n) => `${m}: pekerjaan rutin selesai, namun ${1 + (n % 3)} jurnal koreksi saat closing. Perlu checklist sebelum posting.`,
      (m) => `Kinerja ${m} cukup; follow-up dokumen pendukung reimbursement masih lambat.`,
    ],
    lo: [(m) => `${m}: piutang > 90 hari naik menjadi 11% dan follow-up penagihan ke 4 klien besar tidak terdokumentasi.`],
    ref: [(m) => `Closing report ${m}`, (m) => `Aging AR ${m}`],
  },
  hr: {
    hi: [
      (m, n) => `${m}: ${3 + (n % 4)} posisi terisi sesuai SLA rekrutmen dan seluruh kasus hubungan industrial selesai tanpa eskalasi.`,
      (m) => `Kinerja ${m} sangat baik; menjadi mitra yang responsif bagi manager operasional dalam penyusunan rencana pengembangan.`,
    ],
    mid: [
      (m) => `${m}: administrasi HC tepat waktu, tetapi rekap kebutuhan training per departemen belum lengkap.`,
      (m) => `Kinerja ${m} cukup; perlu mempercepat penyelesaian kontrak PKWT yang akan berakhir.`,
    ],
    lo: [(m) => `${m}: beberapa dokumen kontrak terlambat diperbarui. Disepakati checklist mingguan.`],
    ref: [(m) => `Laporan HC bulanan ${m}`],
  },
  it: {
    hi: [
      (m, n) => `${m}: ${120 + n * 2} tiket helpdesk, ${92 + (n % 6)}% selesai ≤ SLA. Migrasi email cabang berjalan tanpa downtime.`,
      (m) => `Kinerja ${m} sangat baik; backup harian terverifikasi dan inventaris aset IT diperbarui.`,
    ],
    mid: [
      (m, n) => `${m}: ${80 + (n % 10)}% tiket selesai ≤ SLA; gangguan VPN cabang masih bergantung pada vendor.`,
      (m) => `Kinerja ${m} cukup; dokumentasi penyelesaian tiket belum konsisten.`,
    ],
    lo: [(m) => `${m}: 2 insiden jaringan cabang tidak dieskalasi tepat waktu.`],
    ref: [(m) => `Helpdesk report ${m}`, (_m, n) => `Tiket IT-2026-0${400 + n}`],
  },
};

const MONTH_NAME: Record<string, string> = { "2026-07": "Juli 2026", "2026-08": "Agustus 2026", "2026-09": "September 2026" };
const MONTH_SHORT: Record<string, string> = { "2026-07": "Jul 2026", "2026-08": "Agu 2026", "2026-09": "Sep 2026" };
const PERF_PERIODS = ["2026-07", "2026-08", "2026-09"] as const;
const NEXT_MONTH: Record<string, string> = { "2026-07": "2026-08", "2026-08": "2026-09", "2026-09": "2026-10" };

/** Specific notes for records that development needs or the demo story refer to. */
const PERF_NOTE_OVERRIDES: Record<string, string> = {
  "E10:2026-07": "Juli 2026: 78 PIB/PEB diproses; 2 nota pembetulan karena nilai CIF tidak sesuai invoice. Masih perlu pendampingan untuk input PIB jalur kuning di CEISA 4.0.",
  "E10:2026-08": "Agustus 2026: volume 84 dokumen tercapai, tetapi 3 nota pembetulan (HS code & nilai pabean). Rekomendasi: workshop CEISA 4.0 dan double-check sebelum submit.",
  "E10:2026-09": "September 2026: nol nota pembetulan setelah menerapkan checklist pra-submit; mulai menangani PIB jalur kuning dengan pendampingan minimal. Lanjutkan mentoring jalur merah.",
  "E23:2026-08": "Agustus 2026: near-miss forklift di area rak C (tidak membunyikan klakson di persimpangan) dan P2H tidak diisi 4 shift. Wajib refreshment K3 sebelum kembali mengoperasikan forklift penuh.",
  "E27:2026-07": "Juli 2026: akurasi input manifest 97,6% (target 99%); 3 koreksi pos manifest BC 1.1 terlambat dilaporkan. Rekomendasi: refresher input manifest & modul INSW.",
  "E40:2026-09": "September 2026: piutang > 90 hari naik menjadi 11% dan follow-up penagihan ke 4 klien besar tidak terdokumentasi di aging report. Perlu rencana penagihan mingguan.",
  "E31:2026-09": "September 2026: volume 118% dari target dan 2 klien baru (otomotif). Mulai mendampingi 2 sales trainee; kandidat Sales Manager pada rencana suksesi.",
};

const reviewStatusFor = (score: number): ReviewStatus => score >= 4 ? "On Track" : score <= 2 ? "Needs Attention" : "Needs Review";

function evaluatorKeyFor(employee: EmployeeSpec): string {
  if (!employee.mgr) throw new Error(`${employee.key} has no evaluator`);
  return employee.mgr;
}

function buildPerformance(): PerformanceEvaluation[] {
  const records: PerformanceEvaluation[] = [];
  let n = 1;
  for (const employee of EMPLOYEES) {
    PERF_PERIODS.forEach((period, index) => {
      const score = employee.perf[index];
      if (score === null) return;
      const group = GROUP_OF_POSITION[employee.pos];
      const bank = NOTES[group];
      const seed = `${employee.key}:${period}`;
      const r = Math.floor(rand(seed) * 20);
      const notes = PERF_NOTE_OVERRIDES[seed] ?? pick(score >= 4 ? bank.hi : score === 3 ? bank.mid : bank.lo, seed)(MONTH_NAME[period], r);
      const day = 1 + (hash(seed) % 5);
      const date = `${NEXT_MONTH[period]}-0${period === "2026-09" ? Math.min(day, 3) : day}`;
      const evaluator = nameOf(evaluatorKeyFor(employee));
      const evidenceReference = rand(`${seed}:ref`) < 0.45 ? pick(bank.ref, seed)(MONTH_SHORT[period], r) : null;
      records.push({
        id: uid("perf", n++), source: "fixture", employeeId: empId(employee.key), period, evaluationDate: date, evaluator,
        status: "completed", reviewStatus: reviewStatusFor(score), overallScore: score, aspects: [], generalNotes: notes, evidenceReference,
        createdAt: at(`${date} ${String(9 + (hash(seed) % 7)).padStart(2, "0")}:${String(hash(`${seed}m`) % 60).padStart(2, "0")}`), actor: evaluator,
      });
    });
  }
  // Revision: Yosephine's August evaluation was corrected after the bank reconciliation was clarified.
  const original = records.find((item) => item.employeeId === empId("E36") && item.period === "2026-08");
  if (original) {
    const index = records.indexOf(original);
    records[index] = {
      ...original, overallScore: 3, reviewStatus: "Needs Review",
      generalNotes: "Agustus 2026: selisih rekonsiliasi rekening operasional Rp 18,4 juta belum terselesaikan saat closing; 2 jurnal koreksi.",
      evidenceReference: "Closing report Agu 2026",
    };
    const evaluator = nameOf("E35");
    records.push({
      ...original, id: uid("perf", n++), overallScore: 4, reviewStatus: "On Track", evaluationDate: "2026-09-08",
      generalNotes: "Revisi atas evaluasi 2026-08: selisih rekonsiliasi Rp 18,4 juta ternyata berasal dari biaya administrasi bank yang terlambat dibukukan bank (konfirmasi bank 7 Sep 2026), bukan kesalahan input. Nilai dikoreksi dari 3 menjadi 4.",
      evidenceReference: "Surat konfirmasi bank 07-09-2026", createdAt: at("2026-09-08 14:20"), actor: evaluator, evaluator,
    });
  }
  return records;
}

// ---------------------------------------------------------------------------------------------
// KPI scorecards (quarterly, KPI V5.1)
// ---------------------------------------------------------------------------------------------

const catalog = selectCatalog(KPI_V51_CATALOG);
type Indicator = { target: string; actual: (score: number, r: number) => string };
const pct = (values: readonly number[], suffix = "", decimals = 1, jitter = 0.8, max = 100): Indicator["actual"] =>
  (score, r) => `${idNum(Math.min(max, values[score - 1] + (r - 0.5) * jitter), decimals)}%${suffix}`;
const val = (values: readonly number[], unit: string, decimals = 0, jitter = 0): Indicator["actual"] =>
  (score, r) => `${idNum(values[score - 1] + (r - 0.5) * jitter, decimals)}${unit}`;
const text = (values: readonly string[]): Indicator["actual"] => (score) => values[score - 1];

const KPI_TEXT: Record<number, readonly Indicator[]> = {
  1: [
    { target: "100% target laba bersih kuartal", actual: pct([78, 88, 97, 103, 112], " dari target", 1, 2, 200) },
    { target: "≥ 12% YoY", actual: pct([4.1, 7.8, 10.9, 12.6, 15.3], " YoY", 1, 0.6) },
    { target: "2 kemitraan/layanan baru per semester", actual: text(["Belum ada inisiatif berjalan", "1 MoU, belum operasional", "1 kemitraan aktif", "2 kemitraan aktif (co-loader Batam, gudang berikat Cikarang)", "3 kemitraan aktif + 1 layanan baru"]) },
    { target: "≥ 90% karyawan kunci bertahan", actual: pct([78, 84, 89, 93, 97], "", 0, 1) },
    { target: "0 temuan material audit/regulator", actual: text(["2 temuan material", "1 temuan material", "0 material; 3 temuan minor", "0 material; 1 temuan minor", "0 temuan"]) },
  ],
  2: [
    { target: "100% target pendapatan divisi", actual: pct([81, 89, 97, 102, 109], " dari target", 1, 2, 200) },
    { target: "≥ 90% milestone tepat waktu", actual: pct([60, 72, 85, 92, 98], " milestone", 0, 2) },
    { target: "Opex ≤ 100% anggaran", actual: pct([109, 104, 100.5, 97.8, 94.2], " dari anggaran", 1, 1, 200) },
    { target: "CSAT ≥ 4,3 / 5", actual: val([3.7, 3.9, 4.2, 4.4, 4.6], " / 5", 1, 0.08) },
    { target: "1 inisiatif layanan/proses baru per kuartal", actual: text(["Belum ada inisiatif", "Konsep disusun, belum pilot", "1 pilot berjalan", "1 inisiatif live", "2 inisiatif live"]) },
  ],
  3: [
    { target: "≥ 95% on-time delivery", actual: pct([86.5, 90.8, 93.9, 96.2, 98.4]) },
    { target: "0 denda/penalti fatal", actual: text(["2 denda (SPKTNP)", "1 denda administrasi", "0 fatal; 2 teguran", "0 fatal; 1 teguran", "0 denda/teguran"]) },
    { target: "Utilisasi armada & vendor ≥ 85%", actual: pct([71, 77, 83, 87, 91], "", 0, 1.5) },
    { target: "≥ 90% komplain selesai ≤ 2x24 jam", actual: pct([74, 82, 88, 93, 97], "", 0, 1.5) },
    { target: "Indeks produktivitas ≥ 100", actual: val([88, 94, 99, 104, 110], "", 0, 2) },
  ],
  4: [
    { target: "100% target revenue cabang", actual: pct([79, 88, 97, 103, 111], " dari target", 1, 2, 200) },
    { target: "≥ 4 klien baru per kuartal", actual: val([1, 2, 3, 4, 6], " klien baru") },
    { target: "Biaya cabang ≤ 100% anggaran", actual: pct([111, 105, 100.4, 97.5, 93.8], " dari anggaran", 1, 1, 200) },
    { target: "≥ 92% job sesuai SLA handling", actual: pct([80, 86, 91, 94, 97], "", 1, 1) },
    { target: "Turnover ≤ 5% per kuartal", actual: text(["Turnover 12%", "Turnover 9%", "Turnover 6%", "Turnover 4%", "Turnover 0%"]) },
  ],
  5: [
    { target: "≥ 95% SPPB jalur hijau ≤ 1 hari kerja", actual: pct([84.2, 89.6, 93.4, 96.1, 98.7]) },
    { target: "0 nota pembetulan", actual: text(["4 nota pembetulan", "3 nota pembetulan", "1 nota pembetulan", "0 nota pembetulan; 1 koreksi internal", "0 nota pembetulan"]) },
    { target: "PMK/Perdirjen baru disosialisasikan ≤ 7 hari", actual: text(["2 regulasi terlambat disosialisasikan", "1 regulasi terlambat", "Rata-rata 7 hari", "Rata-rata 4 hari", "≤ 2 hari + ringkasan tertulis ke klien"]) },
    { target: "0 keterlambatan pemeriksaan karena koordinasi", actual: text(["3 kasus keterlambatan", "2 kasus keterlambatan", "1 kasus keterlambatan", "0 kasus", "0 kasus; apresiasi tertulis klien"]) },
    { target: "Jalur merah selesai ≤ 3 hari kerja", actual: val([5.2, 4.1, 3.0, 2.4, 1.8], " hari kerja (rata-rata)", 1, 0.2) },
  ],
  6: [
    { target: "≥ 97% booking tanpa roll-over", actual: pct([88, 92.5, 96, 97.8, 99.2]) },
    { target: "≥ 98% AWB/BL terbit ≤ H-1 ETD", actual: pct([89, 93, 96.5, 98.4, 99.6], "", 1, 0.6) },
    { target: "Load factor konsolidasi ≥ 85%", actual: pct([70, 76, 82, 87, 92], "", 0, 2) },
    { target: "0 klaim kerusakan/kehilangan", actual: text(["3 klaim", "2 klaim", "1 klaim minor", "0 klaim", "0 klaim; 0 amandemen"]) },
    { target: "≥ 95% update status ≤ 4 jam setelah milestone", actual: pct([80, 86, 92, 96, 99], "", 0, 1.5) },
  ],
  7: [
    { target: "≥ 99,5% akurasi cycle count", actual: pct([97.1, 98.2, 99.1, 99.6, 99.9], "", 1, 0.1) },
    { target: "≥ 95% inbound ≤ 4 jam / outbound ≤ 6 jam", actual: pct([85, 89, 93, 96, 98.5]) },
    { target: "0 insiden / LTI", actual: text(["1 LTI (lost time injury)", "2 near-miss tidak dilaporkan", "1 near-miss, dilaporkan", "0 insiden; 2 near-miss dilaporkan", "0 insiden; safety talk 100%"]) },
    { target: "100% DG sesuai segregasi IMDG/IATA", actual: text(["88% sesuai segregasi", "93% sesuai segregasi", "97% sesuai segregasi", "100% sesuai segregasi", "100%; audit DG tanpa temuan"]) },
    { target: "Utilisasi rak 80–90%", actual: pct([68, 74, 79, 85, 88], "", 0, 2) },
  ],
  8: [
    { target: "≥ 99% data BC 1.1 tanpa koreksi", actual: pct([95.2, 97.0, 98.4, 99.2, 99.8], "", 1, 0.2) },
    { target: "≤ 30 menit per job", actual: val([52, 43, 34, 27, 21], " menit/job", 0, 3) },
    { target: "≥ 98% kehadiran di site klien", actual: pct([91, 94, 97, 99, 100], "", 0, 0.8) },
    { target: "0 delay akibat salah input", actual: text(["3 kasus delay", "2 kasus delay", "1 kasus delay", "0 kasus", "0 kasus; 0 koreksi"]) },
    { target: "Respons ke tim utama ≤ 15 menit", actual: val([41, 28, 18, 12, 8], " menit (rata-rata)", 0, 3) },
  ],
  9: [
    { target: "100% target volume (TEU/ton)", actual: pct([72, 85, 96, 104, 118], " dari target", 0, 3, 200) },
    { target: "≥ 3 klien baru aktif per kuartal", actual: val([0, 1, 2, 3, 5], " klien baru") },
    { target: "≥ 95% quotation tanpa revisi harga", actual: pct([82, 88, 93, 96, 99], "", 0, 1.5) },
    { target: "Win rate ≥ 30%", actual: pct([14, 21, 27, 32, 38], "", 0, 2) },
    { target: "≥ 95% order lengkap saat serah terima ke ops", actual: pct([80, 87, 92, 96, 99], "", 0, 1.5) },
  ],
  10: [
    { target: "≥ 95% invoice < 24 jam setelah job close", actual: pct([78, 86, 93, 96.5, 99]) },
    { target: "0 jurnal koreksi material saat closing", actual: text(["4 jurnal koreksi", "2 jurnal koreksi", "1 jurnal koreksi", "0 koreksi material", "0 koreksi; closing H+3"]) },
    { target: "≥ 95% pembayaran vendor/reimburse tepat tanggal", actual: pct([81, 88, 93, 97, 99.5]) },
    { target: "DSO ≤ 45 hari", actual: val([62, 54, 47, 43, 39], " hari (DSO)", 0, 2) },
    { target: "SPT Masa tepat waktu; arsip lengkap 100%", actual: text(["1 SPT Masa terlambat", "Tepat waktu; arsip lengkap 85%", "Tepat waktu; arsip 93%", "Tepat waktu; arsip 98%", "Tepat waktu; arsip 100%, siap audit"]) },
  ],
};

const KPI_PERIODS: readonly { period: string; start: string; evalDate: string }[] = [
  { period: "2026-03", start: "2026-01-01", evalDate: "2026-04-0" },
  { period: "2026-06", start: "2026-04-01", evalDate: "2026-07-0" },
  { period: "2026-09", start: "2026-07-01", evalDate: "2026-10-0" },
];
/** Not yet evaluated for 2026-09 (no record — there is no draft state). */
const KPI_PENDING_SEP = new Set(["E28", "E33", "E44"]);

export function demoKpiTotal(lines: readonly KpiAssessmentLine[]): number | null {
  if (lines.some((line) => line.raw_score === null)) return null;
  return Math.round(lines.reduce((sum, line) => sum + line.weight_percent * (line.raw_score ?? 0) / 100, 0) * 100) / 100;
}

const KPI_SUMMARY = (avg: number, period: string) => {
  const quarter = { "2026-03": "Q1", "2026-06": "Q2", "2026-09": "Q3" }[period] ?? period;
  if (avg >= 4.2) return `${quarter} 2026: melampaui target pada mayoritas indikator. Pertahankan dan bagikan praktik baik ke tim.`;
  if (avg >= 3.5) return `${quarter} 2026: sebagian besar indikator tercapai; fokus perbaikan pada indikator dengan skor di bawah 4.`;
  if (avg >= 2.8) return `${quarter} 2026: pencapaian cukup; beberapa indikator di bawah target dan dibahas dalam 1-on-1 bulanan.`;
  return `${quarter} 2026: mayoritas indikator di bawah target; disusun rencana perbaikan dengan tenggat jelas.`;
};

function kpiLines(empKey: string, roleOrder: number, period: string, base: number, forced: Record<number, number> = {}, forcedActual: Record<number, string> = {}): KpiAssessmentLine[] {
  return indicatorsFor(catalog, roleOrder).map((row, index) => {
    const seed = `${empKey}:${period}:${row.indicator_order}`;
    const r = rand(seed);
    const score = forced[row.indicator_order] ?? clamp(base + (r < 0.2 ? -1 : r > 0.82 ? 1 : 0));
    const indicator = KPI_TEXT[roleOrder][index];
    return {
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent,
      target: indicator.target, actual: forcedActual[row.indicator_order] ?? indicator.actual(score, rand(`${seed}:a`)), raw_score: score,
      comment: score <= 2 ? "Di bawah target; dibahas pada 1-on-1 dan masuk rencana pengembangan." : score === 5 ? "Melampaui target periode." : "",
    };
  });
}

function buildKpi(): KpiAssessment[] {
  const records: KpiAssessment[] = [];
  let n = 1;
  const positionTitle = new Map(DEMO_POSITION_ROLES.map(([key, , title]) => [key, title]));
  for (const employee of EMPLOYEES) {
    const roleOrder = roleForPositionTitle(catalog, positionTitle.get(employee.pos));
    if (!roleOrder) continue;
    const scores = employee.perf.filter((item): item is number => item !== null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 4;
    for (const quarter of KPI_PERIODS) {
      if (employee.joined > quarter.start) continue;
      if (quarter.period === "2026-09" && KPI_PENDING_SEP.has(employee.key)) continue;
      const base = clamp(Math.round(avg + (quarter.period === "2026-03" ? -0.3 : 0)));
      const seed = `${employee.key}:${quarter.period}`;
      const isRevisionCase = employee.key === "E10" && quarter.period === "2026-06";
      const lines = kpiLines(employee.key, roleOrder, quarter.period, base, isRevisionCase ? { 2: 2 } : {}, isRevisionCase ? { 2: "3 nota pembetulan" } : {});
      const day = quarter.period === "2026-09" ? 1 + (hash(seed) % 3) : 1 + (hash(seed) % 6);
      const evaluationDate = `${quarter.evalDate}${day}`;
      // The CEO has no evaluator inside the company: Human Capital records the Board of Commissioners' assessment.
      const evaluator = employee.mgr ? nameOf(employee.mgr) : nameOf("E41");
      const lineAvg = lines.reduce((sum, line) => sum + (line.raw_score ?? 0), 0) / lines.length;
      const generalNotes = employee.mgr ? KPI_SUMMARY(lineAvg, quarter.period) :
        `${KPI_SUMMARY(lineAvg, quarter.period)} Penilaian ditetapkan Dewan Komisaris dalam rapat evaluasi kuartalan; diinput oleh Human Capital.`;
      records.push({
        id: uid("kpi", n++), definitionVersion: catalog.version, employeeId: empId(employee.key), roleOrder, roleName: indicatorsFor(catalog, roleOrder)[0].role_name,
        period: quarter.period, evaluationDate, evaluatorName: evaluator, status: "completed", lines, overallScore: demoKpiTotal(lines),
        generalNotes, createdAt: at(`${evaluationDate} ${String(9 + (hash(seed) % 8)).padStart(2, "0")}:${String(hash(`${seed}m`) % 60).padStart(2, "0")}`), actor: evaluator,
      });
      if (isRevisionCase) {
        const corrected = lines.map((line) => line.indicator_order === 2 ? { ...line, raw_score: 3, actual: "1 nota pembetulan", comment: "Dikoreksi setelah rekonsiliasi data CEISA." } : line);
        records.push({
          ...records[records.length - 1], id: uid("kpi", n++), lines: corrected, overallScore: demoKpiTotal(corrected), evaluationDate: "2026-07-10",
          generalNotes: "Revisi atas scorecard Q2 2026: indikator Akurasi Dokumen dikoreksi dari 3 menjadi 1 nota pembetulan setelah rekonsiliasi dengan data CEISA (2 nota merupakan job tim Surabaya yang salah atribusi PIC).",
          createdAt: at("2026-07-10 15:05"),
        });
      }
    }
  }
  return records;
}

// ---------------------------------------------------------------------------------------------
// Competency assessments (saved snapshots, computed with compareCompetencies)
// ---------------------------------------------------------------------------------------------

/** [key, employee, target position (null = current position), effective date, saved at (WIB), actor]. */
const ASSESSMENTS: readonly [string, string, string | null, string, string, string][] = [
  ["A01", "E10", null, "2026-09-29", "2026-09-29 10:15", "E09"],
  ["A02", "E09", null, "2026-09-22", "2026-09-22 14:00", "E42"],
  ["A03", "E11", null, "2026-09-12", "2026-09-12 09:40", "E09"],
  ["A04", "E13", null, "2026-09-28", "2026-09-28 11:20", "E09"],
  ["A05", "E16", null, "2026-09-18", "2026-09-18 13:30", "E14"],
  ["A06", "E21", null, "2026-09-10", "2026-09-10 10:05", "E19"],
  ["A07", "E22", null, "2026-08-26", "2026-08-26 15:10", "E19"],
  ["A08", "E24", null, "2026-09-03", "2026-09-03 09:00", "E19"],
  ["A09", "E26", null, "2026-09-25", "2026-09-25 10:30", "E25"],
  ["A10", "E31", null, "2026-08-18", "2026-08-18 16:00", "E30"],
  ["A11", "E32", null, "2026-08-03", "2026-08-03 11:45", "E30"],
  ["A12", "E37", null, "2026-08-10", "2026-08-10 14:25", "E35"],
  ["A13", "E38", null, "2026-09-04", "2026-09-04 10:50", "E35"],
  ["A14", "E43", null, "2026-08-24", "2026-08-24 13:15", "E41"],
  ["A15", "E48", null, "2026-10-01", "2026-10-01 09:30", "E42"],
  ["A16", "E49", null, "2026-09-30", "2026-09-30 15:40", "E09"],
  // Role change: planned promotions assessed against the target position.
  ["R01", "E31", "P18", "2026-08-20", "2026-08-20 10:00", "E42"],
  ["R02", "E15", "P10", "2026-09-15", "2026-09-15 14:30", "E42"],
];
const assessmentId = (key: string) => uid("assess", ASSESSMENTS.findIndex(([item]) => item === key) + 1);

function buildAssessments(reference: ReferenceDataSnapshot): CompetencyAssessment[] {
  return ASSESSMENTS.map(([key, emp, target, effectiveDate, savedAt, actor]) => {
    const positionId = posId(target ?? spec(emp).pos);
    const comparison = compareCompetencies(empId(emp), positionId, reference);
    return {
      id: assessmentId(key), source: "local-demo", employeeId: empId(emp), positionId, effectiveDate,
      context: target ? "role-change" : "current-position", findings: comparison.findings, overallStatus: comparison.overallStatus,
      createdAt: at(savedAt), actor: nameOf(actor),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Development needs and training
// ---------------------------------------------------------------------------------------------

type NeedRev = readonly [status: DevelopmentStatus, savedAt: string, actor: string, notes: string];
interface NeedSpec {
  readonly key: string;
  readonly emp: string;
  readonly type: DevelopmentSourceType;
  /** competency key (gap), assessment key (role change) or performance period. */
  readonly ref: string;
  readonly objective: string;
  readonly priority: DevelopmentPriority;
  readonly revs: readonly NeedRev[];
}

const NEEDS: readonly NeedSpec[] = [
  { key: "N01", emp: "E10", type: "competency_gap", ref: "C01", priority: "High",
    objective: "Mencapai level 3 Customs Clearance & Regulation: menyusun PIB jalur hijau & kuning di CEISA 4.0 secara mandiri dengan 0 nota pembetulan selama 2 bulan berturut-turut sebelum 31 Des 2026.",
    revs: [
      ["Identified", "2026-07-08 10:00", "E09", "Gap dari observasi Q2: 3 nota pembetulan, masih perlu pendampingan input PIB."],
      ["Planned", "2026-07-15 14:30", "E42", "Didaftarkan ke Workshop CEISA 4.0 batch September + mentoring jalur merah oleh Customs Clearance & PPJK Manager."],
      ["In Progress", "2026-09-02 09:15", "E42", "Workshop dimulai 10 Sep 2026. Progres dipantau melalui jumlah nota pembetulan bulanan."],
    ] },
  { key: "N02", emp: "E10", type: "performance_context", ref: "2026-08", priority: "Medium",
    objective: "Menurunkan nota pembetulan dari 3 menjadi 0 per bulan pada Q4 2026 dengan checklist pra-submit (HS code, nilai CIF, kurs NDPBM).",
    revs: [
      ["Identified", "2026-09-09 11:00", "E09", "Dari evaluasi Agustus 2026 (3 nota pembetulan)."],
      ["Planned", "2026-09-16 10:20", "E09", "Checklist pra-submit disepakati; review mingguan setiap Jumat bersama atasan."],
    ] },
  { key: "N03", emp: "E13", type: "competency_gap", ref: "C03", priority: "Medium",
    objective: "Mencapai level 3 klasifikasi HS code: akurasi ≥ 98% pada sampling 30 PIB per bulan untuk produk mesin & spare part pada Q1 2027.",
    revs: [["Identified", "2026-09-28 13:00", "E09", "Dari assessment 28 Sep 2026; 2 penetapan tarif oleh pejabat BC pada Agustus."]] },
  { key: "N04", emp: "E11", type: "competency_gap", ref: "C02", priority: "High",
    objective: "Mencapai level 3 penanganan jalur merah: menyiapkan dokumen pendukung & mendampingi pemeriksaan fisik secara mandiri, SPPB ≤ 3 hari kerja.",
    revs: [
      ["Identified", "2026-06-10 09:30", "E09", "Rata-rata jalur merah Q1 4,5 hari kerja."],
      ["Planned", "2026-06-20 10:00", "E42", "Bimtek internal dijadwalkan awal Agustus."],
      ["In Progress", "2026-08-05 08:45", "E42", "Bimtek berjalan 6–8 Agustus 2026."],
      ["Completed", "2026-09-12 16:10", "E09", "Bimtek selesai; observasi 6 pemeriksaan fisik Sep 2026 tanpa temuan. Skill dicatat ulang level 3 pada 10 Sep 2026."],
    ] },
  { key: "N05", emp: "E15", type: "role_change", ref: "R02", priority: "High",
    objective: "Menyiapkan promosi ke Freight Operations Manager: menutup gap People Leadership (level 2 → 4) melalui program supervisori dan memimpin tim konsolidasi Q1 2027.",
    revs: [
      ["Identified", "2026-09-16 09:00", "E42", "Dari assessment perubahan posisi 15 Sep 2026."],
      ["Planned", "2026-09-24 15:30", "E42", "Didaftarkan Supervisory Development Program batch Q4 2026."],
    ] },
  { key: "N06", emp: "E31", type: "role_change", ref: "R01", priority: "High",
    objective: "Menyiapkan promosi ke Sales Manager: People Leadership level 4 dan Data Analysis level 3 (menyusun forecast & pipeline tim) sebelum review suksesi Maret 2027.",
    revs: [
      ["Identified", "2026-08-21 10:00", "E42", "Dari assessment perubahan posisi 20 Agu 2026."],
      ["Planned", "2026-08-28 13:40", "E30", "Coaching negosiasi B2B & key account (6 sesi) + leadership essentials."],
      ["In Progress", "2026-09-08 09:00", "E42", "Coaching sesi 1 berjalan; mendampingi 2 sales trainee sebagai praktik."],
    ] },
  { key: "N07", emp: "E16", type: "competency_gap", ref: "C04", priority: "High",
    objective: "Memiliki sertifikat IATA DGR Kategori 6 dan menangani shipment DG (UN3480/UN3481) tanpa pemeriksaan ulang koordinator mulai Nov 2026.",
    revs: [
      ["Identified", "2026-07-20 11:10", "E14", "Shipment DG masih diperiksa ulang; risiko penolakan maskapai."],
      ["Planned", "2026-07-27 10:00", "E42", "Didaftarkan IATA DGR Cat. 6 Initial batch September."],
      ["In Progress", "2026-09-21 08:30", "E42", "Pelatihan 5 hari dimulai 21 Sep 2026."],
      ["In Progress", "2026-10-01 10:00", "E42", "Training selesai (sertifikat terbit 29 Sep 2026). Skill belum diperbarui; menunggu verifikasi sertifikat oleh HR sebelum reassessment."],
    ] },
  { key: "N08", emp: "E22", type: "competency_gap", ref: "C08", priority: "High",
    objective: "Memiliki SIO Operator Forklift Kemnaker (Kelas II) sebagai syarat legal mengoperasikan forklift ≥ 3 ton paling lambat Agustus 2026.",
    revs: [
      ["Identified", "2026-05-11 09:00", "E19", "Belum memiliki SIO; temuan audit K3 internal Mei 2026."],
      ["Planned", "2026-05-18 14:00", "E42", "Didaftarkan sertifikasi SIO batch Agustus."],
      ["In Progress", "2026-08-12 08:00", "E42", "Sertifikasi berlangsung 12–14 Agustus."],
      ["Completed", "2026-08-26 15:30", "E19", "SIO terbit 19 Agu 2026; skill dicatat ulang level 3 dengan bukti SIO."],
    ] },
  { key: "N09", emp: "E24", type: "competency_gap", ref: "C08", priority: "High",
    objective: "Memiliki SIO Operator Forklift Kemnaker dan 0 near-miss selama 3 bulan setelah sertifikasi (target Feb 2027).",
    revs: [
      ["Identified", "2026-09-03 10:00", "E19", "Dari assessment 3 Sep 2026; belum ada sertifikat K3 forklift."],
      ["Planned", "2026-09-10 11:30", "E42", "Didaftarkan sertifikasi SIO batch November 2026."],
    ] },
  { key: "N10", emp: "E23", type: "performance_context", ref: "2026-08", priority: "High",
    objective: "0 near-miss dan P2H forklift 100% terisi setiap shift selama Okt–Des 2026.",
    revs: [
      ["Identified", "2026-09-07 09:20", "E19", "Dari evaluasi Agustus 2026: near-miss di area rak C."],
      ["In Progress", "2026-09-14 13:00", "E19", "Refreshment K3 dijadwalkan 18 Sep; P2H dipantau harian oleh leader shift."],
    ] },
  { key: "N11", emp: "E21", type: "competency_gap", ref: "C17", priority: "Medium",
    objective: "Mencapai level 3 Data Analysis: menyusun laporan varians stok bulanan otomatis (pivot, XLOOKUP, Power BI) tanpa bantuan rekan sebelum Des 2026.",
    revs: [
      ["Identified", "2026-07-01 10:00", "E19", "Laporan varians stok masih manual dan memerlukan bantuan."],
      ["Planned", "2026-07-08 15:00", "E42", "Workshop Excel lanjutan & Power BI."],
    ] },
  { key: "N12", emp: "E26", type: "competency_gap", ref: "C09", priority: "Medium",
    objective: "Mencapai akurasi input manifest BC 1.1 ≥ 99% dan menangani respon reject CEISA secara mandiri pada akhir masa orientasi (Des 2026).",
    revs: [["Identified", "2026-09-25 11:00", "E25", "Dari assessment 25 Sep 2026; akurasi Agustus 97,8%."]] },
  { key: "N13", emp: "E27", type: "performance_context", ref: "2026-07", priority: "Medium",
    objective: "Akurasi input manifest ≥ 99% dan koreksi pos dilaporkan ≤ 15 menit ke koordinator mulai Agustus 2026.",
    revs: [
      ["Identified", "2026-08-06 10:30", "E25", "Dari evaluasi Juli 2026: akurasi 97,6%."],
      ["Planned", "2026-08-10 09:00", "E42", "Refresher input manifest & modul INSW 20 Agustus."],
      ["Completed", "2026-09-15 14:00", "E25", "Akurasi Agustus 99,3% dan September 99,5%; target tercapai."],
    ] },
  { key: "N14", emp: "E32", type: "competency_gap", ref: "C10", priority: "High",
    objective: "Mencapai level 3 Negotiation & Quotation Pricing: win rate ≥ 30% dan 0 quotation direvisi karena salah hitung surcharge pada Q4 2026.",
    revs: [
      ["Identified", "2026-08-03 13:00", "E30", "Dari assessment 3 Agu 2026; win rate Q2 18%."],
      ["Planned", "2026-08-10 10:00", "E42", "Workshop costing & quotation pricing batch September."],
      ["In Progress", "2026-09-15 09:00", "E42", "Workshop berjalan; praktik quotation dipantau Sales Manager."],
    ] },
  { key: "N15", emp: "E33", type: "competency_gap", ref: "C05", priority: "Medium",
    objective: "Mencapai level 2 Incoterms & dokumen freight: menentukan term & penanggung biaya dengan benar pada 100% quotation mulai Nov 2026.",
    revs: [
      ["Identified", "2026-09-01 10:40", "E30", "2 quotation salah menentukan penanggung biaya FCA vs FOB."],
      ["Planned", "2026-09-08 14:10", "E42", "Pelatihan Incoterms 2020 & dokumen ekspor-impor 16 Okt 2026."],
    ] },
  { key: "N16", emp: "E38", type: "competency_gap", ref: "C13", priority: "High",
    objective: "Mencapai level 3 Tax Compliance: lulus Brevet Pajak A & B dan menyusun SPT Masa PPN/PPh 23 tanpa pembetulan mulai Q3 2026.",
    revs: [
      ["Identified", "2026-04-06 09:00", "E35", "2 pembetulan e-Bupot pada Q1 2026."],
      ["Planned", "2026-04-13 11:00", "E42", "Brevet Pajak A & B kelas akhir pekan Jun–Agu."],
      ["In Progress", "2026-06-01 08:30", "E42", "Kelas dimulai 6 Juni 2026."],
      ["Completed", "2026-09-04 15:00", "E35", "Lulus Brevet A & B; SPT Masa Agustus tanpa pembetulan. Skill dicatat ulang level 3."],
    ] },
  { key: "N17", emp: "E37", type: "competency_gap", ref: "C12", priority: "High",
    objective: "Mencapai level 3 Financial Reporting & GL: closing bulanan ≤ H+5 dengan ≤ 1 jurnal koreksi selama Okt–Des 2026.",
    revs: [
      ["Identified", "2026-08-10 15:00", "E35", "Closing Agustus mundur ke H+9 dengan 3 jurnal koreksi."],
      ["Planned", "2026-08-17 10:00", "E42", "Pelatihan closing bulanan & rekonsiliasi GL."],
      ["In Progress", "2026-09-07 08:30", "E42", "Pelatihan berjalan; closing September menjadi praktik terdampingi."],
    ] },
  { key: "N18", emp: "E40", type: "performance_context", ref: "2026-09", priority: "High",
    objective: "Menurunkan piutang > 90 hari dari 11% menjadi ≤ 5% dan DSO portofolio ≤ 45 hari pada akhir Desember 2026.",
    revs: [["Identified", "2026-10-03 09:30", "E35", "Dari evaluasi September 2026; rencana penagihan mingguan akan disusun bersama."]] },
  { key: "N19", emp: "E43", type: "competency_gap", ref: "C20", priority: "Medium",
    objective: "Mencapai level 3 IT Service Support: troubleshooting VPN & LAN kantor cabang tanpa eskalasi vendor, resolusi tiket ≥ 90% ≤ SLA pada Q1 2027.",
    revs: [
      ["Identified", "2026-08-24 14:00", "E41", "Dari assessment 24 Agu 2026; resolusi tiket ≤ SLA 78%."],
      ["Planned", "2026-09-01 09:30", "E42", "Pelatihan jaringan & troubleshooting LAN/VPN batch Desember."],
    ] },
  { key: "N20", emp: "E08", type: "competency_gap", ref: "C16", priority: "Medium",
    objective: "Mencapai level 4 Budgeting & Cost Control: analisis varians biaya cabang Medan setiap bulan dan realisasi ≤ 100% anggaran pada H1 2027.",
    revs: [["Identified", "2026-09-22 16:00", "E06", "Biaya cabang Q2 melebihi anggaran 7%; belum ada analisis varians bulanan."]] },
];
const needId = (key: string) => uid("need", num(key));

type TrnRev = readonly [status: TrainingStatus, savedAt: string, actor: string, result: string, notes: string];
interface TrainingSpec { readonly key: string; readonly need: string; readonly activity: string; readonly date: string; readonly revs: readonly TrnRev[] }

const TRAININGS: readonly TrainingSpec[] = [
  { key: "T01", need: "N01", activity: "Workshop CEISA 4.0 & Tata Laksana PIB/PEB untuk PPJK (3 sesi)", date: "2026-09-10", revs: [
    ["Planned", "2026-07-16 10:00", "E42", "", "Batch September, kelas daring 3 sesi."],
    ["In Progress", "2026-09-10 08:30", "E42", "", "Sesi 1 dari 3."],
    ["Completed", "2026-09-26 16:00", "E42", "Hadir 3/3 sesi; post-test 86/100. Mampu menyusun draft PIB jalur kuning dengan pendampingan minimal.", "Skill belum diperbarui; menunggu observasi atasan selama Oktober."],
  ] },
  { key: "T02", need: "N01", activity: "Mentoring on-the-job PIB jalur merah bersama Customs Clearance & PPJK Manager (4 sesi)", date: "2026-10-14", revs: [
    ["Planned", "2026-09-29 11:00", "E09", "", "Jadwal Rabu mingguan mulai 14 Okt 2026."],
  ] },
  { key: "T03", need: "N04", activity: "Bimtek Internal Penanganan Jalur Merah & Pemeriksaan Fisik", date: "2026-08-06", revs: [
    ["Planned", "2026-06-22 10:00", "E42", "", "Narasumber: praktisi eks-pemeriksa barang."],
    ["In Progress", "2026-08-06 08:00", "E42", "", "Hari 1 dari 3."],
    ["Completed", "2026-08-08 17:00", "E42", "Lulus studi kasus 3 skenario jalur merah; menyusun tanggapan NHI tanpa koreksi.", ""],
  ] },
  { key: "T04", need: "N05", activity: "Supervisory Development Program – Batch Q4 2026 (3 modul)", date: "2026-11-05", revs: [
    ["Planned", "2026-09-25 09:00", "E42", "", "Modul: delegasi, coaching, manajemen kinerja tim."],
  ] },
  { key: "T05", need: "N06", activity: "Coaching Negosiasi B2B & Key Account Management (6 sesi)", date: "2026-09-08", revs: [
    ["Planned", "2026-08-29 10:00", "E30", "", "Coach eksternal; sesi tiap dua minggu."],
    ["In Progress", "2026-09-08 09:00", "E42", "", "Sesi 2 dari 6 selesai 22 Sep 2026."],
  ] },
  { key: "T06", need: "N06", activity: "Leadership Essentials for First-Time Managers", date: "2026-10-21", revs: [
    ["Planned", "2026-09-30 14:00", "E42", "", "Kelas tatap muka 2 hari di Jakarta."],
  ] },
  { key: "T07", need: "N07", activity: "Pelatihan IATA DGR Kategori 6 – Initial (5 hari)", date: "2026-09-21", revs: [
    ["Planned", "2026-07-28 10:00", "E42", "", "Lembaga pelatihan terakreditasi IATA; batch September."],
    ["In Progress", "2026-09-21 08:00", "E42", "", "Hari 1 dari 5."],
    ["Completed", "2026-09-30 15:00", "E42", "Lulus ujian akhir 88%; sertifikat IATA DGR Cat. 6 terbit 29 Sep 2026, berlaku 24 bulan.", "Salinan sertifikat diserahkan ke HR untuk verifikasi."],
  ] },
  { key: "T08", need: "N08", activity: "Sertifikasi Operator Forklift (SIO) Kemnaker Kelas II", date: "2026-08-12", revs: [
    ["Planned", "2026-05-19 09:00", "E42", "", "PJK3 terdaftar; batch Agustus."],
    ["In Progress", "2026-08-12 08:00", "E42", "", "Teori 2 hari, praktik 1 hari."],
    ["Completed", "2026-08-20 16:00", "E42", "Lulus uji teori & praktik; SIO Kelas II terbit 19 Agu 2026.", ""],
  ] },
  { key: "T09", need: "N09", activity: "Sertifikasi Operator Forklift (SIO) Kemnaker Kelas II", date: "2026-11-12", revs: [
    ["Planned", "2026-09-11 10:00", "E42", "", "Batch November 2026."],
  ] },
  { key: "T10", need: "N10", activity: "Refreshment K3 Gudang: Pengoperasian Forklift Aman & Safety Talk", date: "2026-09-18", revs: [
    ["Planned", "2026-09-14 13:30", "E19", "", "Internal, dibawakan Ahli K3 Umum perusahaan."],
    ["Completed", "2026-09-18 16:30", "E19", "Post-test K3 80/100; praktik rute forklift & penggunaan klakson di persimpangan lulus.", ""],
  ] },
  { key: "T11", need: "N11", activity: "Workshop Excel Lanjutan & Power BI untuk Inventory", date: "2026-08-25", revs: [
    ["Planned", "2026-07-09 10:00", "E42", "", "Batch Agustus."],
    ["Cancelled", "2026-08-20 11:00", "E42", "", "Dibatalkan: vendor membatalkan batch Agustus karena peserta di bawah kuota. Dijadwalkan ulang ke batch Oktober."],
  ] },
  { key: "T12", need: "N11", activity: "Workshop Excel Lanjutan & Power BI untuk Inventory – Batch Oktober", date: "2026-10-28", revs: [
    ["Planned", "2026-08-21 09:30", "E42", "", "Pengganti batch Agustus yang dibatalkan."],
  ] },
  { key: "T13", need: "N13", activity: "Refresher Input Manifest BC 1.1 & Modul INSW", date: "2026-08-20", revs: [
    ["Planned", "2026-08-11 10:00", "E25", "", "Internal, di site klien setelah jam operasional."],
    ["Completed", "2026-08-20 18:00", "E25", "Simulasi 40 pos manifest tanpa kesalahan; memahami alur koreksi pos.", ""],
  ] },
  { key: "T14", need: "N14", activity: "Workshop Costing & Quotation Pricing Freight (LCL/FCL/Air)", date: "2026-09-15", revs: [
    ["Planned", "2026-08-11 09:00", "E42", "", "Batch September, 4 sesi."],
    ["In Progress", "2026-09-15 08:30", "E42", "", "Sesi 3 dari 4 selesai 29 Sep 2026."],
  ] },
  { key: "T15", need: "N15", activity: "Pelatihan Incoterms 2020 & Dokumen Ekspor-Impor (AWB/BL)", date: "2026-10-16", revs: [
    ["Planned", "2026-09-09 10:00", "E42", "", "Kelas sehari bersama tim freight."],
  ] },
  { key: "T16", need: "N16", activity: "Brevet Pajak A & B (kelas akhir pekan)", date: "2026-06-06", revs: [
    ["Planned", "2026-04-14 10:00", "E42", "", "Kelas Sabtu, Juni–Agustus."],
    ["In Progress", "2026-06-06 08:00", "E42", "", "Pertemuan 1 dari 24."],
    ["Completed", "2026-08-29 12:00", "E42", "Lulus ujian Brevet A (82) & B (78); sertifikat terbit 28 Agu 2026.", ""],
  ] },
  { key: "T17", need: "N17", activity: "Pelatihan Closing Bulanan & Rekonsiliasi GL", date: "2026-09-07", revs: [
    ["Planned", "2026-08-18 10:00", "E42", "", "Pelatihan daring 3 sesi + praktik closing September."],
    ["In Progress", "2026-09-07 08:30", "E42", "", "Sesi 2 dari 3 selesai."],
  ] },
  { key: "T18", need: "N19", activity: "Pelatihan Jaringan & Troubleshooting LAN/VPN Kantor Cabang", date: "2026-12-03", revs: [
    ["Planned", "2026-09-02 09:00", "E42", "", "Batch Desember 2026 (3 hari)."],
  ] },
];

function buildNeeds(performance: readonly PerformanceEvaluation[]): DevelopmentNeedVersion[] {
  const versions: DevelopmentNeedVersion[] = [];
  let n = 1;
  for (const need of NEEDS) {
    let sourceRef: string;
    if (need.type === "competency_gap") sourceRef = requirementId(need.emp, need.ref);
    else if (need.type === "role_change") sourceRef = assessmentId(need.ref);
    else {
      const evaluation = performance.filter((item) => item.employeeId === empId(need.emp) && item.period === need.ref)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!evaluation) throw new Error(`No evaluation ${need.emp} ${need.ref}`);
      sourceRef = evaluation.id;
    }
    need.revs.forEach(([status, savedAt, actor, notes], index) => {
      versions.push({
        id: uid("needVer", n++), needId: needId(need.key), revision: index + 1, source: "fixture", employeeId: empId(need.emp),
        sourceType: need.type, sourceRef, objective: need.objective, priority: need.priority, status, notes, createdAt: at(savedAt), actor: nameOf(actor),
      });
    });
  }
  return versions;
}

function buildTrainings(): TrainingVersion[] {
  const versions: TrainingVersion[] = [];
  let n = 1;
  for (const training of TRAININGS) {
    const need = NEEDS.find((item) => item.key === training.need);
    if (!need) throw new Error(`Unknown need ${training.need}`);
    training.revs.forEach(([status, savedAt, actor, result, notes], index) => {
      versions.push({
        id: uid("trnVer", n++), trainingId: uid("trn", num(training.key)), revision: index + 1, source: "fixture", employeeId: empId(need.emp),
        developmentNeedId: needId(need.key), activity: training.activity, date: training.date, status, result, notes, createdAt: at(savedAt), actor: nameOf(actor),
      });
    });
  }
  return versions;
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { key: "hr", role: "HR", employeeId: empId("E42"), title: "HR Business Partner",
    description: "Intan Permatasari (Human Capital) — melihat seluruh karyawan, mengelola development requirement dan training lintas departemen." },
  { key: "manager", role: "MANAGER", employeeId: empId("E09"), title: "Customs Clearance & PPJK Manager",
    description: "Asep Saepudin Hidayat — kepala departemen Customs Clearance & PPJK dengan 6 staf: menilai kinerja, KPI, dan gap kompetensi tim." },
  { key: "employee", role: "EMPLOYEE", employeeId: empId("E10"), title: "Customs Clearance & PPJK Officer",
    description: "Fajar Nugroho — staf PPJK dengan riwayat evaluasi, scorecard KPI (termasuk revisi), gap CEISA, development need, dan training berjalan." },
];

const DATA: Omit<D4LiveSnapshot, "role" | "actorEmployeeId"> = (() => {
  const reference = buildReference();
  const performance = buildPerformance();
  return {
    reference,
    kpi: [],
    kpiAssessments: buildKpi(),
    performance,
    competency: buildAssessments(reference),
    developmentVersions: buildNeeds(performance),
    trainingVersions: buildTrainings(),
  };
})();

/** Fresh deep copy of the demo seed on every call. */
export function createDemoSeed(): Omit<D4LiveSnapshot, "role" | "actorEmployeeId"> {
  return JSON.parse(JSON.stringify(DATA)) as Omit<D4LiveSnapshot, "role" | "actorEmployeeId">;
}

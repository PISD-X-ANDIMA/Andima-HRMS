import type { ReferenceDataRepository } from "../services";
import type { ReferenceDataSnapshot } from "../types";

/**
 * Fictional D4 data only. No production or Supabase records are stored here. Names reuse the
 * placeholder rows of the org structure file (Alfa, Bravo, …, Mercury); FIX-D4 IDs keep fixture
 * data distinguishable from the HR baseline (TR-D4-002 #22).
 */
export const d4ReferenceFixture: ReferenceDataSnapshot = {
  source: "fixture",
  departments: [
    {
      id: "d4000000-0000-4000-8000-000000000001",
      code: "FIX-D4-DEPT",
      name: "Departemen Demo D4",
    },
    {
      id: "d4000000-0000-4000-8000-000000000007",
      code: "FIX-D4-FIN",
      name: "Finance & Administration",
    },
    { id: "d4000000-0000-4000-8000-000000000046", code: "FIX-D4-SALES-DEPT", name: "Commercial & Customer Success" },
    { id: "d4000000-0000-4000-8000-000000000047", code: "FIX-D4-OPS-DEPT", name: "Operations" },
    { id: "d4000000-0000-4000-8000-000000000048", code: "FIX-D4-HR-DEPT", name: "Human Capital & Culture" },
  ],
  positions: [
    {
      id: "d4000000-0000-4000-8000-000000000002",
      code: "FIX-D4-POS",
      title: "Staf Demo D4",
      departmentId: "d4000000-0000-4000-8000-000000000001",
    },
    {
      id: "d4000000-0000-4000-8000-000000000008",
      code: "FIX-D4-FIN-STAFF",
      title: "Finance Staff",
      departmentId: "d4000000-0000-4000-8000-000000000007",
    },
    { id: "d4000000-0000-4000-8000-000000000017", code: "FIX-D4-SALES", title: "Sales Staff", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000018", code: "FIX-D4-OPS", title: "Operations Staff", departmentId: "d4000000-0000-4000-8000-000000000047" },
    { id: "d4000000-0000-4000-8000-000000000019", code: "FIX-D4-HR", title: "HR Associate Officer", departmentId: "d4000000-0000-4000-8000-000000000048" },
    { id: "d4000000-0000-4000-8000-000000000020", code: "FIX-D4-SALES-ADMIN", title: "Sales Administration Associate", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000044", code: "FIX-D4-FIN-ADMIN", title: "Finance Administrator", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000045", code: "FIX-D4-MARKETING-STAFF", title: "Marketing Staff", departmentId: "d4000000-0000-4000-8000-000000000046" },
  ],
  employees: [
    {
      id: "d4000000-0000-4000-8000-000000000003",
      employeeId: "FIX-D4-EMP-001",
      fullName: "Pegawai Demo D4",
      positionId: "d4000000-0000-4000-8000-000000000002",
      departmentId: "d4000000-0000-4000-8000-000000000001",
    },
    {
      id: "d4000000-0000-4000-8000-000000000009",
      employeeId: "FIX-D4-EMP-002",
      fullName: "Alfa",
      positionId: "d4000000-0000-4000-8000-000000000008",
      departmentId: "d4000000-0000-4000-8000-000000000007",
    },
    { id: "d4000000-0000-4000-8000-000000000010", employeeId: "FIX-D4-EMP-003", fullName: "Bravo", positionId: "d4000000-0000-4000-8000-000000000017", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000011", employeeId: "FIX-D4-EMP-004", fullName: "Charlie", positionId: "d4000000-0000-4000-8000-000000000018", departmentId: "d4000000-0000-4000-8000-000000000047" },
    { id: "d4000000-0000-4000-8000-000000000012", employeeId: "FIX-D4-EMP-005", fullName: "Mercury", positionId: "d4000000-0000-4000-8000-000000000019", departmentId: "d4000000-0000-4000-8000-000000000048" },
    { id: "d4000000-0000-4000-8000-000000000013", employeeId: "FIX-D4-EMP-006", fullName: "Delta", positionId: "d4000000-0000-4000-8000-000000000020", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000014", employeeId: "FIX-D4-EMP-007", fullName: "Echo", positionId: "d4000000-0000-4000-8000-000000000008", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000015", employeeId: "FIX-D4-EMP-008", fullName: "Fanta", positionId: "d4000000-0000-4000-8000-000000000018", departmentId: "d4000000-0000-4000-8000-000000000047" },
    { id: "d4000000-0000-4000-8000-000000000016", employeeId: "FIX-D4-EMP-009", fullName: "Holly", positionId: "d4000000-0000-4000-8000-000000000008", departmentId: "d4000000-0000-4000-8000-000000000007" },
  ],
  competencies: [
    {
      id: "d4000000-0000-4000-8000-000000000004",
      code: "FIX-D4-COMP-001",
      name: "Komunikasi Demo",
      category: "Soft skill",
    },
    { id: "d4000000-0000-4000-8000-000000000022", code: "FIX-D4-COMP-002", name: "Akurasi Administrasi", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000023", code: "FIX-D4-COMP-003", name: "Pengelolaan Arsip", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000024", code: "FIX-D4-COMP-004", name: "Keselamatan Operasi", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000025", code: "FIX-D4-COMP-005", name: "Dokumentasi HR", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000026", code: "FIX-D4-COMP-006", name: "Penjualan & Negosiasi", category: "Technical" },
  ],
  positionRequirements: [
    {
      id: "d4000000-0000-4000-8000-000000000005",
      positionId: "d4000000-0000-4000-8000-000000000002",
      competencyId: "d4000000-0000-4000-8000-000000000004",
      minProficiencyLevel: 3,
      isMandatory: true,
    },
    { id: "d4000000-0000-4000-8000-000000000027", positionId: "d4000000-0000-4000-8000-000000000008", competencyId: "d4000000-0000-4000-8000-000000000004", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000028", positionId: "d4000000-0000-4000-8000-000000000008", competencyId: "d4000000-0000-4000-8000-000000000022", minProficiencyLevel: 4, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000029", positionId: "d4000000-0000-4000-8000-000000000008", competencyId: "d4000000-0000-4000-8000-000000000023", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000030", positionId: "d4000000-0000-4000-8000-000000000017", competencyId: "d4000000-0000-4000-8000-000000000026", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000031", positionId: "d4000000-0000-4000-8000-000000000018", competencyId: "d4000000-0000-4000-8000-000000000024", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000032", positionId: "d4000000-0000-4000-8000-000000000019", competencyId: "d4000000-0000-4000-8000-000000000025", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000033", positionId: "d4000000-0000-4000-8000-000000000020", competencyId: "d4000000-0000-4000-8000-000000000022", minProficiencyLevel: 3, isMandatory: true },
  ],
  employeeSkills: [
    {
      id: "d4000000-0000-4000-8000-000000000006",
      employeeId: "d4000000-0000-4000-8000-000000000003",
      competencyId: "d4000000-0000-4000-8000-000000000004",
      proficiencyLevel: 2,
      evidenceNotes: "Data fiktif untuk pengembangan UI.",
    },
    { id: "d4000000-0000-4000-8000-000000000034", employeeId: "d4000000-0000-4000-8000-000000000009", competencyId: "d4000000-0000-4000-8000-000000000004", proficiencyLevel: 4, evidenceNotes: "Bukti komunikasi fixture." },
    { id: "d4000000-0000-4000-8000-000000000035", employeeId: "d4000000-0000-4000-8000-000000000009", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 2, evidenceNotes: "Berkas administrasi fixture." },
    { id: "d4000000-0000-4000-8000-000000000036", employeeId: "d4000000-0000-4000-8000-000000000010", competencyId: "d4000000-0000-4000-8000-000000000026", proficiencyLevel: 4, evidenceNotes: "Simulasi negosiasi fixture." },
    { id: "d4000000-0000-4000-8000-000000000037", employeeId: "d4000000-0000-4000-8000-000000000011", competencyId: "d4000000-0000-4000-8000-000000000024", proficiencyLevel: 2, evidenceNotes: "Catatan keselamatan fixture." },
    { id: "d4000000-0000-4000-8000-000000000038", employeeId: "d4000000-0000-4000-8000-000000000013", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 3, evidenceNotes: "Dokumen administrasi fixture." },
    { id: "d4000000-0000-4000-8000-000000000039", employeeId: "d4000000-0000-4000-8000-000000000014", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 2, evidenceNotes: "Rekonsiliasi contoh fixture." },
    { id: "d4000000-0000-4000-8000-000000000040", employeeId: "d4000000-0000-4000-8000-000000000015", competencyId: "d4000000-0000-4000-8000-000000000024", proficiencyLevel: 3, evidenceNotes: "Checklist keselamatan fixture." },
    { id: "d4000000-0000-4000-8000-000000000041", employeeId: "d4000000-0000-4000-8000-000000000016", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 4, evidenceNotes: "Arsip keuangan fixture." },
    { id: "d4000000-0000-4000-8000-000000000042", employeeId: "d4000000-0000-4000-8000-000000000016", competencyId: "d4000000-0000-4000-8000-000000000023", proficiencyLevel: 3, evidenceNotes: null },
  ],
};

/** Must be selected explicitly by a feature in development. */
export const fixtureReferenceRepository: ReferenceDataRepository = {
  async loadReferenceData() {
    return d4ReferenceFixture;
  },
};

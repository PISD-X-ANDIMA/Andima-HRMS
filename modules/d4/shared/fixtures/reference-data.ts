import type { ReferenceDataRepository } from "../services";
import type { ReferenceDataSnapshot } from "../types";

/**
 * D4 sample data only. No production or Supabase records are stored here. People, Employee IDs, positions and
 * departments are rows of OrganizationalStructureData_PTANDIMATRANSPORTINDO_UAJY_APPROVED_V1-2.xlsx (sheet
 * 01_ORG_MASTER), as the partner asked for real names in demos; everything else (skills, levels, PROBATION) is demo
 * data. Codes keep the FIX-D4 prefix so departments, positions and competencies stay distinguishable from the HR
 * baseline (TR-D4-002 #22); Employee IDs follow the org file instead.
 */
export const d4ReferenceFixture: ReferenceDataSnapshot = {
  source: "fixture",
  departments: [
    { id: "d4000000-0000-4000-8000-000000000001", code: "FIX-D4-GOV-DEPT", name: "Corporate Governance" },
    { id: "d4000000-0000-4000-8000-000000000007", code: "FIX-D4-FIN", name: "Finance, Accounting & Tax" },
    { id: "d4000000-0000-4000-8000-000000000046", code: "FIX-D4-SALES-DEPT", name: "Commercial & Customer Success" },
    { id: "d4000000-0000-4000-8000-000000000048", code: "FIX-D4-HR-DEPT", name: "Human Capital & Culture" },
  ],
  positions: [
    { id: "d4000000-0000-4000-8000-000000000002", code: "FIX-D4-COM", title: "Commissioner", departmentId: "d4000000-0000-4000-8000-000000000001" },
    { id: "d4000000-0000-4000-8000-000000000008", code: "FIX-D4-ACC-BIL-1", title: "Accounting Associate 1 (Billing)", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000017", code: "FIX-D4-SLS-EXEC-1", title: "Sales Executive 1", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000018", code: "FIX-D4-TAX-MGR", title: "Tax Manager", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000019", code: "FIX-D4-HR-MGR", title: "HR Manager", departmentId: "d4000000-0000-4000-8000-000000000048" },
    { id: "d4000000-0000-4000-8000-000000000020", code: "FIX-D4-SALES-ADMIN", title: "Sales Administration Associate", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000044", code: "FIX-D4-TAX-ASC-1", title: "Tax Associate 1", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000045", code: "FIX-D4-CS-MGR", title: "Manager of Customer Success", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000049", code: "FIX-D4-ACC-MGR", title: "Manager of Accounting", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000050", code: "FIX-D4-DIR-HCC", title: "Director of Human Capital & Culture", departmentId: "d4000000-0000-4000-8000-000000000048" },
  ],
  // Demo scenarios: Bhumi is a trainee (PROBATION, set for the demo; the org file lists everyone as Active), Desty
  // has a position change assessment for Tax Manager, Mba Ena's last training was Not Passed, and Kak Dian has a
  // Communication gap without a development requirement (see fixture-source and the development/training fixtures).
  employees: [
    { id: "d4000000-0000-4000-8000-000000000003", employeeId: "COM-001", fullName: "Mrs. Fahda Iba Ardiyani", positionId: "d4000000-0000-4000-8000-000000000002", departmentId: "d4000000-0000-4000-8000-000000000001" },
    { id: "d4000000-0000-4000-8000-000000000009", employeeId: "FAT-BIL-001", fullName: "Kak Ismi", positionId: "d4000000-0000-4000-8000-000000000008", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000010", employeeId: "COM-SLS-001", fullName: "Mrs. Wulan", positionId: "d4000000-0000-4000-8000-000000000017", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000011", employeeId: "FAT-TAX-MGR-001", fullName: "Kak Dian", positionId: "d4000000-0000-4000-8000-000000000018", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000012", employeeId: "HCC-HR-MGR-001", fullName: "Mrs. Maya", positionId: "d4000000-0000-4000-8000-000000000019", departmentId: "d4000000-0000-4000-8000-000000000048" },
    { id: "d4000000-0000-4000-8000-000000000013", employeeId: "COM-SA-01-02", fullName: "Bhumi", positionId: "d4000000-0000-4000-8000-000000000020", departmentId: "d4000000-0000-4000-8000-000000000046", employmentStatus: "PROBATION" },
    { id: "d4000000-0000-4000-8000-000000000014", employeeId: "FAT-TAX-ASC-001", fullName: "Desty", positionId: "d4000000-0000-4000-8000-000000000044", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000015", employeeId: "COM-CS-MGR-001", fullName: "Mr. Andito Pribadi", positionId: "d4000000-0000-4000-8000-000000000045", departmentId: "d4000000-0000-4000-8000-000000000046" },
    { id: "d4000000-0000-4000-8000-000000000016", employeeId: "FAT-ACC-MGR-001", fullName: "Mba Ena", positionId: "d4000000-0000-4000-8000-000000000049", departmentId: "d4000000-0000-4000-8000-000000000007" },
    { id: "d4000000-0000-4000-8000-000000000051", employeeId: "DIR-HCC-001", fullName: "Mr. Gema Arsisto", positionId: "d4000000-0000-4000-8000-000000000050", departmentId: "d4000000-0000-4000-8000-000000000048" },
  ],
  competencies: [
    { id: "d4000000-0000-4000-8000-000000000004", code: "FIX-D4-COMP-001", name: "Communication", category: "Soft skill" },
    { id: "d4000000-0000-4000-8000-000000000022", code: "FIX-D4-COMP-002", name: "Administrative Accuracy", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000023", code: "FIX-D4-COMP-003", name: "Records Management", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000024", code: "FIX-D4-COMP-004", name: "Tax Reporting & Compliance", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000025", code: "FIX-D4-COMP-005", name: "HR Documentation", category: "Technical" },
    { id: "d4000000-0000-4000-8000-000000000026", code: "FIX-D4-COMP-006", name: "Sales & Negotiation", category: "Technical" },
  ],
  positionRequirements: [
    { id: "d4000000-0000-4000-8000-000000000005", positionId: "d4000000-0000-4000-8000-000000000002", competencyId: "d4000000-0000-4000-8000-000000000004", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000027", positionId: "d4000000-0000-4000-8000-000000000008", competencyId: "d4000000-0000-4000-8000-000000000004", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000028", positionId: "d4000000-0000-4000-8000-000000000008", competencyId: "d4000000-0000-4000-8000-000000000022", minProficiencyLevel: 4, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000029", positionId: "d4000000-0000-4000-8000-000000000008", competencyId: "d4000000-0000-4000-8000-000000000023", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000030", positionId: "d4000000-0000-4000-8000-000000000017", competencyId: "d4000000-0000-4000-8000-000000000026", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000031", positionId: "d4000000-0000-4000-8000-000000000018", competencyId: "d4000000-0000-4000-8000-000000000024", minProficiencyLevel: 4, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000054", positionId: "d4000000-0000-4000-8000-000000000018", competencyId: "d4000000-0000-4000-8000-000000000004", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000032", positionId: "d4000000-0000-4000-8000-000000000019", competencyId: "d4000000-0000-4000-8000-000000000025", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000033", positionId: "d4000000-0000-4000-8000-000000000020", competencyId: "d4000000-0000-4000-8000-000000000022", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000052", positionId: "d4000000-0000-4000-8000-000000000044", competencyId: "d4000000-0000-4000-8000-000000000024", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000053", positionId: "d4000000-0000-4000-8000-000000000044", competencyId: "d4000000-0000-4000-8000-000000000022", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000055", positionId: "d4000000-0000-4000-8000-000000000045", competencyId: "d4000000-0000-4000-8000-000000000026", minProficiencyLevel: 3, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000056", positionId: "d4000000-0000-4000-8000-000000000049", competencyId: "d4000000-0000-4000-8000-000000000022", minProficiencyLevel: 4, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000057", positionId: "d4000000-0000-4000-8000-000000000049", competencyId: "d4000000-0000-4000-8000-000000000023", minProficiencyLevel: 4, isMandatory: true },
    { id: "d4000000-0000-4000-8000-000000000058", positionId: "d4000000-0000-4000-8000-000000000050", competencyId: "d4000000-0000-4000-8000-000000000004", minProficiencyLevel: 4, isMandatory: true },
  ],
  employeeSkills: [
    { id: "d4000000-0000-4000-8000-000000000006", employeeId: "d4000000-0000-4000-8000-000000000003", competencyId: "d4000000-0000-4000-8000-000000000004", proficiencyLevel: 2, evidenceNotes: "Sample data for UI development." },
    { id: "d4000000-0000-4000-8000-000000000034", employeeId: "d4000000-0000-4000-8000-000000000009", competencyId: "d4000000-0000-4000-8000-000000000004", proficiencyLevel: 4, evidenceNotes: "Fixture communication evidence." },
    { id: "d4000000-0000-4000-8000-000000000035", employeeId: "d4000000-0000-4000-8000-000000000009", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 2, evidenceNotes: "Fixture administration files." },
    { id: "d4000000-0000-4000-8000-000000000036", employeeId: "d4000000-0000-4000-8000-000000000010", competencyId: "d4000000-0000-4000-8000-000000000026", proficiencyLevel: 4, evidenceNotes: "Fixture negotiation simulation." },
    { id: "d4000000-0000-4000-8000-000000000037", employeeId: "d4000000-0000-4000-8000-000000000011", competencyId: "d4000000-0000-4000-8000-000000000024", proficiencyLevel: 3, evidenceNotes: "Fixture tax filing review." },
    { id: "d4000000-0000-4000-8000-000000000060", employeeId: "d4000000-0000-4000-8000-000000000011", competencyId: "d4000000-0000-4000-8000-000000000004", proficiencyLevel: 2, evidenceNotes: "Fixture team meeting notes." },
    { id: "d4000000-0000-4000-8000-000000000038", employeeId: "d4000000-0000-4000-8000-000000000013", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 3, evidenceNotes: "Fixture administration documents." },
    { id: "d4000000-0000-4000-8000-000000000039", employeeId: "d4000000-0000-4000-8000-000000000014", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 2, evidenceNotes: "Fixture sample reconciliation." },
    { id: "d4000000-0000-4000-8000-000000000059", employeeId: "d4000000-0000-4000-8000-000000000014", competencyId: "d4000000-0000-4000-8000-000000000024", proficiencyLevel: 3, evidenceNotes: "Fixture Coretax filing samples." },
    { id: "d4000000-0000-4000-8000-000000000040", employeeId: "d4000000-0000-4000-8000-000000000015", competencyId: "d4000000-0000-4000-8000-000000000026", proficiencyLevel: 3, evidenceNotes: "Fixture key account review." },
    { id: "d4000000-0000-4000-8000-000000000041", employeeId: "d4000000-0000-4000-8000-000000000016", competencyId: "d4000000-0000-4000-8000-000000000022", proficiencyLevel: 4, evidenceNotes: "Fixture finance archive." },
    { id: "d4000000-0000-4000-8000-000000000042", employeeId: "d4000000-0000-4000-8000-000000000016", competencyId: "d4000000-0000-4000-8000-000000000023", proficiencyLevel: 3, evidenceNotes: "Fixture filing audit." },
  ],
};

/** Must be selected explicitly by a feature in development. */
export const fixtureReferenceRepository: ReferenceDataRepository = {
  async loadReferenceData() {
    return d4ReferenceFixture;
  },
};

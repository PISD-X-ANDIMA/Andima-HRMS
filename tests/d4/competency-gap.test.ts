import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareCompetencies } from "@/modules/d4/competency/service";
import { indicatorsFor, KPI_V51_CATALOG, selectCatalog } from "@/modules/d4/kpi/catalog";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import type { ReferenceDataSnapshot } from "@/modules/d4/shared/types";
import { latestDevelopment, latestTraining } from "@/modules/d4/supabase/types";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4DataSource } from "@/modules/d4/web/data/source";

// Rule (UI-D4-001, DEMO-SCRIPT-D4, TC-D4-005-15): a competency gap is a fact derived from employee_skills
// against position_requirements. Completing training or a development requirement, or saving a good
// evaluation/KPI, never closes it. It only changes when a person records new skill evidence and a
// reassessment is saved.
const ALFA = "d4000000-0000-4000-8000-000000000009";
const FINANCE_STAFF = "d4000000-0000-4000-8000-000000000008";
const ALFA_GAP = "d4000000-0000-4000-8000-000000000028"; // Akurasi Administrasi: level 2, min. 4
const ADMIN_ACCURACY = "d4000000-0000-4000-8000-000000000022";
const THIRD_REQUIREMENT_COMPETENCY = "d4000000-0000-4000-8000-000000000023"; // Alfa has no skill record yet

const gapFinding = (findings: readonly { requirementId: string; status: string }[]) => findings.find((item) => item.requirementId === ALFA_GAP)?.status;

let source: D4DataSource;
beforeEach(() => {
  // The fixture source waits 250 ms per read to imitate the network; run it immediately.
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((run: () => void) => { run(); return 0; }) as unknown as typeof setTimeout);
  // "Today" after the fixture training date (8 Oct 2026): a Completed training may not be dated in the future.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T03:00:00Z") });
  source = createFixtureSource();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function latestAlfaAssessment() {
  return [...(await source.loadSnapshot()).competency].filter((item) => item.employeeId === ALFA).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

describe("competency gap is not resolved automatically", () => {
  it("starts as an open Gap for Alfa (level 2 of min. 4) with an open requirement and planned training", async () => {
    const snapshot = await source.loadSnapshot();
    expect(gapFinding((await latestAlfaAssessment()).findings)).toBe("Gap");
    expect(latestDevelopment(snapshot).find((item) => item.needId === "FIX-D4-DEV-001")).toMatchObject({ sourceType: "competency_gap", sourceRef: ALFA_GAP });
  });

  it("stays Gap after training and the requirement are Completed and good scores are saved, and a new snapshot still shows Gap", async () => {
    await source.updateTraining("FIX-D4-TRN-001", "Completed", "Lulus workshop", "");
    await source.updateDevelopment("FIX-D4-DEV-001", "Completed", "Training selesai");
    await source.createEvaluation({ employeeId: ALFA, period: "2026-11", evaluationDate: "2026-11-28", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 5, aspects: [], generalNotes: "Sangat baik.", evidenceReference: null });
    const lines = indicatorsFor(selectCatalog(KPI_V51_CATALOG), 10).map((row) => ({ indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "", actual: "", raw_score: 5, comment: "" }));
    await source.createKpiAssessment({ employeeId: ALFA, roleOrder: 10, period: "2026-11", evaluationDate: "2026-11-28", evaluatorName: "x", status: "completed", lines, generalNotes: "" });

    const snapshot = await source.loadSnapshot();
    expect(latestTraining(snapshot).find((item) => item.trainingId === "FIX-D4-TRN-001")?.status).toBe("Completed");
    expect(latestDevelopment(snapshot).find((item) => item.needId === "FIX-D4-DEV-001")?.status).toBe("Completed");
    const before = await latestAlfaAssessment();
    expect(gapFinding(before.findings)).toBe("Gap");
    expect(before.overallStatus).toBe("Gap");

    // Reassessment without new skill evidence: a new snapshot is appended, and the gap is still open.
    const id = await source.saveCompetency({ employeeId: ALFA, positionId: FINANCE_STAFF, effectiveDate: "2026-11-30" });
    const after = (await source.loadSnapshot()).competency.find((item) => item.id === id)!;
    expect(gapFinding(after.findings)).toBe("Gap");
    expect(after.overallStatus).toBe("Gap");
    expect((await source.loadSnapshot()).competency.find((item) => item.id === before.id)).toEqual(before); // history untouched
  });

  it("the comparison ignores development, training and score data entirely", () => {
    // compareCompetencies only reads reference data; there is no input through which a completed training could close a gap.
    expect(gapFinding(compareCompetencies(ALFA, FINANCE_STAFF, d4ReferenceFixture).findings)).toBe("Gap");
  });
});

describe("explicit resolution: new skill evidence + reassessment", () => {
  const withSkill = (competencyId: string, proficiencyLevel: number, evidenceNotes: string | null, reference: ReferenceDataSnapshot = d4ReferenceFixture): ReferenceDataSnapshot => ({
    ...reference,
    employeeSkills: [
      ...reference.employeeSkills.filter((item) => !(item.employeeId === ALFA && item.competencyId === competencyId)),
      { id: `skill-${competencyId}`, employeeId: ALFA, competencyId, proficiencyLevel, evidenceNotes },
    ],
  });

  it("closes the gap only when the recorded level reaches the minimum and has evidence", () => {
    expect(gapFinding(compareCompetencies(ALFA, FINANCE_STAFF, withSkill(ADMIN_ACCURACY, 3, "Penilaian ulang")).findings)).toBe("Gap");
    expect(gapFinding(compareCompetencies(ALFA, FINANCE_STAFF, withSkill(ADMIN_ACCURACY, 4, "Penilaian ulang")).findings)).toBe("Terpenuhi");
  });

  it("a higher level without evidence is not a resolution: it becomes Bukti Belum Cukup, not Terpenuhi", () => {
    expect(gapFinding(compareCompetencies(ALFA, FINANCE_STAFF, withSkill(ADMIN_ACCURACY, 5, "  ")).findings)).toBe("Bukti Belum Cukup");
  });

  it("an optional requirement is shown but does not decide the overall status", () => {
    const resolved = withSkill(THIRD_REQUIREMENT_COMPETENCY, 3, "Bukti", withSkill(ADMIN_ACCURACY, 4, "Penilaian ulang"));
    const optionalGap: ReferenceDataSnapshot = {
      ...resolved,
      positionRequirements: resolved.positionRequirements.map((item) => item.id === ALFA_GAP ? { ...item, minProficiencyLevel: 5, isMandatory: false } : item),
    };
    const result = compareCompetencies(ALFA, FINANCE_STAFF, optionalGap);
    expect(result.findings.find((item) => item.requirementId === ALFA_GAP)).toMatchObject({ status: "Gap", isMandatory: false });
    expect(result.overallStatus).toBe("Terpenuhi");
    // The same line as mandatory makes the employee Gap again.
    expect(compareCompetencies(ALFA, FINANCE_STAFF, { ...optionalGap, positionRequirements: optionalGap.positionRequirements.map((item) => ({ ...item, isMandatory: true })) }).overallStatus).toBe("Gap");
  });

  it("overall status turns Terpenuhi only when every requirement is met with evidence", () => {
    const resolved = withSkill(ADMIN_ACCURACY, 4, "Penilaian ulang");
    expect(compareCompetencies(ALFA, FINANCE_STAFF, resolved).overallStatus).toBe("Bukti Belum Cukup"); // third requirement has no skill record
    expect(compareCompetencies(ALFA, FINANCE_STAFF, withSkill(THIRD_REQUIREMENT_COMPETENCY, 3, "Bukti", resolved)).overallStatus).toBe("Terpenuhi");
  });
});

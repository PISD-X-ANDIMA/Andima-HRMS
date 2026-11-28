import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompetencyAssessment, CompetencyFinding } from "@/modules/d4/competency/types";
import type { TrainingVersion } from "@/modules/d4/training/types";
import { currentCompetencyStatus, type Snapshot } from "@/modules/d4/web/data/selectors";
import { dashboardAlerts, gapClosedAfter, trainingFinishedAt } from "@/modules/d4/web/features/dashboard/summary";

// Q14 (20 Oct 2026): after training HR reassesses the competency in D4. The "Completed, gap masih terbuka" alert
// clears only through a competency assessment saved after the training finished that shows the level met.
const DIAN = "d4000000-0000-4000-8000-000000000011"; // FIX-D4-DEV-002 (gap on requirement …031) with FIX-D4-TRN-002
const TAX_MANAGER = "d4000000-0000-4000-8000-000000000018";
const REQUIREMENT = "d4000000-0000-4000-8000-000000000031";
const PASSED_AT = "2026-10-10T08:00:00.000Z";

async function hrSnapshot(): Promise<Snapshot> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource().loadSnapshot();
}
afterEach(() => { vi.unstubAllEnvs(); });

/** Dian's training recorded Completed + Passed at PASSED_AT (a new version, as Update Progress saves it). */
function withPassedTraining(snapshot: Snapshot): Snapshot {
  const current = snapshot.trainingVersions.find((item) => item.trainingId === "FIX-D4-TRN-002")!;
  const passed: TrainingVersion = { ...current, id: "T-PASSED", revision: current.revision + 1, status: "Completed", result: "Passed", date: "2026-10-09", createdAt: PASSED_AT };
  return { ...snapshot, trainingVersions: [passed, ...snapshot.trainingVersions] };
}

function assessment(snapshot: Snapshot, createdAt: string, status: CompetencyFinding["status"]): CompetencyAssessment {
  const saved = snapshot.competency.find((item) => item.employeeId === DIAN)!;
  return { ...saved, id: `A-${createdAt}`, createdAt, effectiveDate: createdAt.slice(0, 10), positionId: TAX_MANAGER,
    findings: saved.findings.map((item) => item.requirementId === REQUIREMENT ? { ...item, actualLevel: status === "Terpenuhi" ? 4 : 3, status } : item) };
}

const flagged = (snapshot: Snapshot) => {
  const rows = snapshot.reference.employees.map((employee) => ({ employee, gap: currentCompetencyStatus(snapshot, employee) }));
  const dian = snapshot.reference.employees.find((item) => item.id === DIAN)!.fullName;
  return dashboardAlerts(snapshot, rows).find((alert) => alert.key === "completed-gap-open")?.people.includes(dian) ?? false;
};

describe("gap closed only by a newer assessment that meets the level (Q14)", () => {
  it("keeps the alert off while the training is still running", async () => {
    const snapshot = await hrSnapshot();
    expect(trainingFinishedAt(snapshot, snapshot.developmentVersions.find((item) => item.needId === "FIX-D4-DEV-002")!)).toBeUndefined();
    expect(flagged(snapshot)).toBe(false);
  });

  it("raises it once the training is Passed, from the moment it was recorded", async () => {
    const snapshot = withPassedTraining(await hrSnapshot());
    expect(trainingFinishedAt(snapshot, snapshot.developmentVersions.find((item) => item.needId === "FIX-D4-DEV-002")!)).toBe(PASSED_AT);
    expect(flagged(snapshot)).toBe(true);
  });

  it("clears it when an assessment saved after the training shows the level met", async () => {
    const base = withPassedTraining(await hrSnapshot());
    expect(flagged({ ...base, competency: [assessment(base, "2026-10-12T09:00:00.000Z", "Terpenuhi"), ...base.competency] })).toBe(false);
  });

  it("keeps it when the newer assessment still shows the gap", async () => {
    const base = withPassedTraining(await hrSnapshot());
    expect(flagged({ ...base, competency: [assessment(base, "2026-10-12T09:00:00.000Z", "Gap"), ...base.competency] })).toBe(true);
  });

  it("keeps it when the assessment that meets the level is older than the training", async () => {
    const base = withPassedTraining(await hrSnapshot());
    expect(flagged({ ...base, competency: [assessment(base, "2026-10-09T09:00:00.000Z", "Terpenuhi"), ...base.competency] })).toBe(true);
  });

  it("keeps it when only the live skill data rose and no assessment was saved", async () => {
    const base = withPassedTraining(await hrSnapshot());
    const raised = base.reference.employeeSkills.map((item) => item.employeeId === DIAN && item.competencyId === "d4000000-0000-4000-8000-000000000024" ? { ...item, proficiencyLevel: 4 } : item);
    expect(flagged({ ...base, reference: { ...base.reference, employeeSkills: raised } })).toBe(true);
  });

  it("follows the latest assessment after the training: a later gap reopens it", () => {
    const finding = (status: CompetencyFinding["status"]) => [{ requirementId: "R", status } as CompetencyFinding];
    const met = { createdAt: "2026-10-12T09:00:00.000Z", findings: finding("Terpenuhi") };
    const gap = { createdAt: "2026-10-14T09:00:00.000Z", findings: finding("Gap") };
    const other = { createdAt: "2026-10-15T09:00:00.000Z", findings: [{ requirementId: "OTHER", status: "Gap" } as CompetencyFinding] };
    expect(gapClosedAfter([met], "R", PASSED_AT)).toBe(true);
    expect(gapClosedAfter([met, gap], "R", PASSED_AT)).toBe(false);
    expect(gapClosedAfter([met, other], "R", PASSED_AT)).toBe(true); // an assessment without this requirement is ignored
    // Supabase timestamps (+00:00, microseconds) compare by time, not as text.
    expect(gapClosedAfter([{ ...met, createdAt: "2026-10-10T08:00:00.5+00:00" }], "R", PASSED_AT)).toBe(true);
    expect(gapClosedAfter([], "R", PASSED_AT)).toBe(false);
  });
});

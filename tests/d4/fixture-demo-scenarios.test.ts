import { afterEach, describe, expect, it, vi } from "vitest";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import { currentCompetencyStatus, inTrainingOrPositionChange, POSITION_CHANGE_SCOPE_MONTHS, type Snapshot } from "@/modules/d4/web/data/selectors";
import { dashboardAlerts, type DashboardRow } from "@/modules/d4/web/features/dashboard/summary";

// The four demo scenarios of the sample data (revision D4, 20 Oct 2026, Prompt 5 rule 3). People are picked by id;
// their names are rows of the org file and may change again.
const BHUMI = "d4000000-0000-4000-8000-000000000013"; // trainee
const DESTY = "d4000000-0000-4000-8000-000000000014"; // Tax Associate 1 assessed for Tax Manager
const ENA = "d4000000-0000-4000-8000-000000000016"; // last training Not Passed
const DIAN = "d4000000-0000-4000-8000-000000000011"; // gap without a development requirement

async function hrSnapshot(): Promise<Snapshot> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource().loadSnapshot();
}
afterEach(() => { vi.unstubAllEnvs(); });

const nameOf = (id: string) => d4ReferenceFixture.employees.find((item) => item.id === id)!.fullName;
const alertPeople = (snapshot: Snapshot, key: string) => {
  const rows: DashboardRow[] = snapshot.reference.employees.map((employee) => ({ employee, gap: currentCompetencyStatus(snapshot, employee) }));
  return dashboardAlerts(snapshot, rows).find((alert) => alert.key === key)?.people ?? [];
};

describe("fixture demo scenarios", () => {
  it("has a trainee on PROBATION in competency scope", async () => {
    const snapshot = await hrSnapshot();
    expect(snapshot.reference.employees.find((item) => item.id === BHUMI)?.employmentStatus).toBe("PROBATION");
    expect(inTrainingOrPositionChange(snapshot, BHUMI, "2026-10-20")).toBe(true);
  });

  it("has a position change assessment, assessed with the receiving manager, still in scope", async () => {
    const snapshot = await hrSnapshot();
    const move = snapshot.competency.find((item) => item.employeeId === DESTY && item.context === "role-change")!;
    const employee = snapshot.reference.employees.find((item) => item.id === DESTY)!;
    expect(move.positionId).not.toBe(employee.positionId);
    expect(move.assessedWith).toBeTruthy();
    expect(move.findings.some((item) => item.status === "Gap")).toBe(true);
    expect(snapshot.developmentVersions.some((item) => item.employeeId === DESTY)).toBe(false); // in scope through the move alone
    expect(inTrainingOrPositionChange(snapshot, DESTY, "2026-10-20")).toBe(true);
    expect(POSITION_CHANGE_SCOPE_MONTHS).toBeGreaterThan(0);
  });

  it("alerts a training Not Passed and a gap without a development requirement", async () => {
    const snapshot = await hrSnapshot();
    expect(alertPeople(snapshot, "training-not-passed")).toEqual([nameOf(ENA)]);
    expect(alertPeople(snapshot, "gap-no-requirement")).toContain(nameOf(DIAN));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentNeedVersion } from "@/modules/d4/development/types";
import type { KpiAssessment } from "@/modules/d4/supabase/types";
import type { TrainingVersion } from "@/modules/d4/training/types";
import { currentCompetencyStatus, currentGap, employeeSearchText, includesText, positionOf, type Snapshot } from "@/modules/d4/web/data/selectors";
import { competencySlices, dashboardAlerts, employeeHistory, gapRanking, performanceSlices, type DashboardRow } from "@/modules/d4/web/features/dashboard/summary";

async function hrSnapshot(): Promise<Snapshot> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource().loadSnapshot();
}
afterEach(() => { vi.unstubAllEnvs(); });

const employee = (id: string) => ({ id, employeeId: id, fullName: `Pegawai ${id}`, positionId: null, departmentId: null });
const scorecard = (overallScore: number, definitionVersion: string) => ({ overallScore, definitionVersion }) as KpiAssessment;
const rowsOf = (snapshot: Snapshot): DashboardRow[] => snapshot.reference.employees.map((item) => ({ employee: item, gap: currentCompetencyStatus(snapshot, item) }));

describe("People Dashboard charts", () => {
  it("counts Under / Average / High only for 1–100 scorecards and leaves 1–5 scorecards unrated", () => {
    const rows: DashboardRow[] = [
      { employee: employee("a"), gap: "Gap", scorecard: scorecard(79.99, "V6") },
      { employee: employee("b"), gap: "Gap", scorecard: scorecard(80, "V6") },
      { employee: employee("c"), gap: "Gap", scorecard: scorecard(85.01, "V6") },
      { employee: employee("d"), gap: "Gap", scorecard: scorecard(4.5, "V5.1") },
      { employee: employee("e"), gap: "Gap" },
    ];
    const { slices, rated, total } = performanceSlices(rows);
    expect(slices.map((item) => [item.label, item.count])).toEqual([["Under Performance", 1], ["Average Performance", 1], ["High Performance", 1]]);
    expect([rated, total]).toEqual([3, 5]);
  });

  it("merges statuses that read the same into one competency slice, and the slices add up to every row", () => {
    const statuses = ["Bukti Belum Cukup", "Belum Ada Persyaratan", "Gap", "Terpenuhi", "Not Evaluated", "Gap"];
    const slices = competencySlices(statuses.map((gap, index) => ({ employee: employee(String(index)), gap })));
    expect(slices.map((item) => [item.label, item.count])).toEqual([["Met", 1], ["Insufficient Data", 2], ["Gap", 2], ["Not Evaluated", 1]]);
    expect(slices.reduce((sum, item) => sum + item.count, 0)).toBe(statuses.length);
  });

  it("ranks gaps of assessed employees only, and alerts follow the requirement a need was raised from", async () => {
    const base = await hrSnapshot();
    const target = base.reference.employees.find((item) => currentCompetencyStatus(base, item) !== "Not Evaluated" && currentGap(base, item)?.findings.some((finding) => finding.status === "Gap"));
    expect(target).toBeDefined();
    const finding = currentGap(base, target!)!.findings.find((item) => item.status === "Gap")!;
    const need = (status: DevelopmentNeedVersion["status"], extra: Partial<DevelopmentNeedVersion> = {}): DevelopmentNeedVersion => ({
      ...base.developmentVersions[0], id: `T-${status}`, needId: "T-NEED", revision: 1, employeeId: target!.id, sourceType: "competency_gap", sourceRef: finding.requirementId, status, pic: "Bu Maya", ...extra,
    });
    const keys = (snapshot: Snapshot) => dashboardAlerts(snapshot, rowsOf(snapshot)).filter((alert) => alert.people.includes(target!.fullName)).map((alert) => alert.key);

    const noNeeds = { ...base, developmentVersions: [], trainingVersions: [] };
    expect(gapRanking(noNeeds, rowsOf(noNeeds)).some((item) => item.id === finding.competencyId)).toBe(true);
    expect(keys(noNeeds)).toContain("gap-no-requirement");
    // The same employee marked Not Evaluated drops out of the bars, as in the competency donut.
    const notEvaluated = rowsOf(noNeeds).map((row) => row.employee.id === target!.id ? { ...row, gap: "Not Evaluated" } : row);
    expect(gapRanking(noNeeds, notEvaluated).reduce((sum, item) => sum + item.count, 0)).toBeLessThan(gapRanking(noNeeds, rowsOf(noNeeds)).reduce((sum, item) => sum + item.count, 0));

    // A need for another requirement does not answer this gap.
    const otherRequirement = { ...noNeeds, developmentVersions: [need("Planned", { sourceRef: "another-requirement" })] };
    expect(keys(otherRequirement)).toContain("gap-no-requirement");

    const completed = { ...noNeeds, developmentVersions: [need("Completed")] };
    expect(keys(completed)).toContain("completed-gap-open");
    expect(keys(completed)).not.toContain("gap-no-requirement");
    // Q14 (P7-E): a recorded decision alone no longer clears it; only a newer assessment showing the level met does.
    const decided = { ...noNeeds, developmentVersions: [need("Completed"), need("Completed", { id: "T-Decided", revision: 2, reassessment: "Meets requirement" })] };
    expect(keys(decided)).toContain("completed-gap-open");

    const noPic = { ...noNeeds, developmentVersions: [need("In Progress", { pic: "" })] };
    expect(keys(noPic)).toContain("requirement-no-pic");

    const training = (id: string, date: string, status: TrainingVersion["status"], result: string): TrainingVersion => ({
      ...(base.trainingVersions[0] as TrainingVersion), id, trainingId: id, revision: 1, employeeId: target!.id, developmentNeedId: "T-NEED", date, status, result, createdAt: `${date}T08:00:00.000Z`,
    });
    const notPassed = { ...noNeeds, developmentVersions: [need("In Progress")], trainingVersions: [training("T1", "2026-10-01", "Completed", "Not Passed")] };
    expect(keys(notPassed)).toContain("training-not-passed");
    const retrained = { ...notPassed, trainingVersions: [...notPassed.trainingVersions, training("T2", "2026-10-20", "Planned", "")] };
    expect(keys(retrained)).not.toContain("training-not-passed");
  });
});

describe("employee history timeline", () => {
  const ALFA = "d4000000-0000-4000-8000-000000000009";
  const TAX_MANAGER = "d4000000-0000-4000-8000-000000000018";

  it("merges every module newest first, by WIB day, and links each entry to its source", async () => {
    const base = await hrSnapshot();
    const assessment = base.competency.find((item) => item.employeeId === ALFA)!;
    const need = base.developmentVersions.find((item) => item.employeeId === ALFA)!;
    const training = base.trainingVersions.find((item) => item.employeeId === ALFA)!;
    const snapshot: Snapshot = {
      ...base,
      competency: [
        { ...assessment, id: "C-OLD", effectiveDate: "2026-10-03", createdAt: "2026-10-03T02:00:00.000Z" },
        { ...assessment, id: "C-MOVE", positionId: TAX_MANAGER, context: "role-change", effectiveDate: "2026-10-05", createdAt: "2026-10-05T09:00:00.000Z", assessedWith: "Rina, Ops Manager" },
        { ...base.competency.find((item) => item.employeeId !== ALFA)!, id: "C-OTHER", effectiveDate: "2026-10-06" },
      ],
      kpiAssessments: [{ ...base.kpiAssessments!.find((item) => item.employeeId === ALFA)!, id: "K1", period: "2026-11", definitionVersion: "V6", overallScore: 82.5, evaluationDate: "2026-10-05", createdAt: "2026-10-05T01:00:00.000Z" }],
      developmentVersions: [
        { ...need, id: "D1", revision: 1, status: "Identified", pic: "", createdAt: "2026-10-01T03:00:00.000Z" },
        { ...need, id: "D2", revision: 2, status: "Planned", pic: "Bu Maya", createdAt: "2026-10-05T03:00:00.000Z" },
      ],
      // 20:00 UTC on the 4th is 03:00 WIB on the 5th: same day as the others, not the day before.
      trainingVersions: [{ ...training, id: "T1", revision: 1, status: "Completed", result: "Passed", createdAt: "2026-10-04T20:00:00.000Z" }],
    };
    const history = employeeHistory(snapshot, ALFA);
    expect(history.map((item) => item.id)).toEqual(["competency-C-MOVE", "development-D2", "performance-K1", "training-T1", "competency-C-OLD", "development-D1"]);
    const [move, revision, review, trained] = history;
    expect(move).toMatchObject({ title: "Position change assessment · Tax Manager", date: "Efektif 5 Okt 2026", href: `/competency/${ALFA}/history` });
    expect(move.body).toContain("Dinilai bersama Rina, Ops Manager");
    expect(revision).toMatchObject({ status: "Planned", href: `/development/${need.needId}` });
    expect(revision.body).toContain("PIC: — → Bu Maya");
    expect(review).toMatchObject({ title: "Performance Review November 2026 · 82.50 / 100", status: "Average Performance", href: "/performance/scorecard/K1" });
    expect(trained).toMatchObject({ status: "Completed", body: expect.stringContaining("Result: Passed"), href: `/training/${training.trainingId}` });
    expect(history.at(-2)?.title).toMatch(/^Competency assessment/);
  });
});

describe("list search", () => {
  it("finds an employee by position title as well as by name and Employee ID", async () => {
    const snapshot = await hrSnapshot();
    const person = snapshot.reference.employees.find((item) => positionOf(snapshot, item))!;
    const title = positionOf(snapshot, person)!.title;
    expect(includesText(employeeSearchText(snapshot, person), title.toUpperCase())).toBe(true);
    expect(includesText(employeeSearchText(snapshot, person), person.employeeId)).toBe(true);
    expect(includesText(employeeSearchText(snapshot, person), "posisi-yang-tidak-ada")).toBe(false);
  });
});

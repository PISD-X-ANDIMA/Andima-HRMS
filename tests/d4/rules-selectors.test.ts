import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevelopmentRollback, isTrainingRollback, localMonth, localToday, revisionNumber } from "@/modules/d4/shared/rules";
import { assessableEmployees, canWrite, formatPeriod, formatResult, periodsOf, revisionTag, visibleEmployees } from "@/modules/d4/web/data/selectors";
import type { DevelopmentStatus } from "@/modules/d4/development/types";
import type { TrainingStatus } from "@/modules/d4/training/types";

const ALFA = "d4000000-0000-4000-8000-000000000009";
const MERCURY = "d4000000-0000-4000-8000-000000000012";
const ECHO = "d4000000-0000-4000-8000-000000000014"; // fixture manager (Finance)
const HOLLY = "d4000000-0000-4000-8000-000000000016"; // Finance, Echo's team
const BRAVO = "d4000000-0000-4000-8000-000000000010"; // Sales, outside Echo's team

async function fixtureAs(role: "HR" | "MANAGER" | "EMPLOYEE") {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", role);
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
afterEach(() => { vi.unstubAllEnvs(); });

describe("WIB dates", () => {
  it("uses the Jakarta date before 07:00 WIB, when UTC is still yesterday", () => {
    const earlyMorning = new Date("2026-09-30T17:30:00Z"); // 00:30 WIB on 1 Oct
    expect(localToday(earlyMorning)).toBe("2026-10-01");
    expect(localMonth(new Date("2026-09-30T18:00:00Z"))).toBe("2026-10");
  });
});

describe("training rollback", () => {
  const statuses: TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];
  const rollbacks = new Set(["In Progress>Planned", "Completed>Planned", "Completed>In Progress", "Completed>Cancelled", "Cancelled>Planned", "Cancelled>In Progress", "Cancelled>Completed"]);
  it.each(statuses.flatMap((from) => statuses.map((to) => [from, to] as const)))("%s → %s", (from, to) => {
    expect(isTrainingRollback(from, to)).toBe(rollbacks.has(`${from}>${to}`));
  });
});

describe("development rollback", () => {
  const statuses: DevelopmentStatus[] = ["Identified", "Planned", "In Progress", "Completed"];
  it.each(statuses.flatMap((from) => statuses.map((to) => [from, to] as const)))("%s → %s", (from, to) => {
    expect(isDevelopmentRollback(from, to)).toBe(statuses.indexOf(to) < statuses.indexOf(from));
  });
});

describe("display formatting", () => {
  it("shows the evaluation result with its V5.1 label and Indonesian month names", () => {
    expect(formatResult(4)).toBe("4 · Baik");
    expect(formatResult(null)).toBe("—");
    expect(formatPeriod("2026-09")).toBe("September 2026");
  });

  it("lists periods newest first, so the first is the default cycle", () => {
    expect(periodsOf([{ period: "2026-06" }, { period: "2026-09" }, { period: "2026-06" }])).toEqual(["2026-09", "2026-06"]);
  });
});

describe("revision numbering", () => {
  const records = [
    { id: "a", employeeId: ALFA, period: "2026-09", createdAt: "2026-09-01T00:00:00Z" },
    { id: "b", employeeId: ALFA, period: "2026-09", createdAt: "2026-09-02T00:00:00Z" },
    { id: "c", employeeId: ALFA, period: "2026-08", createdAt: "2026-09-03T00:00:00Z" },
  ];
  it("counts only the same employee and period", () => {
    expect(records.map((item) => revisionNumber(records, item))).toEqual([1, 2, 1]);
    expect(records.map((item) => revisionTag(records, item))).toEqual(["", " · Revisi 2", ""]);
  });
});

describe("role views (fixture)", () => {
  it("HR writes, sees everyone, and cannot pick themselves", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    expect(canWrite(snapshot)).toBe(true);
    expect(visibleEmployees(snapshot).length).toBe(snapshot.reference.employees.length);
    expect(assessableEmployees(snapshot).some((item) => item.id === MERCURY)).toBe(false);
  });

  it("MANAGER writes, sees only their own department and never themselves", async () => {
    const source = await fixtureAs("MANAGER");
    const snapshot = await source.loadSnapshot();
    expect(canWrite(snapshot)).toBe(true);
    expect(snapshot.actorEmployeeId).toBe(ECHO);
    expect(visibleEmployees(snapshot).map((item) => item.id).sort()).toEqual([ALFA, HOLLY].sort());
    expect(assessableEmployees(snapshot)).toEqual(visibleEmployees(snapshot));
    const records = [...snapshot.performance, ...(snapshot.kpiAssessments ?? []), ...snapshot.competency, ...snapshot.developmentVersions, ...snapshot.trainingVersions];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((item) => item.employeeId === ALFA || item.employeeId === HOLLY)).toBe(true);
    await expect(source.createEvaluation({ employeeId: BRAVO, period: "2026-10", evaluationDate: "2026-10-01", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Uji", evidenceReference: null })).rejects.toThrow(/anggota tim/);
    await source.createEvaluation({ employeeId: HOLLY, period: "2026-10", evaluationDate: "2026-10-01", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Uji", evidenceReference: null });
  });

  it("EMPLOYEE is read-only and receives only their own records", async () => {
    const source = await fixtureAs("EMPLOYEE");
    const snapshot = await source.loadSnapshot();
    expect(canWrite(snapshot)).toBe(false);
    expect(visibleEmployees(snapshot).map((item) => item.id)).toEqual([ALFA]);
    expect(assessableEmployees(snapshot)).toEqual([]);
    const records = [...snapshot.performance, ...(snapshot.kpiAssessments ?? []), ...snapshot.competency, ...snapshot.developmentVersions, ...snapshot.trainingVersions];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((item) => item.employeeId === ALFA)).toBe(true);
    await expect(source.createEvaluation({ employeeId: MERCURY, period: "2026-10", evaluationDate: "2026-10-01", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "", evidenceReference: null })).rejects.toThrow(/Hanya HR/);
  });
});

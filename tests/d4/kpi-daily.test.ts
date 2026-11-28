import { afterEach, describe, expect, it, vi } from "vitest";
import { allTopScores, bandRun, compileDaily, dailyEntriesOf, dailyHistoryOf } from "@/modules/d4/kpi/daily";
import { assertDailyDate, canFillDaily, localToday } from "@/modules/d4/shared/rules";
import type { KpiDailyEntry } from "@/modules/d4/supabase/types";

const WEIGHTS = [30, 25, 15, 15, 15];
function entry(day: string, scores: number[], patch: Partial<KpiDailyEntry> = {}): KpiDailyEntry {
  const lines = scores.map((score, index) => ({ indicator_order: index + 1, kpi_name: `KPI ${index + 1}`, weight_percent: WEIGHTS[index], target: "85", actual: String(score), raw_score: score, comment: "" }));
  const overallScore = Math.round(lines.reduce((sum, line) => sum + line.weight_percent * line.raw_score / 100, 0) * 100) / 100;
  return { id: `${day}-${patch.createdAt ?? ""}`, definitionVersion: "V6", employeeId: "e1", entryDate: `2026-11-${day}`, period: "2026-11", roleOrder: 5, roleName: "Customs", lines, overallScore, createdAt: `2026-11-${day}T10:00:00Z`, ...patch };
}

describe("compileDaily", () => {
  it("averages each indicator over the days and rounds to whole scores, which the scorecard trigger requires", () => {
    // 87 and 88 average to 87.5: an unrounded prefill would fail the trigger's integer cast when HR saves.
    const result = compileDaily([entry("02", [87, 80, 90, 85, 70]), entry("03", [88, 81, 90, 85, 71])], "e1", "2026-11")!;
    expect(result.scores).toEqual([88, 81, 90, 85, 71]);
    expect(result.scores.every(Number.isInteger)).toBe(true);
    expect(result.days).toHaveLength(2);
    expect(result.total).toBe(Math.round((30 * 88 + 25 * 81 + 15 * 90 + 15 * 85 + 15 * 71) / 100 * 100) / 100);
  });

  it("counts only the newest row of a day (a correction is a new row)", () => {
    const old = entry("02", [60, 60, 60, 60, 60], { createdAt: "2026-11-02T08:00:00Z" });
    const fixed = entry("02", [90, 90, 90, 90, 90], { createdAt: "2026-11-02T09:00:00Z" });
    expect(dailyEntriesOf([fixed, old], "e1", "2026-11")).toEqual([fixed]);
    expect(compileDaily([old, fixed], "e1", "2026-11")!.scores).toEqual([90, 90, 90, 90, 90]);
  });

  it("ignores other employees and periods, and returns null without entries", () => {
    expect(compileDaily([entry("02", [90, 90, 90, 90, 90], { employeeId: "e2" })], "e1", "2026-11")).toBeNull();
    expect(compileDaily([entry("02", [90, 90, 90, 90, 90], { period: "2026-10", entryDate: "2026-10-02" })], "e1", "2026-11")).toBeNull();
  });

  it("does not mix KPI sets when the position changed during the period", () => {
    const before = entry("02", [50, 50, 50, 50, 50], { roleOrder: 4 });
    const after = entry("03", [90, 90, 90, 90, 90]);
    const result = compileDaily([before, after], "e1", "2026-11")!;
    expect(result.days).toEqual([after]);
    expect(result.roleOrder).toBe(5);
  });
});

// R1 (lecturer review, 10 Nov 2026): a corrected day keeps its earlier rows, shown in History like Performance Review.
describe("dailyHistoryOf", () => {
  const first = entry("06", [78, 80, 80, 80, 80], { createdAt: "2026-11-06T10:00:00Z" });
  const fixed = entry("06", [78, 90, 80, 80, 80], { createdAt: "2026-11-06T15:00:00Z" });
  const next = entry("07", [85, 85, 85, 85, 85], { createdAt: "2026-11-07T10:00:00Z" });
  const other = entry("07", [50, 50, 50, 50, 50], { employeeId: "e2", createdAt: "2026-11-07T11:00:00Z" });

  it("keeps every saved row, newest day and newest save first, with its revision for that day", () => {
    const history = dailyHistoryOf([first, next, fixed, other], "e1", "2026-11");
    expect(history.map((item) => [item.entry.id, item.revision, item.versions])).toEqual([[next.id, 1, 1], [fixed.id, 2, 2], [first.id, 1, 2]]);
  });

  it("points a correction at the row it replaced", () => {
    const history = dailyHistoryOf([first, fixed], "e1", "2026-11");
    expect(history[0].previous).toBe(first);
    expect(history[1].previous).toBeUndefined();
  });

  it("still counts only the newest row of a day in the compilation", () => {
    expect(dailyEntriesOf([first, fixed], "e1", "2026-11")).toEqual([fixed]);
  });
});

describe("bandRun and allTopScores (interview D4, 14 Oct 2026: X-24)", () => {
  it("counts the run of most recent entries in one band: Under below 80, High above 85", () => {
    const days = [entry("02", [70, 70, 70, 70, 70]), entry("03", [90, 90, 90, 90, 90]), entry("04", [79, 79, 79, 79, 79]), entry("05", [60, 60, 60, 60, 60])];
    expect(bandRun(days, "Under Performance")).toBe(2);
    expect(bandRun(days, "High Performance")).toBe(0);
    // 80 and 85 are Average, so they end a run of either band.
    expect(bandRun([entry("02", [86, 86, 86, 86, 86]), entry("03", [85, 85, 85, 85, 85])], "High Performance")).toBe(0);
    expect(bandRun([entry("02", [86, 86, 86, 86, 86]), entry("03", [90, 90, 90, 90, 90])], "High Performance")).toBe(2);
  });

  it("is 0 for 1–5 entries, which have no band", () => {
    expect(bandRun([entry("02", [3, 3, 3, 3, 3], { definitionVersion: "V5.1" })], "Under Performance")).toBe(0);
  });

  it("flags an entry only when every KPI is 100 on the 1–100 scale", () => {
    expect(allTopScores(entry("02", [100, 100, 100, 100, 100]))).toBe(true);
    expect(allTopScores(entry("02", [100, 100, 100, 100, 99]))).toBe(false);
    expect(allTopScores(entry("02", [5, 5, 5, 5, 5], { definitionVersion: "V5.1" }))).toBe(false);
  });
});

describe("daily rules", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("lets every linked account fill its own day except directors (MANAGEMENT, decision 13 Nov 2026)", () => {
    expect(canFillDaily("EMPLOYEE", "e1")).toBe(true);
    expect(canFillDaily("HR", "e1")).toBe(true);
    expect(canFillDaily("MANAGER", "e1")).toBe(true);
    expect(canFillDaily("MANAGEMENT", "e1")).toBe(false);
    expect(canFillDaily("EMPLOYEE", null)).toBe(false);
  });

  it("accepts today and earlier days of the running WIB period only", () => {
    // 1 Nov 2026 03:00 WIB is still 31 Oct in UTC; the WIB day decides.
    const now = new Date("2026-10-31T20:00:00Z");
    expect(localToday(now)).toBe("2026-11-01");
    expect(() => assertDailyDate("2026-11-01", now)).not.toThrow();
    expect(() => assertDailyDate("2026-11-02", now)).toThrow(/lebih dari hari ini/);
    expect(() => assertDailyDate("2026-10-31", now)).toThrow(/periode berjalan \(2026-11\)/);
  });
});

describe("Daily KPI on the People Dashboard and in the Performance Review form", async () => {
  const { d4ReferenceFixture } = await import("@/modules/d4/shared/fixtures");
  const { catalogFor, seedCatalogSet } = await import("@/modules/d4/kpi/catalog");
  const { localMonth } = await import("@/modules/d4/shared/rules");
  const { dashboardAlerts } = await import("@/modules/d4/web/features/dashboard/summary");
  const { withDaily } = await import("@/modules/d4/web/features/kpi/KpiFormModal");
  type Snapshot = Parameters<typeof dashboardAlerts>[0];

  const [low, none] = d4ReferenceFixture.employees.filter((item) => item.positionId);
  const period = localMonth();
  const day = (n: number, total: number, employeeId = low.id) => entry(String(n).padStart(2, "0"), [total, total, total, total, total], { employeeId, period, entryDate: `${period}-${String(n).padStart(2, "0")}` });
  const alerts = (kpiDaily: KpiDailyEntry[] | undefined) => {
    const snapshot = { reference: d4ReferenceFixture, role: "HR", actorEmployeeId: "", kpi: [], performance: [], competency: [], developmentVersions: [], trainingVersions: [], kpiDaily } as unknown as Snapshot;
    const rows = [low, none].map((employee) => ({ employee, gap: "" }));
    const catalog = catalogFor(seedCatalogSet(d4ReferenceFixture.positions), period);
    return Object.fromEntries(dashboardAlerts(snapshot, rows, catalog).map((alert) => [alert.key, alert.people]));
  };

  it("raises 'Under' after three entries in a row below 80 and 'missing' for an employee without entries", () => {
    const result = alerts([day(1, 90), day(2, 79), day(3, 70), day(4, 60)]);
    expect(result["daily-under"]).toEqual([low.fullName]);
    expect(result["daily-missing"]).toEqual([none.fullName]);
    // Below the target 85 but Average (80–85) is not Under Performance.
    expect(alerts([day(1, 84), day(2, 80), day(3, 82)])["daily-under"]).toBeUndefined();
  });

  it("raises 'High' after three entries in a row above 85, and 'all 100' for any entry with 100 on every KPI", () => {
    const result = alerts([day(1, 86), day(2, 90), day(3, 100)]);
    expect(result["daily-high"]).toEqual([low.fullName]);
    expect(result["daily-all-top"]).toEqual([low.fullName]);
    expect(alerts([day(1, 90), day(2, 85), day(3, 90)])["daily-high"]).toBeUndefined();
  });

  it("raises nothing before the daily table exists", () => {
    const result = alerts(undefined);
    expect(result["daily-under"]).toBeUndefined();
    expect(result["daily-missing"]).toBeUndefined();
  });

  it("pre-fills Actual with the rounded averages", () => {
    const lines = Array.from({ length: 5 }, (_, index) => ({ indicator_order: index + 1, kpi_name: "K", weight_percent: 20, target: "85", actual: "", raw_score: null, comment: "" }));
    const compiled = compileDaily([entry("02", [87, 80, 90, 85, 70]), entry("03", [88, 81, 90, 85, 71])], "e1", "2026-11");
    expect(withDaily(lines, compiled).map((line) => [line.actual, line.raw_score])).toEqual([["88", 88], ["81", 81], ["90", 90], ["85", 85], ["71", 71]]);
    expect(withDaily(lines, null)).toBe(lines);
  });
});

describe("Finalize from Daily KPI (B6: automatic compilation, HR finalizes)", async () => {
  const { scorecardLinesFromDaily } = await import("@/modules/d4/kpi/daily");
  const { catalogFor, seedCatalogSet } = await import("@/modules/d4/kpi/catalog");
  const { d4ReferenceFixture } = await import("@/modules/d4/shared/fixtures");
  const { pendingCompilation } = await import("@/modules/d4/web/data/selectors");
  const { localMonth } = await import("@/modules/d4/shared/rules");

  it("builds catalog lines carrying the compiled scores as Actual", () => {
    const catalog = catalogFor(seedCatalogSet(d4ReferenceFixture.positions), "2026-11")!;
    const compiled = { definitionVersion: "V6", roleOrder: 10, days: [], scores: [88, 81, 90, 85, 71], total: 0 };
    const lines = scorecardLinesFromDaily(catalog, compiled);
    expect(lines.map((line) => [line.indicator_order, line.raw_score, line.actual, line.target])).toEqual([[1, 88, "88", "85"], [2, 81, "81", "85"], [3, 90, "90", "85"], [4, 85, "85", "85"], [5, 71, "71", "85"]]);
    expect(lines.reduce((sum, line) => sum + line.weight_percent, 0)).toBe(100);
  });

  it("shows the compilation until HR finalizes it, then the scorecard takes over", async () => {
    vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
    vi.resetModules();
    const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
    const { pendingCompilation: pending } = await import("@/modules/d4/web/data/selectors");
    const { scorecardLinesFromDaily: linesOf } = await import("@/modules/d4/kpi/daily");
    const source = createFixtureSource();
    const before = await source.loadSnapshot();
    const employee = before.kpiDaily?.[0]?.employeeId;
    if (!employee) return; // 1st of the month: the fixture has no earlier day yet.
    const period = localMonth();
    const compiled = pending(before, employee, period)!;
    expect(compiled.days.length).toBeGreaterThan(0);
    const catalog = catalogFor(seedCatalogSet(before.reference.positions), period)!;
    await source.createKpiAssessment({ employeeId: employee, roleOrder: compiled.roleOrder, period, evaluationDate: "", evaluatorName: "", status: "completed",
      lines: linesOf(catalog, compiled), generalNotes: "Final", evidenceReference: "DOC-1", revisionOf: null });
    const after = await source.loadSnapshot();
    expect(pending(after, employee, period)).toBeNull();
    expect(after.kpiAssessments?.find((item) => item.employeeId === employee && item.period === period)?.overallScore).toBe(compiled.total);
    vi.unstubAllEnvs();
  });

  it("is null for a period that already has a scorecard", () => {
    const base = { reference: d4ReferenceFixture, role: "HR", actorEmployeeId: "", kpi: [], performance: [], competency: [], developmentVersions: [], trainingVersions: [], kpiDaily: [entry("02", [90, 90, 90, 90, 90])] };
    expect(pendingCompilation({ ...base, kpiAssessments: [] } as never, "e1", "2026-11")?.total).toBe(90);
    expect(pendingCompilation({ ...base, kpiAssessments: [{ id: "s", employeeId: "e1", period: "2026-11", createdAt: "x" }] } as never, "e1", "2026-11")).toBeNull();
  });
});

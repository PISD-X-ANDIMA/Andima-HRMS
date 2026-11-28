import { describe, expect, it } from "vitest";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import type { KpiAssessment, KpiDailyEntry } from "@/modules/d4/supabase/types";
import type { Snapshot } from "@/modules/d4/web/data/selectors";
import { dashboardAlerts, unfinalizedPeriods, type DashboardRow } from "@/modules/d4/web/features/dashboard/summary";
import { targetLabel } from "@/modules/d4/web/features/kpi/KpiFormModal";

const [first, second] = d4ReferenceFixture.employees.filter((item) => item.positionId);
const snapshotWith = (kpiDaily: readonly KpiDailyEntry[] = [], kpiAssessments: KpiAssessment[] = []) =>
  ({ reference: d4ReferenceFixture, role: "HR", actorEmployeeId: "", kpi: [], performance: [], competency: [], developmentVersions: [], trainingVersions: [], kpiDaily, kpiAssessments }) as unknown as Snapshot;
const under = (employeeId: string) => ({ id: `sc-${employeeId}`, employeeId, period: "2026-10", overallScore: 70, definitionVersion: "V6", lines: Array.from({ length: 5 }, (_, index) => ({ indicator_order: index + 1, weight_percent: 20 })) }) as unknown as KpiAssessment;
const day = (employeeId: string, period: string, n: number): KpiDailyEntry => ({
  id: `${employeeId}-${period}-${n}`, definitionVersion: "V6", employeeId, entryDate: `${period}-${String(n).padStart(2, "0")}`, period, roleOrder: 5, roleName: "Customs",
  lines: Array.from({ length: 5 }, (_, index) => ({ indicator_order: index + 1, kpi_name: `KPI ${index + 1}`, weight_percent: 20, target: "85", actual: "90", raw_score: 90, comment: "" })),
  overallScore: 90, createdAt: `${period}-${String(n).padStart(2, "0")}T10:00:00Z`,
});
const find = (alerts: ReturnType<typeof dashboardAlerts>, key: string) => alerts.find((item) => item.key === key);

describe("People Dashboard alerts (audit round 2, G2)", () => {
  it("K15: an alert about one person links to the list narrowed to them, and Under Performance keeps the period", () => {
    const one = dashboardAlerts(snapshotWith(), [{ employee: first, gap: "", scorecard: under(first.id) }], null, "2026-10");
    expect(find(one, "under-performance")?.href).toBe(`/performance?period=2026-10&q=${encodeURIComponent(first.fullName)}`);
    const two = dashboardAlerts(snapshotWith(), [first, second].map((employee): DashboardRow => ({ employee, gap: "", scorecard: under(employee.id) })), null, "2026-10");
    expect(find(two, "under-performance")?.href).toBe("/performance?period=2026-10");
  });

  it("K3: Under Performance names the period shown; the Daily KPI alerts name the running month", () => {
    const alerts = dashboardAlerts(snapshotWith(), [{ employee: first, gap: "", scorecard: under(first.id) }], null, "2026-10", "2026-11");
    expect(find(alerts, "under-performance")?.detail).toContain("Oct 2026");
    const below = [1, 2, 3].map((n) => ({ ...day(first.id, "2026-11", n), overallScore: 70 }));
    expect(find(dashboardAlerts(snapshotWith(below), [{ employee: first, gap: "" }], null, "2026-10", "2026-11"), "daily-under")?.detail).toContain("Nov 2026");
  });

  it("K9: the follow-up instruction is a separate sentence the page shows to writers only", () => {
    const alert = find(dashboardAlerts(snapshotWith(), [{ employee: first, gap: "", scorecard: under(first.id) }], null, "2026-10"), "under-performance")!;
    expect(alert.detail).not.toMatch(/Assign training|HR menindaklanjuti/);
    expect(alert.action).toMatch(/Assign training/);
  });

  it("W1: a compiled month that ended without finalization stays visible after the month changes", () => {
    const snapshot = snapshotWith([day(first.id, "2026-11", 3), day(first.id, "2026-11", 4), day(first.id, "2026-12", 1)]);
    expect(unfinalizedPeriods(snapshot, first.id, "2026-11")).toEqual([]);
    expect(unfinalizedPeriods(snapshot, first.id, "2026-12")).toEqual(["2026-11"]);
    const alert = find(dashboardAlerts(snapshot, [{ employee: first, gap: "" }], null, "2026-12", "2026-12"), "daily-not-finalized");
    expect(alert?.people).toEqual([first.fullName]);
    expect(alert?.href).toBe(`/performance?period=2026-11&q=${encodeURIComponent(first.fullName)}`);
    // Finalized: the period has a scorecard, so nothing is left to do.
    const finalized = snapshotWith(snapshot.kpiDaily, [{ ...under(first.id), period: "2026-11" }]);
    expect(find(dashboardAlerts(finalized, [{ employee: first, gap: "" }], null, "2026-12", "2026-12"), "daily-not-finalized")).toBeUndefined();
  });
});

describe("K6: target shown on a scorecard", () => {
  it("shows the stored target on the 1-100 scale and none on the 1-5 scale", () => {
    expect(targetLabel("85", "V6")).toBe("85");
    expect(targetLabel("85", "V5.1")).toBe("—");
    expect(targetLabel("85", "V3.1")).toBe("—");
  });
});

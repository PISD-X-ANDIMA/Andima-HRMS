import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentNeedVersion, DevelopmentStatus } from "@/modules/d4/development/types";
import type { KpiAssessment } from "@/modules/d4/supabase/types";
import { localToday } from "@/modules/d4/shared/rules";
import { inTrainingOrPositionChange, visibleEmployees } from "@/modules/d4/web/data/selectors";
import { competencyRows, type CompetencyFilters } from "@/modules/d4/web/features/competency/rows";
import { matchesDashboardFilters, openNeedCount, type DashboardFilters, type DashboardRow } from "@/modules/d4/web/features/dashboard/summary";
import { developmentRows, needCompetencyIds, type DevelopmentFilters } from "@/modules/d4/web/features/development/rows";

// Employees are picked by id or by rule, never by name: the fixture names are being replaced with real ones.
async function fixtureAs(role: "HR" | "EMPLOYEE") {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", role);
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
afterEach(() => { vi.unstubAllEnvs(); });

const NO_FILTER: CompetencyFilters = { search: "", position: "", department: "", status: "", competency: "" };
const NO_DEV_FILTER: DevelopmentFilters = { search: "", department: "", sourceType: "", status: "", period: "", competency: "", priority: "" };
/** Combined filters keep exactly the rows every single filter keeps. */
const intersect = (...lists: string[][]) => lists.reduce((all, list) => all.filter((id) => list.includes(id))).sort();

describe("Competency Gap list scope (UAT-11)", () => {
  it("lists only employees in scope for HR, with no way to list everyone", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    const listed = competencyRows(snapshot, NO_FILTER).map((row) => row.employee.id);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((id) => inTrainingOrPositionChange(snapshot, id))).toBe(true);
    expect(listed.length).toBeLessThan(visibleEmployees(snapshot).length);
  });

  it("Assess Position Change works for an employee outside the list and brings them into it", async () => {
    const source = await fixtureAs("HR");
    const before = await source.loadSnapshot();
    const outside = visibleEmployees(before).find((item) => item.positionId && !inTrainingOrPositionChange(before, item.id))!;
    expect(outside).toBeDefined();
    expect(competencyRows(before, NO_FILTER).map((row) => row.employee.id)).not.toContain(outside.id);
    const newPosition = before.reference.positions.find((item) => item.id !== outside.positionId && before.reference.positionRequirements.some((requirement) => requirement.positionId === item.id))!;
    await source.saveCompetency({ employeeId: outside.id, positionId: newPosition.id, effectiveDate: localToday() });
    const after = await source.loadSnapshot();
    expect(after.competency.find((item) => item.employeeId === outside.id)?.context).toBe("role-change");
    expect(competencyRows(after, NO_FILTER).map((row) => row.employee.id)).toContain(outside.id);
  });

  it("an employee always sees their own row, in scope or not", async () => {
    const snapshot = await (await fixtureAs("EMPLOYEE")).loadSnapshot();
    expect(competencyRows(snapshot, NO_FILTER).map((row) => row.employee.id)).toEqual([snapshot.actorEmployeeId]);
  });
});

describe("Need training tile (UAT-19)", () => {
  it("counts requirements whose latest revision is not Completed, including one reopened by Retraining", async () => {
    const base = await (await fixtureAs("HR")).loadSnapshot();
    const id = base.reference.employees[0].id;
    const version = (needId: string, revision: number, status: DevelopmentStatus) => ({ id: `${needId}-${revision}`, needId, revision, source: "fixture", employeeId: id,
      sourceType: "competency_gap", sourceRef: needId, objective: "x", priority: "Medium", status, notes: "", createdAt: `2026-10-0${revision}T00:00:00Z`, actor: "HR" }) as DevelopmentNeedVersion;
    const finished = [version("done", 1, "Identified"), version("done", 2, "Completed")];
    const snapshot = { ...base, developmentVersions: [...finished, version("again", 1, "Completed"), version("again", 2, "Planned"), version("open", 1, "In Progress")] };
    expect(openNeedCount(snapshot, id)).toBe(2);
    expect(openNeedCount({ ...base, developmentVersions: finished }, id)).toBe(0);
  });
});

describe("Competency Gap competency filter (FR-D4-002 A)", () => {
  it("keeps employees whose position requires the competency, and combines with status and department", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    const all = competencyRows(snapshot, NO_FILTER);
    const competency = all.flatMap((row) => row.findings).find((item) => all.some((row) => !row.findings.some((other) => other.competencyId === item.competencyId)))!.competencyId;
    const byCompetency = competencyRows(snapshot, { ...NO_FILTER, competency });
    expect(byCompetency.length).toBeGreaterThan(0);
    expect(byCompetency.length).toBeLessThan(all.length);
    expect(byCompetency.every((row) => row.findings.some((item) => item.competencyId === competency))).toBe(true);
    const ids = (filters: Partial<CompetencyFilters>) => competencyRows(snapshot, { ...NO_FILTER, ...filters }).map((row) => row.employee.id);
    const status = "Gap";
    const department = byCompetency[0].employee.departmentId ?? "";
    expect(ids({ competency, status, department }).sort()).toEqual(intersect(ids({ competency }), ids({ status }), ids({ department })));
  });
});

describe("Development Requirement competency and priority filters (FR-D4-002 B)", () => {
  it("maps a requirement to its competencies by source", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    const requirement = snapshot.reference.positionRequirements[0];
    expect(needCompetencyIds(snapshot, { sourceType: "competency_gap", sourceRef: requirement.id })).toEqual([requirement.competencyId]);
    const assessment = { ...snapshot.competency[0], id: "role-change-1", context: "role-change" as const, findings: [
      { ...snapshot.competency[0].findings[0], competencyId: "c-gap", status: "Gap" as const },
      { ...snapshot.competency[0].findings[0], competencyId: "c-met", status: "Terpenuhi" as const },
    ] };
    expect(needCompetencyIds({ ...snapshot, competency: [assessment] }, { sourceType: "role_change", sourceRef: assessment.id })).toEqual(["c-gap"]);
    expect(needCompetencyIds(snapshot, { sourceType: "performance_context", sourceRef: "any" })).toEqual([]);
  });

  it("filters by priority and competency, combinable with each other and the existing filters", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    const ids = (filters: Partial<DevelopmentFilters>) => developmentRows(snapshot, { ...NO_DEV_FILTER, ...filters }).map((need) => need.needId);
    const all = developmentRows(snapshot, NO_DEV_FILTER);
    const priority = all[0].priority;
    const byPriority = developmentRows(snapshot, { ...NO_DEV_FILTER, priority });
    expect(byPriority.every((need) => need.priority === priority)).toBe(true);
    expect(byPriority.length).toBeLessThan(all.length);
    const competency = all.flatMap((need) => needCompetencyIds(snapshot, need))[0];
    expect(competency).toBeDefined();
    const byCompetency = developmentRows(snapshot, { ...NO_DEV_FILTER, competency });
    expect(byCompetency.length).toBeGreaterThan(0);
    expect(byCompetency.every((need) => needCompetencyIds(snapshot, need).includes(competency))).toBe(true);
    const status = byCompetency[0].status;
    expect(ids({ competency, priority, status, sourceType: "competency_gap" }).sort()).toEqual(intersect(ids({ competency }), ids({ priority }), ids({ status }), ids({ sourceType: "competency_gap" })));
  });
});

describe("People Dashboard filters (FR-D4-004 B)", () => {
  // Five KPIs of 20%: a valid scorecard (FR-06.9), so it has a performance category.
  const scorecard = (overallScore: number, definitionVersion: string) => ({ overallScore, definitionVersion, lines: Array.from({ length: 5 }, () => ({ weight_percent: 20 })) }) as unknown as KpiAssessment;
  const person = (id: string) => ({ id, employeeId: id, fullName: id, positionId: null, departmentId: null });
  const rows: (DashboardRow & { training?: string })[] = [
    { employee: person("under-gap"), gap: "Gap", scorecard: scorecard(70, "V6"), training: "In Progress" },
    { employee: person("high-met"), gap: "Terpenuhi", scorecard: scorecard(90, "V6"), training: "Completed" },
    { employee: person("high-gap"), gap: "Gap", scorecard: scorecard(86, "V6"), training: "In Progress" },
    { employee: person("average-insufficient"), gap: "Bukti Belum Cukup", scorecard: scorecard(85, "V6") },
    { employee: person("five-point"), gap: "Not Evaluated", scorecard: scorecard(4.8, "V5.1"), training: "Planned" },
  ];
  const ids = (filters: Partial<DashboardFilters>) => rows.filter((row) => matchesDashboardFilters(row, { band: "", competency: "", training: "", ...filters })).map((row) => row.employee.id);

  it("filters by performance category, competency status and training status", () => {
    expect(ids({})).toHaveLength(rows.length);
    expect(ids({ band: "High Performance" })).toEqual(["high-met", "high-gap"]);
    expect(ids({ band: "Average Performance" })).toEqual(["average-insufficient"]); // 85 is still Average
    expect(ids({ band: "Under Performance" })).toEqual(["under-gap"]); // a 1–5 scorecard has no category
    expect(ids({ competency: "Insufficient Data" })).toEqual(["average-insufficient"]); // stored status, display label
    expect(ids({ competency: "Met" })).toEqual(["high-met"]);
    expect(ids({ training: "In Progress" })).toEqual(["under-gap", "high-gap"]);
  });

  it("combines all three", () => {
    expect(ids({ band: "High Performance", competency: "Gap", training: "In Progress" })).toEqual(["high-gap"]);
    expect(ids({ band: "High Performance", competency: "Gap", training: "Completed" })).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogFor, indicatorsFor, KPI_TARGET, KPI_V51_CATALOG, roleForPosition, roleForPositionTitle, rolesOf, scorableSet, seedCatalogSet, targetOf, type KpiCatalogSet } from "@/modules/d4/kpi/catalog";
import { loadCatalogSet } from "@/modules/d4/server/kpi-catalog";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4DataSource } from "@/modules/d4/web/data/source";
import { aboveScale, HIGH_ABOVE, performanceBand, scaleMaxOf, UNDER_BELOW } from "@/modules/d4/kpi/scale";
import { actualInput, catalogText, legacyRealisation, periodChange, scorecardTotal, weighted } from "@/modules/d4/web/features/kpi/KpiFormModal";

const catalog = { rows: KPI_V51_CATALOG };
const ALFA = "d4000000-0000-4000-8000-000000000009"; // Finance Staff → role 10 (weights 25/25/20/15/15)
const FINANCE_ROLE = 10;

describe("KPI V5.1 catalog: weights per role (FR-02.4, FR-06.9)", () => {
  const roles = rolesOf(catalog);

  it("serves V5.1 with ten roles", () => {
    expect(new Set(KPI_V51_CATALOG.map((row) => row.source_version))).toEqual(new Set(["V5.1"]));
    expect(roles.map((role) => role.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each(roles.map((role) => [role.order, role.name] as const))("role %i (%s) has five indicators, ordered 1–5, weights summing to exactly 100", (order) => {
    const indicators = indicatorsFor(catalog, order);
    expect(indicators.map((row) => row.indicator_order)).toEqual([1, 2, 3, 4, 5]);
    expect(indicators.every((row) => Number.isInteger(row.weight_percent) && row.weight_percent > 0)).toBe(true);
    expect(indicators.reduce((sum, row) => sum + row.weight_percent, 0)).toBe(100);
  });

  it("matches the V5.1 seed in the Supabase migration row by row", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql", import.meta.url)), "utf8");
    const seeded = [...sql.matchAll(/^\s*\((\d+),'((?:[^']|'')*)',(\d+),'((?:[^']|'')*)',null,(\d+),'V5\.1'\)/gm)]
      .map(([, role, roleName, indicator, kpiName, weight]) => ({ role_order: Number(role), role_name: roleName.replace(/''/g, "'"), indicator_order: Number(indicator), kpi_name: kpiName.replace(/''/g, "'"), weight_percent: Number(weight) }));
    expect(seeded).toHaveLength(KPI_V51_CATALOG.length);
    expect(seeded).toEqual(KPI_V51_CATALOG.map(({ role_order, role_name, indicator_order, kpi_name, weight_percent }) => ({ role_order, role_name, indicator_order, kpi_name, weight_percent })));
  });
});

describe("weighted KPI score (FR-02.5, FR-02.6)", () => {
  // Uneven example: Σ weight × score / 100 = 2.0 + 0.9 + 0.8 + 0.2 = 3.9 (in floating point 3.9000000000000004).
  const lines = [[40, 5], [30, 3], [20, 4], [10, 2]].map(([weight_percent, raw_score]) => ({ weight_percent, raw_score }));

  it("weights each line as weight × raw score / 100", () => {
    expect(lines.map((line) => weighted(line))).toEqual([2, 0.9, 0.8, 0.2]);
  });

  it("totals to 3.9 on the 1–5 scale once rounded to two decimals", () => {
    const raw = lines.reduce((sum, line) => sum + (weighted(line) ?? 0), 0);
    expect(raw).not.toBe(3.9); // floating-point noise is why the total is rounded
    expect(Math.round(raw * 100) / 100).toBe(3.9);
  });

  it.each([[null], [0], [6], [3.5]])("gives no weighted value for an invalid raw score %s", (raw_score) => {
    expect(weighted({ weight_percent: 40, raw_score })).toBeNull();
  });
});

describe("KPI score scale per catalog version", () => {
  it("scores V3.1 and V5.1 on 1–5 and every later version on 1–100", () => {
    expect([scaleMaxOf("V3.1"), scaleMaxOf("V5.1"), scaleMaxOf(undefined), scaleMaxOf(null)]).toEqual([5, 5, 5, 5]);
    expect([scaleMaxOf("V6"), scaleMaxOf("V7")]).toEqual([100, 100]);
  });

  it("bands a 1–100 score: below 80 under, 80–85 acceptable, above 85 high", () => {
    expect([UNDER_BELOW, HIGH_ABOVE]).toEqual([80, 85]);
    expect(performanceBand(79.99, "V6")).toBe("Under Performance");
    expect(performanceBand(80, "V6")).toBe("Average Performance");
    expect(performanceBand(85, "V6")).toBe("Average Performance");
    expect(performanceBand(85.01, "V6")).toBe("High Performance");
  });

  it("has no band for a 1–5 scorecard or a missing score", () => {
    expect(performanceBand(4.5, "V5.1")).toBeNull();
    expect(performanceBand(null, "V6")).toBeNull();
  });

  it("weights a 1–100 raw score with the same formula (weight × score / 100)", () => {
    expect(weighted({ weight_percent: 25, raw_score: 80 }, 100)).toBe(20);
    expect(weighted({ weight_percent: 25, raw_score: 80 })).toBeNull(); // 80 is not a valid 1–5 score
  });

  it("flags typed text above the scale so the score fields can refuse it", () => {
    for (const typed of ["101", "999", "1000", " 1000 ", "1e3", "100.5"]) expect(aboveScale(typed, 100), typed).toBe(true);
    expect(aboveScale("6", 5)).toBe(true);
    // Within the scale, empty, or not a number at all: left to the field's own error message, not refused.
    for (const typed of ["", "1", "85", "100", "0", "-5", "abc", "85.5"]) expect(aboveScale(typed, 100), typed).toBe(false);
  });
});

// Q4 (20 Oct 2026): Actual and Score are one column. The number typed in Actual is the raw score; notes go to Comment.
describe("KPI form: Actual is the score (Q4)", () => {
  const WEIGHTS = [25, 25, 20, 15, 15]; // Finance Staff, same weights in V5.1 and V6
  const fromActual = (actuals: string[]) => actuals.map((value, index) => ({ weight_percent: WEIGHTS[index], ...actualInput(value) }));

  it("turns the number typed in Actual into the raw score and keeps the same number as the actual text", () => {
    expect(actualInput("4")).toEqual({ actual: "4", raw_score: 4 });
    expect(actualInput(" 90 ")).toEqual({ actual: "90", raw_score: 90 });
    expect(actualInput("")).toEqual({ actual: "", raw_score: null });
    expect(actualInput("abc")).toEqual({ actual: "", raw_score: null });
  });

  it("weights and totals a V5.1 scorecard (Actual 1–5)", () => {
    const max = scaleMaxOf("V5.1");
    const lines = fromActual(["5", "3", "4", "2", "1"]);
    expect(lines.map((line) => weighted(line, max))).toEqual([1.25, 0.75, 0.8, 0.3, 0.15]);
    expect(scorecardTotal(lines, max)).toBe(3.25); // raw 3.2499999999999996
  });

  it("weights and totals a V6 scorecard (Actual 1–100)", () => {
    const max = scaleMaxOf("V6");
    const lines = fromActual(["90", "80", "70", "85", "100"]);
    expect(lines.map((line) => weighted(line, max))).toEqual([22.5, 20, 14, 12.75, 15]);
    expect(scorecardTotal(lines, max)).toBe(84.25);
  });

  it.each([["V5.1", "0"], ["V5.1", "6"], ["V5.1", "3.5"], ["V5.1", ""], ["V6", "0"], ["V6", "101"], ["V6", "3.5"], ["V6", ""]])("%s: Actual %j gives no weighted value and no total", (version, bad) => {
    const max = scaleMaxOf(version);
    const ok = String(max === 5 ? 4 : 90);
    const lines = fromActual([ok, ok, ok, ok, bad]);
    expect(weighted(lines[4], max)).toBeNull();
    expect(scorecardTotal(lines, max)).toBeNull();
  });

  it("has no total for a partial set (weights below 100), whatever the line count", () => {
    expect(scorecardTotal(fromActual(["4", "4", "4", "4"]), 5)).toBeNull();
  });

  it("shows realisation text from the old Actual column, and nothing for a line saved since Q4", () => {
    expect(legacyRealisation({ actual: "110% dari target", raw_score: 4 })).toBe("110% dari target");
    expect(legacyRealisation({ actual: "4", raw_score: 4 })).toBe("");
    expect(legacyRealisation({ actual: "", raw_score: 4 })).toBe("");
    expect(legacyRealisation(actualInput("85"))).toBe("");
  });
});

// D4-UI-04: a Save error built for Oct (score 1–5) must not stay on screen after switching to Nov (score 1–100).
describe("KPI form: changing the period", () => {
  const set = seedCatalogSet(d4ReferenceFixture.positions);
  const alfa = d4ReferenceFixture.employees.find((item) => item.id === ALFA)!;

  it("clears an earlier Save error and reloads the KPI set when the catalog version changes", () => {
    const change = periodChange(set, "2026-10", "2026-11", alfa);
    expect(change.error).toBe("");
    // Expected role comes from the catalog, so renamed fixture positions do not break the test.
    expect(change.roleOrder).toBe(roleForPosition(catalogFor(set, "2026-11")!, alfa.positionId));
    expect(change.roleOrder).toBeGreaterThan(0);
    expect(change.lines).toHaveLength(5);
    expect(change.lines!.every((line) => line.raw_score === null)).toBe(true);
  });

  it("clears the error but keeps the entered lines within the same catalog version", () => {
    expect(periodChange(set, "2026-10", "2026-09", alfa)).toEqual({ error: "" });
    expect(periodChange(set, "2026-10", "2026-11", undefined)).toEqual({ error: "" }); // no employee chosen yet
  });
});

describe("fixed KPI target", () => {
  it("is 85 when the catalog carries no target, and the catalog target wins when it does", () => {
    expect(KPI_TARGET).toBe("85");
    expect(KPI_V51_CATALOG.every((row) => targetOf(row) === "85")).toBe(true);
    expect(targetOf({ target: "90" })).toBe("90");
  });
});

describe("saved scorecard total (fixture source, mirrors the DB trigger d4_calculate_kpi_assessment)", () => {
  let source: D4DataSource;
  beforeEach(() => {
    // The fixture source waits 250 ms per read to imitate the network; run it immediately.
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((run: () => void) => { run(); return 0; }) as unknown as typeof setTimeout);
    // V6 periods start in Nov 2026; an evaluation is dated on or after its period starts (D4-FN-01) and never in the future.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-20T03:00:00Z"));
    source = createFixtureSource();
  });
  afterEach(() => { vi.useRealTimers(); });

  async function save(scores: number[], period: string) {
    const lines = indicatorsFor(catalog, FINANCE_ROLE).map((row, index) => ({
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "", actual: "", raw_score: scores[index], comment: "",
    }));
    const id = await source.createKpiAssessment({ employeeId: ALFA, roleOrder: FINANCE_ROLE, period, evaluationDate: "2026-12-15", evaluatorName: "x", status: "completed", lines, generalNotes: "Catatan uji.", evidenceReference: "DOC-1" });
    return (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!.overallScore;
  }

  it("saves a V6 period on the 1–100 scale and totals it with the same formula", async () => {
    // November: both November (V6) and October (V5.1) are still open.
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
    const scores = [90, 80, 70, 85, 100]; // weights 25/25/20/15/15
    const lines = indicatorsFor(catalog, FINANCE_ROLE).map((row, index) => ({
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "", actual: "", raw_score: scores[index], comment: "",
    }));
    const base = { employeeId: ALFA, roleOrder: FINANCE_ROLE, period: "2026-11", evaluationDate: "2026-12-15", evaluatorName: "x", status: "completed" as const, generalNotes: "Catatan", evidenceReference: "DOC-1" };
    const id = await source.createKpiAssessment({ ...base, lines });
    const saved = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!;
    expect(saved.definitionVersion).toBe("V6");
    expect(saved.overallScore).toBe(84.25); // 22.5 + 20 + 14 + 12.75 + 15
    expect(performanceBand(saved.overallScore, saved.definitionVersion)).toBe("Average Performance");
    await expect(source.createKpiAssessment({ ...base, period: "2026-10", lines })).rejects.toThrow("1 sampai 5");
    vi.setSystemTime(new Date("2026-12-20T03:00:00Z"));
    await expect(source.createKpiAssessment({ ...base, period: "2026-12", lines: lines.map((line) => ({ ...line, raw_score: 101 })) })).rejects.toThrow("1 sampai 100");
  });

  it("saves the Actual typed in the form as the score and keeps Comment as the realisation note (Q4, V6)", async () => {
    const actuals = ["90", "80", "70", "85", "100"];
    const lines = indicatorsFor(catalog, FINANCE_ROLE).map((row, index) => ({
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "", ...actualInput(actuals[index]), comment: "Realisasi 98% SLA",
    }));
    const id = await source.createKpiAssessment({ employeeId: ALFA, roleOrder: FINANCE_ROLE, period: "2026-11", evaluationDate: "2026-12-15", evaluatorName: "x", status: "completed", lines, generalNotes: "Catatan", evidenceReference: "DOC-1" });
    const saved = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!;
    expect(saved.overallScore).toBe(84.25);
    expect(saved.lines.map((line) => [line.actual, line.raw_score, legacyRealisation(line), line.comment])).toEqual(actuals.map((value) => [value, Number(value), "", "Realisasi 98% SLA"]));
  });

  it("still reads a scorecard saved before Q4: same total, old realisation text kept for Comment", async () => {
    const old = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.status === "completed" && item.definitionVersion === "V5.1")!;
    expect(old.lines.every((line) => line.actual.trim() !== "")).toBe(true);
    expect(scorecardTotal(old.lines, scaleMaxOf(old.definitionVersion))).toBe(old.overallScore);
    expect(old.lines.map(legacyRealisation)).toEqual(old.lines.map((line) => line.actual));
  });

  it("stores the catalog target, not the one in the request", async () => {
    vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
    const lines = indicatorsFor(catalog, FINANCE_ROLE).map((row) => ({
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "999", actual: "", raw_score: 4, comment: "",
    }));
    const id = await source.createKpiAssessment({ employeeId: ALFA, roleOrder: FINANCE_ROLE, period: "2026-10", evaluationDate: "2026-10-01", evaluatorName: "x", status: "completed", lines, generalNotes: "Catatan", evidenceReference: "DOC-1" });
    const saved = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!;
    expect(saved.lines.map((line) => line.target)).toEqual(["85", "85", "85", "85", "85"]);
  });

  it.each([
    // weights 25/25/20/15/15
    [[5, 3, 4, 2, 1], 3.25], // raw 3.2499999999999996
    [[3, 3, 3, 3, 4], 3.15], // raw 3.1500000000000004
    [[1, 2, 3, 4, 5], 2.7],
    [[4, 5, 4, 3, 4], 4.1],
    [[1, 1, 1, 1, 1], 1],
    [[5, 5, 5, 5, 5], 5],
  ])("scores %j → overall %s", async (scores, expected) => {
    expect(await save(scores, "2026-11")).toBe(expected);
  });
});

describe("roleForPositionTitle (FR-02.11)", () => {
  it.each([["Operations Staff"], ["HR Associate Officer"], [""], [undefined]])("%s has no KPI in V5.1 → 0 (by design)", (title) => {
    expect(roleForPositionTitle(catalog, title)).toBe(0);
  });

  it.each([
    ["Vice President / CEO", 1], ["CEO", 1], ["Director", 2], ["Operations Director", 3], ["Branch Manager", 4],
    ["Customs Clearance Officer", 5], ["PPJK Officer", 5], ["Seafreight Ops Staff", 6], ["Airfreight Staff", 6], ["Freight Staff", 6],
    ["Warehouse Staff", 7], ["Logistics Staff", 7], ["EDI Officer", 8], ["Manifest Input Staff", 8], ["Implant Staff", 8],
    ["Sales Staff", 9], ["Marketing Staff", 9], ["Sales Administration Associate", 9], ["Finance Staff", 10], ["Finance Administrator", 10],
    ["Accounting Staff", 10], ["Admin Staff", 10],
    // Org file titles mapped by supabase/seed/d4-simulasi-master.sql.
    ["Cash Manager", 10], ["Cash Manager Associate", 10], ["Tax Manager", 10], ["Tax Associate 1", 10], ["Manager of Customer Success", 9],
    ["Director of Human Capital & Culture", 2], ["Accounting Associate 1 (Billing)", 10], ["Sales Executive 1", 9],
  ])("%s → role %i", (title, role) => {
    expect(roleForPositionTitle(catalog, title)).toBe(role);
  });

  it("maps every fixture position; only the positions without a V5.1 KPI return 0", () => {
    const withoutKpi = d4ReferenceFixture.positions.filter((position) => roleForPositionTitle(catalog, position.title) === 0).map((position) => position.title);
    // HR Manager has Finance & Administration, as in live d4_position_kpi_roles (checked 13 Nov 2026).
    expect(withoutKpi.sort()).toEqual(["Commissioner"]);
  });

  // BUG-D4-005 regression: keywords match whole words, so "edi" inside "Credit"/"Media" no longer maps to Implant Staff.
  it.each([["Credit Control Staff"], ["Media Relations Officer"], ["Medical Officer"]])("%s has no KPI → 0", (title) => {
    expect(roleForPositionTitle(catalog, title)).toBe(0);
  });
});

describe("catalogFor: the catalog version follows the scorecard period", () => {
  const v6 = KPI_V51_CATALOG.map((row) => ({ ...row, source_version: "V6", weight_percent: row.indicator_order === 1 ? row.weight_percent + 5 : row.indicator_order === 5 ? row.weight_percent - 5 : row.weight_percent }));
  const set: KpiCatalogSet = {
    versions: [{ source_version: "V5.1", effective_from: "2026-01" }, { source_version: "V6", effective_from: "2027-01" }],
    rows: [...KPI_V51_CATALOG, ...v6],
    positionRoles: [{ source_version: "V5.1", position_id: "pos-a", role_order: 9 }, { source_version: "V6", position_id: "pos-a", role_order: 10 }],
  };

  it.each([["2025-12", null], ["2026-01", "V5.1"], ["2026-12", "V5.1"], ["2027-01", "V6"], ["2030-06", "V6"]])("%s → %s", (period, version) => {
    expect(catalogFor(set, period)?.version ?? null).toBe(version);
  });

  it("serves only that version's rows and HR's position mapping for it", () => {
    const old = catalogFor(set, "2026-12")!, next = catalogFor(set, "2027-01")!;
    expect(old.rows.every((row) => row.source_version === "V5.1")).toBe(true);
    expect(indicatorsFor(next, 9)[0].weight_percent).toBe(indicatorsFor(old, 9)[0].weight_percent + 5);
    expect([roleForPosition(old, "pos-a"), roleForPosition(next, "pos-a"), roleForPosition(next, "pos-b")]).toEqual([9, 10, 0]);
  });
});

// 24 Nov 2026: from 2026-11 a mapped position's KPI come from D1 (d1_kpi_definitions); the rest keep their D4 role.
describe("KPI from D1 (20261124130000)", () => {
  const set = seedCatalogSet(d4ReferenceFixture.positions);
  const positionOf = (title: string) => d4ReferenceFixture.positions.find((item) => item.title === title)!.id;

  it("gives a mapped position its D1 role from 2026-11 and its D4 role before", () => {
    const hr = positionOf("HR Manager");
    const nov = catalogFor(set, "2026-11")!;
    expect(roleForPosition(nov, hr)).toBe(1011); // 1000 + JP011
    expect(indicatorsFor(nov, 1011).map((row) => row.kpi_name)).toEqual(["Time-to-Fill Vacancy", "Onboarding Completion", "Performance Evaluation Completion", "Training Completion Rate", "HR Administration SLA"]);
    expect(catalogText(nov, 1011)).toBe("Definisi KPI D1 JP011 · skala 1–100");
    expect(roleForPosition(catalogFor(set, "2026-10")!, hr)).toBeLessThan(1000);
  });

  it("keeps the D4 role of a position D1 has not mapped, and says so", () => {
    const nov = catalogFor(set, "2026-11")!;
    const billing = roleForPosition(nov, positionOf("Accounting Associate 1 (Billing)"));
    expect(billing).toBe(FINANCE_ROLE);
    expect(catalogText(nov, billing)).toBe("Katalog D4 V6, posisi belum dipetakan D1 · skala 1–100");
    expect(catalogText(catalogFor(set, "2026-10")!, billing)).toBe("KPI Scorecard V5.1 · skala 1–5");
  });

  it("scores any number of KPI once the weights total 100", () => {
    expect(scorableSet([{ weight_percent: 40 }, { weight_percent: 35 }, { weight_percent: 25 }])).toBe(true);
    expect(scorableSet([{ weight_percent: 40 }, { weight_percent: 35 }])).toBe(false);
    expect(scorableSet([])).toBe(false);
    expect(scorecardTotal([{ weight_percent: 40, raw_score: 90 }, { weight_percent: 35, raw_score: 80 }, { weight_percent: 25, raw_score: 70 }], 100)).toBe(81.5);
  });

  describe("loadCatalogSet", () => {
    const versions = [{ source_version: "V6", effective_from: "2026-11" }];
    const view = [{ role_order: 1011, role_name: "HR Manager", indicator_order: 1, kpi_name: "Time-to-Fill Vacancy", target: "85", weight_percent: 100, source_version: "V6", kpi_source: "D1", d1_job_code: "JP011" }];
    const table = [{ role_order: 10, role_name: "Finance & Administration", indicator_order: 1, kpi_name: "Invoice", target: null, weight_percent: 100, source_version: "V6" }];
    const clientWith = (data: Record<string, unknown>) => ({
      from: (name: string) => {
        const result = data[name] === "missing" ? { data: null, error: { code: "PGRST205", message: "missing" } } : { data: data[name] ?? [], error: null };
        const builder = { select: () => builder, order: () => builder, then: (resolve: (value: unknown) => void) => resolve(result) };
        return builder;
      },
    }) as unknown as Parameters<typeof loadCatalogSet>[0];

    it("reads the D1 views when they exist", async () => {
      const loaded = await loadCatalogSet(clientWith({ d4_kpi_catalog_versions: versions, d4_kpi_catalog_rows: view, d4_kpi_position_roles: [{ source_version: "V6", position_id: "p", role_order: 1011 }], d4_kpi_role_catalog: table }));
      expect(loaded.rows).toEqual(view);
      expect(loaded.positionRoles[0].role_order).toBe(1011);
    });

    it("falls back to the D4 tables while the migration is not applied", async () => {
      const loaded = await loadCatalogSet(clientWith({ d4_kpi_catalog_versions: versions, d4_kpi_catalog_rows: "missing", d4_kpi_position_roles: "missing", d4_kpi_role_catalog: table, d4_position_kpi_roles: [{ source_version: "V6", position_id: "p", role_order: 10 }] }));
      expect(loaded.rows).toEqual(table);
      expect(loaded.positionRoles[0].role_order).toBe(10);
    });
  });
});

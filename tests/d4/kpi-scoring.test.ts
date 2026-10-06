import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { indicatorsFor, KPI_V51_CATALOG, roleForPositionTitle, rolesOf, selectCatalog } from "@/modules/d4/kpi/catalog";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4DataSource } from "@/modules/d4/web/data/source";
import { weighted } from "@/modules/d4/web/features/kpi/KpiFormModal";

const catalog = selectCatalog(KPI_V51_CATALOG);
const ALFA = "d4000000-0000-4000-8000-000000000009"; // Finance Staff → role 10 (weights 25/25/20/15/15)
const FINANCE_ROLE = 10;

describe("KPI V5.1 catalog: weights per role (FR-02.4, FR-06.9)", () => {
  const roles = rolesOf(catalog);

  it("serves V5.1 with ten roles", () => {
    expect(catalog.version).toBe("V5.1");
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

describe("saved scorecard total (fixture source, mirrors the DB trigger d4_calculate_kpi_assessment)", () => {
  let source: D4DataSource;
  beforeEach(() => {
    // The fixture source waits 250 ms per read to imitate the network; run it immediately.
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((run: () => void) => { run(); return 0; }) as unknown as typeof setTimeout);
    source = createFixtureSource();
  });

  async function save(scores: number[], period: string) {
    const lines = indicatorsFor(catalog, FINANCE_ROLE).map((row, index) => ({
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "", actual: "", raw_score: scores[index], comment: "",
    }));
    const id = await source.createKpiAssessment({ employeeId: ALFA, roleOrder: FINANCE_ROLE, period, evaluationDate: "2026-10-01", evaluatorName: "x", status: "completed", lines, generalNotes: "" });
    return (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!.overallScore;
  }

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
    ["Accounting Staff", 10], ["Finance & Administration Staff", 10],
  ])("%s → role %i", (title, role) => {
    expect(roleForPositionTitle(catalog, title)).toBe(role);
  });

  // "Admin" alone is not finance: an HR or general administrator has no Finance & Administration KPI.
  it.each([["HR Administrator"], ["Admin Staff"], ["System Administrator"]])("%s has no KPI → 0", (title) => {
    expect(roleForPositionTitle(catalog, title)).toBe(0);
  });

  it("maps every exact V5.1 role title to its own role", () => {
    for (const role of rolesOf(catalog)) expect(roleForPositionTitle(catalog, role.name)).toBe(role.order);
  });

  it("maps every fixture position; only the positions without a V5.1 KPI return 0", () => {
    const withoutKpi = d4ReferenceFixture.positions.filter((position) => roleForPositionTitle(catalog, position.title) === 0).map((position) => position.title);
    expect(withoutKpi.sort()).toEqual(["HR Associate Officer", "Operations Staff", "Staf Demo D4"]);
  });

  // BUG-D4-005 regression: keywords match whole words, so "edi" inside "Credit"/"Media" no longer maps to Implant Staff.
  it.each([["Credit Control Staff"], ["Media Relations Officer"], ["Medical Officer"]])("%s has no KPI → 0", (title) => {
    expect(roleForPositionTitle(catalog, title)).toBe(0);
  });
});

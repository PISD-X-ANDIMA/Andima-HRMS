import { afterEach, describe, expect, it, vi } from "vitest";
import { currentCompetencyStatus, type Snapshot } from "@/modules/d4/web/data/selectors";
import { needsWithoutTraining, type DashboardRow } from "@/modules/d4/web/features/dashboard/summary";

// Transcript 24 Nov 2026: the Need training tile plans one training for everyone still without one, in one form.
afterEach(() => { vi.unstubAllEnvs(); });

async function hrSource() {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
const rowsOf = (snapshot: Snapshot): DashboardRow[] => snapshot.reference.employees.map((item) => ({ employee: item, gap: currentCompetencyStatus(snapshot, item) }));

describe("Need training tile: create training for all", () => {
  it("lists only open requirements that have no training yet", async () => {
    const source = await hrSource();
    const before = await source.loadSnapshot();
    expect(needsWithoutTraining(before, rowsOf(before))).toEqual([]);
    const others = before.reference.employees.filter((item) => item.id !== before.actorEmployeeId).slice(0, 2);
    const ids = [];
    for (const person of others) ids.push(await source.createDevelopment({ employeeId: person.id, sourceType: "performance_context", sourceRef: `KPI-${person.employeeId}`, objective: `Uji ${person.employeeId}`, priority: "Medium", notes: "", method: "Coaching", pic: "Bu Maya" }));
    const after = await source.loadSnapshot();
    const waiting = needsWithoutTraining(after, rowsOf(after));
    expect(waiting.map((item) => item.key).sort()).toEqual([...ids].sort());
    expect(waiting[0].label).toContain(" · Uji ");

    // Once one of them has a training it leaves the list.
    await source.createTraining({ employeeId: others[0].id, developmentNeedId: ids[0], activity: "Coaching", date: "2030-01-15", status: "Planned", result: "", notes: "" });
    const later = await source.loadSnapshot();
    expect(needsWithoutTraining(later, rowsOf(later)).map((item) => item.key)).toEqual([ids[1]]);
  });
});

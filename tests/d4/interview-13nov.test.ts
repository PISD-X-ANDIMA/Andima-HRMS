import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentNeedVersion } from "@/modules/d4/development/types";
import { assertPeriodRevision, MAX_PERIOD_REVISIONS, revisionsLeft } from "@/modules/d4/shared/rules";
import { addTrainingToNeeds, bulkSummary, DECIDE_LATER, progressTargets, requireSome, updateTrainings } from "@/modules/d4/web/data/bulk";
import { developmentNeeds, formatDate, formatDateTime, pinJustSaved, RECENT_MS, recentLabel, trainingById, trainings, type Snapshot } from "@/modules/d4/web/data/selectors";
import type { D4DataSource } from "@/modules/d4/web/data/source";
import { archivedCount, developmentRows, type DevelopmentFilters } from "@/modules/d4/web/features/development/rows";

// Client feedback of 13 Nov 2026 (Mas Bram). Rows are picked by rule, not by name: the fixture names change.
async function hrSource(): Promise<D4DataSource> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
afterEach(() => { vi.unstubAllEnvs(); });

const NO_FILTER: DevelopmentFilters = { search: "", department: "", sourceType: "", status: "", period: "", competency: "", priority: "" };
const isOpen = (need: { status: string }) => need.status !== "Completed";
/** A newer revision of `need`, as a status change or a Priority edit would add. */
const revise = (snapshot: Snapshot, need: DevelopmentNeedVersion, patch: Partial<DevelopmentNeedVersion>): Snapshot =>
  ({ ...snapshot, developmentVersions: [...snapshot.developmentVersions, { ...need, id: `${need.needId}-NEXT`, revision: need.revision + 1, createdAt: "2026-11-14T08:00:00.000Z", ...patch }] });

describe("Development Requirement order (1:06:52, 1:21:38)", () => {
  it("puts High first, whatever its date", async () => {
    const base = await (await hrSource()).loadSnapshot();
    const open = developmentRows(base, NO_FILTER).filter(isOpen);
    expect(open.length).toBeGreaterThan(1);
    const oldest = [...open].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const highOldest = { ...base, developmentVersions: base.developmentVersions.map((item) => ({ ...item, priority: item.needId === oldest.needId ? "High" as const : "Low" as const })) };
    expect(developmentRows(highOldest, NO_FILTER)[0].needId).toBe(oldest.needId);
  });

  it("within one priority, lists the most recently updated first", async () => {
    const base = await (await hrSource()).loadSnapshot();
    const same = { ...base, developmentVersions: base.developmentVersions.map((item) => ({ ...item, priority: "Medium" as const })) };
    const dates = developmentRows(same, NO_FILTER).filter(isOpen).map((need) => need.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    // An update moves the requirement to the top of its priority.
    const last = developmentRows(same, NO_FILTER).filter(isOpen).at(-1)!;
    expect(developmentRows(revise(same, last, { notes: "PIC diganti" }), NO_FILTER)[0].needId).toBe(last.needId);
  });
});

describe("Completed requirements leave the list (1:08:36)", () => {
  it("hides a decided Completed requirement by default and shows it under Status: Completed", async () => {
    const base = await (await hrSource()).loadSnapshot();
    const target = developmentRows(base, NO_FILTER).filter(isOpen)[0];
    const done = revise(base, target, { status: "Completed", reassessment: "Meets requirement" });
    expect(developmentRows(done, NO_FILTER).map((need) => need.needId)).not.toContain(target.needId);
    expect(archivedCount(done, NO_FILTER)).toBe(archivedCount(base, NO_FILTER) + 1);
    expect(developmentRows(done, { ...NO_FILTER, status: "Completed" }).map((need) => need.needId)).toContain(target.needId);
    expect(archivedCount(done, { ...NO_FILTER, status: "Completed" })).toBe(0);
    // Just saved (e.g. Close as Met from the list): it stays on top until the page is left.
    const closed = developmentNeeds(done).find((need) => need.needId === target.needId)!;
    const needKey = (need: DevelopmentNeedVersion) => need.needId;
    expect(pinJustSaved(developmentRows(done, NO_FILTER), needKey, closed)[0].needId).toBe(target.needId);
    expect(pinJustSaved(developmentRows(base, NO_FILTER), needKey, target).filter((need) => need.needId === target.needId)).toHaveLength(1);
  });

  it("keeps a Completed requirement that still waits for HR's reassessment after a passed training", async () => {
    const base = await (await hrSource()).loadSnapshot();
    const training = trainings(base).find((item) => isOpen(item) && developmentNeeds(base).some((need) => need.needId === item.developmentNeedId && isOpen(need)))!;
    const target = developmentNeeds(base).find((need) => need.needId === training.developmentNeedId)!;
    const passed = { ...base, trainingVersions: [...base.trainingVersions, { ...training, id: `${training.trainingId}-NEXT`, revision: training.revision + 1, status: "Completed" as const, result: "Passed", createdAt: "2026-11-14T07:00:00.000Z" }] };
    const pending = revise(passed, target, { status: "Completed", reassessment: null });
    expect(developmentRows(pending, NO_FILTER).map((need) => need.needId)).toContain(target.needId);
  });
});

describe("one revision per period (0:52:35)", () => {
  const record = (n: number) => ({ id: `R${n}`, employeeId: "E", period: "2026-11", createdAt: `2026-11-0${n}T00:00:00.000Z` });

  it("allows the first record and one revision, then none", () => {
    expect(MAX_PERIOD_REVISIONS).toBe(1);
    expect(revisionsLeft([], "E", "2026-11")).toBe(1);
    expect(revisionsLeft([record(1)], "E", "2026-11")).toBe(1);
    expect(revisionsLeft([record(1), record(2)], "E", "2026-11")).toBe(0);
    expect(revisionsLeft([record(1), record(2)], "E", "2026-12")).toBe(1);
    expect(() => assertPeriodRevision([record(1)], "E", "2026-11", "R1", "Scorecard")).not.toThrow();
    expect(() => assertPeriodRevision([record(1), record(2)], "E", "2026-11", "R2", "Scorecard")).toThrow(/satu revisi per periode/);
  });

  it("answers a stale revision with the conflict first, so the page reloads before it shows the limit", () => {
    expect(() => assertPeriodRevision([record(1), record(2)], "E", "2026-11", "R1", "Scorecard")).toThrow(/lebih baru/);
  });
});

describe("bulk select (1:10:34–1:12:33)", () => {
  it("adds one training to every selected requirement and reports the refused one without stopping", async () => {
    const source = await hrSource();
    const snapshot = await source.loadSnapshot();
    const needs = developmentNeeds(snapshot).filter((need) => isOpen(need) && need.employeeId !== snapshot.actorEmployeeId)
      .map((need) => ({ key: need.needId, label: need.objective, employeeId: need.employeeId }));
    expect(needs.length).toBeGreaterThan(1);
    // The actor's own requirement is refused by the single-row rule (SR-D4-EMP-23), in the middle of the batch.
    const own = { key: "OWN", label: "Own requirement", employeeId: snapshot.actorEmployeeId };
    const outcome = await addTrainingToNeeds(source, [needs[0], own, ...needs.slice(1)], { activity: "Field Agent Safety Refresh", date: "2030-01-15", status: "Planned", notes: "" });
    expect(outcome.done).toEqual(needs.map((need) => need.key));
    expect(outcome.failed).toEqual([expect.objectContaining({ key: "OWN", message: expect.stringMatching(/diri sendiri/) })]);
    const after = await source.loadSnapshot();
    for (const need of needs) expect(trainings(after).some((item) => item.developmentNeedId === need.key && item.activity === "Field Agent Safety Refresh")).toBe(true);
    expect(bulkSummary(outcome, "training")).toBe(`${needs.length} training tersimpan, 1 gagal.`);
  });

  it("moves only Planned trainings to In Progress", async () => {
    const source = await hrSource();
    const snapshot = await source.loadSnapshot();
    const running = trainings(snapshot).filter((item) => item.status === "Planned" || item.status === "In Progress")
      .map((item) => ({ key: item.trainingId, label: item.activity, status: item.status }));
    const planned = running.filter((item) => item.status === "Planned").map((item) => item.key);
    expect(planned.length).toBeGreaterThan(0);
    expect(progressTargets(running, { status: "In Progress" }).map((item) => item.key)).toEqual(planned);
    const outcome = await updateTrainings(source, running, { status: "In Progress", notes: "Mulai bersamaan" });
    expect(outcome).toEqual({ done: planned, failed: [] });
    const after = await source.loadSnapshot();
    for (const key of planned) expect(trainingById(after, key)?.status).toBe("In Progress");
  });

  it("completes every selected training with one result, and refuses per row what the single save refuses", async () => {
    const source = await hrSource();
    const snapshot = await source.loadSnapshot();
    const running = trainings(snapshot).filter((item) => item.status === "Planned" || item.status === "In Progress")
      .map((item) => ({ key: item.trainingId, label: item.activity, status: item.status }));
    // Meets requirement waits for the skill data (D3); a gap still open there refuses that row only.
    const meets = await updateTrainings(source, running, { status: "Completed", result: "Passed", decision: "Meets requirement", notes: "" });
    expect(meets.done.length + meets.failed.length).toBe(running.length);
    expect(meets.failed.some((item) => /required/.test(item.message))).toBe(true);
    // The refused rows can still be completed with the result only, the decision recorded later from Next step.
    const refused = running.filter((item) => meets.failed.some((failure) => failure.key === item.key));
    const later = await updateTrainings(source, refused, { status: "Completed", result: "Passed", decision: DECIDE_LATER, notes: "Selesai bersamaan" });
    expect(later).toEqual({ done: refused.map((item) => item.key), failed: [] });
    const after = await source.loadSnapshot();
    for (const item of running) expect(trainingById(after, item.key)).toMatchObject({ status: "Completed", result: "Passed" });
  });

  it("treats a batch where every row was refused as a failed save", () => {
    expect(() => requireSome({ done: [], failed: [{ key: "A", label: "Ani", message: "Ditolak." }] })).toThrow(/Tidak ada yang tersimpan. Ani: Ditolak./);
    expect(requireSome({ done: ["A"], failed: [] })).toEqual({ done: ["A"], failed: [] });
  });
});

describe("Recent change label (follow-up 15 Nov 2026)", () => {
  const now = Date.parse("2026-11-15T10:00:00.000Z");
  const at = (iso: string, revision: number) => ({ createdAt: iso, revision });

  it("labels a requirement created in the last day New and a changed one Updated", () => {
    expect(recentLabel(at("2026-11-15T09:00:00.000Z", 1), now)).toBe("New");
    expect(recentLabel(at("2026-11-14T10:00:01.000Z", 3), now)).toBe("Updated");
  });

  it("drops the label after 24 hours or for an unreadable date", () => {
    expect(recentLabel(at(new Date(now - RECENT_MS).toISOString(), 2), now)).toBeNull();
    expect(recentLabel(at("2026-10-01T09:00:00.000Z", 1), now)).toBeNull();
    expect(recentLabel(at("not a date", 1), now)).toBeNull();
  });

  it("labels a training Updated right after its progress is saved", async () => {
    const source = await hrSource();
    const planned = trainings(await source.loadSnapshot()).find((item) => item.status === "Planned")!;
    expect(recentLabel(planned, Date.now())).toBeNull();
    await updateTrainings(source, [{ key: planned.trainingId, label: planned.activity, status: planned.status }], { status: "In Progress", notes: "" });
    expect(recentLabel(trainingById(await source.loadSnapshot(), planned.trainingId)!, Date.now())).toBe("Updated");
  });

  it("shows the time of a save and keeps a plain date a date", () => {
    expect(formatDateTime("2026-11-15T09:05:00.000Z")).toMatch(/^\d{1,2} Nov 2026, \d{2}:\d{2}$/);
    expect(formatDateTime("2026-11-15")).toBe(formatDate("2026-11-15"));
    expect(formatDateTime(undefined)).toBe("—");
  });
});

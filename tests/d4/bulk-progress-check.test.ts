import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import { progressIssue } from "@/modules/d4/web/data/completion";
import { latestTraining } from "@/modules/d4/supabase/types";
import type { BulkProgress } from "@/modules/d4/web/data/bulk";

// Lecturer review 24 Nov 2026: bulk Update Progress names the trainings it cannot process before Save, so the check must
// give the same answer as the save itself, row by row.
describe("bulk Update Progress check before saving", () => {
  beforeEach(() => { vi.spyOn(globalThis, "setTimeout").mockImplementation(((run: () => void) => { run(); return 0; }) as unknown as typeof setTimeout); });

  const changes: BulkProgress[] = [
    { status: "Completed", result: "Passed", decision: "Meets requirement", notes: "Uji" },
    { status: "Completed", result: "Passed", decision: "Retraining", notes: "Uji", activity: "Ulang", date: "2030-01-15" },
    { status: "Completed", result: "Not Passed", decision: "Other follow-up", notes: "Uji" },
    { status: "In Progress", notes: "" },
  ];

  it.each(changes.map((change) => [change.status === "Completed" ? `${change.result} + ${change.decision}` : change.status, change] as const))("agrees with the save for every open training: %s", async (_name, change) => {
    const snapshot = await createFixtureSource().loadSnapshot();
    const open = latestTraining(snapshot).filter((item) => item.status === "Planned" || item.status === "In Progress");
    expect(open.length).toBeGreaterThan(0);
    for (const training of open) {
      const predicted = progressIssue(snapshot, training.trainingId, change);
      const source = createFixtureSource();
      let actual = "";
      try {
        if (change.status === "In Progress") { if (training.status === "Planned") await source.updateTraining(training.trainingId, "In Progress", "", change.notes); }
        else await source.completeTraining(training.trainingId, { result: change.result, decision: change.decision as never, notes: change.notes, activity: change.activity, date: change.date });
      } catch (cause) { actual = (cause as Error).message; }
      expect([training.activity, predicted]).toEqual([training.activity, actual]);
    }
  });

  it("flags at least one fixture training for Passed + Meets requirement while its gap is still open", async () => {
    const snapshot = await createFixtureSource().loadSnapshot();
    const issues = latestTraining(snapshot).filter((item) => item.status === "Planned" || item.status === "In Progress")
      .map((item) => progressIssue(snapshot, item.trainingId, changes[0])).filter(Boolean);
    expect(issues.length).toBeGreaterThan(0);
  });
});

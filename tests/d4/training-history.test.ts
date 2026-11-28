import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentNeedVersion } from "@/modules/d4/development/types";
import type { TrainingVersion } from "@/modules/d4/training/types";
import { developmentNeeds, nextStep, trainingById, trainingDecision, trainings, type Snapshot } from "@/modules/d4/web/data/selectors";
import { isTrainingArchived } from "@/modules/d4/web/features/training/rows";

// Training Tracking follows the Development Requirement rule (interview 13 Nov 2026, 1:08:36): nothing left to do, so
// it leaves the default list. Rows are picked by rule, not by name: the fixture names change.
async function snapshot(): Promise<Snapshot> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource().loadSnapshot();
}
afterEach(() => { vi.unstubAllEnvs(); });

const progress = (s: Snapshot, t: TrainingVersion, patch: Partial<TrainingVersion>): Snapshot =>
  ({ ...s, trainingVersions: [...s.trainingVersions, { ...t, id: `${t.trainingId}-NEXT`, revision: t.revision + 1, createdAt: "2026-11-14T07:00:00.000Z", ...patch }] });
const decide = (s: Snapshot, need: DevelopmentNeedVersion, patch: Partial<DevelopmentNeedVersion>): Snapshot =>
  ({ ...s, developmentVersions: [...s.developmentVersions, { ...need, id: `${need.needId}-NEXT`, revision: need.revision + 1, createdAt: "2026-11-14T08:00:00.000Z", ...patch }] });

async function openTraining() {
  const base = await snapshot();
  const training = trainings(base).find((item) => (item.status === "Planned" || item.status === "In Progress")
    && developmentNeeds(base).some((need) => need.needId === item.developmentNeedId && need.status !== "Completed"))!;
  const need = developmentNeeds(base).find((item) => item.needId === training.developmentNeedId)!;
  return { base, training, need, latest: (s: Snapshot) => trainingById(s, training.trainingId)! };
}

describe("finished trainings leave the Training Tracking list", () => {
  it("keeps a running training and archives a cancelled one", async () => {
    const { base, training, latest } = await openTraining();
    expect(isTrainingArchived(base, training)).toBe(false);
    const cancelled = progress(base, training, { status: "Cancelled" });
    expect(isTrainingArchived(cancelled, latest(cancelled))).toBe(true);
  });

  it("keeps a Passed training until HR records the reassessment", async () => {
    const { base, training, need, latest } = await openTraining();
    const passed = progress(base, training, { status: "Completed", result: "Passed" });
    expect(isTrainingArchived(passed, latest(passed))).toBe(false);
    const met = decide(passed, need, { status: "Completed", reassessment: "Meets requirement" });
    expect(isTrainingArchived(met, latest(met))).toBe(true);
  });

  it("keeps a training completed with a free-text result and asks HR to record the result (Vira, 17 Nov 2026)", async () => {
    const { base, training, need, latest } = await openTraining();
    const legacy = progress(base, training, { status: "Completed", result: "Selesai; sertifikat diterima." });
    expect(trainingDecision(legacy, latest(legacy))).toBe("result");
    expect(isTrainingArchived(legacy, latest(legacy))).toBe(false);
    // The requirement's Next step points at that training, not at a new one.
    const step = nextStep(legacy, developmentNeeds(legacy).find((item) => item.needId === need.needId)!);
    expect(step).toMatchObject({ kind: "decide", decision: "result", training: { trainingId: training.trainingId } });
  });

  it("keeps a Not Passed training until HR records the follow-up", async () => {
    const { base, training, latest } = await openTraining();
    const failed = progress(base, training, { status: "Completed", result: "Not Passed" });
    expect(isTrainingArchived(failed, latest(failed))).toBe(false);
    const retrain = progress(failed, latest(failed), { followUp: "Retraining" });
    expect(isTrainingArchived(retrain, latest(retrain))).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { pendingDecision, planTrainingCompletion, retrainingBlockedReason } from "@/modules/d4/shared/rules";
import { latestDevelopment, latestTraining } from "@/modules/d4/supabase/types";
import type { D4DataSource } from "@/modules/d4/web/data/source";
import { reassessmentFor, sourceFinding, trainingById, trainingDecision, type Snapshot } from "@/modules/d4/web/data/selectors";

// One menu (10 Nov 2026): a training is finished in Training Tracking only. Update Progress → Completed saves the
// result and HR's decision together; there is no separate Record Reassessment in Development Requirement any more.
const DIAN = "d4000000-0000-4000-8000-000000000011"; // FIX-D4-DEV-002 (gap on requirement …031, level 3 of 4), FIX-D4-TRN-002 In Progress
const TRAINING = "FIX-D4-TRN-002";
const NEED = "FIX-D4-DEV-002";

async function hrSource(): Promise<D4DataSource> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

// Retraining after a pass is the outcome of a reassessment (interview 14 Oct, part 2, 00:53:31): the Passed result is
// saved first, then a competency assessment after it. Both are dated in the past, then the real clock resumes.
async function passThenReassess(source: D4DataSource, trainingId: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T03:00:00.000Z"));
  await source.updateTraining(trainingId, "Completed", "Passed", "");
  const snapshot = await source.loadSnapshot();
  const employeeId = snapshot.trainingVersions.find((item) => item.trainingId === trainingId)!.employeeId;
  vi.setSystemTime(new Date("2026-11-20T04:00:00.000Z"));
  await source.saveCompetency({ employeeId, positionId: snapshot.reference.employees.find((item) => item.id === employeeId)!.positionId!, effectiveDate: "2026-11-23" });
  vi.useRealTimers();
}

const need = (snapshot: Snapshot) => latestDevelopment(snapshot).find((item) => item.needId === NEED)!;
const training = (snapshot: Snapshot) => trainingById(snapshot, TRAINING)!;

describe("Passed: the reassessment is recorded with the result", () => {
  it("keeps Meets requirement closed while the skill data (D3) still shows the gap", async () => {
    const source = await hrSource();
    const before = await source.loadSnapshot();
    expect(sourceFinding(before, need(before))).toMatchObject({ status: "Gap", requiredLevel: 4, actualLevel: 3 });
    await expect(source.completeTraining(TRAINING, { result: "Passed", decision: "Meets requirement", notes: "" })).rejects.toThrow(/level saat ini 3, required 4/);
    // Nothing was written: the check runs before the first write.
    expect(training(await source.loadSnapshot()).status).toBe("In Progress");
  });

  it("refuses Retraining in the save that records Passed, before any write", async () => {
    const source = await hrSource();
    await expect(source.completeTraining(TRAINING, { result: "Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" })).rejects.toThrow(/Retraining dipilih saat reassessment/);
    expect(training(await source.loadSnapshot()).status).toBe("In Progress");
  });

  it("Retraining after the reassessment: requirement reopened as Planned, the next training created", async () => {
    const source = await hrSource();
    const assessed = (snapshot: Snapshot) => snapshot.competency.filter((item) => item.employeeId === DIAN).length;
    const start = assessed(await source.loadSnapshot());
    await passThenReassess(source, TRAINING);
    const id = await source.completeTraining(TRAINING, { result: "Passed", decision: "Retraining", notes: "Level belum naik", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    const after = await source.loadSnapshot();
    expect(training(after)).toMatchObject({ status: "Completed", result: "Passed" });
    expect(need(after)).toMatchObject({ status: "Planned", reassessment: "Retraining", notes: "Level belum naik" });
    expect(latestTraining(after).find((item) => item.trainingId === id)).toMatchObject({ developmentNeedId: NEED, status: "Planned", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    expect(latestTraining(after).find((item) => item.trainingId === id)?.notes).toMatch(/^Retraining setelah "Coretax Reporting Briefing" \(2026-10-01\) Passed, tetapi gap belum tertutup\.\nLevel belum naik$/);
    // HR's reassessment, then the snapshot saved with the decision.
    expect(assessed(after)).toBe(start + 2);
    expect(trainingDecision(after, training(after))).toBeNull();
    expect(reassessmentFor(after, NEED)).toBe("Retraining");
    await expect(source.completeTraining(TRAINING, { result: "Passed", decision: "Retraining", notes: "", activity: "X", date: "2030-01-15" })).rejects.toThrow(/sudah dicatat/);
  });

  it("Decide later: the result is saved and the Next step stays until the decision", async () => {
    const source = await hrSource();
    await source.updateTraining(TRAINING, "Completed", "Passed", "");
    const later = await source.loadSnapshot();
    expect(trainingDecision(later, training(later))).toBe("reassessment");
    expect(need(later).status).toBe("In Progress");
    // The level before the training proves nothing: Retraining waits for an assessment saved after the result.
    await expect(source.completeTraining(TRAINING, { result: "Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" })).rejects.toThrow(/Belum ada penilaian ulang/);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);
    await source.saveCompetency({ employeeId: DIAN, positionId: later.reference.employees.find((item) => item.id === DIAN)!.positionId!, effectiveDate: "2026-11-23" });
    vi.setSystemTime(Date.now() + 60_000);
    await source.completeTraining(TRAINING, { result: "Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    const after = await source.loadSnapshot();
    // The saved result is not written again.
    expect(after.trainingVersions.filter((item) => item.trainingId === TRAINING).map((item) => item.revision).sort()).toEqual([1, 2]);
    expect(trainingDecision(after, training(after))).toBeNull();
  });
});

describe("retrainingBlockedReason", () => {
  const gap = { competencyName: "Tax", requiredLevel: 4, actualLevel: 3, status: "Gap" as const };
  const done = "2026-11-20T03:00:00.000Z";
  it.each([
    ["the save that records Passed", { sourceType: "competency_gap" as const }, gap, undefined, "2026-11-21T00:00:00.000Z", /saat reassessment/],
    ["no assessment saved after the training", { sourceType: "competency_gap" as const }, gap, done, "2026-11-19T00:00:00.000Z", /Belum ada penilaian ulang/],
    ["an assessment saved with the result", { sourceType: "competency_gap" as const }, gap, done, done, /Belum ada penilaian ulang/],
    ["the level already met", { sourceType: "competency_gap" as const }, { ...gap, actualLevel: 4, status: "Terpenuhi" as const }, done, "2026-11-21T00:00:00.000Z", /Pilih Meets requirement/],
  ])("blocks %s", (_name, need, finding, completed, assessedAt, message) => {
    expect(retrainingBlockedReason(need, finding, completed, assessedAt)).toMatch(message);
  });
  it("allows it after a later assessment that still shows the gap, or for a requirement without level data", () => {
    expect(retrainingBlockedReason({ sourceType: "competency_gap" }, gap, done, "2026-11-21T00:00:00.000Z")).toBe("");
    expect(retrainingBlockedReason({ sourceType: "performance_context" }, undefined, done, undefined)).toBe("");
  });
});

describe("planTrainingCompletion", () => {
  it("Meets requirement completes an open requirement in one revision once the level is met", async () => {
    const snapshot = await (await hrSource()).loadSnapshot();
    const plan = planTrainingCompletion({ result: "Passed", decision: "Meets requirement", notes: "" }, {
      trainingId: TRAINING, history: snapshot.trainingVersions.filter((item) => item.trainingId === TRAINING), need: need(snapshot),
      needHistory: snapshot.developmentVersions.filter((item) => item.needId === NEED), latestNeeds: latestDevelopment(snapshot), latestTrainings: latestTraining(snapshot),
      finding: { competencyName: "Tax", requiredLevel: 4, actualLevel: 4, status: "Terpenuhi" }, at: "2026-11-10T03:00:00.000Z",
    });
    // The training being completed no longer counts as running, and counts as the passed one.
    expect(plan).toMatchObject({ training: "version", retraining: false, snapshot: true, development: { status: "Completed", reassessment: "Meets requirement" } });
  });

  it("finds what is still open: a follow-up, a reassessment, or nothing", () => {
    const version = (patch: object) => ({ revision: 1, status: "Completed" as const, result: "Passed", followUp: null, createdAt: "2026-11-02T00:00:00.000Z", ...patch });
    const open = { status: "In Progress" as const };
    expect(pendingDecision([version({ result: "Not Passed" })], open, [])).toBe("follow-up");
    expect(pendingDecision([version({})], open, [])).toBe("reassessment");
    // A Retraining recorded after the pass decided it.
    expect(pendingDecision([version({})], { status: "Planned" }, [{ revision: 2, status: "Planned", reassessment: "Retraining", createdAt: "2026-11-03T00:00:00.000Z" }])).toBeNull();
    expect(pendingDecision([version({})], { status: "Completed" }, [{ revision: 2, status: "Completed", reassessment: "Meets requirement", createdAt: "2026-11-03T00:00:00.000Z" }])).toBeNull();
    expect(pendingDecision([version({ status: "In Progress", result: "" })], open, [])).toBeNull();
  });
});

describe("a requirement cannot be closed by hand (13 Nov 2026)", () => {
  it("refuses a manual Completed and leaves the reassessment untouched", async () => {
    const source = await hrSource();
    await expect(source.updateDevelopment("FIX-D4-DEV-001", "Completed", "Ditutup lewat coaching langsung oleh atasan")).rejects.toThrow(/mengikuti Training Tracking/);
    expect(reassessmentFor(await source.loadSnapshot(), "FIX-D4-DEV-001")).toBeNull();
  });
});

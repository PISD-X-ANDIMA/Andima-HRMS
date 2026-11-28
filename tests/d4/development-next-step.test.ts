import { afterEach, describe, expect, it, vi } from "vitest";
import { latestDevelopment, latestTraining } from "@/modules/d4/supabase/types";
import type { D4DataSource } from "@/modules/d4/web/data/source";
import { nextStep, type Snapshot } from "@/modules/d4/web/data/selectors";

// HR (10 Nov 2026): a requirement stayed Identified while its training was already finished, and Development
// Requirement showed "—" where a Retraining decision was waiting. The status now follows the training, and the
// Next step column says what comes next with the button that does it.
const ALFA = "d4000000-0000-4000-8000-000000000009"; // FIX-D4-DEV-001, FIX-D4-TRN-001 Planned
const ENA = "FIX-D4-DEV-003"; // FIX-D4-TRN-003 Completed, Not Passed, no follow-up yet

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

const needOf = (snapshot: Snapshot, needId: string) => latestDevelopment(snapshot).find((item) => item.needId === needId)!;
const step = (snapshot: Snapshot, needId: string) => nextStep(snapshot, needOf(snapshot, needId));

describe("the requirement status follows its training", () => {
  it("moves a new requirement to Planned on its first training and to In Progress when it starts, as new revisions", async () => {
    const source = await hrSource();
    const needId = await source.createDevelopment({ employeeId: ALFA, sourceType: "performance_context", sourceRef: "KPI-ALFA", objective: "Naikkan ketepatan laporan", priority: "Medium", notes: "", method: "Coaching", pic: "Bu Maya" });
    expect(step(await source.loadSnapshot(), needId)).toEqual({ kind: "create", retraining: false });
    const trainingId = await source.createTraining({ employeeId: ALFA, developmentNeedId: needId, activity: "Coaching laporan", date: "2030-01-15", status: "Planned", result: "", notes: "" });
    let snapshot = await source.loadSnapshot();
    expect(needOf(snapshot, needId)).toMatchObject({ status: "Planned", revision: 2, notes: "Mengikuti Training Tracking." });
    expect(step(snapshot, needId)).toMatchObject({ kind: "running", retraining: false });
    await source.updateTraining(trainingId, "In Progress", "", "");
    snapshot = await source.loadSnapshot();
    expect(needOf(snapshot, needId)).toMatchObject({ status: "In Progress", revision: 3 });
    // Finishing it changes nothing more: In Progress already; Completed stays HR's decision.
    await source.updateTraining(trainingId, "Completed", "Not Passed", "");
    snapshot = await source.loadSnapshot();
    expect(needOf(snapshot, needId).revision).toBe(3);
    expect(step(snapshot, needId)).toMatchObject({ kind: "decide", decision: "follow-up", training: { trainingId } });
  });
});

describe("Next step of a requirement", () => {
  it("offers Retraining for a Not Passed training and then follows the training it creates", async () => {
    const source = await hrSource();
    let snapshot = await source.loadSnapshot();
    expect(step(snapshot, ENA)).toMatchObject({ kind: "decide", decision: "follow-up", training: { trainingId: "FIX-D4-TRN-003" } });
    const retrainingId = await source.completeTraining("FIX-D4-TRN-003", { result: "Not Passed", decision: "Retraining", notes: "", activity: "Records Retention Workshop (ulang)", date: "2030-01-15" });
    snapshot = await source.loadSnapshot();
    expect(step(snapshot, ENA)).toMatchObject({ kind: "running", retraining: true, training: { trainingId: retrainingId, status: "Planned" } });
  });

  it("asks for the reassessment of a Passed training, then shows the retraining round it opened", async () => {
    const source = await hrSource();
    await passThenReassess(source, "FIX-D4-TRN-002");
    let snapshot = await source.loadSnapshot();
    expect(step(snapshot, "FIX-D4-DEV-002")).toMatchObject({ kind: "decide", decision: "reassessment", training: { trainingId: "FIX-D4-TRN-002" } });
    const retrainingId = await source.completeTraining("FIX-D4-TRN-002", { result: "Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    snapshot = await source.loadSnapshot();
    expect(needOf(snapshot, "FIX-D4-DEV-002")).toMatchObject({ status: "Planned", reassessment: "Retraining" });
    expect(step(snapshot, "FIX-D4-DEV-002")).toMatchObject({ kind: "running", retraining: true, training: { trainingId: retrainingId } });
  });

  it("asks to create the retraining when Retraining reopened the requirement but its training is gone", async () => {
    const source = await hrSource();
    await passThenReassess(source, "FIX-D4-TRN-002");
    const retrainingId = await source.completeTraining("FIX-D4-TRN-002", { result: "Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    await source.updateTraining(retrainingId!, "Cancelled", "", "Jadwal batal");
    expect(step(await source.loadSnapshot(), "FIX-D4-DEV-002")).toEqual({ kind: "create", retraining: true });
  });

  it("shows Meets requirement once the requirement is closed with it", async () => {
    const source = await hrSource();
    const snapshot = await source.loadSnapshot();
    const closed = { ...snapshot, developmentVersions: [{ ...needOf(snapshot, "FIX-D4-DEV-001"), id: "V-CLOSED", revision: 9, status: "Completed" as const, reassessment: "Meets requirement" as const, createdAt: "2026-11-10T09:00:00.000Z" }, ...snapshot.developmentVersions],
      trainingVersions: [{ ...latestTraining(snapshot).find((item) => item.trainingId === "FIX-D4-TRN-001")!, id: "T-DONE", revision: 9, status: "Completed" as const, result: "Passed", createdAt: "2026-11-10T08:00:00.000Z" }, ...snapshot.trainingVersions] };
    expect(step(closed, "FIX-D4-DEV-001")).toEqual({ kind: "closed", meets: true });
  });
});

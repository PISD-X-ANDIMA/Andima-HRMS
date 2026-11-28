import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4DataSource, EvaluationDraft, KpiAssessmentDraft } from "@/modules/d4/web/data/source";
import { latestDevelopment, latestTraining } from "@/modules/d4/supabase/types";

// Fixture people (rows of the org file): Mrs. Maya is the HR actor, Kak Ismi an Accounting Associate, Mba Ena the Manager of Accounting.
const MERCURY = "d4000000-0000-4000-8000-000000000012";
const ALFA = "d4000000-0000-4000-8000-000000000009";
const HOLLY = "d4000000-0000-4000-8000-000000000016";
const ALFA_GAP = "d4000000-0000-4000-8000-000000000028"; // Administrative Accuracy, level 2 of min. 4

const evaluation = (patch: Partial<EvaluationDraft> = {}): EvaluationDraft => ({
  employeeId: HOLLY, period: "2026-09", evaluationDate: "2026-09-30", evaluator: "Mrs. Maya", status: "completed",
  reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Catatan uji.", evidenceReference: null, ...patch,
});

let source: D4DataSource;
beforeEach(() => { source = createFixtureSource(); });

async function kpiDraft(employeeId: string, period: string, patch: Partial<KpiAssessmentDraft> = {}): Promise<KpiAssessmentDraft> {
  const snapshot = await source.loadSnapshot();
  const current = snapshot.kpiAssessments!.find((item) => item.employeeId === ALFA)!;
  return { employeeId, roleOrder: current.roleOrder, period, evaluationDate: "2026-10-01", evaluatorName: "x", status: "completed",
    lines: current.lines.map((line) => ({ ...line, raw_score: 4 })), generalNotes: "Catatan uji.", evidenceReference: "DOC-1", ...patch };
}

describe("performance evaluation (fixture)", () => {
  // Mid-October: September (last month) and October are open, November has not started (open/closed periods, 24 Nov 2026).
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T03:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });
  it("saves a first evaluation and stores the signed-in actor as evaluator", async () => {
    const id = await source.createEvaluation(evaluation({ evaluator: "Nama Palsu" }));
    const saved = (await source.loadSnapshot()).performance.find((item) => item.id === id)!;
    expect(saved.evaluator).toBe("Mrs. Maya");
  });

  it("rejects a second record for the same period unless it names the current one", async () => {
    const first = await source.createEvaluation(evaluation());
    await expect(source.createEvaluation(evaluation())).rejects.toThrow(/sudah ada/);
    await expect(source.createEvaluation(evaluation({ revisionOf: "FIX-OTHER" }))).rejects.toThrow(/lebih baru/);
    const second = await source.createEvaluation(evaluation({ revisionOf: first, overallScore: 3 }));
    await expect(source.createEvaluation(evaluation({ revisionOf: first }))).rejects.toThrow(/lebih baru/); // stale revision
    // Interview 13 Nov 2026: one revision per period, so a revision of the revision is refused.
    await expect(source.createEvaluation(evaluation({ revisionOf: second }))).rejects.toThrow(/satu revisi per periode/);
    expect((await source.loadSnapshot()).performance.filter((item) => item.employeeId === HOLLY)).toHaveLength(2);
  });

  it("rejects revisionOf when nothing exists for the period", async () => {
    await expect(source.createEvaluation(evaluation({ period: "2026-10", revisionOf: "FIX-D4-PERF-001" }))).rejects.toThrow(/tidak cocok/);
  });

  it("rejects self-evaluation", async () => {
    await expect(source.createEvaluation(evaluation({ employeeId: MERCURY, period: "2026-12" }))).rejects.toThrow(/diri sendiri/);
  });

  it("rejects a competency assessment, requirement or training for the actor themselves (SR-D4-EMP-23)", async () => {
    await expect(source.saveCompetency({ employeeId: MERCURY, positionId: ALFA, effectiveDate: "2026-10-01" })).rejects.toThrow(/diri sendiri/);
    await expect(source.createDevelopment({ employeeId: MERCURY, sourceType: "role_change", sourceRef: ALFA, objective: "Uji", priority: "High", pic: "Mrs. Maya", notes: "" })).rejects.toThrow(/diri sendiri/);
    await expect(source.createTraining({ employeeId: MERCURY, developmentNeedId: "FIX-D4-DEV-001", activity: "Uji", date: "2030-01-15", status: "Planned", result: "", notes: "" })).rejects.toThrow(/diri sendiri/);
  });

  it.each([
    ["empty notes", { generalNotes: "  " }],
    ["bad period", { period: "2026-13" }],
  ])("rejects invalid input: %s", async (_name, patch) => {
    await expect(source.createEvaluation(evaluation(patch as Partial<EvaluationDraft>))).rejects.toThrow();
  });

  it("rejects an evaluation for a period that has not started (D4-FN-01)", async () => {
    await expect(source.createEvaluation(evaluation({ period: "2026-12" }))).rejects.toThrow("Period belum dimulai.");
    await expect(source.createKpiAssessment(await kpiDraft(ALFA, "2026-11"))).rejects.toThrow(/belum dimulai/);
    const snapshot = await source.loadSnapshot();
    expect(snapshot.performance.some((item) => item.period === "2026-12")).toBe(false);
    expect(snapshot.kpiAssessments!.some((item) => item.period === "2026-11")).toBe(false);
  });

  it("refuses a period before D4 records start, and a closed one", async () => {
    await expect(source.createEvaluation(evaluation({ period: "2026-08" }))).rejects.toThrow(/September 2026/);
    vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
    await expect(source.createEvaluation(evaluation())).rejects.toThrow(/sudah ditutup/);
  });

  it("stores the saved day as the evaluation date, ignoring the one sent", async () => {
    const id = await source.createEvaluation(evaluation({ evaluationDate: "2026-09-01" }));
    expect((await source.loadSnapshot()).performance.find((item) => item.id === id)?.evaluationDate).toBe("2026-10-15");
  });

  it("saves an evaluation without a score (scores live in the KPI Scorecard)", async () => {
    const id = await source.createEvaluation(evaluation({ period: "2026-10", overallScore: null }));
    expect((await source.loadSnapshot()).performance.find((item) => item.id === id)?.overallScore).toBeNull();
  });
});

describe("KPI scorecard (fixture)", () => {
  // Mid-October: September (last month) and October are open, November has not started (open/closed periods, 24 Nov 2026).
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T03:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });
  it("saves a new period and computes the weighted total", async () => {
    const id = await source.createKpiAssessment(await kpiDraft(ALFA, "2026-10"));
    const saved = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!;
    expect(saved.overallScore).toBe(4);
    expect(saved.evaluatorName).toBe("Mrs. Maya");
  });

  it("requires an explicit revision for an existing period", async () => {
    await expect(source.createKpiAssessment(await kpiDraft(ALFA, "2026-09"))).rejects.toThrow(/sudah ada/);
    await source.createKpiAssessment(await kpiDraft(ALFA, "2026-09", { revisionOf: "FIX-D4-KPI-001" }));
  });

  it("rejects a KPI role that does not match the employee position", async () => {
    const draft = await kpiDraft(ALFA, "2026-10");
    await expect(source.createKpiAssessment({ ...draft, roleOrder: draft.roleOrder === 1 ? 2 : 1 })).rejects.toThrow();
  });

  it("rejects an incomplete completed scorecard", async () => {
    const draft = await kpiDraft(ALFA, "2026-10");
    await expect(source.createKpiAssessment({ ...draft, lines: draft.lines.map((line, index) => index ? line : { ...line, raw_score: null }) })).rejects.toThrow(/Semua indikator KPI harus dinilai/);
  });
});

describe("development and training (fixture)", () => {
  it("allows one open requirement per competency gap", async () => {
    const draft = { employeeId: ALFA, sourceType: "competency_gap" as const, sourceRef: ALFA_GAP, objective: "Uji", priority: "High" as const, notes: "", pic: "Budi" };
    await expect(source.createDevelopment(draft)).rejects.toThrow(/belum selesai/);
  });

  it("moves the requirement with its trainings and refuses a manual status (13 Nov 2026)", async () => {
    const status = async () => latestDevelopment(await source.loadSnapshot()).find((item) => item.needId === "FIX-D4-DEV-001")!.status;
    expect(await status()).toBe("Planned"); // FIX-D4-TRN-001 is Planned
    await source.updateTraining("FIX-D4-TRN-001", "In Progress", "", "");
    expect(await status()).toBe("In Progress");
    await source.updateTraining("FIX-D4-TRN-001", "Cancelled", "", "Jadwal batal");
    expect(await status()).toBe("Identified");
    await source.createTraining({ employeeId: ALFA, developmentNeedId: "FIX-D4-DEV-001", activity: "Coaching dengan atasan", date: "2030-01-15", status: "Planned", result: "", notes: "" });
    expect(await status()).toBe("Planned");
    for (const next of ["In Progress", "Completed"] as const) {
      await expect(source.updateDevelopment("FIX-D4-DEV-001", next, "Coaching")).rejects.toThrow(/mengikuti Training Tracking/);
    }
    // The gap is still open (level 2 of min. 4), so it cannot close on evidence either.
    await expect(source.closeDevelopment("FIX-D4-DEV-001")).rejects.toThrow(/Training Tracking/);
  });

  it("rejects training that points to another employee's requirement", async () => {
    await expect(source.createTraining({ employeeId: HOLLY, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2030-01-15", status: "Planned", result: "", notes: "" }))
      .rejects.toThrow(/pegawai yang sama/);
  });

  it("requires a result on completion and a reason on rollback", async () => {
    await expect(source.updateTraining("FIX-D4-TRN-001", "Completed", "", "")).rejects.toThrow(/Passed atau Not Passed/);
    await expect(source.updateTraining("FIX-D4-TRN-001", "Completed", "Lulus", "")).rejects.toThrow(/Passed atau Not Passed/);
    await source.updateTraining("FIX-D4-TRN-001", "Completed", "Passed", "");
    await expect(source.updateTraining("FIX-D4-TRN-001", "In Progress", "Lulus", "")).rejects.toThrow(/Alasan wajib diisi/);
    await source.updateTraining("FIX-D4-TRN-001", "In Progress", "Lulus", "Perlu sesi ulang");
    const versions = (await source.loadSnapshot()).trainingVersions.filter((item) => item.trainingId === "FIX-D4-TRN-001");
    expect(versions.map((item) => item.revision).sort()).toEqual([1, 2, 3]);
    expect(latestTraining(await source.loadSnapshot()).find((item) => item.trainingId === "FIX-D4-TRN-001")?.notes).toBe("Perlu sesi ulang");
  });

  it("keeps history append-only across status changes", async () => {
    await source.updateTraining("FIX-D4-TRN-001", "In Progress", "", "");
    await source.updateTraining("FIX-D4-TRN-001", "Cancelled", "", "Jadwal batal");
    const versions = (await source.loadSnapshot()).developmentVersions.filter((item) => item.needId === "FIX-D4-DEV-001");
    expect(versions.map((item) => item.status)).toEqual(expect.arrayContaining(["Planned", "In Progress", "Identified"]));
    expect(versions.map((item) => item.revision).sort()).toEqual(versions.map((_, index) => index + 1));
  });

  it("rejects an unknown training or requirement", async () => {
    await expect(source.updateTraining("NOPE", "Planned", "", "")).rejects.toThrow(/tidak ditemukan/);
    await expect(source.updateDevelopment("NOPE", "Planned", "")).rejects.toThrow(/tidak ditemukan/);
  });
});

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

describe("development edit and reassessment (fixture)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  const latest = async (needId: string) => latestDevelopment(await source.loadSnapshot()).find((item) => item.needId === needId)!;

  it("edits priority, method and PIC as a new revision and keeps them when a training moves the status", async () => {
    const before = await latest("FIX-D4-DEV-002");
    await source.updateDevelopment("FIX-D4-DEV-002", before.status, "Kebijakan pajak berubah", { priority: "High", method: "Coaching", pic: "Bu Maya" });
    expect(await latest("FIX-D4-DEV-002")).toMatchObject({ revision: before.revision + 1, status: before.status, priority: "High", method: "Coaching", pic: "Bu Maya" });
    await expect(source.updateDevelopment("FIX-D4-DEV-002", before.status, "", { priority: "High" })).rejects.toThrow(/Tidak ada perubahan/);
    await source.updateTraining("FIX-D4-TRN-002", "Cancelled", "", "Diganti coaching");
    expect(await latest("FIX-D4-DEV-002")).toMatchObject({ status: "Identified", priority: "High", method: "Coaching", pic: "Bu Maya" });
  });

  it("Retraining reopens the requirement for a new training; the next training moves it without the old decision", async () => {
    await passThenReassess(source, "FIX-D4-TRN-001");
    const retrainingId = await source.completeTraining("FIX-D4-TRN-001", { result: "Passed", decision: "Retraining", notes: "Perlu diulang", activity: "Workshop ulang", date: "2030-01-15" });
    expect(await latest("FIX-D4-DEV-001")).toMatchObject({ status: "Planned", reassessment: "Retraining" });
    // The decision belongs to the revision that recorded it, not to the ones after it.
    await source.updateTraining(retrainingId!, "In Progress", "", "");
    expect(await latest("FIX-D4-DEV-001")).toMatchObject({ status: "In Progress", reassessment: null });
    await expect(source.updateDevelopment("FIX-D4-DEV-001", "In Progress", "", { reassessment: "Meets requirement" })).rejects.toThrow(/mengikuti Training Tracking/);
  });

  it("stores who the competency was assessed with", async () => {
    const id = await source.saveCompetency({ employeeId: ALFA, positionId: "d4000000-0000-4000-8000-000000000008", effectiveDate: "2026-10-19", assessedWith: " Rina, Finance Manager " });
    expect((await source.loadSnapshot()).competency.find((item) => item.id === id)?.assessedWith).toBe("Rina, Finance Manager");
  });

  it("refuses edits and reassessments for an employee (read-only)", async () => {
    vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "EMPLOYEE");
    vi.resetModules();
    const { createFixtureSource: create } = await import("@/modules/d4/web/data/fixture-source");
    await expect(create().updateDevelopment("FIX-D4-DEV-001", "Planned", "", { priority: "Low" })).rejects.toThrow(/HR atau manager/);
  });
});

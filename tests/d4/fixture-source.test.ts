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
// Fixed "today" (WIB) after the fixture training dates (8 and 12 Oct 2026), so completing them is allowed.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T03:00:00Z") }); source = createFixtureSource(); });
afterEach(() => { vi.useRealTimers(); });

async function kpiDraft(employeeId: string, period: string, patch: Partial<KpiAssessmentDraft> = {}): Promise<KpiAssessmentDraft> {
  const snapshot = await source.loadSnapshot();
  const current = snapshot.kpiAssessments!.find((item) => item.employeeId === ALFA)!;
  return { employeeId, roleOrder: current.roleOrder, period, evaluationDate: "2026-10-01", evaluatorName: "x", status: "completed",
    lines: current.lines.map((line) => ({ ...line, raw_score: 4 })), generalNotes: "Catatan uji.", evidenceReference: "DOC-1", ...patch };
}

describe("performance evaluation (fixture)", () => {
  it("saves a first evaluation and stores the signed-in actor as evaluator", async () => {
    const id = await source.createEvaluation(evaluation({ evaluator: "Nama Palsu" }));
    const saved = (await source.loadSnapshot()).performance.find((item) => item.id === id)!;
    expect(saved.evaluator).toBe("Mrs. Maya");
  });

  it("rejects a second record for the same period unless it names the current one", async () => {
    const first = await source.createEvaluation(evaluation());
    await expect(source.createEvaluation(evaluation())).rejects.toThrow(/sudah ada/);
    await expect(source.createEvaluation(evaluation({ revisionOf: "FIX-OTHER" }))).rejects.toThrow(/sudah ada/);
    const second = await source.createEvaluation(evaluation({ revisionOf: first, overallScore: 3 }));
    await expect(source.createEvaluation(evaluation({ revisionOf: first }))).rejects.toThrow(/sudah ada/); // stale revision
    await source.createEvaluation(evaluation({ revisionOf: second }));
    expect((await source.loadSnapshot()).performance.filter((item) => item.employeeId === HOLLY)).toHaveLength(3);
  });

  it("rejects revisionOf when nothing exists for the period", async () => {
    await expect(source.createEvaluation(evaluation({ period: "2026-08", revisionOf: "FIX-D4-PERF-001" }))).rejects.toThrow(/tidak cocok/);
  });

  it("rejects self-evaluation", async () => {
    await expect(source.createEvaluation(evaluation({ employeeId: MERCURY, period: "2026-12" }))).rejects.toThrow(/diri sendiri/);
  });

  it.each([
    ["empty notes", { generalNotes: "  " }],
    ["bad period", { period: "2026-13" }],
    ["missing date", { evaluationDate: "" }],
  ])("rejects invalid input: %s", async (_name, patch) => {
    await expect(source.createEvaluation(evaluation(patch as Partial<EvaluationDraft>))).rejects.toThrow();
  });

  it("rejects an evaluation for a period that has not started (D4-FN-01)", async () => {
    await expect(source.createEvaluation(evaluation({ period: "2026-12", evaluationDate: "2026-10-01" }))).rejects.toThrow("Tanggal evaluasi tidak boleh sebelum awal periode.");
    await expect(source.createKpiAssessment(await kpiDraft(ALFA, "2026-11", { evaluationDate: "2026-10-01" }))).rejects.toThrow(/awal periode/);
    const snapshot = await source.loadSnapshot();
    expect(snapshot.performance.some((item) => item.period === "2026-12")).toBe(false);
    expect(snapshot.kpiAssessments!.some((item) => item.period === "2026-11")).toBe(false);
  });

  it("saves an evaluation without a score (scores live in the KPI Scorecard)", async () => {
    const id = await source.createEvaluation(evaluation({ period: "2026-08", overallScore: null }));
    expect((await source.loadSnapshot()).performance.find((item) => item.id === id)?.overallScore).toBeNull();
  });
});

describe("KPI scorecard (fixture)", () => {
  it("saves a new period and computes the weighted total", async () => {
    const id = await source.createKpiAssessment(await kpiDraft(ALFA, "2026-10"));
    const saved = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.id === id)!;
    expect(saved.overallScore).toBe(4);
    expect(saved.evaluatorName).toBe("Mrs. Maya");
  });

  it("requires an explicit revision for an existing period", async () => {
    await expect(source.createKpiAssessment(await kpiDraft(ALFA, "2026-09"))).rejects.toThrow(/sudah ada/);
    await source.createKpiAssessment(await kpiDraft(ALFA, "2026-09", { revisionOf: "FIX-D4-KPI-001", generalNotes: "Koreksi skor indikator 2." }));
  });

  it("requires a reason in the notes for a revision", async () => {
    await expect(source.createKpiAssessment(await kpiDraft(ALFA, "2026-09", { revisionOf: "FIX-D4-KPI-001", generalNotes: "  " }))).rejects.toThrow(/Notes wajib diisi/);
  });

  it("rejects a KPI role that does not match the employee position", async () => {
    const draft = await kpiDraft(ALFA, "2026-10");
    await expect(source.createKpiAssessment({ ...draft, roleOrder: draft.roleOrder === 1 ? 2 : 1 })).rejects.toThrow();
  });

  it("rejects an incomplete completed scorecard", async () => {
    const draft = await kpiDraft(ALFA, "2026-10");
    await expect(source.createKpiAssessment({ ...draft, lines: draft.lines.map((line, index) => index ? line : { ...line, raw_score: null }) })).rejects.toThrow(/lima indikator KPI/);
  });
});

describe("development and training (fixture)", () => {
  it("allows one open requirement per competency gap and a new one after completion", async () => {
    const draft = { employeeId: ALFA, sourceType: "competency_gap" as const, sourceRef: ALFA_GAP, objective: "Uji", priority: "High" as const, notes: "" };
    await expect(source.createDevelopment(draft)).rejects.toThrow(/belum selesai/);
    await source.updateDevelopment("FIX-D4-DEV-001", "Completed", "Selesai");
    const needId = await source.createDevelopment({ ...draft, method: "Coaching", pic: "Budi" });
    await source.updateDevelopment(needId, "Planned", "");
    expect(latestDevelopment(await source.loadSnapshot()).find((item) => item.needId === needId)).toMatchObject({ status: "Planned", method: "Coaching", pic: "Budi" });
  });

  it("rejects new training for a completed requirement", async () => {
    // DEV-001 still has a Planned training, so completing it needs a reason.
    await expect(source.updateDevelopment("FIX-D4-DEV-001", "Completed", "")).rejects.toThrow(/masih Planned atau In Progress/);
    await source.updateDevelopment("FIX-D4-DEV-001", "Completed", "Workshop dibatalkan, diganti coaching");
    await expect(source.createTraining({ employeeId: ALFA, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2026-10-01", status: "Planned", result: "", notes: "" }))
      .rejects.toThrow(/Completed/);
  });

  it("rejects training that points to another employee's requirement", async () => {
    await expect(source.createTraining({ employeeId: HOLLY, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2026-10-01", status: "Planned", result: "", notes: "" }))
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

  it("requires a reason when a requirement moves back", async () => {
    await source.updateDevelopment("FIX-D4-DEV-001", "In Progress", "");
    await expect(source.updateDevelopment("FIX-D4-DEV-001", "Identified", "")).rejects.toThrow(/Alasan/);
    await source.updateDevelopment("FIX-D4-DEV-001", "Completed", "Ditutup lewat coaching");
    await expect(source.updateDevelopment("FIX-D4-DEV-001", "Planned", " ")).rejects.toThrow(/Alasan/);
    await source.updateDevelopment("FIX-D4-DEV-001", "Planned", "Dibuka lagi: hasil workshop belum cukup");
  });

  it("rejects Completed training dated after today (WIB)", async () => {
    await expect(source.createTraining({ employeeId: ALFA, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2026-10-21", status: "Completed", result: "Passed", notes: "" }))
      .rejects.toThrow(/lebih dari hari ini/);
    await source.createTraining({ employeeId: ALFA, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2026-10-21", status: "Planned", result: "", notes: "" });
    vi.setSystemTime(new Date("2026-10-05T03:00:00Z")); // before the 8 Oct fixture training
    await expect(source.updateTraining("FIX-D4-TRN-001", "Completed", "Passed", "")).rejects.toThrow(/lebih dari hari ini/);
  });

  it("rejects development and training for the actor themselves", async () => {
    const own = (await source.loadSnapshot()).performance.find((item) => item.employeeId === ALFA)!.id; // any valid source; the self check comes first
    await expect(source.createDevelopment({ employeeId: MERCURY, sourceType: "performance_context", sourceRef: own, objective: "Uji", priority: "Low", notes: "" })).rejects.toThrow(/diri sendiri/);
    await expect(source.createTraining({ employeeId: MERCURY, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2026-10-01", status: "Planned", result: "", notes: "" })).rejects.toThrow(/diri sendiri/);
  });

  it("keeps history append-only across status changes", async () => {
    await source.updateDevelopment("FIX-D4-DEV-001", "In Progress", "a");
    await source.updateDevelopment("FIX-D4-DEV-001", "Completed", "b");
    const versions = (await source.loadSnapshot()).developmentVersions.filter((item) => item.needId === "FIX-D4-DEV-001");
    expect(versions.map((item) => item.status)).toEqual(expect.arrayContaining(["Planned", "In Progress", "Completed"]));
  });

  it("rejects an unknown training or requirement", async () => {
    await expect(source.updateTraining("NOPE", "Planned", "", "")).rejects.toThrow(/tidak ditemukan/);
    await expect(source.updateDevelopment("NOPE", "Planned", "")).rejects.toThrow(/tidak ditemukan/);
  });
});

describe("development edit and reassessment (fixture)", () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  const latest = async (needId: string) => latestDevelopment(await source.loadSnapshot()).find((item) => item.needId === needId)!;

  it("edits priority, method and PIC as a new revision and keeps them on later status changes", async () => {
    await source.updateDevelopment("FIX-D4-DEV-002", "In Progress", "Kebijakan pajak berubah", { priority: "High", method: "Coaching", pic: "Bu Maya" });
    expect(await latest("FIX-D4-DEV-002")).toMatchObject({ revision: 2, status: "In Progress", priority: "High", method: "Coaching", pic: "Bu Maya" });
    await source.updateDevelopment("FIX-D4-DEV-002", "Completed", "Briefing selesai, dinilai ulang");
    expect(await latest("FIX-D4-DEV-002")).toMatchObject({ revision: 3, status: "Completed", priority: "High", pic: "Bu Maya" });
    await expect(source.updateDevelopment("FIX-D4-DEV-002", "Completed", "", { priority: "High" })).rejects.toThrow(/Tidak ada perubahan/);
  });

  it("Retraining reopens the requirement for a new training; the next completion asks for a new decision", async () => {
    await source.updateDevelopment("FIX-D4-DEV-001", "Completed", "Workshop dibatalkan, diganti coaching");
    await source.updateDevelopment("FIX-D4-DEV-001", "Planned", "", { reassessment: "Retraining" });
    expect(await latest("FIX-D4-DEV-001")).toMatchObject({ status: "Planned", reassessment: "Retraining" });
    await source.createTraining({ employeeId: ALFA, developmentNeedId: "FIX-D4-DEV-001", activity: "Workshop ulang", date: "2026-10-01", status: "Planned", result: "", notes: "" });
    // The decision belongs to the revision that recorded it, not to the ones after it.
    await source.updateDevelopment("FIX-D4-DEV-001", "In Progress", "");
    expect((await latest("FIX-D4-DEV-001")).reassessment).toBeNull();
    await expect(source.updateDevelopment("FIX-D4-DEV-001", "In Progress", "", { reassessment: "Meets requirement" })).rejects.toThrow(/setelah development requirement Completed/);
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

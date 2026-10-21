import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompetencyAssessment } from "@/modules/d4/competency/types";
import type { DevelopmentNeedVersion, DevelopmentStatus } from "@/modules/d4/development/types";
import { assertDevelopmentChange, assertTrainingResult, passedTrainingCount, assertGapAssessed, assertNotFutureDate, assertEvaluationInPeriod, assertTrainingDate, nextDevelopmentRevision, openTrainingCount, isTrainingRollback, localMonth, localToday, reassessmentOf, retrainedAt, revisionNumber, isDevelopmentRollback } from "@/modules/d4/shared/rules";
import type { EmployeeReference } from "@/modules/d4/shared/types";
import { asEmployee, assessableEmployees, inTrainingOrPositionChange, canWrite, currentCompetencyStatus, currentGap, latestCurrentPositionAssessment, objectiveFromFinding, revisionChanges, revisionTag, visibleEmployees, type Snapshot, formatPeriod, formatResult, periodsOf } from "@/modules/d4/web/data/selectors";
import type { TrainingStatus } from "@/modules/d4/training/types";

const ALFA = "d4000000-0000-4000-8000-000000000009";
const MERCURY = "d4000000-0000-4000-8000-000000000012";
const ECHO = "d4000000-0000-4000-8000-000000000014"; // fixture manager (Finance)
const HOLLY = "d4000000-0000-4000-8000-000000000016"; // Finance, Echo's team
const DIAN = "d4000000-0000-4000-8000-000000000011"; // Finance (Tax Manager), Echo's team
const BRAVO = "d4000000-0000-4000-8000-000000000010"; // Sales, outside Echo's team

async function fixtureAs(role: "HR" | "MANAGER" | "EMPLOYEE") {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", role);
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
afterEach(() => { vi.unstubAllEnvs(); });

describe("WIB dates", () => {
  it("uses the Jakarta date before 07:00 WIB, when UTC is still yesterday", () => {
    const earlyMorning = new Date("2026-09-30T17:30:00Z"); // 00:30 WIB on 1 Oct
    expect(localToday(earlyMorning)).toBe("2026-10-01");
    expect(localMonth(new Date("2026-09-30T18:00:00Z"))).toBe("2026-10");
  });
});

describe("training rollback", () => {
  const statuses: TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];
  const rollbacks = new Set(["In Progress>Planned", "Completed>Planned", "Completed>In Progress", "Completed>Cancelled", "Cancelled>Planned", "Cancelled>In Progress", "Cancelled>Completed"]);
  it.each(statuses.flatMap((from) => statuses.map((to) => [from, to] as const)))("%s → %s", (from, to) => {
    expect(isTrainingRollback(from, to)).toBe(rollbacks.has(`${from}>${to}`));
  });
});

describe("development rollback", () => {
  const statuses: DevelopmentStatus[] = ["Identified", "Planned", "In Progress", "Completed"];
  it.each(statuses.flatMap((from) => statuses.map((to) => [from, to] as const)))("%s → %s", (from, to) => {
    expect(isDevelopmentRollback(from, to)).toBe(statuses.indexOf(to) < statuses.indexOf(from));
  });
});

describe("display formatting", () => {
  it("shows the evaluation result with its V5.1 label and Indonesian month names", () => {
    expect(formatResult(4)).toBe("4 · Good");
    expect(formatResult(null)).toBe("—");
    expect(formatPeriod("2026-09")).toBe("September 2026");
  });

  it("lists periods newest first, so the first is the default cycle", () => {
    expect(periodsOf([{ period: "2026-06" }, { period: "2026-09" }, { period: "2026-06" }])).toEqual(["2026-09", "2026-06"]);
  });
});

describe("revision numbering", () => {
  const records = [
    { id: "a", employeeId: ALFA, period: "2026-09", createdAt: "2026-09-01T00:00:00Z" },
    { id: "b", employeeId: ALFA, period: "2026-09", createdAt: "2026-09-02T00:00:00Z" },
    { id: "c", employeeId: ALFA, period: "2026-08", createdAt: "2026-09-03T00:00:00Z" },
  ];
  it("counts only the same employee and period", () => {
    expect(records.map((item) => revisionNumber(records, item))).toEqual([1, 2, 1]);
    expect(records.map((item) => revisionTag(records, item))).toEqual(["", " · Revision 2", ""]);
  });
});

describe("current competency display status", () => {
  const currentPosition = "position-current";
  const otherPosition = "position-other";
  const employee: EmployeeReference = { id: ALFA, employeeId: "EMP-001", fullName: "Kak Ismi", positionId: currentPosition, departmentId: null };
  const snapshotWithSkill = (level: number | null = 5, evidence: string | null = "Recorded evidence"): Snapshot => ({
    role: "HR", actorEmployeeId: MERCURY, kpi: [], performance: [], competency: [], developmentVersions: [], trainingVersions: [],
    reference: {
      source: "fixture", departments: [], employees: [employee, { ...employee, id: MERCURY, employeeId: "EMP-002" }],
      positions: [currentPosition, otherPosition].map((id) => ({ id, code: id, title: id, departmentId: null })),
      competencies: [{ id: "competency", code: "COMP-001", name: "Accuracy", category: null }],
      positionRequirements: [currentPosition, otherPosition].map((positionId) => ({ id: `requirement-${positionId}`, positionId, competencyId: "competency", minProficiencyLevel: 4, isMandatory: true })),
      employeeSkills: level === null ? [] : [{ id: "skill", employeeId: ALFA, competencyId: "competency", proficiencyLevel: level, evidenceNotes: evidence }],
    },
  });
  const assessment = (overrides: Partial<CompetencyAssessment> = {}): CompetencyAssessment => ({
    id: "assessment", source: "local-demo", employeeId: ALFA, positionId: currentPosition, effectiveDate: "2026-10-01", context: "current-position",
    findings: [{ requirementId: `requirement-${currentPosition}`, competencyId: "competency", competencyName: "Accuracy", requiredLevel: 4, actualLevel: 2, evidenceNotes: "Earlier evidence", sourceReference: "skill", status: "Gap" }],
    overallStatus: "Gap", createdAt: "2026-10-01T08:00:00.000Z", actor: "Mrs. Maya", ...overrides,
  });

  it.each([
    { level: 5, evidence: "Recorded evidence", comparison: "Terpenuhi" },
    { level: 2, evidence: "Recorded evidence", comparison: "Gap" },
    { level: 5, evidence: null, comparison: "Bukti Belum Cukup" },
    { level: null, evidence: null, comparison: "Bukti Belum Cukup" },
  ])("shows Not Evaluated without an assessment, even when live comparison is $comparison (level $level)", ({ level, evidence, comparison }) => {
    const snapshot = snapshotWithSkill(level, evidence);
    expect(currentGap(snapshot, employee)?.overallStatus).toBe(comparison);
    expect(latestCurrentPositionAssessment(snapshot, employee)).toBeUndefined();
    expect(currentCompetencyStatus(snapshot, employee)).toBe("Not Evaluated");
  });

  it("ignores assessments for another employee or another position", () => {
    const snapshot = { ...snapshotWithSkill(), competency: [assessment({ employeeId: MERCURY }), assessment({ id: "old-position", positionId: otherPosition })] };
    expect(latestCurrentPositionAssessment(snapshot, employee)).toBeUndefined();
    expect(currentCompetencyStatus(snapshot, employee)).toBe("Not Evaluated");
  });

  it("uses a position-change snapshot when that position becomes the active master position", () => {
    const saved = assessment({ positionId: otherPosition, context: "role-change" });
    const snapshot = { ...snapshotWithSkill(), competency: [saved] };
    expect(currentCompetencyStatus(snapshot, employee)).toBe("Not Evaluated");

    const reassigned = { ...employee, positionId: otherPosition };
    const changed: Snapshot = { ...snapshot, reference: { ...snapshot.reference, employees: [reassigned] } };
    expect(latestCurrentPositionAssessment(changed, reassigned)).toBe(saved);
    expect(currentCompetencyStatus(changed, reassigned)).toBe("Terpenuhi");
  });

  it("selects the newest created assessment for the active position from unsorted records", () => {
    const middle = assessment({ id: "middle", createdAt: "2026-10-02T08:00:00.000Z" });
    const newest = assessment({ id: "newest", effectiveDate: "2026-09-01", createdAt: "2026-10-03T08:00:00.000Z" });
    const records = [middle, assessment({ id: "oldest" }), assessment({ id: "other-position", positionId: otherPosition, createdAt: "2026-10-04T08:00:00.000Z" }), newest];
    const snapshot = { ...snapshotWithSkill(), competency: records };
    expect(latestCurrentPositionAssessment(snapshot, employee)).toBe(newest);
    expect(latestCurrentPositionAssessment(snapshot, employee)?.effectiveDate).toBe("2026-09-01");
    expect(snapshot.competency.map((item) => item.id)).toEqual(["middle", "oldest", "other-position", "newest"]);
  });

  it.each([
    { level: 5, evidence: "Recorded evidence", status: "Terpenuhi" },
    { level: 2, evidence: "Recorded evidence", status: "Gap" },
    { level: 5, evidence: null, status: "Bukti Belum Cukup" },
  ])("preserves the assessed live comparison status $status", ({ level, evidence, status }) => {
    // The saved snapshot remains Gap; presentation follows current evidence once assessment exists.
    const snapshot = { ...snapshotWithSkill(level, evidence), competency: [assessment()] };
    expect(currentCompetencyStatus(snapshot, employee)).toBe(status);
    expect(snapshot.competency[0].overallStatus).toBe("Gap");
  });

  it.each([null, "unknown-position"])("shows Not Evaluated for a missing or invalid active position (%s)", (positionId) => {
    const unassigned = { ...employee, positionId };
    const base = snapshotWithSkill();
    const snapshot: Snapshot = {
      ...base, reference: { ...base.reference, employees: [unassigned] },
      competency: [assessment(), assessment({ id: "invalid-position", positionId: "unknown-position" })],
    };
    expect(currentGap(snapshot, unassigned)).toBeNull();
    expect(latestCurrentPositionAssessment(snapshot, unassigned)).toBeUndefined();
    expect(currentCompetencyStatus(snapshot, unassigned)).toBe("Not Evaluated");
  });

  it("keeps the no-requirements comparison status when an active-position assessment exists", () => {
    const base = snapshotWithSkill();
    const snapshot: Snapshot = { ...base, reference: { ...base.reference, positionRequirements: [] }, competency: [assessment()] };
    expect(currentCompetencyStatus(snapshot, employee)).toBe("Belum Ada Persyaratan");
  });
});

describe("role views (fixture)", () => {
  it("HR writes, sees everyone, and cannot pick themselves", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    expect(canWrite(snapshot)).toBe(true);
    expect(visibleEmployees(snapshot).length).toBe(snapshot.reference.employees.length);
    expect(assessableEmployees(snapshot).some((item) => item.id === MERCURY)).toBe(false);
  });

  it("MANAGER writes, sees only their own department and never themselves", async () => {
    const source = await fixtureAs("MANAGER");
    const snapshot = await source.loadSnapshot();
    expect(canWrite(snapshot)).toBe(true);
    expect(snapshot.actorEmployeeId).toBe(ECHO);
    expect(visibleEmployees(snapshot).map((item) => item.id).sort()).toEqual([ALFA, DIAN, HOLLY].sort());
    expect(assessableEmployees(snapshot)).toEqual(visibleEmployees(snapshot));
    const records = [...snapshot.performance, ...(snapshot.kpiAssessments ?? []), ...snapshot.competency, ...snapshot.developmentVersions, ...snapshot.trainingVersions];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((item) => [ALFA, DIAN, HOLLY].includes(item.employeeId))).toBe(true);
    await expect(source.createEvaluation({ employeeId: BRAVO, period: "2026-10", evaluationDate: "2026-10-01", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Uji", evidenceReference: null })).rejects.toThrow(/anggota tim/);
    await source.createEvaluation({ employeeId: HOLLY, period: "2026-10", evaluationDate: "2026-10-01", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Uji", evidenceReference: null });
  });

  it("EMPLOYEE is read-only and receives only their own records", async () => {
    const source = await fixtureAs("EMPLOYEE");
    const snapshot = await source.loadSnapshot();
    expect(canWrite(snapshot)).toBe(false);
    expect(visibleEmployees(snapshot).map((item) => item.id)).toEqual([ALFA]);
    expect(assessableEmployees(snapshot)).toEqual([]);
    const records = [...snapshot.performance, ...(snapshot.kpiAssessments ?? []), ...snapshot.competency, ...snapshot.developmentVersions, ...snapshot.trainingVersions];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((item) => item.employeeId === ALFA)).toBe(true);
    await expect(source.createEvaluation({ employeeId: MERCURY, period: "2026-10", evaluationDate: "2026-10-01", evaluator: "x", status: "completed", reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "", evidenceReference: null })).rejects.toThrow(/Hanya HR/);
  });

  it("HR simulating an employee sees exactly that employee's view, read-only", async () => {
    const snapshot = asEmployee(await (await fixtureAs("HR")).loadSnapshot(), ALFA);
    expect(canWrite(snapshot)).toBe(false);
    expect(visibleEmployees(snapshot).map((item) => item.id)).toEqual([ALFA]);
    const records = [...snapshot.performance, ...(snapshot.kpiAssessments ?? []), ...snapshot.competency, ...snapshot.developmentVersions, ...snapshot.trainingVersions];
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((item) => item.employeeId === ALFA)).toBe(true);
  });

  it("an employee is in scope for competency only with an open requirement or a position change", async () => {
    const snapshot = await (await fixtureAs("HR")).loadSnapshot();
    const open = snapshot.developmentVersions.find((item) => item.status !== "Completed")!;
    expect(inTrainingOrPositionChange(snapshot, open.employeeId)).toBe(true);
    const closed = { ...snapshot, developmentVersions: snapshot.developmentVersions.map((item) => ({ ...item, status: "Completed" as const })), competency: [] };
    expect(inTrainingOrPositionChange(closed, open.employeeId)).toBe(false);
    const promoted = { ...closed, competency: [{ ...snapshot.competency[0], employeeId: open.employeeId, context: "role-change" as const }] };
    expect(inTrainingOrPositionChange(promoted, open.employeeId)).toBe(true);
  });

  // Trainees are whoever HR marks PROBATION or INTERN; a position change stays in scope for 6 months.
  it("a probation or intern employee is in scope without any open requirement", async () => {
    const base = await (await fixtureAs("HR")).loadSnapshot();
    const quiet = { ...base, developmentVersions: base.developmentVersions.map((item) => ({ ...item, status: "Completed" as const })), competency: [] };
    const withStatus = (status: string | null) => ({ ...quiet, reference: { ...quiet.reference, employees: quiet.reference.employees.map((item) => item.id === ALFA ? { ...item, employmentStatus: status } : item) } });
    expect(inTrainingOrPositionChange(withStatus("PROBATION"), ALFA)).toBe(true);
    expect(inTrainingOrPositionChange(withStatus("intern"), ALFA)).toBe(true);
    expect(inTrainingOrPositionChange(withStatus("PERMANENT"), ALFA)).toBe(false);
    expect(inTrainingOrPositionChange(withStatus(null), ALFA)).toBe(false);
  });

  it("a position change is in scope for 6 months only", async () => {
    const base = await (await fixtureAs("HR")).loadSnapshot();
    const change = (effectiveDate: string) => ({ ...base, developmentVersions: base.developmentVersions.map((item) => ({ ...item, status: "Completed" as const })),
      competency: [{ ...base.competency[0], employeeId: ALFA, context: "role-change" as const, effectiveDate }] });
    expect(inTrainingOrPositionChange(change("2026-04-18"), ALFA, "2026-10-17")).toBe(true);  // exactly 6 months ago
    expect(inTrainingOrPositionChange(change("2026-04-16"), ALFA, "2026-10-17")).toBe(false); // just over 6 months
    expect(inTrainingOrPositionChange(change("2026-09-30"), ALFA, "2026-10-17")).toBe(true);
  });
});

describe("development status change", () => {
  it("rejects the same status and a rollback without a reason", () => {
    expect(() => assertDevelopmentChange("Planned", "Planned", "")).toThrow(/sudah Planned/);
    expect(() => assertDevelopmentChange("In Progress", "Planned", " ")).toThrow(/Alasan wajib diisi/);
    expect(() => assertDevelopmentChange("In Progress", "Planned", "Jadwal mundur")).not.toThrow();
    expect(() => assertDevelopmentChange("Planned", "In Progress", "")).not.toThrow();
    expect(() => assertDevelopmentChange("In Progress", "Completed", "", 1)).toThrow(/masih Planned atau In Progress/);
    expect(() => assertDevelopmentChange("In Progress", "Completed", "Training diganti coaching", 1)).not.toThrow();
    expect(() => assertDevelopmentChange("In Progress", "Completed", "", 0, 1)).not.toThrow();
  });

  it("completing a need without a passed training needs a reason; a training result is Passed or Not Passed", () => {
    expect(() => assertDevelopmentChange("In Progress", "Completed", "", 0, 0)).toThrow(/Belum ada training berhasil Passed/);
    expect(() => assertDevelopmentChange("In Progress", "Completed", "Ditutup lewat coaching", 0, 0)).not.toThrow();
    const createdAt = "2026-10-01T08:00:00.000Z";
    const list = [{ developmentNeedId: "N1", status: "Completed" as const, result: "Passed", createdAt }, { developmentNeedId: "N1", status: "Completed" as const, result: "Not Passed", createdAt }, { developmentNeedId: "N2", status: "Completed" as const, result: "Passed", createdAt }];
    expect(passedTrainingCount(list, "N1")).toBe(1);
    expect(() => assertTrainingResult("Completed", "Lulus")).toThrow(/Passed atau Not Passed/);
    expect(() => assertTrainingResult("Completed", "Not Passed")).not.toThrow();
    expect(() => assertTrainingResult("In Progress", "")).not.toThrow();
  });

  it("counts only Planned/In Progress training of the need", () => {
    const list = [{ developmentNeedId: "N1", status: "Planned" as const }, { developmentNeedId: "N1", status: "Completed" as const }, { developmentNeedId: "N2", status: "In Progress" as const }];
    expect(openTrainingCount(list, "N1")).toBe(1);
  });

  it("raises a gap-based need only after the active position assessment is saved", () => {
    const employee = { id: "E1", positionId: "P1" };
    expect(() => assertGapAssessed([], employee, "competency_gap")).toThrow(/Simpan penilaian kompetensi/);
    expect(() => assertGapAssessed([{ employeeId: "E1", positionId: "P0" }], employee, "competency_gap")).toThrow();
    expect(() => assertGapAssessed([{ employeeId: "E1", positionId: "P1" }], employee, "competency_gap")).not.toThrow();
    expect(() => assertGapAssessed([], employee, "performance_context")).not.toThrow();
  });

  it("allows a future date only for training that has not been completed", () => {
    expect(() => assertTrainingDate("Completed", "2999-01-01")).toThrow(/lebih dari hari ini/);
    expect(() => assertTrainingDate("Planned", "2999-01-01")).not.toThrow();
    expect(() => assertTrainingDate("Completed", localToday())).not.toThrow();
  });
});

describe("development revision: edit, reassessment, objective", () => {
  const need = (patch: Partial<DevelopmentNeedVersion> = {}): DevelopmentNeedVersion => ({
    id: "V1", needId: "N1", revision: 1, source: "fixture", employeeId: ALFA, sourceType: "competency_gap", sourceRef: "REQ-1",
    objective: "Uji", priority: "Medium", method: "Training", pic: "", status: "In Progress", notes: "", createdAt: "2026-10-01T08:00:00.000Z", actor: "Mrs. Maya", ...patch,
  });
  const passed = [{ developmentNeedId: "N1", status: "Completed" as const, result: "Passed", createdAt: "2026-10-02T08:00:00.000Z" }];

  it("edits priority, method and PIC without a status change; left-out fields keep their value", () => {
    expect(nextDevelopmentRevision(need(), { status: "In Progress", notes: "", priority: "High", pic: " Bu Maya " }, [], [])).toEqual({
      status: "In Progress", notes: "", priority: "High", method: "Training", pic: "Bu Maya", reassessment: null,
    });
    expect(nextDevelopmentRevision(need(), { status: "In Progress", notes: "", method: "" }, [], []).method).toBe("");
    // Editing a Completed need does not ask again for the reasons needed to complete it.
    expect(() => nextDevelopmentRevision(need({ status: "Completed" }), { status: "Completed", notes: "", priority: "Low" }, [], [])).not.toThrow();
    expect(() => nextDevelopmentRevision(need(), { status: "In Progress", notes: "x", priority: "Medium", method: "Training", pic: "" }, [], [])).toThrow(/Tidak ada perubahan/);
    // A status change still follows the status rules.
    expect(() => nextDevelopmentRevision(need(), { status: "Completed", notes: "" }, [], [])).toThrow(/Belum ada training berhasil Passed/);
    expect(() => nextDevelopmentRevision(need(), { status: "Completed", notes: "" }, [], passed)).not.toThrow();
  });

  it("records a reassessment only on a Completed need: Retraining reopens it as Planned, Meets requirement keeps it Completed", () => {
    const done = need({ status: "Completed" });
    expect(() => nextDevelopmentRevision(need(), { status: "In Progress", notes: "", reassessment: "Meets requirement" }, [], [])).toThrow(/setelah development requirement Completed/);
    expect(() => nextDevelopmentRevision(done, { status: "Completed", notes: "", reassessment: "Retraining" }, [], [])).toThrow(/status Planned/);
    expect(() => nextDevelopmentRevision(done, { status: "Planned", notes: "", reassessment: "Meets requirement" }, [], [])).toThrow(/tetap Completed/);
    // The decision is the reason for moving back, so no extra note is needed.
    expect(nextDevelopmentRevision(done, { status: "Planned", notes: "", reassessment: "Retraining" }, [], [])).toMatchObject({ status: "Planned", reassessment: "Retraining" });
    expect(nextDevelopmentRevision(done, { status: "Completed", notes: "", reassessment: "Meets requirement" }, [], [])).toMatchObject({ status: "Completed", reassessment: "Meets requirement" });
    // Reopening is refused when a new requirement was already raised for the same gap.
    const other = need({ needId: "N2", status: "Planned" });
    expect(() => nextDevelopmentRevision(done, { status: "Planned", notes: "", reassessment: "Retraining" }, [done, other], [])).toThrow(/sudah memiliki development requirement/);
  });

  it("after a Retraining, completing again needs a training passed since then or a reason", () => {
    const at = (day: number) => `2026-10-0${day}T08:00:00.000Z`;
    const history = [need({ id: "V2", revision: 2, status: "Completed", createdAt: at(2) }), need({ id: "V3", revision: 3, status: "Planned", reassessment: "Retraining", createdAt: at(3) })];
    const reopened = history[1];
    const firstRound = { developmentNeedId: "N1", status: "Completed" as const, result: "Passed", createdAt: at(1) };
    expect(retrainedAt([need(), ...history])).toBe(at(3));
    expect(retrainedAt([need()])).toBeUndefined();
    expect(() => nextDevelopmentRevision(reopened, { status: "Completed", notes: "" }, [], [firstRound], history)).toThrow(/Belum ada training berhasil Passed/);
    expect(() => nextDevelopmentRevision(reopened, { status: "Completed", notes: "Ditutup lewat coaching" }, [], [firstRound], history)).not.toThrow();
    expect(() => nextDevelopmentRevision(reopened, { status: "Completed", notes: "" }, [], [firstRound, { ...firstRound, createdAt: at(4) }], history)).not.toThrow();
  });

  it("does not record the decision already in force again, also after a later edit", () => {
    const decided = need({ id: "V3", revision: 3, status: "Completed", reassessment: "Meets requirement" });
    const history = [need({ id: "V2", revision: 2, status: "Completed" }), decided];
    expect(() => nextDevelopmentRevision(decided, { status: "Completed", notes: "", reassessment: "Meets requirement" }, [], [], history)).toThrow(/Tidak ada perubahan/);
    const edited = need({ id: "V4", revision: 4, status: "Completed", pic: "Bu Maya" });
    expect(() => nextDevelopmentRevision(edited, { status: "Completed", notes: "", reassessment: "Meets requirement" }, [], [], [...history, edited])).toThrow(/Tidak ada perubahan/);
    // Changing the decision is a change.
    expect(nextDevelopmentRevision(edited, { status: "Planned", notes: "", reassessment: "Retraining" }, [], [], [...history, edited])).toMatchObject({ status: "Planned", reassessment: "Retraining" });
  });

  it("shows the decision of the current round: pending once Completed again after a Retraining", () => {
    const v = (revision: number, status: DevelopmentNeedVersion["status"], reassessment: DevelopmentNeedVersion["reassessment"] = null) => ({ revision, status, reassessment });
    expect(reassessmentOf([v(1, "Identified"), v(2, "In Progress")])).toBeNull();
    expect(reassessmentOf([v(1, "In Progress"), v(2, "Completed")])).toBe("pending");
    expect(reassessmentOf([v(3, "Completed", "Meets requirement"), v(2, "Completed"), v(1, "In Progress")])).toBe("Meets requirement");
    const retrain = [v(1, "In Progress"), v(2, "Completed"), v(3, "Planned", "Retraining"), v(4, "In Progress")];
    expect(reassessmentOf(retrain)).toBe("Retraining");
    expect(reassessmentOf([...retrain, v(5, "Completed")])).toBe("pending");
    expect(reassessmentOf([...retrain, v(5, "Completed"), v(6, "Completed", "Meets requirement")])).toBe("Meets requirement");
  });

  it("lists what a revision changed and suggests an objective from a gap finding", () => {
    expect(revisionChanges(need({ revision: 2, priority: "High", pic: "Bu Maya", reassessment: "Retraining" }), need())).toEqual(["Priority Medium → High", "PIC: — → Bu Maya", "Reassessment: Retraining"]);
    // The stored partner term is shown with its English label.
    expect(revisionChanges(need({ revision: 2, reassessment: "Meets requirement" }), need())).toEqual(["Reassessment: Meets requirement"]);
    expect(revisionChanges(need({ revision: 2, method: "Coaching" }), need())).toEqual(["Method: Training → Coaching"]);
    expect(revisionChanges(need())).toEqual([]);
    expect(objectiveFromFinding({ competencyName: "Perencanaan Strategi & Anggaran", actualLevel: 3, requiredLevel: 4 })).toBe("Naikkan Perencanaan Strategi & Anggaran dari level 3 ke 4");
    expect(objectiveFromFinding({ competencyName: "Safety", actualLevel: null, requiredLevel: 3 })).toBe("Naikkan Safety ke level 3");
  });
});

describe("future evaluation date", () => {
  it("allows today and earlier, rejects tomorrow", () => {
    const today = localToday();
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(() => assertNotFutureDate(today)).not.toThrow();
    expect(() => assertNotFutureDate("2020-01-01")).not.toThrow();
    expect(() => assertNotFutureDate(tomorrow.toISOString().slice(0, 10))).toThrow(/lebih dari hari ini/);
  });
});

// D4-FN-01: an evaluation happens on or after the first day of its period, so with the rule above the period is never in the future.
describe("evaluation date within period", () => {
  it("rejects a date before the first day of the period", () => {
    expect(() => assertEvaluationInPeriod("2026-09", "2026-08-31")).toThrow("Tanggal evaluasi tidak boleh sebelum awal periode.");
    expect(() => assertEvaluationInPeriod("2026-12", "2026-10-20")).toThrow(/awal periode/);
  });
  it("allows the first day of the period and any later date", () => {
    expect(() => assertEvaluationInPeriod("2026-09", "2026-09-01")).not.toThrow();
    expect(() => assertEvaluationInPeriod("2026-09", "2026-10-05")).not.toThrow();
    expect(() => assertEvaluationInPeriod("2026-09", "")).not.toThrow(); // a missing date is reported by its own check
  });
});

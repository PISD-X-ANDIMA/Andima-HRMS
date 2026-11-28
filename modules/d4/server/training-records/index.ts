import { compareCompetencies } from "../../competency/service";
import type { TrainingFollowUp, TrainingStatus } from "../../training/types";
import { assertNeedOpen, assertNoDuplicateTraining, assertNotSelf, assertTrainingChange, trainingSyncRevision, assertTrainingDate, assertTrainingFollowUp, lastAssessedAt, localToday, planTrainingCompletion, retrainingNotes, TRAINING_DECISIONS, TRAINING_FOLLOW_UPS, TRAINING_RESULTS } from "../../shared/rules";
import { latestDevelopment, latestTraining, type D4LiveSnapshot } from "../../supabase/types";
import { ApiError, employeeFilter, enforce, field, readJson, toApiError } from "../_lib/http";
import { d4Session, requireWriter } from "../_lib/session";

const statuses: readonly TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];

type Writer = Awaited<ReturnType<typeof requireWriter>>;
type Repository = Writer["repository"];
/** The signed-in writer and the data a write is checked against. */
type WriteContext = Pick<Writer, "repository" | "access"> & { snapshot: D4LiveSnapshot };

/**
 * Decision 13 Nov 2026: Training Tracking is the one writer of a requirement's progress. After each training write the
 * requirement takes the status its trainings give it (statusFromTrainings); a Completed requirement is left alone.
 * Reads requirements and trainings only, not the whole snapshot: this runs after every training write.
 */
async function syncDevelopment(repository: Repository, needId: string) {
  const state = await repository.loadTrainingState();
  const need = latestDevelopment(state).find((item) => item.needId === needId);
  const next = need && trainingSyncRevision(need, latestTraining(state), state.developmentVersions.filter((item) => item.needId === needId));
  if (need && next) await repository.updateDevelopment(needId, next, need);
}

/** Only a completed training has a result, and it is Passed or Not Passed. */
const completedResult = (body: Record<string, unknown>, status: TrainingStatus) => status === "Completed" ? field.oneOf(body, "result", TRAINING_RESULTS) : "";

/** GET /api/d4/training-records?employee_id= — latest version of each training record. */
export async function listTraining(request: Request) {
  const { repository } = await d4Session();
  const employeeId = employeeFilter(request);
  return latestTraining(await repository.loadSnapshot()).filter((item) => !employeeId || item.employeeId === employeeId);
}

/** GET /api/d4/training-records/:id — latest version plus status history. */
export async function getTraining(id: string) {
  const { repository } = await d4Session();
  const snapshot = await repository.loadSnapshot();
  const versions = snapshot.trainingVersions.filter((item) => item.trainingId === id).sort((a, b) => b.revision - a.revision);
  if (!versions.length) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  return { latest: versions[0], versions };
}

const parseCreate = (body: Record<string, unknown>) => {
  const status = field.oneOf(body, "status", statuses);
  return {
    employeeId: field.uuid(body, "employeeId"), developmentNeedId: field.uuid(body, "developmentNeedId"),
    activity: field.text(body, "activity", { max: 200 }), date: field.date(body, "date"), status,
    result: completedResult(body, status), notes: field.text(body, "notes", { required: false, max: 2000 }),
  };
};

async function createOne({ repository, access, snapshot }: WriteContext, input: ReturnType<typeof parseCreate>) {
  enforce(() => assertNotSelf(access.employeeId, input.employeeId));
  enforce(() => assertNeedOpen(latestDevelopment(snapshot).find((item) => item.needId === input.developmentNeedId)));
  enforce(() => assertTrainingDate(input.status, input.date));
  enforce(() => assertNoDuplicateTraining(latestTraining(snapshot), input.developmentNeedId, input.activity, input.date));
  const id = await repository.createTraining(input, snapshot);
  await syncDevelopment(repository, input.developmentNeedId);
  return { id };
}

/** POST /api/d4/training-records — training must point to a development need of the same employee. */
export async function createTraining(request: Request) {
  const writer = await requireWriter();
  const input = parseCreate(await readJson(request));
  return createOne({ ...writer, snapshot: await writer.repository.loadSnapshot() }, input);
}

const parseVersion = (body: Record<string, unknown>) => {
  const status = field.oneOf(body, "status", statuses);
  return { status, result: completedResult(body, status), notes: field.text(body, "notes", { required: false, max: 2000 }) };
};

async function versionOne({ repository, access, snapshot }: WriteContext, id: string, { status, result, notes }: ReturnType<typeof parseVersion>) {
  const current = latestTraining(snapshot).find((item) => item.trainingId === id);
  if (!current) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  enforce(() => assertNotSelf(access.employeeId, current.employeeId));
  enforce(() => assertTrainingChange(current.status, status, notes));
  await repository.updateTraining(id, status, result, notes);
  await syncDevelopment(repository, current.developmentNeedId);
  return { trainingId: id, status };
}

/** POST /api/d4/training-records/:id/versions — progress update as a new version. Completion never closes a gap. */
export async function addTrainingVersion(request: Request, id: string) {
  const writer = await requireWriter();
  const input = parseVersion(await readJson(request));
  return versionOne({ ...writer, snapshot: await writer.repository.loadSnapshot() }, id, input);
}

/**
 * POST /api/d4/training-records/:id/follow-up — Q16: HR's follow-up of a Not Passed training, saved as a new version
 * of it (status and result come from the record, not the body). Retraining also creates the next training for the
 * same requirement and returns its id.
 */
export async function recordTrainingFollowUp(request: Request, id: string) {
  const { repository, access } = await requireWriter();
  const body = await readJson(request);
  const followUp = field.oneOf(body, "followUp", TRAINING_FOLLOW_UPS);
  const input = { followUp, notes: field.text(body, "notes", { required: false, max: 2000 }),
    ...(followUp === "Retraining" ? { activity: field.text(body, "activity", { max: 200 }), date: field.date(body, "date") } : {}) };
  const snapshot = await repository.loadSnapshot();
  const history = snapshot.trainingVersions.filter((item) => item.trainingId === id);
  if (!history.length) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  enforce(() => assertNotSelf(access.employeeId, history[0].employeeId));
  enforce(() => assertTrainingFollowUp(history, input, latestDevelopment(snapshot).find((item) => item.needId === history[0].developmentNeedId)));
  const retrainingId = await repository.recordTrainingFollowUp(id, input, snapshot);
  await syncDevelopment(repository, history[0].developmentNeedId);
  return { trainingId: id, followUp, retrainingId };
}

/**
 * POST /api/d4/training-records/:id/complete — the one save of Training Tracking that finishes a training: the result
 * and HR's decision (Passed: Meets requirement, or Retraining once the Passed result is saved and reassessed; Not
 * Passed: Retraining or Other follow-up). Every rule
 * is checked before the first write. Writes follow this order so the histories read correctly: the training version,
 * a competency snapshot (Passed), the requirement revision (Passed decision, or In Progress after Not Passed), then the
 * Retraining training (Not Passed: before the requirement revision, inside recordTrainingFollowUp). Not one transaction:
 * a failure part-way keeps the earlier records and the training page shows the step that is still open.
 */
export async function completeTraining(request: Request, id: string) {
  const writer = await requireWriter();
  const input = parseComplete(await readJson(request));
  return completeOne({ ...writer, snapshot: await writer.repository.loadSnapshot() }, id, input);
}

const parseComplete = (body: Record<string, unknown>) => {
  const decision = field.oneOf(body, "decision", TRAINING_DECISIONS);
  return { result: field.oneOf(body, "result", TRAINING_RESULTS), decision, notes: field.text(body, "notes", { required: false, max: 2000 }),
    ...(decision === "Retraining" ? { activity: field.text(body, "activity", { max: 200 }), date: field.date(body, "date") } : {}) };
};

async function completeOne({ repository, access, snapshot }: WriteContext, id: string, input: ReturnType<typeof parseComplete>) {
  const { decision } = input;
  const record = latestTraining(snapshot).find((item) => item.trainingId === id);
  if (!record) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  enforce(() => assertNotSelf(access.employeeId, record.employeeId));
  // A Retraining is a new Planned training, under the same date rule as one added from a requirement.
  if (decision === "Retraining") enforce(() => assertTrainingDate("Planned", input.date ?? ""));
  const needs = latestDevelopment(snapshot);
  const need = needs.find((item) => item.needId === record.developmentNeedId);
  const employee = snapshot.reference.employees.find((item) => item.id === record.employeeId);
  const comparison = employee?.positionId && snapshot.reference.positions.some((item) => item.id === employee.positionId)
    ? compareCompetencies(employee.id, employee.positionId, snapshot.reference) : null;
  const plan = planTrainingCompletion(input, {
    trainingId: id, history: snapshot.trainingVersions.filter((item) => item.trainingId === id), need,
    needHistory: snapshot.developmentVersions.filter((item) => item.needId === record.developmentNeedId), latestNeeds: needs, latestTrainings: latestTraining(snapshot),
    finding: comparison?.findings.find((item) => item.requirementId === need?.sourceRef), at: new Date().toISOString(),
    assessedAt: employee ? lastAssessedAt(snapshot.competency, employee.id, employee.positionId) : undefined,
  });
  if (plan.training === "follow-up") {
    const retrainingId = await repository.recordTrainingFollowUp(id, { followUp: decision as TrainingFollowUp, notes: input.notes, activity: input.activity, date: input.date }, snapshot);
    await syncDevelopment(repository, record.developmentNeedId);
    return { trainingId: id, result: input.result, decision, retrainingId };
  }
  if (plan.training === "version") await repository.updateTraining(id, "Completed", "Passed", input.notes);
  if (plan.snapshot && employee?.positionId && comparison?.findings.length) {
    await repository.saveCompetency({ employeeId: employee.id, positionId: employee.positionId, effectiveDate: localToday() }, snapshot.reference);
  }
  if (plan.development && need) await repository.updateDevelopment(need.needId, plan.development, need);
  const retrainingId = plan.retraining ? await repository.createTraining({ employeeId: record.employeeId, developmentNeedId: record.developmentNeedId,
    activity: input.activity ?? "", date: input.date ?? "", status: "Planned", result: "", notes: retrainingNotes(record, input.notes, "Passed") }, snapshot) : null;
  // A decision written above already set the status; this covers a Passed training whose decision is left for later.
  await syncDevelopment(repository, record.developmentNeedId);
  return { trainingId: id, result: input.result, decision, retrainingId };
}

const BULK_MAX = 200;
const BULK_OPS = ["create", "version", "complete"] as const;
export type BulkRowResult = { ok: true } | { ok: false; message: string };

/**
 * POST /api/d4/training-records/bulk — many training writes in one request (Add Training for many requirements, bulk
 * Update Progress). Each row runs the same rules and writes as its single endpoint, in order, and a refused row does
 * not stop the others. Sign-in and the snapshot are loaded once instead of per row (PST 2: a bulk save of 17 rows took
 * about 34 full snapshot loads). A completion of an employee an earlier row already wrote is checked against a fresh
 * snapshot, so it is judged exactly as if it were saved on its own.
 */
export async function bulkTraining(request: Request) {
  const writer = await requireWriter();
  const { items } = await readJson(request);
  if (!Array.isArray(items) || !items.length || items.length > BULK_MAX) throw new ApiError("VALIDATION_FAILED", `Field items wajib berisi 1 sampai ${BULK_MAX} baris.`);
  let snapshot = await writer.repository.loadSnapshot();
  const written = new Set<string>();
  const results: BulkRowResult[] = [];
  for (const item of items) {
    let employeeId: string | undefined;
    try {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new ApiError("BAD_REQUEST", "Setiap baris harus berupa objek JSON.");
      const row = item as Record<string, unknown>;
      const op = field.oneOf(row, "op", BULK_OPS);
      const trainingId = op === "create" ? "" : field.text(row, "trainingId", { max: 100 });
      employeeId = op === "create" ? field.uuid(row, "employeeId") : latestTraining(snapshot).find((entry) => entry.trainingId === trainingId)?.employeeId;
      // Only completion reads what an earlier row of the same employee can change (the requirement, the latest trainings,
      // the last competency assessment); create and version rows check their own requirement or training.
      if (op === "complete" && employeeId && written.has(employeeId)) snapshot = await writer.repository.loadSnapshot();
      const context = { ...writer, snapshot };
      if (op === "create") await createOne(context, parseCreate(row));
      else if (op === "version") await versionOne(context, trainingId, parseVersion(row));
      else await completeOne(context, trainingId, parseComplete(row));
      results.push({ ok: true });
    } catch (cause) {
      results.push({ ok: false, message: toApiError(cause).message });
    }
    // Also after a refusal: a row can fail after its first write (the writes are not one transaction).
    if (employeeId) written.add(employeeId);
  }
  return { results };
}

import type { TrainingStatus } from "../../training/types";
import { assertNeedOpen, assertNotSelf, assertTrainingChange, assertTrainingDate, assertTrainingFollowUp, TRAINING_FOLLOW_UPS, TRAINING_RESULTS } from "../../shared/rules";
import { latestDevelopment, latestTraining } from "../../supabase/types";
import { ApiError, employeeFilter, enforce, field, readJson } from "../_lib/http";
import { d4Session, requireWriter } from "../_lib/session";

const statuses: readonly TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];

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

/** POST /api/d4/training-records — training must point to a development need of the same employee. */
export async function createTraining(request: Request) {
  const { repository, access } = await requireWriter();
  const body = await readJson(request);
  const status = field.oneOf(body, "status", statuses);
  const input = {
    employeeId: field.uuid(body, "employeeId"), developmentNeedId: field.uuid(body, "developmentNeedId"),
    activity: field.text(body, "activity", { max: 200 }), date: field.date(body, "date"), status,
    result: completedResult(body, status), notes: field.text(body, "notes", { required: false, max: 2000 }),
  };
  enforce(() => assertNotSelf(access.employeeId, input.employeeId, "Training"));
  enforce(() => assertTrainingDate(input.status, input.date));
  const snapshot = await repository.loadSnapshot();
  enforce(() => assertNeedOpen(latestDevelopment(snapshot).find((item) => item.needId === input.developmentNeedId)));
  return { id: await repository.createTraining(input, snapshot) };
}

/** POST /api/d4/training-records/:id/versions — progress update as a new version. Completion never closes a gap. */
export async function addTrainingVersion(request: Request, id: string) {
  const { repository } = await requireWriter();
  const body = await readJson(request);
  const status = field.oneOf(body, "status", statuses);
  const result = completedResult(body, status);
  const notes = field.text(body, "notes", { required: false, max: 2000 });
  const current = latestTraining(await repository.loadSnapshot()).find((item) => item.trainingId === id);
  if (!current) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  enforce(() => assertTrainingDate(status, current.date));
  enforce(() => assertTrainingChange(current.status, status, notes));
  await repository.updateTraining(id, status, result, notes);
  return { trainingId: id, status };
}

/**
 * POST /api/d4/training-records/:id/follow-up — Q16: HR's follow-up of a Not Passed training, saved as a new version
 * of it (status and result come from the record, not the body). Retraining also creates the next training for the
 * same requirement and returns its id.
 */
export async function recordTrainingFollowUp(request: Request, id: string) {
  const { repository } = await requireWriter();
  const body = await readJson(request);
  const followUp = field.oneOf(body, "followUp", TRAINING_FOLLOW_UPS);
  const input = { followUp, notes: field.text(body, "notes", { required: false, max: 2000 }),
    ...(followUp === "Retraining" ? { activity: field.text(body, "activity", { max: 200 }), date: field.date(body, "date") } : {}) };
  const snapshot = await repository.loadSnapshot();
  const history = snapshot.trainingVersions.filter((item) => item.trainingId === id);
  if (!history.length) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  enforce(() => assertTrainingFollowUp(history, input, latestDevelopment(snapshot).find((item) => item.needId === history[0].developmentNeedId)));
  return { trainingId: id, followUp, retrainingId: await repository.recordTrainingFollowUp(id, input, snapshot) };
}

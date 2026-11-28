import type { TrainingCompletion, TrainingDecision } from "../../shared/rules";
import { plainText, type Translate } from "../../shared/text";
import type { TrainingStatus } from "../../training/types";
import type { BulkTrainingItem, D4DataSource } from "./source";

/**
 * Bulk actions (interview 13 Nov 2026, 1:10:34–1:12:33): HR selects many rows and acts once, e.g. the 32 field agents
 * who took one training together. Each row goes through the rules of the single-row write, so every message stays the
 * same; rows run one after another and a refused row does not stop the others.
 */
export type BulkFailure = { key: string; label: string; message: string };
export type BulkOutcome = { done: string[]; failed: BulkFailure[] };

export async function eachInOrder<T>(items: readonly T[], key: (item: T) => string, label: (item: T) => string, write: (item: T) => Promise<unknown>): Promise<BulkOutcome> {
  const outcome: BulkOutcome = { done: [], failed: [] };
  for (const item of items) {
    try {
      await write(item);
      outcome.done.push(key(item));
    } catch (cause) {
      outcome.failed.push({ key: key(item), label: label(item), message: cause instanceof Error ? cause.message : "Gagal menyimpan." });
    }
  }
  return outcome;
}

/** Rows per bulk request: each stays well under the bulk request timeout, so a slow batch is not cut off half-written. */
export const BULK_CHUNK = 10;

const runOne = (source: D4DataSource, item: BulkTrainingItem) => item.op === "create" ? source.createTraining(item)
  : item.op === "version" ? source.updateTraining(item.trainingId, item.status, item.result, item.notes)
    : source.completeTraining(item.trainingId, item);

/**
 * Training rows saved through the bulk endpoint, BULK_CHUNK rows per request, instead of one request per row
 * (PST 2: a bulk save of 17 rows took long because every row loaded all D4 data twice on the server).
 */
async function saveTrainings<T>(source: D4DataSource, rows: readonly T[], key: (row: T) => string, label: (row: T) => string, item: (row: T) => BulkTrainingItem): Promise<BulkOutcome> {
  const bulk = source.bulkTraining?.bind(source);
  if (!bulk) return eachInOrder(rows, key, label, (row) => runOne(source, item(row)));
  const outcome: BulkOutcome = { done: [], failed: [] };
  for (let start = 0; start < rows.length; start += BULK_CHUNK) {
    const chunk = rows.slice(start, start + BULK_CHUNK);
    let results;
    try {
      results = await bulk(chunk.map(item));
    } catch (cause) {
      // A request that failed as a whole: this chunk and the ones after it were not saved; earlier chunks were.
      if (start === 0) throw cause;
      const message = cause instanceof Error ? cause.message : "Gagal menyimpan.";
      rows.slice(start).forEach((row) => outcome.failed.push({ key: key(row), label: label(row), message }));
      return outcome;
    }
    chunk.forEach((row, index) => {
      const result = results[index];
      if (result?.ok) outcome.done.push(key(row));
      else outcome.failed.push({ key: key(row), label: label(row), message: result?.message ?? "Gagal menyimpan." });
    });
  }
  return outcome;
}

/** A bulk save where every row was refused is a failed save, so the caller shows an error instead of a success toast. */
export function requireSome(outcome: BulkOutcome): BulkOutcome {
  if (!outcome.done.length && outcome.failed.length) throw new Error(`Tidak ada yang tersimpan. ${outcome.failed[0].label}: ${outcome.failed[0].message}`);
  return outcome;
}

export const bulkSummary = (outcome: BulkOutcome, what: string, t: Translate = plainText) => outcome.failed.length
  ? t("{done} {what} tersimpan, {failed} gagal.", { done: outcome.done.length, what, failed: outcome.failed.length })
  : t("{done} {what} tersimpan.", { done: outcome.done.length, what });

export type BulkTarget = { key: string; label: string; detail?: string };
export type BulkNeed = BulkTarget & { employeeId: string };
export type BulkTraining = BulkTarget & { status: TrainingStatus };

/** One new training, the same activity and date, for every selected development requirement. */
export const addTrainingToNeeds = (source: D4DataSource, needs: readonly BulkNeed[], training: { activity: string; date: string; status: TrainingStatus; notes: string }) =>
  saveTrainings(source, needs, (need) => need.key, (need) => need.label, (need): BulkTrainingItem =>
    ({ op: "create", employeeId: need.employeeId, developmentNeedId: need.key, activity: training.activity, date: training.date, status: training.status, result: "", notes: training.notes }));

export const DECIDE_LATER = "Decide later";

/** Progress for many trainings at once: In Progress, or Completed with one result and one decision for all of them. */
export type BulkProgress =
  | { status: "In Progress"; notes: string }
  | { status: "Completed"; result: TrainingCompletion["result"]; decision: TrainingDecision | typeof DECIDE_LATER; notes: string; activity?: string; date?: string };

/** Trainings a bulk progress change applies to: moving to In Progress leaves the ones already running untouched. */
export const progressTargets = <T extends BulkTraining>(trainings: readonly T[], change: Pick<BulkProgress, "status">) =>
  change.status === "In Progress" ? trainings.filter((item) => item.status === "Planned") : trainings;

export const updateTrainings = (source: D4DataSource, trainings: readonly BulkTraining[], change: BulkProgress) =>
  saveTrainings(source, progressTargets(trainings, change), (item) => item.key, (item) => item.label, (item): BulkTrainingItem => {
    if (change.status === "In Progress") return { op: "version", trainingId: item.key, status: "In Progress", result: "", notes: change.notes };
    // Passed + Decide later saves the result only; the reassessment is recorded later from Next step (as in Update Progress).
    if (change.decision === DECIDE_LATER) return { op: "version", trainingId: item.key, status: "Completed", result: change.result, notes: change.notes };
    return { op: "complete", trainingId: item.key, result: change.result, decision: change.decision, notes: change.notes,
      ...(change.decision === "Retraining" ? { activity: change.activity, date: change.date } : {}) };
  });

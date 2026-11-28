import { compareCompetencies } from "../../competency/service";
import { assertTrainingChange, assertTrainingResult, lastAssessedAt, planTrainingCompletion, type TrainingCompletion } from "../../shared/rules";
import { latestDevelopment, latestTraining, type D4LiveSnapshot } from "../../supabase/types";
import { DECIDE_LATER, type BulkProgress } from "./bulk";

/** What planTrainingCompletion needs about one training, read from a snapshot (the fixture save and the bulk check share it). */
export function completionContext(snapshot: D4LiveSnapshot, trainingId: string, at: string) {
  const current = latestTraining(snapshot).find((item) => item.trainingId === trainingId);
  const needs = latestDevelopment(snapshot);
  const need = current && needs.find((item) => item.needId === current.developmentNeedId);
  const employee = current && snapshot.reference.employees.find((item) => item.id === current.employeeId);
  const comparison = employee?.positionId ? compareCompetencies(employee.id, employee.positionId, snapshot.reference) : null;
  return {
    current, need, employee, comparison,
    context: {
      trainingId, history: snapshot.trainingVersions.filter((item) => item.trainingId === trainingId), need,
      needHistory: current ? snapshot.developmentVersions.filter((item) => item.needId === current.developmentNeedId) : [], latestNeeds: needs, latestTrainings: latestTraining(snapshot),
      finding: comparison?.findings.find((item) => item.requirementId === need?.sourceRef), at,
      assessedAt: employee ? lastAssessedAt(snapshot.competency, employee.id, employee.positionId) : undefined,
    },
  };
}

/**
 * Why one training would be refused by a bulk progress change, before anything is saved ("" when it would be saved).
 * Runs the same rules as the save. Fields the form itself requires (notes, retraining name and date) are filled with
 * stand-ins, so only reasons that belong to this training are reported (lecturer review, 24 Nov 2026).
 */
export function progressIssue(snapshot: D4LiveSnapshot, trainingId: string, change: BulkProgress): string {
  try {
    const { current, context } = completionContext(snapshot, trainingId, new Date().toISOString());
    if (!current) return "Training tidak ditemukan.";
    // Already running: left untouched by the save (progressTargets), not refused.
    if (change.status === "In Progress") { if (current.status !== "In Progress") assertTrainingChange(current.status, "In Progress", change.notes || "-"); return ""; }
    if (change.decision === DECIDE_LATER) { assertTrainingResult("Completed", change.result); assertTrainingChange(current.status, "Completed", change.notes || "-"); return ""; }
    const input: TrainingCompletion = { result: change.result, decision: change.decision, notes: change.notes || "-",
      ...(change.decision === "Retraining" ? { activity: change.activity || "-", date: change.date || new Date().toISOString().slice(0, 10) } : {}) };
    planTrainingCompletion(input, context);
    return "";
  } catch (cause) {
    return cause instanceof Error ? cause.message : "Tidak bisa diproses.";
  }
}

import type { EvaluationInput } from "../../performance/types";
import { assertNotFutureDate, assertNotSelf, assertPeriodRevision, assertRevisionReason } from "../../shared/rules";
import { ApiError, employeeFilter, enforce, field, optionalUuid, readJson } from "../_lib/http";
import { d4Session, requireWriter } from "../_lib/session";

/** GET /api/d4/performance-evaluations?employee_id= — evaluation history, newest first. */
export async function listEvaluations(request: Request) {
  const { repository } = await d4Session();
  const employeeId = employeeFilter(request);
  return (await repository.loadSnapshot()).performance.filter((item) => !employeeId || item.employeeId === employeeId);
}

/** GET /api/d4/performance-evaluations/:id */
export async function getEvaluation(id: string) {
  const { repository } = await d4Session();
  const evaluation = (await repository.loadSnapshot()).performance.find((item) => item.id === id);
  if (!evaluation) throw new ApiError("NOT_FOUND", "Evaluasi tidak ditemukan.");
  return evaluation;
}

/**
 * POST /api/d4/performance-evaluations — saves a new evaluation; earlier periods are never overwritten.
 * The evaluator is the signed-in user, never self; a second record for the same period must name the
 * current one in `revisionOf`.
 */
export async function createEvaluation(request: Request) {
  const { repository, access } = await requireWriter();
  const body = await readJson(request);
  const snapshot = await repository.loadSnapshot();
  const evaluator = snapshot.reference.employees.find((item) => item.id === access.employeeId)?.fullName;
  if (!evaluator) throw new ApiError("FORBIDDEN", "Akun belum terhubung dengan data employee.");
  const status = field.oneOf(body, "status", ["completed"] as const); // FR-D4-001 defines no draft evaluation.
  const completed = status === "completed";
  const input: EvaluationInput = {
    employeeId: field.uuid(body, "employeeId"),
    period: field.period(body, "period"),
    evaluationDate: field.date(body, "evaluationDate", { required: completed }),
    evaluator,
    status,
    // Legacy columns of d4_performance_evaluations: FR-D4-001 defines no review label or aspects, so the API stores neutral values.
    reviewStatus: "Needs Review",
    overallScore: field.score(body.overallScore, "Hasil evaluasi", { required: completed }),
    aspects: [],
    generalNotes: field.text(body, "generalNotes", { required: completed, max: 4000 }),
    evidenceReference: field.text(body, "evidenceReference", { required: false, max: 500 }) || null,
  };
  enforce(() => assertNotSelf(access.employeeId, input.employeeId));
  const revisionOf = optionalUuid(body, "revisionOf");
  enforce(() => assertNotFutureDate(input.evaluationDate));
  enforce(() => assertPeriodRevision(snapshot.performance, input.employeeId, input.period, revisionOf, "Evaluasi"));
  enforce(() => assertRevisionReason(revisionOf, input.generalNotes));
  return { id: await repository.savePerformance(input, snapshot.reference) };
}

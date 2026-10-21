import type { DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../../development/types";
import { latestDevelopment, latestTraining } from "../../supabase/types";
import { assertGapAssessed, assertNoOpenNeed, assertNotSelf, nextDevelopmentRevision, REASSESSMENTS } from "../../shared/rules";
import { ApiError, employeeFilter, enforce, field, readJson } from "../_lib/http";
import { d4Session, requireWriter } from "../_lib/session";

const sourceTypes: readonly DevelopmentSourceType[] = ["competency_gap", "role_change", "performance_context"];
const priorities: readonly DevelopmentPriority[] = ["Low", "Medium", "High"];
const statuses: readonly DevelopmentStatus[] = ["Identified", "Planned", "In Progress", "Completed"];

/** GET /api/d4/development-needs?employee_id= — latest revision of each development need. */
export async function listDevelopment(request: Request) {
  const { repository } = await d4Session();
  const employeeId = employeeFilter(request);
  return latestDevelopment(await repository.loadSnapshot()).filter((item) => !employeeId || item.employeeId === employeeId);
}

/** GET /api/d4/development-needs/:id — latest revision plus the full revision history. */
export async function getDevelopment(id: string) {
  const { repository } = await d4Session();
  const snapshot = await repository.loadSnapshot();
  const versions = snapshot.developmentVersions.filter((item) => item.needId === id).sort((a, b) => b.revision - a.revision);
  if (!versions.length) throw new ApiError("NOT_FOUND", "Development requirement tidak ditemukan.");
  return { latest: versions[0], versions };
}

/** POST /api/d4/development-needs — a need must reference a valid source (gap, role change, or evaluation). */
export async function createDevelopment(request: Request) {
  const { repository, access } = await requireWriter();
  const body = await readJson(request);
  const input = {
    employeeId: field.uuid(body, "employeeId"), sourceType: field.oneOf(body, "sourceType", sourceTypes),
    sourceRef: field.uuid(body, "sourceRef"), objective: field.text(body, "objective", { max: 500 }),
    priority: field.oneOf(body, "priority", priorities), notes: field.text(body, "notes", { required: false, max: 2000 }),
    method: field.text(body, "method", { required: false, max: 120 }), pic: field.text(body, "pic", { required: false, max: 120 }),
  };
  enforce(() => assertNotSelf(access.employeeId, input.employeeId, "Development requirement"));
  const snapshot = await repository.loadSnapshot();
  enforce(() => assertNoOpenNeed(latestDevelopment(snapshot), input.employeeId, input.sourceType, input.sourceRef));
  enforce(() => assertGapAssessed(snapshot.competency, snapshot.reference.employees.find((item) => item.id === input.employeeId), input.sourceType));
  return { id: await repository.createDevelopment(input, snapshot) };
}

/** Optional body field: left out (or null) means "keep the current value". */
const optional = <T>(body: Record<string, unknown>, key: string, read: () => T): T | undefined => body[key] === undefined || body[key] === null ? undefined : read();

/**
 * POST /api/d4/development-needs/:id/versions — status change, priority/method/PIC edit or reassessment result as a
 * new revision; history is never overwritten.
 */
export async function addDevelopmentVersion(request: Request, id: string) {
  const { repository } = await requireWriter();
  const body = await readJson(request);
  const change = {
    status: field.oneOf(body, "status", statuses), notes: field.text(body, "notes", { required: false, max: 2000 }),
    priority: optional(body, "priority", () => field.oneOf(body, "priority", priorities)),
    method: optional(body, "method", () => field.text(body, "method", { required: false, max: 120 })),
    pic: optional(body, "pic", () => field.text(body, "pic", { required: false, max: 120 })),
    reassessment: optional(body, "reassessment", () => field.oneOf(body, "reassessment", REASSESSMENTS)),
  };
  // Checked here so an unknown or malformed id is a 404, not a database error.
  const snapshot = await repository.loadSnapshot();
  const needs = latestDevelopment(snapshot);
  const current = needs.find((item) => item.needId === id);
  if (!current) throw new ApiError("NOT_FOUND", "Development requirement tidak ditemukan.");
  const next = nextDevelopmentRevision(current, change, needs, latestTraining(snapshot), snapshot.developmentVersions.filter((item) => item.needId === id));
  await repository.updateDevelopment(id, next, current);
  return { developmentNeedId: id, status: next.status };
}

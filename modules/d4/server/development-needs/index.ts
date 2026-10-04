import type { DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../../development/types";
import { latestDevelopment } from "../../supabase/types";
import { assertDevelopmentChange, assertNoOpenNeed, assertNotSelf } from "../../shared/rules";
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
  if (!versions.length) throw new ApiError("NOT_FOUND", "Development need tidak ditemukan.");
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
  };
  enforce(() => assertNotSelf(access.employeeId, input.employeeId, "Development requirement"));
  const snapshot = await repository.loadSnapshot();
  enforce(() => assertNoOpenNeed(latestDevelopment(snapshot), input.employeeId, input.sourceType, input.sourceRef));
  return { id: await repository.createDevelopment(input, snapshot) };
}

/** POST /api/d4/development-needs/:id/versions — status change as a new revision; history is never overwritten. */
export async function addDevelopmentVersion(request: Request, id: string) {
  const { repository } = await requireWriter();
  const body = await readJson(request);
  const status = field.oneOf(body, "status", statuses);
  const notes = field.text(body, "notes", { required: false, max: 2000 });
  // Checked here so an unknown or malformed id is a 404, not a database error.
  const current = latestDevelopment(await repository.loadSnapshot()).find((item) => item.needId === id);
  if (!current) throw new ApiError("NOT_FOUND", "Development need tidak ditemukan.");
  enforce(() => assertDevelopmentChange(current.status, status, notes));
  await repository.updateDevelopment(id, status, notes);
  return { developmentNeedId: id, status };
}

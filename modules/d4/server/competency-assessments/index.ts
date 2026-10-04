import { employeeFilter, field, readJson } from "../_lib/http";
import { d4Session, requireWriter } from "../_lib/session";

/** GET /api/d4/competency-assessments?employee_id= — saved gap snapshots (history). */
export async function listCompetency(request: Request) {
  const { repository } = await d4Session();
  const employeeId = employeeFilter(request);
  return (await repository.loadSnapshot()).competency.filter((item) => !employeeId || item.employeeId === employeeId);
}

/** POST /api/d4/competency-assessments — the gap is recalculated on the server, never taken from the client. */
export async function createCompetency(request: Request) {
  const { repository } = await requireWriter();
  const body = await readJson(request);
  const input = { employeeId: field.uuid(body, "employeeId"), positionId: field.uuid(body, "positionId"), effectiveDate: field.date(body, "effectiveDate") };
  return { id: await repository.saveCompetency(input, await repository.loadReferenceData()) };
}

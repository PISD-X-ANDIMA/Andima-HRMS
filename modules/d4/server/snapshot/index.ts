import type { D4LiveSnapshot } from "../../supabase/types";
import { d4Access, d4Session } from "../_lib/session";

// RLS already limits an employee to their own rows; this repeats it in code (the fixture's ownRecords rule, plus the
// legacy employee_kpi rows), so a gap in a policy cannot hand one employee another's records.
function ownRecords(snapshot: D4LiveSnapshot): D4LiveSnapshot {
  const own = <T extends { employeeId: string }>(items: readonly T[]) => items.filter((item) => item.employeeId === snapshot.actorEmployeeId);
  return {
    ...snapshot, kpi: own(snapshot.kpi), performance: own(snapshot.performance), kpiAssessments: snapshot.kpiAssessments && own(snapshot.kpiAssessments), kpiDaily: snapshot.kpiDaily && own(snapshot.kpiDaily),
    competency: own(snapshot.competency), developmentVersions: own(snapshot.developmentVersions), trainingVersions: own(snapshot.trainingVersions),
  };
}

/** GET /api/d4/snapshot — every D4 record this account may read (RLS-filtered), used by the web UI. */
export async function getSnapshot() {
  const snapshot = await (await d4Session()).repository.loadSnapshot();
  return snapshot.role === "EMPLOYEE" ? ownRecords(snapshot) : snapshot;
}

/** GET /api/d4/me — role and employee of the signed-in account. */
export async function getMe() {
  const session = await d4Session();
  const access = await d4Access(session);
  const { data } = await session.client.from("d4_employee").select("id,employee_id,full_name").eq("id", access.employeeId).maybeSingle();
  return { role: access.role, employee: data ?? null };
}

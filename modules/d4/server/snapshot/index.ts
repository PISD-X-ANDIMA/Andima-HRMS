import { d4Access, d4Session } from "../_lib/session";

/** GET /api/d4/snapshot — every D4 record this account may read (RLS-filtered), used by the web UI. */
export async function getSnapshot() {
  return (await d4Session()).repository.loadSnapshot();
}

/** GET /api/d4/me — role and employee of the signed-in account. */
export async function getMe() {
  const session = await d4Session();
  const access = await d4Access(session);
  const { data } = await session.client.from("d3_employee").select("id,employee_id,full_name").eq("id", access.employeeId).maybeSingle();
  return { role: access.role, employee: data ?? null };
}

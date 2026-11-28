import { assertReopening } from "../../shared/rules";
import { ApiError, enforce, field, readJson } from "../_lib/http";
import { requireWriter } from "../_lib/session";

/**
 * POST /api/d4/period-reopenings — HR reopens an older period until a date, or closes it again with a date that has
 * passed. Insert-only like the table: the newest row of a period decides. The database checks the same rules and
 * records the HR account (policy d4_period_reopenings_insert, migration 20261124150000).
 */
export async function createPeriodReopening(request: Request) {
  const session = await requireWriter();
  if (session.access.role !== "HR") throw new ApiError("FORBIDDEN", "Hanya HR yang dapat membuka atau menutup kembali periode.");
  const body = await readJson(request);
  const input = { period: field.period(body, "period"), openUntil: field.date(body, "openUntil"), reason: field.text(body, "reason", { max: 500 }) };
  enforce(() => assertReopening(input));
  return { id: await session.repository.savePeriodReopening(input) };
}

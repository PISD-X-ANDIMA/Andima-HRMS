import { catalogFor, indicatorsFor, roleForPosition, scorableSet, targetOf } from "../../kpi/catalog";
import { scaleMaxOf } from "../../kpi/scale";
import { assertDailyDate, canFillDaily } from "../../shared/rules";
import type { KpiAssessmentLine } from "../../supabase/types";
import { ApiError, employeeFilter, enforce, field, readJson } from "../_lib/http";
import { d4Access, d4Session } from "../_lib/session";
import { loadCatalogSet } from "../kpi-catalog";

/** GET /api/d4/kpi-daily?employee_id= — daily KPI entries this account may read (RLS), newest first. */
export async function listDailyEntries(request: Request) {
  const { repository } = await d4Session();
  const employeeId = employeeFilter(request);
  return ((await repository.loadSnapshot()).kpiDaily ?? []).filter((item) => !employeeId || item.employeeId === employeeId);
}

/**
 * POST /api/d4/kpi-daily — the signed-in employee scores their own day. Unlike every other D4 write this is not
 * HR-only, so nothing about the subject comes from the body: the employee, KPI role and indicators follow the
 * session and the catalog in force for the day. The database checks the same (policy "D4 KPI daily insert own entry").
 */
export async function createDailyEntry(request: Request) {
  const session = await d4Session();
  const access = await d4Access(session);
  if (access.role === "MANAGEMENT") throw new ApiError("FORBIDDEN", "Direktur tidak mengisi Daily KPI; peran Management hanya membaca.");
  if (!canFillDaily(access.role, access.employeeId)) throw new ApiError("FORBIDDEN", "Akun ini belum terhubung ke data pegawai.");
  const body = await readJson(request);
  const entryDate = field.date(body, "entryDate");
  enforce(() => assertDailyDate(entryDate));
  const period = entryDate.slice(0, 7);
  const catalog = catalogFor(await loadCatalogSet(session.client), period);
  if (!catalog) throw new ApiError("VALIDATION_FAILED", `Belum ada katalog KPI yang berlaku untuk periode ${period}.`);
  const employee = (await session.repository.loadReferenceData()).employees.find((item) => item.id === access.employeeId);
  const roleOrder = roleForPosition(catalog, employee?.positionId);
  const indicators = indicatorsFor(catalog, roleOrder);
  if (!roleOrder || !scorableSet(indicators)) throw new ApiError("VALIDATION_FAILED", `Posisi Anda belum memiliki KPI di katalog ${catalog.version}. Hubungi HR.`);
  if (!Array.isArray(body.lines) || body.lines.length !== indicators.length) throw new ApiError("VALIDATION_FAILED", `Daily KPI harus memiliki ${indicators.length} indikator sesuai katalog.`);
  const max = scaleMaxOf(catalog.version);
  const lines: KpiAssessmentLine[] = indicators.map((indicator, index) => {
    const raw = ((body.lines as unknown[])[index] ?? {}) as Record<string, unknown>;
    const score = field.score(raw.raw_score, `Skor ${indicator.kpi_name}`, { max }) as number;
    return { indicator_order: indicator.indicator_order, kpi_name: indicator.kpi_name, weight_percent: indicator.weight_percent,
      target: targetOf(indicator), actual: String(score), raw_score: score, comment: field.text(raw, "comment", { required: false, max: 500 }).trim() };
  });
  const id = await session.repository.saveKpiDailyEntry({
    definitionVersion: catalog.version, employeeId: access.employeeId, entryDate, period, roleOrder, roleName: indicators[0].role_name, lines,
  });
  return { id, definitionVersion: catalog.version };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KpiCatalogSet, KpiCatalogVersion, PositionKpiRole, RoleKpiRow } from "../../kpi/catalog";
import { databaseError } from "../../shared/errors";
import { d4Session } from "../_lib/session";

const missingRelation = (error: { code?: string } | null) => error?.code === "PGRST205" || error?.code === "42P01";

/**
 * All catalog versions, their rows and the position → KPI role mapping. The version per period is picked with catalogFor.
 * The views of 20261124130000 add D1's KPI to the D4 catalog; until that migration is applied the tables alone are read.
 */
export async function loadCatalogSet(client: SupabaseClient): Promise<KpiCatalogSet> {
  const rowColumns = "role_order,role_name,indicator_order,kpi_name,target,weight_percent,source_version";
  const [versions, viewRows, viewRoles] = await Promise.all([
    client.from("d4_kpi_catalog_versions").select("source_version,effective_from"),
    client.from("d4_kpi_catalog_rows").select(`${rowColumns},kpi_source,d1_job_code`).order("role_order").order("indicator_order"),
    client.from("d4_kpi_position_roles").select("source_version,position_id,role_order"),
  ]);
  const withoutViews = missingRelation(viewRows.error) || missingRelation(viewRoles.error);
  const [rows, positionRoles] = withoutViews ? await Promise.all([
    client.from("d4_kpi_role_catalog").select(rowColumns).order("role_order").order("indicator_order"),
    client.from("d4_position_kpi_roles").select("source_version,position_id,role_order"),
  ]) : [viewRows, viewRoles];
  const error = versions.error ?? rows.error ?? positionRoles.error;
  if (error) throw databaseError(error, "Katalog KPI");
  return { versions: (versions.data ?? []) as KpiCatalogVersion[], rows: (rows.data ?? []) as RoleKpiRow[], positionRoles: (positionRoles.data ?? []) as PositionKpiRole[] };
}

/** GET /api/d4/kpi-catalog */
export async function getCatalog() {
  const { client } = await d4Session();
  return loadCatalogSet(client);
}

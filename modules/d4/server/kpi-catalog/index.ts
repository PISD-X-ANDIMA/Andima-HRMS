import type { SupabaseClient } from "@supabase/supabase-js";
import type { KpiCatalogSet, KpiCatalogVersion, PositionKpiRole, RoleKpiRow } from "../../kpi/catalog";
import { databaseError } from "../../shared/errors";
import { d4Session } from "../_lib/session";

/** All catalog versions, their rows and HR's position → KPI role mapping. The version per period is picked with catalogFor. */
export async function loadCatalogSet(client: SupabaseClient): Promise<KpiCatalogSet> {
  const [versions, rows, positionRoles] = await Promise.all([
    client.from("d4_kpi_catalog_versions").select("source_version,effective_from"),
    client.from("d4_kpi_role_catalog").select("role_order,role_name,indicator_order,kpi_name,target,weight_percent,source_version").order("role_order").order("indicator_order"),
    client.from("d4_position_kpi_roles").select("source_version,position_id,role_order"),
  ]);
  const error = versions.error ?? rows.error ?? positionRoles.error;
  if (error) throw databaseError(error, "Katalog KPI");
  return { versions: (versions.data ?? []) as KpiCatalogVersion[], rows: (rows.data ?? []) as RoleKpiRow[], positionRoles: (positionRoles.data ?? []) as PositionKpiRole[] };
}

/** GET /api/d4/kpi-catalog */
export async function getCatalog() {
  const { client } = await d4Session();
  return loadCatalogSet(client);
}

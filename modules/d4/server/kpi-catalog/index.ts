import { selectCatalog, type RoleKpiRow } from "../../kpi/catalog";
import { databaseError } from "../../shared/errors";
import { d4Session } from "../_lib/session";

/** GET /api/d4/kpi-catalog?role_order= — five core KPI per role, V5.1 when available. */
export async function getCatalog(request: Request) {
  const { client } = await d4Session();
  const { data, error } = await client.from("d4_kpi_role_catalog")
    .select("role_order,role_name,indicator_order,kpi_name,target,weight_percent,source_version")
    .order("role_order").order("indicator_order");
  if (error) throw databaseError(error, "Katalog KPI");
  const catalog = selectCatalog((data ?? []) as RoleKpiRow[]);
  const roleOrder = Number(new URL(request.url).searchParams.get("role_order"));
  return roleOrder ? { ...catalog, rows: catalog.rows.filter((row) => row.role_order === roleOrder) } : catalog;
}

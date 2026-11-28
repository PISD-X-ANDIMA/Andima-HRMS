import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KPI_V51_CATALOG, seedCatalogSet } from "@/modules/d4/kpi/catalog";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4LiveSnapshot } from "@/modules/d4/supabase/types";

// Same layering as api.test.ts: real route handler and session guard, mocked Supabase client and repository.
const MERCURY = "d4000000-0000-4000-8000-000000000012"; // HR
const ALFA = "d4000000-0000-4000-8000-000000000009";
const KPI_ALFA = "e4000000-0000-4000-8000-000000000004";
let snapshot: D4LiveSnapshot;
const writes: unknown[] = [];

function query(table: string) {
  const result = () => {
    if (table === "d4_user_access") return { data: { app_role: "HR", employee_id: MERCURY }, error: null };
    if (table === "d4_kpi_role_catalog") return { data: KPI_V51_CATALOG, error: null };
    if (table === "d4_kpi_catalog_versions") return { data: [{ source_version: "V5.1", effective_from: "2000-01" }], error: null };
    if (table === "d4_position_kpi_roles") return { data: seedCatalogSet(snapshot.reference.positions).positionRoles.filter((item) => item.source_version === "V5.1"), error: null };
    if (table === "d4_kpi_catalog_rows" || table === "d4_kpi_position_roles") return { data: null, error: { code: "PGRST205", message: "missing" } };
    return { data: null, error: null };
  };
  const builder = {
    select: () => builder, order: () => builder, eq: () => builder,
    maybeSingle: async () => result(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  };
  return builder;
}
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }, from: query }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@/modules/d4/supabase/repository", () => ({
  SupabaseD4Repository: function SupabaseD4Repository() {
    return { loadSnapshot: async () => snapshot, loadReferenceData: async () => snapshot.reference, saveKpiAssessment: async (...args: unknown[]) => { writes.push(args); return "id"; } };
  },
}));

const kpi = await import("@/app/api/d4/kpi-assessments/route");
const post = (body: unknown) => new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });

let base: D4LiveSnapshot;
beforeAll(async () => { base = await createFixtureSource().loadSnapshot(); });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
  writes.length = 0;
  snapshot = { ...base, kpiAssessments: base.kpiAssessments!.map((item) => item.id === "FIX-D4-KPI-001" ? { ...item, id: KPI_ALFA } : item) };
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

const kpiBody = (patch: Record<string, unknown>) => {
  const current = snapshot.kpiAssessments!.find((item) => item.id === KPI_ALFA)!;
  return { employeeId: ALFA, roleOrder: current.roleOrder, status: "completed", lines: current.lines.map((line) => ({ ...line, raw_score: 4 })), generalNotes: "Uji", evidenceReference: "DOC-1", ...patch };
};

describe("POST /kpi-assessments for a future period (K7)", () => {
  it("answers that the period has not started, not the evaluation-date rule", async () => {
    const res = await kpi.POST(post(kpiBody({ period: "2026-12", evaluationDate: "2026-11-20" })));
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe("Period belum dimulai. Performance Review hanya untuk periode yang sudah berjalan.");
    expect(writes).toHaveLength(0);
  });

  it("still accepts the running period", async () => {
    const res = await kpi.POST(post(kpiBody({ period: "2026-11", evaluationDate: "2026-11-20" })));
    expect(res.status).toBe(201);
  });
});

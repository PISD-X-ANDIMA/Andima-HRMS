import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KPI_V51_CATALOG, type RoleKpiRow } from "@/modules/d4/kpi/catalog";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4LiveSnapshot } from "@/modules/d4/supabase/types";

// The real route handlers and the real session guard (modules/d4/server/_lib/session.ts) run here.
// Only the layer underneath is replaced: the Supabase server client (auth.getUser + the d3_user_access
// lookup + the KPI catalog query), the cookie store, and the repository, which reads an in-memory
// fixture snapshot. Nothing reaches Supabase.
const MERCURY = "d4000000-0000-4000-8000-000000000012"; // HR
const BRAVO = "d4000000-0000-4000-8000-000000000010"; // used as a manager
const ALFA = "d4000000-0000-4000-8000-000000000009";
const HOLLY = "d4000000-0000-4000-8000-000000000016";
const ALFA_GAP = "d4000000-0000-4000-8000-000000000028";
const FINANCE_STAFF = "d4000000-0000-4000-8000-000000000008";
const uuid = (n: number) => `e4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NEED = uuid(1), TRAINING = uuid(2), PERF_ALFA = uuid(3), KPI_ALFA = uuid(4);
const AUTH_USER = "a4000000-0000-4000-8000-000000000001";

type AccessRow = { app_role: "HR" | "MANAGER" | "EMPLOYEE"; employee_id: string | null };
// What Supabase answers for the signed-in user. `user: null` = no session cookie.
let user: { id: string } | null;
let accessRow: AccessRow | null;
let catalogRows: readonly RoleKpiRow[];
let snapshot: D4LiveSnapshot;
const writes: { method: string; args: unknown[] }[] = [];
const accessLookups: { table: string; filters: [string, unknown][] }[] = [];

const signIn = (app_role: AccessRow["app_role"], employee_id: string | null) => { user = { id: AUTH_USER }; accessRow = { app_role, employee_id }; };

function record(method: string, result: unknown = uuid(99)) {
  return async (...args: unknown[]) => { writes.push({ method, args }); return result; };
}
const repository = {
  loadSnapshot: async () => snapshot,
  loadReferenceData: async () => snapshot.reference,
  savePerformance: record("savePerformance"),
  saveKpiAssessment: record("saveKpiAssessment"),
  saveCompetency: record("saveCompetency"),
  createDevelopment: record("createDevelopment"),
  updateDevelopment: record("updateDevelopment", undefined),
  createTraining: record("createTraining"),
  updateTraining: record("updateTraining", undefined),
};

/** Minimal PostgREST query builder: `.select().eq().maybeSingle()` and a directly awaited `.select()`. */
function query(table: string) {
  const filters: [string, unknown][] = [];
  const result = () => {
    if (table === "d3_user_access") return { data: accessRow, error: null };
    if (table === "d4_kpi_role_catalog") return { data: catalogRows, error: null };
    return { data: null, error: null };
  };
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
    maybeSingle: async () => { accessLookups.push({ table, filters }); return result(); },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  };
  return builder;
}
const createServerClient = vi.fn(() => ({
  auth: { getUser: async () => user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "Auth session missing!" } } },
  from: query,
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@/modules/d4/supabase/repository", () => ({
  // Called with `new`; returning an object from a constructor function yields that object.
  SupabaseD4Repository: function SupabaseD4Repository() { return repository; },
}));

const perf = await import("@/app/api/d4/performance-evaluations/route");
const kpi = await import("@/app/api/d4/kpi-assessments/route");
const dev = await import("@/app/api/d4/development-needs/route");
const devVersions = await import("@/app/api/d4/development-needs/[id]/versions/route");
const training = await import("@/app/api/d4/training-records/route");
const trainingVersions = await import("@/app/api/d4/training-records/[id]/versions/route");
const competency = await import("@/app/api/d4/competency-assessments/route");
const snapshotRoute = await import("@/app/api/d4/snapshot/route");

const post = (body: unknown) => new Request("http://test/api", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function call(response: Promise<Response>) {
  const res = await response;
  return { status: res.status, body: await res.json() as { data?: unknown; error?: { code: string; message: string } } };
}

let base: D4LiveSnapshot;
beforeAll(async () => { base = await createFixtureSource().loadSnapshot(); });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  signIn("HR", MERCURY);
  catalogRows = KPI_V51_CATALOG;
  writes.length = 0;
  accessLookups.length = 0;
  createServerClient.mockClear();
  // Live ids are UUIDs; remap the fixture records the tests touch.
  snapshot = {
    ...base,
    performance: base.performance.map((item) => item.id === "FIX-D4-PERF-001" ? { ...item, id: PERF_ALFA } : item),
    kpiAssessments: base.kpiAssessments!.map((item) => item.id === "FIX-D4-KPI-001" ? { ...item, id: KPI_ALFA } : item),
    developmentVersions: base.developmentVersions.map((item) => item.needId === "FIX-D4-DEV-001" ? { ...item, needId: NEED } : item),
    trainingVersions: base.trainingVersions.map((item) => item.trainingId === "FIX-D4-TRN-001" ? { ...item, trainingId: TRAINING, developmentNeedId: NEED } : item),
  };
});
afterEach(() => { vi.unstubAllEnvs(); });

const evaluationBody = (patch: Record<string, unknown> = {}) => ({
  employeeId: HOLLY, period: "2026-09", evaluationDate: "2026-09-30", status: "completed", overallScore: 4, generalNotes: "Uji", ...patch,
});
const kpiBody = (patch: Record<string, unknown> = {}) => {
  const current = snapshot.kpiAssessments!.find((item) => item.id === KPI_ALFA)!;
  return { employeeId: ALFA, roleOrder: current.roleOrder, period: "2026-10", evaluationDate: "2026-10-28", status: "completed",
    lines: current.lines.map((line) => ({ ...line, raw_score: 4 })), ...patch };
};

// One valid request per write route; HR gets 201 on each (asserted below), so a 401/403 can only come from the guard.
const writeRoutes: [string, () => Promise<Response>][] = [
  ["POST /performance-evaluations", () => perf.POST(post(evaluationBody()))],
  ["POST /kpi-assessments", () => kpi.POST(post(kpiBody()))],
  ["POST /competency-assessments", () => competency.POST(post({ employeeId: ALFA, positionId: FINANCE_STAFF, effectiveDate: "2026-10-01" }))],
  ["POST /development-needs", () => dev.POST(post({ employeeId: ALFA, sourceType: "performance_context", sourceRef: PERF_ALFA, objective: "Uji", priority: "High" }))],
  ["POST /development-needs/:id/versions", () => devVersions.POST(post({ status: "Planned", notes: "Uji" }), params(NEED))],
  ["POST /training-records", () => training.POST(post({ employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2026-10-01", status: "Planned" }))],
  ["POST /training-records/:id/versions", () => trainingVersions.POST(post({ status: "In Progress", notes: "Uji" }), params(TRAINING))],
];

describe("session guard: real requireWriter over a mocked Supabase client", () => {
  it("returns 401 on a read without a session", async () => {
    user = null;
    const res = await call(snapshotRoute.GET());
    expect(res).toMatchObject({ status: 401, body: { error: { code: "UNAUTHENTICATED" } } });
  });

  it.each(writeRoutes)("%s without a session → 401, before any role lookup", async (_name, send) => {
    user = null;
    const res = await call(send());
    expect(res).toMatchObject({ status: 401, body: { error: { code: "UNAUTHENTICATED" } } });
    expect(accessLookups).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it.each(writeRoutes)("%s as EMPLOYEE → 403, nothing written", async (_name, send) => {
    signIn("EMPLOYEE", ALFA);
    const res = await call(send());
    expect(res).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
    expect(res.body.error?.message).toMatch(/Hanya HR atau manager/);
    expect(writes).toHaveLength(0);
    // The role comes from d3_user_access for the signed-in auth user, not from the request.
    expect(accessLookups).toEqual([{ table: "d3_user_access", filters: [["auth_user_id", AUTH_USER]] }]);
  });

  it("EMPLOYEE can still read (reads only need a session; RLS limits the rows)", async () => {
    signIn("EMPLOYEE", ALFA);
    expect((await call(snapshotRoute.GET())).status).toBe(200);
  });

  it.each(writeRoutes)("%s for a signed-in account without a d3_user_access row → 403", async (_name, send) => {
    accessRow = null;
    const res = await call(send());
    expect(res).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
    expect(writes).toHaveLength(0);
  });

  it.each(writeRoutes.flatMap(([name, send]) => [["HR", MERCURY, name, send], ["MANAGER", BRAVO, name, send]] as const))(
    "%s passes the guard on %s (201)", async (role, employeeId, _name, send) => {
      signIn(role, employeeId);
      const res = await call(send());
      expect(res.status).toBe(201);
      expect(writes).toHaveLength(1);
    });

  // Current behaviour, documented: requireWriter only checks app_role; it does not require employee_id.
  // Routes that store the evaluator's name (performance, KPI) then refuse with 403; the other writes succeed.
  describe.each(["HR", "MANAGER"] as const)("%s account without employee_id", (role) => {
    it.each(writeRoutes.slice(0, 2))("%s → 403 'belum terhubung dengan data employee'", async (_name, send) => {
      signIn(role, null);
      const res = await call(send());
      expect(res).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
      expect(res.body.error?.message).toMatch(/belum terhubung dengan data employee/);
      expect(writes).toHaveLength(0);
    });

    it.each(writeRoutes.slice(2))("%s → passes (201): the guard itself does not require employee_id", async (_name, send) => {
      signIn(role, null);
      expect((await call(send())).status).toBe(201);
    });
  });

  it("returns a 5xx without leaking details when the Supabase config is missing, before creating a client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await call(perf.POST(post(evaluationBody())));
    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe("CONFIGURATION_ERROR");
    expect(createServerClient).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
});

describe("request envelope", () => {
  it.each([["malformed JSON", "{"], ["array body", "[]"], ["null body", "null"]])("returns 400 for %s", async (_name, body) => {
    const res = await call(perf.POST(post(body)));
    expect(res).toMatchObject({ status: 400, body: { error: { code: "BAD_REQUEST" } } });
  });
});

describe("POST /performance-evaluations", () => {
  it("creates with the account's name as evaluator, ignoring the body", async () => {
    const res = await call(perf.POST(post(evaluationBody({ evaluator: "Nama Palsu" }))));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { evaluator: string }).evaluator).toBe("Mercury");
  });

  it.each([
    ["self-evaluation", { employeeId: MERCURY }, /diri sendiri/],
    ["duplicate period without revisionOf", { employeeId: ALFA }, /sudah ada/],
    ["revisionOf not a UUID", { employeeId: ALFA, revisionOf: "abc" }, /UUID/],
    ["score as string", { overallScore: "4" }, /./],
    ["score 0", { overallScore: 0 }, /./],
    ["period 2026-13", { period: "2026-13" }, /YYYY-MM/],
    ["status draft", { status: "draft" }, /status/],
    ["employeeId not UUID", { employeeId: "x" }, /UUID/],
    ["notes over 4000 chars", { generalNotes: "a".repeat(4001) }, /4000/],
  ])("rejects %s with 422", async (_name, patch, message) => {
    const res = await call(perf.POST(post(evaluationBody(patch))));
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("VALIDATION_FAILED");
    expect(res.body.error?.message).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  it("accepts a revision of the current record", async () => {
    const res = await call(perf.POST(post(evaluationBody({ employeeId: ALFA, revisionOf: PERF_ALFA }))));
    expect(res.status).toBe(201);
  });
});

describe("POST /kpi-assessments", () => {
  it("creates a scorecard for a new period", async () => {
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { evaluatorName: string }).evaluatorName).toBe("Mercury");
  });

  it.each([
    ["duplicate period", { period: "2026-09" }, /sudah ada/],
    ["wrong KPI role", { roleOrder: 99 }, /./],
    ["four lines", { lines: [] }, /./],
    ["fractional score", { fractional: true }, /bilangan bulat/],
    ["unknown employee", { employeeId: uuid(500) }, /tidak ditemukan/],
  ])("rejects %s", async (_name, patch: Record<string, unknown>, message) => {
    const { fractional, ...rest } = patch;
    const body = kpiBody(rest);
    if (fractional) body.lines = body.lines.map((line) => ({ ...line, raw_score: 3.5 }));
    const res = await call(kpi.POST(post(body)));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error?.message).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  // The server re-reads the catalog and refuses a role whose five weights do not total exactly 100.
  it.each([["99", -1], ["101", +1]])("rejects a catalog role whose weights total %s%%", async (_total, delta) => {
    const role = kpiBody().roleOrder;
    catalogRows = KPI_V51_CATALOG.map((row) => row.role_order === role && row.indicator_order === 5 ? { ...row, weight_percent: row.weight_percent + delta } : row);
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(res.body.error?.message).toMatch(/bobotnya bukan 100%/);
    expect(writes).toHaveLength(0);
  });

  it("accepts a revision of the current scorecard", async () => {
    const res = await call(kpi.POST(post(kpiBody({ period: "2026-09", revisionOf: KPI_ALFA, generalNotes: "Koreksi realisasi indikator 3." }))));
    expect(res.status).toBe(201);
  });

  it("rejects a revision without a reason in the notes", async () => {
    const res = await call(kpi.POST(post(kpiBody({ period: "2026-09", revisionOf: KPI_ALFA }))));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(res.body.error?.message).toMatch(/Alasan revisi/);
    expect(writes).toHaveLength(0);
  });

  it("rejects a self scorecard", async () => {
    signIn("MANAGER", ALFA);
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
  });
});

describe("development needs and training", () => {
  const devBody = { employeeId: ALFA, sourceType: "competency_gap", sourceRef: ALFA_GAP, objective: "Uji", priority: "High" };
  const trainingBody = { employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2026-10-01", status: "Planned" };

  it("rejects a second open need for the same gap", async () => {
    const res = await call(dev.POST(post(devBody)));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
  });

  it("rejects training for a completed need", async () => {
    snapshot = { ...snapshot, developmentVersions: [...snapshot.developmentVersions, { ...snapshot.developmentVersions.find((item) => item.needId === NEED)!, id: uuid(10), revision: 2, status: "Completed" }] };
    const res = await call(training.POST(post(trainingBody)));
    expect(res).toMatchObject({ status: 422 });
  });

  it("creates training for an open need", async () => {
    const res = await call(training.POST(post(trainingBody)));
    expect(res.status).toBe(201);
  });

  it("requires a reason when training moves back", async () => {
    snapshot = { ...snapshot, trainingVersions: [...snapshot.trainingVersions, { ...snapshot.trainingVersions.find((item) => item.trainingId === TRAINING)!, id: uuid(11), revision: 2, status: "Completed", result: "Lulus" }] };
    const bad = await call(trainingVersions.POST(post({ status: "Planned" }), params(TRAINING)));
    expect(bad).toMatchObject({ status: 422 });
    const ok = await call(trainingVersions.POST(post({ status: "Planned", notes: "Jadwal ulang" }), params(TRAINING)));
    expect(ok.status).toBe(201);
  });

  it("rejects Completed training dated after today", async () => {
    const res = await call(training.POST(post({ ...trainingBody, date: "2999-01-01", status: "Completed", result: "Lulus" })));
    expect(res).toMatchObject({ status: 422 });
    expect(res.body.error?.message).toMatch(/setelah hari ini/);
    expect(writes).toHaveLength(0);
  });

  it("rejects completing a training whose date is still in the future", async () => {
    snapshot = { ...snapshot, trainingVersions: snapshot.trainingVersions.map((item) => item.trainingId === TRAINING ? { ...item, date: "2999-01-01" } : item) };
    const res = await call(trainingVersions.POST(post({ status: "Completed", result: "Lulus" }), params(TRAINING)));
    expect(res).toMatchObject({ status: 422 });
    expect(writes).toHaveLength(0);
  });

  it("rejects development or training for the signed-in user", async () => {
    const devRes = await call(dev.POST(post({ ...devBody, employeeId: MERCURY, sourceType: "performance_context", sourceRef: PERF_ALFA })));
    const trnRes = await call(training.POST(post({ ...trainingBody, employeeId: MERCURY })));
    expect(devRes).toMatchObject({ status: 422 });
    expect(devRes.body.error?.message).toMatch(/diri sendiri/);
    expect(trnRes).toMatchObject({ status: 422 });
    expect(writes).toHaveLength(0);
  });

  it("requires a reason when a development need moves back", async () => {
    snapshot = { ...snapshot, developmentVersions: [...snapshot.developmentVersions, { ...snapshot.developmentVersions.find((item) => item.needId === NEED)!, id: uuid(12), revision: 2, status: "Completed" }] };
    const bad = await call(devVersions.POST(post({ status: "Planned" }), params(NEED)));
    expect(bad).toMatchObject({ status: 422 });
    const ok = await call(devVersions.POST(post({ status: "Planned", notes: "Gap masih terbuka setelah reassessment" }), params(NEED)));
    expect(ok.status).toBe(201);
  });

  it("returns 404 for a status update of an unknown training", async () => {
    const res = await call(trainingVersions.POST(post({ status: "Planned" }), params(uuid(404))));
    expect(res).toMatchObject({ status: 404, body: { error: { code: "NOT_FOUND" } } });
  });

  it("returns 404 for a status update of an unknown development need", async () => {
    const res = await call(devVersions.POST(post({ status: "Planned" }), params(uuid(404))));
    expect(res).toMatchObject({ status: 404, body: { error: { code: "NOT_FOUND" } } });
    expect(writes).toHaveLength(0);
  });
});

describe("unknown or malformed ids", () => {
  it.each([["unknown uuid", uuid(404)], ["non-uuid", "not-a-uuid"]])("returns 404 on version endpoints for %s", async (_name, id) => {
    const devRes = await call(devVersions.POST(post({ status: "Planned" }), params(id)));
    const trnRes = await call(trainingVersions.POST(post({ status: "Planned" }), params(id)));
    expect(devRes.status).toBe(404);
    expect(trnRes.status).toBe(404);
    expect(writes).toHaveLength(0);
  });

  it("returns 201 for a status update of an existing development need", async () => {
    const res = await call(devVersions.POST(post({ status: "Planned", notes: "Dijadwalkan" }), params(NEED)));
    expect(res.status).toBe(201);
    expect(writes[0]).toMatchObject({ method: "updateDevelopment", args: [NEED, "Planned", "Dijadwalkan"] });
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogFor, indicatorsFor, KPI_V51_CATALOG, seedCatalogSet, type KpiCatalogSet, type KpiCatalogVersion, type RoleKpiRow } from "@/modules/d4/kpi/catalog";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import { ApiError } from "@/modules/d4/shared/errors";
import type { D4LiveSnapshot } from "@/modules/d4/supabase/types";

// The real route handlers and the real session guard (modules/d4/server/_lib/session.ts) run here.
// Only the layer underneath is replaced: the Supabase server client (auth.getUser + the d4_user_access
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

type AccessRow = { app_role: "HR" | "MANAGER" | "MANAGEMENT" | "EMPLOYEE"; employee_id: string | null };
// What Supabase answers for the signed-in user. `user: null` = no session cookie.
let user: { id: string } | null;
let accessRow: AccessRow | null;
let catalogRows: readonly RoleKpiRow[];
let catalogVersions: KpiCatalogVersion[];
/** The views of 20261124130000; null = not applied yet (live today), so the loader reads the tables. */
let views: KpiCatalogSet | null;
let snapshot: D4LiveSnapshot;
const writes: { method: string; args: unknown[] }[] = [];
const accessLookups: { table: string; filters: [string, unknown][] }[] = [];

const signIn = (app_role: AccessRow["app_role"], employee_id: string | null) => { user = { id: AUTH_USER }; accessRow = { app_role, employee_id }; };

function record(method: string, result: unknown = uuid(99)) {
  return async (...args: unknown[]) => { writes.push({ method, args }); return result; };
}
let snapshotLoads = 0;
const repository = {
  loadSnapshot: async () => { snapshotLoads += 1; return snapshot; },
  loadTrainingState: async () => snapshot,
  loadReferenceData: async () => snapshot.reference,
  savePerformance: record("savePerformance"),
  saveKpiAssessment: record("saveKpiAssessment"),
  saveKpiDailyEntry: record("saveKpiDailyEntry"),
  savePeriodReopening: record("savePeriodReopening"),
  saveCompetency: record("saveCompetency"),
  createDevelopment: record("createDevelopment"),
  updateDevelopment: record("updateDevelopment", undefined),
  createTraining: record("createTraining"),
  updateTraining: record("updateTraining", undefined),
  recordTrainingFollowUp: record("recordTrainingFollowUp", null),
};

/** Minimal PostgREST query builder: `.select().eq().maybeSingle()` and a directly awaited `.select()`. */
function query(table: string) {
  const filters: [string, unknown][] = [];
  const result = () => {
    if (table === "d4_user_access") return { data: accessRow, error: null };
    if (table === "d4_kpi_role_catalog") return { data: catalogRows, error: null };
    if (table === "d4_kpi_catalog_versions") return { data: catalogVersions, error: null };
    // D4 roles only, as in the table; the D1 roles of seedCatalogSet's V6 come from the views, missing here.
    if (table === "d4_position_kpi_roles") return { data: catalogVersions.flatMap((version) => seedCatalogSet(snapshot.reference.positions).positionRoles.filter((item) => item.source_version === "V5.1").map((item) => ({ ...item, source_version: version.source_version }))), error: null };
    if (table === "d4_kpi_catalog_rows") return views ? { data: views.rows, error: null } : { data: null, error: { code: "PGRST205", message: "missing" } };
    if (table === "d4_kpi_position_roles") return views ? { data: views.positionRoles, error: null } : { data: null, error: { code: "PGRST205", message: "missing" } };
    return { data: null, error: null };
  };
  const builder = {
    select: () => builder,
    order: () => builder,
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
const devClose = await import("@/app/api/d4/development-needs/[id]/close/route");
const training = await import("@/app/api/d4/training-records/route");
const trainingVersions = await import("@/app/api/d4/training-records/[id]/versions/route");
const trainingFollowUp = await import("@/app/api/d4/training-records/[id]/follow-up/route");
const trainingComplete = await import("@/app/api/d4/training-records/[id]/complete/route");
const trainingBulk = await import("@/app/api/d4/training-records/bulk/route");
const competency = await import("@/app/api/d4/competency-assessments/route");
const snapshotRoute = await import("@/app/api/d4/snapshot/route");
const daily = await import("@/app/api/d4/kpi-daily/route");
const reopen = await import("@/app/api/d4/period-reopenings/route");
const { latestForPeriod, localToday } = await import("@/modules/d4/shared/rules");

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
  catalogVersions = [{ source_version: "V5.1", effective_from: "2000-01" }];
  views = null;
  writes.length = 0;
  snapshotLoads = 0;
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
  employeeId: HOLLY, period: "2026-09", evaluationDate: "2026-09-30", status: "completed", overallScore: 4, generalNotes: "Uji", evidenceReference: "DOC-1", ...patch,
});
const kpiBody = (patch: Record<string, unknown> = {}) => {
  const current = snapshot.kpiAssessments!.find((item) => item.id === KPI_ALFA)!;
  return { employeeId: ALFA, roleOrder: current.roleOrder, period: "2026-10", evaluationDate: "2026-10-01", status: "completed",
    lines: current.lines.map((line) => ({ ...line, raw_score: 4 })), generalNotes: "Uji", evidenceReference: "DOC-1", ...patch };
};

/** Three KPI weighing 40/35/25 in place of `role`'s five: D1 sets the count, D4 only needs the weights to total 100 (24 Nov 2026). */
const threeKpi = (role: number) => [...KPI_V51_CATALOG.filter((row) => row.role_order !== role),
  ...[40, 35, 25].map((weight_percent, index) => ({ ...KPI_V51_CATALOG.find((row) => row.role_order === role)!, indicator_order: index + 1, kpi_name: `KPI ${index + 1}`, weight_percent }))];

// One valid request per write route; HR gets 201 on each (asserted below), so a 401/403 can only come from the guard.
const writeRoutes: [string, () => Promise<Response>][] = [
  ["POST /performance-evaluations", () => perf.POST(post(evaluationBody()))],
  ["POST /kpi-assessments", () => kpi.POST(post(kpiBody()))],
  ["POST /competency-assessments", () => competency.POST(post({ employeeId: ALFA, positionId: FINANCE_STAFF, effectiveDate: "2026-10-01" }))],
  ["POST /development-needs", () => dev.POST(post({ employeeId: ALFA, sourceType: "performance_context", sourceRef: KPI_ALFA, objective: "Uji", priority: "High", pic: "Mrs. Maya" }))],
  ["POST /development-needs/:id/versions", () => devVersions.POST(post({ status: "Planned", notes: "Uji", method: "Mentoring" }), params(NEED))],
  ["POST /development-needs/:id/versions (edit)", () => devVersions.POST(post({ status: "Planned", notes: "", priority: "High", pic: "Bu Maya" }), params(NEED))],
  ["POST /training-records", () => training.POST(post({ employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2030-01-15", status: "Planned" }))],
  ["POST /training-records/:id/versions", () => trainingVersions.POST(post({ status: "In Progress", notes: "Uji" }), params(TRAINING))],
  // FIX-D4-TRN-003 (Mba Ena): Completed, Not Passed, no follow-up yet.
  ["POST /training-records/:id/follow-up", () => trainingFollowUp.POST(post({ followUp: "Other follow-up", notes: "Coaching" }), params("FIX-D4-TRN-003"))],
  ["POST /training-records/:id/complete", () => trainingComplete.POST(post({ result: "Not Passed", decision: "Other follow-up", notes: "Coaching" }), params("FIX-D4-TRN-003"))],
];

describe("session guard: real requireWriter over a mocked Supabase client", () => {
  // Mid-October: September (last month) and October are open, November has not started (open/closed periods, 24 Nov 2026).
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T03:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });
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

  it.each(writeRoutes.flatMap(([name, send]) => [["EMPLOYEE", name, send], ["MANAGEMENT", name, send]] as const))(
    "as %s, %s → 403, nothing written", async (role, _name, send) => {
    signIn(role, ALFA);
    const res = await call(send());
    expect(res).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
    expect(res.body.error?.message).toMatch(/Hanya HR atau manager/);
    expect(writes).toHaveLength(0);
    // The role comes from d4_user_access for the signed-in auth user, not from the request.
    expect(accessLookups).toEqual([{ table: "d4_user_access", filters: [["auth_user_id", AUTH_USER]] }]);
  });

  it.each(["EMPLOYEE", "MANAGEMENT"] as const)("%s can still read (reads only need a session; RLS limits the rows)", async (role) => {
    signIn(role, ALFA);
    expect((await call(snapshotRoute.GET())).status).toBe(200);
  });

  it.each(writeRoutes)("%s for a signed-in account without a d4_user_access row → 403", async (_name, send) => {
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
      // A training write may add the requirement revision that follows it (13 Nov 2026); the route's own write comes first.
      expect(writes.length).toBeGreaterThan(0);
    });

  // requireWriter also needs the actor's employee record: writes are attributed to it and checked against self-assessment.
  describe.each(["HR", "MANAGER"] as const)("%s account without employee_id", (role) => {
    it.each(writeRoutes)("%s → 403 'not linked to an employee record', nothing written", async (_name, send) => {
      signIn(role, null);
      const res = await call(send());
      expect(res).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
      expect(res.body.error?.message).toMatch(/belum terhubung ke data pegawai/);
      expect(writes).toHaveLength(0);
    });
  });

  // SR-D4-EMP-23: a writer may not assess or follow up their own record, on every route, not only performance and KPI.
  const ownerOf = (name: string) =>
    name.includes("development-needs/:id") ? snapshot.developmentVersions.find((item) => item.needId === NEED)!.employeeId
      : name.includes("training-records/:id/versions") ? snapshot.trainingVersions.find((item) => item.trainingId === TRAINING)!.employeeId
        : name.includes("training-records/:id") ? snapshot.trainingVersions.find((item) => item.trainingId === "FIX-D4-TRN-003")!.employeeId
          : ALFA;
  it.each(writeRoutes.slice(2))("%s on the writer's own record → 422, nothing written", async (name, send) => {
    signIn("MANAGER", ownerOf(name));
    const res = await call(send());
    expect(res.status).toBe(422);
    expect(res.body.error?.message).toMatch(/diri sendiri/);
    expect(writes).toHaveLength(0);
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
  // Mid-October: September (last month) and October are open, November has not started (open/closed periods, 24 Nov 2026).
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T03:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });
  it("ignores a submitted score: evaluations are notes only", async () => {
    const res = await call(perf.POST(post(evaluationBody({ overallScore: 4 }))));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { overallScore: number | null }).overallScore).toBeNull();
  });

  it("creates with the account's name as evaluator, ignoring the body", async () => {
    const res = await call(perf.POST(post(evaluationBody({ evaluator: "Nama Palsu" }))));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { evaluator: string }).evaluator).toBe("Mrs. Maya");
  });

  it.each([
    ["self-evaluation", { employeeId: MERCURY }, /diri sendiri/],
    ["duplicate period without revisionOf", { employeeId: ALFA }, /sudah ada/],
    ["revisionOf not a UUID", { employeeId: ALFA, revisionOf: "abc" }, /UUID/],
    ["period 2026-13", { period: "2026-13" }, /YYYY-MM/],
    ["status draft", { status: "draft" }, /status/],
    ["employeeId not UUID", { employeeId: "x" }, /UUID/],
    ["notes over 4000 chars", { generalNotes: "a".repeat(4001) }, /4000/],
    ["blank Reference", { evidenceReference: "  " }, /Reference wajib/],
  ])("rejects %s with 422", async (_name, patch, message) => {
    const res = await call(perf.POST(post(evaluationBody(patch))));
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("VALIDATION_FAILED");
    expect(res.body.error?.message).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  it("rejects a period that has not started yet (D4-FN-01)", async () => {
    const res = await call(perf.POST(post(evaluationBody({ period: "2026-12", evaluationDate: "2026-10-01" }))));
    // K7 (audit 12 Nov 2026): the message names the future period instead of the misleading evaluation-date rule.
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED", message: "Period belum dimulai. Performance Review hanya untuk periode yang sudah berjalan." } } });
    expect(writes).toHaveLength(0);
  });

  it("accepts a revision of the current record", async () => {
    const res = await call(perf.POST(post(evaluationBody({ employeeId: ALFA, revisionOf: PERF_ALFA }))));
    expect(res.status).toBe(201);
  });
});

describe("POST /kpi-assessments", () => {
  // Mid-October: September (last month) and October are open, November has not started (open/closed periods, 24 Nov 2026).
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T03:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });
  it("creates a scorecard for a new period", async () => {
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { evaluatorName: string }).evaluatorName).toBe("Mrs. Maya");
  });

  it("saves KPI, evaluation notes and evidence as one Penilaian Kinerja", async () => {
    const res = await call(kpi.POST(post(kpiBody({ generalNotes: "  Kuat di closing  ", evidenceReference: " DOC-7 " }))));
    expect(res.status).toBe(201);
    expect(writes[0].args[0]).toMatchObject({ generalNotes: "Kuat di closing", evidenceReference: "DOC-7" });
  });

  it.each([
    ["duplicate period", { period: "2026-09" }, /sudah ada/],
    ["wrong KPI role", { roleOrder: 99 }, /./],
    ["four lines", { lines: [] }, /./],
    ["fractional score", { fractional: true }, /Actual untuk .*bilangan bulat/],
    ["unknown employee", { employeeId: uuid(500) }, /tidak ditemukan/],
    ["no evaluation notes", { generalNotes: "   " }, /Notes wajib/],
    ["no evidence", { evidenceReference: " " }, /Reference wajib/],
    // Q12: the server refuses an empty Reference however it is sent, not only the form.
    ["empty evidence", { evidenceReference: "" }, /Reference wajib/],
    ["null evidence", { evidenceReference: null }, /Reference wajib/],
    ["missing evidence", { evidenceReference: undefined }, /Reference wajib/],
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

  it("rejects a scorecard for a period that has not started yet (D4-FN-01)", async () => {
    const res = await call(kpi.POST(post(kpiBody({ period: "2026-11" }))));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED", message: "Period belum dimulai. Performance Review hanya untuk periode yang sudah berjalan." } } });
    expect(writes).toHaveLength(0);
  });

  // Lecturer review 24 Nov 2026: a back-dated review reads as written earlier than it was.
  it("stores the saved day as the evaluation date, ignoring the one sent", async () => {
    const res = await call(kpi.POST(post(kpiBody({ evaluationDate: "2026-10-01" }))));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { evaluationDate: string }).evaluationDate).toBe("2026-10-15");
  });

  it("refuses a closed period and accepts it again while HR has reopened it", async () => {
    vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
    const closed = await call(kpi.POST(post(kpiBody({ period: "2026-09" }))));
    expect(closed).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED", message: expect.stringMatching(/sudah ditutup/) } } });
    expect(writes).toHaveLength(0);
    snapshot = { ...snapshot, periodReopenings: [{ period: "2026-09", openUntil: "2026-11-30", reason: "Penilaian terlambat", createdAt: "2026-11-24T01:00:00Z" }] };
    const reopened = await call(kpi.POST(post(kpiBody({ period: "2026-09", revisionOf: KPI_ALFA }))));
    expect(reopened.status).toBe(201);
  });

  // The server re-reads the catalog and refuses a role whose five weights do not total exactly 100.
  it.each([["99", -1], ["101", +1]])("rejects a catalog role whose weights total %s%%", async (_total, delta) => {
    const role = kpiBody().roleOrder;
    catalogRows = KPI_V51_CATALOG.map((row) => row.role_order === role && row.indicator_order === 5 ? { ...row, weight_percent: row.weight_percent + delta } : row);
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(res.body.error?.message).toMatch(/tidak 100%/);
    expect(writes).toHaveLength(0);
  });

  it("scores a three-KPI set with three lines and refuses five", async () => {
    const role = kpiBody().roleOrder;
    catalogRows = threeKpi(role);
    expect((await call(kpi.POST(post(kpiBody())))).status).toBe(422);
    const res = await call(kpi.POST(post(kpiBody({ lines: kpiBody().lines.slice(0, 3) }))));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { lines: { weight_percent: number }[] }).lines.map((line) => line.weight_percent)).toEqual([40, 35, 25]);
  });

  it("rejects a period before any catalog version is in force", async () => {
    catalogVersions = [{ source_version: "V5.1", effective_from: "2027-01" }];
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(res.body.error?.message).toMatch(/Belum ada katalog KPI/);
    expect(writes).toHaveLength(0);
  });

  it("stores the catalog version in force for the period", async () => {
    catalogRows = [...KPI_V51_CATALOG, ...KPI_V51_CATALOG.map((row) => ({ ...row, source_version: "V6" }))];
    catalogVersions = [{ source_version: "V5.1", effective_from: "2000-01" }, { source_version: "V6", effective_from: "2026-10" }];
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res).toMatchObject({ status: 201, body: { data: { definitionVersion: "V6" } } });
  });

  // Core KPI names are editable; weights always come from the catalog, not the request.
  it("keeps an edited Core KPI name and the catalog weight", async () => {
    const body = kpiBody();
    body.lines = body.lines.map((line, index) => index ? line : { ...line, kpi_name: "Nama KPI baru", weight_percent: 1 });
    const res = await call(kpi.POST(post(body)));
    expect(res.status).toBe(201);
    const saved = (writes[0].args[0] as { lines: { kpi_name: string; weight_percent: number }[] }).lines[0];
    expect(saved.kpi_name).toBe("Nama KPI baru");
    expect(saved.weight_percent).toBe(kpiBody().lines[0].weight_percent);
  });

  // The target is fixed (85 unless the catalog carries one); whatever the form sends is ignored.
  it("stores the fixed target and ignores the target sent by the client", async () => {
    const body = kpiBody();
    body.lines = body.lines.map((line) => ({ ...line, target: "999" }));
    const res = await call(kpi.POST(post(body)));
    expect(res.status).toBe(201);
    const saved = (writes[0].args[0] as { lines: { target: string }[] }).lines;
    expect(saved.map((line) => line.target)).toEqual(["85", "85", "85", "85", "85"]);
  });

  // Catalog V6 (from 2026-11) scores 1–100; V5.1 keeps 1–5.
  describe("score scale per catalog version", () => {
    const useV6 = () => {
      catalogRows = [...KPI_V51_CATALOG, ...KPI_V51_CATALOG.map((row) => ({ ...row, source_version: "V6" }))];
      catalogVersions = [{ source_version: "V5.1", effective_from: "2000-01" }, { source_version: "V6", effective_from: "2026-11" }];
    };
    const withScore = (period: string, rawScore: number) => { const body = kpiBody({ period, evaluationDate: "2026-11-15" }); body.lines = body.lines.map((line) => ({ ...line, raw_score: rawScore })); return body; };
    // A V6 scorecard is dated in or after Nov 2026 (D4-FN-01), so these run on a clock in that month.
    beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-20T03:00:00Z")); });
    afterEach(() => { vi.useRealTimers(); });

    it("accepts a score up to 100 for a V6 period", async () => {
      useV6();
      const res = await call(kpi.POST(post(withScore("2026-11", 85))));
      expect(res.status).toBe(201);
      expect((writes[0].args[0] as { definitionVersion: string }).definitionVersion).toBe("V6");
    });

    it("rejects 101 for a V6 period", async () => {
      useV6();
      const res = await call(kpi.POST(post(withScore("2026-11", 101))));
      expect(res.status).toBe(422);
      expect(writes).toHaveLength(0);
    });

    it("still rejects a score above 5 for a V5.1 period", async () => {
      useV6();
      const res = await call(kpi.POST(post(withScore("2026-10", 85))));
      expect(res.status).toBe(422);
      expect(writes).toHaveLength(0);
    });
  });

  it("rejects an empty Core KPI name", async () => {
    const body = kpiBody();
    body.lines = body.lines.map((line, index) => index ? line : { ...line, kpi_name: " " });
    const res = await call(kpi.POST(post(body)));
    expect(res.status).toBe(422);
    expect(writes).toHaveLength(0);
  });

  it("accepts a revision of the current scorecard", async () => {
    const res = await call(kpi.POST(post(kpiBody({ period: "2026-09", revisionOf: KPI_ALFA }))));
    expect(res.status).toBe(201);
  });

  it("answers 409 for a revision of a scorecard that is no longer the latest (saved again in another tab)", async () => {
    const current = snapshot.kpiAssessments!.find((item) => item.id === KPI_ALFA)!;
    snapshot = { ...snapshot, kpiAssessments: [{ ...current, id: uuid(77), createdAt: "2099-01-01T00:00:00Z" }, ...snapshot.kpiAssessments!] };
    const res = await call(kpi.POST(post(kpiBody({ period: "2026-09", revisionOf: KPI_ALFA }))));
    expect(res).toMatchObject({ status: 409, body: { error: { code: "CONFLICT" } } });
    expect(res.body.error?.message).toMatch(/lebih baru/);
    expect(writes).toHaveLength(0);
  });

  // Interview 13 Nov 2026 (0:52:35): a period's assessment is revised at most once.
  it("answers 422 for a revision of a revision", async () => {
    const current = snapshot.kpiAssessments!.find((item) => item.id === KPI_ALFA)!;
    const revision = { ...current, id: uuid(78), createdAt: "2099-01-01T00:00:00Z" };
    snapshot = { ...snapshot, kpiAssessments: [revision, ...snapshot.kpiAssessments!] };
    const res = await call(kpi.POST(post(kpiBody({ period: "2026-09", revisionOf: revision.id }))));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(res.body.error?.message).toMatch(/satu revisi per periode/);
    expect(writes).toHaveLength(0);
  });

  it("rejects a self scorecard", async () => {
    signIn("MANAGER", ALFA);
    const res = await call(kpi.POST(post(kpiBody())));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
  });
});

describe("development needs and training", () => {
  const devBody = { employeeId: ALFA, sourceType: "competency_gap", sourceRef: ALFA_GAP, objective: "Uji", priority: "High", pic: "Mrs. Maya" };
  const trainingBody = { employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2030-01-15", status: "Planned" };

  // B13 (interview D4, 14 Oct 2026): a requirement needs a PIC; an edit may not clear it, leaving it out keeps it.
  it.each([
    ["create without PIC", () => dev.POST(post({ ...devBody, sourceType: "performance_context", sourceRef: KPI_ALFA, pic: "" }))],
    ["create with a blank PIC", () => dev.POST(post({ ...devBody, sourceType: "performance_context", sourceRef: KPI_ALFA, pic: "  " }))],
    ["edit clearing the PIC", () => devVersions.POST(post({ status: "Planned", notes: "", pic: "" }), params(NEED))],
  ])("rejects %s with 422", async (_name, send) => {
    expect(await call(send())).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED", message: "PIC wajib diisi." } } });
    expect(writes).toHaveLength(0);
  });

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

  // HR (10 Nov 2026): the requirement follows its training, as a revision written after the training's.
  it("moves the requirement to In Progress when its training starts", async () => {
    // The sync reads the stored trainings (syncDevelopment reloads the snapshot), so this write is kept like the database does.
    const stored = vi.spyOn(repository, "updateTraining").mockImplementation(async (...args: unknown[]) => {
      writes.push({ method: "updateTraining", args });
      const current = snapshot.trainingVersions.find((item) => item.trainingId === TRAINING)!;
      snapshot = { ...snapshot, trainingVersions: [...snapshot.trainingVersions, { ...current, id: uuid(12), revision: current.revision + 1, status: "In Progress" }] };
    });
    const res = await call(trainingVersions.POST(post({ status: "In Progress", notes: "" }), params(TRAINING)));
    stored.mockRestore();
    expect(res.status).toBe(201);
    expect(writes.map((item) => item.method)).toEqual(["updateTraining", "updateDevelopment"]);
    expect(writes[1].args).toEqual([NEED, expect.objectContaining({ status: "In Progress", reassessment: null }), expect.objectContaining({ status: "Planned" })]);
  });

  it("requires a reason when training moves back", async () => {
    snapshot = { ...snapshot, trainingVersions: [...snapshot.trainingVersions, { ...snapshot.trainingVersions.find((item) => item.trainingId === TRAINING)!, id: uuid(11), revision: 2, status: "Completed", result: "Lulus" }] };
    const bad = await call(trainingVersions.POST(post({ status: "Planned" }), params(TRAINING)));
    expect(bad).toMatchObject({ status: 422 });
    const ok = await call(trainingVersions.POST(post({ status: "Planned", notes: "Jadwal ulang" }), params(TRAINING)));
    expect(ok.status).toBe(201);
  });

  it("accepts only Passed or Not Passed as the result of a completed training", async () => {
    const bad = await call(trainingVersions.POST(post({ status: "Completed", result: "Lulus" }), params(TRAINING)));
    expect(bad).toMatchObject({ status: 422 });
    const ok = await call(trainingVersions.POST(post({ status: "Completed", result: "Not Passed" }), params(TRAINING)));
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

// PST 2: a bulk save loaded all D4 data twice per row; now once per request, plus once per employee written again.
describe("POST /training-records/bulk", () => {
  const bulk = (items: unknown) => call(trainingBulk.POST(post({ items })));

  it("saves each row with its own rules, loads the snapshot once, and keeps going after a refused row", async () => {
    const res = await bulk([
      { op: "version", trainingId: TRAINING, status: "In Progress", result: "", notes: "" },
      // Holly's training is Completed; moving it back needs a reason.
      { op: "version", trainingId: "FIX-D4-TRN-003", status: "Planned", result: "", notes: "" },
      { op: "complete", trainingId: "FIX-D4-TRN-002", result: "Not Passed", decision: "Other follow-up", notes: "Coaching oleh atasan" },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ results: [{ ok: true }, { ok: false, message: expect.stringMatching(/alasan|catatan/i) }, { ok: true }] });
    expect(snapshotLoads).toBe(1);
    // The mock does not store writes, so the requirement sync finds nothing to change here.
    expect(writes.map((item) => item.method)).toEqual(["updateTraining", "recordTrainingFollowUp"]);
  });

  it("checks create and version rows of one employee against the same snapshot", async () => {
    const res = await bulk([
      { op: "create", employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2030-01-15", status: "Planned", result: "", notes: "" },
      { op: "version", trainingId: TRAINING, status: "In Progress", result: "", notes: "" },
    ]);
    expect(res.body.data).toEqual({ results: [{ ok: true }, { ok: true }] });
    expect(snapshotLoads).toBe(1);
  });

  // Completion reads the requirement, the latest trainings and the last assessment, which an earlier row can change.
  it("reloads the snapshot before completing a training of an employee an earlier row wrote", async () => {
    const first = snapshot.trainingVersions.find((item) => item.trainingId === TRAINING)!;
    snapshot = { ...snapshot, trainingVersions: [{ ...first, id: uuid(21), trainingId: uuid(20) }, ...snapshot.trainingVersions] };
    const otherFollowUp = (trainingId: string) => ({ op: "complete", trainingId, result: "Not Passed", decision: "Other follow-up", notes: "Coaching oleh atasan" });
    await bulk([otherFollowUp(TRAINING), otherFollowUp(uuid(20))]);
    expect(snapshotLoads).toBe(2);
  });

  it("refuses a row for the signed-in employee without stopping the batch", async () => {
    const res = await bulk([
      { op: "create", employeeId: MERCURY, developmentNeedId: NEED, activity: "Uji", date: "2030-01-15", status: "Planned", result: "", notes: "" },
      { op: "create", employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2030-01-15", status: "Planned", result: "", notes: "" },
    ]);
    expect(res.body.data).toEqual({ results: [{ ok: false, message: expect.stringMatching(/diri sendiri/) }, { ok: true }] });
  });

  it.each([["no rows", []], ["not a list", "x"], ["too many rows", Array.from({ length: 201 }, () => ({}))]])("rejects %s with 422", async (_name, items) => {
    expect(await bulk(items)).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(writes).toHaveLength(0);
  });

  it("is closed to employees", async () => {
    signIn("EMPLOYEE", ALFA);
    expect((await bulk([{ op: "version", trainingId: TRAINING, status: "In Progress" }])).status).toBe(403);
  });
});

// Q16 (20 Oct 2026): every completed training is Passed or Not Passed; Not Passed needs HR's follow-up.
describe("training result and follow-up", () => {
  const NOT_PASSED = "FIX-D4-TRN-003";
  const followUp = (body: Record<string, unknown>, id = NOT_PASSED) => call(trainingFollowUp.POST(post(body), params(id)));

  it.each([["no result", {}], ["a free-text result", { result: "Lulus" }]])("rejects creating a Completed training with %s (422)", async (_name, patch) => {
    const res = await call(training.POST(post({ employeeId: ALFA, developmentNeedId: NEED, activity: "Uji", date: "2026-10-01", status: "Completed", ...patch })));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED" } } });
    expect(writes).toHaveLength(0);
  });

  it("records Other follow-up with its note; the status and result come from the record, not the body", async () => {
    expect((await followUp({ followUp: "Other follow-up", notes: "  " })).status).toBe(422);
    const res = await followUp({ followUp: "Other follow-up", notes: "Eskalasi ke atasan", status: "Planned", result: "Passed" });
    expect(res).toMatchObject({ status: 201, body: { data: { trainingId: NOT_PASSED, followUp: "Other follow-up", retrainingId: null } } });
    expect(writes).toEqual([{ method: "recordTrainingFollowUp", args: [NOT_PASSED, { followUp: "Other follow-up", notes: "Eskalasi ke atasan" }, snapshot] }]);
  });

  it("passes the new training of a Retraining to the repository, and requires its name and date", async () => {
    expect((await followUp({ followUp: "Retraining", notes: "" })).status).toBe(422);
    const res = await followUp({ followUp: "Retraining", notes: "", activity: "Records Retention Workshop (ulang)", date: "2026-10-27" });
    expect(res.status).toBe(201);
    expect(writes[0].args[1]).toEqual({ followUp: "Retraining", notes: "", activity: "Records Retention Workshop (ulang)", date: "2026-10-27" });
  });

  it.each([
    ["an unknown follow-up", NOT_PASSED, { followUp: "Coaching", notes: "x" }, 422],
    ["a training that is not Not Passed", TRAINING, { followUp: "Other follow-up", notes: "x" }, 422],
    ["an unknown training", uuid(404), { followUp: "Other follow-up", notes: "x" }, 404],
  ])("rejects %s", async (_name, id, body, status) => {
    expect((await followUp(body, id)).status).toBe(status);
    expect(writes).toHaveLength(0);
  });

  it("rejects a second follow-up for the same Not Passed result", async () => {
    const current = snapshot.trainingVersions.find((item) => item.trainingId === NOT_PASSED)!;
    snapshot = { ...snapshot, trainingVersions: [{ ...current, id: uuid(12), revision: current.revision + 1, followUp: "Other follow-up", notes: "Coaching" }, ...snapshot.trainingVersions] };
    const res = await followUp({ followUp: "Retraining", notes: "", activity: "Ulang", date: "2026-10-27" });
    expect(res.status).toBe(422);
    expect(res.body.error?.message).toMatch(/sudah dicatat/);
  });

  it("answers 503 with the repository's message before migration 20261020130000, not a 500", async () => {
    const { FOLLOW_UP_NOT_READY } = await vi.importActual<typeof import("@/modules/d4/supabase/repository")>("@/modules/d4/supabase/repository");
    vi.spyOn(repository, "recordTrainingFollowUp").mockRejectedValueOnce(new ApiError("CONFIGURATION_ERROR", FOLLOW_UP_NOT_READY));
    const res = await followUp({ followUp: "Other follow-up", notes: "Coaching" });
    expect(res).toEqual({ status: 503, body: { error: { code: "CONFIGURATION_ERROR", message: FOLLOW_UP_NOT_READY } } });
  });

  it("rejects Retraining for a Completed requirement but still allows Other follow-up", async () => {
    snapshot = { ...snapshot, developmentVersions: snapshot.developmentVersions.map((item) => item.needId === "FIX-D4-DEV-003" ? { ...item, status: "Completed" as const } : item) };
    const res = await followUp({ followUp: "Retraining", notes: "", activity: "Ulang", date: "2026-10-27" });
    expect(res.body.error?.message).toMatch(/sudah Completed/);
    expect((await followUp({ followUp: "Other follow-up", notes: "Rotasi" })).status).toBe(201);
  });
});

// One menu (10 Nov 2026): Update Progress → Completed saves the result and HR's decision in one request.
describe("training completion in one save", () => {
  const RUNNING = "FIX-D4-TRN-002"; // Bu Dian, In Progress, gap requirement still at level 3 of 4
  const complete = (body: Record<string, unknown>, id = RUNNING) => call(trainingComplete.POST(post(body), params(id)));

  // Retraining after a pass is the outcome of a reassessment (interview 14 Oct, part 2, 00:53:31): the Passed result
  // already saved, and a competency assessment saved after it when `reassessed`.
  const passed = (reassessed: boolean) => {
    const running = snapshot.trainingVersions.find((item) => item.trainingId === RUNNING)!;
    const positionId = snapshot.reference.employees.find((item) => item.id === running.employeeId)!.positionId!;
    snapshot = { ...snapshot,
      trainingVersions: [{ ...running, id: "TRN-V2-PASSED", revision: running.revision + 1, status: "Completed", result: "Passed", notes: "", createdAt: "2026-11-20T01:00:00.000Z" }, ...snapshot.trainingVersions],
      competency: reassessed ? [{ id: "REASSESSED", source: "supabase", employeeId: running.employeeId, positionId, effectiveDate: "2026-11-20", context: "current-position", findings: [],
        overallStatus: "Gap", createdAt: "2026-11-20T02:00:00.000Z", actor: "HR" }, ...snapshot.competency] : snapshot.competency };
  };

  it("Retraining after the reassessment writes a competency snapshot, the requirement, then the next training", async () => {
    passed(true);
    const res = await complete({ result: "Passed", decision: "Retraining", notes: "Level belum naik", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    expect(res).toMatchObject({ status: 201, body: { data: { trainingId: RUNNING, decision: "Retraining" } } });
    // The saved Passed result is not written again.
    expect(writes.map((item) => item.method)).toEqual(["saveCompetency", "updateDevelopment", "createTraining"]);
    expect(writes[1].args[1]).toMatchObject({ status: "Planned", reassessment: "Retraining" });
    expect(writes[2].args[0]).toMatchObject({ developmentNeedId: "FIX-D4-DEV-002", status: "Planned", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
  });

  it.each([
    ["in the save that records Passed", null, /Retraining dipilih saat reassessment/],
    ["before an assessment saved after the result", false, /Belum ada penilaian ulang/],
  ])("refuses Retraining %s, before any write", async (_name, reassessed, message) => {
    if (reassessed !== null) passed(reassessed);
    const res = await complete({ result: "Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    expect(res.status).toBe(422);
    expect(res.body.error?.message).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  it("refuses Meets requirement while the level is not met, before any write", async () => {
    const res = await complete({ result: "Passed", decision: "Meets requirement", notes: "" });
    expect(res.status).toBe(422);
    expect(res.body.error?.message).toMatch(/level saat ini 3, required 4/);
    expect(writes).toHaveLength(0);
  });

  it("Not Passed writes one version that carries the follow-up", async () => {
    const res = await complete({ result: "Not Passed", decision: "Retraining", notes: "", activity: "Coretax Reporting Clinic", date: "2030-01-15" });
    expect(res.status).toBe(201);
    expect(writes.map((item) => item.method)).toEqual(["recordTrainingFollowUp"]);
  });

  it.each([
    ["a decision of the other result", { result: "Passed", decision: "Other follow-up", notes: "x" }, 422],
    ["Retraining without the next training", { result: "Passed", decision: "Retraining", notes: "" }, 422],
    ["an unknown decision", { result: "Passed", decision: "Later", notes: "" }, 422],
  ])("rejects %s", async (_name, body, status) => {
    expect((await complete(body)).status).toBe(status);
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

  it("returns 422 when the employee_id list filter is not a uuid", async () => {
    const res = await call(perf.GET(new Request("http://localhost/api/d4/performance-evaluations?employee_id=not-a-uuid")));
    expect(res.status).toBe(422);
  });

  it("refuses a status change on the versions route: progress follows Training Tracking (13 Nov 2026)", async () => {
    for (const body of [{ status: "In Progress", notes: "Dimulai" }, { status: "Completed", notes: "Coaching" }, { status: "Planned", notes: "", reassessment: "Retraining" }]) {
      const res = await call(devVersions.POST(post(body), params(NEED)));
      expect(res.status).toBe(422);
      expect(res.body.error?.message).toMatch(/mengikuti Training Tracking/);
    }
    expect(writes).toHaveLength(0);
  });

  it("edits priority, method and PIC of a development need without a status change; null keeps the value", async () => {
    const res = await call(devVersions.POST(post({ status: "Planned", notes: "Kebijakan pajak berubah", priority: "Low", method: "Coaching", pic: null }), params(NEED)));
    expect(res.status).toBe(201);
    expect(writes[0].args[1]).toMatchObject({ status: "Planned", priority: "Low", method: "Coaching", pic: "" });
    // The repository gets the current revision to send only the changed columns.
    expect(writes[0].args[2]).toMatchObject({ priority: "High", status: "Planned" });
  });

  it.each([
    ["unknown priority", { status: "Planned", priority: "Urgent" }, /priority/],
    ["unknown reassessment", { status: "Planned", reassessment: "Maybe" }, /reassessment/],
    ["a reassessment", { status: "Planned", reassessment: "Meets requirement" }, /mengikuti Training Tracking/],
    ["no change", { status: "Planned" }, /Tidak ada perubahan/],
  ])("rejects a development revision with %s (422)", async (_name, body, message) => {
    const res = await call(devVersions.POST(post(body), params(NEED)));
    expect(res.status).toBe(422);
    expect(res.body.error?.message).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  it("moves the requirement with its training: a new In Progress training makes it In Progress", async () => {
    snapshot = { ...snapshot, trainingVersions: snapshot.trainingVersions.map((item) => item.trainingId === TRAINING ? { ...item, status: "In Progress" as const } : item) };
    const res = await call(trainingVersions.POST(post({ status: "Completed", result: "Not Passed", notes: "Uji" }), params(TRAINING)));
    expect(res.status).toBe(201);
    expect(writes.map((item) => item.method)).toEqual(["updateTraining", "updateDevelopment"]);
    expect(writes[1].args[1]).toMatchObject({ status: "In Progress", reassessment: null, notes: "Mengikuti Training Tracking." });
  });

  describe("POST /development-needs/:id/close (path B, 13 Nov 2026)", () => {
    const requirement = () => snapshot.reference.positionRequirements.find((item) => item.id === ALFA_GAP)!;
    // Kak Ismi's skill for the gap competency raised to the minimum, as if the level was updated in D3 after coaching.
    const levelMet = () => {
      const { competencyId, minProficiencyLevel } = requirement();
      const others = snapshot.reference.employeeSkills.filter((item) => !(item.employeeId === ALFA && item.competencyId === competencyId));
      snapshot = { ...snapshot, reference: { ...snapshot.reference, employeeSkills: [...others, { id: "skill-met", employeeId: ALFA, competencyId, proficiencyLevel: minProficiencyLevel, evidenceNotes: "Coaching" }] } };
    };
    const noOpenTraining = () => { snapshot = { ...snapshot, trainingVersions: snapshot.trainingVersions.map((item) => item.developmentNeedId === NEED ? { ...item, status: "Cancelled" as const } : item) }; };

    it("closes a gap requirement as Completed with Meets requirement once the level is met and no training is open", async () => {
      levelMet(); noOpenTraining();
      const res = await call(devClose.POST(post({}), params(NEED)));
      expect(res.status).toBe(201);
      expect(writes[0].method).toBe("updateDevelopment");
      expect(writes[0].args.slice(0, 2)).toMatchObject([NEED, { status: "Completed", reassessment: "Meets requirement" }]);
      expect((writes[0].args[1] as { notes: string }).notes).toMatch(/Gap terpenuhi tanpa training/);
    });

    it.each([
      ["the level is not met", () => { noOpenTraining(); }, /level saat ini/],
      ["a training is still open", () => { levelMet(); }, /Training Tracking/],
    ])("refuses when %s (422), nothing written", async (_name, arrange, message) => {
      arrange();
      const res = await call(devClose.POST(post({}), params(NEED)));
      expect(res.status).toBe(422);
      expect(res.body.error?.message).toMatch(message);
      expect(writes).toHaveLength(0);
    });

    it("refuses a requirement that is not from a competency gap, the writer's own one, and a non-writer", async () => {
      snapshot = { ...snapshot, developmentVersions: snapshot.developmentVersions.map((item) => item.needId === NEED ? { ...item, sourceType: "performance_context" as const } : item) };
      expect((await call(devClose.POST(post({}), params(NEED)))).body.error?.message).toMatch(/Hanya requirement dari Competency Gap/);
      signIn("MANAGER", ALFA);
      expect((await call(devClose.POST(post({}), params(NEED)))).body.error?.message).toMatch(/diri sendiri/);
      signIn("MANAGEMENT", BRAVO);
      expect((await call(devClose.POST(post({}), params(NEED)))).status).toBe(403);
      expect(writes).toHaveLength(0);
    });
  });

  it("passes the trimmed co-assessor of a competency assessment to the repository", async () => {
    const res = await call(competency.POST(post({ employeeId: ALFA, positionId: FINANCE_STAFF, effectiveDate: "2026-10-01", assessedWith: "  Rina, Finance Manager " })));
    expect(res.status).toBe(201);
    expect(writes[0].args[0]).toMatchObject({ assessedWith: "Rina, Finance Manager" });
    expect((await call(competency.POST(post({ employeeId: ALFA, positionId: FINANCE_STAFF, effectiveDate: "2026-10-01", assessedWith: "x".repeat(201) })))).status).toBe(422);
  });
});

describe("POST /kpi-daily (self-service, not HR-only)", () => {
  const dailyBody = (patch: Record<string, unknown> = {}) => ({ entryDate: localToday(), lines: Array.from({ length: 5 }, () => ({ raw_score: 4, comment: "" })), ...patch });

  it("lets an EMPLOYEE score their own day; the employee comes from the session, never the body", async () => {
    signIn("EMPLOYEE", ALFA);
    const res = await call(daily.POST(post(dailyBody({ employeeId: MERCURY, roleOrder: 1 }))));
    expect(res.status).toBe(201);
    const saved = writes[0].args[0] as { employeeId: string; roleOrder: number; lines: { kpi_name: string; raw_score: number }[] };
    expect(saved.employeeId).toBe(ALFA);
    expect(saved.roleOrder).not.toBe(1);
    expect(saved.lines.map((line) => line.raw_score)).toEqual([4, 4, 4, 4, 4]);
  });

  it("refuses MANAGEMENT (a director) with 403: directors only read, their own Daily KPI included (decision 13 Nov 2026)", async () => {
    signIn("MANAGEMENT", ALFA);
    const res = await call(daily.POST(post(dailyBody())));
    expect(res.status).toBe(403);
    expect(res.body.error?.message).toMatch(/Direktur tidak mengisi Daily KPI/);
    expect(writes).toHaveLength(0);
  });

  it("refuses an account without an employee record with 403", async () => {
    signIn("EMPLOYEE", null);
    expect((await call(daily.POST(post(dailyBody())))).status).toBe(403);
    expect(writes).toHaveLength(0);
  });

  it.each([
    ["a future day", { entryDate: "2999-01-01" }, /lebih dari hari ini/],
    ["a day of an earlier period", { entryDate: "2026-01-15" }, /periode berjalan/],
    ["a score above the 1–5 scale of V5.1", { lines: Array.from({ length: 5 }, () => ({ raw_score: 6, comment: "" })) }, /1 sampai 5/],
    ["four lines", { lines: Array.from({ length: 4 }, () => ({ raw_score: 4, comment: "" })) }, /5 indikator sesuai katalog/],
  ])("rejects %s with 422", async (_name, patch, message) => {
    signIn("EMPLOYEE", ALFA);
    const res = await call(daily.POST(post(dailyBody(patch))));
    expect(res.status).toBe(422);
    expect(res.body.error?.message).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  it("takes as many lines as the position's KPI set has: three for a three-KPI set", async () => {
    signIn("EMPLOYEE", ALFA);
    catalogRows = threeKpi(10); // Kak Ismi (Billing) has role 10
    expect((await call(daily.POST(post(dailyBody())))).status).toBe(422);
    const res = await call(daily.POST(post(dailyBody({ lines: Array.from({ length: 3 }, () => ({ raw_score: 4, comment: "" })) }))));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { lines: unknown[] }).lines).toHaveLength(3);
  });
});

// 20261124130000: from 2026-11 a position D1 maps scores D1's KPI (role 1000 + the job code's digits), read through the views.
describe("KPI from D1 through the views", () => {
  const KAK_DIAN = "d4000000-0000-4000-8000-000000000011"; // Tax Manager, D1 JP007
  beforeEach(() => {
    views = seedCatalogSet(snapshot.reference.positions);
    catalogVersions = [...views.versions];
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); });

  it("saves the HR Manager's own Daily KPI on the D1 set (role 1011)", async () => {
    signIn("HR", MERCURY);
    const res = await call(daily.POST(post({ entryDate: "2026-11-24", lines: Array.from({ length: 5 }, () => ({ raw_score: 90, comment: "" })) })));
    expect(res.status).toBe(201);
    const saved = writes[0].args[0] as { roleOrder: number; lines: { kpi_name: string }[] };
    expect(saved.roleOrder).toBe(1011);
    expect(saved.lines.map((line) => line.kpi_name)).toEqual(["Time-to-Fill Vacancy", "Onboarding Completion", "Performance Evaluation Completion", "Training Completion Rate", "HR Administration SLA"]);
  });

  it("saves a Performance Review on the D1 set and refuses the position's old D4 role", async () => {
    const lines = indicatorsFor(catalogFor(views!, "2026-11")!, 1007).map((row) => ({
      indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: "", actual: "88", raw_score: 88, comment: "",
    }));
    const body = { employeeId: KAK_DIAN, roleOrder: 1007, period: "2026-11", evaluationDate: "2026-11-24", status: "completed", lines, generalNotes: "Uji", evidenceReference: "DOC-1",
      revisionOf: latestForPeriod(snapshot.kpiAssessments ?? [], KAK_DIAN, "2026-11")?.id ?? null };
    expect((await call(kpi.POST(post({ ...body, roleOrder: 10 })))).status).toBe(422);
    const res = await call(kpi.POST(post(body)));
    expect(res.status).toBe(201);
    expect((writes[0].args[0] as { roleOrder: number }).roleOrder).toBe(1007);
  });
});

describe("POST /period-reopenings (HR reopens an older period)", () => {
  const body = (patch: Record<string, unknown> = {}) => ({ period: "2026-09", openUntil: "2026-11-30", reason: "Penilaian terlambat", ...patch });
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-24T03:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("saves the reopening for HR", async () => {
    const res = await call(reopen.POST(post(body())));
    expect(res.status).toBe(201);
    expect(writes).toEqual([{ method: "savePeriodReopening", args: [body()] }]);
  });

  it.each([["MANAGER", BRAVO], ["EMPLOYEE", ALFA]] as const)("refuses %s", async (role, employee) => {
    signIn(role, employee);
    expect((await call(reopen.POST(post(body())))).status).toBe(403);
    expect(writes).toHaveLength(0);
  });

  it.each([
    ["last month, which is open anyway", { period: "2026-10" }, /terbuka dengan sendirinya/],
    ["a period before D4 starts", { period: "2026-08" }, /September 2026/],
    ["an end date before the period starts", { openUntil: "2026-08-31" }, /awal periode/],
    ["a reason under 5 characters", { reason: " ok " }, /5 sampai 500/],
  ])("rejects %s", async (_case, patch, message) => {
    const res = await call(reopen.POST(post(body(patch))));
    expect(res).toMatchObject({ status: 422, body: { error: { code: "VALIDATION_FAILED", message: expect.stringMatching(message) } } });
    expect(writes).toHaveLength(0);
  });

  it("accepts yesterday as the end date, which closes the period again", async () => {
    expect((await call(reopen.POST(post(body({ openUntil: "2026-11-23" }))))).status).toBe(201);
  });
});

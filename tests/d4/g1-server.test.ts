import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, field, handle } from "@/modules/d4/server/_lib/http";
import { createFixtureSource } from "@/modules/d4/web/data/fixture-source";
import type { D4LiveSnapshot } from "@/modules/d4/supabase/types";

describe("field.date", () => {
  it.each(["2026-10-45", "2026-02-29", "2026-13-01", "2026-04-31", "2026-00-10"])("refuses the impossible date %s with 422", async (value) => {
    expect(() => field.date({ date: value }, "date")).toThrow(ApiError);
    const res = await handle(async () => field.date({ date: value }, "date"));
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toMatch(/bukan tanggal yang valid/);
  });

  it.each(["2024-02-29", "2026-10-31", "2026-01-01"])("accepts the real date %s", (value) => {
    expect(field.date({ date: value }, "date")).toBe(value);
  });

  it("still allows an empty optional date", () => {
    expect(field.date({}, "date", { required: false })).toBe("");
  });
});

// The snapshot route over a mocked Supabase client whose repository ignores RLS and returns everyone's records.
let snapshot: D4LiveSnapshot;
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "a4000000-0000-4000-8000-000000000001" } }, error: null }) } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@/modules/d4/supabase/repository", () => ({
  SupabaseD4Repository: function SupabaseD4Repository() { return { loadSnapshot: async () => snapshot }; },
}));
const { GET } = await import("@/app/api/d4/snapshot/route");

describe("GET /api/d4/snapshot", () => {
  let all: D4LiveSnapshot;
  beforeAll(async () => { all = await createFixtureSource().loadSnapshot(); });
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  });
  const load = async () => (await (await GET()).json()).data as D4LiveSnapshot;
  const owners = (data: D4LiveSnapshot) => new Set([...data.kpi, ...data.performance, ...data.kpiAssessments ?? [], ...data.kpiDaily ?? [], ...data.competency, ...data.developmentVersions, ...data.trainingVersions].map((item) => item.employeeId));

  it("gives an EMPLOYEE only their own records even when the database returns more", async () => {
    const me = all.competency[0].employeeId;
    // Legacy employee_kpi rows of someone else, which the fixture itself does not have.
    snapshot = { ...all, role: "EMPLOYEE", actorEmployeeId: me, kpi: [...all.kpi, { id: "k1", employeeId: "someone-else", period: "2026-10", score: 4, notes: "", createdAt: "2026-10-01T00:00:00Z" }] };
    expect(owners(all).size).toBeGreaterThan(1);
    const data = await load();
    expect([...owners(data)]).toEqual([me]);
    expect(data.reference.employees.length).toBe(all.reference.employees.length);
  });

  it.each(["HR", "MANAGER", "MANAGEMENT"] as const)("leaves the %s snapshot as RLS returned it", async (role) => {
    snapshot = { ...all, role };
    expect(owners(await load())).toEqual(owners(all));
  });
});

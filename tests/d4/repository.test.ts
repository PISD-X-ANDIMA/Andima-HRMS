import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import { ApiError, databaseError } from "@/modules/d4/shared/errors";
import { compareCompetencies } from "@/modules/d4/competency/service";
import { SupabaseD4Repository } from "@/modules/d4/supabase/repository";
import type { EvaluationInput } from "@/modules/d4/performance/types";

// A minimal stand-in for the Supabase query builder; nothing reaches a real database.
type Result = { data: unknown; error: { message: string; code?: string } | null };
function fakeClient(results: Record<string, Result>) {
  const calls: string[] = [];
  let getUser = 0;
  const from = (table: string) => {
    let op = "select";
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder, limit: () => builder, single: () => builder, maybeSingle: () => builder,
      insert: () => { op = "insert"; return builder; },
      then: (resolve: (value: Result) => unknown) => {
        calls.push(`${table}:${op}`);
        return Promise.resolve(results[`${table}:${op}`] ?? { data: [], error: null }).then(resolve);
      },
    };
    return builder;
  };
  const client = { from, auth: { getUser: async () => { getUser += 1; return { data: { user: { id: "user" } }, error: null }; } } };
  return { client: client as unknown as SupabaseClient, calls, getUserCalls: () => getUser };
}

const reference = d4ReferenceFixture;
const withRequirements = reference.employees.find((item) => item.positionId && reference.positionRequirements.some((req) => req.positionId === item.positionId))!;
const competencyInput = { employeeId: withRequirements.id, positionId: withRequirements.positionId!, effectiveDate: "2026-10-03" };
const evaluation = (employeeId: string): EvaluationInput => ({
  employeeId, period: "2026-10", evaluationDate: "2026-10-03", evaluator: "Evaluator", status: "completed",
  reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Uji", evidenceReference: null,
});
const code = async (promise: Promise<unknown>) => promise.then(() => "OK", (error) => error instanceof ApiError ? error.code : "UNTYPED");

describe("duplicate and concurrent writes", () => {
  it("maps a unique violation on a revision insert to CONFLICT (409)", async () => {
    const { client } = fakeClient({
      "d4_training_versions:select": { data: { revision: 1 }, error: null },
      "d4_training_versions:insert": { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "x"' } },
    });
    const error = await new SupabaseD4Repository(client).updateTraining("t", "In Progress", "", "").catch((cause) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "CONFLICT", status: 409 });
    expect(error.message).toMatch(/Muat ulang/);
  });

  it("answers a re-sent identical snapshot (double click) with the stored one instead of a second row", async () => {
    const { findings, overallStatus } = compareCompetencies(competencyInput.employeeId, competencyInput.positionId, reference);
    const { client, calls } = fakeClient({ "d4_competency_assessments:select": { data: [{ id: "existing", overall_status: overallStatus, findings }], error: null } });
    expect(await new SupabaseD4Repository(client).saveCompetency(competencyInput, reference)).toBe("existing");
    expect(calls).not.toContain("d4_competency_assessments:insert");
  });

  it("still stores a changed snapshot on the same day", async () => {
    const { client, calls } = fakeClient({
      "d4_competency_assessments:select": { data: [{ id: "earlier", overall_status: "Gap", findings: [] }], error: null },
      "d4_competency_assessments:insert": { data: { id: "new" }, error: null },
    });
    expect(await new SupabaseD4Repository(client).saveCompetency(competencyInput, reference)).toBe("new");
    expect(calls).toContain("d4_competency_assessments:insert");
  });

  it("maps a database trigger exception (P0001) to VALIDATION_FAILED with its message", () => {
    const error = databaseError({ code: "P0001", message: "Skor indikator 2 harus antara 1 dan 5" }, "Simpan KPI");
    expect(error).toMatchObject({ code: "VALIDATION_FAILED", status: 422, message: "Skor indikator 2 harus antara 1 dan 5" });
  });

  it("stores the first competency snapshot", async () => {
    const { client, calls } = fakeClient({ "d4_competency_assessments:insert": { data: { id: "new" }, error: null } });
    expect(await new SupabaseD4Repository(client).saveCompetency(competencyInput, reference)).toBe("new");
    expect(calls).toContain("d4_competency_assessments:insert");
  });
});

describe("typed repository errors", () => {
  it("returns NOT_FOUND for an unknown employee", async () => {
    const { client } = fakeClient({});
    expect(await code(new SupabaseD4Repository(client).savePerformance(evaluation("00000000-0000-4000-8000-000000000000"), reference))).toBe("NOT_FOUND");
  });

  it("keeps the position message for an employee without a position", async () => {
    const { client } = fakeClient({});
    const employee = { ...reference.employees[0], id: "no-position", positionId: null };
    const error = await new SupabaseD4Repository(client).savePerformance(evaluation(employee.id), { ...reference, employees: [...reference.employees, employee] }).catch((cause) => cause);
    expect(error).toMatchObject({ code: "VALIDATION_FAILED", message: "Posisi employee tidak tersedia." });
  });

  it("maps an RLS denial to FORBIDDEN and leaves unknown database errors untyped", async () => {
    const denied = fakeClient({ "d4_development_need_versions:select": { data: null, error: { code: "42501", message: "permission denied for table x" } } });
    expect(await code(new SupabaseD4Repository(denied.client).updateDevelopment("n", "Planned", ""))).toBe("FORBIDDEN");
    const broken = fakeClient({ "d4_development_need_versions:select": { data: null, error: { code: "XX000", message: "internal" } } });
    expect(await code(new SupabaseD4Repository(broken.client).updateDevelopment("n", "Planned", ""))).toBe("UNTYPED");
  });
});

describe("auth.getUser per request", () => {
  it("is called once per repository, and not at all when the session already verified the user", async () => {
    const fresh = fakeClient({});
    const repository = new SupabaseD4Repository(fresh.client);
    await repository.loadReferenceData();
    await repository.loadReferenceData();
    expect(fresh.getUserCalls()).toBe(1);

    const verified = fakeClient({});
    await new SupabaseD4Repository(verified.client, { id: "user" } as never).loadReferenceData();
    expect(verified.getUserCalls()).toBe(0);
  });
});

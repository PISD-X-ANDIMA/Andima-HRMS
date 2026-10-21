import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { d4ReferenceFixture } from "@/modules/d4/shared/fixtures";
import { ApiError, databaseError } from "@/modules/d4/shared/errors";
import { compareCompetencies } from "@/modules/d4/competency/service";
import { SupabaseD4Repository } from "@/modules/d4/supabase/repository";
import type { EvaluationInput } from "@/modules/d4/performance/types";
import { REASSESSMENTS, type DevelopmentRevision } from "@/modules/d4/shared/rules";

// A minimal stand-in for the Supabase query builder; nothing reaches a real database.
type Result = { data: unknown; error: { message: string; code?: string } | null };
function fakeClient(results: Record<string, Result>) {
  const calls: string[] = [];
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  let getUser = 0;
  const from = (table: string) => {
    let op = "select";
    const builder = {
      select: () => builder, eq: () => builder, order: () => builder, limit: () => builder, range: () => builder, single: () => builder, maybeSingle: () => builder,
      insert: (payload: Record<string, unknown>) => { op = "insert"; inserts.push({ table, payload }); return builder; },
      then: (resolve: (value: Result) => unknown) => {
        calls.push(`${table}:${op}`);
        return Promise.resolve(results[`${table}:${op}`] ?? { data: [], error: null }).then(resolve);
      },
    };
    return builder;
  };
  const client = { from, auth: { getUser: async () => { getUser += 1; return { data: { user: { id: "user" } }, error: null }; } } };
  return { client: client as unknown as SupabaseClient, calls, inserts, getUserCalls: () => getUser };
}

const reference = d4ReferenceFixture;
const withRequirements = reference.employees.find((item) => item.positionId && reference.positionRequirements.some((req) => req.positionId === item.positionId))!;
const competencyInput = { employeeId: withRequirements.id, positionId: withRequirements.positionId!, effectiveDate: "2026-10-03" };
const evaluation = (employeeId: string): EvaluationInput => ({
  employeeId, period: "2026-10", evaluationDate: "2026-10-03", evaluator: "Evaluator", status: "completed",
  reviewStatus: "Needs Review", overallScore: 4, aspects: [], generalNotes: "Uji", evidenceReference: null,
});
const current = { priority: "Medium" as const, method: "Coaching", pic: "" };
const revision = (patch: Partial<DevelopmentRevision> = {}): DevelopmentRevision => ({ status: "Planned", notes: "", reassessment: null, ...current, ...patch });
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
    expect(error.message).toMatch(/Muat ulang halaman/);
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
    expect(error).toMatchObject({ code: "VALIDATION_FAILED", message: "Posisi pegawai tidak tersedia." });
  });

  it("maps an RLS denial to FORBIDDEN and leaves unknown database errors untyped", async () => {
    const denied = fakeClient({ "d4_development_need_versions:select": { data: null, error: { code: "42501", message: "permission denied for table x" } } });
    expect(await code(new SupabaseD4Repository(denied.client).updateDevelopment("n", revision(), current))).toBe("FORBIDDEN");
    const broken = fakeClient({ "d4_development_need_versions:select": { data: null, error: { code: "XX000", message: "internal" } } });
    expect(await code(new SupabaseD4Repository(broken.client).updateDevelopment("n", revision(), current))).toBe("UNTYPED");
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

// PostgREST caps a response at 1000 rows; the snapshot must page instead of silently dropping the rest.
describe("large tables", () => {
  it("reads every page of a table with more than 1000 rows", async () => {
    const employees = Array.from({ length: 2345 }, (_, i) => ({ id: `e${i}`, employee_id: `E${i}`, full_name: `Employee ${i}`, position_id: null, department_id: null }));
    const ranges: [number, number][] = [];
    const from = (table: string) => {
      let window: [number, number] = [0, 999];
      const builder = {
        select: () => builder, order: () => builder,
        range: (start: number, end: number) => { window = [start, end]; if (table === "d4_employee") ranges.push(window); return builder; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "d4_employee" ? employees.slice(window[0], window[1] + 1) : [], error: null }).then(resolve),
      };
      return builder;
    };
    const client = { from, auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) } } as unknown as SupabaseClient;
    const loaded = await new SupabaseD4Repository(client).loadReferenceData();
    expect(loaded.employees).toHaveLength(2345);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});


// Code ships before migration 20261019120000: the new columns are sent only when they carry a value.
describe("development revision and co-assessor columns", () => {
  const versionTable = { "d4_development_need_versions:select": { data: { revision: 2 }, error: null }, "d4_development_need_versions:insert": { data: { id: "v" }, error: null } };

  it("writes a status-only revision with the columns that exist before the migration", async () => {
    const { client, inserts } = fakeClient(versionTable);
    await new SupabaseD4Repository(client).updateDevelopment("n", revision({ status: "In Progress", notes: " Mulai " }), current);
    expect(inserts[0].payload).toEqual({ development_need_id: "n", revision: 3, status: "In Progress", notes: "Mulai" });
  });

  it("sends only the priority, method or PIC that changed, and a recorded reassessment", async () => {
    const { client, inserts } = fakeClient(versionTable);
    await new SupabaseD4Repository(client).updateDevelopment("n", revision({ priority: "High", pic: "Bu Maya" }), current);
    expect(inserts[0].payload).toMatchObject({ priority: "High", pic: "Bu Maya" });
    expect(inserts[0].payload).not.toHaveProperty("method");
    await new SupabaseD4Repository(client).updateDevelopment("n", revision({ status: "Completed", reassessment: "Meets requirement" }), current);
    expect(inserts[1].payload).toMatchObject({ status: "Completed", reassessment: "Meets requirement" });
    expect(inserts[1].payload).not.toHaveProperty("priority");
  });

  it("carries a changed PIC forward to later revisions that only change the status", async () => {
    const employee = reference.employees[0];
    const at = (n: number) => `2026-10-0${n}T08:00:00.000Z`;
    const { client } = fakeClient({
      "d4_user_access:select": { data: { app_role: "HR", employee_id: employee.id }, error: null },
      "d4_development_needs:select": { data: [{ id: "n", employee_id: employee.id, source_type: "competency_gap", position_requirement_id: "r", competency_assessment_id: null, performance_evaluation_id: null, objective: "Uji", priority: "Medium", method: "Training", pic: null }], error: null },
      "d4_development_need_versions:select": { data: [
        { id: "v4", development_need_id: "n", revision: 4, status: "In Progress", notes: "", actor_employee_id: employee.id, created_at: at(4) },
        { id: "v3", development_need_id: "n", revision: 3, status: "Planned", notes: "", pic: "Bu Maya", priority: "High", actor_employee_id: employee.id, created_at: at(3) },
        { id: "v2", development_need_id: "n", revision: 2, status: "Planned", notes: "", method: "", actor_employee_id: employee.id, created_at: at(2) },
        { id: "v1", development_need_id: "n", revision: 1, status: "Identified", notes: "", actor_employee_id: employee.id, created_at: at(1) },
      ], error: null },
    });
    const versions = (await new SupabaseD4Repository(client).loadSnapshot()).developmentVersions;
    expect(versions.map((item) => [item.revision, item.priority, item.method, item.pic])).toEqual([[4, "High", "", "Bu Maya"], [3, "High", "", "Bu Maya"], [2, "Medium", "", ""], [1, "Medium", "Training", ""]]);
  });

  it("stores assessed_with only when filled, and a different co-assessor the same day is a new snapshot", async () => {
    const { findings, overallStatus } = compareCompetencies(competencyInput.employeeId, competencyInput.positionId, reference);
    const stored = { "d4_competency_assessments:select": { data: [{ id: "existing", overall_status: overallStatus, findings, assessed_with: null }], error: null }, "d4_competency_assessments:insert": { data: { id: "new" }, error: null } };
    const plain = fakeClient(stored);
    expect(await new SupabaseD4Repository(plain.client).saveCompetency({ ...competencyInput, assessedWith: "  " }, reference)).toBe("existing");
    const withSupervisor = fakeClient(stored);
    expect(await new SupabaseD4Repository(withSupervisor.client).saveCompetency({ ...competencyInput, assessedWith: " Rina, Finance Manager " }, reference)).toBe("new");
    expect(withSupervisor.inserts[0].payload).toMatchObject({ assessed_with: "Rina, Finance Manager" });
    const first = fakeClient({ "d4_competency_assessments:insert": { data: { id: "new" }, error: null } });
    await new SupabaseD4Repository(first.client).saveCompetency(competencyInput, reference);
    expect(first.inserts[0].payload).not.toHaveProperty("assessed_with");
  });

  it("treats an empty co-assessor as no change against today's snapshot that names one, as the page does", async () => {
    const { findings, overallStatus } = compareCompetencies(competencyInput.employeeId, competencyInput.positionId, reference);
    const { client, calls } = fakeClient({ "d4_competency_assessments:select": { data: [{ id: "existing", overall_status: overallStatus, findings, assessed_with: "Rina" }], error: null } });
    expect(await new SupabaseD4Repository(client).saveCompetency({ ...competencyInput, assessedWith: "" }, reference)).toBe("existing");
    expect(calls).not.toContain("d4_competency_assessments:insert");
  });
});

describe("migration 20261019120000 (not applied yet)", () => {
  it("accepts every reassessment value the app sends, and fits the longest one in the column", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20261019120000_d4_development_edit_reassessment.sql", import.meta.url)), "utf8");
    const column = sql.match(/add column reassessment varchar\((\d+)\) check \(reassessment in \(([^)]*)\)\)/);
    expect(column).not.toBeNull();
    expect(column![2].split(",").map((item) => item.trim().replace(/^'|'$/g, ""))).toEqual([...REASSESSMENTS]);
    expect(Math.max(...REASSESSMENTS.map((item) => item.length))).toBeLessThanOrEqual(Number(column![1]));
    for (const value of REASSESSMENTS) expect(sql).toContain(`reassessment = '${value}' and status`);
  });
});

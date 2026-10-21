import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { developmentFixtureVersions } from "@/modules/d4/development/fixtures";
import { ApiError } from "@/modules/d4/shared/errors";
import { followUpOf } from "@/modules/d4/shared/rules";
import { FOLLOW_UP_NOT_READY, SupabaseD4Repository } from "@/modules/d4/supabase/repository";
import { latestTraining } from "@/modules/d4/supabase/types";
import { trainingFixtureVersions } from "@/modules/d4/training/fixtures";
import type { TrainingVersion } from "@/modules/d4/training/types";
import type { D4DataSource } from "@/modules/d4/web/data/source";
import { currentCompetencyStatus, type Snapshot } from "@/modules/d4/web/data/selectors";
import { dashboardAlerts, employeeHistory, type DashboardRow } from "@/modules/d4/web/features/dashboard/summary";
import { sourceOptions } from "@/modules/d4/web/features/development/DevelopmentModals";

// Q16 (20 Oct 2026): every training ends Passed or Not Passed; a Not Passed one needs HR's follow-up, Retraining or
// Other follow-up with a note, recorded insert-only. People are picked by id (Prompt 5 rule 3).
const ENA = "d4000000-0000-4000-8000-000000000016"; // FIX-D4-DEV-003 In Progress, FIX-D4-TRN-003 Completed Not Passed
const ALFA = "d4000000-0000-4000-8000-000000000009";

async function hrSource(): Promise<D4DataSource> {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource();
}
afterEach(() => { vi.unstubAllEnvs(); });

const notPassedAlert = (snapshot: Snapshot) => {
  const rows = snapshot.reference.employees.map((employee) => ({ employee, gap: currentCompetencyStatus(snapshot, employee) }));
  return dashboardAlerts(snapshot, rows).find((alert) => alert.key === "training-not-passed");
};
const enaName = (snapshot: Snapshot) => snapshot.reference.employees.find((item) => item.id === ENA)!.fullName;
const history = (snapshot: Snapshot, trainingId: string) => snapshot.trainingVersions.filter((item) => item.trainingId === trainingId);

describe("a completed training always has Passed or Not Passed (fixture)", () => {
  it("ships no completed fixture training without one", () => {
    const completed = trainingFixtureVersions.filter((item) => item.status === "Completed");
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.every((item) => item.result === "Passed" || item.result === "Not Passed")).toBe(true);
  });

  it.each([["no result", ""], ["a free-text result", "Lulus"]])("rejects a new Completed training with %s", async (_name, result) => {
    const source = await hrSource();
    await expect(source.createTraining({ employeeId: ALFA, developmentNeedId: "FIX-D4-DEV-001", activity: "X", date: "2026-10-01", status: "Completed", result, notes: "" }))
      .rejects.toThrow(/Passed atau Not Passed/);
  });
});

describe("follow-up of a Not Passed training", () => {
  it("reads the follow-up of the current Not Passed result from the history", () => {
    const version = (revision: number, patch: Partial<TrainingVersion>) => ({ revision, status: "Completed" as const, result: "Not Passed", followUp: null, ...patch });
    expect(followUpOf([version(1, {})])).toBeNull();
    expect(followUpOf([version(1, {}), version(2, { followUp: "Retraining" })])).toBe("Retraining");
    // A later notes-only version keeps it; a new result needs a new follow-up.
    expect(followUpOf([version(1, {}), version(2, { followUp: "Other follow-up" }), version(3, {})])).toBe("Other follow-up");
    expect(followUpOf([version(1, { followUp: "Retraining" }), version(2, { status: "In Progress", result: "" }), version(3, {})])).toBeNull();
  });

  it("Mba Ena: the alert waits for a follow-up; Retraining creates the next training and clears it", async () => {
    const source = await hrSource();
    const before = await source.loadSnapshot();
    const alert = notPassedAlert(before);
    expect(alert?.people).toEqual([enaName(before)]);
    expect(alert?.label).toBe("Awaiting follow-up");

    const id = await source.recordTrainingFollowUp("FIX-D4-TRN-003", { followUp: "Retraining", notes: "Jadwal ulang dengan trainer lain", activity: "Records Retention Workshop (ulang)", date: "2026-10-27" });
    const after = await source.loadSnapshot();
    const retraining = latestTraining(after).find((item) => item.trainingId === id)!;
    expect(retraining).toMatchObject({ employeeId: ENA, developmentNeedId: "FIX-D4-DEV-003", activity: "Records Retention Workshop (ulang)", date: "2026-10-27", status: "Planned", result: "", revision: 1 });
    expect(retraining.notes).toMatch(/^Retraining setelah "Records Retention Workshop" \(2026-10-06\) Not Passed\.\nJadwal ulang/);
    // Insert-only: the Not Passed version stays; the follow-up is a new version with the same status and result.
    const versions = history(after, "FIX-D4-TRN-003").sort((a, b) => a.revision - b.revision);
    expect(versions.map((item) => [item.revision, item.status, item.result, item.followUp ?? null])).toEqual([[1, "Completed", "Not Passed", null], [2, "Completed", "Not Passed", "Retraining"]]);
    expect(notPassedAlert(after)).toBeUndefined();
    // The employee history shows the follow-up and the new training.
    const titles = employeeHistory(after, ENA).filter((item) => item.kind === "training").map((item) => `${item.title} | ${item.body ?? ""}`);
    expect(titles.some((item) => item.includes("Records Retention Workshop (ulang)"))).toBe(true);
    expect(titles.some((item) => item.includes("Follow-up: Retraining"))).toBe(true);
    // Recorded once.
    await expect(source.recordTrainingFollowUp("FIX-D4-TRN-003", { followUp: "Other follow-up", notes: "Coaching" })).rejects.toThrow(/sudah dicatat/);
  });

  it("Mba Ena: Other follow-up requires a note, then clears the alert without a new training", async () => {
    const source = await hrSource();
    await expect(source.recordTrainingFollowUp("FIX-D4-TRN-003", { followUp: "Other follow-up", notes: "  " })).rejects.toThrow(/Catatan wajib diisi/);
    expect(await source.recordTrainingFollowUp("FIX-D4-TRN-003", { followUp: "Other follow-up", notes: "Coaching oleh manajer akuntansi" })).toBeNull();
    const after = await source.loadSnapshot();
    expect(after.trainingVersions.filter((item) => item.developmentNeedId === "FIX-D4-DEV-003" && item.revision === 1)).toHaveLength(1);
    expect(followUpOf(history(after, "FIX-D4-TRN-003"))).toBe("Other follow-up");
    expect(notPassedAlert(after)).toBeUndefined();
  });

  it("rejects a follow-up for a training that is not Not Passed, and an unknown training", async () => {
    const source = await hrSource();
    await expect(source.recordTrainingFollowUp("FIX-D4-TRN-001", { followUp: "Other follow-up", notes: "x" })).rejects.toThrow(/hasil Not Passed/);
    await expect(source.recordTrainingFollowUp("NOPE", { followUp: "Other follow-up", notes: "x" })).rejects.toThrow(/tidak ditemukan/);
  });

  it("a plain progress update after the follow-up does not copy it to the new version", async () => {
    const source = await hrSource();
    await source.recordTrainingFollowUp("FIX-D4-TRN-003", { followUp: "Other follow-up", notes: "Rotasi" });
    await source.updateTraining("FIX-D4-TRN-003", "Completed", "Passed", "Lulus setelah coaching");
    const latest = latestTraining(await source.loadSnapshot()).find((item) => item.trainingId === "FIX-D4-TRN-003")!;
    expect(latest.followUp).toBeNull();
  });
});

// Code ships before migration 20261020130000: the training history is read with "*", and saving a follow-up without
// the column answers a clear message instead of a 500, with nothing written.
describe("follow-up storage in Supabase", () => {
  type Result = { data: unknown; error: { message: string; code?: string } | null };
  function fakeClient(results: Record<string, Result>) {
    const inserts: Record<string, unknown>[] = [];
    const rpcs: { name: string; args: Record<string, unknown> }[] = [];
    const selects: string[] = [];
    const from = (table: string) => {
      let op = "select";
      const builder = {
        select: (columns?: string) => { if (op === "select") selects.push(`${table}:${columns}`); return builder; },
        eq: () => builder, order: () => builder, limit: () => builder, range: () => builder, single: () => builder, maybeSingle: () => builder,
        insert: (payload: Record<string, unknown>) => { op = "insert"; inserts.push(payload); return builder; },
        then: (resolve: (value: Result) => unknown) => Promise.resolve(results[`${table}:${op}`] ?? { data: [], error: null }).then(resolve),
      };
      return builder;
    };
    const rpc = async (name: string, args: Record<string, unknown>) => { rpcs.push({ name, args }); return results[`rpc:${name}`] ?? { data: "new-training", error: null }; };
    const client = { from, rpc, auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) } };
    return { client: client as unknown as SupabaseClient, inserts, rpcs, selects };
  }
  const previous = { ...trainingFixtureVersions[2], trainingId: "t" };
  const snapshot = { trainingVersions: [previous], developmentVersions: developmentFixtureVersions } as unknown as Snapshot;
  const latestRevision = { "d4_training_versions:select": { data: { revision: 1 }, error: null } };

  it("rejects before the migration with a clear message and writes no training", async () => {
    const { client, rpcs } = fakeClient({ ...latestRevision, "d4_training_versions:insert": { data: null, error: { code: "PGRST204", message: "Could not find the 'follow_up' column of 'd4_training_versions' in the schema cache" } } });
    const error = await new SupabaseD4Repository(client).recordTrainingFollowUp("t", { followUp: "Retraining", notes: "", activity: "Ulang", date: "2026-10-27" }, snapshot).catch((cause) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "CONFIGURATION_ERROR", message: FOLLOW_UP_NOT_READY });
    expect(error.status).not.toBe(500);
    expect(rpcs).toHaveLength(0);
  });

  it("after the migration inserts the follow-up version, then creates the Planned retraining", async () => {
    const { client, inserts, rpcs } = fakeClient({ ...latestRevision, "d4_training_versions:insert": { data: { id: "v2" }, error: null } });
    const id = await new SupabaseD4Repository(client).recordTrainingFollowUp("t", { followUp: "Retraining", notes: " Ulang ", activity: "Ulang", date: "2026-10-27" }, snapshot);
    expect(inserts).toEqual([{ training_id: "t", revision: 2, status: "Completed", result: "Not Passed", notes: "Ulang", follow_up: "Retraining" }]);
    expect(rpcs).toEqual([{ name: "d4_create_training_record", args: expect.objectContaining({ p_employee_id: ENA, p_development_need_id: "FIX-D4-DEV-003", p_activity: "Ulang", p_activity_date: "2026-10-27", p_status: "Planned", p_result: "" }) }]);
    expect(id).toBe("new-training");
  });

  it("Other follow-up writes only the version", async () => {
    const { client, inserts, rpcs } = fakeClient({ ...latestRevision, "d4_training_versions:insert": { data: { id: "v2" }, error: null } });
    expect(await new SupabaseD4Repository(client).recordTrainingFollowUp("t", { followUp: "Other follow-up", notes: "Coaching" }, snapshot)).toBeNull();
    expect(inserts[0]).toMatchObject({ follow_up: "Other follow-up", notes: "Coaching" });
    expect(rpcs).toHaveLength(0);
  });

  it("reads training versions with every column, so the snapshot loads before and after the migration", async () => {
    const at = "2026-10-07T09:00:00+00:00";
    const { client, selects } = fakeClient({
      "d4_user_access:select": { data: { app_role: "HR", employee_id: ENA }, error: null },
      "d4_training_records:select": { data: [{ id: "t", employee_id: ENA, development_need_id: "n", activity: "Workshop", activity_date: "2026-10-06" }], error: null },
      "d4_training_versions:select": { data: [
        { id: "v2", training_id: "t", revision: 2, status: "Completed", result: "Not Passed", notes: "Coaching", follow_up: "Other follow-up", actor_employee_id: ENA, created_at: at },
        { id: "v1", training_id: "t", revision: 1, status: "Completed", result: "Not Passed", notes: "", actor_employee_id: ENA, created_at: at },
      ], error: null },
    });
    const loaded = await new SupabaseD4Repository(client).loadSnapshot();
    expect(selects).toContain("d4_training_versions:*");
    expect(loaded.trainingVersions.map((item) => [item.revision, item.followUp])).toEqual([[2, "Other follow-up"], [1, null]]);
  });
});

describe("Under Performance: assign training from the alert (Q16)", () => {
  it("lists each employee with the scorecard the training requirement is raised from, a valid performance source", async () => {
    const source = await hrSource();
    const base = await source.loadSnapshot();
    // V6 (1–100) starts Nov 2026; the fixture has none, so one under 80 is added here.
    const september = base.kpiAssessments!.find((item) => item.employeeId === ALFA)!;
    const low = { ...september, id: "T-KPI-UNDER", definitionVersion: "V6", period: "2026-11", overallScore: 72.5 };
    const snapshot: Snapshot = { ...base, kpiAssessments: [low, ...base.kpiAssessments!] };
    const rows: DashboardRow[] = snapshot.reference.employees.map((employee) => ({ employee, gap: currentCompetencyStatus(snapshot, employee), scorecard: employee.id === ALFA ? low : undefined }));
    const alert = dashboardAlerts(snapshot, rows).find((item) => item.key === "under-performance")!;
    expect(alert.assign).toEqual([{ employeeId: ALFA, name: snapshot.reference.employees.find((item) => item.id === ALFA)!.fullName, scorecardId: "T-KPI-UNDER" }]);
    // DevelopmentFormModal preselects sourceRef only when it is one of its performance_context options.
    expect(sourceOptions(snapshot, ALFA, "performance_context").map((item) => item.ref)).toContain("T-KPI-UNDER");
    // Average or unrated rows get no action.
    const average = rows.map((row) => row.employee.id === ALFA ? { ...row, scorecard: { ...low, overallScore: 80 } } : row);
    expect(dashboardAlerts(snapshot, average).find((item) => item.key === "under-performance")).toBeUndefined();
  });

  it("the fixture source saves the requirement the form submits for that scorecard", async () => {
    const source = await hrSource();
    const scorecard = (await source.loadSnapshot()).kpiAssessments!.find((item) => item.employeeId === ALFA && item.status === "completed")!;
    const needId = await source.createDevelopment({ employeeId: ALFA, sourceType: "performance_context", sourceRef: scorecard.id, objective: "Naikkan skor KPI", priority: "High", notes: "" });
    expect((await source.loadSnapshot()).developmentVersions.find((item) => item.needId === needId)).toMatchObject({ sourceType: "performance_context", sourceRef: scorecard.id, status: "Identified" });
  });
});

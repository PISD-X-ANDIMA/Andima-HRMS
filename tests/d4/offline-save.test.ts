import { createElement, type ComponentProps } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiSource, D4RequestError } from "@/modules/d4/web/data/api-source";
import { D4DataProvider, useD4 } from "@/modules/d4/web/data/D4DataProvider";
import type { D4DataSource, DevelopmentDraft, EvaluationDraft, KpiAssessmentDraft, TrainingDraft } from "@/modules/d4/web/data/source";

// QA "Penyimpanan Gagal / Network Failure" (TC-D4-UIQ-06, TC-D4-008-17): DevTools → Offline, click save, expect the
// toast below and nothing saved; back online, the same save goes through. fetch rejecting is what Offline does.
const OFFLINE = "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

// Only the request matters here, not the field values.
const kpi = { employeeId: "e1", period: "2026-11" } as KpiAssessmentDraft;
const development = { employeeId: "e1", objective: "Objective" } as DevelopmentDraft;
const training = { employeeId: "e1", developmentNeedId: "n1", activity: "Training" } as TrainingDraft;

// Every write the D4 screens send through run(), named by feature and button.
const uiWrites: [string, (source: D4DataSource) => Promise<unknown>][] = [
  ["Performance Review: Add Performance Review → Simpan", (source) => source.createKpiAssessment(kpi)],
  ["Performance Review: Finalize from Daily KPI → Finalize", (source) => source.createKpiAssessment({ ...kpi, evidenceReference: "DOC-1" })],
  ["Daily KPI: Save / Save correction", (source) => source.createDailyKpi({ entryDate: "2026-11-10", lines: [] })],
  ["Competency Gap: Save Assessment", (source) => source.saveCompetency({ employeeId: "e1", positionId: "p1", effectiveDate: "2026-11-10" })],
  ["Competency Gap: Assess Position Change → Save Assessment", (source) => source.saveCompetency({ employeeId: "e1", positionId: "p2", effectiveDate: "2026-11-10", assessedWith: "Atasan" })],
  ["Development: Add Requirement → Save Requirement", (source) => source.createDevelopment(development)],
  ["Development: Close as Met → Close Requirement", (source) => source.closeDevelopment("n1")],
  ["Development: Edit Requirement → Save Changes", (source) => source.updateDevelopment("n1", "Planned", "", { priority: "High", method: "Coaching", pic: "HR" })],
  ["Training: Create Training → Save Training", (source) => source.createTraining(training)],
  ["Training: Update Progress → Save Progress", (source) => source.updateTraining("t1", "In Progress", "", "")],
  ["Training: Update Progress → Completed + Not Passed follow-up → Save Progress", (source) => source.completeTraining("t1", { result: "Not Passed", decision: "Other follow-up", notes: "Coaching" })],
  ["Training: Update Progress → Completed + Passed reassessment → Save Progress", (source) => source.completeTraining("t1", { result: "Passed", decision: "Retraining", notes: "", activity: "Ulang", date: "2026-11-20" })],
];

const offline = () => vi.fn<typeof fetch>(async () => { throw new TypeError("Failed to fetch"); });
const online = () => vi.fn<typeof fetch>(async () => Response.json({ data: { id: "saved-id", retrainingId: null } }));

afterEach(() => { vi.unstubAllGlobals(); });

describe("apiSource while offline", () => {
  const reads: [string, (source: D4DataSource) => Promise<unknown>][] = [
    ["loadSnapshot", (source) => source.loadSnapshot()],
    ["loadKpiCatalog", (source) => source.loadKpiCatalog()],
  ];
  // createEvaluation has no button in the UI (Performance Review saves through createKpiAssessment); covered for the API.
  const all = [...uiWrites, ["createEvaluation (no UI caller)", (source) => source.createEvaluation({ employeeId: "e1" } as EvaluationDraft)], ...reads] as typeof uiWrites;

  it.each(all)("%s rejects with NETWORK_ERROR and the offline message", async (_name, call) => {
    vi.stubGlobal("fetch", offline());
    const error = await call(apiSource).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(D4RequestError);
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR", message: OFFLINE });
  });

  it.each(uiWrites)("%s goes through again once back online", async (_name, call) => {
    vi.stubGlobal("fetch", online());
    await expect(call(apiSource)).resolves.not.toThrow();
  });
});

describe("D4DataProvider.run while offline", () => {
  // No DOM in this suite: the provider is rendered once on the server only to get its run(). State updates after that
  // render are ignored, so the toast list itself is not observable here; run() returns the same message it toasts.
  function renderRun() {
    const probe: { run?: ReturnType<typeof useD4>["run"] } = {};
    function Probe() { probe.run = useD4().run; return null; }
    renderToString(createElement(D4DataProvider, { mode: "live" } as ComponentProps<typeof D4DataProvider>, createElement(Probe)));
    return probe.run!;
  }

  beforeEach(() => { vi.useFakeTimers(); }); // the toast's 4 s auto-dismiss timer
  afterEach(() => { vi.useRealTimers(); });

  it.each(uiWrites)("%s: reports the offline message, refreshes nothing, and saves on retry", async (_name, call) => {
    const run = renderRun();
    const fetchOffline = offline();
    vi.stubGlobal("fetch", fetchOffline);
    const failed = await run(call, "Tersimpan.");
    expect(failed).toEqual({ ok: false, error: OFFLINE });
    // Only the write was attempted: no snapshot reload, so the list and table keep showing the old data.
    expect(fetchOffline).toHaveBeenCalledTimes(1);
    expect(fetchOffline.mock.calls[0][1]?.method).toBe("POST");

    // Back to "No throttling": the same save is not blocked by the failed one and refreshes the snapshot.
    const fetchOnline = online();
    vi.stubGlobal("fetch", fetchOnline);
    const saved = await run(call, "Tersimpan.");
    expect(saved.ok).toBe(true);
    expect(fetchOnline.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url)}`).at(-1)).toBe("GET /api/d4/snapshot");
  });

  // A newer revision was saved in another tab or device: the 409 reloads the snapshot so the form points at it.
  it("reloads the data after a 409 and says so", async () => {
    const run = renderRun();
    const stale = "Sudah ada revisi Scorecard yang lebih baru untuk periode ini sejak form dibuka.";
    const fetchConflict = vi.fn<typeof fetch>(async (_url, init) => init?.method === "POST"
      ? Response.json({ error: { code: "CONFLICT", message: stale } }, { status: 409 })
      : Response.json({ data: {} }));
    vi.stubGlobal("fetch", fetchConflict);
    const failed = await run((source) => source.createKpiAssessment({ ...kpi, revisionOf: "old" }), "Tersimpan.");
    expect(failed).toEqual({ ok: false, error: `${stale} Data terbaru sudah dimuat; periksa lalu simpan lagi.` });
    expect(fetchConflict.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${String(url)}`)).toEqual(["POST /api/d4/kpi-assessments", "GET /api/d4/snapshot"]);
  });
});

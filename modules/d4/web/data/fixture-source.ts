import { compareCompetencies } from "../../competency/service";
import { developmentFixtureVersions } from "../../development/fixtures";
import { indicatorsFor, KPI_V51_CATALOG, roleForPositionTitle, selectCatalog } from "../../kpi/catalog";
import { performanceFixtureRecords } from "../../performance/fixtures";
import { validatePerformanceInput } from "../../performance/validation";
import { d4ReferenceFixture } from "../../shared/fixtures";
import { assertDevelopmentChange, assertNeedOpen, assertNoOpenNeed, assertNotSelf, assertPeriodRevision, assertRevisionReason, assertTrainingChange, assertTrainingDate, isTeamMember } from "../../shared/rules";
import type { D4LiveSnapshot, KpiAssessment, KpiAssessmentLine } from "../../supabase/types";
import { latestDevelopment, latestTraining } from "../../supabase/types";
import { trainingFixtureVersions } from "../../training/fixtures";
import type { D4DataSource } from "./source";

// Local preview (NEXT_PUBLIC_D4_DATA_MODE=fixture in development) and the public demo. All people and
// records are fictional; fixture writes live in memory and disappear on reload, demo writes persist in the browser. The rules below
// mirror the server so the UI behaves the same as in live mode.
const HR_ACTOR = "d4000000-0000-4000-8000-000000000012";
const ALFA = "d4000000-0000-4000-8000-000000000009";
// Echo (Finance) previews the manager view; the team is the rest of Finance (Alfa, Holly).
const ECHO = "d4000000-0000-4000-8000-000000000014";
// NEXT_PUBLIC_D4_FIXTURE_ROLE=EMPLOYEE previews the self-service view as Alfa (read-only).
const FIXTURE_ROLE = process.env.NEXT_PUBLIC_D4_FIXTURE_ROLE === "EMPLOYEE" ? "EMPLOYEE" : process.env.NEXT_PUBLIC_D4_FIXTURE_ROLE === "MANAGER" ? "MANAGER" : "HR";
const catalog = selectCatalog(KPI_V51_CATALOG);

function kpiLines(roleOrder: number, scores: (number | null)[], actual: string[]): KpiAssessmentLine[] {
  return indicatorsFor(catalog, roleOrder).map((row, index) => ({
    indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent,
    target: "Sesuai target periode", actual: actual[index] ?? "", raw_score: scores[index] ?? null, comment: "",
  }));
}

function total(lines: readonly KpiAssessmentLine[]): number | null {
  if (lines.some((line) => line.raw_score === null)) return null;
  return Math.round(lines.reduce((sum, line) => sum + line.weight_percent * (line.raw_score ?? 0) / 100, 0) * 100) / 100;
}

function assessment(id: string, employeeId: string, roleOrder: number, period: string, scores: (number | null)[], status: "draft" | "completed"): KpiAssessment {
  const lines = kpiLines(roleOrder, scores, ["98% SLA", "100% akurat", "H+1", "Piutang 6%", "Zero denda"]);
  return {
    id, definitionVersion: catalog.version, employeeId, roleOrder, roleName: indicatorsFor(catalog, roleOrder)[0].role_name,
    period, evaluationDate: `${period}-25`, evaluatorName: "Mercury", status, lines, overallScore: total(lines),
    generalNotes: status === "completed" ? "Contoh scorecard fixture untuk pratinjau lokal." : "", createdAt: `${period}-25T08:00:00.000Z`, actor: "Mercury",
  };
}

function initialSnapshot(): D4LiveSnapshot {
  const alfa = ALFA;
  const finance = "d4000000-0000-4000-8000-000000000008";
  const comparison = compareCompetencies(alfa, finance, d4ReferenceFixture);
  return {
    reference: d4ReferenceFixture,
    role: FIXTURE_ROLE,
    actorEmployeeId: FIXTURE_ROLE === "EMPLOYEE" ? ALFA : FIXTURE_ROLE === "MANAGER" ? ECHO : HR_ACTOR,
    kpi: [],
    kpiAssessments: [
      assessment("FIX-D4-KPI-001", alfa, 10, "2026-09", [4, 5, 4, 3, 4], "completed"),
      assessment("FIX-D4-KPI-002", alfa, 10, "2026-06", [3, 4, 4, 3, 3], "completed"),
    ],
    performance: performanceFixtureRecords,
    competency: [{
      id: "FIX-D4-COMP-ASSESS-001", source: "local-demo", employeeId: alfa, positionId: finance, effectiveDate: "2026-09-21",
      context: "current-position", findings: comparison.findings, overallStatus: comparison.overallStatus,
      createdAt: "2026-09-21T09:00:00.000Z", actor: "Mercury",
    }],
    developmentVersions: developmentFixtureVersions,
    trainingVersions: trainingFixtureVersions,
  };
}

/** What RLS returns to an employee: only their own records, so detail URLs of others show NotFound. */
function ownRecords(snapshot: D4LiveSnapshot): D4LiveSnapshot {
  return recordsOf(snapshot, (employeeId) => employeeId === snapshot.actorEmployeeId);
}

/** A manager's view: records of their team only (reference data stays whole so names still resolve). */
function teamRecords(snapshot: D4LiveSnapshot): D4LiveSnapshot {
  const team = new Set(snapshot.reference.employees.filter((item) => isTeamMember(actorOf(snapshot), item)).map((item) => item.id));
  return recordsOf(snapshot, (employeeId) => team.has(employeeId));
}

const actorOf = (snapshot: D4LiveSnapshot) => snapshot.reference.employees.find((item) => item.id === snapshot.actorEmployeeId);

function recordsOf(snapshot: D4LiveSnapshot, keep: (employeeId: string) => boolean): D4LiveSnapshot {
  const own = <T extends { employeeId: string }>(items: readonly T[]) => items.filter((item) => keep(item.employeeId));
  return {
    ...snapshot, performance: own(snapshot.performance), kpiAssessments: own(snapshot.kpiAssessments ?? []), competency: own(snapshot.competency),
    developmentVersions: own(snapshot.developmentVersions), trainingVersions: own(snapshot.trainingVersions),
  };
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));

export function createFixtureSource(): D4DataSource {
  return createLocalSource({ mode: "fixture", initial: initialSnapshot() });
}

/**
 * In-browser data source shared by the local fixture preview and the public demo. It applies the same
 * rules as the API handlers; `persist` (demo only) is called after every write so the state survives reloads.
 */
export function createLocalSource({ mode, initial, persist }: { mode: "fixture" | "demo"; initial: D4LiveSnapshot; persist?: (state: D4LiveSnapshot) => void }): D4DataSource {
  let state = initial;
  const update = (patch: Partial<D4LiveSnapshot>) => { state = { ...state, ...patch }; persist?.(state); };
  const assertWriter = () => { if (state.role === "EMPLOYEE") throw new Error("Hanya HR atau Manager yang dapat menyimpan perubahan."); };
  // Managers write only for their own team; HR for everyone. Self-records are caught by assertNotSelf first.
  const assertTeam = (employeeId: string) => {
    if (state.role !== "MANAGER" || employeeId === state.actorEmployeeId) return;
    if (!isTeamMember(actorOf(state), state.reference.employees.find((item) => item.id === employeeId))) throw new Error("Manager hanya dapat mengelola data anggota tim di departemennya sendiri.");
  };
  // The evaluator is always the signed-in actor, never a free-text value from the form.
  const actorName = () => state.reference.employees.find((item) => item.id === state.actorEmployeeId)?.fullName ?? "HR";
  return {
    mode,
    async loadSnapshot() { await delay(); return state.role === "EMPLOYEE" ? ownRecords(state) : state.role === "MANAGER" ? teamRecords(state) : state; },
    async loadKpiCatalog() { return catalog; },
    async createEvaluation({ revisionOf, ...draft }) {
      assertWriter();
      const input = { ...draft, evaluator: actorName() };
      validatePerformanceInput(input);
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      assertTeam(input.employeeId);
      assertPeriodRevision(state.performance, input.employeeId, input.period, revisionOf, "Evaluasi");
      assertRevisionReason(revisionOf, input.generalNotes);
      const id = newId("FIX-D4-PERF");
      update({ performance: [{ ...input, id, source: "local-demo", createdAt: now(), actor: actorName() }, ...state.performance] });
      return id;
    },
    async createKpiAssessment({ revisionOf, ...draft }) {
      assertWriter();
      const input = { ...draft, evaluatorName: actorName() };
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      assertTeam(input.employeeId);
      assertPeriodRevision(state.kpiAssessments ?? [], input.employeeId, input.period, revisionOf, "Scorecard");
      assertRevisionReason(revisionOf, input.generalNotes);
      const indicators = indicatorsFor(catalog, input.roleOrder);
      if (indicators.length !== 5) throw new Error("Jabatan KPI tidak ditemukan pada katalog.");
      const employee = state.reference.employees.find((item) => item.id === input.employeeId);
      const positionTitle = state.reference.positions.find((item) => item.id === employee?.positionId)?.title;
      if (roleForPositionTitle(catalog, positionTitle) !== input.roleOrder) throw new Error("KPI yang dipilih bukan KPI untuk position employee ini.");
      if (input.status === "completed" && input.lines.some((line) => line.raw_score === null)) throw new Error("Seluruh lima indikator harus dinilai sebelum diselesaikan.");
      const id = newId("FIX-D4-KPI");
      update({ kpiAssessments: [{ ...input, id, definitionVersion: catalog.version, roleName: indicators[0].role_name, overallScore: total(input.lines), createdAt: now(), actor: actorName() }, ...(state.kpiAssessments ?? [])] });
      return id;
    },
    async saveCompetency(input) {
      assertWriter();
      const employee = state.reference.employees.find((item) => item.id === input.employeeId);
      if (!employee) throw new Error("Employee tidak ditemukan.");
      assertTeam(input.employeeId);
      const comparison = compareCompetencies(input.employeeId, input.positionId, state.reference);
      if (!comparison.findings.length) throw new Error("Persyaratan kompetensi posisi belum tersedia.");
      const id = newId("FIX-D4-COMP");
      update({ competency: [{ id, source: "local-demo", employeeId: input.employeeId, positionId: input.positionId, effectiveDate: input.effectiveDate, context: employee.positionId === input.positionId ? "current-position" : "role-change", findings: comparison.findings, overallStatus: comparison.overallStatus, createdAt: now(), actor: actorName() }, ...state.competency] });
      return id;
    },
    async createDevelopment(input) {
      assertWriter();
      if (!input.objective.trim()) throw new Error("Development objective wajib diisi.");
      if (!input.sourceRef) throw new Error("Referensi sumber wajib dipilih.");
      assertNotSelf(state.actorEmployeeId, input.employeeId, "Development requirement");
      assertTeam(input.employeeId);
      assertNoOpenNeed(latestDevelopment(state), input.employeeId, input.sourceType, input.sourceRef);
      const needId = newId("FIX-D4-DEV");
      update({ developmentVersions: [{ ...input, id: newId("FIX-D4-DEV-V"), needId, revision: 1, source: "local-demo", status: "Identified", createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
      return needId;
    },
    async updateDevelopment(needId, status, notes) {
      assertWriter();
      const current = latestDevelopment(state).find((item) => item.needId === needId);
      if (!current) throw new Error("Development need tidak ditemukan.");
      assertTeam(current.employeeId);
      assertDevelopmentChange(current.status, status, notes);
      update({ developmentVersions: [{ ...current, id: newId("FIX-D4-DEV-V"), revision: current.revision + 1, status, notes, createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
    },
    async createTraining(input) {
      assertWriter();
      assertNotSelf(state.actorEmployeeId, input.employeeId, "Training");
      const need = latestDevelopment(state).find((item) => item.needId === input.developmentNeedId);
      if (!need || need.employeeId !== input.employeeId) throw new Error("Training harus mengacu pada development need milik employee yang sama.");
      assertTeam(input.employeeId);
      assertNeedOpen(need);
      if (input.status === "Completed" && !input.result.trim()) throw new Error("Hasil wajib diisi saat training selesai.");
      assertTrainingDate(input.status, input.date);
      const trainingId = newId("FIX-D4-TRN");
      update({ trainingVersions: [{ ...input, id: newId("FIX-D4-TRN-V"), trainingId, revision: 1, source: "local-demo", createdAt: now(), actor: actorName() }, ...state.trainingVersions] });
      return trainingId;
    },
    async updateTraining(trainingId, status, result, notes) {
      assertWriter();
      const current = latestTraining(state).find((item) => item.trainingId === trainingId);
      if (!current) throw new Error("Training tidak ditemukan.");
      assertTeam(current.employeeId);
      if (status === "Completed" && !result.trim()) throw new Error("Hasil wajib diisi saat training selesai.");
      assertTrainingDate(status, current.date);
      assertTrainingChange(current.status, status, notes);
      update({ trainingVersions: [{ ...current, id: newId("FIX-D4-TRN-V"), revision: current.revision + 1, status, result, notes, createdAt: now(), actor: actorName() }, ...state.trainingVersions] });
    },
  };
}

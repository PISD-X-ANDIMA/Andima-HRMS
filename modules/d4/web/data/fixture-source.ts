import { compareCompetencies } from "../../competency/service";
import { developmentFixtureVersions } from "../../development/fixtures";
import { catalogFor, indicatorsFor, KPI_V51_CATALOG, roleForPosition, seedCatalogSet, targetOf } from "../../kpi/catalog";
import { scaleMaxOf } from "../../kpi/scale";
import { performanceFixtureRecords } from "../../performance/fixtures";
import { validatePerformanceInput } from "../../performance/validation";
import { d4ReferenceFixture } from "../../shared/fixtures";
import { assertGapAssessed, assertTrainingDate, assertNeedOpen, assertNoOpenNeed, assertTrainingResult, assertNotFutureDate, assertEvaluationInPeriod, assertNotSelf, assertPeriodRevision, assertRevisionReason, assertTrainingChange, assertTrainingFollowUp, isTeamMember, nextDevelopmentRevision, retrainingNotes } from "../../shared/rules";
import type { D4LiveSnapshot, KpiAssessment, KpiAssessmentLine } from "../../supabase/types";
import { latestDevelopment, latestTraining } from "../../supabase/types";
import { trainingFixtureVersions } from "../../training/fixtures";
import type { D4DataSource } from "./source";

// Local preview (NEXT_PUBLIC_D4_DATA_MODE=fixture in development) and the public demo. All people and
// records are fictional; fixture writes live in memory and disappear on reload, demo writes persist in the browser. The rules below
// mirror the server so the UI behaves the same as in live mode.
const HR_ACTOR = "d4000000-0000-4000-8000-000000000012";
const ALFA = "d4000000-0000-4000-8000-000000000009";
// Desty (Finance) previews the manager view; the team is the rest of Finance.
const ECHO = "d4000000-0000-4000-8000-000000000014";
// NEXT_PUBLIC_D4_FIXTURE_ROLE=EMPLOYEE previews the self-service view as Kak Ismi (read-only).
const FIXTURE_ROLE = process.env.NEXT_PUBLIC_D4_FIXTURE_ROLE === "EMPLOYEE" ? "EMPLOYEE" : process.env.NEXT_PUBLIC_D4_FIXTURE_ROLE === "MANAGER" ? "MANAGER" : "HR";
const catalog = { version: "V5.1", rows: KPI_V51_CATALOG };

function kpiLines(roleOrder: number, scores: (number | null)[], actual: string[]): KpiAssessmentLine[] {
  return indicatorsFor(catalog, roleOrder).map((row, index) => ({
    indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent,
    target: targetOf(row), actual: actual[index] ?? "", raw_score: scores[index] ?? null, comment: "",
  }));
}

function total(lines: readonly KpiAssessmentLine[]): number | null {
  if (lines.some((line) => line.raw_score === null)) return null;
  return Math.round(lines.reduce((sum, line) => sum + line.weight_percent * (line.raw_score ?? 0) / 100, 0) * 100) / 100;
}

function assessment(id: string, employeeId: string, roleOrder: number, period: string, scores: (number | null)[], status: "draft" | "completed"): KpiAssessment {
  const lines = kpiLines(roleOrder, scores, ["98% SLA", "100% accurate", "D+1", "Receivables 6%", "Zero penalties"]);
  return {
    id, definitionVersion: catalog.version, employeeId, roleOrder, roleName: indicatorsFor(catalog, roleOrder)[0].role_name,
    period, evaluationDate: `${period}-25`, evaluatorName: "Mrs. Maya", status, lines, overallScore: total(lines),
    generalNotes: status === "completed" ? "Sample fixture scorecard for local preview." : "", evidenceReference: null, createdAt: `${period}-25T08:00:00.000Z`, actor: "Mrs. Maya",
  };
}


// Load test (lecturer request): NEXT_PUBLIC_D4_FIXTURE_ROWS=1000 adds that many departments, positions,
// employees and records of every kind, so list pages, filters and forms can be checked at volume.
const BULK_ROWS = Math.min(5000, Math.max(0, Number(process.env.NEXT_PUBLIC_D4_FIXTURE_ROWS) || 0));

function withBulk(snapshot: D4LiveSnapshot, n: number): D4LiveSnapshot {
  const id = (kind: number, i: number) => `b${kind}000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  const competencyId = snapshot.reference.competencies[0].id;
  const range = Array.from({ length: n }, (_, i) => i + 1);
  const label = (i: number) => String(i).padStart(4, "0");
  const reference = {
    ...snapshot.reference,
    departments: [...snapshot.reference.departments, ...range.map((i) => ({ id: id(1, i), code: `BULK-DEPT-${label(i)}`, name: `Bulk Department ${label(i)}` }))],
    positions: [...snapshot.reference.positions, ...range.map((i) => ({ id: id(2, i), code: `BULK-POS-${label(i)}`, title: `Bulk Position ${label(i)}`, departmentId: id(1, i) }))],
    employees: [...snapshot.reference.employees, ...range.map((i) => ({ id: id(3, i), employeeId: `BULK-EMP-${label(i)}`, fullName: `Bulk Employee ${label(i)}`, positionId: id(2, i), departmentId: id(1, i) }))],
    positionRequirements: [...snapshot.reference.positionRequirements, ...range.map((i) => ({ id: id(4, i), positionId: id(2, i), competencyId, minProficiencyLevel: 3, isMandatory: true }))],
    employeeSkills: [...snapshot.reference.employeeSkills, ...range.map((i) => ({ id: id(5, i), employeeId: id(3, i), competencyId, proficiencyLevel: i % 5 + 1, evidenceNotes: "Bulk load-test record." }))],
  };
  const period = (i: number) => `2026-${String(i % 9 + 1).padStart(2, "0")}`;
  return {
    ...snapshot, reference,
    competency: [...snapshot.competency, ...range.map((i) => {
      const comparison = compareCompetencies(id(3, i), id(2, i), reference);
      return { id: id(6, i), source: "local-demo" as const, employeeId: id(3, i), positionId: id(2, i), effectiveDate: "2026-09-01", context: "current-position" as const,
        findings: comparison.findings, overallStatus: comparison.overallStatus, createdAt: "2026-09-01T08:00:00.000Z", actor: "Bulk" };
    })],
    performance: [...snapshot.performance, ...range.map((i) => ({ ...snapshot.performance[0], id: id(7, i), employeeId: id(3, i), period: period(i), evaluationDate: `${period(i)}-20`, generalNotes: `Bulk evaluation ${label(i)}.` }))],
    kpiAssessments: [...(snapshot.kpiAssessments ?? []), ...range.map((i) => ({ ...assessment(id(8, i), id(3, i), 10, period(i), [i % 5 + 1, 4, 3, 4, 5], "completed") }))],
    developmentVersions: [...snapshot.developmentVersions, ...range.map((i) => ({ ...snapshot.developmentVersions[0], id: id(9, i), needId: `BULK-DEV-${label(i)}`, employeeId: id(3, i), sourceRef: id(4, i), objective: `Bulk development objective ${label(i)}`, status: "Planned" as const, createdAt: `${period(i)}-21T08:00:00.000Z` }))],
    trainingVersions: [...snapshot.trainingVersions, ...range.map((i) => ({ ...snapshot.trainingVersions[0], id: `BULK-TRN-V-${label(i)}`, trainingId: `BULK-TRN-${label(i)}`, employeeId: id(3, i), developmentNeedId: `BULK-DEV-${label(i)}`, activity: `Bulk training ${label(i)}`, date: `${period(i)}-25`, status: "Planned" as const, createdAt: `${period(i)}-22T08:00:00.000Z` }))],
  };
}

function initialSnapshot(): D4LiveSnapshot {
  const alfa = ALFA;
  const finance = "d4000000-0000-4000-8000-000000000008";
  const comparison = compareCompetencies(alfa, finance, d4ReferenceFixture);
  // Kak Dian's development need (FIX-D4-DEV-002) comes from a saved gap, so the assessment exists too.
  const dian = "d4000000-0000-4000-8000-000000000011", taxManager = "d4000000-0000-4000-8000-000000000018";
  const dianGap = compareCompetencies(dian, taxManager, d4ReferenceFixture);
  // Demo scenarios: Mba Ena's gap feeds FIX-D4-DEV-003 (training Not Passed); Desty (Tax Associate 1) is assessed
  // for Tax Manager, a position change in scope for POSITION_CHANGE_SCOPE_MONTHS.
  const ena = "d4000000-0000-4000-8000-000000000016", accountingManager = "d4000000-0000-4000-8000-000000000049";
  const desty = "d4000000-0000-4000-8000-000000000014";
  const enaGap = compareCompetencies(ena, accountingManager, d4ReferenceFixture);
  const destyMove = compareCompetencies(desty, taxManager, d4ReferenceFixture);
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
      createdAt: "2026-09-21T09:00:00.000Z", actor: "Mrs. Maya",
    }, {
      id: "FIX-D4-COMP-ASSESS-002", source: "local-demo", employeeId: dian, positionId: taxManager, effectiveDate: "2026-09-22",
      context: "current-position", findings: dianGap.findings, overallStatus: dianGap.overallStatus,
      createdAt: "2026-09-22T09:00:00.000Z", actor: "Mrs. Maya",
    }, {
      id: "FIX-D4-COMP-ASSESS-003", source: "local-demo", employeeId: ena, positionId: accountingManager, effectiveDate: "2026-09-25",
      context: "current-position", findings: enaGap.findings, overallStatus: enaGap.overallStatus,
      createdAt: "2026-09-25T09:00:00.000Z", actor: "Mrs. Maya",
    }, {
      id: "FIX-D4-COMP-ASSESS-004", source: "local-demo", employeeId: desty, positionId: taxManager, effectiveDate: "2026-10-01",
      context: "role-change", findings: destyMove.findings, overallStatus: destyMove.overallStatus,
      createdAt: "2026-10-01T09:00:00.000Z", actor: "Mrs. Maya", assessedWith: "Kak Dian, Tax Manager",
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
  return createLocalSource({ mode: "fixture", initial: BULK_ROWS ? withBulk(initialSnapshot(), BULK_ROWS) : initialSnapshot() });
}

/**
 * In-browser data source shared by the local fixture preview and the public demo. It applies the same
 * rules as the API handlers; `persist` (demo only) is called after every write so the state survives reloads.
 */
export function createLocalSource({ mode, initial, persist }: { mode: "fixture" | "demo"; initial: D4LiveSnapshot; persist?: (state: D4LiveSnapshot) => void }): D4DataSource {
  let state = initial;
  const update = (patch: Partial<D4LiveSnapshot>) => { state = { ...state, ...patch }; persist?.(state); };
  const assertWriter = () => { if (state.role === "EMPLOYEE") throw new Error("Hanya HR atau manager yang dapat menyimpan perubahan."); };
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
    async loadKpiCatalog() { return seedCatalogSet(state.reference.positions); },
    async createEvaluation({ revisionOf, ...draft }) {
      assertWriter();
      const input = { ...draft, evaluator: actorName() };
      validatePerformanceInput(input);
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      assertTeam(input.employeeId);
      assertNotFutureDate(input.evaluationDate);
      assertEvaluationInPeriod(input.period, input.evaluationDate);
      assertPeriodRevision(state.performance, input.employeeId, input.period, revisionOf, "Evaluation");
      assertRevisionReason(revisionOf, input.generalNotes);
      const id = newId("FIX-D4-PERF");
      update({ performance: [{ ...input, id, source: "local-demo", createdAt: now(), actor: actorName() }, ...state.performance] });
      return id;
    },
    async createKpiAssessment({ revisionOf, ...draft }) {
      assertWriter();
      const input = { ...draft, evidenceReference: draft.evidenceReference?.trim() || null, evaluatorName: actorName() };
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      assertTeam(input.employeeId);
      assertNotFutureDate(input.evaluationDate);
      assertEvaluationInPeriod(input.period, input.evaluationDate);
      assertPeriodRevision(state.kpiAssessments ?? [], input.employeeId, input.period, revisionOf, "Scorecard");
      if (!input.generalNotes.trim()) throw new Error("Notes wajib diisi.");
      if (!input.evidenceReference) throw new Error("Reference wajib diisi.");
      const periodCatalog = catalogFor(seedCatalogSet(state.reference.positions), input.period);
      if (!periodCatalog) throw new Error(`Belum ada katalog KPI yang berlaku untuk periode ${input.period}.`);
      const indicators = indicatorsFor(periodCatalog, input.roleOrder);
      if (indicators.length !== 5) throw new Error("Role KPI tidak ditemukan di katalog.");
      const employee = state.reference.employees.find((item) => item.id === input.employeeId);
      if (roleForPosition(periodCatalog, employee?.positionId) !== input.roleOrder) throw new Error("Set KPI yang dipilih bukan milik posisi pegawai ini.");
      if (input.status === "completed" && input.lines.some((line) => line.raw_score === null)) throw new Error("Kelima indikator KPI harus dinilai sebelum diselesaikan.");
      const maxScore = scaleMaxOf(periodCatalog.version);
      if (input.lines.some((line) => line.raw_score !== null && (!Number.isInteger(line.raw_score) || line.raw_score < 1 || line.raw_score > maxScore))) throw new Error(`Actual setiap indikator harus bilangan bulat 1 sampai ${maxScore}.`);
      const id = newId("FIX-D4-KPI");
      // The target comes from the catalog, never from the form (same rule as the server).
      input.lines = input.lines.map((line, index) => ({ ...line, target: targetOf(indicators[index]) }));
      update({ kpiAssessments: [{ ...input, id, definitionVersion: periodCatalog.version, roleName: indicators[0].role_name, overallScore: total(input.lines), createdAt: now(), actor: actorName() }, ...(state.kpiAssessments ?? [])] });
      return id;
    },
    async saveCompetency(input) {
      assertWriter();
      const employee = state.reference.employees.find((item) => item.id === input.employeeId);
      if (!employee) throw new Error("Pegawai tidak ditemukan.");
      assertTeam(input.employeeId);
      const comparison = compareCompetencies(input.employeeId, input.positionId, state.reference);
      if (!comparison.findings.length) throw new Error("Posisi ini belum memiliki persyaratan kompetensi.");
      const id = newId("FIX-D4-COMP");
      update({ competency: [{ id, source: "local-demo", employeeId: input.employeeId, positionId: input.positionId, effectiveDate: input.effectiveDate, context: employee.positionId === input.positionId ? "current-position" : "role-change", findings: comparison.findings, overallStatus: comparison.overallStatus, createdAt: now(), actor: actorName(), assessedWith: input.assessedWith?.trim() || null }, ...state.competency] });
      return id;
    },
    async createDevelopment(input) {
      assertWriter();
      if (!input.objective.trim()) throw new Error("Development objective wajib diisi.");
      if (!input.sourceRef) throw new Error("Source reference wajib diisi.");
      assertNotSelf(state.actorEmployeeId, input.employeeId, "Development requirement");
      assertTeam(input.employeeId);
      assertNoOpenNeed(latestDevelopment(state), input.employeeId, input.sourceType, input.sourceRef);
      assertGapAssessed(state.competency, state.reference.employees.find((item) => item.id === input.employeeId), input.sourceType);
      const needId = newId("FIX-D4-DEV");
      update({ developmentVersions: [{ ...input, id: newId("FIX-D4-DEV-V"), needId, revision: 1, source: "local-demo", status: "Identified", createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
      return needId;
    },
    async updateDevelopment(needId, status, notes, edit) {
      assertWriter();
      const needs = latestDevelopment(state);
      const current = needs.find((item) => item.needId === needId);
      if (!current) throw new Error("Development requirement tidak ditemukan.");
      assertTeam(current.employeeId);
      // The spread carries priority/method/PIC forward; reassessment belongs to the revision that records it.
      const next = nextDevelopmentRevision(current, { ...edit, status, notes }, needs, latestTraining(state), state.developmentVersions.filter((item) => item.needId === needId));
      update({ developmentVersions: [{ ...current, ...next, id: newId("FIX-D4-DEV-V"), revision: current.revision + 1, createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
    },
    async createTraining(input) {
      assertWriter();
      assertNotSelf(state.actorEmployeeId, input.employeeId, "Training");
      const need = latestDevelopment(state).find((item) => item.needId === input.developmentNeedId);
      if (!need || need.employeeId !== input.employeeId) throw new Error("Training harus merujuk ke development requirement milik pegawai yang sama.");
      assertTeam(input.employeeId);
      assertNeedOpen(need);
      assertTrainingDate(input.status, input.date);
      assertTrainingResult(input.status, input.result);
      const trainingId = newId("FIX-D4-TRN");
      update({ trainingVersions: [{ ...input, id: newId("FIX-D4-TRN-V"), trainingId, revision: 1, source: "local-demo", createdAt: now(), actor: actorName() }, ...state.trainingVersions] });
      return trainingId;
    },
    async updateTraining(trainingId, status, result, notes) {
      assertWriter();
      const current = latestTraining(state).find((item) => item.trainingId === trainingId);
      if (!current) throw new Error("Training tidak ditemukan.");
      assertTeam(current.employeeId);
      assertTrainingResult(status, result);
      assertTrainingDate(status, current.date);
      assertTrainingChange(current.status, status, notes);
      // A follow-up belongs to the version that records it (followUpOf reads the history), as in Supabase.
      update({ trainingVersions: [{ ...current, id: newId("FIX-D4-TRN-V"), revision: current.revision + 1, status, result, notes, followUp: null, createdAt: now(), actor: actorName() }, ...state.trainingVersions] });
    },
    async recordTrainingFollowUp(trainingId, input) {
      assertWriter();
      const history = state.trainingVersions.filter((item) => item.trainingId === trainingId);
      const current = latestTraining(state).find((item) => item.trainingId === trainingId);
      if (!current) throw new Error("Training tidak ditemukan.");
      assertTeam(current.employeeId);
      assertTrainingFollowUp(history, input, latestDevelopment(state).find((item) => item.needId === current.developmentNeedId));
      const at = now(), actor = actorName();
      const followUp = { ...current, id: newId("FIX-D4-TRN-V"), revision: current.revision + 1, notes: input.notes.trim(), followUp: input.followUp, createdAt: at, actor };
      if (input.followUp !== "Retraining") { update({ trainingVersions: [followUp, ...state.trainingVersions] }); return null; }
      const retrainingId = newId("FIX-D4-TRN");
      const retraining = { ...current, id: newId("FIX-D4-TRN-V"), trainingId: retrainingId, revision: 1, source: "local-demo" as const, activity: (input.activity ?? "").trim(), date: input.date ?? "",
        status: "Planned" as const, result: "", notes: retrainingNotes(current, input.notes), followUp: null, createdAt: at, actor };
      update({ trainingVersions: [retraining, followUp, ...state.trainingVersions] });
      return retrainingId;
    },
  };
}

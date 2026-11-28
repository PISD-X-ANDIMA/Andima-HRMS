import { compareCompetencies } from "../../competency/service";
import { developmentFixtureVersions } from "../../development/fixtures";
import { catalogFor, indicatorsFor, KPI_V51_CATALOG, roleForPosition, scorableSet, seedCatalogSet, targetOf } from "../../kpi/catalog";
import { scaleMaxOf } from "../../kpi/scale";
import { performanceFixtureRecords } from "../../performance/fixtures";
import { validatePerformanceInput } from "../../performance/validation";
import { d4ReferenceFixture } from "../../shared/fixtures";
import { assertDailyDate, assertGapAssessed, assertPicFilled, canFillDaily, closeGapBlockedReason, closeGapNotes, openTrainingCount, trainingSyncRevision, localMonth, localToday, assertTrainingDate, assertNoDuplicateTraining, assertNeedOpen, assertNoOpenNeed, assertTrainingResult, assertNotSelf, assertPeriodOpen, assertPeriodRevision, assertReopening, assertTrainingChange, nextDevelopmentRevision, planTrainingCompletion, retrainingNotes } from "../../shared/rules";
import type { D4LiveSnapshot, KpiAssessment, KpiAssessmentLine, KpiDailyEntry } from "../../supabase/types";
import { latestDevelopment, latestTraining } from "../../supabase/types";
import { trainingFixtureVersions } from "../../training/fixtures";
import type { TrainingFollowUp } from "../../training/types";
import { completionContext } from "./completion";
import type { D4DataSource } from "./source";

// Local preview only (NEXT_PUBLIC_D4_DATA_MODE=fixture in development). All people and
// records are fictional; writes live in memory and disappear on reload. The rules below
// mirror the server so the UI behaves the same as in live mode.
const HR_ACTOR = "d4000000-0000-4000-8000-000000000012";
const ALFA = "d4000000-0000-4000-8000-000000000009";
// NEXT_PUBLIC_D4_FIXTURE_ROLE=EMPLOYEE previews the self-service view as Kak Ismi (read-only);
// MANAGEMENT previews a director (reads everything, writes only their own Daily KPI).
const FIXTURE_ROLES = ["EMPLOYEE", "MANAGER", "MANAGEMENT"] as const;
const FIXTURE_ROLE = FIXTURE_ROLES.find((role) => role === process.env.NEXT_PUBLIC_D4_FIXTURE_ROLE) ?? "HR";
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


/**
 * Daily KPI of the running WIB period up to yesterday: Kak Ismi mostly above target, Kak Dian under it on the last
 * days, so the dashboard alert has a case. On the 1st of a month there is no earlier day yet, so no entries.
 */
function dailyFixture(): KpiDailyEntry[] {
  const period = localMonth();
  const periodCatalog = catalogFor(seedCatalogSet(d4ReferenceFixture.positions), period);
  if (!periodCatalog) return [];
  const days = Array.from({ length: Math.min(Number(localToday().slice(8)) - 1, 6) }, (_, index) => `${period}-${String(index + 1).padStart(2, "0")}`);
  const people: [string, number[]][] = [[ALFA, [88, 86, 90, 84, 87, 89]], ["d4000000-0000-4000-8000-000000000011", [86, 85, 83, 80, 79, 78]]];
  return people.flatMap(([employeeId, totals]) => {
    const roleOrder = roleForPosition(periodCatalog, d4ReferenceFixture.employees.find((item) => item.id === employeeId)?.positionId);
    const indicators = indicatorsFor(periodCatalog, roleOrder);
    if (!scorableSet(indicators)) return [];
    return days.map((entryDate, index) => {
      const lines = indicators.map((row) => ({ indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: targetOf(row), actual: String(totals[index]), raw_score: totals[index], comment: "" }));
      return { id: `FIX-D4-DAILY-${employeeId.slice(-2)}-${index + 1}`, definitionVersion: periodCatalog.version, employeeId, entryDate, period, roleOrder, roleName: indicators[0].role_name, lines, overallScore: total(lines), createdAt: `${entryDate}T10:00:00.000Z` };
    });
  });
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
    actorEmployeeId: FIXTURE_ROLE === "EMPLOYEE" ? ALFA : HR_ACTOR,
    kpi: [],
    kpiAssessments: [
      assessment("FIX-D4-KPI-001", alfa, 10, "2026-09", [4, 5, 4, 3, 4], "completed"),
      assessment("FIX-D4-KPI-002", alfa, 10, "2026-06", [3, 4, 4, 3, 3], "completed"),
    ],
    kpiDaily: dailyFixture(),
    periodReopenings: [],
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
  const own = <T extends { employeeId: string }>(items: readonly T[]) => items.filter((item) => item.employeeId === snapshot.actorEmployeeId);
  return {
    ...snapshot, performance: own(snapshot.performance), kpiAssessments: own(snapshot.kpiAssessments ?? []), kpiDaily: own(snapshot.kpiDaily ?? []), competency: own(snapshot.competency),
    developmentVersions: own(snapshot.developmentVersions), trainingVersions: own(snapshot.trainingVersions),
  };
}

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));

export function createFixtureSource(): D4DataSource {
  let state = BULK_ROWS ? withBulk(initialSnapshot(), BULK_ROWS) : initialSnapshot();
  const update = (patch: Partial<D4LiveSnapshot>) => { state = { ...state, ...patch }; };
  const assertWriter = () => { if (state.role !== "HR" && state.role !== "MANAGER") throw new Error("Hanya HR atau manager yang dapat menyimpan perubahan."); };
  // The evaluator is always the signed-in actor, never a free-text value from the form.
  const actorName = () => state.reference.employees.find((item) => item.id === state.actorEmployeeId)?.fullName ?? "HR";
  // Mirrors syncDevelopment in server/training-records: Training Tracking is the one writer of a requirement's progress (13 Nov 2026).
  const syncDevelopment = (needId: string) => {
    const need = latestDevelopment(state).find((item) => item.needId === needId);
    const next = need && trainingSyncRevision(need, latestTraining(state), state.developmentVersions.filter((item) => item.needId === needId));
    if (need && next) update({ developmentVersions: [{ ...need, ...next, id: newId("FIX-D4-DEV-V"), revision: need.revision + 1, createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
  };
  return {
    mode: "fixture",
    async loadSnapshot() { await delay(); return state.role === "EMPLOYEE" ? ownRecords(state) : state; },
    async loadKpiCatalog() { return seedCatalogSet(state.reference.positions); },
    async createEvaluation({ revisionOf, ...draft }) {
      assertWriter();
      // Same as the API: the evaluation date is the saved day, and only an open period takes a new record.
      const input = { ...draft, evaluationDate: localToday(), evaluator: actorName() };
      validatePerformanceInput(input);
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      assertPeriodOpen(input.period, state.periodReopenings ?? []);
      assertPeriodRevision(state.performance, input.employeeId, input.period, revisionOf, "Evaluation");
      const id = newId("FIX-D4-PERF");
      update({ performance: [{ ...input, id, source: "local-demo", createdAt: now(), actor: actorName() }, ...state.performance] });
      return id;
    },
    async createKpiAssessment({ revisionOf, ...draft }) {
      assertWriter();
      const input = { ...draft, evaluationDate: localToday(), evidenceReference: draft.evidenceReference?.trim() || null, evaluatorName: actorName() };
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      assertPeriodOpen(input.period, state.periodReopenings ?? []);
      assertPeriodRevision(state.kpiAssessments ?? [], input.employeeId, input.period, revisionOf, "Scorecard");
      if (!input.generalNotes.trim()) throw new Error("Notes wajib diisi.");
      if (!input.evidenceReference) throw new Error("Reference wajib diisi.");
      const periodCatalog = catalogFor(seedCatalogSet(state.reference.positions), input.period);
      if (!periodCatalog) throw new Error(`Belum ada katalog KPI yang berlaku untuk periode ${input.period}.`);
      const indicators = indicatorsFor(periodCatalog, input.roleOrder);
      if (!scorableSet(indicators) || input.lines.length !== indicators.length) throw new Error("Role KPI tidak ditemukan di katalog.");
      const employee = state.reference.employees.find((item) => item.id === input.employeeId);
      if (roleForPosition(periodCatalog, employee?.positionId) !== input.roleOrder) throw new Error("Set KPI yang dipilih bukan milik posisi pegawai ini.");
      if (input.status === "completed" && input.lines.some((line) => line.raw_score === null)) throw new Error("Semua indikator KPI harus dinilai sebelum diselesaikan.");
      const maxScore = scaleMaxOf(periodCatalog.version);
      if (input.lines.some((line) => line.raw_score !== null && (!Number.isInteger(line.raw_score) || line.raw_score < 1 || line.raw_score > maxScore))) throw new Error(`Actual setiap indikator harus bilangan bulat 1 sampai ${maxScore}.`);
      const id = newId("FIX-D4-KPI");
      // The target comes from the catalog, never from the form (same rule as the server).
      input.lines = input.lines.map((line, index) => ({ ...line, target: targetOf(indicators[index]) }));
      update({ kpiAssessments: [{ ...input, id, definitionVersion: periodCatalog.version, roleName: indicators[0].role_name, overallScore: total(input.lines), createdAt: now(), actor: actorName() }, ...(state.kpiAssessments ?? [])] });
      return id;
    },
    // Mirrors POST /api/d4/kpi-daily: self-service, so the employee and KPI set come from the session, not the draft.
    async createDailyKpi(draft) {
      if (state.role === "MANAGEMENT") throw new Error("Direktur tidak mengisi Daily KPI; peran Management hanya membaca.");
      if (!canFillDaily(state.role, state.actorEmployeeId)) throw new Error("Akun ini belum terhubung ke data pegawai.");
      assertDailyDate(draft.entryDate);
      const period = draft.entryDate.slice(0, 7);
      const periodCatalog = catalogFor(seedCatalogSet(state.reference.positions), period);
      if (!periodCatalog) throw new Error(`Belum ada katalog KPI yang berlaku untuk periode ${period}.`);
      const roleOrder = roleForPosition(periodCatalog, state.reference.employees.find((item) => item.id === state.actorEmployeeId)?.positionId);
      const indicators = indicatorsFor(periodCatalog, roleOrder);
      if (!roleOrder || !scorableSet(indicators)) throw new Error(`Posisi Anda belum memiliki KPI di katalog ${periodCatalog.version}. Hubungi HR.`);
      const maxScore = scaleMaxOf(periodCatalog.version);
      const lines = indicators.map((row, index) => {
        const score = draft.lines[index]?.raw_score;
        if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > maxScore) throw new Error(`Skor ${row.kpi_name} harus bilangan bulat 1 sampai ${maxScore}.`);
        return { indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: targetOf(row), actual: String(score), raw_score: score, comment: draft.lines[index]?.comment.trim() ?? "" };
      });
      const id = newId("FIX-D4-DAILY");
      update({ kpiDaily: [{ id, definitionVersion: periodCatalog.version, employeeId: state.actorEmployeeId, entryDate: draft.entryDate, period, roleOrder, roleName: indicators[0].role_name, lines, overallScore: total(lines), createdAt: now() }, ...(state.kpiDaily ?? [])] });
      return id;
    },
    async reopenPeriod(input) {
      if (state.role !== "HR") throw new Error("Hanya HR yang dapat membuka atau menutup kembali periode.");
      assertReopening(input);
      update({ periodReopenings: [{ period: input.period, openUntil: input.openUntil, reason: input.reason.trim(), createdAt: now() }, ...(state.periodReopenings ?? [])] });
      return newId("FIX-D4-REOPEN");
    },
    async saveCompetency(input) {
      assertWriter();
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      const employee = state.reference.employees.find((item) => item.id === input.employeeId);
      if (!employee) throw new Error("Pegawai tidak ditemukan.");
      const comparison = compareCompetencies(input.employeeId, input.positionId, state.reference);
      if (!comparison.findings.length) throw new Error("Posisi ini belum memiliki persyaratan kompetensi.");
      const id = newId("FIX-D4-COMP");
      update({ competency: [{ id, source: "local-demo", employeeId: input.employeeId, positionId: input.positionId, effectiveDate: input.effectiveDate, context: employee.positionId === input.positionId ? "current-position" : "role-change", findings: comparison.findings, overallStatus: comparison.overallStatus, createdAt: now(), actor: actorName(), assessedWith: input.assessedWith?.trim() || null }, ...state.competency] });
      return id;
    },
    async createDevelopment(input) {
      assertWriter();
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      if (!input.objective.trim()) throw new Error("Development objective wajib diisi.");
      if (!input.sourceRef) throw new Error("Source reference wajib diisi.");
      assertPicFilled(input.pic ?? "");
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
      assertNotSelf(state.actorEmployeeId, current.employeeId);
      if (status !== current.status || edit?.reassessment) throw new Error("Status requirement mengikuti Training Tracking. Ubah progres di training-nya, atau tutup dengan bukti level lewat Close as Met.");
      assertPicFilled(edit?.pic);
      // The spread carries priority/method/PIC forward; reassessment belongs to the revision that records it.
      const next = nextDevelopmentRevision(current, { ...edit, status, notes }, needs, latestTraining(state), state.developmentVersions.filter((item) => item.needId === needId));
      update({ developmentVersions: [{ ...current, ...next, id: newId("FIX-D4-DEV-V"), revision: current.revision + 1, createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
    },
    async createTraining(input) {
      assertWriter();
      assertNotSelf(state.actorEmployeeId, input.employeeId);
      const need = latestDevelopment(state).find((item) => item.needId === input.developmentNeedId);
      if (!need || need.employeeId !== input.employeeId) throw new Error("Training harus merujuk ke development requirement milik pegawai yang sama.");
      assertNeedOpen(need);
      assertTrainingDate(input.status, input.date);
      assertNoDuplicateTraining(latestTraining(state), input.developmentNeedId, input.activity, input.date);
      assertTrainingResult(input.status, input.result);
      const trainingId = newId("FIX-D4-TRN");
      update({ trainingVersions: [{ ...input, id: newId("FIX-D4-TRN-V"), trainingId, revision: 1, source: "local-demo", createdAt: now(), actor: actorName() }, ...state.trainingVersions] });
      syncDevelopment(input.developmentNeedId);
      return trainingId;
    },
    async updateTraining(trainingId, status, result, notes) {
      assertWriter();
      const current = latestTraining(state).find((item) => item.trainingId === trainingId);
      if (!current) throw new Error("Training tidak ditemukan.");
      assertNotSelf(state.actorEmployeeId, current.employeeId);
      assertTrainingResult(status, result);
      assertTrainingChange(current.status, status, notes);
      // A follow-up belongs to the version that records it (followUpOf reads the history), as in Supabase.
      update({ trainingVersions: [{ ...current, id: newId("FIX-D4-TRN-V"), revision: current.revision + 1, status, result, notes, followUp: null, createdAt: now(), actor: actorName() }, ...state.trainingVersions] });
      syncDevelopment(current.developmentNeedId);
    },
    // Mirrors POST /api/d4/training-records/:id/complete in one update; the timestamps keep the server's write order.
    async completeTraining(trainingId, input) {
      assertWriter();
      const start = Date.now(), at = (step: number) => new Date(start + step).toISOString(), actor = actorName();
      const { current, need, employee, comparison, context } = completionContext(state, trainingId, at(0));
      if (!current) throw new Error("Training tidak ditemukan.");
      assertNotSelf(state.actorEmployeeId, current.employeeId);
      if (input.decision === "Retraining") assertTrainingDate("Planned", input.date ?? "");
      const plan = planTrainingCompletion(input, context);
      const trainingVersions = [...state.trainingVersions], developmentVersions = [...state.developmentVersions], competency = [...state.competency];
      if (plan.training) trainingVersions.unshift({ ...current, id: newId("FIX-D4-TRN-V"), revision: current.revision + 1, status: "Completed", result: input.result, notes: input.notes.trim(),
        followUp: plan.training === "follow-up" ? input.decision as TrainingFollowUp : null, createdAt: at(0), actor });
      if (plan.snapshot && employee?.positionId && comparison?.findings.length) competency.unshift({ id: newId("FIX-D4-COMP"), source: "local-demo", employeeId: employee.id, positionId: employee.positionId,
        effectiveDate: localToday(), context: "current-position", findings: comparison.findings, overallStatus: comparison.overallStatus, createdAt: at(1), actor, assessedWith: null });
      if (plan.development && need) developmentVersions.unshift({ ...need, ...plan.development, id: newId("FIX-D4-DEV-V"), revision: need.revision + 1, createdAt: at(2), actor });
      const retrainingId = plan.retraining ? newId("FIX-D4-TRN") : null;
      if (retrainingId) trainingVersions.unshift({ ...current, id: newId("FIX-D4-TRN-V"), trainingId: retrainingId, revision: 1, source: "local-demo", activity: (input.activity ?? "").trim(), date: input.date ?? "",
        status: "Planned", result: "", notes: retrainingNotes(current, input.notes, input.result), followUp: null, createdAt: at(3), actor });
      update({ trainingVersions, developmentVersions, competency });
      syncDevelopment(current.developmentNeedId);
      return retrainingId;
    },
    // Mirrors POST /api/d4/development-needs/:id/close (path B, 13 Nov 2026).
    async closeDevelopment(needId) {
      assertWriter();
      const needs = latestDevelopment(state);
      const need = needs.find((item) => item.needId === needId);
      if (!need) throw new Error("Development requirement tidak ditemukan.");
      assertNotSelf(state.actorEmployeeId, need.employeeId);
      const employee = state.reference.employees.find((item) => item.id === need.employeeId);
      const finding = employee?.positionId ? compareCompetencies(employee.id, employee.positionId, state.reference).findings.find((item) => item.requirementId === need.sourceRef) : undefined;
      const blocked = closeGapBlockedReason(need, finding, openTrainingCount(latestTraining(state), needId));
      if (blocked || !finding) throw new Error(blocked);
      const next = nextDevelopmentRevision(need, { status: "Completed", notes: closeGapNotes(finding, localToday()), reassessment: "Meets requirement" }, needs, latestTraining(state),
        state.developmentVersions.filter((item) => item.needId === needId));
      update({ developmentVersions: [{ ...need, ...next, id: newId("FIX-D4-DEV-V"), revision: need.revision + 1, createdAt: now(), actor: actorName() }, ...state.developmentVersions] });
    },
  };
}

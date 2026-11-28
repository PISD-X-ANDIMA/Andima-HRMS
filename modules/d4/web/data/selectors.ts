import { compileDaily } from "../../kpi/daily";
import { kpiGap, scaleMaxOf, scoreText } from "../../kpi/scale";
import { compareCompetencies } from "../../competency/service";
import type { CompetencyAssessment, CompetencyFinding, CompetencyOverallStatus } from "../../competency/types";
import type { DevelopmentNeedVersion, DevelopmentSourceType } from "../../development/types";
import type { PerformanceEvaluation } from "../../performance/types";
import { msg, plainText, type Language, type Translate } from "../../shared/text";
import type { EmployeeReference } from "../../shared/types";
import { localMonth, localToday, passedTrainingCount, pendingDecision, reassessmentOf, retrainedAt, revisionNumber } from "../../shared/rules";
import { latestDevelopment, latestTraining, type D4LiveSnapshot, type KpiAssessment } from "../../supabase/types";
import type { TrainingVersion } from "../../training/types";

export type Snapshot = D4LiveSnapshot;

export const canWrite = (snapshot: Snapshot) => snapshot.role === "HR" || snapshot.role === "MANAGER";

/** Employees see only their own records; HR and managers see everyone RLS allows. */
export function visibleEmployees(snapshot: Snapshot): readonly EmployeeReference[] {
  return snapshot.role === "EMPLOYEE" ? snapshot.reference.employees.filter((item) => item.id === snapshot.actorEmployeeId) : snapshot.reference.employees;
}

/** Employees the signed-in evaluator may assess: never themselves. */
/** Writer acting on someone else's record: nobody adds a scorecard or evaluation for themselves. */
export const canAssess = (snapshot: Snapshot, employeeId: string) => canWrite(snapshot) && employeeId !== snapshot.actorEmployeeId;
export const assessableEmployees = (snapshot: Snapshot) => visibleEmployees(snapshot).filter((item) => item.id !== snapshot.actorEmployeeId);

const newestFirst = <T extends { createdAt: string }>(items: readonly T[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const byPeriod = <T extends { createdAt: string; period: string }>(items: readonly T[]) => newestFirst(items).sort((a, b) => b.period.localeCompare(a.period));
function groupBy<T>(items: readonly T[], key: (item: T) => string, order: (items: T[]) => T[] = (list) => list) {
  const groups = new Map<string, T[]>();
  for (const item of items) { const k = key(item); const list = groups.get(k); if (list) list.push(item); else groups.set(k, [item]); }
  for (const [k, list] of groups) groups.set(k, order(list));
  return groups;
}

/**
 * Lookups built once per snapshot (load test: 1000+ records per table). Without them every table row
 * re-scanned and re-sorted whole arrays, so list pages were O(n²) and typing in a search box took
 * over a second. A snapshot is never mutated (each change creates a new one), so a WeakMap keyed by
 * it is invalidated automatically.
 */
type SnapshotIndex = {
  employees: Map<string, EmployeeReference>;
  positions: Map<string, Snapshot["reference"]["positions"][number]>;
  departments: Map<string, Snapshot["reference"]["departments"][number]>;
  evaluations: Map<string, PerformanceEvaluation[]>;
  scorecards: Map<string, KpiAssessment[]>;
  assessments: Map<string, CompetencyAssessment[]>;
  needs: DevelopmentNeedVersion[];
  trainings: TrainingVersion[];
  needsByEmployee: Map<string, DevelopmentNeedVersion[]>;
  needHistory: Map<string, DevelopmentNeedVersion[]>;
  trainingsByEmployee: Map<string, TrainingVersion[]>;
  gaps: Map<string, ReturnType<typeof compareCompetencies> | null>;
};
const indexes = new WeakMap<Snapshot, SnapshotIndex>();
function indexOf(snapshot: Snapshot): SnapshotIndex {
  let index = indexes.get(snapshot);
  if (!index) {
    const { reference } = snapshot;
    index = {
      employees: new Map(reference.employees.map((item) => [item.id, item])),
      positions: new Map(reference.positions.map((item) => [item.id, item])),
      departments: new Map(reference.departments.map((item) => [item.id, item])),
      evaluations: groupBy(snapshot.performance, (item) => item.employeeId, byPeriod),
      scorecards: groupBy(snapshot.kpiAssessments ?? [], (item) => item.employeeId, byPeriod),
      assessments: groupBy(snapshot.competency, (item) => `${item.employeeId}|${item.positionId}`, newestFirst),
      needs: latestDevelopment(snapshot),
      trainings: latestTraining(snapshot),
      needsByEmployee: new Map(),
      needHistory: groupBy(snapshot.developmentVersions, (item) => item.needId, (list) => list.sort((a, b) => b.revision - a.revision)),
      trainingsByEmployee: new Map(),
      gaps: new Map(),
    };
    index.needsByEmployee = groupBy(index.needs, (item) => item.employeeId);
    index.trainingsByEmployee = groupBy(index.trainings, (item) => item.employeeId);
    indexes.set(snapshot, index);
  }
  return index;
}

export const employeeById = (snapshot: Snapshot, id: string) => indexOf(snapshot).employees.get(id);
export const positionOf = (snapshot: Snapshot, employee?: EmployeeReference) => employee?.positionId ? indexOf(snapshot).positions.get(employee.positionId) : undefined;
export const positionById = (snapshot: Snapshot, id?: string | null) => id ? indexOf(snapshot).positions.get(id) : undefined;
/**
 * Title of a saved assessment's position, which may have left the position master since (UI-008). Then the title
 * saved with the assessment is shown, so history still says which position was assessed.
 */
export const positionTitle = (snapshot: Snapshot, id?: string | null, saved?: string | null, t: Translate = plainText) =>
  positionById(snapshot, id)?.title ?? (saved?.trim() || t("posisi tidak ada di master"));
export const departmentOf = (snapshot: Snapshot, employee?: EmployeeReference) => employee?.departmentId ? indexOf(snapshot).departments.get(employee.departmentId) : undefined;
/** Header line shared by every detail/history page: position · employee ID · department. */
export const employeeMeta = (snapshot: Snapshot, employee: EmployeeReference, t: Translate = plainText) => [positionOf(snapshot, employee)?.title ?? t("No position yet"), employee.employeeId, departmentOf(snapshot, employee)?.name ?? ""];

// Copies, so a caller sorting the result never reorders the shared index.
export function evaluationsOf(snapshot: Snapshot, employeeId: string): PerformanceEvaluation[] {
  return [...(indexOf(snapshot).evaluations.get(employeeId) ?? [])];
}
export const latestEvaluation = (snapshot: Snapshot, employeeId: string) => evaluationsOf(snapshot, employeeId)[0];

export function scorecardsOf(snapshot: Snapshot, employeeId: string): KpiAssessment[] {
  return [...(indexOf(snapshot).scorecards.get(employeeId) ?? [])];
}
/** " · Revision n" for the second and later record of the same period; empty for the first. */
export function revisionTag<T extends { id: string; employeeId: string; period: string; createdAt: string }>(records: readonly T[], record: T, t: Translate = plainText) {
  const n = revisionNumber(records, record);
  return n > 1 ? ` · ${t("Revision {n}", { n })}` : "";
}

export const latestScorecard = (snapshot: Snapshot, employeeId: string) => scorecardsOf(snapshot, employeeId)[0];
/**
 * List order (9 Nov 2026): rows that still need action come first and finished ones last, so what is left to do is on
 * the first page. `rank` is 0 for the most urgent; rows of the same rank stay in name order.
 */
export const byProgress = <T,>(rank: (row: T) => number, name: (row: T) => string) => (a: T, b: T) => rank(a) - rank(b) || name(a).localeCompare(name(b));
/**
 * Just saved (13 Nov 2026, one rule for every list since 17 Nov): the row a page just saved comes first until the page
 * is left, also when the search, a filter or the history rule would leave it out, so a save never seems to vanish.
 */
export function pinJustSaved<T>(rows: readonly T[], rowKey: (row: T) => string, saved?: T): T[] {
  if (!saved) return [...rows];
  const key = rowKey(saved);
  return [saved, ...rows.filter((row) => rowKey(row) !== key)];
}
/**
 * B6: the period score compiled from Daily KPI, shown without manual input until HR finalizes it into a scorecard.
 * Null once the period has a scorecard, which then takes over everywhere.
 */
export function pendingCompilation(snapshot: Snapshot, employeeId: string, period: string) {
  if (!period || scorecardsOf(snapshot, employeeId).some((item) => item.period === period)) return null;
  return compileDaily(snapshot.kpiDaily ?? [], employeeId, period);
}

/** Live comparison of the employee's current position requirements against recorded evidence. */
export function currentGap(snapshot: Snapshot, employee: EmployeeReference): { findings: CompetencyFinding[]; overallStatus: CompetencyOverallStatus } | null {
  if (!employee.positionId || !positionById(snapshot, employee.positionId)) return null;
  const { gaps } = indexOf(snapshot);
  if (!gaps.has(employee.id)) gaps.set(employee.id, compareCompetencies(employee.id, employee.positionId, snapshot.reference));
  return gaps.get(employee.id) ?? null;
}

/** Latest saved assessment for the active position, including a position-change snapshot after reassignment. */
export function latestCurrentPositionAssessment(snapshot: Snapshot, employee: EmployeeReference): CompetencyAssessment | undefined {
  if (!positionOf(snapshot, employee)) return undefined;
  return indexOf(snapshot).assessments.get(`${employee.id}|${employee.positionId}`)?.[0];
}

export type CurrentCompetencyStatus = CompetencyOverallStatus | "Not Evaluated";

/** Display readiness separately from evidence quality; saved assessments keep the live comparison status. */
export function currentCompetencyStatus(snapshot: Snapshot, employee: EmployeeReference): CurrentCompetencyStatus {
  if (!latestCurrentPositionAssessment(snapshot, employee)) return "Not Evaluated";
  return currentGap(snapshot, employee)?.overallStatus ?? "Not Evaluated";
}

// Shared arrays from the index: callers only filter/find them.
export const developmentNeeds = (snapshot: Snapshot): readonly DevelopmentNeedVersion[] => indexOf(snapshot).needs;
export const trainings = (snapshot: Snapshot): readonly TrainingVersion[] => indexOf(snapshot).trainings;
/** Latest revision of each need / training of one employee, newest first. */
export const needsOf = (snapshot: Snapshot, employeeId: string): readonly DevelopmentNeedVersion[] => indexOf(snapshot).needsByEmployee.get(employeeId) ?? [];
/** Employment statuses HR sets for people still in training (interview D4: "yang menentukan HR"). */
const TRAINEE_STATUSES = ["PROBATION", "INTERN"];
/**
 * After a promotion or position change the competency stays in scope this long. Trainees need no month count
 * (HR flips the status), and probation is capped at 3 months by Indonesian labour law; a new role takes longer to
 * close a gap, so a position change gets 6 months.
 */
export const POSITION_CHANGE_SCOPE_MONTHS = 6;

const addMonths = (isoDate: string, months: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

/**
 * Competency is assessed for trainees (probation or intern status), for promoted employees (a saved position
 * change assessment in the last POSITION_CHANGE_SCOPE_MONTHS) and while a requirement is still open
 * (interview D4, 14 Oct 2026).
 */
export const inTrainingOrPositionChange = (snapshot: Snapshot, employeeId: string, on: string = today()) => {
  const status = employeeById(snapshot, employeeId)?.employmentStatus?.toUpperCase();
  return Boolean(status && TRAINEE_STATUSES.includes(status))
    || developmentNeeds(snapshot).some((item) => item.employeeId === employeeId && item.status !== "Completed")
    || snapshot.competency.some((item) => item.employeeId === employeeId && item.context === "role-change" && addMonths(item.effectiveDate, POSITION_CHANGE_SCOPE_MONTHS) >= on);
};

export const trainingsOf = (snapshot: Snapshot, employeeId: string): readonly TrainingVersion[] => indexOf(snapshot).trainingsByEmployee.get(employeeId) ?? [];
/** PST 2 (Kei): who still needs training = an open requirement with no training other than Cancelled. */
export const needsTraining = (snapshot: Snapshot, need: DevelopmentNeedVersion) =>
  need.status !== "Completed" && !trainingsOf(snapshot, need.employeeId).some((item) => item.developmentNeedId === need.needId && item.status !== "Cancelled");
export const developmentById = (snapshot: Snapshot, needId: string) => developmentNeeds(snapshot).find((item) => item.needId === needId);
export const trainingById = (snapshot: Snapshot, trainingId: string) => trainings(snapshot).find((item) => item.trainingId === trainingId);
/** Every revision of a need, newest first. */
export const developmentHistory = (snapshot: Snapshot, needId: string): DevelopmentNeedVersion[] => [...(indexOf(snapshot).needHistory.get(needId) ?? [])];
/**
 * Reassessment result shown for a need: Retraining, Meets requirement, "pending" or null. Pending means Completed with
 * a training of this round Passed and no decision yet; a need closed another way (no passed training) has none to wait for.
 */
export function reassessmentFor(snapshot: Snapshot, needId: string) {
  const history = indexOf(snapshot).needHistory.get(needId) ?? [];
  const state = reassessmentOf(history);
  return state === "pending" && !passedTrainingCount(trainings(snapshot), needId, retrainedAt(history)) ? null : state;
}
export const REASSESSMENT_PENDING = "Needs reassessment";

/** The decision HR still records for a training in Training Tracking: "follow-up", "reassessment" or null. */
export const trainingDecision = (snapshot: Snapshot, record: TrainingVersion) =>
  pendingDecision(trainingHistory(snapshot, record.trainingId), developmentById(snapshot, record.developmentNeedId), developmentHistory(snapshot, record.developmentNeedId));

/** What HR does next for a requirement (Development Requirement, Next step). */
export type NeedStep =
  | { kind: "decide"; decision: "result" | "follow-up" | "reassessment"; training: TrainingVersion }
  | { kind: "running"; training: TrainingVersion; retraining: boolean }
  | { kind: "create"; retraining: boolean }
  | { kind: "closed"; meets: boolean };

/**
 * A decision HR still owes on one of the requirement's trainings comes first (the newest one), then the training under
 * way, then a training still to create while the requirement is open. A training is a retraining when a Retraining was
 * recorded for this requirement (Passed reassessment or Not Passed follow-up) before the training was created.
 */
export function nextStep(snapshot: Snapshot, need: DevelopmentNeedVersion): NeedStep {
  const own = trainings(snapshot).filter((item) => item.developmentNeedId === need.needId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const training of own) {
    const decision = trainingDecision(snapshot, training);
    if (decision) return { kind: "decide", decision, training };
  }
  const followUps = snapshot.trainingVersions.filter((item) => item.developmentNeedId === need.needId && item.followUp === "Retraining").map((item) => item.createdAt);
  const retried = [retrainedAt(developmentHistory(snapshot, need.needId)), ...followUps].filter((at): at is string => Boolean(at));
  const running = own.find((item) => item.status === "Planned" || item.status === "In Progress");
  if (running) {
    const created = trainingHistory(snapshot, running.trainingId).at(-1)?.createdAt ?? running.createdAt;
    return { kind: "running", training: running, retraining: retried.some((at) => at <= created) };
  }
  if (need.status !== "Completed") return { kind: "create", retraining: retried.length > 0 };
  return { kind: "closed", meets: reassessmentFor(snapshot, need.needId) === "Meets requirement" };
}

/** Live comparison (latest skill data) of a gap-based need's requirement on the employee's current position, if it is part of it. */
export function sourceFinding(snapshot: Snapshot, need: DevelopmentNeedVersion): CompetencyFinding | undefined {
  const employee = need.sourceType === "competency_gap" ? employeeById(snapshot, need.employeeId) : undefined;
  return employee ? currentGap(snapshot, employee)?.findings.find((item) => item.requirementId === need.sourceRef) : undefined;
}

/** What a revision changed besides its status, for history lines: priority, method, PIC, reassessment. */
export function revisionChanges(version: DevelopmentNeedVersion, previous?: DevelopmentNeedVersion, t: Translate = plainText): string[] {
  const changes: string[] = [];
  if (previous && version.priority !== previous.priority) changes.push(t("Priority {from} → {to}", { from: previous.priority, to: version.priority }));
  if (previous && (version.method ?? "") !== (previous.method ?? "")) changes.push(t("Method: {from} → {to}", { from: previous.method || "—", to: version.method || "—" }));
  if (previous && (version.pic ?? "") !== (previous.pic ?? "")) changes.push(`PIC: ${previous.pic || "—"} → ${version.pic || "—"}`);
  if (version.reassessment) changes.push(`Reassessment: ${version.reassessment}`);
  return changes;
}

/** Objective suggested from a gap finding (interview D4): the competency that falls short and its target level. */
export function objectiveFromFinding(finding: Pick<CompetencyFinding, "competencyName" | "actualLevel" | "requiredLevel">): string {
  return finding.actualLevel === null
    ? `Naikkan ${finding.competencyName} ke level ${finding.requiredLevel}`
    : `Naikkan ${finding.competencyName} dari level ${finding.actualLevel} ke ${finding.requiredLevel}`;
}
/** B14 (interview D4, 14 Oct 2026): the objective also says how the gap is closed, taken from the chosen Method. */
export const objectiveWithMethod = (objective: string, method: string) => objective && method.trim() ? `${objective} melalui ${method.trim()}` : objective;
export const trainingHistory = (snapshot: Snapshot, trainingId: string) => snapshot.trainingVersions.filter((item) => item.trainingId === trainingId).sort((a, b) => b.revision - a.revision);

export const sourceTypeLabel: Record<DevelopmentSourceType, string> = {
  competency_gap: "Competency Gap",
  role_change: msg("Position Change"),
  performance_context: "Performance Review",
};
/** Q9: a new requirement starts from a competency gap; Position Change and Performance Review stay as other sources. */
export const DEFAULT_SOURCE_TYPE: DevelopmentSourceType = "competency_gap";

/** Resolves a development need's source reference to a readable label and a link to the source record (FR-D4-005). */
export function describeSource(snapshot: Snapshot, need: Pick<DevelopmentNeedVersion, "sourceType" | "sourceRef" | "employeeId">, t: Translate = plainText): { label: string; href: string | null } {
  if (need.sourceType === "competency_gap") {
    const requirement = snapshot.reference.positionRequirements.find((item) => item.id === need.sourceRef);
    const competency = snapshot.reference.competencies.find((item) => item.id === requirement?.competencyId);
    return { label: competency ? t("{competency} (min. level {level})", { competency: competency.name, level: String(requirement?.minProficiencyLevel) }) : t("Competency requirement"), href: `/competency/${need.employeeId}` };
  }
  if (need.sourceType === "role_change") {
    const assessment = snapshot.competency.find((item) => item.id === need.sourceRef);
    return { label: assessment ? t("Position change assessment · {date}", { date: formatDate(assessment.effectiveDate, t.language) }) : t("Position change assessment"), href: `/competency/${need.employeeId}/history` };
  }
  const assessment = snapshot.kpiAssessments?.find((item) => item.id === need.sourceRef);
  if (assessment) return { label: `Performance Review ${formatPeriod(assessment.period, t.language)}`, href: `/performance/scorecard/${assessment.id}` };
  // Needs raised before FR-D4-001 v3.1 point at an older, separate evaluation.
  const evaluation = snapshot.performance.find((item) => item.id === need.sourceRef);
  return { label: evaluation ? t("Performance Review {period} (evaluasi lama)", { period: formatPeriod(evaluation.period, t.language) }) : "Performance Review", href: evaluation ? `/performance/${evaluation.id}` : null };
}

export function trainingSource(snapshot: Snapshot, record: TrainingVersion) {
  return developmentById(snapshot, record.developmentNeedId);
}

// en-US month names ("Sep", not en-GB "Sept"), in day-month-year order: "12 Oct 2026", "Sep 2026". Indonesian differs
// in four months only (Mei, Agu, Okt, Des). Without a language (server, tests) the output stays the English one.
const MONTH_UTC = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const MONTH_LOCAL = new Intl.DateTimeFormat("en-US", { month: "short" });
const MONTH_UTC_ID = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });
const MONTH_LOCAL_ID = new Intl.DateTimeFormat("id-ID", { month: "short" });

export function formatPeriod(period: string | undefined, language?: Language | null): string {
  if (!period) return "—";
  const date = new Date(`${period.slice(0, 7)}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? period : `${(language === "id" ? MONTH_UTC_ID : MONTH_UTC).format(date)} ${date.getUTCFullYear()}`;
}

export function formatDate(value: string | undefined, language?: Language | null): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : `${date.getDate()} ${(language === "id" ? MONTH_LOCAL_ID : MONTH_LOCAL).format(date)} ${date.getFullYear()}`;
}

const TIME_LOCAL = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Date and local time of a save, so changes on the same day can be told apart. A plain date stays a date. */
export function formatDateTime(value: string | undefined, language?: Language | null): string {
  if (!value || value.length === 10) return formatDate(value, language);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${formatDate(value, language)}, ${TIME_LOCAL.format(date)}`;
}

/** How long a change is labelled in a list. One day for every viewer: D4 keeps no per-user "last seen" time. */
export const RECENT_MS = 24 * 60 * 60 * 1000;

/** "New" for a record created in the last day, "Updated" for one changed in it, otherwise nothing. */
export function recentLabel(version: { createdAt: string; revision: number }, now: number): "New" | "Updated" | null {
  if (!(now - new Date(version.createdAt).getTime() < RECENT_MS)) return null;
  return version.revision <= 1 ? "New" : "Updated";
}

export function formatScore(value: number | null | undefined, scale = 5): string {
  return value === null || value === undefined ? "—" : `${scoreText(value)} / ${scale}`;
}

/**
 * Score in a list whose column header carries the scale, "Total KPI (/100)" (PST 2): the bare number, written once per
 * row without "/ 100". A row saved on the other scale keeps its own, so a 1–5 score is never read as out of 100.
 */
export const listScore = (value: number | null | undefined, version: string | null | undefined, listScale: number) =>
  scaleMaxOf(version) === listScale ? scoreText(value) : formatScore(value, scaleMaxOf(version));

/** KPI gap as shown: signed, "n/a (skala 1–5)" for a 1–5 score, "—" without a score. */
export function formatGap(score: number | null | undefined, definitionVersion?: string | null, t: Translate = plainText): string {
  if (score === null || score === undefined) return "—";
  const gap = kpiGap(score, definitionVersion);
  if (gap === null) return t("n/a (skala 1–5)");
  return `${gap > 0 ? "+" : ""}${scoreText(gap)}`;
}

/** "4.10 / 5" for a V5.1 scorecard, "82.50 / 100" for V6: every scorecard shows the scale it was saved under. */
export const formatScorecard = (scorecard: { overallScore: number | null; definitionVersion?: string | null }): string => formatScore(scorecard.overallScore, scaleMaxOf(scorecard.definitionVersion));

/** Raw-score criteria from KPI Scorecard V3.1/V5.1 sheet "KPI Scoring Card"; shared by KPI and evaluation results. */
export const SCORE_LABELS: Record<number, string> = { 1: msg("Very Poor"), 2: msg("Poor"), 3: msg("Fair"), 4: msg("Good"), 5: msg("Very Good") };

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

// Dates follow WIB, not UTC: a form opened before 07:00 WIB must not default to yesterday.
export const today = () => localToday();
export const thisMonth = () => localMonth();

export function includesText(haystack: string, needle: string) {
  return !needle.trim() || haystack.toLocaleLowerCase().includes(needle.trim().toLocaleLowerCase());
}

/** What list search matches for an employee: name, Employee ID and position title (interview D4: find a user by name or position). */
export const employeeSearchText = (snapshot: Snapshot, employee?: EmployeeReference) =>
  `${employee?.fullName ?? ""} ${employee?.employeeId ?? ""} ${positionOf(snapshot, employee)?.title ?? ""}`;

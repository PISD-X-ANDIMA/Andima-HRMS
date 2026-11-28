import type { CompetencyAssessment, CompetencyFinding } from "../competency/types";
import type { DevelopmentNeedVersion, DevelopmentPriority, DevelopmentReassessment, DevelopmentSourceType, DevelopmentStatus } from "../development/types";
import type { TrainingFollowUp, TrainingStatus, TrainingVersion } from "../training/types";
import { ApiError } from "./errors";
import { plainText, type Translate } from "./text";

/**
 * Integrity rules shared by the fixture source (browser preview) and the API handlers, so both
 * reject the same input. Messages are shown to the user as-is; a broken rule is a validation error (422).
 */

const JAKARTA = "Asia/Jakarta";

/** Today as YYYY-MM-DD in WIB. `toISOString()` is UTC and returns yesterday before 07:00 WIB. */
export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JAKARTA, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export const localMonth = (now = new Date()) => localToday(now).slice(0, 7);

/**
 * Daily KPI is self-service: every account linked to an employee scores its own day, HR and managers included, except
 * directors (MANAGEMENT). Product decision 13 Nov 2026: directors only read D4, also for their own KPI, although the
 * interview of 14 Oct (00:33:23, X-07) had a director scoring her own day. The position must also have a KPI role,
 * which is checked separately.
 */
export const canFillDaily = (role: string, employeeId: string | null | undefined) => role !== "MANAGEMENT" && Boolean(employeeId);

/** Directors hold DIR-* positions (the same rule d4_current_role() uses to give them the MANAGEMENT role). */
export const isDirectorPosition = (code: string | null | undefined) => Boolean(code?.startsWith("DIR-"));

/** Interview D4 (14 Oct 2026, B13): a development requirement must have a PIC so it can be followed up. */
export function assertPicFilled(pic: string | undefined) {
  if (pic !== undefined && !pic.trim()) throw new ApiError("VALIDATION_FAILED", "PIC wajib diisi.");
}

/** A daily entry is for today or an earlier day of the running WIB period; the database enforces the same. */
export function assertDailyDate(date: string, now = new Date()) {
  if (date > localToday(now)) throw new ApiError("VALIDATION_FAILED", "Tanggal Daily KPI tidak boleh lebih dari hari ini.");
  if (date.slice(0, 7) !== localMonth(now)) throw new ApiError("VALIDATION_FAILED", `Daily KPI hanya bisa diisi untuk hari di periode berjalan (${localMonth(now)}).`);
}

type PeriodRecord = { readonly id: string; readonly employeeId: string; readonly period: string; readonly createdAt: string };

/** Latest record of an employee for a period; an older one in the same period is an earlier revision. */
export function latestForPeriod<T extends PeriodRecord>(records: readonly T[], employeeId: string, period: string): T | undefined {
  return records.filter((item) => item.employeeId === employeeId && item.period === period)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * Assessment periods are opened and closed by D4, not picked freely (lecturer review, 24 Nov 2026). The running month and
 * the month before it are open, so last month can still be reviewed during this one. An older period is open only while
 * HR has reopened it (d4_period_reopenings, migration 20261124150000); the newest row for a period decides, so a row with
 * an earlier end closes it again. Nothing before FIRST_PERIOD, the month D4 records start, can be assessed.
 */
export const FIRST_PERIOD = "2026-09";
export interface PeriodReopening { readonly period: string; readonly openUntil: string; readonly reason: string; readonly createdAt: string }
export type PeriodState = "open" | "closed" | "not-started" | "before-start";
export const PERIOD_NOT_STARTED = "Period belum dimulai. Performance Review hanya untuk periode yang sudah berjalan.";
export const PERIOD_CLOSED = "Periode ini sudah ditutup. Penilaian hanya bisa disimpan di periode yang terbuka; HR dapat membuka kembali periode lama.";
export const PERIOD_BEFORE_START = "Penilaian D4 dimulai dari periode September 2026.";

export function previousMonth(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function periodState(period: string, reopenings: readonly PeriodReopening[] = [], now = new Date()): PeriodState {
  const current = localMonth(now);
  if (period > current) return "not-started";
  if (period < FIRST_PERIOD) return "before-start";
  if (period >= previousMonth(current)) return "open";
  const latest = reopenings.filter((item) => item.period === period).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return latest && latest.openUntil >= localToday(now) ? "open" : "closed";
}

/** Open periods, newest first: the running month, the month before it, then any reopened older period. */
export function openPeriods(reopenings: readonly PeriodReopening[] = [], now = new Date()): string[] {
  const current = localMonth(now);
  const candidates = new Set([current, previousMonth(current), ...reopenings.map((item) => item.period)]);
  return [...candidates].filter((period) => periodState(period, reopenings, now) === "open").sort().reverse();
}

export function assertPeriodOpen(period: string, reopenings: readonly PeriodReopening[] = [], now = new Date()) {
  const state = periodState(period, reopenings, now);
  if (state === "not-started") throw new ApiError("VALIDATION_FAILED", PERIOD_NOT_STARTED);
  if (state === "before-start") throw new ApiError("VALIDATION_FAILED", PERIOD_BEFORE_START);
  if (state === "closed") throw new ApiError("VALIDATION_FAILED", PERIOD_CLOSED);
}

export type PeriodReopeningDraft = { period: string; openUntil: string; reason: string };

/** Periods HR can reopen or close again: from FIRST_PERIOD up to the month before last (later ones are open anyway). */
export function reopenablePeriods(now = new Date()): string[] {
  const periods: string[] = [];
  for (let period = previousMonth(previousMonth(localMonth(now))); period >= FIRST_PERIOD; period = previousMonth(period)) periods.push(period);
  return periods;
}

/**
 * HR reopening an older period, or closing it again with an end date that has passed (the newest row decides).
 * Same checks as the d4_period_reopenings constraints, so the form answers before the database does.
 */
export function assertReopening(input: PeriodReopeningDraft, now = new Date()) {
  if (input.period < FIRST_PERIOD) throw new ApiError("VALIDATION_FAILED", PERIOD_BEFORE_START);
  if (!reopenablePeriods(now).includes(input.period)) throw new ApiError("VALIDATION_FAILED", "Periode ini masih terbuka dengan sendirinya. Yang bisa dibuka kembali hanya periode sebelum bulan lalu.");
  if (input.openUntil < `${input.period}-01`) throw new ApiError("VALIDATION_FAILED", "Tanggal Dibuka sampai tidak boleh sebelum awal periode.");
  const reason = input.reason.trim().length;
  if (reason < 5 || reason > 500) throw new ApiError("VALIDATION_FAILED", "Alasan wajib diisi, 5 sampai 500 karakter.");
}

/** Interview 13 Nov 2026 (0:52:35): a period's assessment is revised at most once, so an employee has at most two records per period. */
export const MAX_PERIOD_REVISIONS = 1;

/** Revisions still allowed for an employee's period. With no record yet the next save is the first record, not a revision. */
export function revisionsLeft(records: readonly PeriodRecord[], employeeId: string, period: string): number {
  const saved = records.filter((item) => item.employeeId === employeeId && item.period === period).length;
  return saved ? Math.max(0, MAX_PERIOD_REVISIONS + 1 - saved) : MAX_PERIOD_REVISIONS;
}

/**
 * One active record per employee and period (FR-01.4, FR-02.9, BR-06.2). A second record is only
 * accepted as an explicit revision of the current one, so it never hides another record silently, and only once.
 */
export function assertPeriodRevision(records: readonly PeriodRecord[], employeeId: string, period: string, revisionOf: string | null | undefined, label: string) {
  const current = latestForPeriod(records, employeeId, period);
  // A revision of an older record: someone saved a newer one after this form was opened (another tab or device).
  // Checked first: the conflict reloads the data, and the reloaded form then shows whether a revision is still allowed.
  if (current && revisionOf && revisionOf !== current.id) throw new ApiError("CONFLICT", `Sudah ada revisi ${label} yang lebih baru untuk periode ini sejak form dibuka.`);
  if (current && !revisionsLeft(records, employeeId, period)) throw new ApiError("VALIDATION_FAILED", `${label} periode ini sudah pernah direvisi; batasnya satu revisi per periode.`);
  if (current && !revisionOf) throw new ApiError("VALIDATION_FAILED", `${label} untuk periode ini sudah ada. Simpan sebagai revisi atau buka riwayatnya.`);
  if (!current && revisionOf) throw new ApiError("VALIDATION_FAILED", `${label} yang direvisi tidak cocok dengan pegawai atau periodenya.`);
}

/** Revision number of a record within its employee and period (1 = first record). */
export function revisionNumber<T extends PeriodRecord>(records: readonly T[], record: T): number {
  return records.filter((item) => item.employeeId === record.employeeId && item.period === record.period && item.createdAt <= record.createdAt).length;
}

/** An evaluator never assesses themselves. */
export function assertNotSelf(actorEmployeeId: string, employeeId: string) {
  if (actorEmployeeId === employeeId) throw new ApiError("VALIDATION_FAILED", "Penilaian untuk diri sendiri harus dilakukan oleh HR atau manager lain.");
}

/** A completed development need does not take new training. */
export function assertNeedOpen(need: Pick<DevelopmentNeedVersion, "status"> | undefined) {
  if (need?.status === "Completed") throw new ApiError("VALIDATION_FAILED", "Development requirement ini sudah Completed; training baru harus merujuk ke requirement yang masih terbuka.");
}

/** An unfinished need already raised from the same source, if any (prevents duplicate needs for one gap). */
export function openNeedFor(needs: readonly DevelopmentNeedVersion[], employeeId: string, sourceType: DevelopmentSourceType, sourceRef: string) {
  return needs.find((item) => item.employeeId === employeeId && item.sourceType === sourceType && item.sourceRef === sourceRef && item.status !== "Completed");
}

/**
 * One open need per competency gap. Other sources may legitimately yield several needs (an evaluation
 * can recommend more than one development activity), so they are not limited.
 */
export function assertNoOpenNeed(needs: readonly DevelopmentNeedVersion[], employeeId: string, sourceType: DevelopmentSourceType, sourceRef: string) {
  if (sourceType === "competency_gap" && openNeedFor(needs, employeeId, sourceType, sourceRef)) throw new ApiError("VALIDATION_FAILED", "Gap kompetensi ini sudah memiliki development requirement yang belum selesai.");
}

const TRAINING_STEP: Record<TrainingStatus, number> = { Planned: 0, "In Progress": 1, Completed: 2, Cancelled: 2 };

/** Moving back (e.g. Completed → Planned) or reopening a cancelled training. */
export const isTrainingRollback = (from: TrainingStatus, to: TrainingStatus) =>
  from !== to && (TRAINING_STEP[to] < TRAINING_STEP[from] || from === "Cancelled" || (from === "Completed" && to === "Cancelled"));

export function assertTrainingChange(from: TrainingStatus, to: TrainingStatus, notes: string) {
  if (isTrainingRollback(from, to) && !notes.trim()) throw new ApiError("VALIDATION_FAILED", `Alasan wajib diisi saat status mundur dari ${from} ke ${to}.`);
}

const DEVELOPMENT_STEP: Record<DevelopmentStatus, number> = { Identified: 0, Planned: 1, "In Progress": 2, Completed: 3 };

/** Moving back (e.g. Completed → Planned). */
export const isDevelopmentRollback = (from: DevelopmentStatus, to: DevelopmentStatus) => DEVELOPMENT_STEP[to] < DEVELOPMENT_STEP[from];

/**
 * A status update must change the status, and moving back needs a reason (same rule as training).
 * Completing a need is expected to follow a passed training; otherwise the reason goes in Notes.
 */
export function assertDevelopmentChange(from: DevelopmentStatus, to: DevelopmentStatus, notes: string, openTrainings = 0, passedTrainings = 0) {
  if (from === to) throw new ApiError("VALIDATION_FAILED", `Status sudah ${to}. Pilih status lain.`);
  if (isDevelopmentRollback(from, to) && !notes.trim()) throw new ApiError("VALIDATION_FAILED", `Alasan wajib diisi saat status mundur dari ${from} ke ${to}.`);
  if (to === "Completed" && openTrainings > 0 && !notes.trim()) throw new ApiError("VALIDATION_FAILED", "Training untuk requirement ini masih Planned atau In Progress. Selesaikan atau batalkan dulu, atau jelaskan alasannya di Notes.");
  if (to === "Completed" && passedTrainings === 0 && !notes.trim()) throw new ApiError("VALIDATION_FAILED", "Belum ada training berhasil Passed untuk requirement ini. Jelaskan di Notes mengapa requirement tetap diselesaikan.");
}

/** Stored and shown as is (Q11: the value is the English label). */
export const REASSESSMENTS = ["Retraining", "Meets requirement"] as const;

/** A requested revision. Priority, method and PIC left out keep their current value. */
export type DevelopmentChange = { status: DevelopmentStatus; notes: string; priority?: DevelopmentPriority; method?: string; pic?: string; reassessment?: DevelopmentReassessment };
export type DevelopmentRevision = { status: DevelopmentStatus; notes: string; priority: DevelopmentPriority; method: string; pic: string; reassessment: DevelopmentReassessment | null };

/**
 * The next revision of a need, checked the same way by the fixture and the server. Priority, method and PIC stay
 * editable after creation (interview D4: priority follows context, e.g. a tax policy change). A reassessment is HR's
 * decision after a passed training, recorded from Training Tracking: Retraining (re)opens the need as Planned so
 * training can be repeated, Meets requirement completes it or keeps it Completed. `history` is every revision of this
 * need; without it only `current` is known.
 */
export function nextDevelopmentRevision(current: DevelopmentNeedVersion, change: DevelopmentChange, latestNeeds: readonly DevelopmentNeedVersion[], latestTrainings: readonly TrainingOutcome[], history: readonly DevelopmentNeedVersion[] = []): DevelopmentRevision {
  const versions = history.length ? history : [current];
  const next: DevelopmentRevision = {
    status: change.status, notes: change.notes, priority: change.priority ?? current.priority,
    method: (change.method ?? current.method ?? "").trim(), pic: (change.pic ?? current.pic ?? "").trim(), reassessment: change.reassessment ?? null,
  };
  if (next.reassessment === "Retraining" && next.status !== "Planned") throw new ApiError("VALIDATION_FAILED", "Retraining membuka kembali requirement dengan status Planned.");
  if (next.reassessment === "Meets requirement" && next.status !== "Completed") throw new ApiError("VALIDATION_FAILED", "Meets requirement berarti requirement Completed.");
  const edited = next.priority !== current.priority || next.method !== (current.method ?? "") || next.pic !== (current.pic ?? "");
  // Meets requirement twice changes nothing. Every Retraining starts a new round, even on a need already reopened.
  const repeated = next.reassessment === "Meets requirement" && reassessmentOf(versions) === "Meets requirement";
  if (next.status === current.status && !edited && (!next.reassessment || repeated)) throw new ApiError("VALIDATION_FAILED", "Tidak ada perubahan untuk disimpan.");
  // Retraining is the reason for moving back, so it needs no extra note.
  if (next.status !== current.status && next.reassessment !== "Retraining") {
    // After a Retraining only trainings passed since then count: the earlier pass is why the need was reopened.
    assertDevelopmentChange(current.status, next.status, next.notes, openTrainingCount(latestTrainings, current.needId), passedTrainingCount(latestTrainings, current.needId, retrainedAt(versions)));
  }
  // Reopening must not leave two open needs for the same gap (a new one may have been raised after completion).
  if (current.status === "Completed" && next.status !== "Completed") {
    assertNoOpenNeed(latestNeeds.filter((item) => item.needId !== current.needId), current.employeeId, current.sourceType, current.sourceRef);
  }
  return next;
}

/**
 * The reassessment that applies to a need now, from its revisions (any order). A Completed need shows the decision
 * recorded since it last became Completed, or "pending"; a need reopened by Retraining shows Retraining until it is
 * Completed again.
 */
export function reassessmentOf(history: readonly Pick<DevelopmentNeedVersion, "revision" | "status" | "reassessment">[]): DevelopmentReassessment | "pending" | null {
  const versions = [...history].sort((a, b) => b.revision - a.revision);
  const done = versions[0]?.status === "Completed";
  for (const version of versions) {
    if ((version.status === "Completed") !== done) break;
    if (version.reassessment && (done || version.reassessment === "Retraining")) return version.reassessment;
  }
  return done ? "pending" : null;
}

/** Planned/In Progress trainings of a need: completing the need while these run needs a reason. */
export const openTrainingCount = (trainings: readonly { developmentNeedId: string; status: TrainingStatus }[], needId: string) =>
  trainings.filter((item) => item.developmentNeedId === needId && (item.status === "Planned" || item.status === "In Progress")).length;

type TrainingOutcome = { developmentNeedId: string; status: TrainingStatus; result: string; createdAt: string };

/** When a need was last reopened by Retraining (latest such revision), if ever. */
export const retrainedAt = (history: readonly Pick<DevelopmentNeedVersion, "reassessment" | "createdAt">[]) =>
  history.reduce<string | undefined>((last, item) => item.reassessment === "Retraining" && (!last || item.createdAt > last) ? item.createdAt : last, undefined);

/** Completed trainings of a need that the employee passed; with `since`, only those recorded after it (the current round). */
export const passedTrainingCount = (trainings: readonly TrainingOutcome[], needId: string, since?: string) =>
  trainings.filter((item) => item.developmentNeedId === needId && item.status === "Completed" && item.result === "Passed" && (!since || item.createdAt > since)).length;

/** Outcome of a completed training: Not Passed keeps the need open so the training can be repeated. */
export const TRAINING_RESULTS = ["Passed", "Not Passed"] as const;

export function assertTrainingResult(status: TrainingStatus, result: string) {
  if (status === "Completed" && !(TRAINING_RESULTS as readonly string[]).includes(result)) throw new ApiError("VALIDATION_FAILED", "Pilih hasil training yang Completed: Passed atau Not Passed.");
}

/** A gap-based need is raised only after a competency assessment is saved for the employee's active position. */
export function assertGapAssessed(competency: readonly { employeeId: string; positionId: string }[], employee: { id: string; positionId?: string | null } | undefined, sourceType: DevelopmentSourceType) {
  if (sourceType !== "competency_gap") return;
  if (!employee?.positionId || !competency.some((item) => item.employeeId === employee.id && item.positionId === employee.positionId))
    throw new ApiError("VALIDATION_FAILED", "Simpan penilaian kompetensi untuk posisi aktif sebelum membuat development requirement dari gap-nya.");
}

/**
 * A completed training already happened, so its date cannot be later than today. A planned one has not started, so it
 * cannot be before today (lecturer, 24 Nov 2026); In Progress may have started earlier.
 */
export function assertTrainingDate(status: TrainingStatus, date: string, now = new Date()) {
  if (status === "Completed") assertNotFutureDate(date, "Tanggal training yang sudah selesai");
  if (status === "Planned" && date < localToday(now)) throw new ApiError("VALIDATION_FAILED", "Tanggal training Planned tidak boleh sebelum hari ini.");
}

/** The same training (name and date) twice on one requirement is a double entry (lecturer, 24 Nov 2026); a cancelled one no longer counts. */
export function assertNoDuplicateTraining(trainings: readonly Pick<TrainingVersion, "developmentNeedId" | "activity" | "date" | "status">[], needId: string, activity: string, date: string) {
  const name = activity.trim().toLowerCase();
  if (trainings.some((item) => item.developmentNeedId === needId && item.date === date && item.status !== "Cancelled" && item.activity.trim().toLowerCase() === name))
    throw new ApiError("VALIDATION_FAILED", "Requirement ini sudah punya training dengan nama dan tanggal yang sama.");
}

/**
 * Message when an evaluation date falls before its period starts (D4-FN-01), or "" when it does not. Together with
 * assertNotFutureDate this keeps the period at or before the current month. A missing date is reported elsewhere.
 */
export const periodDateError = (period: string, date: string | null | undefined, t: Translate = plainText) =>
  date && period && date < `${period}-01` ? t("Tanggal evaluasi tidak boleh sebelum awal periode.") : "";

export function assertEvaluationInPeriod(period: string, date: string | null | undefined) {
  const message = periodDateError(period, date);
  if (message) throw new ApiError("VALIDATION_FAILED", message);
}

/** Evaluation dates are when the evaluation happened, so they cannot be later than today (WIB). */
export function assertNotFutureDate(date: string | null | undefined, label = "Tanggal evaluasi") {
  if (date && date > localToday()) throw new ApiError("VALIDATION_FAILED", `${label} tidak boleh lebih dari hari ini.`);
}

/** Q16 (20 Oct 2026): every Not Passed training needs a follow-up from HR, recorded once as a new version of it. */
export const TRAINING_FOLLOW_UPS = ["Retraining", "Other follow-up"] as const;

type FollowUpVersion = Pick<TrainingVersion, "revision" | "status" | "result" | "followUp">;

/**
 * The follow-up recorded for a training's current Not Passed result, from its versions (any order), or null. Later
 * versions with the same result (notes only) keep it; a version with another status or result ends the search.
 */
export function followUpOf(history: readonly FollowUpVersion[]): TrainingFollowUp | null {
  for (const version of [...history].sort((a, b) => b.revision - a.revision)) {
    if (version.status !== "Completed" || version.result !== "Not Passed") return null;
    if (version.followUp) return version.followUp;
  }
  return null;
}

/** `activity` and `date` describe the new training and are used only for Retraining. */
export type TrainingFollowUpInput = { followUp: TrainingFollowUp; notes: string; activity?: string; date?: string };

/**
 * Checked the same way by the fixture and the server: only a training whose latest version is Completed + Not Passed
 * takes a follow-up, and only once. Retraining creates the next training for the same, still open requirement; any
 * other follow-up (coaching, rotation, escalation to the supervisor) needs a note.
 */
export function assertTrainingFollowUp(history: readonly FollowUpVersion[], input: TrainingFollowUpInput, need: Pick<DevelopmentNeedVersion, "status"> | undefined) {
  const latest = [...history].sort((a, b) => b.revision - a.revision)[0];
  if (latest?.status !== "Completed" || latest.result !== "Not Passed") throw new ApiError("VALIDATION_FAILED", "Tindak lanjut hanya dicatat untuk training Completed dengan hasil Not Passed.");
  if (followUpOf(history)) throw new ApiError("VALIDATION_FAILED", "Tindak lanjut untuk hasil Not Passed ini sudah dicatat. Lihat riwayat training.");
  if (input.followUp === "Other follow-up" && !input.notes.trim()) throw new ApiError("VALIDATION_FAILED", "Catatan wajib diisi untuk Other follow-up: coaching, rotasi, atau eskalasi ke atasan.");
  if (input.followUp === "Retraining") {
    if (!input.activity?.trim() || !input.date) throw new ApiError("VALIDATION_FAILED", "Isi nama training dan tanggal untuk Retraining.");
    if (need?.status === "Completed") throw new ApiError("VALIDATION_FAILED", "Development requirement ini sudah Completed; Retraining butuh requirement yang masih terbuka. Pilih Other follow-up atau buka kembali requirement-nya.");
  }
}

/** Notes of the training created by Retraining: where it comes from, then HR's own note. */
export const retrainingNotes = (previous: Pick<TrainingVersion, "activity" | "date">, notes: string, result = "Not Passed") =>
  [`Retraining setelah "${previous.activity}" (${previous.date}) ${result === "Passed" ? "Passed, tetapi gap belum tertutup" : "Not Passed"}.`, notes.trim()].filter(Boolean).join("\n");

type CompletionVersion = Pick<TrainingVersion, "revision" | "status" | "result" | "followUp" | "createdAt">;
type NeedRevision = Pick<DevelopmentNeedVersion, "revision" | "status" | "reassessment" | "createdAt">;

/** When a training was recorded Completed with its current result: the first version of that run (later ones only add notes). */
export function completedAt(history: readonly CompletionVersion[]): string | undefined {
  const versions = [...history].sort((a, b) => b.revision - a.revision);
  let at = versions[0]?.createdAt;
  for (const version of versions) {
    if (version.status !== "Completed" || version.result !== versions[0].result) break;
    at = version.createdAt;
  }
  return at;
}

/**
 * What HR still has to record for a training in Training Tracking: "follow-up" for a Not Passed result without one,
 * "reassessment" for a Passed result its requirement has no decision for yet, else null. A Retraining recorded after
 * the pass decides it; so does Meets requirement on the Completed requirement.
 */
export function pendingDecision(history: readonly CompletionVersion[], need: Pick<DevelopmentNeedVersion, "status"> | undefined, needHistory: readonly NeedRevision[]): "result" | "follow-up" | "reassessment" | null {
  const latest = [...history].sort((a, b) => b.revision - a.revision)[0];
  if (latest?.status !== "Completed") return null;
  // Older trainings (sample data of 14 Oct 2026) were completed with free text instead of Passed or Not Passed: HR still
  // has to record the result, so they wait for it instead of reading as finished.
  if (!(TRAINING_RESULTS as readonly string[]).includes(latest.result)) return "result";
  if (latest.result === "Not Passed") return followUpOf(history) ? null : "follow-up";
  if (latest.result !== "Passed" || !need) return null;
  const since = retrainedAt(needHistory);
  if (since && since > (completedAt(history) ?? "")) return null;
  return need.status !== "Completed" || reassessmentOf(needHistory) === "pending" ? "reassessment" : null;
}

/** HR's decision in the same save as the result: Passed → a reassessment, Not Passed → a follow-up (Q16). */
export const TRAINING_DECISIONS = ["Meets requirement", "Retraining", "Other follow-up"] as const;
export type TrainingDecision = typeof TRAINING_DECISIONS[number];
/** `activity` and `date` describe the next training and are used only for Retraining. */
export type TrainingCompletion = { result: typeof TRAINING_RESULTS[number]; decision: TrainingDecision; notes: string; activity?: string; date?: string };

type LevelFinding = Pick<CompetencyFinding, "competencyName" | "requiredLevel" | "actualLevel" | "status">;

/**
 * Decision 13 Nov 2026: a requirement's progress has one writer, Training Tracking. Its status follows its activities
 * (training, coaching, mentoring: anything recorded there) in the current round, i.e. after the last Retraining;
 * Cancelled ones never count. Completed is never derived: it needs evidence (Meets requirement after a passed
 * training, or the gap met, see closeGapBlockedReason). supabase/migrations/20261113120000 checks the same table.
 */
export function statusFromTrainings(trainings: readonly TrainingOutcome[], needId: string, since?: string): Exclude<DevelopmentStatus, "Completed"> {
  const round = trainings.filter((item) => item.developmentNeedId === needId && item.status !== "Cancelled" && (!since || item.createdAt > since));
  if (!round.length) return "Identified";
  return round.every((item) => item.status === "Planned") ? "Planned" : "In Progress";
}

/** The revision that brings a requirement in line with its trainings, or null when it already is or is Completed. */
export function trainingSyncRevision(need: DevelopmentNeedVersion, latestTrainings: readonly TrainingOutcome[], history: readonly DevelopmentNeedVersion[]): DevelopmentRevision | null {
  if (need.status === "Completed") return null;
  const status = statusFromTrainings(latestTrainings, need.needId, retrainedAt(history.length ? history : [need]));
  if (status === need.status) return null;
  return { status, notes: "Mengikuti Training Tracking.", priority: need.priority, method: need.method ?? "", pic: need.pic ?? "", reassessment: null };
}

/**
 * Path B of the decision of 13 Nov 2026: a Competency Gap requirement closes without a training once the live
 * comparison shows the level met (e.g. after coaching, or the level was updated in D3). "" when it may close.
 * `finding` is that requirement on the employee's current position; undefined when it is not part of it.
 */
export function closeGapBlockedReason(need: Pick<DevelopmentNeedVersion, "sourceType" | "status">, finding: LevelFinding | undefined, openTrainings: number, t: Translate = plainText): string {
  if (need.sourceType !== "competency_gap") return t("Hanya requirement dari Competency Gap yang bisa ditutup dengan bukti level; yang lain diselesaikan lewat Training Tracking.");
  if (need.status === "Completed") return t("Requirement sudah Completed.");
  if (openTrainings > 0) return t("Masih ada training Planned atau In Progress; selesaikan lewat Training Tracking.");
  if (!finding) return t("Persyaratan ini bukan bagian dari posisi pegawai saat ini.");
  if (finding.status !== "Terpenuhi") return t("{competency}: level saat ini {current}, required {required}.", { competency: finding.competencyName, current: finding.actualLevel ?? t("belum tercatat"), required: finding.requiredLevel });
  return "";
}

/** The note a path B closure carries, naming its evidence. */
export const closeGapNotes = (finding: LevelFinding, day: string) =>
  `Gap terpenuhi tanpa training: ${finding.competencyName} level ${finding.actualLevel}, required ${finding.requiredLevel} (data kompetensi per ${day}).`;

/** Why Meets requirement is not available yet for a gap-based requirement, or "" when it is. */
export const meetsBlockedReason = (finding: LevelFinding | undefined, t: Translate = plainText) => finding && finding.status !== "Terpenuhi"
  ? t("{competency}: level saat ini {current}, required {required}. Meets requirement bisa dipilih setelah level di data kompetensi pegawai (modul D3) memenuhi.",
    { competency: finding.competencyName, current: finding.actualLevel ?? t("belum tercatat"), required: finding.requiredLevel })
  : "";

/** When a competency assessment was last saved for this employee's position: D3 skill rows carry no date, so this is the only dated evidence of a reassessment. */
export const lastAssessedAt = (assessments: readonly Pick<CompetencyAssessment, "employeeId" | "positionId" | "createdAt">[], employeeId: string, positionId: string | null | undefined) =>
  assessments.reduce<string | undefined>((at, item) => item.employeeId === employeeId && item.positionId === positionId && (!at || Date.parse(item.createdAt) > Date.parse(at)) ? item.createdAt : at, undefined);

/**
 * Why Retraining after a Passed training is not available yet, or "" when it is. Interview 14 Oct (part 2, 00:53:31):
 * the reassessment after a training decides between Retraining and Meets requirement, so Retraining is never picked in
 * the save that records Passed (`completed` undefined). For a gap-based requirement it also needs a competency
 * assessment saved after the training was completed that still shows the gap; the level before the training proves nothing.
 */
export function retrainingBlockedReason(need: Pick<DevelopmentNeedVersion, "sourceType">, finding: LevelFinding | undefined, completed: string | undefined, assessedAt: string | undefined, t: Translate = plainText): string {
  if (!completed) return t("Retraining dipilih saat reassessment, setelah hasil Passed tersimpan dan kompetensinya dinilai ulang. Simpan hasil Passed dengan Decide later.");
  if (need.sourceType !== "competency_gap" || !finding) return "";
  if (finding.status === "Terpenuhi") return t("{competency}: level {current} sudah memenuhi required {required}. Pilih Meets requirement.", { competency: finding.competencyName, current: String(finding.actualLevel), required: finding.requiredLevel });
  if (!assessedAt || Date.parse(assessedAt) <= Date.parse(completed))
    return t("Belum ada penilaian ulang kompetensi sesudah training ini. Simpan penilaian di Competency Gap, lalu pilih Retraining bila levelnya masih di bawah requirement. Bila hari ini sudah ada penilaian dengan hasil sama, isi Assessed with (misalnya atasannya) agar tersimpan sebagai penilaian baru.");
  return "";
}

/**
 * Plan of the one save that completes a training: checks every rule against the state after the training is
 * Completed, before anything is written. The database keeps the decision in two places: a follow-up only on a Not
 * Passed version, a reassessment only with the matching requirement status (Retraining → Planned, Meets → Completed).
 * `finding`: the live comparison of a gap-based requirement on the employee's current position, if it is part of it;
 * completing the training does not change that skill data (D3), so Meets requirement waits for it. `assessedAt`: when
 * a competency assessment was last saved for that position (lastAssessedAt), the evidence Retraining after Passed needs.
 */
export function planTrainingCompletion(input: TrainingCompletion, context: {
  trainingId: string; history: readonly TrainingVersion[]; need: DevelopmentNeedVersion | undefined; needHistory: readonly DevelopmentNeedVersion[];
  latestNeeds: readonly DevelopmentNeedVersion[]; latestTrainings: readonly (TrainingOutcome & { trainingId: string })[]; finding: LevelFinding | undefined; at: string;
  assessedAt?: string;
}): { training: "version" | "follow-up" | null; development: DevelopmentRevision | null; retraining: boolean; snapshot: boolean } {
  assertTrainingResult("Completed", input.result);
  const passed = input.result === "Passed";
  if (!((passed ? REASSESSMENTS : TRAINING_FOLLOW_UPS) as readonly string[]).includes(input.decision))
    throw new ApiError("VALIDATION_FAILED", passed ? "Pilih hasil reassessment: Meets requirement atau Retraining." : "Pilih tindak lanjut: Retraining atau Other follow-up.");
  const latest = [...context.history].sort((a, b) => b.revision - a.revision)[0];
  if (!latest) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
  if (latest.status === "Completed" && (TRAINING_RESULTS as readonly string[]).includes(latest.result) && !pendingDecision(context.history, context.need, context.needHistory))
    throw new ApiError("VALIDATION_FAILED", "Keputusan untuk hasil training ini sudah dicatat. Lihat riwayat training.");
  assertTrainingChange(latest.status, "Completed", input.notes);
  const saved = latest.status === "Completed" && latest.result === input.result;
  if (!passed) {
    const completed = saved ? context.history : [{ ...latest, revision: latest.revision + 1, status: "Completed" as const, result: "Not Passed", followUp: null }, ...context.history];
    assertTrainingFollowUp(completed, { followUp: input.decision as TrainingFollowUp, notes: input.notes, activity: input.activity, date: input.date }, context.need);
    return { training: "follow-up", development: null, retraining: input.decision === "Retraining", snapshot: false };
  }
  if (!context.need) throw new ApiError("VALIDATION_FAILED", "Development requirement sumber training ini tidak ditemukan.");
  const decision = input.decision as DevelopmentReassessment;
  const retrainingBlocked = decision === "Retraining" && retrainingBlockedReason(context.need, context.finding, saved ? completedAt(context.history) : undefined, context.assessedAt);
  if (retrainingBlocked) throw new ApiError("VALIDATION_FAILED", retrainingBlocked);
  if (decision === "Retraining" && (!input.activity?.trim() || !input.date)) throw new ApiError("VALIDATION_FAILED", "Isi nama training dan tanggal untuk Retraining.");
  if (decision === "Meets requirement" && context.need.sourceType === "competency_gap" && meetsBlockedReason(context.finding))
    throw new ApiError("VALIDATION_FAILED", meetsBlockedReason(context.finding));
  const trainingsAfter = context.latestTrainings.map((item) => item.trainingId === context.trainingId ? { ...item, status: "Completed" as const, result: "Passed", createdAt: context.at } : item);
  const kept = decision === "Meets requirement" && context.need.status === "Completed" && reassessmentOf(context.needHistory) === "Meets requirement";
  const development = kept ? null : nextDevelopmentRevision(context.need, { status: decision === "Retraining" ? "Planned" : "Completed", notes: input.notes, reassessment: decision },
    context.latestNeeds, trainingsAfter, context.needHistory);
  return { training: saved ? null : "version", development, retraining: decision === "Retraining", snapshot: true };
}

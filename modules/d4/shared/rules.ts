import type { DevelopmentNeedVersion, DevelopmentPriority, DevelopmentReassessment, DevelopmentSourceType, DevelopmentStatus } from "../development/types";
import type { TrainingFollowUp, TrainingStatus, TrainingVersion } from "../training/types";
import { ApiError } from "./errors";

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

type PeriodRecord = { readonly id: string; readonly employeeId: string; readonly period: string; readonly createdAt: string };

/** Latest record of an employee for a period; an older one in the same period is an earlier revision. */
export function latestForPeriod<T extends PeriodRecord>(records: readonly T[], employeeId: string, period: string): T | undefined {
  return records.filter((item) => item.employeeId === employeeId && item.period === period)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * One active record per employee and period (FR-01.4, FR-02.9, BR-06.2). A second record is only
 * accepted as an explicit revision of the current one, so it never hides another record silently.
 */
export function assertPeriodRevision(records: readonly PeriodRecord[], employeeId: string, period: string, revisionOf: string | null | undefined, label: string) {
  const current = latestForPeriod(records, employeeId, period);
  if (current && revisionOf !== current.id) throw new ApiError("VALIDATION_FAILED", `${label} untuk periode ini sudah ada. Simpan sebagai revisi atau buka riwayatnya.`);
  if (!current && revisionOf) throw new ApiError("VALIDATION_FAILED", `${label} yang direvisi tidak cocok dengan pegawai atau periodenya.`);
}

/** Revision number of a record within its employee and period (1 = first record). */
export function revisionNumber<T extends PeriodRecord>(records: readonly T[], record: T): number {
  return records.filter((item) => item.employeeId === record.employeeId && item.period === record.period && item.createdAt <= record.createdAt).length;
}

/** An evaluator never assesses themselves; nor does HR or a manager raise development or training for themselves. */
export function assertNotSelf(actorEmployeeId: string, employeeId: string, what = "Penilaian") {
  if (actorEmployeeId === employeeId) throw new ApiError("VALIDATION_FAILED", `${what} untuk diri sendiri harus dilakukan oleh HR atau manager lain.`);
}

/** A revision replaces what the page shows, so the reason for it must be on record. */
export function assertRevisionReason(revisionOf: string | null | undefined, notes: string | null | undefined) {
  if (revisionOf && !notes?.trim()) throw new ApiError("VALIDATION_FAILED", "Alasan revisi wajib ditulis di catatan saat menyimpan revisi.");
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

/** Moving a development need back (e.g. Completed → Planned, In Progress → Identified). */
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
 * editable after creation (interview D4: priority follows context, e.g. a tax policy change). A reassessment is
 * recorded only on a Completed need: Retraining reopens it as Planned so training can be repeated, Meets requirement
 * keeps it Completed. `history` is every revision of this need; without it only `current` is known.
 */
export function nextDevelopmentRevision(current: DevelopmentNeedVersion, change: DevelopmentChange, latestNeeds: readonly DevelopmentNeedVersion[], latestTrainings: readonly TrainingOutcome[], history: readonly DevelopmentNeedVersion[] = []): DevelopmentRevision {
  const versions = history.length ? history : [current];
  const next: DevelopmentRevision = {
    status: change.status, notes: change.notes, priority: change.priority ?? current.priority,
    method: (change.method ?? current.method ?? "").trim(), pic: (change.pic ?? current.pic ?? "").trim(), reassessment: change.reassessment ?? null,
  };
  if (next.reassessment) {
    if (current.status !== "Completed") throw new ApiError("VALIDATION_FAILED", "Hasil reassessment hanya dicatat setelah development requirement Completed.");
    if (next.reassessment === "Retraining" && next.status !== "Planned") throw new ApiError("VALIDATION_FAILED", "Retraining membuka kembali requirement dengan status Planned.");
    if (next.reassessment === "Meets requirement" && next.status !== "Completed") throw new ApiError("VALIDATION_FAILED", "Meets requirement berarti requirement tetap Completed.");
  }
  const edited = next.priority !== current.priority || next.method !== (current.method ?? "") || next.pic !== (current.pic ?? "");
  // Recording the decision already in force (e.g. Meets requirement twice) changes nothing.
  const repeated = next.reassessment !== null && next.reassessment === reassessmentOf(versions);
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

/** A completed training already happened, so its date cannot be later than today; planned training may be in the future. */
export function assertTrainingDate(status: TrainingStatus, date: string) {
  if (status === "Completed") assertNotFutureDate(date, "Tanggal training yang sudah selesai");
}

/**
 * Message when an evaluation date falls before its period starts (D4-FN-01), or "" when it does not. Together with
 * assertNotFutureDate this keeps the period at or before the current month. A missing date is reported elsewhere.
 */
export const periodDateError = (period: string, date: string | null | undefined) =>
  date && period && date < `${period}-01` ? "Tanggal evaluasi tidak boleh sebelum awal periode." : "";

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
export const retrainingNotes = (previous: Pick<TrainingVersion, "activity" | "date">, notes: string) =>
  [`Retraining setelah "${previous.activity}" (${previous.date}) Not Passed.`, notes.trim()].filter(Boolean).join("\n");

type TeamMember = { readonly id: string; readonly departmentId: string | null };

/**
 * A manager's team: other employees of the manager's own department. Department is the only grouping
 * D4 has until D3 provides reporting lines; the manager is never part of their own team.
 */
export function isTeamMember(actor: TeamMember | undefined, employee: TeamMember | undefined) {
  return Boolean(actor?.departmentId && employee && employee.id !== actor.id && employee.departmentId === actor.departmentId);
}

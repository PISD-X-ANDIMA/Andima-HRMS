"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { CompetencyFinding } from "../../../competency/types";
import type { TrainingStatus } from "../../../training/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { developmentById, developmentNeeds, employeeById, reassessmentFor, sourceFinding, today, trainingById, trainingDecision, trainingHistory, visibleEmployees } from "../../data/selectors";
import { completedAt, followUpOf, isTrainingRollback, lastAssessedAt, meetsBlockedReason, retrainingBlockedReason, TRAINING_RESULTS, type TrainingCompletion, type TrainingDecision } from "../../../shared/rules";
import { msg, plainText, type Translate } from "../../../shared/text";
import { useLanguage } from "../../i18n/LanguageProvider";
import { DateField, FormError, FormModal, ModalActions, RadioField, ReadOnlyField, SearchSelectField, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { Notice, statusLabel } from "../../ui/primitives";

const STATUSES: TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];

/**
 * Passed / Not Passed, shown only for a completed training. `hint`: where the decision is recorded afterwards, for
 * Add Training; Update Progress asks for the decision right below instead.
 */
function ResultField({ value, onChange, error, hint = true }: { value: string; onChange: (value: string) => void; error?: string; hint?: boolean }) {
  const { t } = useLanguage();
  return <>
    <SelectField label={t("Result")} testId="result" required value={value} onChange={(event) => onChange(event.target.value)} error={error} className="sm:col-span-2"
      helper={t("Detail hasil (nilai, sertifikat, catatan trainer) ditulis di Notes.")}>
      <option value="">{t("Select result")}</option>
      {TRAINING_RESULTS.map((item) => <option key={item} value={item}>{t(item)}</option>)}
    </SelectField>
    {hint && value && <div className="sm:col-span-2"><Notice>{value === "Passed" ? t("Setelah disimpan, catat hasil reassessment dari Next step di detail training ini.") : t("Setelah disimpan, catat tindak lanjutnya dari Next step di detail training ini.")}</Notice></div>}
  </>;
}

export function TrainingFormModal({ employeeId, developmentNeedId, onClose, onSaved }: { employeeId?: string; developmentNeedId?: string; onClose: () => void; onSaved?: (trainingId: string) => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t } = useLanguage();
  const [employee, setEmployee] = useState(employeeId ?? "");
  const [need, setNeed] = useState(developmentNeedId ?? "");
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<TrainingStatus>("Planned");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  // A completed requirement takes no new training; a new need is raised if the gap remains.
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee && item.status !== "Completed");
  const needOpen = needs.some((item) => item.needId === need);
  const futureDone = status === "Completed" && date > today();
  // A Planned training is still to come (lecturer, 24 Nov 2026); a past date belongs to In Progress or Completed.
  const pastPlanned = status === "Planned" && !!date && date < today();
  const missing = [!employee && t("employee"), !needOpen && t("source requirement"), !activity.trim() && t("training/activity"), !date && t("date"), status === "Completed" && !result && t("result")].filter(Boolean);
  // Opened from a requirement or employee page: that context is fixed, not re-pickable.
  const lockedEmployee = employeeId ? employeeById(snapshot, employeeId) : undefined;
  const lockedNeed = developmentNeedId ? needs.find((item) => item.needId === developmentNeedId) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (missing.length) { setError(t("Lengkapi {fields} sebelum menyimpan.", { fields: missing.join(", ") })); return; }
    if (futureDone) { setError(t("Training yang Completed tidak boleh bertanggal setelah hari ini.")); return; }
    if (pastPlanned) { setError(t("Tanggal training Planned tidak boleh sebelum hari ini.")); return; }
    setError("");
    const saved = await run((source) => source.createTraining({ employeeId: employee, developmentNeedId: need, activity, date, status, result: status === "Completed" ? result : "", notes }), t("Training tersimpan dan terhubung ke development requirement-nya."));
    if (saved.ok) { onSaved?.(saved.value); onClose(); } else setError(saved.error);
  }

  return <FormModal title={t("Add Training")} description={t("Training selalu terhubung ke development requirement sebagai sumbernya.")} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Save Training")} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {lockedEmployee ? <ReadOnlyField label={t("Employee")} testId="employee" value={`${lockedEmployee.fullName} · ${lockedEmployee.employeeId}`} className="sm:col-span-2" />
          : <SearchSelectField label={t("Employee")} testId="employee" required value={employee} onChange={(value) => { setEmployee(value); setNeed(""); }} error={touched && !employee ? t("Employee wajib diisi.") : undefined} className="sm:col-span-2" placeholder={t("Select employee")}
            options={visibleEmployees(snapshot).map((item) => ({ value: item.id, label: `${item.fullName} · ${item.employeeId}` }))} />}
        {lockedNeed ? <ReadOnlyField label={t("Source requirement")} testId="source-requirement" value={`${lockedNeed.objective} · ${t(statusLabel(lockedNeed.status))}`} className="sm:col-span-2" /> :
        <SelectField label={t("Source requirement")} testId="source-requirement" required value={need} onChange={(event) => setNeed(event.target.value)} error={touched && employee && !needOpen ? t("Pilih development requirement yang masih terbuka.") : undefined} className="sm:col-span-2"
          helper={t("Requirement yang sudah Completed tidak ditampilkan.")}>
          <option value="">{!employee ? t("Pilih pegawai terlebih dahulu") : needs.length ? t("Select development requirement") : t("Pegawai belum memiliki development requirement yang terbuka")}</option>
          {needs.map((item) => <option key={item.needId} value={item.needId}>{item.objective} · {t(statusLabel(item.status))}</option>)}
        </SelectField>}
        <TextField label={t("Training / activity")} testId="training-activity" required maxLength={200} value={activity} onChange={(event) => setActivity(event.target.value)} error={touched && !activity.trim() ? t("Nama aktivitas wajib diisi.") : undefined} className="sm:col-span-2" />
        <DateField label={t("Date")} testId="date" required max={status === "Completed" ? today() : undefined} min={status === "Planned" ? today() : undefined} value={date} onChange={(event) => setDate(event.target.value)} error={touched && futureDone ? t("Tidak boleh lebih dari hari ini untuk training yang Completed.") : touched && pastPlanned ? t("Tanggal training Planned tidak boleh sebelum hari ini.") : undefined} />
        <SelectField label={t("Status")} required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}>{STATUSES.map((item) => <option key={item} value={item}>{t(statusLabel(item))}</option>)}</SelectField>
        {status === "Completed" && <ResultField value={result} onChange={setResult} error={touched && !result ? t("Result wajib dipilih bila status Completed.") : undefined} />}
      </div>
      <TextAreaField label={t("Notes")} testId="notes" value={notes} onChange={(event) => setNotes(event.target.value)} helper={`${notes.length}/${NOTES_MAX}`} />
    </form>
  </FormModal>;
}

const FOLLOW_UP_OPTIONS = [
  { value: "Retraining", label: "Retraining", description: msg("Training ulang untuk requirement yang sama, dibuat dengan status Planned.") },
  { value: "Other follow-up", label: "Other follow-up", description: msg("Coaching, rotasi, atau eskalasi ke atasan. Catatan wajib.") },
];
const LATER = "Decide later";
/** Update Progress closes as soon as the training is saved; the list refreshes behind it (PST 2). */
export const BACKGROUND = { refreshInBackground: true };
export const PASSED_HELPER = msg("Passed berarti lulus training. Di sini dicatat apakah level kompetensinya sudah memenuhi requirement: lulus training belum tentu menutup gap.");
// TextAreaField's default limit, the server limit of notes.
const NOTES_MAX = 2000;

/**
 * The line under a gap-based decision: the live level of the requirement the training was for. `employeeId` adds a
 * link to that employee's Competency Gap; the modal leaves it out, so a click does not drop what was typed.
 */
export function LevelLine({ finding, employeeId }: { finding: CompetencyFinding; employeeId?: string }) {
  const { t } = useLanguage();
  return <Notice tone={finding.status === "Terpenuhi" ? "info" : "warning"}>
    <span data-testid="level-now">{t("Competency Gap sekarang · {competency}: required {required}, current {current} ({status}).", { competency: finding.competencyName, required: finding.requiredLevel, current: finding.actualLevel ?? t("belum tercatat"), status: t(statusLabel(finding.status)) })}</span>
    {employeeId && <> <Link href={`/competency/${employeeId}`} data-testid="link-level-competency" className="font-semibold underline">{t("Open Competency Gap")}</Link></>}
  </Notice>;
}

/**
 * The one place a training is finished (Training Tracking). Picking Completed asks for the result and, in the same
 * save, HR's decision: Passed → Meets requirement (closes the requirement) or Decide later; Not Passed → Retraining or
 * Other follow-up (Q16). A training saved Completed without a decision reopens here from its Next step, where a Passed
 * one gets the reassessment: Meets requirement or Retraining (see retrainingBlockedReason).
 */
export function TrainingProgressModal({ trainingId, onClose, onSaved }: { trainingId: string; onClose: () => void; onSaved?: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t } = useLanguage();
  const record = trainingById(snapshot, trainingId);
  const need = record && developmentById(snapshot, record.developmentNeedId);
  const [status, setStatus] = useState<TrainingStatus>(record?.status ?? "Planned");
  // Results saved before Passed/Not Passed existed are free text; they must be re-picked on completion.
  const [result, setResult] = useState((TRAINING_RESULTS as readonly string[]).includes(record?.result ?? "") ? record!.result : "");
  const [decision, setDecision] = useState("");
  const [activity, setActivity] = useState(record?.activity ?? "");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  if (!record) return null;
  const pending = trainingDecision(snapshot, record);
  // A recorded decision fixes the result; changing it starts with a status change (a rollback with a reason).
  const decided = record.status === "Completed" && (TRAINING_RESULTS as readonly string[]).includes(record.result) && !pending;
  const deciding = status === "Completed" && !decided && Boolean(result);
  // Moving back (e.g. Completed → In Progress) or reopening a cancelled training needs a reason.
  const rollback = isTrainingRollback(record.status, status);
  const finding = need && sourceFinding(snapshot, need);
  const blocked = meetsBlockedReason(finding, t);
  const retraining = deciding && decision === "Retraining", other = deciding && decision === "Other follow-up";
  const later = deciding && decision === LATER;
  // Interview 14 Oct (part 2, 00:53:31): Retraining after a pass is the outcome of a reassessment, so it is offered
  // only once the Passed result is saved; the save that records Passed has Meets requirement or Decide later.
  const reassessing = pending === "reassessment";
  const retrainingReason = need && reassessing ? retrainingBlockedReason(need, finding, completedAt(trainingHistory(snapshot, record.trainingId)),
    lastAssessedAt(snapshot.competency, record.employeeId, employeeById(snapshot, record.employeeId)?.positionId), t) : "";
  const options = result === "Passed" ? [
    { value: "Meets requirement", label: "Gap closed: Meets requirement", description: blocked ? t("Belum bisa: level kompetensinya belum memenuhi. Perbarui dulu di data kompetensi pegawai (modul D3).") : t("Gap tertutup. Requirement ditutup (Completed)."), testId: "meets-requirement", disabled: Boolean(blocked) },
    ...(reassessing
      ? [{ value: "Retraining", label: "Gap still open: Retraining", description: retrainingReason || t("Penilaian ulang sesudah training masih menunjukkan level di bawah requirement. Requirement dibuka lagi dan training ulang dibuat (Planned)."), testId: "retraining", disabled: Boolean(retrainingReason) }]
      : [{ value: LATER, label: LATER, description: t("Hasil Passed disimpan sekarang. Setelah kompetensinya dinilai ulang di Competency Gap, pilih Meets requirement atau Retraining dari Next step."), testId: "decide-later" }]),
  ] : FOLLOW_UP_OPTIONS.map((item) => ({ ...item, description: t(item.description) }));
  const saveResult = status === "Completed" ? result : "";
  const sameResult = status === record.status && saveResult === record.result;
  const unchanged = sameResult && !notes.trim() && (!deciding || !decision || later);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (status === "Completed" && !result) { setError(t("Result wajib dipilih bila status Completed: Passed atau Not Passed.")); return; }
    if (rollback && !notes.trim()) { setError(t("Alasan wajib diisi saat status mundur dari {from} ke {to}.", { from: t(statusLabel(record!.status)), to: t(statusLabel(status)) })); return; }
    // R3: only the choices that can be picked are named.
    if (deciding && !decision) {
      const choices = orList(options.filter((item) => !("disabled" in item && item.disabled)).map((item) => item.label), t);
      setError(result === "Passed" ? t("Pilih Competency after training: {choices}.", { choices }) : t("Pilih tindak lanjut: {choices}.", { choices }));
      return;
    }
    const missing = [retraining && !activity.trim() && t("training/activity"), retraining && !date && t("date"), other && !notes.trim() && t("notes")].filter(Boolean);
    if (missing.length) { setError(t("Lengkapi {fields} sebelum menyimpan.", { fields: missing.join(", ") })); return; }
    setError("");
    const saved = deciding && !later
      ? await run((source) => source.completeTraining(trainingId, { result: result as TrainingCompletion["result"], decision: decision as TrainingDecision, notes, ...(retraining ? { activity, date } : {}) }), t(DONE[`${result} · ${decision}`]), BACKGROUND)
      : await run((source) => source.updateTraining(trainingId, status, saveResult, notes), later ? t("Training Completed (Passed). Setelah kompetensinya dinilai ulang di Competency Gap, catat Meets requirement atau Retraining dari Next step.") : t("Progres training tersimpan sebagai versi baru."), BACKGROUND);
    if (saved.ok) { onSaved?.(); onClose(); } else setError(saved.error);
  }

  return <FormModal title={t("Update Progress")} description={record.activity} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Save Progress")} disabled={unchanged} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <SelectField label={t("Status")} required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}>{STATUSES.map((item) => <option key={item} value={item}>{t(statusLabel(item))}</option>)}</SelectField>
      {status === "Completed" && (decided
        ? <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label={t("Result")} testId="result" value={t(record.result)} />
            <ReadOnlyField label={t("Decision")} testId="decision" value={followUpOf(trainingHistory(snapshot, record.trainingId)) ?? reassessmentFor(snapshot, record.developmentNeedId) ?? "—"} />
          </div>
        : <ResultField value={result} onChange={(value) => { setResult(value); setDecision(""); setError(""); }} error={touched && !result ? t("Result wajib dipilih.") : undefined} hint={false} />)}
      {deciding && <>
        {result === "Passed" && finding && <LevelLine finding={finding} />}
        <RadioField label={result === "Passed" ? t("Competency after training") : t("Follow-up")} testId={result === "Passed" ? "reassessment" : "follow-up"} required value={decision}
          helper={result === "Passed" ? t(PASSED_HELPER) : undefined}
          onChange={(value) => { setDecision(value); setError(""); }} options={options}
          error={touched && !decision ? (result === "Passed" ? t("Hasil reassessment wajib dipilih.") : t("Pilih tindak lanjut.")) : undefined} />
        {retraining && <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label={t("Source requirement")} testId="retraining-source" value={need ? need.objective : "—"} className="sm:col-span-2" />
          <TextField label={t("Training / activity")} testId="retraining-activity" required maxLength={200} value={activity} onChange={(event) => setActivity(event.target.value)} className="sm:col-span-2"
            error={touched && !activity.trim() ? t("Nama training wajib diisi.") : undefined} />
          <DateField label={t("Date")} testId="retraining-date" required min={today()} value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? t("Tanggal wajib diisi.") : undefined} />
          <ReadOnlyField label={t("Status")} testId="retraining-status" value={t(statusLabel("Planned"))} />
        </div>}
      </>}
      <TextAreaField label={rollback ? t("Reason for change") : t("Update notes")} testId={rollback ? "alasan-perubahan" : "update-notes"} required={rollback || other} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && (rollback || other) && !notes.trim() ? t("Catatan wajib diisi.") : undefined}
        helper={`${rollback ? `${t("Status mundur dari {from}; alasannya disimpan di riwayat versi.", { from: t(statusLabel(record.status)) })} ` : other ? `${t("Tulis langkahnya (coaching, rotasi, atau eskalasi ke atasan), siapa, dan kapan.")} ` : retraining ? `${t("Disalin juga ke catatan training ulang.")} ` : ""}${notes.length}/${NOTES_MAX}`} />
    </form>
  </FormModal>;
}

const orList = (items: readonly string[], t: Translate = plainText) => items.length > 1 ? t("{first} atau {last}", { first: items.slice(0, -1).join(", "), last: items[items.length - 1] }) : items[0] ?? "";

const DONE: Record<string, string> = {
  "Passed · Meets requirement": msg("Training Completed. Requirement ditutup: Meets requirement."),
  "Passed · Retraining": msg("Training Completed. Requirement dibuka lagi; training ulang dibuat dengan status Planned."),
  "Not Passed · Retraining": msg("Training Not Passed tercatat; training ulang dibuat dengan status Planned."),
  "Not Passed · Other follow-up": msg("Training Not Passed dan tindak lanjutnya tercatat."),
};

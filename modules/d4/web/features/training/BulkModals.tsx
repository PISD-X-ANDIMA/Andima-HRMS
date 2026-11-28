"use client";

import { useState, type FormEvent } from "react";
import type { TrainingStatus } from "../../../training/types";
import { TRAINING_RESULTS, type TrainingCompletion, type TrainingDecision } from "../../../shared/rules";
import { msg, plainText, type Translate } from "../../../shared/text";
import { addTrainingToNeeds, bulkSummary, DECIDE_LATER, progressTargets, requireSome, updateTrainings, type BulkFailure, type BulkNeed, type BulkOutcome, type BulkProgress, type BulkTarget, type BulkTraining } from "../../data/bulk";
import { progressIssue } from "../../data/completion";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { includesText, today } from "../../data/selectors";
import { useLanguage } from "../../i18n/LanguageProvider";
import { DateField, FormError, FormModal, ModalActions, RadioField, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { cx, Notice, statusLabel } from "../../ui/primitives";
import { BACKGROUND, PASSED_HELPER } from "./TrainingModals";

// TextAreaField's default limit, the server limit of notes.
const NOTES_MAX = 2000;
const saveLabel = (count: number, t: Translate = plainText) => count === 1 ? t("Save {count} Training", { count }) : t("Save {count} Trainings", { count });

/**
 * Who the bulk action is for, each with a checkbox, all ticked: unticking one leaves it out of this save without going
 * back to the table (24 Nov 2026). The list scrolls, so a selection of 32 does not push the form off screen.
 */
/** `issues`: rows the chosen change would refuse, with the reason; they stay listed but are not saved. */
function TargetList({ items, noun, picked, onChange, issues }: { items: readonly BulkTarget[]; noun: string; picked: ReadonlySet<string>; onChange: (picked: Set<string>) => void; issues?: ReadonlyMap<string, string> }) {
  const { t } = useLanguage();
  const toggle = (key: string) => onChange(new Set(picked.has(key) ? [...picked].filter((item) => item !== key) : [...picked, key]));
  const count = items.filter((item) => picked.has(item.key)).length;
  return <fieldset data-testid="bulk-targets" className="min-w-0">
    <legend className="mb-1.5 block text-sm font-semibold text-ink-2">{t(noun, { count, total: items.length })}</legend>
    <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
      {items.map((item) => <li key={item.key}><label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-muted">
        <input type="checkbox" checked={picked.has(item.key)} onChange={() => toggle(item.key)} data-testid={`bulk-target-${item.key}`} className="mt-0.5 size-4 shrink-0 accent-primary-600" />
        <span className="min-w-0 break-words text-ink">{item.label}{item.detail && <span className="block text-xs text-ink-3">{item.detail}</span>}
          {picked.has(item.key) && issues?.get(item.key) && <span data-testid={`bulk-issue-${item.key}`} className="mt-1 block text-xs font-semibold text-warning">{t("Tidak ikut disimpan: {reason}", { reason: t(issues.get(item.key)!) })}</span>}</span>
      </label></li>)}
    </ul>
  </fieldset>;
}

/** Rows a bulk save refused, with the reason the single-row save gives; they stay selected for another try. */
function FailureList({ failures }: { failures: readonly BulkFailure[] }) {
  const { t } = useLanguage();
  if (!failures.length) return null;
  return <div role="alert" data-testid="bulk-failures" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
    <p className="font-semibold">{t("{count} tidak tersimpan dan masih dipilih. Perbaiki lalu simpan lagi, atau pilih keputusan lain:", { count: failures.length })}</p>
    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs">{failures.map((item) => <li key={item.key} className="break-words"><strong>{item.label}</strong>: {item.message}</li>)}</ul>
  </div>;
}

/**
 * Open requirements to put on one training, picked in the form itself: Add Training on Training Tracking and Add
 * Participants on a training (PST 2, "kalau temennya mau ikut"). A training always belongs to a requirement, so a
 * colleague without an open one is not listed and needs Add Requirement first.
 */
function NeedPicker({ choices, picked, onChange, error }: { choices: readonly BulkNeed[]; picked: ReadonlySet<string>; onChange: (picked: Set<string>) => void; error?: string }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const shown = choices.filter((item) => includesText(item.label, query));
  const toggle = (key: string) => onChange(new Set(picked.has(key) ? [...picked].filter((item) => item !== key) : [...picked, key]));
  if (!choices.length) return <Notice tone="warning">{t("Belum ada development requirement terbuka yang bisa diberi training. Pegawai yang mau ikut perlu requirement dulu: buat lewat Add Requirement di Development Requirement.")}</Notice>;
  return <fieldset data-testid="need-picker" className="min-w-0">
    <legend className="mb-1.5 block text-sm font-semibold text-ink-2">{t("Requirements")}<span className="text-danger"> *</span></legend>
    <TextField label={t("Search requirement")} testId="need-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Name or requirement")} />
    <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
      {shown.map((item) => <li key={item.key}><label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-muted">
        <input type="checkbox" checked={picked.has(item.key)} onChange={() => toggle(item.key)} data-testid={`pick-need-${item.key}`} className="mt-0.5 size-4 shrink-0 accent-primary-600" />
        <span className="min-w-0 break-words text-ink">{item.label}</span>
      </label></li>)}
      {!shown.length && <li className="px-3 py-2.5 text-sm text-ink-3">{t("Tidak ada requirement yang cocok.")}</li>}
    </ul>
    <p className={cx("mt-1.5 text-xs", error ? "text-danger" : "text-ink-3")}>{error ?? t("{count} dipilih. Pegawai tanpa requirement terbuka tidak ada di daftar; buat dulu lewat Add Requirement.", { count: picked.size })}</p>
  </fieldset>;
}

/**
 * Add Training for several requirements at once: one training each, with the same activity and date. The requirements
 * come selected from Development Requirement (`needs`) or are picked in the form (`choices`); `initial` copies the
 * training a colleague joins. A Completed training needs a result and HR's decision per person, so bulk creation is
 * Planned or In Progress.
 */
export function BulkTrainingModal({ needs, choices, initial, title = "Add Training", onClose, onDone }: {
  needs?: readonly BulkNeed[]; choices?: readonly BulkNeed[]; initial?: { activity: string; date: string; status: TrainingStatus }; title?: string;
  onClose: () => void; onDone?: (outcome: BulkOutcome) => void;
}) {
  const { run, busy } = useD4();
  const { t } = useLanguage();
  const [activity, setActivity] = useState(initial?.activity ?? "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [status, setStatus] = useState<TrainingStatus>(initial?.status === "In Progress" ? "In Progress" : "Planned");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(needs?.map((item) => item.key)));
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<BulkFailure[]>([]);
  const [touched, setTouched] = useState(false);
  const targets = (needs ?? choices ?? []).filter((item) => picked.has(item.key));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    const missing = [!targets.length && "requirement", !activity.trim() && t("training/activity"), !date && t("date")].filter(Boolean);
    if (missing.length) { setError(t("Lengkapi {fields} sebelum menyimpan.", { fields: missing.join(", ") })); return; }
    setError("");
    let outcome: BulkOutcome | undefined;
    const saved = await run(async (source) => requireSome(outcome = await addTrainingToNeeds(source, targets, { activity, date, status, notes })), (value) => bulkSummary(value, "training", t), BACKGROUND);
    settle(saved.ok ? saved.value : outcome, saved.ok ? "" : saved.error);
  }
  /** Every refused row is listed with its reason, also when none was saved; a write error without rows is shown as is. */
  function settle(outcome: BulkOutcome | undefined, message: string) {
    if (outcome) {
      onDone?.(outcome);
      // Picked here: what was saved leaves the selection, what was refused stays for another try.
      setPicked((current) => new Set([...current].filter((key) => !outcome.done.includes(key))));
    }
    setFailures(outcome?.failed ?? []);
    setError(outcome?.failed.length ? "" : message);
    if (outcome && !outcome.failed.length) onClose();
  }

  return <FormModal title={t(title)} description={choices
      ? t("Pilih requirement setiap peserta. Training yang sama dibuat untuk masing-masing dan tetap terhubung ke requirement-nya.")
      : t("Satu training untuk setiap requirement yang dipilih, masing-masing tetap terhubung ke requirement-nya.")} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={saveLabel(targets.length, t)} disabled={!needs && !choices?.length} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <FailureList failures={failures} />
      {choices ? <NeedPicker choices={choices} picked={picked} onChange={setPicked} error={touched && !targets.length ? t("Pilih minimal satu requirement.") : undefined} />
        : <TargetList items={needs ?? []} noun={msg("{count} dari {total} requirement dipilih")} picked={picked} onChange={setPicked} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("Training / activity")} testId="bulk-training-activity" required maxLength={200} value={activity} onChange={(event) => setActivity(event.target.value)}
          error={touched && !activity.trim() ? t("Nama aktivitas wajib diisi.") : undefined} className="sm:col-span-2" />
        <DateField label={t("Date")} testId="bulk-training-date" required min={status === "Planned" ? today() : undefined} value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? t("Tanggal wajib diisi.") : undefined} />
        <SelectField label={t("Status")} testId="bulk-training-status" required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}
          helper={t("Completed dicatat per training lewat Update Progress, karena hasil dan keputusannya per orang.")}>
          {(["Planned", "In Progress"] as const).map((item) => <option key={item} value={item}>{t(statusLabel(item))}</option>)}
        </SelectField>
      </div>
      <TextAreaField label={t("Notes")} testId="bulk-training-notes" maxLength={NOTES_MAX} value={notes} onChange={(event) => setNotes(event.target.value)} helper={`${notes.length}/${NOTES_MAX}`} />
    </form>
  </FormModal>;
}

const PASSED_OPTIONS = [
  { value: "Meets requirement", label: "Gap closed: Meets requirement", description: msg("Gap tertutup. Untuk requirement dari Competency Gap, hanya tersimpan bila level di data kompetensi (D3) sudah memenuhi."), testId: "meets-requirement" },
  // Retraining after a pass waits for the reassessment (interview 14 Oct, part 2, 00:53:31), so it is not offered here.
  { value: DECIDE_LATER, label: DECIDE_LATER, description: msg("Hasil Passed disimpan sekarang. Setelah kompetensinya dinilai ulang di Competency Gap, pilih Meets requirement atau Retraining dari Next step."), testId: "decide-later" },
];
const NOT_PASSED_OPTIONS = [
  { value: "Retraining", label: "Retraining", description: msg("Training ulang untuk requirement yang sama, dibuat dengan status Planned.") },
  { value: "Other follow-up", label: "Other follow-up", description: msg("Coaching, rotasi, atau eskalasi ke atasan. Catatan wajib.") },
];

/**
 * Training Tracking → Update Progress for the selected trainings: In Progress, or Completed with one result and one
 * decision for all of them (interview 13 Nov 2026: 32 field agents cannot be completed one by one). Rows the single
 * Update Progress would refuse are refused here with the same message and stay selected.
 */
export function BulkProgressModal({ trainings, onClose, onDone }: { trainings: readonly BulkTraining[]; onClose: () => void; onDone: (outcome: BulkOutcome) => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t } = useLanguage();
  const [status, setStatus] = useState<BulkProgress["status"]>("Completed");
  const [result, setResult] = useState("");
  const [decision, setDecision] = useState("");
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<BulkFailure[]>([]);
  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(trainings.map((item) => item.key)));
  const chosen = trainings.filter((item) => picked.has(item.key));
  const completing = status === "Completed";
  const retraining = completing && decision === "Retraining", other = completing && decision === "Other follow-up";
  const change: BulkProgress | null = !completing ? { status, notes } : result && decision
    ? { status, result: result as TrainingCompletion["result"], decision: decision as TrainingDecision | typeof DECIDE_LATER, notes, ...(retraining ? { activity, date } : {}) } : null;
  // Checked as soon as the choice is made, with the rules of the save, so HR sees who cannot be processed before saving
  // instead of after (lecturer review, 24 Nov 2026). Those rows are left out of the save.
  const issues = new Map(change ? chosen.flatMap((item) => { const issue = progressIssue(snapshot, item.key, change); return issue ? [[item.key, issue] as const] : []; }) : []);
  const eligible = chosen.filter((item) => !issues.has(item.key));
  const targets = progressTargets(eligible, { status });
  const skipped = eligible.length - targets.length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (completing && !result) { setError(t("Result wajib dipilih bila status Completed: Passed atau Not Passed.")); return; }
    if (completing && !decision) { setError(result === "Passed" ? t("Pilih Competency after training: Gap closed atau Decide later.") : t("Pilih tindak lanjut: Retraining atau Other follow-up.")); return; }
    const missing = [retraining && !activity.trim() && t("training/activity"), retraining && !date && t("date"), other && !notes.trim() && t("notes")].filter(Boolean);
    if (missing.length) { setError(t("Lengkapi {fields} sebelum menyimpan.", { fields: missing.join(", ") })); return; }
    if (!change || !targets.length) { setError(t("Tidak ada training yang bisa diproses dengan pilihan ini. Hapus centang yang bermasalah atau ubah pilihannya.")); return; }
    setError("");
    let outcome: BulkOutcome | undefined;
    const saved = await run(async (source) => requireSome(outcome = await updateTrainings(source, eligible, change)), (value) => bulkSummary(value, "training", t), BACKGROUND);
    settle(saved.ok ? saved.value : outcome, saved.ok ? "" : saved.error);
  }
  /** Same as in BulkTrainingModal: refused rows stay listed and selected, a fully saved batch closes the form. */
  function settle(outcome: BulkOutcome | undefined, message: string) {
    if (outcome) onDone(outcome);
    setFailures(outcome?.failed ?? []);
    setError(outcome?.failed.length ? "" : message);
    if (outcome && !outcome.failed.length) onClose();
  }

  return <FormModal title={t("Update Progress")} description={t("Satu perubahan untuk semua training yang dipilih; setiap training tetap disimpan sebagai versi barunya sendiri.")} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={saveLabel(targets.length, t)} disabled={!targets.length} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <FailureList failures={failures} />
      <TargetList items={trainings} noun={msg("{count} dari {total} training dipilih")} picked={picked} onChange={setPicked} issues={issues} />
      {issues.size > 0 && <div data-testid="bulk-issues"><Notice tone="warning">{t("{count} training tidak memenuhi syarat untuk pilihan ini dan tidak ikut disimpan. Alasannya ada di daftar; hapus centangnya atau ubah pilihan.", { count: issues.size })}</Notice></div>}
      <SelectField label={t("Status")} testId="bulk-progress-status" required value={status} onChange={(event) => { setStatus(event.target.value as BulkProgress["status"]); setError(""); }}>
        {(["In Progress", "Completed"] as const).map((item) => <option key={item} value={item}>{t(statusLabel(item))}</option>)}
      </SelectField>
      {skipped > 0 && <Notice>{targets.length ? t("{count} training sudah In Progress dan tidak diubah.", { count: skipped }) : t("Semua training yang dipilih sudah In Progress.")}</Notice>}
      {completing && <>
        <SelectField label={t("Result")} testId="bulk-progress-result" required value={result} onChange={(event) => { setResult(event.target.value); setDecision(""); setError(""); }}
          error={touched && !result ? t("Result wajib dipilih.") : undefined} helper={t("Hasil yang sama untuk semua training yang dipilih. Detail per orang ditulis di Notes training masing-masing.")}>
          <option value="">{t("Select result")}</option>
          {TRAINING_RESULTS.map((item) => <option key={item} value={item}>{t(item)}</option>)}
        </SelectField>
        {result && <RadioField label={result === "Passed" ? t("Competency after training") : t("Follow-up")} testId={result === "Passed" ? "bulk-reassessment" : "bulk-follow-up"} required value={decision}
          helper={result === "Passed" ? t(PASSED_HELPER) : undefined}
          onChange={(value) => { setDecision(value); setError(""); }} options={(result === "Passed" ? PASSED_OPTIONS : NOT_PASSED_OPTIONS).map((item) => ({ ...item, description: t(item.description) }))}
          error={touched && !decision ? (result === "Passed" ? t("Hasil reassessment wajib dipilih.") : t("Pilih tindak lanjut.")) : undefined} />}
        {retraining && <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("Retraining / activity")} testId="bulk-retraining-activity" required maxLength={200} value={activity} onChange={(event) => setActivity(event.target.value)} className="sm:col-span-2"
            error={touched && !activity.trim() ? t("Nama training wajib diisi.") : undefined} />
          <DateField label={t("Date")} testId="bulk-retraining-date" required min={today()} value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? t("Tanggal wajib diisi.") : undefined} />
        </div>}
      </>}
      <TextAreaField label={t("Update notes")} testId="bulk-progress-notes" required={other} maxLength={NOTES_MAX} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && other && !notes.trim() ? t("Catatan wajib diisi.") : undefined}
        helper={`${other ? `${t("Tulis langkahnya (coaching, rotasi, atau eskalasi ke atasan), siapa, dan kapan.")} ` : ""}${notes.length}/${NOTES_MAX}`} />
    </form>
  </FormModal>;
}

"use client";

import { useState, type FormEvent } from "react";
import type { TrainingFollowUp, TrainingStatus } from "../../../training/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { assessableEmployees, developmentById, developmentNeeds, employeeById, today, trainingById } from "../../data/selectors";
import { isTrainingRollback, TRAINING_RESULTS } from "../../../shared/rules";
import { FormError, FormModal, ModalActions, RadioField, ReadOnlyField, SearchSelectField, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { Button, Notice, statusLabel } from "../../ui/primitives";

const STATUSES: TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];

/** Passed / Not Passed, shown only for a completed training; Not Passed means the training is repeated. */
function ResultField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return <>
    <SelectField label="Result" testId="result" required value={value} onChange={(event) => onChange(event.target.value)} error={error} className="sm:col-span-2"
      helper="Detail hasil (nilai, sertifikat, catatan trainer) ditulis di Notes.">
      <option value="">Select result</option>
      {TRAINING_RESULTS.map((item) => <option key={item} value={item}>{item}</option>)}
    </SelectField>
    {value === "Not Passed" && <div className="sm:col-span-2"><Notice tone="warning">Requirement tetap terbuka. Setelah disimpan, catat tindak lanjutnya di detail training: Retraining atau Other follow-up.</Notice></div>}
    {value === "Passed" && <div className="sm:col-span-2"><Notice>Lanjutkan dengan menilai ulang kompetensinya di Competency Gap sebelum requirement ditandai Completed.</Notice></div>}
  </>;
}

export function TrainingFormModal({ employeeId, developmentNeedId, onClose }: { employeeId?: string; developmentNeedId?: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const [employee, setEmployee] = useState(employeeId ?? "");
  const [need, setNeed] = useState(developmentNeedId ?? "");
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<TrainingStatus>("Planned");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  // A completed requirement takes no new training; a new need is raised if the gap remains.
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee && item.status !== "Completed");
  const needOpen = needs.some((item) => item.needId === need);
  const futureDone = status === "Completed" && date > today();
  const missing = [!employee && "employee", !needOpen && "source requirement", !activity.trim() && "training/activity", !date && "date", status === "Completed" && !result && "result"].filter(Boolean);
  // Opened from a requirement or employee page: that context is fixed, not re-pickable.
  const lockedEmployee = employeeId ? employeeById(snapshot, employeeId) : undefined;
  const lockedNeed = developmentNeedId ? needs.find((item) => item.needId === developmentNeedId) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (missing.length) { setError(`Lengkapi ${missing.join(", ")} sebelum menyimpan.`); return; }
    if (futureDone) { setError("Training yang Completed tidak boleh bertanggal setelah hari ini."); return; }
    setError("");
    const chosen = needs.find((item) => item.needId === need);
    const saved = await run((source) => source.createTraining({ employeeId: employee, developmentNeedId: need, activity, date, status, result: status === "Completed" ? result : "", notes }), "Training tersimpan dan terhubung ke development requirement-nya.");
    if (!saved.ok) { setError(saved.error); return; }
    // The need's status is never moved automatically; offer the step instead of taking it.
    if (chosen && (chosen.status === "Identified" || chosen.status === "Planned")) setSavedFor(chosen.needId); else onClose();
  }

  if (savedFor) return <NeedProgressPrompt needId={savedFor} activity={activity} onClose={onClose} />;

  return <FormModal title="Add Training" description="Training selalu terhubung ke development requirement sebagai sumbernya." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Training" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {lockedEmployee ? <ReadOnlyField label="Employee" testId="employee" value={`${lockedEmployee.fullName} · ${lockedEmployee.employeeId}`} className="sm:col-span-2" />
          : <SearchSelectField label="Employee" testId="employee" required value={employee} onChange={(value) => { setEmployee(value); setNeed(""); }} error={touched && !employee ? "Employee wajib diisi." : undefined} className="sm:col-span-2" placeholder="Select employee"
            options={assessableEmployees(snapshot).map((item) => ({ value: item.id, label: `${item.fullName} · ${item.employeeId}` }))} />}
        {lockedNeed ? <ReadOnlyField label="Source requirement" testId="source-requirement" value={`${lockedNeed.objective} · ${statusLabel(lockedNeed.status)}`} className="sm:col-span-2" /> :
        <SelectField label="Source requirement" testId="source-requirement" required value={need} onChange={(event) => setNeed(event.target.value)} error={touched && employee && !needOpen ? "Pilih development requirement yang masih terbuka." : undefined} className="sm:col-span-2"
          helper="Requirement yang sudah Completed tidak ditampilkan.">
          <option value="">{!employee ? "Pilih pegawai terlebih dahulu" : needs.length ? "Select development requirement" : "Pegawai belum memiliki development requirement yang terbuka"}</option>
          {needs.map((item) => <option key={item.needId} value={item.needId}>{item.objective} · {statusLabel(item.status)}</option>)}
        </SelectField>}
        <TextField label="Training / activity" testId="training-activity" required value={activity} onChange={(event) => setActivity(event.target.value)} error={touched && !activity.trim() ? "Nama aktivitas wajib diisi." : undefined} className="sm:col-span-2" />
        <TextField label="Date" testId="date" required type="date" max={status === "Completed" ? today() : undefined} value={date} onChange={(event) => setDate(event.target.value)} error={touched && futureDone ? "Tidak boleh lebih dari hari ini untuk training yang Completed." : undefined} />
        <SelectField label="Status" required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}>{STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</SelectField>
        {status === "Completed" && <ResultField value={result} onChange={setResult} error={touched && !result ? "Result wajib dipilih bila status Completed." : undefined} />}
      </div>
      <TextAreaField label="Notes" testId="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
    </form>
  </FormModal>;
}

/** Shown after a training is saved for a need that is still Identified/Planned: a suggestion, never an automatic change. */
function NeedProgressPrompt({ needId, activity, onClose }: { needId: string; activity: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const need = developmentById(snapshot, needId);
  const [error, setError] = useState("");
  async function move() {
    const result = await run((source) => source.updateDevelopment(needId, "In Progress", `Training dijadwalkan: ${activity}`), "Development requirement dipindahkan ke In Progress.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Training tersimpan" description={need?.objective} onClose={onClose}
    footer={<><Button variant="secondary" onClick={onClose}>Nanti saja</Button><Button onClick={() => void move()} disabled={busy}>{busy ? "Saving…" : "Ubah ke In Progress"}</Button></>}>
    <FormError message={error} />
    <p className="text-sm text-ink-2">Development requirement ini masih berstatus <strong>{need?.status}</strong>. Pindahkan ke <strong>In Progress</strong> sekarang karena training sudah direncanakan? Status tidak diubah otomatis.</p>
  </FormModal>;
}

export function TrainingProgressModal({ trainingId, onClose }: { trainingId: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const record = trainingById(snapshot, trainingId);
  const [status, setStatus] = useState<TrainingStatus>(record?.status ?? "Planned");
  // Results saved before Passed/Not Passed existed are free text; they must be re-picked on completion.
  const [result, setResult] = useState((TRAINING_RESULTS as readonly string[]).includes(record?.result ?? "") ? record!.result : "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  // Moving back (e.g. Completed → In Progress) or reopening a cancelled training needs a reason.
  const rollback = record ? isTrainingRollback(record.status, status) : false;
  const saveResult = status === "Completed" ? result : "";
  const unchanged = status === record?.status && saveResult === (record?.result ?? "") && !notes.trim();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (status === "Completed" && !result) { setError("Result wajib dipilih bila status Completed: Passed atau Not Passed."); return; }
    if (status === "Completed" && record && record.date > today()) { setError("Training yang Completed tidak boleh bertanggal setelah hari ini."); return; }
    if (rollback && !notes.trim()) { setError(`Alasan wajib diisi saat status mundur dari ${statusLabel(record?.status ?? "")} ke ${statusLabel(status)}.`); return; }
    const saved = await run((source) => source.updateTraining(trainingId, status, saveResult, notes), "Progres training tersimpan sebagai versi baru.");
    if (saved.ok) onClose(); else setError(saved.error);
  }
  return <FormModal title="Update Progress" description={record?.activity} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Progress" disabled={unchanged} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <SelectField label="Status" required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}>{STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</SelectField>
      {status === "Completed" && <ResultField value={result} onChange={setResult} error={touched && !result ? "Result wajib dipilih." : undefined} />}
      <TextAreaField label={rollback ? "Reason for change" : "Update notes"} testId={rollback ? "alasan-perubahan" : "update-notes"} required={rollback} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && rollback && !notes.trim() ? "Alasan wajib diisi." : undefined}
        helper={rollback ? `Status mundur dari ${statusLabel(record?.status ?? "")}; alasannya disimpan di riwayat versi.` : undefined} />
      <Notice tone="warning">Menandai training Completed tidak otomatis menutup gap kompetensi; perlu penilaian ulang.</Notice>
    </form>
  </FormModal>;
}

const FOLLOW_UP_OPTIONS = [
  { value: "Retraining", label: "Retraining", description: "Training baru untuk requirement yang sama; form terisi otomatis." },
  { value: "Other follow-up", label: "Other follow-up", description: "Coaching, rotasi, atau eskalasi ke atasan. Catatan wajib." },
];

/** Q16: HR's follow-up of a Not Passed training, saved once as a new version of it (insert-only history). */
export function TrainingFollowUpModal({ trainingId, onClose }: { trainingId: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const record = trainingById(snapshot, trainingId);
  const need = record && developmentById(snapshot, record.developmentNeedId);
  const [followUp, setFollowUp] = useState<TrainingFollowUp | "">("");
  const [activity, setActivity] = useState(record?.activity ?? "");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const retraining = followUp === "Retraining", other = followUp === "Other follow-up";
  const missing = [!followUp && "follow-up", retraining && !activity.trim() && "training/activity", retraining && !date && "date", other && !notes.trim() && "notes"].filter(Boolean);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!followUp || missing.length) { setError(`Lengkapi ${missing.join(", ")} sebelum menyimpan.`); return; }
    setError("");
    const saved = await run((source) => source.recordTrainingFollowUp(trainingId, { followUp, notes, ...(retraining ? { activity, date } : {}) }),
      retraining ? "Retraining tercatat; training baru dibuat dengan status Planned." : "Tindak lanjut tercatat di riwayat training.");
    if (saved.ok) onClose(); else setError(saved.error);
  }

  return <FormModal title="Record Follow-up" description={record ? `${record.activity} · Not Passed` : undefined} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Follow-up" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <RadioField label="Follow-up" testId="follow-up" required value={followUp} onChange={(value) => { setFollowUp(value as TrainingFollowUp); setError(""); }} options={FOLLOW_UP_OPTIONS}
        error={touched && !followUp ? "Pilih tindak lanjut." : undefined} />
      {retraining && <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Source requirement" testId="retraining-source" value={need ? need.objective : "—"} className="sm:col-span-2" />
        <TextField label="Training / activity" testId="retraining-activity" required maxLength={200} value={activity} onChange={(event) => setActivity(event.target.value)} className="sm:col-span-2"
          error={touched && !activity.trim() ? "Nama training wajib diisi." : undefined} />
        <TextField label="Date" testId="retraining-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? "Tanggal wajib diisi." : undefined} />
        <ReadOnlyField label="Status" testId="retraining-status" value={statusLabel("Planned")} />
      </div>}
      <TextAreaField label="Notes" testId="follow-up-notes" required={other} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && other && !notes.trim() ? "Catatan wajib diisi untuk Other follow-up." : undefined}
        helper={other ? "Tulis langkahnya (coaching, rotasi, atau eskalasi ke atasan), siapa, dan kapan." : retraining ? "Opsional; disalin ke catatan training baru." : undefined} />
    </form>
  </FormModal>;
}

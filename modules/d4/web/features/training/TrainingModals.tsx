"use client";

import { useState, type FormEvent } from "react";
import type { TrainingStatus } from "../../../training/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { assessableEmployees, developmentById, developmentNeeds, today, trainingById } from "../../data/selectors";
import { isTrainingRollback } from "../../../shared/rules";
import { FormError, FormModal, ModalActions, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { Button, Notice } from "../../ui/primitives";

const STATUSES: TrainingStatus[] = ["Planned", "In Progress", "Completed", "Cancelled"];

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
  const futureCompleted = status === "Completed" && date > today();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!employee || !needOpen || !activity.trim() || !date || (status === "Completed" && !result.trim())) { setError("Lengkapi field wajib. Hasil wajib diisi bila status Completed."); return; }
    if (futureCompleted) { setError("Training berstatus Completed tidak boleh bertanggal setelah hari ini."); return; }
    setError("");
    const chosen = needs.find((item) => item.needId === need);
    const saved = await run((source) => source.createTraining({ employeeId: employee, developmentNeedId: need, activity, date, status, result, notes }), "Training tersimpan dan terhubung ke development requirement.");
    if (!saved.ok) { setError(saved.error); return; }
    // The need's status is never moved automatically; offer the step instead of taking it.
    if (chosen && (chosen.status === "Identified" || chosen.status === "Planned")) setSavedFor(chosen.needId); else onClose();
  }

  if (savedFor) return <NeedProgressPrompt needId={savedFor} activity={activity} onClose={onClose} />;

  return <FormModal title="Add Training" description="Training selalu terhubung ke development requirement sumber." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Training" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Employee" required value={employee} onChange={(event) => { setEmployee(event.target.value); setNeed(""); }} error={touched && !employee ? "Employee wajib dipilih." : undefined} className="sm:col-span-2">
          <option value="">Select employee</option>
          {/* Never yourself (assertNotSelf); a manager sees only their team. */}
          {assessableEmployees(snapshot).map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeId}</option>)}
        </SelectField>
        <SelectField label="Source requirement" required value={need} onChange={(event) => setNeed(event.target.value)} error={touched && !needOpen ? "Pilih development requirement yang masih terbuka." : undefined} className="sm:col-span-2"
          helper="Requirement berstatus Completed tidak ditampilkan.">
          <option value="">{needs.length ? "Select development requirement" : "Employee belum memiliki development requirement yang terbuka"}</option>
          {needs.map((item) => <option key={item.needId} value={item.needId}>{item.objective} · {item.status}</option>)}
        </SelectField>
        <TextField label="Training / activity" required value={activity} onChange={(event) => setActivity(event.target.value)} error={touched && !activity.trim() ? "Nama aktivitas wajib diisi." : undefined} className="sm:col-span-2" />
        <TextField label="Date" required type="date" value={date} onChange={(event) => setDate(event.target.value)}
          error={touched && futureCompleted ? "Training Completed tidak boleh bertanggal setelah hari ini." : undefined} />
        <SelectField label="Status" required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</SelectField>
        <TextField label="Result" required={status === "Completed"} value={result} onChange={(event) => setResult(event.target.value)} error={touched && status === "Completed" && !result.trim() ? "Hasil wajib diisi saat Completed." : undefined} className="sm:col-span-2" />
      </div>
      <TextAreaField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
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
  const [result, setResult] = useState(record?.result ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  // Moving back (e.g. Completed → In Progress) or reopening a cancelled training needs a reason.
  const rollback = record ? isTrainingRollback(record.status, status) : false;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (status === "Completed" && !result.trim()) { setError("Hasil wajib diisi saat training Completed."); return; }
    if (status === "Completed" && record && record.date > today()) { setError("Training berstatus Completed tidak boleh bertanggal setelah hari ini."); return; }
    if (rollback && !notes.trim()) { setError(`Alasan perubahan wajib diisi saat status kembali dari ${record?.status} ke ${status}.`); return; }
    const saved = await run((source) => source.updateTraining(trainingId, status, result, notes), "Progress training disimpan sebagai versi baru.");
    if (saved.ok) onClose(); else setError(saved.error);
  }
  return <FormModal title="Update Progress" description={record?.activity} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Progress" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <SelectField label="Status" required value={status} onChange={(event) => setStatus(event.target.value as TrainingStatus)}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</SelectField>
      <TextField label="Result" required={status === "Completed"} value={result} onChange={(event) => setResult(event.target.value)} />
      <TextAreaField label={rollback ? "Alasan perubahan" : "Update notes"} required={rollback} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && rollback && !notes.trim() ? "Alasan wajib diisi." : undefined}
        helper={rollback ? `Status mundur dari ${record?.status}; alasan tersimpan di riwayat versi.` : undefined} />
      <Notice tone="warning">Menandai training Completed tidak menutup competency gap secara otomatis; perlu reassessment.</Notice>
    </form>
  </FormModal>;
}

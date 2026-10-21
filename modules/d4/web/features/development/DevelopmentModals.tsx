"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { DevelopmentPriority, DevelopmentReassessment, DevelopmentSourceType, DevelopmentStatus } from "../../../development/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { isDevelopmentRollback, openNeedFor, passedTrainingCount, retrainedAt } from "../../../shared/rules";
import { assessableEmployees, currentGap, DEFAULT_SOURCE_TYPE, developmentById, developmentHistory, developmentNeeds, employeeById, formatDate, formatPeriod, latestCurrentPositionAssessment, objectiveFromFinding, positionOf, reassessmentFor, scorecardsOf, sourceTypeLabel, today, trainings } from "../../data/selectors";
import { FormError, FormModal, ModalActions, RadioField, ReadOnlyField, SearchSelectField, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { Notice, statusLabel } from "../../ui/primitives";
import { picOptions } from "./rows";

/** `objective`: suggested text for a gap source (competency and target level), still editable. */
type SourceOption = { ref: string; label: string; covered?: boolean; objective?: string };

/**
 * Valid sources for a development need, same rules the repository enforces. A gap that already has an
 * unfinished need is listed but disabled, so the same gap is not raised twice.
 */
export function sourceOptions(snapshot: ReturnType<typeof useSnapshot>, employeeId: string, type: DevelopmentSourceType): SourceOption[] {
  const employee = employeeById(snapshot, employeeId);
  if (!employee) return [];
  if (type === "competency_gap") {
    // Same rule as the server: gap-based needs come only after the assessment for the active position is saved.
    if (!latestCurrentPositionAssessment(snapshot, employee)) return [];
    const needs = developmentNeeds(snapshot);
    return (currentGap(snapshot, employee)?.findings ?? []).filter((item) => item.status === "Gap")
      .map((item) => ({ ref: item.requirementId, label: `${item.competencyName} · level ${item.actualLevel ?? "—"} of min. ${item.requiredLevel}`, covered: Boolean(openNeedFor(needs, employeeId, type, item.requirementId)), objective: objectiveFromFinding(item) }));
  }
  if (type === "role_change") return snapshot.competency.filter((item) => item.employeeId === employeeId && item.context === "role-change")
    .map((item) => ({ ref: item.id, label: `Position change assessment · ${formatDate(item.effectiveDate)}` }));
  return scorecardsOf(snapshot, employeeId).filter((item) => item.status === "completed")
    .map((item) => ({ ref: item.id, label: `Performance Review ${formatPeriod(item.period)} · ${item.evaluatorName || "—"}` }));
}

const DEVELOPMENT_METHODS = ["Training", "Coaching", "Mentoring", "On-the-job training", "Self-learning"];
const OBJECTIVE_HINT = "Tulis kompetensi yang kurang dan level targetnya.";
const OBJECTIVE_EXAMPLE = "Contoh: Naikkan Perencanaan Strategi & Anggaran dari level 3 ke 4";

function MethodField({ value, onChange, helper }: { value: string; onChange: (value: string) => void; helper?: string }) {
  return <>
    <TextField label="Method" testId="method" list="d4-development-methods" maxLength={120} value={value} onChange={(event) => onChange(event.target.value)} helper={helper} />
    <datalist id="d4-development-methods">{DEVELOPMENT_METHODS.map((item) => <option key={item} value={item} />)}</datalist>
  </>;
}

/** Q13: the PIC (penanggung jawab) is picked from the employee list and stored by name; "No PIC" leaves it empty. */
function PicField({ value, onChange, current }: { value: string; onChange: (value: string) => void; current?: string }) {
  const snapshot = useSnapshot();
  return <SearchSelectField label="PIC" testId="pic" value={value} onChange={onChange} placeholder="No PIC" options={picOptions(snapshot, current)}
    helper="Penanggung jawab yang menindaklanjuti requirement ini, dipilih dari daftar pegawai." />;
}

function PrioritySelect({ value, onChange }: { value: DevelopmentPriority; onChange: (value: DevelopmentPriority) => void }) {
  return <SelectField label="Priority" testId="priority" value={value} onChange={(event) => onChange(event.target.value as DevelopmentPriority)}>
    {(["High", "Medium", "Low"] as const).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
  </SelectField>;
}

export function DevelopmentFormModal({ employeeId, sourceType, sourceRef, onClose, onSaved }: { employeeId?: string; sourceType?: DevelopmentSourceType; sourceRef?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const [employee, setEmployee] = useState(employeeId ?? "");
  const [type, setType] = useState<DevelopmentSourceType>(sourceType ?? DEFAULT_SOURCE_TYPE);
  const [reference, setReference] = useState(sourceRef ?? "");
  // A gap source fills the objective in; the user's own text is never overwritten, only the last suggestion.
  const [suggested, setSuggested] = useState(() => sourceRef && employeeId ? sourceOptions(snapshot, employeeId, sourceType ?? DEFAULT_SOURCE_TYPE).find((item) => item.ref === sourceRef)?.objective ?? "" : "");
  const [objective, setObjective] = useState(suggested);
  const [priority, setPriority] = useState<DevelopmentPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("");
  const [pic, setPic] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const options = useMemo(() => sourceOptions(snapshot, employee, type), [snapshot, employee, type]);
  const selectedEmployee = employeeById(snapshot, employee);
  function pickReference(ref: string) {
    setReference(ref);
    const next = options.find((item) => item.ref === ref)?.objective ?? "";
    if (!objective.trim() || objective === suggested) setObjective(next);
    setSuggested(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    const chosen = options.find((item) => item.ref === reference && !item.covered);
    if (!employee || !chosen || !objective.trim()) { setError("Lengkapi employee, source reference, dan development objective sebelum menyimpan."); return; }
    setError("");
    // The gap changes as competencies are updated; keep the level seen when the need was raised.
    const snapshotNote = type === "competency_gap" ? `Gap saat dibuat (${formatDate(today())}): ${chosen.label}` : "";
    const result = await run((source) => source.createDevelopment({ employeeId: employee, sourceType: type, sourceRef: reference, objective, priority, method, pic, notes: [notes.trim(), snapshotNote].filter(Boolean).join("\n") }), "Development requirement tersimpan beserta referensi sumbernya.");
    if (result.ok) { onSaved?.(result.value); onClose(); } else setError(result.error);
  }

  return <FormModal title="Add Development Requirement" description="Setiap kebutuhan harus memiliki sumber yang dapat ditelusuri." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Requirement" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {employeeId ? <ReadOnlyField label="Employee" testId="employee" value={`${selectedEmployee?.fullName ?? "—"} · ${selectedEmployee?.employeeId ?? ""}`} className="sm:col-span-2" />
          : <SearchSelectField label="Employee" testId="employee" required value={employee} onChange={(value) => { setEmployee(value); pickReference(""); setError(""); }} error={touched && !employee ? "Employee wajib diisi." : undefined} className="sm:col-span-2" placeholder="Select employee"
            options={assessableEmployees(snapshot).map((item) => ({ value: item.id, label: `${item.fullName} · ${item.employeeId}` }))} />}
        <ReadOnlyField label="Position" testId="position" value={positionOf(snapshot, selectedEmployee)?.title ?? "—"} />
        {sourceType ? <ReadOnlyField label="Source type" testId="source-type" value={sourceTypeLabel[type]} /> : <SelectField label="Source type" testId="source-type" required value={type} onChange={(event) => { setType(event.target.value as DevelopmentSourceType); pickReference(""); }}>
          {(Object.keys(sourceTypeLabel) as DevelopmentSourceType[]).map((key) => <option key={key} value={key}>{sourceTypeLabel[key]}</option>)}
        </SelectField>}
        <SelectField label="Source reference" testId="source-reference" required value={reference} onChange={(event) => pickReference(event.target.value)} className="sm:col-span-2"
          error={touched && !reference ? "Source reference wajib diisi." : undefined}>
          <option value="">{options.some((item) => !item.covered) ? "Select source reference" : "Belum ada sumber yang valid"}</option>
          {options.map((item) => <option key={item.ref} value={item.ref} disabled={item.covered}>{item.label}{item.covered ? " · sudah ada requirement yang terbuka" : ""}</option>)}
        </SelectField>
        {employee && options.length > 0 && options.every((item) => item.covered) && <div className="sm:col-span-2"><Notice tone="warning">Setiap gap kompetensi pegawai ini sudah memiliki development requirement yang belum selesai. Perbarui yang sudah ada di Development Requirement.</Notice></div>}
        {employee && !options.length && <div className="sm:col-span-2"><Notice tone="warning">{type === "competency_gap" && selectedEmployee && !latestCurrentPositionAssessment(snapshot, selectedEmployee)
          ? "Simpan dulu penilaian kompetensi untuk posisi aktif pegawai ini (Competency Gap → Save Assessment); development requirement dibuat dari gap yang sudah tersimpan."
          : <>Pegawai ini belum memiliki sumber bertipe {sourceTypeLabel[type]}. Development tidak dibuat hanya karena waktu sudah berlalu.</>}</Notice></div>}
        <TextField label="Development objective" testId="development-objective" required maxLength={500} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder={OBJECTIVE_EXAMPLE}
          error={touched && !objective.trim() ? "Development objective wajib diisi." : undefined} className="sm:col-span-2"
          helper={suggested && objective === suggested ? `Diisi dari gap kompetensi; boleh diubah. ${OBJECTIVE_HINT}` : `${OBJECTIVE_HINT} ${OBJECTIVE_EXAMPLE}.`} />
        <PrioritySelect value={priority} onChange={setPriority} />
        <ReadOnlyField label="Created date" testId="created-date" value={formatDate(today())} />
        <MethodField value={method} onChange={setMethod} helper="Opsional. Boleh diisi nanti oleh HR." />
        <PicField value={pic} onChange={setPic} />
      </div>
      <TextAreaField label="Notes" testId="notes" value={notes} onChange={(event) => setNotes(event.target.value)} helper="HR yang menentukan metode training akhir; gap tidak menentukannya secara otomatis." />
    </form>
  </FormModal>;
}

export function DevelopmentStatusModal({ needId, onClose }: { needId: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const current = snapshot.developmentVersions.filter((item) => item.needId === needId).sort((a, b) => b.revision - a.revision)[0];
  const [status, setStatus] = useState<DevelopmentStatus>(current?.status ?? "Identified");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const openTrainings = trainings(snapshot).filter((item) => item.developmentNeedId === needId && (item.status === "Planned" || item.status === "In Progress"));
  // After a Retraining only trainings passed since then count, as on the server.
  const since = retrainedAt(developmentHistory(snapshot, needId));
  const passed = passedTrainingCount(trainings(snapshot), needId, since);
  const rollback = current ? isDevelopmentRollback(current.status, status) : false;
  // Same rules as the server: completing while training still runs, or without a passed training, needs a reason.
  const completingOpen = status === "Completed" && openTrainings.length > 0;
  const completingUnpassed = status === "Completed" && passed === 0;
  const needsReason = rollback || completingOpen || completingUnpassed;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rollback && !notes.trim()) { setError(`Alasan wajib diisi saat status mundur dari ${statusLabel(current?.status ?? "")} ke ${statusLabel(status)}.`); return; }
    if (completingOpen && !notes.trim()) { setError("Training untuk requirement ini masih Planned atau In Progress. Selesaikan atau batalkan dulu, atau jelaskan alasannya di Notes."); return; }
    if (completingUnpassed && !notes.trim()) { setError("Belum ada training berhasil Passed untuk requirement ini. Jelaskan di Notes mengapa requirement tetap diselesaikan."); return; }
    const result = await run((source) => source.updateDevelopment(needId, status, notes), "Status development diperbarui sebagai revisi baru.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Update Status" description={current?.objective} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Status" disabled={status === current?.status} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <SelectField label="Status" required value={status} onChange={(event) => setStatus(event.target.value as DevelopmentStatus)}>
        {(["Identified", "Planned", "In Progress", "Completed"] as const).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
      </SelectField>
      {status === "Completed" && openTrainings.length > 0 && <Notice tone="warning">Masih ada {openTrainings.length} training berstatus Planned/In Progress untuk requirement ini ({openTrainings.map((item) => item.activity).join(", ")}). Selesaikan atau batalkan terlebih dahulu, atau jelaskan alasannya di Notes.</Notice>}
      {completingUnpassed && <Notice tone="warning">Belum ada training dengan hasil Passed untuk requirement ini{since ? " sejak Retraining terakhir" : ""}. Jika gap ditutup dengan cara lain (misalnya coaching), jelaskan di Notes.</Notice>}
      <TextAreaField label="Notes" testId="notes" required={needsReason} value={notes} onChange={(event) => setNotes(event.target.value)} helper={status === current?.status ? `Status sudah ${status}. Pilih status lain untuk menyimpan.` : rollback ? "Wajib: status mundur ke tahap sebelumnya." : completingOpen ? "Wajib: jelaskan mengapa requirement diselesaikan saat training masih berjalan." : completingUnpassed ? "Wajib: belum ada training yang Passed." : undefined} />
      <Notice>Perubahan disimpan sebagai revisi baru; riwayat sebelumnya tetap tersedia. Status Completed tidak otomatis menutup gap kompetensi.</Notice>
    </form>
  </FormModal>;
}

/** Priority, method and PIC change after creation (interview D4: priority follows context, e.g. a tax policy change). */
export function DevelopmentEditModal({ needId, onClose }: { needId: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const current = developmentById(snapshot, needId);
  const [priority, setPriority] = useState<DevelopmentPriority>(current?.priority ?? "Medium");
  const [method, setMethod] = useState(current?.method ?? "");
  const [pic, setPic] = useState(current?.pic ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  if (!current) return null;
  const unchanged = priority === current.priority && method.trim() === (current.method ?? "") && pic.trim() === (current.pic ?? "");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!current || unchanged) return;
    const result = await run((source) => source.updateDevelopment(needId, current.status, notes, { priority, method, pic }), "Requirement diperbarui sebagai revisi baru.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Edit Requirement" description={current.objective} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Changes" disabled={unchanged} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PrioritySelect value={priority} onChange={setPriority} />
        <ReadOnlyField label="Status" testId="status" value={statusLabel(current.status)} />
        <MethodField value={method} onChange={setMethod} />
        <PicField value={pic} onChange={setPic} current={current.pic} />
      </div>
      <TextAreaField label="Reason for change" testId="alasan-perubahan" value={notes} onChange={(event) => setNotes(event.target.value)}
        helper={unchanged ? "Belum ada perubahan. Ubah Priority, Method, atau PIC untuk menyimpan." : "Opsional. Contoh: kebijakan pajak berubah, sertifikasi pajak dinaikkan ke High."} />
      <Notice>Perubahan disimpan sebagai revisi baru; nilai sebelumnya tetap ada di riwayat.</Notice>
    </form>
  </FormModal>;
}

/**
 * HR's decision after reassessing a Completed requirement (interview D4: "apakah harus dilakukan retraining?").
 * Retraining reopens the requirement as Planned so a new training can be created; Meets requirement keeps it Completed.
 */
export function ReassessmentModal({ needId, onClose }: { needId: string; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const current = developmentById(snapshot, needId);
  const [decision, setDecision] = useState<DevelopmentReassessment | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  if (!current) return null;
  // The decision already in force for this round; recording it again changes nothing.
  const recorded = reassessmentFor(snapshot, needId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (decision && decision === recorded) return;
    if (!decision) { setError("Pilih hasil reassessment: Retraining atau Meets requirement."); return; }
    const status: DevelopmentStatus = decision === "Retraining" ? "Planned" : "Completed";
    const result = await run((source) => source.updateDevelopment(needId, status, notes, { reassessment: decision }), "Hasil reassessment tersimpan sebagai revisi baru.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Record Reassessment" description={current.objective} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Reassessment" disabled={Boolean(decision) && decision === recorded} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <RadioField label="Reassessment result" testId="reassessment" required value={decision} onChange={(value) => setDecision(value as DevelopmentReassessment)}
        error={touched && !decision ? "Hasil reassessment wajib dipilih." : undefined}
        helper={decision && decision === recorded ? `${decision} sudah tercatat untuk requirement ini.` : "Hasil penilaian ulang kompetensi setelah training/development selesai."}
        options={[
          { value: "Retraining", label: "Retraining", description: "Gap belum tertutup, perlu training ulang." },
          { value: "Meets requirement", label: "Meets requirement", description: "Kompetensi sudah sesuai persyaratan posisi.", testId: "meets-requirement" },
        ]} />
      {decision === "Retraining" && <Notice tone="warning">Requirement dibuka kembali dengan status Planned agar training ulang bisa dibuat dari requirement yang sama.</Notice>}
      {decision === "Meets requirement" && <Notice>Requirement tetap Completed. Pastikan penilaian kompetensi terbaru sudah disimpan di Competency Gap.</Notice>}
      <TextAreaField label="Notes" testId="notes" value={notes} onChange={(event) => setNotes(event.target.value)} helper="Opsional. Misalnya hasil evaluasi bersama atasan atau departemen pengaju." />
      <p className="text-xs text-ink-3">Belum menilai ulang? <Link href={`/competency/${current.employeeId}`} className="font-semibold text-primary-600 hover:underline">Buka Competency Gap</Link> lalu simpan penilaian terbaru.</p>
    </form>
  </FormModal>;
}

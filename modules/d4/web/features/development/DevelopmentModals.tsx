"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../../../development/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { isDevelopmentRollback, openNeedFor } from "../../../shared/rules";
import { assessableEmployees, currentGap, developmentNeeds, employeeById, formatDate, formatPeriod, positionOf, sourceTypeLabel, today, trainings } from "../../data/selectors";
import { FormError, FormModal, ModalActions, ReadOnlyField, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { Notice } from "../../ui/primitives";

type SourceOption = { ref: string; label: string; covered?: boolean };

/**
 * Valid sources for a development need, same rules the repository enforces. A gap that already has an
 * unfinished need is listed but disabled, so the same gap is not raised twice.
 */
export function sourceOptions(snapshot: ReturnType<typeof useSnapshot>, employeeId: string, type: DevelopmentSourceType): SourceOption[] {
  const employee = employeeById(snapshot, employeeId);
  if (!employee) return [];
  if (type === "competency_gap") {
    const needs = developmentNeeds(snapshot);
    return (currentGap(snapshot, employee)?.findings ?? []).filter((item) => item.status === "Gap")
      .map((item) => ({ ref: item.requirementId, label: `${item.competencyName} · level ${item.actualLevel ?? "—"} dari min. ${item.requiredLevel}`, covered: Boolean(openNeedFor(needs, employeeId, type, item.requirementId)) }));
  }
  if (type === "role_change") return snapshot.competency.filter((item) => item.employeeId === employeeId && item.context === "role-change")
    .map((item) => ({ ref: item.id, label: `Assessment perubahan posisi · ${formatDate(item.effectiveDate)}` }));
  return snapshot.performance.filter((item) => item.employeeId === employeeId && item.status === "completed")
    .map((item) => ({ ref: item.id, label: `Evaluasi kinerja ${formatPeriod(item.period)}` }));
}

export function DevelopmentFormModal({ employeeId, sourceType, sourceRef, onClose, onSaved }: { employeeId?: string; sourceType?: DevelopmentSourceType; sourceRef?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const [employee, setEmployee] = useState(employeeId ?? "");
  const [type, setType] = useState<DevelopmentSourceType>(sourceType ?? "competency_gap");
  const [reference, setReference] = useState(sourceRef ?? "");
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState<DevelopmentPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const options = useMemo(() => sourceOptions(snapshot, employee, type), [snapshot, employee, type]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    const chosen = options.find((item) => item.ref === reference && !item.covered);
    if (!employee || !chosen || !objective.trim()) { setError("Lengkapi employee, referensi sumber, dan development objective."); return; }
    setError("");
    // The gap changes as competencies are updated; keep the level seen when the need was raised.
    const snapshotNote = type === "competency_gap" ? `Gap saat dibuat (${formatDate(today())}): ${chosen.label}` : "";
    const result = await run((source) => source.createDevelopment({ employeeId: employee, sourceType: type, sourceRef: reference, objective, priority, notes: [notes.trim(), snapshotNote].filter(Boolean).join("\n") }), "Development requirement tersimpan dengan referensi sumber.");
    if (result.ok) { onSaved?.(result.value); onClose(); } else setError(result.error);
  }

  return <FormModal title="Add Development Requirement" description="Setiap kebutuhan wajib punya sumber yang dapat ditelusuri." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Requirement" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Employee" required value={employee} onChange={(event) => { setEmployee(event.target.value); setReference(""); }} error={touched && !employee ? "Employee wajib dipilih." : undefined} className="sm:col-span-2">
          <option value="">Select employee</option>
          {/* Same list as evaluations: never yourself (assertNotSelf), a manager only their team. */}
          {assessableEmployees(snapshot).map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeId}</option>)}
        </SelectField>
        <ReadOnlyField label="Position" value={positionOf(snapshot, employeeById(snapshot, employee))?.title ?? "—"} />
        <SelectField label="Source type" required value={type} onChange={(event) => { setType(event.target.value as DevelopmentSourceType); setReference(""); }}>
          {(Object.keys(sourceTypeLabel) as DevelopmentSourceType[]).map((key) => <option key={key} value={key}>{sourceTypeLabel[key]}</option>)}
        </SelectField>
        <SelectField label="Source reference" required value={reference} onChange={(event) => setReference(event.target.value)} className="sm:col-span-2"
          error={touched && !reference ? "Referensi sumber wajib dipilih." : undefined}>
          <option value="">{options.some((item) => !item.covered) ? "Select source reference" : "Belum ada sumber yang valid"}</option>
          {options.map((item) => <option key={item.ref} value={item.ref} disabled={item.covered}>{item.label}{item.covered ? " · sudah ada requirement terbuka" : ""}</option>)}
        </SelectField>
        {employee && options.length > 0 && options.every((item) => item.covered) && <div className="sm:col-span-2"><Notice tone="warning">Semua gap kompetensi employee ini sudah memiliki development requirement yang belum selesai. Perbarui requirement yang ada di Development Requirement.</Notice></div>}
        {employee && !options.length && <div className="sm:col-span-2"><Notice tone="warning">Employee ini belum memiliki sumber bertipe {sourceTypeLabel[type]}. Development tidak dibuat hanya karena periode waktu berlalu.</Notice></div>}
        <TextField label="Development objective" required value={objective} onChange={(event) => setObjective(event.target.value)} error={touched && !objective.trim() ? "Objective wajib diisi." : undefined} className="sm:col-span-2" />
        <SelectField label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as DevelopmentPriority)}>
          {(["High", "Medium", "Low"] as const).map((item) => <option key={item}>{item}</option>)}
        </SelectField>
        <ReadOnlyField label="Created date" value={formatDate(today())} />
      </div>
      <TextAreaField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} helper="Metode training akhir dipilih HR; tidak ditentukan otomatis oleh gap." />
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
  const [touched, setTouched] = useState(false);
  // Moving back (e.g. Completed → Planned) needs a reason, same rule as training (assertDevelopmentChange).
  const rollback = current ? isDevelopmentRollback(current.status, status) : false;
  const openTrainings = trainings(snapshot).filter((item) => item.developmentNeedId === needId && (item.status === "Planned" || item.status === "In Progress"));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (rollback && !notes.trim()) { setError(`Alasan perubahan wajib diisi saat status kembali dari ${current?.status} ke ${status}.`); return; }
    const result = await run((source) => source.updateDevelopment(needId, status, notes), "Status development diperbarui sebagai revisi baru.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Update Status" description={current?.objective} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Status" />}>
    <form id="d4-modal-form" onSubmit={submit} className="space-y-5">
      <FormError message={error} />
      <SelectField label="Status" required value={status} onChange={(event) => setStatus(event.target.value as DevelopmentStatus)}>
        {(["Identified", "Planned", "In Progress", "Completed"] as const).map((item) => <option key={item}>{item}</option>)}
      </SelectField>
      {status === "Completed" && openTrainings.length > 0 && <Notice tone="warning">Masih ada {openTrainings.length} training berstatus Planned/In Progress untuk requirement ini ({openTrainings.map((item) => item.activity).join(", ")}). Selesaikan atau batalkan training tersebut dulu, atau jelaskan alasannya di Notes.</Notice>}
      <TextAreaField label={rollback ? "Alasan perubahan" : "Notes"} required={rollback} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && rollback && !notes.trim() ? "Alasan wajib diisi." : undefined}
        helper={rollback ? `Status mundur dari ${current?.status}; alasan tersimpan di riwayat revisi.` : undefined} />
      <Notice>Perubahan disimpan sebagai revisi baru; riwayat sebelumnya tetap tersedia. Status Completed tidak menutup competency gap secara otomatis.</Notice>
    </form>
  </FormModal>;
}

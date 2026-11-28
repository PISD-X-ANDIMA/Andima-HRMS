"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { DevelopmentNeedVersion, DevelopmentPriority, DevelopmentSourceType } from "../../../development/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { closeGapBlockedReason, closeGapNotes, openNeedFor, openTrainingCount } from "../../../shared/rules";
import { msg, plainText, type Translate } from "../../../shared/text";
import { assessableEmployees, currentGap, DEFAULT_SOURCE_TYPE, developmentById, developmentNeeds, employeeById, formatDate, formatPeriod, latestCurrentPositionAssessment, objectiveFromFinding, objectiveWithMethod, positionOf, scorecardsOf, sourceFinding, sourceTypeLabel, today, trainings, type Snapshot } from "../../data/selectors";
import { FormError, FormModal, ModalActions, ReadOnlyField, SearchSelectField, SelectField, SuggestField, TextAreaField, TextField } from "../../ui/forms";
import { useLanguage } from "../../i18n/LanguageProvider";
import { Notice, statusLabel } from "../../ui/primitives";
import { picOptions } from "./rows";

/** `objective`: suggested text for a gap source (competency and target level), still editable. */
type SourceOption = { ref: string; label: string; covered?: boolean; objective?: string };

/**
 * Valid sources for a development need, same rules the repository enforces. A gap that already has an
 * unfinished need is listed but disabled, so the same gap is not raised twice.
 */
export function sourceOptions(snapshot: ReturnType<typeof useSnapshot>, employeeId: string, type: DevelopmentSourceType, t: Translate = plainText): SourceOption[] {
  const employee = employeeById(snapshot, employeeId);
  if (!employee) return [];
  if (type === "competency_gap") {
    // Same rule as the server: gap-based needs come only after the assessment for the active position is saved.
    if (!latestCurrentPositionAssessment(snapshot, employee)) return [];
    const needs = developmentNeeds(snapshot);
    return (currentGap(snapshot, employee)?.findings ?? []).filter((item) => item.status === "Gap")
      .map((item) => ({ ref: item.requirementId, label: t("{competency} · level {actual} of min. {required}", { competency: item.competencyName, actual: item.actualLevel ?? "—", required: item.requiredLevel }), covered: Boolean(openNeedFor(needs, employeeId, type, item.requirementId)), objective: objectiveFromFinding(item) }));
  }
  if (type === "role_change") return snapshot.competency.filter((item) => item.employeeId === employeeId && item.context === "role-change")
    .map((item) => ({ ref: item.id, label: t("Position change assessment · {date}", { date: formatDate(item.effectiveDate, t.language) }) }));
  return scorecardsOf(snapshot, employeeId).filter((item) => item.status === "completed")
    .map((item) => ({ ref: item.id, label: `Performance Review ${formatPeriod(item.period, t.language)} · ${item.evaluatorName || "—"}` }));
}

// B12 (interview D4, 14 Oct 2026): internal/external training, certification, coaching. Free text stays allowed.
const DEVELOPMENT_METHODS = ["Internal training", "External training", "Certification", "Coaching"];
// TextAreaField's default limit, the server limit of notes.
const NOTES_MAX = 2000;
const OBJECTIVE_HINT = msg("Tulis kompetensi yang kurang, level targetnya, dan cara menutup gap.");
const OBJECTIVE_EXAMPLE = msg("Contoh: Naikkan Perencanaan Strategi & Anggaran dari level 3 ke 4 melalui External training");

function MethodField({ value, onChange, helper }: { value: string; onChange: (value: string) => void; helper?: string }) {
  const { t } = useLanguage();
  return <SuggestField label={t("Method")} testId="method" maxLength={120} value={value} onChange={onChange} suggestions={DEVELOPMENT_METHODS} helper={helper} placeholder={t("Select or type a method")} />;
}

/** Q13: the PIC (penanggung jawab) is picked from the employee list and stored by name. B13: it is required. */
function PicField({ value, onChange, current, error }: { value: string; onChange: (value: string) => void; current?: string; error?: string }) {
  const snapshot = useSnapshot();
  const { t } = useLanguage();
  return <SearchSelectField label="PIC" testId="pic" required value={value} onChange={onChange} placeholder={t("Select PIC")} options={picOptions(snapshot, current, t)} error={error}
    helper={t("Penanggung jawab yang menindaklanjuti requirement ini, dipilih dari daftar pegawai.")} />;
}

function PrioritySelect({ value, onChange }: { value: DevelopmentPriority; onChange: (value: DevelopmentPriority) => void }) {
  const { t } = useLanguage();
  return <SelectField label={t("Priority")} testId="priority" value={value} onChange={(event) => onChange(event.target.value as DevelopmentPriority)}>
    {(["High", "Medium", "Low"] as const).map((item) => <option key={item} value={item}>{t(statusLabel(item))}</option>)}
  </SelectField>;
}

export function DevelopmentFormModal({ employeeId, sourceType, sourceRef, onClose, onSaved }: { employeeId?: string; sourceType?: DevelopmentSourceType; sourceRef?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t, language } = useLanguage();
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
  const options = useMemo(() => sourceOptions(snapshot, employee, type, t), [snapshot, employee, type, t]);
  const selectedEmployee = employeeById(snapshot, employee);
  const suggestion = objectiveWithMethod(suggested, method);
  function pickReference(ref: string) {
    setReference(ref);
    const next = options.find((item) => item.ref === ref)?.objective ?? "";
    if (!objective.trim() || objective === suggestion) setObjective(objectiveWithMethod(next, method));
    setSuggested(next);
  }
  function chooseMethod(value: string) {
    if (suggested && objective === suggestion) setObjective(objectiveWithMethod(suggested, value));
    setMethod(value);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    const chosen = options.find((item) => item.ref === reference && !item.covered);
    // PW1: name only the fields that are actually empty, and take the user to the first one.
    const missing = [!employee && [t("employee"), "input-employee"], !chosen && [t("source reference"), "input-source-reference"], !objective.trim() && [t("development objective"), "input-development-objective"], !pic.trim() && ["PIC", "input-pic"]].filter((item) => item !== false);
    if (!chosen || missing.length) {
      setError(t("Lengkapi {fields} sebelum menyimpan.", { fields: missing.map(([field]) => field).join(", ") }));
      document.querySelector<HTMLElement>(`[data-testid="${missing[0][1]}"]`)?.focus();
      return;
    }
    setError("");
    // The gap changes as competencies are updated; keep the level seen when the need was raised.
    // Stored in the notes, so it keeps the source language whatever language the screen shows.
    const snapshotNote = type === "competency_gap" ? `Gap saat dibuat (${formatDate(today())}): ${sourceOptions(snapshot, employee, type).find((item) => item.ref === chosen.ref)?.label}` : "";
    const result = await run((source) => source.createDevelopment({ employeeId: employee, sourceType: type, sourceRef: reference, objective, priority, method, pic, notes: [notes.trim(), snapshotNote].filter(Boolean).join("\n") }), t("Development requirement tersimpan beserta referensi sumbernya."));
    if (result.ok) { onSaved?.(result.value); onClose(); } else setError(result.error);
  }

  return <FormModal title={t("Add Development Requirement")} description={t("Setiap kebutuhan harus memiliki sumber yang dapat ditelusuri.")} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Save Requirement")} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {employeeId ? <ReadOnlyField label={t("Employee")} testId="employee" value={`${selectedEmployee?.fullName ?? "—"} · ${selectedEmployee?.employeeId ?? ""}`} className="sm:col-span-2" />
          : <SearchSelectField label={t("Employee")} testId="employee" required value={employee} onChange={(value) => { setEmployee(value); pickReference(""); setError(""); }} error={touched && !employee ? t("Employee wajib diisi.") : undefined} className="sm:col-span-2" placeholder={t("Select employee")}
            options={assessableEmployees(snapshot).map((item) => ({ value: item.id, label: `${item.fullName} · ${item.employeeId}` }))} />}
        <ReadOnlyField label={t("Position")} testId="position" value={positionOf(snapshot, selectedEmployee)?.title ?? "—"} />
        {sourceType ? <ReadOnlyField label={t("Source type")} testId="source-type" value={t(sourceTypeLabel[type])} /> : <SelectField label={t("Source type")} testId="source-type" required value={type} onChange={(event) => { setType(event.target.value as DevelopmentSourceType); pickReference(""); }}>
          {(Object.keys(sourceTypeLabel) as DevelopmentSourceType[]).map((key) => <option key={key} value={key}>{t(sourceTypeLabel[key])}</option>)}
        </SelectField>}
        <SelectField label={t("Source reference")} testId="source-reference" required value={reference} onChange={(event) => pickReference(event.target.value)} className="sm:col-span-2"
          error={touched && !reference ? t("Source reference wajib diisi.") : undefined}>
          <option value="">{options.some((item) => !item.covered) ? t("Select source reference") : t("Belum ada sumber yang valid")}</option>
          {options.map((item) => <option key={item.ref} value={item.ref} disabled={item.covered}>{item.label}{item.covered ? ` · ${t("sudah ada requirement yang terbuka")}` : ""}</option>)}
        </SelectField>
        {employee && options.length > 0 && options.every((item) => item.covered) && <div className="sm:col-span-2"><Notice tone="warning">{t("Setiap gap kompetensi pegawai ini sudah memiliki development requirement yang belum selesai. Perbarui yang sudah ada di Development Requirement.")}</Notice></div>}
        {employee && !options.length && <div className="sm:col-span-2"><Notice tone="warning">{type === "competency_gap" && selectedEmployee && !latestCurrentPositionAssessment(snapshot, selectedEmployee)
          ? t("Simpan dulu penilaian kompetensi untuk posisi aktif pegawai ini (Competency Gap → Save Assessment); development requirement dibuat dari gap yang sudah tersimpan.")
          : t("Pegawai ini belum memiliki sumber bertipe {type}. Development tidak dibuat hanya karena waktu sudah berlalu.", { type: t(sourceTypeLabel[type]) })}</Notice></div>}
        <TextField label={t("Development objective")} testId="development-objective" required maxLength={500} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder={t(OBJECTIVE_EXAMPLE)}
          error={touched && !objective.trim() ? t("Development objective wajib diisi.") : undefined} className="sm:col-span-2"
          helper={`${suggested && objective === suggestion ? `${method.trim() ? t("Diisi dari gap kompetensi dan Method; boleh diubah.") : t("Diisi dari gap kompetensi; boleh diubah.")} ${t(OBJECTIVE_HINT)}` : `${t(OBJECTIVE_HINT)} ${t(OBJECTIVE_EXAMPLE)}.`} ${objective.length}/500`} />
        <PrioritySelect value={priority} onChange={setPriority} />
        <ReadOnlyField label={t("Created date")} testId="created-date" value={formatDate(today(), language)} />
        <MethodField value={method} onChange={chooseMethod} helper={t("Opsional, tetapi bila sudah diketahui akan ikut masuk ke objective sebagai cara menutup gap.")} />
        <PicField value={pic} onChange={setPic} error={touched && !pic.trim() ? t("PIC wajib diisi.") : undefined} />
      </div>
      <TextAreaField label={t("Notes")} testId="notes" value={notes} onChange={(event) => setNotes(event.target.value)} helper={`${t("HR yang menentukan metode training akhir; gap tidak menentukannya secara otomatis.")} ${notes.length}/${NOTES_MAX}`} />
    </form>
  </FormModal>;
}

/** The open activity a requirement's progress is updated in (13 Nov 2026: Training Tracking is the one writer). */
export const openTrainingOf = (snapshot: Snapshot, needId: string) => trainings(snapshot)
  .filter((item) => item.developmentNeedId === needId && (item.status === "Planned" || item.status === "In Progress"))
  .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];

/** Path B: whether a requirement may close on the level evidence alone ("" when it may), and the finding that proves it. */
export function closeEvidence(snapshot: Snapshot, need: DevelopmentNeedVersion, t: Translate = plainText) {
  const finding = sourceFinding(snapshot, need);
  return { finding, blocked: closeGapBlockedReason(need, finding, openTrainingCount(trainings(snapshot), need.needId), t) };
}

/** Closes a Competency Gap requirement whose level is already met, without a training (e.g. after coaching). */
export function CloseAsMetModal({ needId, onClose, onSaved }: { needId: string; onClose: () => void; onSaved?: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const need = developmentById(snapshot, needId);
  const evidence = need && closeEvidence(snapshot, need, t);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await run((source) => source.closeDevelopment(needId), t("Requirement ditutup: gap terpenuhi."));
    if (result.ok) { onSaved?.(); onClose(); } else setError(result.error);
  }
  return <FormModal title={t("Close as Met")} description={need?.objective} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Close Requirement")} disabled={!evidence || Boolean(evidence.blocked)} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      {evidence?.finding && !evidence.blocked
        ? <Notice>{closeGapNotes(evidence.finding, today())} {t("Requirement disimpan sebagai Completed dengan reassessment Meets requirement.")}</Notice>
        : <Notice tone="warning">{evidence?.blocked}</Notice>}
    </form>
  </FormModal>;
}

/** Priority, method and PIC change after creation (interview D4: priority follows context, e.g. a tax policy change). */
export function DevelopmentEditModal({ needId, onClose, onSaved }: { needId: string; onClose: () => void; onSaved?: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t } = useLanguage();
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
    if (!pic.trim()) { setError(t("PIC wajib diisi.")); return; }
    const result = await run((source) => source.updateDevelopment(needId, current.status, notes, { priority, method, pic }), t("Requirement diperbarui sebagai revisi baru."));
    if (result.ok) { onSaved?.(); onClose(); } else setError(result.error);
  }
  return <FormModal title={t("Edit Requirement")} description={current.objective} onClose={onClose} footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Save Changes")} disabled={unchanged} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PrioritySelect value={priority} onChange={setPriority} />
        <ReadOnlyField label={t("Status")} testId="status" value={t(statusLabel(current.status))} />
        <MethodField value={method} onChange={setMethod} />
        <PicField value={pic} onChange={setPic} current={current.pic} />
      </div>
      <TextAreaField label={t("Reason for change")} testId="alasan-perubahan" value={notes} onChange={(event) => setNotes(event.target.value)}
        helper={`${unchanged ? t("Belum ada perubahan. Ubah Priority, Method, atau PIC untuk menyimpan.") : t("Opsional. Contoh: kebijakan pajak berubah, sertifikasi pajak dinaikkan ke High.")} ${notes.length}/${NOTES_MAX}`} />
      <Notice>{t("Perubahan disimpan sebagai revisi baru; nilai sebelumnya tetap ada di riwayat.")}</Notice>
    </form>
  </FormModal>;
}

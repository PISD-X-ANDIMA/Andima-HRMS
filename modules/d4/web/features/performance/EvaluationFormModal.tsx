"use client";

import { useState, type FormEvent } from "react";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { latestForPeriod } from "../../../shared/rules";
import { assessableEmployees, departmentOf, employeeById, formatDate, positionOf, SCORE_LABELS, thisMonth, today } from "../../data/selectors";
import { FormError, FormModal, ModalActions, ReadOnlyField, RevisionConfirm, SelectField, TextAreaField, TextField } from "../../ui/forms";

/**
 * FR-01.2: employee, period, result or notes, date, evaluator, optional evidence. The result is the
 * evaluator's own 1–5 score (same scale as the KPI scorecard); the form adds no aspects, weights or
 * review labels because FR-D4-001 defines none.
 */
export function EvaluationFormModal({ employeeId, onClose, onSaved }: { employeeId?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const actor = employeeById(snapshot, snapshot.actorEmployeeId);
  const [employee, setEmployee] = useState(employeeId ?? "");
  const [period, setPeriod] = useState(thisMonth());
  const [date, setDate] = useState(today());
  // The evaluator is the signed-in user; the server stores that name and ignores the form value.
  const evaluator = actor?.fullName ?? "";
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [revise, setRevise] = useState(false);
  const selected = employeeById(snapshot, employee);
  const existing = employee && period ? latestForPeriod(snapshot.performance, employee, period) : undefined;
  const missing = [!employee && "karyawan", !period && "periode", !date && "tanggal", date > today() && "tanggal tidak melebihi hari ini", score === null && "hasil evaluasi", !notes.trim() && "catatan evaluasi", existing && !revise && "konfirmasi revisi"].filter(Boolean);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (missing.length) { setError(`Lengkapi ${missing.join(", ")} sebelum menyimpan.`); return; }
    setError("");
    const result = await run((source) => source.createEvaluation({
      employeeId: employee, period, evaluationDate: date, evaluator, status: "completed", reviewStatus: "Needs Review",
      overallScore: score, aspects: [], generalNotes: notes, evidenceReference: evidence.trim() || null, revisionOf: existing?.id ?? null,
    }), "Evaluasi kinerja tersimpan.");
    if (result.ok) { onSaved?.(result.value); onClose(); } else setError(result.error);
  }

  return <FormModal title="Tambah Evaluasi" description="Evaluasi baru disimpan sebagai riwayat periode; evaluasi periode sebelumnya tidak ditimpa." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Simpan Evaluasi" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Karyawan" testId="employee" required value={employee} onChange={(event) => setEmployee(event.target.value)} error={touched && !employee ? "Karyawan wajib dipilih." : undefined} className="sm:col-span-2">
          <option value="">Pilih karyawan</option>
          {assessableEmployees(snapshot).map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeId}</option>)}
        </SelectField>
        <ReadOnlyField label="Posisi" testId="position" value={positionOf(snapshot, selected)?.title ?? "—"} />
        <ReadOnlyField label="Departemen" testId="department" value={departmentOf(snapshot, selected)?.name ?? "—"} />
        <TextField label="Periode" testId="period" required type="month" value={period} onChange={(event) => setPeriod(event.target.value)} error={touched && !period ? "Periode wajib dipilih." : undefined} />
        <TextField label="Tanggal evaluasi" testId="evaluation-date" required type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? "Tanggal wajib diisi." : touched && date > today() ? "Tidak boleh melebihi hari ini." : undefined} />
        <ReadOnlyField label="Penilai" testId="evaluator" value={evaluator || "—"} />
        <SelectField label="Hasil evaluasi" required value={score ?? ""} onChange={(event) => setScore(event.target.value ? Number(event.target.value) : null)}
          error={touched && score === null ? "Hasil evaluasi wajib dipilih." : undefined} helper="Skala 1–5 mengikuti label KPI Scorecard V5.1. Diisi penilai; tidak memicu keputusan HR otomatis.">
          <option value="">Pilih hasil</option>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} · {SCORE_LABELS[value]}</option>)}
        </SelectField>
      </div>
      {existing && <RevisionConfirm what="Evaluasi" existing={`${existing.evaluator}, ${formatDate(existing.evaluationDate)}`} checked={revise} onChange={setRevise}
        error={touched && !revise ? "Centang untuk menyimpan sebagai revisi, atau ganti periode." : undefined} />}
      <TextAreaField label="Catatan evaluasi" required value={notes} onChange={(event) => setNotes(event.target.value)} error={touched && !notes.trim() ? "Catatan evaluasi wajib diisi." : undefined}
        helper={existing ? "Untuk revisi, tuliskan juga alasan revisinya." : "Termasuk rekomendasi/rencana pelatihan bila ada — dapat dipakai sebagai konteks Development Requirement."} />
      <TextField label="Bukti / referensi" testId="evidence-reference" value={evidence} onChange={(event) => setEvidence(event.target.value)} helper="Opsional: nomor dokumen atau tautan bukti." />
    </form>
  </FormModal>;
}

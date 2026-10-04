"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ACTIVE_KPI_VERSION, indicatorsFor, roleForPositionTitle } from "../../../kpi/catalog";
import type { KpiAssessmentLine } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { latestForPeriod } from "../../../shared/rules";
import { assessableEmployees, departmentOf, employeeById, formatDate, positionOf, SCORE_LABELS, thisMonth, today } from "../../data/selectors";
import { FormError, FormModal, ModalActions, ReadOnlyField, RevisionConfirm, SelectField, TextAreaField, TextField } from "../../ui/forms";
import { cx, Notice } from "../../ui/primitives";

/** FR-02.11: positions without a KPI role in the catalog get no scorecard; no mapping is invented for them. */
export const noKpiText = (version = ACTIVE_KPI_VERSION) => `Posisi ini belum memiliki KPI di katalog ${version} — hubungi HR.`;

const validScore = (value: number | null) => value !== null && Number.isInteger(value) && value >= 1 && value <= 5;

/** Weighted = weight × raw score (FR-02.5); total = Σ weighted (FR-02.6). Target/realisation never produce the raw score (FR-02.12). */
export function weighted(line: Pick<KpiAssessmentLine, "weight_percent" | "raw_score">) {
  return validScore(line.raw_score) ? line.weight_percent * (line.raw_score ?? 0) / 100 : null;
}

export function KpiFormModal({ employeeId, onClose, onSaved }: { employeeId?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const snapshot = useSnapshot();
  const { catalog, run, busy } = useD4();
  const actor = employeeById(snapshot, snapshot.actorEmployeeId);
  const suggest = (id: string) => catalog ? roleForPositionTitle(catalog, positionOf(snapshot, employeeById(snapshot, id))?.title) : 0;
  const linesFor = (roleOrder: number): KpiAssessmentLine[] => catalog ? indicatorsFor(catalog, roleOrder).map((row) => ({
    indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: row.target ?? "", actual: "", raw_score: null, comment: "",
  })) : [];

  const [employee, setEmployee] = useState(employeeId ?? "");
  const [roleOrder, setRoleOrder] = useState(() => employeeId ? suggest(employeeId) : 0);
  const [lines, setLines] = useState<KpiAssessmentLine[]>(() => linesFor(employeeId ? suggest(employeeId) : 0));
  const [period, setPeriod] = useState(thisMonth());
  const [date, setDate] = useState(today());
  // The evaluator is the signed-in user; the server stores that name and ignores the form value.
  const evaluator = actor?.fullName ?? "";
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [revise, setRevise] = useState(false);
  const existing = employee && period ? latestForPeriod(snapshot.kpiAssessments ?? [], employee, period) : undefined;

  const totalWeight = lines.reduce((sum, line) => sum + line.weight_percent, 0);
  const allScored = lines.length === 5 && lines.every((line) => validScore(line.raw_score));
  const total = allScored ? Math.round(lines.reduce((sum, line) => sum + (weighted(line) ?? 0), 0) * 100) / 100 : null;
  const selected = employeeById(snapshot, employee);
  const position = positionOf(snapshot, selected);
  const roleName = roleOrder && catalog ? indicatorsFor(catalog, roleOrder)[0]?.role_name : undefined;

  function chooseEmployee(id: string) { setEmployee(id); const role = suggest(id); setRoleOrder(role); setLines(linesFor(role)); }
  function setLine(index: number, patch: Partial<KpiAssessmentLine>) { setLines((items) => items.map((line, at) => at === index ? { ...line, ...patch } : line)); }

  // FR-02.1/FR-02.11: the KPI set follows the employee's position; HR cannot pick another position's KPI.
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!employee) { setError("Pilih employee terlebih dahulu."); return; }
    if (!roleOrder || lines.length !== 5 || totalWeight !== 100) { setError("KPI untuk position ini belum tersedia di KPI Scorecard; scorecard tidak dapat disimpan."); return; }
    if (!allScored || !period || !date) { setError("Lengkapi periode, evaluation date, dan skor 1–5 untuk kelima KPI."); return; }
    if (existing && !revise) { setError("Scorecard periode ini sudah ada. Centang “Simpan sebagai revisi” atau ganti periode."); return; }
    if (existing && !notes.trim()) { setError("Tuliskan alasan revisi di catatan sebelum menyimpan."); return; }
    setError("");
    const result = await run((source) => source.createKpiAssessment({ employeeId: employee, roleOrder, period, evaluationDate: date, evaluatorName: evaluator, status: "completed", lines, generalNotes: notes, revisionOf: existing?.id ?? null }),
      "KPI scorecard tersimpan.");
    if (result.ok) { onSaved?.(result.value); onClose(); } else setError(result.error);
  }

  return <FormModal size="lg" title="Add Scorecard" description={`Lima Core KPI dan bobot mengikuti KPI Scorecard ${catalog?.version ?? ""} sesuai position employee.`} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Scorecard" disabled={Boolean(employee) && !lines.length} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Employee" required value={employee} onChange={(event) => chooseEmployee(event.target.value)} error={touched && !employee ? "Employee wajib dipilih." : undefined} className="sm:col-span-2">
          <option value="">Select employee</option>
          {assessableEmployees(snapshot).map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.employeeId}</option>)}
        </SelectField>
        <TextField label="Period" required type="month" value={period} onChange={(event) => setPeriod(event.target.value)} error={touched && !period ? "Periode wajib dipilih." : undefined} />
        <ReadOnlyField label="Position" value={position?.title ?? "—"} />
        <ReadOnlyField label="Department" value={departmentOf(snapshot, selected)?.name ?? "—"} />
        <ReadOnlyField label="KPI jabatan" value={!employee ? "—" : roleName ?? `Belum ada di katalog ${catalog?.version ?? ACTIVE_KPI_VERSION}`} />
        <TextField label="Evaluation date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? "Tanggal wajib diisi." : undefined} />
        <ReadOnlyField label="Evaluator" value={evaluator || "—"} className="sm:col-span-2" />
      </div>
      {existing && <RevisionConfirm what="Scorecard" existing={`${existing.evaluatorName}, ${formatDate(existing.evaluationDate)}`} checked={revise} onChange={setRevise}
        error={touched && !revise ? "Centang untuk menyimpan sebagai revisi, atau ganti periode." : undefined} />}

      {employee && !lines.length ? <Notice tone="warning">{position ? noKpiText(catalog?.version) : "Employee belum memiliki position aktif, sehingga KPI belum dapat ditentukan."}</Notice> : <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">
            <tr><th className="w-10 px-3 py-2.5">No</th><th className="px-3 py-2.5">Core KPI</th><th className="w-20 px-3 py-2.5">Bobot</th><th className="w-36 px-3 py-2.5">Target</th><th className="w-36 px-3 py-2.5">Realisasi</th><th className="w-24 px-3 py-2.5">Skor 1–5</th><th className="w-24 px-3 py-2.5 text-right">Terbobot</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => <tr key={`${roleOrder}-${line.indicator_order}`} className="border-t border-line align-middle">
              <td className="px-3 py-2.5 text-ink-3">{line.indicator_order}</td>
              <td className="px-3 py-2.5 font-semibold leading-5">{line.kpi_name}</td>
              <td className="px-3 py-2.5 tabular-nums">{line.weight_percent}%</td>
              <td className="px-3 py-2"><input aria-label={`Target ${line.kpi_name}`} value={line.target} onChange={(event) => setLine(index, { target: event.target.value })} className="h-9 w-full rounded-lg border border-line-strong px-2 text-sm" /></td>
              <td className="px-3 py-2"><input aria-label={`Realisasi ${line.kpi_name}`} value={line.actual} onChange={(event) => setLine(index, { actual: event.target.value })} className="h-9 w-full rounded-lg border border-line-strong px-2 text-sm" /></td>
              <td className="px-3 py-2"><select aria-label={`Skor ${line.kpi_name}`} aria-invalid={touched && !validScore(line.raw_score)} value={line.raw_score ?? ""} onChange={(event) => setLine(index, { raw_score: event.target.value ? Number(event.target.value) : null })} className="h-9 w-full rounded-lg border border-line-strong px-2 text-sm aria-[invalid=true]:border-danger"><option value="">—</option>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{weighted(line)?.toFixed(2) ?? "—"}</td>
            </tr>)}
          </tbody>
          <tfoot className="border-t border-line bg-app">
            <tr><td colSpan={2} className="px-3 py-3 font-semibold">Total</td>
              <td className="px-3 py-3"><span className={cx("inline-flex items-center gap-1 text-xs font-semibold", totalWeight === 100 ? "text-success" : "text-danger")}>{totalWeight === 100 ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}{lines.length ? `${totalWeight}%` : "—"}</span></td>
              <td colSpan={3} className="px-3 py-3 text-xs text-ink-3">{lines.length ? (totalWeight === 100 ? "Total bobot 100%" : "Total bobot harus 100%") : "Pilih employee untuk menampilkan KPI position-nya."}</td>
              <td className="px-3 py-3 text-right font-display text-base tabular-nums">{total === null ? "—" : `${total.toFixed(2)} / 5`}</td></tr>
          </tfoot>
        </table>
      </div>}
      <p className="text-xs text-ink-3">Kriteria skor: {[1, 2, 3, 4, 5].map((value) => `${value} ${SCORE_LABELS[value]}`).join(" · ")}. Skor mentah diisi evaluator; sistem tidak mengonversi realisasi menjadi skor dan tidak memberi label tercapai/tidak tercapai.</p>
      {/* A revision replaces the scorecard shown for the period, so its reason is required (assertRevisionReason). */}
      <TextAreaField label={existing ? "Catatan / alasan revisi" : "Catatan / rekomendasi atasan"} required={Boolean(existing)} value={notes} onChange={(event) => setNotes(event.target.value)}
        error={touched && existing && !notes.trim() ? "Alasan revisi wajib diisi." : undefined} />
    </form>
  </FormModal>;
}

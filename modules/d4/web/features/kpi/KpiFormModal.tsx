"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { catalogFor, indicatorsFor, KPI_TARGET, roleForPosition, targetOf, type KpiCatalog, type KpiCatalogSet } from "../../../kpi/catalog";
import { HIGH_ABOVE, performanceBand, scaleMaxOf, UNDER_BELOW } from "../../../kpi/scale";
import type { KpiAssessmentLine } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { latestForPeriod, periodDateError } from "../../../shared/rules";
import { assessableEmployees, departmentOf, employeeById, formatDate, positionOf, SCORE_LABELS, thisMonth, today } from "../../data/selectors";
import { FormError, FormModal, ModalActions, ReadOnlyField, RevisionConfirm, SearchSelectField, TextAreaField, TextField } from "../../ui/forms";
import { cx, Notice, StatusBadge } from "../../ui/primitives";

/** FR-02.11: positions without a KPI role in the catalog get no scorecard; no mapping is invented for them. */
export const noKpiText = (version?: string) => version ? `Posisi ini belum memiliki KPI di katalog ${version} — hubungi HR.` : "Belum ada katalog KPI yang berlaku untuk periode ini — hubungi HR.";

/** Integer raw score within the scale of the catalog version: 1–5 (V3.1, V5.1) or 1–100 (V6 onward). */
const validScore = (value: number | null, max = 5) => value !== null && Number.isInteger(value) && value >= 1 && value <= max;

/** Weighted = weight × raw score (FR-02.5); total = Σ weighted (FR-02.6). The raw score is the number typed in Actual (Q4). */
export function weighted(line: Pick<KpiAssessmentLine, "weight_percent" | "raw_score">, max = 5) {
  return validScore(line.raw_score, max) ? line.weight_percent * (line.raw_score ?? 0) / 100 : null;
}

/** Total of five scored lines, rounded to 2 decimals like the trigger d4_calculate_kpi_assessment; null until all five are valid. */
export function scorecardTotal(lines: readonly Pick<KpiAssessmentLine, "weight_percent" | "raw_score">[], max = 5) {
  if (lines.length !== 5 || !lines.every((line) => validScore(line.raw_score, max))) return null;
  return Math.round(lines.reduce((sum, line) => sum + (weighted(line, max) ?? 0), 0) * 100) / 100;
}

/**
 * Q4 (20 Oct 2026): Actual is the only value input and its number is the raw score, so the Actual and Score columns
 * are one. `actual` keeps the same number as text; realisation notes go to Comment. Empty or not a number = not scored.
 */
export function actualInput(value: string): Pick<KpiAssessmentLine, "actual" | "raw_score"> {
  const score = value.trim() ? Number(value) : NaN;
  return Number.isFinite(score) ? { actual: String(score), raw_score: score } : { actual: "", raw_score: null };
}

/** Realisation text from the old Actual column (scorecards saved before Q4); a newer line holds its own score there. */
export function legacyRealisation(line: Pick<KpiAssessmentLine, "actual" | "raw_score">) {
  const text = String(line.actual ?? "").trim();
  return text && text !== String(line.raw_score) ? text : "";
}

/** Comment cell of a saved line; old realisation text stays readable here instead of in a separate column. */
export function LineComment({ line }: { line: KpiAssessmentLine }) {
  const realisation = legacyRealisation(line);
  if (!realisation) return <>{line.comment || "—"}</>;
  return <><span data-testid={`kpi-realisation-${line.indicator_order}`} title="Teks realisasi dari kolom Actual lama, sebelum Actual menjadi skor." className="block">Realisation: {realisation}</span>{line.comment && <span className="block">{line.comment}</span>}</>;
}

/** Blank lines of a KPI role in a catalog version; the evaluator fills Actual (the score) and Comment. */
const blankLines = (at: KpiCatalog | null, roleOrder: number): KpiAssessmentLine[] => at ? indicatorsFor(at, roleOrder).map((row) => ({
  indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent, target: targetOf(row), actual: "", raw_score: null, comment: "",
})) : [];

/**
 * Form changes when the period changes. A period under another catalog version reloads the employee's KPI set, since
 * its lines and scale may differ (1–5 or 1–100). A message from an earlier Save is cleared, as it may name the old
 * scale (D4-UI-04), the same as when another employee is chosen.
 */
export function periodChange(catalogSet: KpiCatalogSet | null, from: string, to: string, employee?: { positionId?: string | null }) {
  const versionOf = (value: string) => catalogSet && value ? catalogFor(catalogSet, value) : null;
  const next = versionOf(to);
  if (!employee || next?.version === versionOf(from)?.version) return { error: "" };
  const roleOrder = next ? roleForPosition(next, employee.positionId) : 0;
  return { error: "", roleOrder, lines: blankLines(next, roleOrder) };
}

/** Performance Review (FR-D4-001 v3.1): five Core KPI, notes and evidence in one form with one Save. */
export function KpiFormModal({ employeeId, onClose, onSaved }: { employeeId?: string; onClose: () => void; onSaved?: (id: string) => void }) {
  const snapshot = useSnapshot();
  const { catalog: catalogSet, run, busy } = useD4();
  const actor = employeeById(snapshot, snapshot.actorEmployeeId);
  const [period, setPeriod] = useState(thisMonth());
  // The KPI set follows the catalog version in force for the chosen period.
  const catalog = catalogSet && period ? catalogFor(catalogSet, period) : null;
  const max = scaleMaxOf(catalog?.version);
  const suggest = (id: string) => catalog ? roleForPosition(catalog, employeeById(snapshot, id)?.positionId) : 0;
  const linesFor = (roleOrder: number) => blankLines(catalog, roleOrder);

  const [employee, setEmployee] = useState(employeeId ?? "");
  const [roleOrder, setRoleOrder] = useState(() => employeeId ? suggest(employeeId) : 0);
  const [lines, setLines] = useState<KpiAssessmentLine[]>(() => linesFor(employeeId ? suggest(employeeId) : 0));
  const [date, setDate] = useState(today());
  // The evaluator is the signed-in user; the server stores that name and ignores the form value.
  const evaluator = actor?.fullName ?? "";
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [revise, setRevise] = useState(false);
  const existing = employee && period ? latestForPeriod(snapshot.kpiAssessments ?? [], employee, period) : undefined;

  const totalWeight = lines.reduce((sum, line) => sum + line.weight_percent, 0);
  const total = scorecardTotal(lines, max);
  const allScored = total !== null;
  const band = performanceBand(total, catalog?.version);
  const selected = employeeById(snapshot, employee);
  const position = positionOf(snapshot, selected);
  const roleName = roleOrder && catalog ? indicatorsFor(catalog, roleOrder)[0]?.role_name : undefined;

  function chooseEmployee(id: string) { setEmployee(id); setError(""); const role = suggest(id); setRoleOrder(role); setLines(linesFor(role)); }
  function choosePeriod(value: string) {
    const change = periodChange(catalogSet, period, value, selected);
    setPeriod(value); setError(change.error);
    if (change.lines) { setRoleOrder(change.roleOrder); setLines(change.lines); }
  }
  function setLine(index: number, patch: Partial<KpiAssessmentLine>) { setLines((items) => items.map((line, at) => at === index ? { ...line, ...patch } : line)); }

  // FR-02.1/FR-02.11: the KPI set follows the employee's position; HR cannot pick another position's KPI.
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!employee) { setError("Lengkapi employee sebelum menyimpan."); return; }
    if (!roleOrder || lines.length !== 5 || totalWeight !== 100) { setError("KPI untuk posisi ini belum tersedia di katalog; penilaian tidak dapat disimpan."); return; }
    if (lines.some((line) => !line.kpi_name.trim())) { setError("Setiap Core KPI wajib diberi nama."); return; }
    if (!allScored || !period || !date) { setError(`Lengkapi periode, tanggal evaluasi, dan Actual 1–${max} untuk kelima KPI.`); return; }
    if (!notes.trim()) { setError("Notes wajib diisi."); return; }
    if (!evidence.trim()) { setError("Reference wajib diisi."); return; }
    if (date > today()) { setError("Tanggal evaluasi tidak boleh lebih dari hari ini."); return; }
    if (periodDateError(period, date)) { setError(periodDateError(period, date)); return; }
    if (existing && !revise) { setError("Performance Review untuk periode ini sudah ada. Centang “Save as revision” atau pilih periode lain."); return; }
    setError("");
    const result = await run((source) => source.createKpiAssessment({ employeeId: employee, roleOrder, period, evaluationDate: date, evaluatorName: evaluator, status: "completed", lines, generalNotes: notes, evidenceReference: evidence.trim() || null, revisionOf: existing?.id ?? null }),
      "Performance Review tersimpan.");
    if (result.ok) { onSaved?.(result.value); onClose(); } else setError(result.error);
  }

  return <FormModal size="lg" title="Performance Review" description={`Lima Core KPI dari katalog ${catalog?.version ?? ""} sesuai posisi pegawai (nama bisa diubah, bobot dan target tetap), lalu Notes dan Reference. Satu kali Simpan.`} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Simpan" disabled={Boolean(employee) && !lines.length} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SearchSelectField label="Employee" testId="employee" required value={employee} onChange={(value) => chooseEmployee(value)} error={touched && !employee ? "Employee wajib diisi." : undefined} className="sm:col-span-2" placeholder="Select employee"
          options={assessableEmployees(snapshot).map((item) => ({ value: item.id, label: `${item.fullName} · ${item.employeeId}` }))} />
        <TextField label="Period" testId="period" required type="month" value={period} onChange={(event) => choosePeriod(event.target.value)} error={touched && !period ? "Period wajib diisi." : undefined} />
        <ReadOnlyField label="Position" testId="position" value={position?.title ?? "—"} />
        <ReadOnlyField label="Department" testId="department" value={departmentOf(snapshot, selected)?.name ?? "—"} />
        <ReadOnlyField label="Position KPI" testId="kpi-jabatan" value={!employee ? "—" : roleName ?? (catalog ? `Not in catalog ${catalog.version} yet` : "No KPI catalog for this period")} />
        <TextField label="Evaluation date" testId="evaluation-date" required type="date" min={period ? `${period}-01` : undefined} max={today()} value={date} onChange={(event) => setDate(event.target.value)} error={touched && !date ? "Date wajib diisi." : touched && date > today() ? "Tidak boleh lebih dari hari ini." : touched && periodDateError(period, date) || undefined} />
        <ReadOnlyField label="Evaluator" testId="evaluator" value={evaluator || "—"} className="sm:col-span-2" />
      </div>
      {existing && <RevisionConfirm what="Performance Review" existing={`${existing.evaluatorName}, ${formatDate(existing.evaluationDate)}`} checked={revise} onChange={setRevise}
        error={touched && !revise ? "Centang untuk menyimpan sebagai revisi, atau pilih periode lain." : undefined} />}

      {employee && !lines.length ? <Notice tone="warning">{position ? noKpiText(catalog?.version) : "Pegawai belum memiliki posisi aktif, jadi KPI-nya belum bisa ditentukan."}</Notice> : <div className="overflow-x-auto rounded-2xl border border-line">
        <table data-testid="kpi-lines-table" className="w-full text-left text-sm max-md:block md:min-w-[820px]">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3 max-md:hidden">
            <tr><th className="w-10 px-3 py-2.5">No</th><th className="min-w-[220px] px-3 py-2.5">Core KPI</th><th className="w-20 px-3 py-2.5">Weight</th><th className="w-24 px-3 py-2.5">Target</th><th className="w-28 px-3 py-2.5 whitespace-nowrap">{`Actual 1–${max}`}</th><th className="w-24 px-3 py-2.5 text-right">Weighted</th><th className="w-44 px-3 py-2.5">Comment</th></tr>
          </thead>
          <tbody className="max-md:block">
            {lines.map((line, index) => <tr key={`${roleOrder}-${line.indicator_order}`} data-testid={`kpi-line-${line.indicator_order}`} className="border-t border-line align-middle max-md:grid max-md:grid-cols-2 max-md:gap-3 max-md:p-4">
              <td data-label="No" className="px-3 py-2.5 text-ink-3 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]">{line.indicator_order}</td>
              <td data-label="Core KPI" className="px-3 py-2 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)] max-md:col-span-2"><input data-testid={`input-core-kpi-${line.indicator_order}`} aria-label={`Core KPI ${line.indicator_order}`} aria-invalid={touched && !line.kpi_name.trim()} maxLength={200} value={line.kpi_name} onChange={(event) => setLine(index, { kpi_name: event.target.value })} className="h-9 w-full rounded-lg border border-line-strong px-2 text-sm font-semibold aria-[invalid=true]:border-danger" /></td>
              <td data-label="Weight" className="px-3 py-2.5 tabular-nums max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]">{line.weight_percent}%</td>
              <td data-label="Target" className="px-3 py-2 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]"><span data-testid={`readonly-target-${line.indicator_order}`} title="Target ditetapkan HR dan tidak diubah saat penilaian." className="flex h-9 min-w-[56px] items-center rounded-lg bg-muted px-3 text-sm text-ink">{line.target}</span></td>
              <td data-label={`Actual 1–${max}`} className="px-3 py-2 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]"><input type="number" inputMode="numeric" min={1} max={max} step={1} data-testid={`input-realisasi-${line.indicator_order}`} aria-label={`Actual ${line.kpi_name}`} aria-invalid={touched && !validScore(line.raw_score, max)} value={line.raw_score ?? ""} onChange={(event) => setLine(index, actualInput(event.target.value))} className="h-9 w-full rounded-lg border border-line-strong px-2 text-sm tabular-nums aria-[invalid=true]:border-danger" /></td>
              <td data-label="Weighted" className="px-3 py-2.5 text-right font-semibold tabular-nums max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)] max-md:text-left">{weighted(line, max)?.toFixed(2) ?? "—"}</td>
              <td data-label="Comment" className="px-3 py-2 max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)] max-md:col-span-2"><input data-testid={`input-komentar-${line.indicator_order}`} aria-label={`Comment ${line.kpi_name}`} maxLength={500} placeholder="Catatan realisasi" value={line.comment} onChange={(event) => setLine(index, { comment: event.target.value })} className="h-9 w-full rounded-lg border border-line-strong px-2 text-sm" /></td>
            </tr>)}
          </tbody>
          <tfoot className="border-t border-line bg-app max-md:block">
            <tr className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3"><td colSpan={2} className="px-3 py-3 font-semibold">Total</td>
              <td className="px-3 py-3"><span className={cx("inline-flex items-center gap-1 text-xs font-semibold", totalWeight === 100 ? "text-success" : "text-danger")}>{totalWeight === 100 ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}{lines.length ? `${totalWeight}%` : "—"}</span></td>
              <td colSpan={2} className="px-3 py-3 text-xs text-ink-3">{lines.length ? (totalWeight === 100 ? "Total bobot 100%" : "Total bobot harus 100%") : "Pilih pegawai untuk menampilkan KPI posisinya."}</td>
              <td className="px-3 py-3 text-right font-display font-semibold text-base tabular-nums">{total === null ? "—" : `${total.toFixed(2)} / ${max}`}{band && <span data-testid="performance-band" className="mt-1 block text-right"><StatusBadge status={band} /></span>}</td><td /></tr>
          </tfoot>
        </table>
      </div>}
      <p className="text-xs text-ink-3">{max === 5
        ? `Actual diisi skor 1–5: ${[1, 2, 3, 4, 5].map((value) => `${value} ${SCORE_LABELS[value]}`).join(" · ")}. Skor terbobot = bobot × Actual; total = jumlah skor terbobot. Catatan realisasi ditulis di Comment. Tidak ada label tercapai/tidak tercapai.`
        : `Actual diisi skor 1–100 dengan target ${KPI_TARGET}. Di bawah ${UNDER_BELOW} = Under Performance, ${UNDER_BELOW}–${HIGH_ABOVE} = Average Performance, di atas ${HIGH_ABOVE} = High Performance. Skor terbobot = bobot × Actual; total = jumlah skor terbobot. Catatan realisasi ditulis di Comment.`}</p>
      <TextAreaField label="Notes" testId="catatan-evaluasi" required value={notes} onChange={(event) => setNotes(event.target.value)} error={touched && !notes.trim() ? "Notes wajib diisi." : undefined}
        helper="Kekuatan, hal yang perlu diperbaiki, dan rekomendasi pelatihan — bisa menjadi dasar Development Requirement." />
      <TextField label="Reference" testId="evidence-reference" required maxLength={500} value={evidence} onChange={(event) => setEvidence(event.target.value)} error={touched && !evidence.trim() ? "Reference wajib diisi." : undefined} helper="Nomor dokumen, tautan laporan, atau lokasi dokumen pencapaian KPI." />
    </form>
  </FormModal>;
}

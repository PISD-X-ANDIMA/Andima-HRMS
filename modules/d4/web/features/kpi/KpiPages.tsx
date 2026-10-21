"use client";

import { HIGH_ABOVE, performanceBand, scaleMaxOf, UNDER_BELOW } from "../../../kpi/scale";
import { History, Plus } from "lucide-react";
import { useState } from "react";
import { catalogFor } from "../../../kpi/catalog";
import type { KpiAssessment } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { canAssess, developmentNeeds, employeeById, employeeMeta, evaluationsOf, formatDate, formatPeriod, formatScorecard, thisMonth } from "../../data/selectors";
import { DetailHeader, NotFound } from "../../ui/layout";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, StatusBadge } from "../../ui/primitives";
import { KpiFormModal, LineComment, weighted } from "./KpiFormModal";

export const scorecardStatus = (item?: KpiAssessment) => !item ? "Not Evaluated" : item.status === "completed" ? "Completed" : "Draft";

export function CatalogNotice() {
  const { catalog } = useD4();
  if (!catalog || catalogFor(catalog, thisMonth())) return null;
  return <Notice tone="warning">Belum ada katalog KPI yang berlaku untuk bulan ini. HR perlu menetapkan versi katalog dan periode mulai berlakunya.</Notice>;
}

export function KpiDetailPage({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const [adding, setAdding] = useState(false);
  const scorecard = (snapshot.kpiAssessments ?? []).find((item) => item.id === id);
  const employee = scorecard && employeeById(snapshot, scorecard.employeeId);
  if (!scorecard || !employee) return <NotFound what="Performance Review" backHref="/performance" backLabel="Back to Performance Review" />;
  const evaluation = evaluationsOf(snapshot, employee.id).find((item) => item.period === scorecard.period);
  const needs = developmentNeeds(snapshot).filter((item) => item.sourceType === "performance_context" && item.sourceRef === scorecard.id);
  const totalWeight = scorecard.lines.reduce((sum, line) => sum + line.weight_percent, 0);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Review", href: "/performance" }, { label: "Detail" }]} backHref={`/performance/history/${employee.id}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee), `Period ${formatPeriod(scorecard.period)}`]} status={scorecardStatus(scorecard)}
      actions={<><ButtonLink href={`/performance/history/${employee.id}`} icon={<History className="size-4" />} testId="view-history">View History</ButtonLink>
        {canAssess(snapshot, employee.id) && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-penilaian">Add Performance Review</Button>}</>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <Card title="Core KPI" padded={false}>
        <div className="overflow-x-auto">
          <table data-testid="kpi-detail-table" className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="px-5 py-2.5">No</th><th className="px-5 py-2.5">Core KPI</th><th className="px-5 py-2.5">Weight</th><th className="px-5 py-2.5">Target</th><th className="px-5 py-2.5">Actual</th><th className="px-5 py-2.5 text-right">Weighted</th><th className="px-5 py-2.5">Comment</th></tr></thead>
            <tbody>{scorecard.lines.map((line) => <tr key={line.indicator_order} data-testid={`kpi-line-${line.indicator_order}`} className="border-t border-line"><td className="px-5 py-3 text-ink-3">{line.indicator_order}</td><td className="px-5 py-3 font-semibold">{line.kpi_name}</td><td className="px-5 py-3 tabular-nums">{line.weight_percent}%</td><td className="px-5 py-3">{line.target || "—"}</td><td className="px-5 py-3 tabular-nums">{line.raw_score ?? "—"}</td><td className="px-5 py-3 text-right font-semibold tabular-nums">{weighted(line, scaleMaxOf(scorecard.definitionVersion))?.toFixed(2) ?? "—"}</td><td data-testid={`kpi-comment-${line.indicator_order}`} className="px-5 py-3 text-ink-2"><LineComment line={line} /></td></tr>)}</tbody>
            <tfoot className="border-t border-line bg-app"><tr><td colSpan={2} className="px-5 py-3 font-semibold">Total</td><td className="px-5 py-3 font-semibold tabular-nums">{totalWeight}%</td><td colSpan={2} /><td className="px-5 py-3 text-right font-display font-semibold text-base tabular-nums">{formatScorecard(scorecard)}</td><td /></tr></tfoot>
          </table>
        </div>
      </Card>
      <div className="space-y-6">
        <Card title="Ringkasan" testId="scorecard-summary">
          <InfoGrid items={[
            { label: "KPI role", testId: "kpi-role", value: scorecard.roleName },
            { label: "Catalog", testId: "catalog", value: `KPI Scorecard ${scorecard.definitionVersion}` },
            { label: "Evaluation date", testId: "evaluation-date", value: formatDate(scorecard.evaluationDate) },
            { label: "Evaluator", testId: "evaluator", value: scorecard.evaluatorName || "—" },
            { label: "Total KPI", testId: "total-score", value: <><strong className="font-display font-semibold text-lg">{formatScorecard(scorecard)}</strong>{performanceBand(scorecard.overallScore, scorecard.definitionVersion) && <span data-testid="performance-band" className="mt-1 block"><StatusBadge status={performanceBand(scorecard.overallScore, scorecard.definitionVersion)!} /></span>}</> },
            { label: "Recorded", testId: "recorded", value: `${scorecard.actor} · ${formatDate(scorecard.createdAt)}` },
          ]} />
          <p className="mt-5 text-xs text-ink-3">Total = Σ (bobot × skor). {scaleMaxOf(scorecard.definitionVersion) === 100 ? `Di bawah ${UNDER_BELOW} Under Performance, ${UNDER_BELOW}–${HIGH_ABOVE} Average Performance, di atas ${HIGH_ABOVE} High Performance.` : "Skala 1–5 (V3.1/V5.1) tidak punya kategori performa; kategori berlaku untuk scorecard 1–100 mulai V6."}</p>
        </Card>
        <Card title="Notes" testId="notes-related">
          <p className="whitespace-pre-wrap text-sm text-ink-2">{scorecard.generalNotes || evaluation?.generalNotes || "Belum ada catatan."}</p>
          <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">Reference</h3>
          <p className="text-sm text-ink-2">{scorecard.evidenceReference || evaluation?.evidenceReference || "—"}</p>
          {(needs.length > 0 || (!scorecard.generalNotes && evaluation)) && <div className="mt-4 flex flex-col items-start gap-2">
            {!scorecard.generalNotes && evaluation && <SourceChip label="Evaluasi lama" reference={formatPeriod(evaluation.period)} href={`/performance/${evaluation.id}`} />}
            {needs.map((need) => <SourceChip key={need.needId} label="Development Requirement" reference={need.objective} href={`/development/${need.needId}`} />)}
          </div>}
        </Card>
      </div>
    </div>
    {adding && <KpiFormModal employeeId={employee.id} onClose={() => setAdding(false)} />}
  </>;
}

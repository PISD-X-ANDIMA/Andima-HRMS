"use client";

import { HIGH_ABOVE, performanceBand, scaleMaxOf, scoreText, UNDER_BELOW } from "../../../kpi/scale";
import Link from "next/link";
import { History, Plus } from "lucide-react";
import { useState } from "react";
import { catalogFor } from "../../../kpi/catalog";
import { revisionNumber } from "../../../shared/rules";
import type { KpiAssessment } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { canAssess, developmentNeeds, employeeById, employeeMeta, evaluationsOf, formatDate, formatDateTime, formatGap, formatPeriod, formatScorecard, thisMonth } from "../../data/selectors";
import { useLanguage } from "../../i18n/LanguageProvider";
import { DetailHeader, NotFound } from "../../ui/layout";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, StatusBadge } from "../../ui/primitives";
import { KpiFormModal, LineComment, targetLabel, weighted } from "./KpiFormModal";

export const scorecardStatus = (item?: KpiAssessment) => !item ? "Not Evaluated" : item.status === "completed" ? "Completed" : "Draft";

export function CatalogNotice() {
  const { catalog } = useD4();
  const { t } = useLanguage();
  if (!catalog || catalogFor(catalog, thisMonth())) return null;
  return <Notice tone="warning">{t("Belum ada katalog KPI yang berlaku untuk bulan ini. HR perlu menetapkan versi katalog dan periode mulai berlakunya.")}</Notice>;
}

/**
 * R2: a saved scorecard can land on another page of the list (rows are ordered by progress) and the toast cannot hold a
 * link, so the page that opened the form says what was saved and links to it.
 */
export function SavedScorecardNotice({ scorecard }: { scorecard?: KpiAssessment }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  if (!scorecard) return null;
  return <div data-testid="saved-scorecard"><Notice>{t("Performance Review {name} · {period} tersimpan ({score}).", { name: employeeById(snapshot, scorecard.employeeId)?.fullName ?? "", period: formatPeriod(scorecard.period, language), score: formatScorecard(scorecard) })} <Link href={`/performance/scorecard/${scorecard.id}`} className="font-semibold underline">{t("View Detail")}</Link></Notice></div>;
}

export function KpiDetailPage({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [savedId, setSavedId] = useState("");
  const scorecard = (snapshot.kpiAssessments ?? []).find((item) => item.id === id);
  const employee = scorecard && employeeById(snapshot, scorecard.employeeId);
  if (!scorecard || !employee) return <NotFound what="Performance Review" backHref="/performance" backLabel={t("Back to Performance Review")} />;
  const evaluation = evaluationsOf(snapshot, employee.id).find((item) => item.period === scorecard.period);
  const needs = developmentNeeds(snapshot).filter((item) => item.sourceType === "performance_context" && item.sourceRef === scorecard.id);
  const totalWeight = scorecard.lines.reduce((sum, line) => sum + line.weight_percent, 0);
  // Lecturer (24 Nov 2026): which version this is and when it was saved; a period allows one revision, so 2 is the last.
  const revision = revisionNumber(snapshot.kpiAssessments ?? [], scorecard);
  // The Gap column is only for 1–100 scorecards; a 1–5 one says n/a once, in the summary.
  const gapColumn = scaleMaxOf(scorecard.definitionVersion) === 100;
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Review", href: "/performance" }, { label: t("Detail") }]} backHref={`/performance/history/${employee.id}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee, t), t("Period {period}", { period: formatPeriod(scorecard.period, language) })]} status={scorecardStatus(scorecard)}
      actions={<><ButtonLink href={`/performance/history/${employee.id}`} icon={<History className="size-4" />} testId="view-history">{t("View History")}</ButtonLink>
        {canAssess(snapshot, employee.id) && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-penilaian">{t("Add Performance Review")}</Button>}</>} />
    {savedId !== scorecard.id && <SavedScorecardNotice scorecard={(snapshot.kpiAssessments ?? []).find((item) => item.id === savedId)} />}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <Card title="Core KPI" padded={false}>
        <div className="overflow-x-auto">
          <table data-testid="kpi-detail-table" className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="px-5 py-2.5">No</th><th className="px-5 py-2.5">Core KPI</th><th className="px-5 py-2.5">{t("Weight")}</th><th className="px-5 py-2.5">{t("Target")}</th><th className="px-5 py-2.5">{t("Actual")}</th>{gapColumn && <th className="px-5 py-2.5">Gap</th>}<th className="px-5 py-2.5 text-right">{t("Weighted")}</th><th className="px-5 py-2.5">{t("Comment")}</th></tr></thead>
            <tbody>{scorecard.lines.map((line) => <tr key={line.indicator_order} data-testid={`kpi-line-${line.indicator_order}`} className="border-t border-line"><td className="px-5 py-3 text-ink-3">{line.indicator_order}</td><td className="px-5 py-3 font-semibold">{line.kpi_name}</td><td className="px-5 py-3 tabular-nums">{line.weight_percent}%</td><td className="px-5 py-3">{targetLabel(line.target, scorecard.definitionVersion)}</td><td className="px-5 py-3 tabular-nums">{line.raw_score ?? "—"}</td>{gapColumn && <td data-testid={`kpi-gap-${line.indicator_order}`} className="px-5 py-3 tabular-nums text-ink-2">{formatGap(line.raw_score, scorecard.definitionVersion, t)}</td>}<td className="px-5 py-3 text-right font-semibold tabular-nums">{scoreText(weighted(line, scaleMaxOf(scorecard.definitionVersion)))}</td><td data-testid={`kpi-comment-${line.indicator_order}`} className="px-5 py-3 text-ink-2"><LineComment line={line} /></td></tr>)}</tbody>
            <tfoot className="border-t border-line bg-app"><tr><td colSpan={2} className="px-5 py-3 font-semibold">{t("Total")}</td><td className="px-5 py-3 font-semibold tabular-nums">{totalWeight}%</td><td colSpan={gapColumn ? 3 : 2} /><td className="px-5 py-3 text-right font-display font-semibold text-base tabular-nums">{formatScorecard(scorecard)}</td><td /></tr></tfoot>
          </table>
        </div>
      </Card>
      <div className="space-y-6">
        <Card title={t("Ringkasan")} testId="scorecard-summary">
          <InfoGrid items={[
            { label: t("KPI role"), testId: "kpi-role", value: scorecard.roleName },
            { label: t("Catalog"), testId: "catalog", value: `KPI Scorecard ${scorecard.definitionVersion}` },
            { label: t("Evaluation date"), testId: "evaluation-date", value: formatDate(scorecard.evaluationDate, language) },
            { label: t("Evaluator"), testId: "evaluator", value: scorecard.evaluatorName || "—" },
            { label: "Total KPI", testId: "total-score", value: <><strong className="font-display font-semibold text-lg">{formatScorecard(scorecard)}</strong>{performanceBand(scorecard.overallScore, scorecard.definitionVersion) && <span data-testid="performance-band" className="mt-1 block"><StatusBadge status={performanceBand(scorecard.overallScore, scorecard.definitionVersion)!} /></span>}</> },
            { label: t("KPI gap (vs 85)"), testId: "kpi-gap", value: formatGap(scorecard.overallScore, scorecard.definitionVersion, t) },
            { label: t("Version"), testId: "revision", value: revision > 1 ? t("Revision {n}", { n: revision }) : t("First review") },
            { label: t("Recorded"), testId: "recorded", value: `${scorecard.actor} · ${formatDateTime(scorecard.createdAt, language)}` },
          ]} />
          <p className="mt-5 text-xs text-ink-3">{t("Total = Σ (bobot × skor).")} {scaleMaxOf(scorecard.definitionVersion) === 100 ? t("Di bawah {under} Under Performance, {under}–{high} Average Performance, di atas {high} High Performance.", { under: UNDER_BELOW, high: HIGH_ABOVE }) : t("Skala 1–5 (V3.1/V5.1) tidak punya kategori performa; kategori berlaku untuk scorecard 1–100 mulai V6.")}</p>
        </Card>
        <Card title={t("Notes")} testId="notes-related">
          {/* K8: a long reference or link without spaces wraps instead of widening the page. */}
          <p className="whitespace-pre-wrap text-sm text-ink-2 [overflow-wrap:anywhere]">{scorecard.generalNotes || evaluation?.generalNotes || t("Belum ada catatan.")}</p>
          <h3 className="mb-1 mt-5 font-display text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">{t("Reference")}</h3>
          <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{scorecard.evidenceReference || evaluation?.evidenceReference || "—"}</p>
          {(needs.length > 0 || (!scorecard.generalNotes && evaluation)) && <div className="mt-4 flex flex-col items-start gap-2">
            {!scorecard.generalNotes && evaluation && <SourceChip label={t("Legacy Evaluation")} reference={formatPeriod(evaluation.period, language)} href={`/performance/${evaluation.id}`} />}
            {needs.map((need) => <SourceChip key={need.needId} label="Development Requirement" reference={need.objective} href={`/development/${need.needId}`} />)}
          </div>}
        </Card>
      </div>
    </div>
    {adding && <KpiFormModal employeeId={employee.id} onClose={() => setAdding(false)} onSaved={setSavedId} />}
  </>;
}

"use client";

import { CalendarClock, CheckCircle2, Eye, History, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { catalogFor, roleForPosition } from "../../../kpi/catalog";
import type { DailyCompilation } from "../../../kpi/daily";
import { scaleMaxOf } from "../../../kpi/scale";
import type { PerformanceEvaluation } from "../../../performance/types";
import type { EmployeeReference } from "../../../shared/types";
import type { KpiAssessment } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { canAssess, canWrite, departmentOf, describeSource, developmentNeeds, employeeById, employeeMeta, employeeSearchText, evaluationsOf, formatDate, formatGap, formatPeriod, byProgress, formatScorecard, includesText, latestScorecard, listScore, pendingCompilation, positionOf, revisionTag, scorecardsOf, thisMonth, visibleEmployees } from "../../data/selectors";
import { useLanguage } from "../../i18n/LanguageProvider";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, PeriodFilter, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, StatusBadge } from "../../ui/primitives";
import { FinalizeDailyModal } from "../kpi/FinalizeDailyModal";
import { ReopenPeriodModal } from "./ReopenPeriodModal";
import { noKpiText, KpiFormModal } from "../kpi/KpiFormModal";
import { CatalogNotice, SavedScorecardNotice, scorecardStatus } from "../kpi/KpiPages";
import { useUrlFilters } from "../dashboard/url-filters";

const evaluationStatus = (evaluation?: PerformanceEvaluation) => !evaluation ? "Not Evaluated" : evaluation.status === "completed" ? "Completed" : "Draft";

// Same words as the Status badge in the table, so a filter choice matches what the rows show.
const STATUS_FILTER = ["Completed", "Compiled", "Not Evaluated"]; // FR-D4-002 has no draft scorecard.

type Row = { employee: EmployeeReference; position: string; hasKpi: boolean; scorecard?: KpiAssessment; evaluation?: PerformanceEvaluation; compiled: DailyCompilation | null; period?: string };

/**
 * "Compiled": Daily KPI gave the period a score that HR has not finalized yet (B6). An evaluation saved before KPI and
 * Notes were merged still counts as that period's review (K20), only without a KPI score.
 */
const rowStatus = (row: Row) => row.compiled ? "Compiled" : row.scorecard ? scorecardStatus(row.scorecard) : evaluationStatus(row.evaluation);
// Ready to finalize, then still to assess, then done; a position without KPI cannot be assessed, so it goes last.
const performanceRank = (row: Row) => row.compiled ? 0 : row.scorecard || row.evaluation ? 2 : row.hasKpi ? 1 : 3;

/**
 * Performance Review (FR-D4-001 v3.1): one row per employee with the Total KPI, evaluation notes and evaluator of one
 * assessment. Rows do not open on click; detail and history come from the Actions menu.
 */
export function PerformanceListPage() {
  const snapshot = useSnapshot();
  const { catalog: catalogSet } = useD4();
  const { t, language } = useLanguage();
  const writer = canWrite(snapshot);
  // In the URL, so Back from a detail page keeps them and dashboard alerts can link with ?q=<name>&period= (N4, K15, W1).
  const { values: { q: search, position, department, period, status: progress }, set, reset } = useUrlFilters(["q", "position", "department", "period", "status"]);
  const [adding, setAdding] = useState<{ employeeId?: string } | null>(null);
  const [finalizing, setFinalizing] = useState<Row | null>(null);
  const [reopening, setReopening] = useState(false);
  // R2: what was just saved; a finalized period is looked up in the current snapshot, since the modal returns no id.
  const [saved, setSaved] = useState<{ id: string } | { employeeId: string; period: string } | null>(null);
  const savedScorecard = saved ? ("id" in saved ? (snapshot.kpiAssessments ?? []).find((item) => item.id === saved.id) : scorecardsOf(snapshot, saved.employeeId).find((item) => item.period === saved.period)) : undefined;

  // Old evaluations count too, so a period that only has them can still be chosen (K20).
  const periods = useMemo(() => [...new Set([...(snapshot.kpiAssessments ?? []), ...(snapshot.kpiDaily ?? []), ...snapshot.performance].map((item) => item.period))].sort().reverse(), [snapshot]);
  // KPI role per the catalog in force for the filtered period, or this month when no period is chosen.
  const catalog = useMemo(() => catalogSet && catalogFor(catalogSet, period || thisMonth()), [catalogSet, period]);
  const all = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    const title = positionOf(snapshot, employee)?.title;
    const scorecard = period ? scorecardsOf(snapshot, employee.id).find((item) => item.period === period) : latestScorecard(snapshot, employee.id);
    // Without a period filter the running period's compilation wins over an older scorecard: it is the newer state.
    const at = period || thisMonth();
    const pending = pendingCompilation(snapshot, employee.id, at);
    const compiled = pending && (!scorecard || scorecard.period < at) ? pending : null;
    const evaluations = evaluationsOf(snapshot, employee.id).filter((item) => item.status === "completed");
    // Older records kept the notes in a separate evaluation; show them until the period is assessed again. Without a
    // scorecard, the period's old evaluation (or, without a period filter, the latest one) is the review (K20).
    const evaluation = compiled ? undefined : scorecard ? evaluations.find((item) => item.period === scorecard.period) : period ? evaluations.find((item) => item.period === period) : evaluations[0];
    return {
      employee, position: title ?? "—", hasKpi: !catalogSet || !title || Boolean(catalog && roleForPosition(catalog, employee.positionId)),
      scorecard: compiled ? undefined : scorecard, compiled, evaluation, period: compiled ? at : scorecard?.period ?? evaluation?.period,
    };
  }), [snapshot, catalog, catalogSet, period]);
  const rows = useMemo(() => all.filter((row) => includesText(employeeSearchText(snapshot, row.employee), search)
    && (!position || row.employee.positionId === position) && (!department || row.employee.departmentId === department)
    && (!progress || rowStatus(row) === progress))
    .sort(byProgress(performanceRank, (row) => row.employee.fullName)), [all, snapshot, search, position, department, progress]);
  const listScale = scaleMaxOf(catalog?.version);

  return <>
    <PageHeader title="Performance Review" subtitle={t("Core KPI dan Notes per pegawai dan periode, dalam satu penilaian.")}
      actions={writer && <>
        {snapshot.role === "HR" && <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={() => setReopening(true)} data-testid="btn-reopen-period">{t("Reopen Period")}</Button>}
        <Button icon={<Plus className="size-4" />} onClick={() => setAdding({})} data-testid="btn-add-penilaian">{t("Add Performance Review")}</Button>
      </>} />
    <CatalogNotice />
    <FilterBar canReset={Boolean(search || position || department || period || progress)} onReset={reset}
      search={<SearchInput value={search} onChange={set("q")} placeholder={t("Search name or position")} />}
      period={<PeriodFilter label={t("Periods")} testId="latest-period" value={period} onChange={set("period")} options={periods.map((item) => ({ value: item, label: formatPeriod(item, language) }))} />}>
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Departments")} testId="all-departments" value={department} onChange={set("department")} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label={t("Status")} testId="all-status" value={progress} onChange={set("status")} options={STATUS_FILTER.map((item) => ({ value: item, label: t(item) }))} />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Positions")} testId="all-positions" value={position} onChange={set("position")} options={snapshot.reference.positions.map((item) => ({ value: item.id, label: item.title }))} />}
    </FilterBar>
    <SavedScorecardNotice scorecard={savedScorecard} />
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id} justSaved={all.find((row) => row.employee.id === savedScorecard?.employeeId)}
      emptyTitle={t("Tidak ada pegawai yang cocok")} emptyText={t("Ubah kata kunci atau reset filter untuk melihat semua pegawai.")}
      columns={[
        { key: "employee", header: t("Employee"), cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: t("Position / Department"), wrap: true, optional: true, cell: (row) => <><span className="block">{row.position}</span><span className="block text-xs text-ink-3">{departmentOf(snapshot, row.employee)?.name ?? "—"}</span></> },
        // With a period filter every row shows that period, so the column only appears without one (24 Nov 2026).
        ...(period ? [] : [{ key: "period", header: t("Period"), cell: (row: Row) => formatPeriod(row.period, language) }]),
        // The scale sits in the header once instead of "/ 100" on every row (PST 2); a row on the other scale keeps its own.
        { key: "total", header: `Total KPI (/${listScale})`, className: "tabular-nums", cell: (row) => row.scorecard ? <span className="font-semibold">{listScore(row.scorecard.overallScore, row.scorecard.definitionVersion, listScale)}</span>
          // The number of daily entries stays in Finalize from Daily KPI: in the list it read the same on every row (24 Nov 2026).
          : row.compiled ? <span className="font-semibold">{listScore(row.compiled.total, row.compiled.definitionVersion, listScale)}</span>
          // The small lines may wrap (the score stays on one line), so they do not widen the table past the Status badge.
          : row.evaluation ? <span data-testid="legacy-evaluation" className="whitespace-normal text-xs text-ink-3">{t("Old evaluation, no KPI score")}</span>
          : row.hasKpi ? "—" : <span className="whitespace-normal text-xs text-ink-3">{t("Not in catalog {version} yet", { version: catalog?.version ?? "" })}</span> },
        { key: "gap", header: "Gap vs 85", className: "tabular-nums", optional: true, cell: (row) => row.scorecard ? formatGap(row.scorecard.overallScore, row.scorecard.definitionVersion, t)
          : row.compiled ? formatGap(row.compiled.total, row.compiled.definitionVersion, t) : "—" },
        // The evaluator sits under the notes, as Department sits under Position: as a column of its own it pushed the
        // Status badge under the ⋮ column at 1400–1500 px.
        { key: "notes", header: t("Notes / Evaluator"), wrap: true, secondary: true, className: "max-w-[280px]", cell: (row) => {
          const notes = row.scorecard?.generalNotes || row.evaluation?.generalNotes;
          const evaluator = row.scorecard ? row.scorecard.evaluatorName : row.evaluation?.evaluator;
          return <>{notes ? <span className="line-clamp-2 [overflow-wrap:anywhere]">{notes}</span> : "—"}
            {evaluator && <span data-testid="cell-evaluator" className="mt-0.5 block text-xs text-ink-3">{evaluator}</span>}</>;
        } },
        { key: "status", header: t("Status"), cell: (row) => <StatusBadge status={rowStatus(row)} /> },
      ]}
      actions={(row) => <RowActionMenu label={t("Actions for {name}", { name: row.employee.fullName })} actions={[
        { label: t("View Detail"), testId: "view-detail", icon: <Eye />, href: row.scorecard ? `/performance/scorecard/${row.scorecard.id}` : row.evaluation && `/performance/${row.evaluation.id}`, hidden: !row.scorecard && !row.evaluation },
        { label: t("View History"), testId: "view-history", icon: <History />, href: `/performance/history/${row.employee.id}` },
        { label: t("Finalize from Daily KPI"), testId: "finalize-daily", icon: <CheckCircle2 />, onSelect: () => setFinalizing(row), hidden: !row.compiled || !canAssess(snapshot, row.employee.id) },
        { label: t("Add Performance Review"), testId: "add-penilaian", icon: <Plus />, onSelect: () => setAdding({ employeeId: row.employee.id }), hidden: !canAssess(snapshot, row.employee.id) },
      ]} />} />
    {adding && <KpiFormModal employeeId={adding.employeeId} onClose={() => setAdding(null)} onSaved={(id) => setSaved({ id })} />}
    {reopening && <ReopenPeriodModal onClose={() => setReopening(false)} />}
    {finalizing?.compiled && finalizing.period && <FinalizeDailyModal employeeId={finalizing.employee.id} period={finalizing.period} compiled={finalizing.compiled}
      onClose={() => { setSaved({ employeeId: finalizing.employee.id, period: finalizing.period! }); setFinalizing(null); }} />}
  </>;
}

/** An evaluation saved before FR-D4-001 v3.1 merged it into the Performance Review; read-only history. */
export function PerformanceDetailPage({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const evaluation = snapshot.performance.find((item) => item.id === id);
  const employee = evaluation && employeeById(snapshot, evaluation.employeeId);
  if (!evaluation || !employee) return <NotFound what={t("Evaluation")} backHref="/performance" backLabel={t("Back to Performance Review")} />;
  const scorecard = scorecardsOf(snapshot, employee.id).find((item) => item.period === evaluation.period);
  const needs = developmentNeeds(snapshot).filter((item) => item.sourceType === "performance_context" && item.sourceRef === evaluation.id);

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Review", href: "/performance" }, { label: t("Legacy Evaluation") }]} backHref={`/performance/history/${employee.id}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee, t), t("Period {period}", { period: formatPeriod(evaluation.period, language) })]}
      status={evaluationStatus(evaluation)}
      actions={<>
        <ButtonLink href={`/performance/history/${employee.id}`} icon={<History className="size-4" />} testId="view-history">{t("View History")}</ButtonLink>
        {scorecard && <ButtonLink href={`/performance/scorecard/${scorecard.id}`} icon={<Target className="size-4" />}>Performance Review</ButtonLink>}
      </>} />
    <Notice tone="info">{t("Evaluasi ini dicatat sebelum KPI dan Notes digabung menjadi satu Performance Review. Data lama hanya dapat dibaca.")}</Notice>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title={t("Evaluation summary")} testId="evaluation-summary">
        <InfoGrid columns={3} items={[
          { label: t("Period"), testId: "period", value: formatPeriod(evaluation.period, language) },
          { label: t("Evaluation date"), testId: "evaluation-date", value: formatDate(evaluation.evaluationDate, language) },
          { label: t("Evaluator"), testId: "evaluator", value: evaluation.evaluator || "—" },
          { label: t("Department"), testId: "department", value: departmentOf(snapshot, employee)?.name ?? "—" },
        ]} />
        <h3 className="mb-2 mt-8 font-display text-sm font-semibold text-ink-2">{t("Notes")}</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-2 [overflow-wrap:anywhere]">{evaluation.generalNotes || t("Belum ada notes.")}</p>
      </Card>
      <div className="space-y-6">
        <Card title={t("Reference")} testId="evidence">
          <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{evaluation.evidenceReference || t("Belum ada reference.")}</p>
          <p className="mt-1 text-xs text-ink-3">{t("Recorded by {actor} · {date}", { actor: evaluation.actor, date: formatDate(evaluation.createdAt, language) })}</p>
        </Card>
        {needs.length > 0 && <Card title={t("Related records")} testId="related-records">
          <div className="flex flex-col items-start gap-2">
            {needs.map((need) => <SourceChip key={need.needId} label="Development Requirement" reference={need.objective} href={`/development/${need.needId}`} />)}
          </div>
        </Card>}
      </div>
    </div>
  </>;
}

export function PerformanceHistoryPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const { catalog: catalogSet } = useD4();
  const { t, language } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [savedId, setSavedId] = useState("");
  const employee = employeeById(snapshot, employeeId);
  const catalog = catalogSet && catalogFor(catalogSet, thisMonth());
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what={t("Employee")} backHref="/performance" backLabel={t("Back to Performance Review")} />;
  const scorecards = scorecardsOf(snapshot, employee.id);
  const evaluations = evaluationsOf(snapshot, employee.id);
  const title = positionOf(snapshot, employee)?.title;
  const linkedNeeds = developmentNeeds(snapshot).filter((need) => need.employeeId === employee.id && need.sourceType === "performance_context");
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Review", href: "/performance" }, { label: t("History") }]} backHref="/performance"
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee, t), scorecards.length === 1 ? t("{count} saved review", { count: scorecards.length }) : t("{count} saved reviews", { count: scorecards.length })]}
      actions={canAssess(snapshot, employee.id) && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-penilaian">{t("Add Performance Review")}</Button>} />
    <SavedScorecardNotice scorecard={scorecards.find((item) => item.id === savedId)} />
    {title && catalogSet && !(catalog && roleForPosition(catalog, employee.positionId)) && <Notice tone="warning">{noKpiText(catalog?.version, t)}</Notice>}
    <Card title={t("Performance Review history")} testId="scorecard-history">
      <Timeline empty={t("Pegawai ini belum memiliki Performance Review.")} entries={scorecards.map((item) => ({
        id: item.id, date: `${formatPeriod(item.period, language)} · ${formatDate(item.evaluationDate || item.createdAt, language)}`,
        title: `${item.roleName} · ${formatScorecard(item)}${revisionTag(scorecards, item, t)}`, status: scorecardStatus(item), actor: item.actor, href: `/performance/scorecard/${item.id}`,
        body: `${t("Catalog {version} · Evaluator {name}", { version: item.definitionVersion, name: item.evaluatorName || "—" })}${item.generalNotes ? ` · ${item.generalNotes}` : ""}`,
      }))} />
    </Card>
    {evaluations.length > 0 && <Card title={t("Legacy Evaluation history (before the merge)")} testId="evaluation-history">
      <Timeline empty="" entries={evaluations.map((item) => ({
        id: item.id, date: `${formatPeriod(item.period, language)} · ${formatDate(item.evaluationDate || item.createdAt, language)}`,
        title: `${t("Evaluation {period}", { period: formatPeriod(item.period, language) })}${revisionTag(evaluations, item, t)}`,
        status: evaluationStatus(item), actor: item.actor, href: `/performance/${item.id}`,
        body: <>{t("Evaluator: {name}", { name: item.evaluator || "—" })}{item.generalNotes ? ` · ${item.generalNotes}` : ""}</>,
      }))} />
    </Card>}
    {linkedNeeds.length > 0 && <Card title={t("Development from Performance Review")} testId="development-linked-to-evaluations">
      <div className="flex flex-wrap gap-2">{linkedNeeds.map((need) => <SourceChip key={need.needId} label={describeSource(snapshot, need, t).label} reference={need.objective} href={`/development/${need.needId}`} />)}</div>
    </Card>}
    {adding && <KpiFormModal employeeId={employee.id} onClose={() => setAdding(false)} onSaved={setSavedId} />}
  </>;
}

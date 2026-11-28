"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Eye, Target } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { followUpOf } from "../../../shared/rules";
import type { D4LiveSnapshot, KpiAssessment } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { catalogFor, KPI_TARGET, type KpiCatalog } from "../../../kpi/catalog";
import { byProgress, canAssess, canWrite, currentCompetencyStatus, currentGap, departmentOf, developmentNeeds, employeeById, employeeMeta, employeeSearchText, evaluationsOf, formatDate, formatGap, formatPeriod, formatScore, formatScorecard, includesText, listScore, pendingCompilation, positionOf, scorecardsOf, thisMonth, trainingHistory, trainings, trainingsOf, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, FormModal, PeriodFilter, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, Card, Notice, SavedNotice, slug, statusLabel, StatusBadge } from "../../ui/primitives";
import { LineComment, targetLabel, weighted } from "../kpi/KpiFormModal";
import type { DailyCompilation } from "../../../kpi/daily";
import { HIGH_ABOVE, performanceBand, scaleMaxOf, scoreText, UNDER_BELOW } from "../../../kpi/scale";
import { averageScores, BANDS, COMPETENCY_ORDER, competencySlices, dashboardAlerts, defaultPeriod, employeeHistory, gapRanking, matchesDashboardFilters, openNeedCount, performanceSlices, profilePeriod, reviewCounts, trainingsInProgress, validScorecard, withoutKpiRole, type AssignTarget, type DashboardAlert, type Slice } from "./summary";
import { DASHBOARD_TABLE_ID, SummaryTiles, type SummaryRow } from "./SummaryTiles";
import { DevelopmentFormModal } from "../development/DevelopmentModals";
import { useLanguage } from "../../i18n/LanguageProvider";
import { useUrlFilters } from "./url-filters";

/** `notPassed`: the latest training is Completed but Not Passed, "awaiting" until HR records a follow-up (K2). */
type Row = SummaryRow & { training?: string; notPassed?: "awaiting" | "followed" };

/** One period per employee: the selected period, else the latest started scorecard, else the latest started evaluation (FR-06.1). */
function periodData(snapshot: D4LiveSnapshot, employeeId: string, period: string) {
  const scorecards = scorecardsOf(snapshot, employeeId).filter((item) => item.status === "completed");
  const evaluations = evaluationsOf(snapshot, employeeId).filter((item) => item.status === "completed");
  const selected = period || profilePeriod(scorecards.map((item) => item.period), evaluations.map((item) => item.period));
  return { period: selected, scorecard: scorecards.find((item) => item.period === selected), evaluation: evaluations.find((item) => item.period === selected) };
}

/**
 * Dashboard KPI Orang (FR-D4-004): a read-only per-employee summary of the other five features.
 * It reads the same snapshot as the detail pages (FR-06.8), creates no data of its own and shows no achieved
 * label (FR-06.10). Above the table, over the rows already listed (Interview D4, 14 Oct 2026): headline counts,
 * performance-category and competency donuts, the competencies with the most gaps, and alerts for HR follow-up.
 */
export function DashboardPage() {
  const snapshot = useSnapshot();
  // An employee's list would only ever hold themselves, so their home is their own profile.
  return snapshot.role === "EMPLOYEE" ? <EmployeeProfilePage employeeId={snapshot.actorEmployeeId} own /> : <PeopleDashboard />;
}

function PeopleDashboard() {
  const snapshot = useSnapshot();
  const { catalog: catalogSet } = useD4();
  const { t, language } = useLanguage();
  const { values: { q: search, position, department, period, band, competency, training }, set, reset } = useUrlFilters(["q", "position", "department", "period", "band", "competency", "training"]);
  const periods = useMemo(() => [...new Set([...(snapshot.kpiAssessments ?? []), ...snapshot.performance, ...(snapshot.kpiDaily ?? [])].map((item) => item.period))].sort().reverse(), [snapshot]);
  const shown = period || defaultPeriod(periods);
  const catalog = useMemo(() => catalogSet && shown ? catalogFor(catalogSet, shown) : null, [catalogSet, shown]);
  const listScale = scaleMaxOf(catalog?.version);

  const rows = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    // Every row shows the same period: the chosen one, else the latest period that has started (bug 20).
    const data = periodData(snapshot, employee.id, shown);
    const employeeTrainings = trainingsOf(snapshot, employee.id);
    const latest = employeeTrainings[0];
    return {
      employee, position: positionOf(snapshot, employee)?.title ?? "—", period: data.period, scorecard: data.scorecard,
      // Shown in the table until HR finalizes it; the charts and counts use finalized scorecards only.
      compiled: data.period ? pendingCompilation(snapshot, employee.id, data.period) : null,
      gap: currentCompetencyStatus(snapshot, employee),
      openNeeds: openNeedCount(snapshot, employee.id),
      training: latest?.status,
      notPassed: latest?.status === "Completed" && latest.result === "Not Passed" ? (followUpOf(trainingHistory(snapshot, latest.trainingId)) ? "followed" as const : "awaiting" as const) : undefined,
      trainingInProgress: trainingsInProgress(snapshot, employee.id).length > 0,
    };
  }).filter((row) => includesText(employeeSearchText(snapshot, row.employee), search) && (!position || row.employee.positionId === position) && (!department || row.employee.departmentId === department)
    && matchesDashboardFilters(row, { band, competency, training }))
    // Compiled (waiting for HR) first, then without a Performance Review for the period, then reviewed.
    .sort(byProgress((row) => row.compiled ? 0 : row.scorecard ? 2 : 1, (row) => row.employee.fullName)), [snapshot, search, position, department, shown, band, competency, training]);

  const noKpi = withoutKpiRole(snapshot, rows, catalog);
  const profileHref = (row: Row) => `/dashboard/employee/${row.employee.id}${row.period ? `?period=${row.period}` : ""}`;

  return <>
    <PageHeader title="People Dashboard" subtitle={t("KPI, performance, gap kompetensi, development, dan training per pegawai untuk periode yang sama.")} />
    {/* The dashboard always shows one period, so there is no "All" choice (decision 13 Nov 2026); it starts on the latest one that has started. */}
    <FilterBar canReset={Boolean(search || position || department || period || band || competency || training)} onReset={reset}
      search={<SearchInput value={search} onChange={set("q")} placeholder={t("Search name or position")} />}
      period={<PeriodFilter label={t("Period")} testId="latest-period" emptyOption={false} value={shown} onChange={set("period")} options={periods.map((item) => ({ value: item, label: formatPeriod(item, language) }))} />}>
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Departments")} testId="all-departments" value={department} onChange={set("department")} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      {/* FR-D4-004 B: performance category (1–100 scorecards only); the Katalon id keeps the old "categories" name. */}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Performance")} testId="all-categories" value={band} onChange={set("band")} options={BANDS.map((item) => ({ value: item, label: t(item) }))} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Positions")} testId="all-positions" value={position} onChange={set("position")} options={snapshot.reference.positions.map((item) => ({ value: item.id, label: item.title }))} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Competency status")} testId="all-competency-status" value={competency} onChange={set("competency")} options={COMPETENCY_ORDER.map((item) => ({ value: item, label: t(item) }))} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Training status")} testId="all-training-status" value={training} onChange={set("training")} options={["Planned", "In Progress", "Completed", "Cancelled"].map((item) => ({ value: item, label: t(statusLabel(item)) }))} />}
    </FilterBar>
    <SummaryTiles snapshot={snapshot} rows={rows} period={shown} noKpi={noKpi} />
    {snapshot.role !== "EMPLOYEE" && rows.length > 0 && <>
      <div className="grid gap-6 xl:grid-cols-3">
        <PerformanceCard rows={rows} catalog={catalog} noKpi={noKpi.length} />
        <CompetencyCard rows={rows} />
        <GapRankingCard snapshot={snapshot} rows={rows} />
      </div>
      <AlertsCard snapshot={snapshot} rows={rows} period={shown} />
    </>}
    {/* The Employees tile jumps here; the margin keeps the table header clear of the sticky top bar. */}
    <div id={DASHBOARD_TABLE_ID} tabIndex={-1} className="scroll-mt-20 outline-none">
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id}
      emptyTitle={t("Tidak ada pegawai yang cocok")} emptyText={snapshot.role === "EMPLOYEE" ? t("Ubah kata kunci atau periode, lalu coba lagi.") : t("Ubah kata kunci, filter, atau periode, lalu coba lagi.")}
      columns={[
        { key: "employee", header: t("Employee"), cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        // Position and department share one column so the nine summary columns fit at 1440px.
        { key: "position", header: t("Position / Department"), wrap: true, secondary: true, cell: (row) => <><span className="block">{row.position}</span><span className="block text-xs text-ink-3">{departmentOf(snapshot, row.employee)?.name ?? "—"}</span></> },
        // No Period column: every row shows the period chosen in the filter, which the filter bar already says (24 Nov 2026).
        { key: "kpi", header: `Total KPI (/${listScale})`, className: "tabular-nums", cell: (row) => <ScoreCell scorecard={row.scorecard} compiled={row.compiled} listScale={listScale} /> },
        { key: "gap", header: t("Competency"), cell: (row) => <StatusBadge status={row.gap} /> },
        { key: "needs", header: t("Open dev."), className: "tabular-nums", secondary: true, cell: (row) => row.openNeeds || "—" },
        // Wraps so "Completed, awaiting follow-up" takes two lines; on one line the table scrolled sideways at 1024 and 768 px.
        { key: "training", header: t("Training"), wrap: true, cell: (row) => row.notPassed ? <><span data-testid="training-not-passed" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-bg px-2.5 py-1 text-[11px] font-semibold leading-none text-warning"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />Not Passed</span>
          {/* The stored status stays visible, since the training status filter matches on it. */}
          <span className="mt-1 block text-xs text-ink-3">{row.notPassed === "awaiting" ? t("Completed, awaiting follow-up") : "Completed"}</span></> : row.training ? <StatusBadge status={row.training} /> : "—" },
      ]}
      actions={(row) => <RowActionMenu label={t("Actions for {name}", { name: row.employee.fullName })} actions={[
        { label: t("View Detail"), testId: "view-detail", icon: <Eye />, href: profileHref(row) },
        { label: t("View Performance Review"), testId: "view-penilaian", icon: <Target />, href: row.scorecard ? `/performance/scorecard/${row.scorecard.id}` : `/performance/history/${row.employee.id}` },
      ]} />} />
    </div>
  </>;
}

const BAND_COLORS: Record<string, string> = {
  "under-performance": "var(--color-warning)", "average-performance": "var(--color-info)", "high-performance": "var(--color-success)",
};
const COMPETENCY_COLORS: Record<string, string> = {
  met: "var(--color-success)", "insufficient-data": "var(--color-warning)", gap: "var(--color-danger)", "not-evaluated": "var(--color-neutral)",
};

const RING_R = 40;
const RING = 2 * Math.PI * RING_R;
/** Surface gap between slices in viewBox units (about 2px at the 144px size), so neighbours read apart without a stroke. */
const SLICE_GAP = 1.5;

/**
 * Donut (a pie with the total in the middle) for part-to-whole at a glance. SVG arcs with a surface gap, a native
 * tooltip per slice, and a legend with counts and shares that doubles as the table view.
 */
function Donut({ name, slices, colors, center, centerLabel }: { name: string; slices: readonly Slice[]; colors: Record<string, string>; center: number; centerLabel: string }) {
  const drawn = slices.filter((slice) => slice.count > 0);
  const sum = drawn.reduce((total, slice) => total + slice.count, 0);
  const share = (count: number) => sum ? Math.round((count / sum) * 100) : 0;
  const arcs = drawn.map((slice, index) => ({ slice, start: (drawn.slice(0, index).reduce((total, item) => total + item.count, 0) / sum) * RING, length: (slice.count / sum) * RING }));
  const colorOf = (key: string) => colors[key] ?? "var(--color-neutral)";
  const { t } = useLanguage();
  return <div className="flex flex-wrap items-center gap-6">
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${name}: ${drawn.map((slice) => `${t(slice.label)} ${slice.count}`).join(", ") || t("belum ada data")}`}>
        {!arcs.length && <circle cx="50" cy="50" r={RING_R} fill="none" stroke="var(--color-line)" strokeWidth="12" />}
        {arcs.map(({ slice, start, length }) => {
          const dash = arcs.length > 1 ? Math.max(length - SLICE_GAP, 0.5) : length;
          return <circle key={slice.key} data-testid={`slice-${slice.key}`} cx="50" cy="50" r={RING_R} fill="none" stroke={colorOf(slice.key)} strokeWidth="12" strokeDasharray={`${dash} ${RING - dash}`} strokeDashoffset={-start}>
            <title>{`${t(slice.label)}: ${slice.count} (${share(slice.count)}%)`}</title>
          </circle>;
        })}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-ink">{center}</span>
        <span className="text-[11px] text-ink-3">{centerLabel}</span>
      </div>
    </div>
    <ul className="min-w-0 space-y-2 text-sm">
      {slices.map((slice) => <li key={slice.key} data-testid={`legend-${slice.key}`} className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: colorOf(slice.key) }} />
        <span className="text-ink-2">{t(slice.label)}</span>
        <span className="font-semibold tabular-nums text-ink">{slice.count}</span>
        <span className="text-xs text-ink-3">({share(slice.count)}%)</span>
      </li>)}
    </ul>
  </div>;
}

/** Under / Average / High from the total of the Core KPI, for the period listed (Interview D4, 14 Oct 2026). */
function PerformanceCard({ rows, catalog, noKpi }: { rows: readonly Row[]; catalog: KpiCatalog | null; noKpi: number }) {
  const { slices, rated, total } = performanceSlices(rows);
  const averages = averageScores(rows);
  const { missing, unscored } = reviewCounts(rows);
  const compiled = rows.filter((row) => row.compiled).length;
  const { t } = useLanguage();
  // Information, not an alert: some positions have no KPI by design and only a catalog migration adds one.
  const noKpiNote = noKpi > 0 && <p data-testid="kpi-no-role" className="mt-2 text-sm text-ink-2">{t("{count} pegawai tidak bisa diberi Performance Review karena posisinya tidak punya KPI di katalog {version}.", { count: noKpi, version: catalog?.version ?? "" })}</p>;
  // R6: mid-month every score is still Compiled, which is progress, not an empty period.
  const compiledNote = compiled > 0 && <p data-testid="kpi-compiled-count" className="mt-2 text-sm text-ink-2">{t("{count} pegawai sudah punya skor Compiled dari Daily KPI, menunggu finalisasi menjadi Performance Review.", { count: compiled })}</p>;
  if (rated) return <Card title={t("Performance category")} testId="performance-pie">
    <Donut name={t("Performance category")} slices={slices} colors={BAND_COLORS} center={rated} centerLabel={t("dari {total} pegawai", { total })} />
    {noKpiNote}
    <p className="mt-4 text-xs leading-5 text-ink-3">{`${t("Total Core KPI: di bawah {under} Under, {under}–{high} Average, di atas {high} High.", { under: UNDER_BELOW, high: HIGH_ABOVE })}${total > rated ? ` ${t("{count} pegawai belum punya kategori.", { count: total - rated })}` : ""}`}</p>
  </Card>;
  // No 1–100 scorecard yet: an empty donut says nothing, so show the period's average Total KPI instead.
  return <Card title={t("Performance")} testId="performance-pie">
    {missing < total ? <div data-testid="kpi-average">
      {averages.map((item) => <p key={item.scaleMax} className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums text-ink">{scoreText(item.average)}</span>
        <span className="text-sm text-ink-2">{t("/ {scale} rata-rata Total KPI · {count} scorecard", { scale: item.scaleMax, count: item.count })}</span>
      </p>)}
      <p className="mt-2 text-sm text-ink-2">{t("{missing} dari {total} pegawai belum punya Performance Review pada periode ini.", { missing, total })}{unscored ? ` ${t("{count} scorecard tidak dihitung dalam rata-rata karena datanya tidak valid.", { count: unscored })}` : ""}</p>
    </div> : <p className="text-sm text-ink-3">{t("Belum ada Performance Review pada periode ini.")} <Link href="/performance" className="font-semibold text-primary-600 hover:underline">{t("Buka Performance Review")}</Link></p>}
    {compiledNote}
    {noKpiNote}
    <p className="mt-4 text-xs leading-5 text-ink-3">{t("Kategori Under / Average / High berlaku mulai scorecard skala 1–100 (V6, Nov 2026).")}</p>
  </Card>;
}

function CompetencyCard({ rows }: { rows: readonly Row[] }) {
  const { t } = useLanguage();
  return <Card title={t("Competency status")} testId="competency-pie">
    <Donut name={t("Competency status")} slices={competencySlices(rows)} colors={COMPETENCY_COLORS} center={rows.length} centerLabel={t("employees")} />
  </Card>;
}

const GAP_BARS = 5;

/** Ranked bars: which competencies have the most open gaps among the listed, assessed employees. */
function GapRankingCard({ snapshot, rows }: { snapshot: D4LiveSnapshot; rows: readonly Row[] }) {
  const ranking = gapRanking(snapshot, rows);
  const top = ranking.slice(0, GAP_BARS);
  const max = top[0]?.count ?? 0;
  const { t } = useLanguage();
  return <Card title={t("Top competency gaps")} testId="competency-gap-ranking">
    {top.length ? <ol className="space-y-3">
      {top.map((item) => <li key={item.id} data-testid={`gap-bar-${slug(item.name)}`} title={t("{name}: {count} pegawai", { name: item.name, count: item.count })}>
        <p className="truncate text-sm text-ink-2">{item.name}</p>
        <div className="mt-1 flex items-center gap-3">
          <div className="h-2.5 flex-1"><div className="h-full rounded-r-[4px]" style={{ width: `${(item.count / max) * 100}%`, background: "var(--color-danger)" }} /></div>
          <span className="w-8 text-right text-sm font-semibold tabular-nums text-ink">{item.count}</span>
        </div>
      </li>)}
    </ol> : <p className="text-sm text-ink-3">{t("Tidak ada gap kompetensi terbuka pada daftar ini.")}</p>}
    {top.length > 0 && <p className="mt-4 text-xs leading-5 text-ink-3">{t("Jumlah pegawai dengan gap terbuka per kompetensi, dari pegawai yang sudah dinilai.")}{ranking.length > GAP_BARS ? ` ${t("{count} kompetensi lain juga punya gap.", { count: ranking.length - GAP_BARS })}` : ""}</p>}
  </Card>;
}

function AlertsCard({ snapshot, rows, period }: { snapshot: D4LiveSnapshot; rows: readonly Row[]; period: string }) {
  const { catalog: catalogSet } = useD4();
  const { t } = useLanguage();
  const alerts = dashboardAlerts(snapshot, rows, catalogSet && catalogFor(catalogSet, thisMonth()), period, undefined, t);
  const writer = canWrite(snapshot);
  const [assignFor, setAssignFor] = useState<AssignTarget | null>(null);
  const [savedNeed, setSavedNeed] = useState<{ needId: string; name: string } | null>(null);
  const [peopleFor, setPeopleFor] = useState<DashboardAlert | null>(null);
  return <Card title={t("Alerts")} testId="dashboard-alerts">
    {savedNeed && <div className="mb-3"><SavedNotice text={t("Development requirement untuk {name} tersimpan.", { name: savedNeed.name })} href={`/development/${savedNeed.needId}`} /></div>}
    {alerts.length ? <ul className="divide-y divide-line">
      {alerts.map((alert) => {
        // W9: nobody assigns training to themselves, so the actor's own row gets no chip.
        const assign = writer ? alert.assign?.filter((item) => canAssess(snapshot, item.employeeId)) : undefined;
        return <li key={alert.key} data-testid={`alert-${alert.key}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">{alert.title}{alert.label && <span data-testid={`alert-label-${alert.key}`} className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning">{alert.label}</span>}</p>
          <p className="mt-0.5 text-sm text-ink-2"><span className="font-semibold tabular-nums">{alert.count}</span> {alert.detail}{writer && alert.action ? ` ${alert.action}` : ""}</p>
          {/* Q16: each Under Performance employee can be assigned training straight from here. */}
          {assign?.length ? <ul className="mt-2 flex flex-wrap gap-2">{assign.map((item) => <li key={item.employeeId} className="min-w-0 max-w-full">
            <button type="button" data-testid={`btn-assign-training-${item.employeeId}`} onClick={() => setAssignFor(item)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/15">
              <span className="truncate text-ink-2">{item.name}</span><span className="shrink-0 font-semibold text-primary-600">{t("Assign training")}</span>
            </button>
          </li>)}</ul>
            : <div className="mt-1 text-xs text-ink-3"><p className="truncate">{alert.people.slice(0, 3).join(", ")}</p>
              {/* Pak Emanuel, 17 Nov 2026: who an alert is about must be readable on the dashboard itself, not only after Open. */}
              {alert.people.length > 3 && <button type="button" data-testid={`btn-alert-people-${alert.key}`} onClick={() => setPeopleFor(alert)}
                className="mt-0.5 rounded font-semibold text-primary-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
                {t("Lihat semua {count} pegawai", { count: alert.people.length })}</button>}</div>}
        </div>
        <SourceLink href={alert.href}>{t("Buka")}</SourceLink>
      </li>;
      })}
    </ul> : <p className="text-sm text-ink-3">{t("Tidak ada alert untuk daftar ini.")}</p>}
    {peopleFor && <FormModal title={peopleFor.title} description={`${peopleFor.count} ${peopleFor.detail}`} onClose={() => setPeopleFor(null)}
      footer={<Button data-testid="btn-close-alert-people" onClick={() => setPeopleFor(null)}>{t("Close")}</Button>}>
      <ul data-testid="alert-people" className="divide-y divide-line">{peopleFor.people.map((name) => <li key={name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
        <span className="min-w-0 truncate text-sm text-ink">{name}</span>
        <SourceLink href={withQuery(peopleFor.href, name)}>{t("Buka")}</SourceLink>
      </li>)}</ul>
    </FormModal>}
    {assignFor && <DevelopmentFormModal employeeId={assignFor.employeeId} sourceType="performance_context" sourceRef={assignFor.scorecardId} onClose={() => setAssignFor(null)} onSaved={(needId) => setSavedNeed({ needId, name: assignFor.name })} />}
  </Card>;
}

function ScoreCell({ scorecard, compiled, listScale }: { scorecard?: KpiAssessment; compiled?: DailyCompilation | null; listScale: number }) {
  const { t } = useLanguage();
  if (!scorecard && compiled) return <span className="text-ink">{listScore(compiled.total, compiled.definitionVersion, listScale)}<span className="mt-1 block"><StatusBadge status="Compiled" /></span></span>;
  if (!scorecard) return <>—</>;
  if (!validScorecard(scorecard)) return <span className="text-xs font-semibold text-danger">{t("Invalid data")}</span>;
  const band = performanceBand(scorecard.overallScore, scorecard.definitionVersion);
  return <span className="font-semibold text-ink">{listScore(scorecard.overallScore, scorecard.definitionVersion, listScale)}{band && <span className="mt-1 block"><StatusBadge status={band} /></span>}</span>;
}

/** The alert's list narrowed to one person (`?q=<name>`), keeping its period. */
function withQuery(href: string, name: string) {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("q", name);
  return `${path}?${params}`;
}

function SourceLink({ href, children }: { href: string; children?: ReactNode }) {
  const { t } = useLanguage();
  return <Link href={href} data-testid="link-view-source" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">{children ?? t("View source")}<ArrowUpRight aria-hidden="true" className="size-4" /></Link>;
}

export function EmployeeProfilePage({ employeeId, initialPeriod = "", own = false }: { employeeId: string; initialPeriod?: string; own?: boolean }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const [period, setPeriod] = useState(initialPeriod);
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what={t("Employee")} backHref="/dashboard" backLabel={t("Back to People Dashboard")} />;
  // Periods with Daily KPI count too, so a row the dashboard shows as Compiled opens on the same period here.
  const periods = [...new Set([...[...scorecardsOf(snapshot, employee.id), ...evaluationsOf(snapshot, employee.id)].filter((item) => item.status === "completed").map((item) => item.period),
    ...(snapshot.kpiDaily ?? []).filter((item) => item.employeeId === employee.id).map((item) => item.period)])].sort().reverse();
  const { period: shown, scorecard, evaluation } = periodData(snapshot, employee.id, period || defaultPeriod(periods));
  const compiled = !scorecard && shown ? pendingCompilation(snapshot, employee.id, shown) : null;
  const gap = currentGap(snapshot, employee);
  const competencyStatus = currentCompetencyStatus(snapshot, employee);
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee.id);
  const employeeTraining = trainings(snapshot).filter((item) => item.employeeId === employee.id);
  // K10: an employee only ever sees their own profile, whatever URL opened it, so it is always "My Performance".
  const self = own || snapshot.role === "EMPLOYEE";
  // One sentence for the dictionary; the period sits in <strong> between its two halves.
  const showing = t("Menampilkan periode {period} untuk KPI dan performance.").split("{period}");
  const target = (definitionVersion?: string | null) => scaleMaxOf(definitionVersion) === 100 ? `${t("Target")} ${KPI_TARGET} · ` : "";

  return <>
    <DetailHeader crumbs={self ? [{ label: "HRMS" }, { label: t("My Performance") }] : [{ label: "HRMS" }, { label: "People Dashboard", href: "/dashboard" }, { label: t("Employee") }]} backHref={self ? undefined : "/dashboard"}
      name={employee.fullName} meta={employeeMeta(snapshot, employee, t)} />
    <FilterBar>
      <PeriodFilter label={t("Period")} testId="latest-period" emptyOption={false} value={shown ?? ""} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item, language) }))} />
      <p className="text-sm text-ink-3">{showing[0]}<strong className="text-ink">{formatPeriod(shown, language)}</strong>{showing[1]}</p>
    </FilterBar>
    {scorecard && !validScorecard(scorecard) && <Notice tone="warning">{t("Total bobot KPI di scorecard periode ini tidak 100%.")}{canWrite(snapshot) ? ` ${t("Periksa datanya di halaman Performance Review sebelum digunakan.")}` : ""}</Notice>}
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Full width on xl: KPI rows with six columns do not fit half a 1440 px layout. */}
      {/* An employee's compiled score comes from their own Daily KPI; the performance history has no entry for it yet (K10). */}
      <Card title="Performance Review" className="xl:col-span-2" actions={<SourceLink href={scorecard ? `/performance/scorecard/${scorecard.id}` : compiled && self ? "/daily-kpi" : evaluation ? `/performance/${evaluation.id}` : `/performance/history/${employee.id}`} />} padded={false}>
        {scorecard ? <div className="overflow-x-auto"><table data-testid="dashboard-kpi-table" className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="py-2.5 pl-5 pr-2.5">Core KPI</th><th className="px-2.5 py-2.5">{t("Weight")}</th><th className="px-2.5 py-2.5">{t("Target")}</th><th className="px-2.5 py-2.5">{t("Actual")}</th><th className="px-2.5 py-2.5 text-right">{t("Weighted")}</th><th className="py-2.5 pl-2.5 pr-5">{t("Comment")}</th></tr></thead>
          <tbody>{scorecard.lines.map((line) => <tr key={line.indicator_order} data-testid={`kpi-line-${line.indicator_order}`} className="border-t border-line"><td className="py-2.5 pl-5 pr-2.5 font-semibold">{line.kpi_name}</td><td className="px-2.5 py-2.5 tabular-nums">{line.weight_percent}%</td><td className="px-2.5 py-2.5">{targetLabel(line.target, scorecard.definitionVersion)}</td><td className="px-2.5 py-2.5 tabular-nums">{line.raw_score ?? "—"}</td><td className="px-2.5 py-2.5 text-right tabular-nums">{scoreText(weighted(line, scaleMaxOf(scorecard.definitionVersion)))}</td><td data-testid={`dashboard-kpi-comment-${line.indicator_order}`} className="py-2.5 pl-2.5 pr-5 text-ink-2"><LineComment line={line} /></td></tr>)}</tbody>
          <tfoot className="border-t border-line bg-app"><tr><td colSpan={4} className="py-2.5 pl-5 pr-2.5 font-semibold">{t("Total")} ({formatPeriod(scorecard.period, language)})</td><td className="whitespace-nowrap px-2.5 py-2.5 text-right font-display font-semibold tabular-nums">{formatScorecard(scorecard)}<span data-testid="dashboard-kpi-gap" className="block font-sans text-xs font-normal text-ink-3">{target(scorecard.definitionVersion)}Gap {formatGap(scorecard.overallScore, scorecard.definitionVersion, t)}</span></td><td /></tr></tfoot>
        </table></div> : compiled ? <div data-testid="dashboard-kpi-compiled" className="px-6 pb-6">
          {/* Same number and badge as the dashboard row; not final, so the charts and the completion count leave it out. */}
          <p className="font-display text-lg font-semibold tabular-nums text-ink">{formatScore(compiled.total, scaleMaxOf(compiled.definitionVersion))}</p>
          <div className="mt-1"><StatusBadge status="Compiled" /></div>
          {/* R5: the employee sees the target and how far the score is from it. */}
          {target(compiled.definitionVersion) && <p data-testid="dashboard-kpi-compiled-gap" className="mt-2 text-sm text-ink-2">{target(compiled.definitionVersion)}Gap {formatGap(compiled.total, compiled.definitionVersion, t)}</p>}
          <p className="mt-2 text-sm text-ink-3">{self ? t("Dikompilasi dari {count} entri Daily KPI: rata-rata tiap KPI dibulatkan, lalu dibobot. Belum difinalisasi HR/Manager.", { count: compiled.days.length })
            : t("Dikompilasi dari {count} entri Daily KPI: rata-rata tiap KPI dibulatkan, lalu dibobot. Belum difinalisasi HR/Manager, jadi belum dihitung di grafik dan Performance Review complete.", { count: compiled.days.length })}</p>
        </div> : evaluation ? <p data-testid="dashboard-kpi-legacy" className="px-6 pb-6 text-sm text-ink-3">{t("Periode ini punya evaluasi lama, dicatat sebelum KPI dan Notes digabung, jadi tanpa skor KPI. Isinya ada di kartu Notes.")}</p>
          : <p className="px-6 pb-6 text-sm text-ink-3">{t("Belum ada Performance Review untuk periode ini.")}</p>}
      </Card>
      {/* FR-04.3: the evaluation card shows the notes of the Performance Review (older records: the separate evaluation). */}
      <Card title={t("Notes")} testId="performance-evaluation" actions={<SourceLink href={scorecard ? `/performance/scorecard/${scorecard.id}` : evaluation ? `/performance/${evaluation.id}` : `/performance/history/${employee.id}`} />}>
        {scorecard?.generalNotes ? <><p className="text-sm text-ink-2">{formatPeriod(scorecard.period, language)} · {formatDate(scorecard.evaluationDate, language)} · Evaluator {scorecard.evaluatorName || "—"}</p><p className="mt-3 line-clamp-6 whitespace-pre-wrap break-words text-sm text-ink">{scorecard.generalNotes}</p></>
          : evaluation ? <><p className="text-sm text-ink-2">{formatPeriod(evaluation.period, language)} · {formatDate(evaluation.evaluationDate, language)} · Evaluator {evaluation.evaluator || "—"}</p><p className="mt-3 line-clamp-6 whitespace-pre-wrap break-words text-sm text-ink">{evaluation.generalNotes || "—"}</p></>
          : <p className="text-sm text-ink-3">{t("Belum ada notes untuk periode ini.")}</p>}
      </Card>
      <Card title="Competency Gap" testId="competency-gap" actions={<SourceLink href={`/competency/${employee.id}`} />}>
        {/* Same status as the dashboard table and Competency Gap list; the findings below are a live comparison with D3 skills. */}
        <p data-testid="profile-competency-status" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">{t("Status")} <StatusBadge status={competencyStatus} /></p>
        {competencyStatus === "Not Evaluated" && gap?.findings.length ? <p className="mb-3 text-xs leading-5 text-ink-3">{t("Belum ada penilaian tersimpan untuk posisi ini. Daftar di bawah membandingkan data skill saat ini dengan persyaratan posisi.")}</p> : null}
        {gap?.findings.length ? <ul className="space-y-2.5">{gap.findings.map((item) => <li key={item.requirementId} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.competencyName} <span className="text-ink-3">· level {item.actualLevel ?? "—"} / min. {item.requiredLevel}</span></span><StatusBadge status={item.status} /></li>)}</ul>
          : <p className="text-sm text-ink-3">{t("Belum ada persyaratan untuk posisi ini.")}</p>}
      </Card>
      <Card title="Development & Training" actions={<SourceLink href="/development" />}>
        {needs.length ? <ul className="space-y-3">{needs.map((need) => {
          const linked = employeeTraining.filter((item) => item.developmentNeedId === need.needId);
          return <li key={need.needId} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/development/${need.needId}`} data-testid={`dev-need-${need.needId}`} className="text-sm font-semibold hover:text-primary-600 hover:underline">{need.objective}</Link><StatusBadge status={need.status} /></div>
            <p className="mt-1.5 text-xs text-ink-3">{linked.length ? linked.map((item) => `${item.activity} (${t(statusLabel(item.status))}, ${formatDate(item.date, language)})`).join(" · ") : t("Belum ada training")}</p>
          </li>;
        })}</ul> : <p className="text-sm text-ink-3">{t("Belum ada development requirement.")}</p>}
      </Card>
      <Card title={t("Employee history")} testId="employee-history" className="xl:col-span-2">
        <Timeline empty={t("Belum ada riwayat penilaian, development, atau training untuk pegawai ini.")} entries={employeeHistory(snapshot, employee.id, t)} />
        <p className="mt-4 text-xs leading-5 text-ink-3">{t("Gabungan riwayat Competency Gap, Performance Review, Development Requirement, dan Training, terbaru di atas. Riwayat posisi hanya dari penilaian perubahan posisi; aplikasi ini tidak menyimpan riwayat jabatan.")}</p>
      </Card>
    </div>
  </>;
}

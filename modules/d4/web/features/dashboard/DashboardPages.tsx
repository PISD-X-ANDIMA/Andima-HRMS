"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Eye, Target } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { D4LiveSnapshot, KpiAssessment } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { catalogFor, type KpiCatalog } from "../../../kpi/catalog";
import { canWrite, currentCompetencyStatus, currentGap, departmentOf, developmentNeeds, employeeById, employeeMeta, employeeSearchText, evaluationsOf, formatDate, formatPeriod, formatScorecard, includesText, positionOf, positionOptions, scorecardsOf, trainings, trainingsOf, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Card, Notice, slug, statusLabel, StatusBadge } from "../../ui/primitives";
import { LineComment, weighted } from "../kpi/KpiFormModal";
import { HIGH_ABOVE, performanceBand, scaleMaxOf, UNDER_BELOW } from "../../../kpi/scale";
import { averageScores, BANDS, COMPETENCY_ORDER, competencySlices, dashboardAlerts, defaultPeriod, employeeHistory, gapRanking, matchesDashboardFilters, openNeedCount, performanceSlices, profilePeriod, reviewCounts, validScorecard, withoutKpiRole, type AssignTarget, type DashboardRow, type Slice } from "./summary";
import { DevelopmentFormModal } from "../development/DevelopmentModals";

type Row = DashboardRow & { position: string; period?: string; openNeeds: number; training?: string };

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
  const { catalog: catalogSet } = useD4();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [period, setPeriod] = useState("");
  const [band, setBand] = useState("");
  const [competency, setCompetency] = useState("");
  const [training, setTraining] = useState("");
  const periods = useMemo(() => [...new Set([...(snapshot.kpiAssessments ?? []), ...snapshot.performance].map((item) => item.period))].sort().reverse(), [snapshot]);
  const shown = period || defaultPeriod(periods);
  const catalog = useMemo(() => catalogSet && shown ? catalogFor(catalogSet, shown) : null, [catalogSet, shown]);

  const rows = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    // Every row shows the same period: the chosen one, else the latest period that has started (bug 20).
    const data = periodData(snapshot, employee.id, shown);
    return {
      employee, position: positionOf(snapshot, employee)?.title ?? "—", period: data.period, scorecard: data.scorecard,
      gap: currentCompetencyStatus(snapshot, employee),
      openNeeds: openNeedCount(snapshot, employee.id),
      training: trainingsOf(snapshot, employee.id)[0]?.status,
    };
  }).filter((row) => includesText(employeeSearchText(snapshot, row.employee), search) && (!position || row.employee.positionId === position) && (!department || row.employee.departmentId === department)
    && matchesDashboardFilters(row, { band, competency, training }))
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)), [snapshot, search, position, department, shown, band, competency, training]);

  const profileHref = (row: Row) => `/dashboard/employee/${row.employee.id}${row.period ? `?period=${row.period}` : ""}`;

  return <>
    <PageHeader title="People Dashboard" subtitle="KPI, performance, gap kompetensi, development, dan training per pegawai untuk periode yang sama." />
    <FilterBar canReset={Boolean(search || position || department || period || band || competency || training)} onReset={() => { setSearch(""); setPosition(""); setDepartment(""); setPeriod(""); setBand(""); setCompetency(""); setTraining(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or position" />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All positions" testId="all-positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All departments" testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      {/* The dashboard always shows one period, so there is no "All periods" choice; it starts on the latest one that has started. */}
      <SelectFilter label="Period" testId="latest-period" emptyOption={false} value={shown} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      {/* FR-D4-004 B: performance category (1–100 scorecards only), competency status and latest training status. */}
      {snapshot.role !== "EMPLOYEE" && <>
        <SelectFilter label="All categories" testId="all-categories" value={band} onChange={setBand} options={BANDS.map((item) => ({ value: item, label: item }))} />
        <SelectFilter label="All competency status" testId="all-competency-status" value={competency} onChange={setCompetency} options={COMPETENCY_ORDER.map((item) => ({ value: item, label: item }))} />
        <SelectFilter label="All training status" testId="all-training-status" value={training} onChange={setTraining} options={["Planned", "In Progress", "Completed", "Cancelled"].map((item) => ({ value: item, label: statusLabel(item) }))} />
      </>}
    </FilterBar>
    <SummaryStrip rows={rows} period={shown} />
    {snapshot.role !== "EMPLOYEE" && rows.length > 0 && <>
      <div className="grid gap-6 xl:grid-cols-3">
        <PerformanceCard snapshot={snapshot} rows={rows} catalog={catalog} />
        <CompetencyCard rows={rows} />
        <GapRankingCard snapshot={snapshot} rows={rows} />
      </div>
      <AlertsCard snapshot={snapshot} rows={rows} />
    </>}
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id}
      emptyTitle="Tidak ada pegawai yang cocok" emptyText={snapshot.role === "EMPLOYEE" ? "Ubah kata kunci atau periode, lalu coba lagi." : "Ubah kata kunci, filter, atau periode, lalu coba lagi."}
      columns={[
        { key: "employee", header: "Employee", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        // Position and department share one column so the nine summary columns fit at 1440px.
        { key: "position", header: "Position / Department", wrap: true, secondary: true, cell: (row) => <><span className="block">{row.position}</span><span className="block text-xs text-ink-3">{departmentOf(snapshot, row.employee)?.name ?? "—"}</span></> },
        // Every row shows the period chosen in the filter, so the column only earns its space on wide screens.
        { key: "period", header: "Period", secondary: true, cell: (row) => formatPeriod(row.period) },
        { key: "kpi", header: "Total KPI", className: "tabular-nums", cell: (row) => <ScoreCell scorecard={row.scorecard} /> },
        { key: "gap", header: "Competency", cell: (row) => <StatusBadge status={row.gap} /> },
        { key: "needs", header: "Open dev.", className: "tabular-nums", secondary: true, cell: (row) => row.openNeeds || "—" },
        { key: "training", header: "Training", cell: (row) => row.training ? <StatusBadge status={row.training} /> : "—" },
      ]}
      actions={(row) => <RowActionMenu label={`Actions for ${row.employee.fullName}`} actions={[
        { label: "View Detail", testId: "view-detail", icon: <Eye />, href: profileHref(row) },
        { label: "View Performance Review", testId: "view-penilaian", icon: <Target />, href: row.scorecard ? `/performance/scorecard/${row.scorecard.id}` : `/performance/history/${row.employee.id}` },
      ]} />} />
  </>;
}

/** Headline counts over the rows currently listed (mentor review, 14 Oct 2026). */
function SummaryStrip({ rows, period }: { rows: readonly Row[]; period: string }) {
  const reviewed = rows.filter((row) => row.scorecard && validScorecard(row.scorecard)).length;
  // Completion of the period's reviews is the share HR acts on; the count stays a plain integer for Katalon.
  const tiles = [
    { key: "total", label: "Employees", value: rows.length, hint: "sesuai filter" },
    { key: "kpi", label: "Performance Review complete", value: reviewed, hint: `dari ${rows.length} pegawai (${rows.length ? Math.round((reviewed / rows.length) * 100) : 0}%) · ${formatPeriod(period)}` },
    // UAT-19: the partner asked for "jumlah karyawan yang butuh training"; testId summary-dev stays for Katalon.
    { key: "dev", label: "Need training", hint: "punya development requirement yang belum selesai", value: rows.filter((row) => row.openNeeds > 0).length },
    { key: "training", label: "Training in progress", value: rows.filter((row) => row.training === "In Progress").length, hint: "training terakhirnya In Progress" },
  ];
  return <section aria-label="Summary" data-testid="dashboard-summary" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
    {tiles.map((tile) => <div key={tile.key} data-testid={`summary-${tile.key}`} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">{tile.label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{tile.value}</p>
      <p data-testid={`summary-${tile.key}-hint`} className="mt-1 text-xs text-ink-3">{tile.hint}</p>
    </div>)}
  </section>;
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
  return <div className="flex flex-wrap items-center gap-6">
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${name}: ${drawn.map((slice) => `${slice.label} ${slice.count}`).join(", ") || "belum ada data"}`}>
        {!arcs.length && <circle cx="50" cy="50" r={RING_R} fill="none" stroke="var(--color-line)" strokeWidth="12" />}
        {arcs.map(({ slice, start, length }) => {
          const dash = arcs.length > 1 ? Math.max(length - SLICE_GAP, 0.5) : length;
          return <circle key={slice.key} data-testid={`slice-${slice.key}`} cx="50" cy="50" r={RING_R} fill="none" stroke={colorOf(slice.key)} strokeWidth="12" strokeDasharray={`${dash} ${RING - dash}`} strokeDashoffset={-start}>
            <title>{`${slice.label}: ${slice.count} (${share(slice.count)}%)`}</title>
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
        <span className="text-ink-2">{slice.label}</span>
        <span className="font-semibold tabular-nums text-ink">{slice.count}</span>
        <span className="text-xs text-ink-3">({share(slice.count)}%)</span>
      </li>)}
    </ul>
  </div>;
}

/** Under / Average / High from the total of the five Core KPI, for the period listed (Interview D4, 14 Oct 2026). */
function PerformanceCard({ snapshot, rows, catalog }: { snapshot: D4LiveSnapshot; rows: readonly Row[]; catalog: KpiCatalog | null }) {
  const { slices, rated, total } = performanceSlices(rows);
  const averages = averageScores(rows);
  const { missing, unscored } = reviewCounts(rows);
  const noKpi = withoutKpiRole(snapshot, rows, catalog).length;
  // Information, not an alert: some positions have no KPI by design and only a catalog migration adds one.
  const noKpiNote = noKpi > 0 && <p data-testid="kpi-no-role" className="mt-2 text-sm text-ink-2">{noKpi} pegawai tidak bisa diberi Performance Review karena posisinya tidak punya KPI di katalog {catalog?.version}.</p>;
  if (rated) return <Card title="Performance category" testId="performance-pie">
    <Donut name="Performance category" slices={slices} colors={BAND_COLORS} center={rated} centerLabel={`dari ${total} pegawai`} />
    {noKpiNote}
    <p className="mt-4 text-xs leading-5 text-ink-3">{`Total 5 Core KPI: di bawah ${UNDER_BELOW} Under, ${UNDER_BELOW}–${HIGH_ABOVE} Average, di atas ${HIGH_ABOVE} High.${total > rated ? ` ${total - rated} pegawai belum punya kategori.` : ""}`}</p>
  </Card>;
  // No 1–100 scorecard yet: an empty donut says nothing, so show the period's average Total KPI instead.
  return <Card title="Performance" testId="performance-pie">
    {missing < total ? <div data-testid="kpi-average">
      {averages.map((item) => <p key={item.scaleMax} className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums text-ink">{item.average.toFixed(2)}</span>
        <span className="text-sm text-ink-2">/ {item.scaleMax} rata-rata Total KPI · {item.count} scorecard</span>
      </p>)}
      <p className="mt-2 text-sm text-ink-2">{missing} dari {total} pegawai belum punya Performance Review pada periode ini.{unscored ? ` ${unscored} scorecard tidak dihitung dalam rata-rata karena datanya tidak valid.` : ""}</p>
    </div> : <p className="text-sm text-ink-3">Belum ada Performance Review pada periode ini. <Link href="/performance" className="font-semibold text-primary-600 hover:underline">Buka Performance Review</Link></p>}
    {noKpiNote}
    <p className="mt-4 text-xs leading-5 text-ink-3">Kategori Under / Average / High berlaku mulai scorecard skala 1–100 (V6, Nov 2026).</p>
  </Card>;
}

function CompetencyCard({ rows }: { rows: readonly Row[] }) {
  return <Card title="Competency status" testId="competency-pie">
    <Donut name="Competency status" slices={competencySlices(rows)} colors={COMPETENCY_COLORS} center={rows.length} centerLabel="pegawai" />
  </Card>;
}

const GAP_BARS = 5;

/** Ranked bars: which competencies have the most open gaps among the listed, assessed employees. */
function GapRankingCard({ snapshot, rows }: { snapshot: D4LiveSnapshot; rows: readonly Row[] }) {
  const ranking = gapRanking(snapshot, rows);
  const top = ranking.slice(0, GAP_BARS);
  const max = top[0]?.count ?? 0;
  return <Card title="Top competency gaps" testId="competency-gap-ranking">
    {top.length ? <ol className="space-y-3">
      {top.map((item) => <li key={item.id} data-testid={`gap-bar-${slug(item.name)}`} title={`${item.name}: ${item.count} pegawai`}>
        <p className="truncate text-sm text-ink-2">{item.name}</p>
        <div className="mt-1 flex items-center gap-3">
          <div className="h-2.5 flex-1"><div className="h-full rounded-r-[4px]" style={{ width: `${(item.count / max) * 100}%`, background: "var(--color-danger)" }} /></div>
          <span className="w-8 text-right text-sm font-semibold tabular-nums text-ink">{item.count}</span>
        </div>
      </li>)}
    </ol> : <p className="text-sm text-ink-3">Tidak ada gap kompetensi terbuka pada daftar ini.</p>}
    {top.length > 0 && <p className="mt-4 text-xs leading-5 text-ink-3">Jumlah pegawai dengan gap terbuka per kompetensi, dari pegawai yang sudah dinilai.{ranking.length > GAP_BARS ? ` ${ranking.length - GAP_BARS} kompetensi lain juga punya gap.` : ""}</p>}
  </Card>;
}

function AlertsCard({ snapshot, rows }: { snapshot: D4LiveSnapshot; rows: readonly Row[] }) {
  const alerts = dashboardAlerts(snapshot, rows);
  const [assignFor, setAssignFor] = useState<AssignTarget | null>(null);
  return <Card title="Alerts" testId="dashboard-alerts">
    {alerts.length ? <ul className="divide-y divide-line">
      {alerts.map((alert) => <li key={alert.key} data-testid={`alert-${alert.key}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">{alert.title}{alert.label && <span data-testid={`alert-label-${alert.key}`} className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning">{alert.label}</span>}</p>
          <p className="mt-0.5 text-sm text-ink-2"><span className="font-semibold tabular-nums">{alert.count}</span> {alert.detail}</p>
          {/* Q16: each Under Performance employee can be assigned training straight from here. */}
          {alert.assign?.length && canWrite(snapshot) ? <ul className="mt-2 flex flex-wrap gap-2">{alert.assign.map((item) => <li key={item.employeeId} className="min-w-0 max-w-full">
            <button type="button" data-testid={`btn-assign-training-${item.employeeId}`} onClick={() => setAssignFor(item)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/15">
              <span className="truncate text-ink-2">{item.name}</span><span className="shrink-0 font-semibold text-primary-600">Assign training</span>
            </button>
          </li>)}</ul>
            : <p className="mt-1 truncate text-xs text-ink-3">{alert.people.slice(0, 3).join(", ")}{alert.people.length > 3 ? ` dan ${alert.people.length - 3} lainnya` : ""}</p>}
        </div>
        <SourceLink href={alert.href}>Buka</SourceLink>
      </li>)}
    </ul> : <p className="text-sm text-ink-3">Tidak ada alert untuk daftar ini.</p>}
    {assignFor && <DevelopmentFormModal employeeId={assignFor.employeeId} sourceType="performance_context" sourceRef={assignFor.scorecardId} onClose={() => setAssignFor(null)} />}
  </Card>;
}

function ScoreCell({ scorecard }: { scorecard?: KpiAssessment }) {
  if (!scorecard) return <>—</>;
  if (!validScorecard(scorecard)) return <span className="text-xs font-semibold text-danger">Invalid data</span>;
  const band = performanceBand(scorecard.overallScore, scorecard.definitionVersion);
  return <span className="font-semibold text-ink">{formatScorecard(scorecard)}{band && <span className="mt-1 block"><StatusBadge status={band} /></span>}</span>;
}

function SourceLink({ href, children = "View source" }: { href: string; children?: ReactNode }) {
  return <Link href={href} data-testid="link-view-source" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">{children}<ArrowUpRight aria-hidden="true" className="size-4" /></Link>;
}

export function EmployeeProfilePage({ employeeId, initialPeriod = "" }: { employeeId: string; initialPeriod?: string }) {
  const snapshot = useSnapshot();
  const [period, setPeriod] = useState(initialPeriod);
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Employee" backHref="/dashboard" backLabel="Back to People Dashboard" />;
  const periods = [...new Set([...scorecardsOf(snapshot, employee.id), ...evaluationsOf(snapshot, employee.id)].filter((item) => item.status === "completed").map((item) => item.period))].sort().reverse();
  const { period: shown, scorecard, evaluation } = periodData(snapshot, employee.id, period);
  const gap = currentGap(snapshot, employee);
  const competencyStatus = currentCompetencyStatus(snapshot, employee);
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee.id);
  const employeeTraining = trainings(snapshot).filter((item) => item.employeeId === employee.id);

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "People Dashboard", href: "/dashboard" }, { label: "Employee" }]} backHref="/dashboard"
      name={employee.fullName} meta={employeeMeta(snapshot, employee)} />
    <FilterBar>
      <SelectFilter label="Period" testId="latest-period" emptyOption={false} value={shown ?? ""} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      <p className="text-sm text-ink-3">Menampilkan periode <strong className="text-ink">{formatPeriod(shown)}</strong> untuk KPI dan performance.</p>
    </FilterBar>
    {scorecard && !validScorecard(scorecard) && <Notice tone="warning">Scorecard periode ini tidak memiliki lima KPI dengan total bobot 100%. Periksa datanya di halaman Performance Review sebelum digunakan.</Notice>}
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Full width on xl: five KPI rows with six columns do not fit half a 1440 px layout. */}
      <Card title="Performance Review" className="xl:col-span-2" actions={<SourceLink href={scorecard ? `/performance/scorecard/${scorecard.id}` : `/performance/history/${employee.id}`} />} padded={false}>
        {scorecard ? <div className="overflow-x-auto"><table data-testid="dashboard-kpi-table" className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="py-2.5 pl-5 pr-2.5">Core KPI</th><th className="px-2.5 py-2.5">Weight</th><th className="px-2.5 py-2.5">Target</th><th className="px-2.5 py-2.5">Actual</th><th className="px-2.5 py-2.5 text-right">Weighted</th><th className="py-2.5 pl-2.5 pr-5">Comment</th></tr></thead>
          <tbody>{scorecard.lines.map((line) => <tr key={line.indicator_order} data-testid={`kpi-line-${line.indicator_order}`} className="border-t border-line"><td className="py-2.5 pl-5 pr-2.5 font-semibold">{line.kpi_name}</td><td className="px-2.5 py-2.5 tabular-nums">{line.weight_percent}%</td><td className="px-2.5 py-2.5">{line.target || "—"}</td><td className="px-2.5 py-2.5 tabular-nums">{line.raw_score ?? "—"}</td><td className="px-2.5 py-2.5 text-right tabular-nums">{weighted(line, scaleMaxOf(scorecard.definitionVersion))?.toFixed(2) ?? "—"}</td><td data-testid={`dashboard-kpi-comment-${line.indicator_order}`} className="py-2.5 pl-2.5 pr-5 text-ink-2"><LineComment line={line} /></td></tr>)}</tbody>
          <tfoot className="border-t border-line bg-app"><tr><td colSpan={4} className="py-2.5 pl-5 pr-2.5 font-semibold">Total ({formatPeriod(scorecard.period)})</td><td className="whitespace-nowrap px-2.5 py-2.5 text-right font-display font-semibold tabular-nums">{formatScorecard(scorecard)}</td><td /></tr></tfoot>
        </table></div> : <p className="px-6 pb-6 text-sm text-ink-3">Belum ada Performance Review untuk periode ini.</p>}
      </Card>
      {/* FR-04.3: the evaluation card shows the notes of the Performance Review (older records: the separate evaluation). */}
      <Card title="Notes" testId="performance-evaluation" actions={<SourceLink href={scorecard ? `/performance/scorecard/${scorecard.id}` : evaluation ? `/performance/${evaluation.id}` : `/performance/history/${employee.id}`} />}>
        {scorecard?.generalNotes ? <><p className="text-sm text-ink-2">{formatPeriod(scorecard.period)} · {formatDate(scorecard.evaluationDate)} · Penilai {scorecard.evaluatorName || "—"}</p><p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm text-ink">{scorecard.generalNotes}</p></>
          : evaluation ? <><p className="text-sm text-ink-2">{formatPeriod(evaluation.period)} · {formatDate(evaluation.evaluationDate)} · Penilai {evaluation.evaluator || "—"}</p><p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm text-ink">{evaluation.generalNotes || "—"}</p></>
          : <p className="text-sm text-ink-3">Belum ada notes untuk periode ini.</p>}
      </Card>
      <Card title="Competency Gap" testId="competency-gap" actions={<SourceLink href={`/competency/${employee.id}`} />}>
        {/* Same status as the dashboard table and Competency Gap list; the findings below are a live comparison with D3 skills. */}
        <p data-testid="profile-competency-status" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">Status <StatusBadge status={competencyStatus} /></p>
        {competencyStatus === "Not Evaluated" && gap?.findings.length ? <p className="mb-3 text-xs leading-5 text-ink-3">Belum ada penilaian tersimpan untuk posisi ini. Daftar di bawah membandingkan data skill saat ini dengan persyaratan posisi.</p> : null}
        {gap?.findings.length ? <ul className="space-y-2.5">{gap.findings.map((item) => <li key={item.requirementId} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.competencyName} <span className="text-ink-3">· level {item.actualLevel ?? "—"} / min. {item.requiredLevel}</span></span><StatusBadge status={item.status} /></li>)}</ul>
          : <p className="text-sm text-ink-3">Belum ada persyaratan untuk posisi ini.</p>}
      </Card>
      <Card title="Development & Training" actions={<SourceLink href="/development" />}>
        {needs.length ? <ul className="space-y-3">{needs.map((need) => {
          const linked = employeeTraining.filter((item) => item.developmentNeedId === need.needId);
          return <li key={need.needId} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/development/${need.needId}`} data-testid={`dev-need-${need.needId}`} className="text-sm font-semibold hover:text-primary-600 hover:underline">{need.objective}</Link><StatusBadge status={need.status} /></div>
            <p className="mt-1.5 text-xs text-ink-3">{linked.length ? linked.map((item) => `${item.activity} (${statusLabel(item.status)}, ${formatDate(item.date)})`).join(" · ") : "Belum ada training"}</p>
          </li>;
        })}</ul> : <p className="text-sm text-ink-3">Belum ada development requirement.</p>}
      </Card>
      <Card title="History" testId="employee-history" className="xl:col-span-2">
        <Timeline empty="Belum ada riwayat penilaian, development, atau training untuk pegawai ini." entries={employeeHistory(snapshot, employee.id)} />
        <p className="mt-4 text-xs leading-5 text-ink-3">Gabungan riwayat Competency Gap, Performance Review, Development Requirement, dan Training, terbaru di atas. Riwayat posisi hanya dari penilaian perubahan posisi; D4 tidak menyimpan riwayat jabatan.</p>
      </Card>
    </div>
  </>;
}

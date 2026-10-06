"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Target } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { EmployeeReference } from "../../../shared/types";
import type { D4LiveSnapshot, KpiAssessment } from "../../../supabase/types";
import { useSnapshot } from "../../data/D4DataProvider";
import { currentGap, departmentOf, developmentNeeds, employeeById, evaluationsOf, formatDate, formatPeriod, formatResult, formatScore, includesText, periodsOf, positionOf, positionOptions, scorecardsOf, trainings, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Card, Notice, statusLabel, StatusBadge } from "../../ui/primitives";
import { weighted } from "../kpi/KpiFormModal";

type Row = { employee: EmployeeReference; position: string; period?: string; scorecard?: KpiAssessment; performance: number | null; gap: string; openNeeds: number; training: { done: number; total: number } };

const notAssessed = <span className="text-ink-3">Belum dinilai</span>;

/** FR-06.9 validation state: a scorecard is only summarised when it has five KPIs whose weights total 100%. */
const validScorecard = (item: KpiAssessment) => item.lines.length === 5 && item.lines.reduce((sum, line) => sum + line.weight_percent, 0) === 100;

/** One period per employee: the selected period, else the latest completed scorecard, else the latest evaluation (FR-06.1). */
function periodData(snapshot: D4LiveSnapshot, employeeId: string, period: string) {
  const scorecards = scorecardsOf(snapshot, employeeId).filter((item) => item.status === "completed");
  const evaluations = evaluationsOf(snapshot, employeeId).filter((item) => item.status === "completed");
  const selected = period || scorecards[0]?.period || evaluations[0]?.period;
  return { period: selected, scorecard: scorecards.find((item) => item.period === selected), evaluation: evaluations.find((item) => item.period === selected) };
}

/**
 * Dashboard KPI Orang (FR-D4-004): a read-only per-employee summary of the other five features.
 * It reads the same snapshot as the detail pages (FR-06.8), creates no data of its own, adds no
 * aggregate management metrics (out of scope #12) and shows no achieved label (FR-06.10).
 */
export function DashboardPage() {
  const snapshot = useSnapshot();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  // null = default cycle (newest period in the data); "" = all periods, each employee's latest record.
  const [periodChoice, setPeriod] = useState<string | null>(null);
  const periods = useMemo(() => periodsOf([...(snapshot.kpiAssessments ?? []), ...snapshot.performance]), [snapshot]);
  const period = periodChoice ?? periods[0] ?? "";

  const rows = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    // Every row shows the same period: the chosen one, else the latest period in the data (bug 20).
    const data = periodData(snapshot, employee.id, period || periods[0] || "");
    const gap = currentGap(snapshot, employee);
    // Cancelled training is not part of the plan, so it counts in neither number.
    const planned = trainings(snapshot).filter((item) => item.employeeId === employee.id && item.status !== "Cancelled");
    return {
      employee, position: positionOf(snapshot, employee)?.title ?? "—", period: data.period, scorecard: data.scorecard,
      performance: data.evaluation?.overallScore ?? null,
      gap: gap?.overallStatus ?? "Belum Ada Persyaratan",
      openNeeds: developmentNeeds(snapshot).filter((item) => item.employeeId === employee.id && item.status !== "Completed").length,
      training: { done: planned.filter((item) => item.status === "Completed").length, total: planned.length },
    };
  }).filter((row) => includesText(`${row.employee.fullName} ${row.employee.employeeId}`, search) && (!position || row.employee.positionId === position))
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)), [snapshot, search, position, period, periods]);

  const profileHref = (row: Row) => `/dashboard/employee/${row.employee.id}${row.period ? `?period=${row.period}` : ""}`;

  return <>
    <PageHeader title="People Dashboard" subtitle="KPI dan kinerja mengikuti periode terpilih; competency gap, development, dan training menampilkan kondisi terkini per karyawan." />
    <FilterBar canReset={Boolean(search || position || periodChoice !== null)} onReset={() => { setSearch(""); setPosition(""); setPeriod(null); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau ID karyawan" />
      <SelectFilter label="Semua posisi" testId="all-positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />
      <SelectFilter label="Semua periode" testId="latest-period" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
    </FilterBar>
    <DataTable<Row> rows={rows} noun="karyawan" rowKey={(row) => row.employee.id} rowHref={profileHref}
      emptyTitle="Tidak ada karyawan yang cocok" emptyText="Ubah kata kunci, position, atau periode, lalu coba lagi."
      columns={[
        { key: "employee", header: "Karyawan", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: "Posisi", wrap: true, secondary: true, cell: (row) => row.position },
        { key: "period", header: "Periode", cell: (row) => formatPeriod(row.period) },
        { key: "kpi", header: "Total KPI", className: "tabular-nums", cell: (row) => <ScoreCell scorecard={row.scorecard} /> },
        { key: "performance", header: "Kinerja", className: "tabular-nums", cell: (row) => row.performance === null ? notAssessed : formatResult(row.performance) },
        { key: "gap", header: "Kompetensi", cell: (row) => <StatusBadge status={row.gap} /> },
        { key: "needs", header: "Dev. terbuka", className: "tabular-nums", secondary: true, cell: (row) => row.openNeeds || "—" },
        { key: "training", header: "Training", className: "tabular-nums", cell: (row) => row.training.total ? `${row.training.done}/${row.training.total} selesai` : "—" },
      ]}
      actions={(row) => <RowActionMenu label={`Aksi untuk ${row.employee.fullName}`} actions={[
        { label: "Lihat KPI Scorecard", testId: "view-kpi-scorecard", icon: <Target />, href: row.scorecard ? `/kpi/${row.scorecard.id}` : `/kpi/history/${row.employee.id}` },
        { label: "Lihat Evaluasi", testId: "view-evaluation", icon: <ClipboardCheck />, href: `/performance/history/${row.employee.id}` },
      ]} />} />
  </>;
}

function ScoreCell({ scorecard }: { scorecard?: KpiAssessment }) {
  if (!scorecard) return notAssessed;
  if (!validScorecard(scorecard)) return <span className="text-xs font-semibold text-danger">Data tidak valid</span>;
  return <span className="font-semibold text-ink">{formatScore(scorecard.overallScore)}</span>;
}

function SourceLink({ href, children = "Lihat sumber" }: { href: string; children?: ReactNode }) {
  return <Link href={href} data-testid="link-view-source" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">{children}<ArrowUpRight aria-hidden="true" className="size-4" /></Link>;
}

export function EmployeeProfilePage({ employeeId, initialPeriod = "" }: { employeeId: string; initialPeriod?: string }) {
  const snapshot = useSnapshot();
  const [period, setPeriod] = useState(initialPeriod);
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Karyawan" backHref="/dashboard" backLabel="Kembali ke People Dashboard" />;
  const { period: shown, scorecard, evaluation } = periodData(snapshot, employee.id, period);
  const periods = [...new Set([...scorecardsOf(snapshot, employee.id), ...evaluationsOf(snapshot, employee.id)].filter((item) => item.status === "completed").map((item) => item.period))].sort().reverse();
  const gap = currentGap(snapshot, employee);
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee.id);
  const employeeTraining = trainings(snapshot).filter((item) => item.employeeId === employee.id);

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "People Dashboard", href: "/dashboard" }, { label: "Karyawan" }]} backHref="/dashboard"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, departmentOf(snapshot, employee)?.name ?? ""]} />
    <FilterBar>
      <SelectFilter label="Periode terbaru" testId="latest-period" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      <p className="text-sm text-ink-3">Menampilkan periode <strong className="text-ink">{formatPeriod(shown)}</strong> untuk KPI dan performance.</p>
    </FilterBar>
    {scorecard && !validScorecard(scorecard) && <Notice tone="warning">Scorecard periode ini tidak memiliki lima KPI dengan total bobot 100%. Periksa data di halaman KPI Scorecard sebelum dipakai.</Notice>}
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="KPI scorecard" actions={<SourceLink href={scorecard ? `/kpi/${scorecard.id}` : `/kpi/history/${employee.id}`} />} padded={false}>
        {scorecard ? <div className="overflow-x-auto"><table data-testid="dashboard-kpi-table" className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="px-5 py-2.5">Core KPI</th><th className="px-5 py-2.5">Bobot</th><th className="px-5 py-2.5">Target</th><th className="px-5 py-2.5">Realisasi</th><th className="px-5 py-2.5">Skor</th><th className="px-5 py-2.5 text-right">Terbobot</th></tr></thead>
          <tbody>{scorecard.lines.map((line) => <tr key={line.indicator_order} data-testid={`kpi-line-${line.indicator_order}`} className="border-t border-line"><td className="px-5 py-2.5 font-semibold">{line.kpi_name}</td><td className="px-5 py-2.5 tabular-nums">{line.weight_percent}%</td><td className="px-5 py-2.5">{line.target || "—"}</td><td className="px-5 py-2.5">{line.actual || "—"}</td><td className="px-5 py-2.5 tabular-nums">{line.raw_score ?? "—"}</td><td className="px-5 py-2.5 text-right tabular-nums">{weighted(line)?.toFixed(2) ?? "—"}</td></tr>)}</tbody>
          <tfoot className="border-t border-line bg-app"><tr><td colSpan={5} className="px-5 py-2.5 font-semibold">Total ({formatPeriod(scorecard.period)})</td><td className="px-5 py-2.5 text-right font-display tabular-nums">{formatScore(scorecard.overallScore)}</td></tr></tfoot>
        </table></div> : <p className="px-6 pb-6 text-sm text-ink-3">Belum ada KPI scorecard pada periode ini.</p>}
      </Card>
      <Card title="Evaluasi kinerja" testId="performance-evaluation" actions={<SourceLink href={evaluation ? `/performance/${evaluation.id}` : `/performance/history/${employee.id}`} />}>
        {evaluation ? <><p className="font-display text-2xl text-ink">{formatResult(evaluation.overallScore)}</p><p className="mt-1 text-sm text-ink-2">{formatPeriod(evaluation.period)} · Penilai {evaluation.evaluator || "—"}</p><p className="mt-4 line-clamp-3 text-sm text-ink-2">{evaluation.generalNotes || "—"}</p></>
          : <p className="text-sm text-ink-3">Belum ada evaluasi kinerja pada periode ini.</p>}
      </Card>
      <Card title="Gap kompetensi" testId="competency-gap" actions={<SourceLink href={`/competency/${employee.id}`} />}>
        {gap?.findings.length ? <ul className="space-y-2.5">{gap.findings.map((item) => <li key={item.requirementId} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.competencyName} <span className="text-ink-3">· level {item.actualLevel ?? "—"} / min. {item.requiredLevel}</span></span><StatusBadge status={item.status} /></li>)}</ul>
          : <p className="text-sm text-ink-3">Belum ada requirement untuk posisi ini.</p>}
      </Card>
      <Card title="Development & training" actions={<SourceLink href="/development" />}>
        {needs.length ? <ul className="space-y-3">{needs.map((need) => {
          const linked = employeeTraining.filter((item) => item.developmentNeedId === need.needId);
          return <li key={need.needId} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/development/${need.needId}`} data-testid={`dev-need-${need.needId}`} className="text-sm font-semibold hover:text-primary-600 hover:underline">{need.objective}</Link><StatusBadge status={need.status} /></div>
            <p className="mt-1.5 text-xs text-ink-3">{linked.length ? linked.map((item) => `${item.activity} (${statusLabel(item.status)}, ${formatDate(item.date)})`).join(" · ") : "Belum ada training"}</p>
          </li>;
        })}</ul> : <p className="text-sm text-ink-3">Belum ada development requirement.</p>}
      </Card>
    </div>
  </>;
}

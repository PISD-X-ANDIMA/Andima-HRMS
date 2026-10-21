"use client";

import { Eye, History, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { catalogFor, roleForPosition } from "../../../kpi/catalog";
import type { PerformanceEvaluation } from "../../../performance/types";
import type { EmployeeReference } from "../../../shared/types";
import type { KpiAssessment } from "../../../supabase/types";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { canAssess, canWrite, departmentOf, describeSource, developmentNeeds, employeeById, employeeMeta, employeeSearchText, evaluationsOf, formatDate, formatPeriod, formatScorecard, includesText, latestScorecard, positionOf, positionOptions, revisionTag, scorecardsOf, thisMonth, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, StatusBadge } from "../../ui/primitives";
import { noKpiText, KpiFormModal } from "../kpi/KpiFormModal";
import { CatalogNotice, scorecardStatus } from "../kpi/KpiPages";

const evaluationStatus = (evaluation?: PerformanceEvaluation) => !evaluation ? "Belum dinilai" : evaluation.status === "completed" ? "Completed" : "Draft";

// Same words as the Status badge in the table, so a filter choice matches what the rows show.
const STATUS_FILTER = ["Completed", "Not Evaluated"]; // FR-D4-002 has no draft scorecard.

type Row = { employee: EmployeeReference; position: string; hasKpi: boolean; scorecard?: KpiAssessment; evaluation?: PerformanceEvaluation };

/**
 * Performance Review (FR-D4-001 v3.1): one row per employee with the Total KPI, evaluation notes and evaluator of one
 * assessment. Rows do not open on click; detail and history come from the Actions menu.
 */
export function PerformanceListPage() {
  const snapshot = useSnapshot();
  const { catalog: catalogSet } = useD4();
  const writer = canWrite(snapshot);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [period, setPeriod] = useState("");
  const [progress, setProgress] = useState("");
  const [adding, setAdding] = useState<{ employeeId?: string } | null>(null);

  const periods = useMemo(() => [...new Set((snapshot.kpiAssessments ?? []).map((item) => item.period))].sort().reverse(), [snapshot]);
  // KPI role per the catalog in force for the filtered period, or this month when no period is chosen.
  const catalog = useMemo(() => catalogSet && catalogFor(catalogSet, period || thisMonth()), [catalogSet, period]);
  const rows = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    const title = positionOf(snapshot, employee)?.title;
    const scorecard = period ? scorecardsOf(snapshot, employee.id).find((item) => item.period === period) : latestScorecard(snapshot, employee.id);
    return {
      employee, position: title ?? "—", hasKpi: !catalogSet || !title || Boolean(catalog && roleForPosition(catalog, employee.positionId)), scorecard,
      // Older records kept the notes in a separate evaluation; show them until the period is assessed again.
      evaluation: scorecard && evaluationsOf(snapshot, employee.id).find((item) => item.period === scorecard.period),
    };
  }).filter((row) => includesText(employeeSearchText(snapshot, row.employee), search)
    && (!position || row.employee.positionId === position) && (!department || row.employee.departmentId === department)
    && (!progress || scorecardStatus(row.scorecard) === progress))
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)), [snapshot, catalog, catalogSet, search, position, department, period, progress]);

  return <>
    <PageHeader title="Performance Review" subtitle="Lima Core KPI dan Notes per pegawai dan periode, dalam satu penilaian."
      actions={writer && <Button icon={<Plus className="size-4" />} onClick={() => setAdding({})} data-testid="btn-add-penilaian">Add Performance Review</Button>} />
    <CatalogNotice />
    <FilterBar canReset={Boolean(search || position || department || period || progress)} onReset={() => { setSearch(""); setPosition(""); setDepartment(""); setPeriod(""); setProgress(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or position" />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All positions" testId="all-positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All departments" testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label="All periods" testId="latest-period" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      <SelectFilter label="All status" testId="all-status" value={progress} onChange={setProgress} options={STATUS_FILTER.map((item) => ({ value: item, label: item }))} />
    </FilterBar>
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id}
      emptyTitle="Tidak ada pegawai yang cocok" emptyText="Ubah kata kunci atau reset filter untuk melihat semua pegawai."
      columns={[
        { key: "employee", header: "Employee", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: "Position / Department", wrap: true, cell: (row) => <><span className="block">{row.position}</span><span className="block text-xs text-ink-3">{departmentOf(snapshot, row.employee)?.name ?? "—"}</span></> },
        { key: "period", header: "Period", cell: (row) => formatPeriod(row.scorecard?.period) },
        { key: "total", header: "Total KPI", className: "tabular-nums", cell: (row) => row.scorecard ? <span className="font-semibold">{formatScorecard(row.scorecard)}</span>
          : row.hasKpi ? "—" : <span className="text-xs text-ink-3">Not in catalog {catalog?.version} yet</span> },
        { key: "notes", header: "Notes", wrap: true, secondary: true, className: "max-w-[280px]", cell: (row) => {
          const notes = row.scorecard?.generalNotes || row.evaluation?.generalNotes;
          return notes ? <span className="line-clamp-2">{notes}</span> : "—";
        } },
        { key: "evaluator", header: "Penilai", secondary: true, cell: (row) => row.scorecard?.evaluatorName || "—" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={scorecardStatus(row.scorecard)} /> },
      ]}
      actions={(row) => <RowActionMenu label={`Actions for ${row.employee.fullName}`} actions={[
        { label: "View Detail", testId: "view-detail", icon: <Eye />, href: row.scorecard && `/performance/scorecard/${row.scorecard.id}`, hidden: !row.scorecard },
        { label: "View History", testId: "view-history", icon: <History />, href: `/performance/history/${row.employee.id}` },
        { label: "Add Performance Review", testId: "add-penilaian", icon: <Plus />, onSelect: () => setAdding({ employeeId: row.employee.id }), hidden: !canAssess(snapshot, row.employee.id) },
      ]} />} />
    {adding && <KpiFormModal employeeId={adding.employeeId} onClose={() => setAdding(null)} />}
  </>;
}

/** An evaluation saved before FR-D4-001 v3.1 merged it into the Performance Review; read-only history. */
export function PerformanceDetailPage({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const evaluation = snapshot.performance.find((item) => item.id === id);
  const employee = evaluation && employeeById(snapshot, evaluation.employeeId);
  if (!evaluation || !employee) return <NotFound what="Evaluation" backHref="/performance" backLabel="Back to Performance Review" />;
  const scorecard = scorecardsOf(snapshot, employee.id).find((item) => item.period === evaluation.period);
  const needs = developmentNeeds(snapshot).filter((item) => item.sourceType === "performance_context" && item.sourceRef === evaluation.id);

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Review", href: "/performance" }, { label: "Evaluasi lama" }]} backHref={`/performance/history/${employee.id}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee), `Period ${formatPeriod(evaluation.period)}`]}
      status={evaluationStatus(evaluation)}
      actions={<>
        <ButtonLink href={`/performance/history/${employee.id}`} icon={<History className="size-4" />} testId="view-history">View History</ButtonLink>
        {scorecard && <ButtonLink href={`/performance/scorecard/${scorecard.id}`} icon={<Target className="size-4" />}>Performance Review</ButtonLink>}
      </>} />
    <Notice tone="info">Evaluasi ini dicatat sebelum KPI dan Notes digabung menjadi satu Performance Review. Data lama hanya dapat dibaca.</Notice>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title="Evaluation summary" testId="evaluation-summary">
        <InfoGrid columns={3} items={[
          { label: "Period", testId: "period", value: formatPeriod(evaluation.period) },
          { label: "Evaluation date", testId: "evaluation-date", value: formatDate(evaluation.evaluationDate) },
          { label: "Evaluator", testId: "evaluator", value: evaluation.evaluator || "—" },
          { label: "Department", testId: "department", value: departmentOf(snapshot, employee)?.name ?? "—" },
        ]} />
        <h3 className="mb-2 mt-8 text-sm font-semibold text-ink-2">Notes</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-2">{evaluation.generalNotes || "Belum ada notes."}</p>
      </Card>
      <div className="space-y-6">
        <Card title="Reference" testId="evidence">
          <p className="text-sm text-ink-2">{evaluation.evidenceReference || "Belum ada reference."}</p>
          <p className="mt-1 text-xs text-ink-3">Recorded by {evaluation.actor} · {formatDate(evaluation.createdAt)}</p>
        </Card>
        {needs.length > 0 && <Card title="Related records" testId="related-records">
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
  const [adding, setAdding] = useState(false);
  const employee = employeeById(snapshot, employeeId);
  const catalog = catalogSet && catalogFor(catalogSet, thisMonth());
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Employee" backHref="/performance" backLabel="Back to Performance Review" />;
  const scorecards = scorecardsOf(snapshot, employee.id);
  const evaluations = evaluationsOf(snapshot, employee.id);
  const title = positionOf(snapshot, employee)?.title;
  const linkedNeeds = developmentNeeds(snapshot).filter((need) => need.employeeId === employee.id && need.sourceType === "performance_context");
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Review", href: "/performance" }, { label: "History" }]} backHref="/performance"
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee), `${scorecards.length} penilaian`]}
      actions={canAssess(snapshot, employee.id) && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-penilaian">Add Performance Review</Button>} />
    {title && catalogSet && !(catalog && roleForPosition(catalog, employee.positionId)) && <Notice tone="warning">{noKpiText(catalog?.version)}</Notice>}
    <Card title="Riwayat Performance Review" testId="scorecard-history">
      <Timeline empty="Pegawai ini belum memiliki Performance Review." entries={scorecards.map((item) => ({
        id: item.id, date: `${formatPeriod(item.period)} · ${formatDate(item.evaluationDate || item.createdAt)}`,
        title: `${item.roleName} — ${formatScorecard(item)}${revisionTag(scorecards, item)}`, status: scorecardStatus(item), actor: item.actor, href: `/performance/scorecard/${item.id}`,
        body: `Catalog ${item.definitionVersion} · Penilai ${item.evaluatorName || "—"}${item.generalNotes ? ` · ${item.generalNotes}` : ""}`,
      }))} />
    </Card>
    {evaluations.length > 0 && <Card title="Evaluasi lama (sebelum digabung)" testId="evaluation-history">
      <Timeline empty="" entries={evaluations.map((item) => ({
        id: item.id, date: `${formatPeriod(item.period)} · ${formatDate(item.evaluationDate || item.createdAt)}`,
        title: `Evaluation ${formatPeriod(item.period)}${revisionTag(evaluations, item)}`,
        status: evaluationStatus(item), actor: item.actor, href: `/performance/${item.id}`,
        body: <>Evaluator: {item.evaluator || "—"}{item.generalNotes ? ` · ${item.generalNotes}` : ""}</>,
      }))} />
    </Card>}
    {linkedNeeds.length > 0 && <Card title="Development dari Performance Review" testId="development-linked-to-evaluations">
      <div className="flex flex-wrap gap-2">{linkedNeeds.map((need) => <SourceChip key={need.needId} label={describeSource(snapshot, need).label} reference={need.objective} href={`/development/${need.needId}`} />)}</div>
    </Card>}
    {adding && <KpiFormModal employeeId={employee.id} onClose={() => setAdding(false)} />}
  </>;
}

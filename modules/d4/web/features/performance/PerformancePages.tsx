"use client";

import { History, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import type { PerformanceEvaluation } from "../../../performance/types";
import type { EmployeeReference } from "../../../shared/types";
import { useSnapshot } from "../../data/D4DataProvider";
import { canAssess, canWrite, departmentOf, describeSource, developmentNeeds, employeeById, evaluationsOf, formatDate, formatPeriod, formatResult, includesText, latestEvaluation, periodsOf, positionOf, positionOptions, revisionTag, scorecardsOf, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, SourceChip, statusLabel, StatusBadge } from "../../ui/primitives";
import { EvaluationFormModal } from "./EvaluationFormModal";

const evaluationStatus = (evaluation?: PerformanceEvaluation) => !evaluation ? "Belum dinilai" : evaluation.status === "completed" ? "Completed" : "Draft";

type Row = { employee: EmployeeReference; position: string; evaluation?: PerformanceEvaluation };

export function PerformanceListPage() {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  // null = default cycle (newest period in the data); "" = all periods, each employee's latest record.
  const [periodChoice, setPeriod] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [modalFor, setModalFor] = useState<string | null>(null);

  const periods = useMemo(() => periodsOf(snapshot.performance), [snapshot]);
  const period = periodChoice ?? periods[0] ?? "";
  // FR-D4-001 has no draft; "Draft" and the Status column only appear while legacy draft rows still exist.
  const hasDraft = snapshot.performance.some((item) => item.status !== "completed");
  const statuses = ["Completed", ...(hasDraft ? ["Draft"] : []), "Belum dinilai"];
  const rows = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    const evaluation = period ? evaluationsOf(snapshot, employee.id).find((item) => item.period === period) : latestEvaluation(snapshot, employee.id);
    return { employee, position: positionOf(snapshot, employee)?.title ?? "—", evaluation };
  }).filter((row) => includesText(`${row.employee.fullName} ${row.employee.employeeId}`, search)
    && (!position || row.employee.positionId === position)
    && (!status || evaluationStatus(row.evaluation) === status))
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)), [snapshot, search, position, period, status]);

  return <>
    <PageHeader title="Performance Evaluation" subtitle="Catat dan telusuri evaluasi kinerja per karyawan dan periode."
      actions={writer && <Button icon={<Plus className="size-4" />} onClick={() => setModalFor("")} data-testid="btn-add-evaluation">Tambah Evaluasi</Button>} />
    <FilterBar canReset={Boolean(search || position || periodChoice !== null || status)} onReset={() => { setSearch(""); setPosition(""); setPeriod(null); setStatus(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau ID karyawan" />
      <SelectFilter label="Semua posisi" testId="all-positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />
      <SelectFilter label="Semua periode" testId="latest-period" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      <SelectFilter label="Semua status" testId="all-status" value={status} onChange={setStatus} options={statuses.map((item) => ({ value: item, label: statusLabel(item) }))} />
    </FilterBar>
    <DataTable<Row> rows={rows} noun="karyawan" rowKey={(row) => row.employee.id}
      emptyTitle="Tidak ada karyawan yang cocok" emptyText="Ubah kata kunci atau reset filter untuk melihat seluruh employee."
      rowHref={(row) => row.evaluation ? `/performance/${row.evaluation.id}` : `/performance/history/${row.employee.id}`}
      columns={[
        { key: "employee", header: "Karyawan", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: "Posisi", wrap: true, cell: (row) => row.position },
        { key: "period", header: "Periode", cell: (row) => formatPeriod(row.evaluation?.period) },
        { key: "score", header: "Hasil", className: "tabular-nums", cell: (row) => row.evaluation ? formatResult(row.evaluation.overallScore) : <span className="text-ink-3">Belum dinilai</span> },
        { key: "evaluator", header: "Penilai", cell: (row) => row.evaluation?.evaluator || "—" },
        ...(hasDraft ? [{ key: "status", header: "Status", cell: (row: Row) => <StatusBadge status={evaluationStatus(row.evaluation)} /> }] : []),
      ]}
      actions={(row) => <RowActionMenu label={`Aksi untuk ${row.employee.fullName}`} actions={[
        { label: "Lihat Riwayat", testId: "view-history", icon: <History />, href: `/performance/history/${row.employee.id}` },
        { label: "Buka KPI Scorecard", testId: "open-kpi-scorecard", icon: <Target />, href: `/kpi/history/${row.employee.id}` },
      ]} />} />
    {modalFor !== null && <EvaluationFormModal employeeId={modalFor || undefined} onClose={() => setModalFor(null)} />}
  </>;
}

export function PerformanceDetailPage({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const [adding, setAdding] = useState(false);
  const evaluation = snapshot.performance.find((item) => item.id === id);
  const employee = evaluation && employeeById(snapshot, evaluation.employeeId);
  if (!evaluation || !employee) return <NotFound what="Evaluasi" backHref="/performance" backLabel="Kembali ke Performance Evaluation" />;
  const scorecard = scorecardsOf(snapshot, employee.id).find((item) => item.period === evaluation.period);
  const needs = developmentNeeds(snapshot).filter((item) => item.sourceType === "performance_context" && item.sourceRef === evaluation.id);

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Evaluation", href: "/performance" }, { label: "Detail" }]} backHref="/performance"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, `Periode ${formatPeriod(evaluation.period)}`]}
      status={evaluationStatus(evaluation)}
      actions={<>
        <ButtonLink href={`/performance/history/${employee.id}`} icon={<History className="size-4" />} testId="view-history">Lihat Riwayat</ButtonLink>
        <ButtonLink href={scorecard ? `/kpi/${scorecard.id}` : `/kpi/history/${employee.id}`} icon={<Target className="size-4" />}>KPI Scorecard</ButtonLink>
        {canAssess(snapshot, employee.id) && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-evaluation">Tambah Evaluasi</Button>}
      </>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title="Ringkasan evaluasi" testId="evaluation-summary">
        <InfoGrid columns={3} items={[
          { label: "Periode", testId: "period", value: formatPeriod(evaluation.period) },
          { label: "Tanggal evaluasi", testId: "evaluation-date", value: formatDate(evaluation.evaluationDate) },
          { label: "Penilai", testId: "evaluator", value: evaluation.evaluator || "—" },
          { label: "Hasil evaluasi", value: <strong className="font-display text-lg">{formatResult(evaluation.overallScore)}</strong> },
          { label: "Departemen", testId: "department", value: departmentOf(snapshot, employee)?.name ?? "—" },
        ]} />
        <h3 className="mb-2 mt-8 text-sm font-semibold text-ink-2">Catatan evaluasi</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-2">{evaluation.generalNotes || "Belum ada catatan evaluasi."}</p>
      </Card>
      <div className="space-y-6">
        <Card title="Bukti" testId="evidence">
          <p className="text-sm text-ink-2">{evaluation.evidenceReference || "Belum ada bukti/reference."}</p>
          <p className="mt-1 text-xs text-ink-3">Dicatat oleh {evaluation.actor} · {formatDate(evaluation.createdAt)}</p>
        </Card>
        <Card title="Data terkait" testId="related-records">
          <div className="flex flex-col items-start gap-2">
            {scorecard ? <SourceChip label="KPI Scorecard" reference={formatPeriod(scorecard.period)} href={`/kpi/${scorecard.id}`} /> : <p className="text-sm text-ink-3">Belum ada KPI scorecard untuk periode ini.</p>}
            {needs.map((need) => <SourceChip key={need.needId} label="Development Requirement" reference={need.objective} href={`/development/${need.needId}`} />)}
          </div>
          <p className="mt-4 text-xs text-ink-3">Evaluasi menjadi konteks development bila relevan; tidak ada keputusan HR otomatis dari skor.</p>
        </Card>
      </div>
    </div>
    {adding && <EvaluationFormModal employeeId={employee.id} onClose={() => setAdding(false)} />}
  </>;
}

export function PerformanceHistoryPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Karyawan" backHref="/performance" backLabel="Kembali ke Performance Evaluation" />;
  const evaluations = evaluationsOf(snapshot, employee.id);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Performance Evaluation", href: "/performance" }, { label: "Riwayat" }]} backHref="/performance"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, `${evaluations.length} evaluasi`]}
      actions={<ButtonLink href={`/kpi/history/${employee.id}`} icon={<Target className="size-4" />}>KPI Scorecard</ButtonLink>} />
    <Card title="Riwayat evaluasi" testId="evaluation-history">
      <Timeline empty="Karyawan ini belum memiliki evaluasi kinerja." entries={evaluations.map((item) => ({
        id: item.id, date: `${formatPeriod(item.period)} · ${formatDate(item.evaluationDate || item.createdAt)}`,
        title: `Evaluasi ${formatPeriod(item.period)} — ${formatResult(item.overallScore)}${revisionTag(evaluations, item)}`,
        status: evaluationStatus(item), actor: item.actor, href: `/performance/${item.id}`,
        body: <>Evaluator: {item.evaluator || "—"}{item.generalNotes ? ` · ${item.generalNotes}` : ""}</>,
      }))} />
    </Card>
    {developmentNeeds(snapshot).filter((need) => need.employeeId === employee.id && need.sourceType === "performance_context").length > 0 && <Card title="Development terkait evaluasi" testId="development-linked-to-evaluations">
      <div className="flex flex-wrap gap-2">{developmentNeeds(snapshot).filter((need) => need.employeeId === employee.id && need.sourceType === "performance_context").map((need) => <SourceChip key={need.needId} label={describeSource(snapshot, need).label} reference={need.objective} href={`/development/${need.needId}`} />)}</div>
    </Card>}
  </>;
}

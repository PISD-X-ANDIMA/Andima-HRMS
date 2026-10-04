"use client";

import { ClipboardCheck, Eye, FileSearch, History, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { TrainingVersion } from "../../../training/types";
import { useSnapshot } from "../../data/D4DataProvider";
import { canWrite, employeeById, formatDate, formatPeriod, includesText, positionOf, trainingById, trainingHistory, trainings, trainingSource, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, StatusBadge } from "../../ui/primitives";
import { TrainingFormModal, TrainingProgressModal } from "./TrainingModals";

export function TrainingListPage() {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [requirement, setRequirement] = useState("");
  const [adding, setAdding] = useState(false);
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const all = useMemo(() => {
    const visible = new Set(visibleEmployees(snapshot).map((item) => item.id));
    return trainings(snapshot).filter((item) => visible.has(item.employeeId));
  }, [snapshot]);
  const periods = [...new Set(all.map((item) => item.date.slice(0, 7)))].sort().reverse();
  const requirements = [...new Map(all.map((item) => [item.developmentNeedId, trainingSource(snapshot, item)?.objective ?? item.developmentNeedId])).entries()];
  const rows = all.filter((item) => {
    const employee = employeeById(snapshot, item.employeeId);
    return includesText(`${employee?.fullName ?? ""} ${employee?.employeeId ?? ""} ${item.activity}`, search)
      && (!period || item.date.startsWith(period)) && (!status || item.status === status) && (!requirement || item.developmentNeedId === requirement);
  });

  return <>
    <PageHeader title="Training Tracking" subtitle="Lacak training/development dari requirement sumber sampai hasil pelaksanaan."
      actions={writer && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add Training</Button>} />
    <FilterBar canReset={Boolean(search || period || status || requirement)} onReset={() => { setSearch(""); setPeriod(""); setStatus(""); setRequirement(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search employee or training" />
      <SelectFilter label="All periods" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      <SelectFilter label="All status" value={status} onChange={setStatus} options={["Planned", "In Progress", "Completed", "Cancelled"].map((item) => ({ value: item, label: item }))} />
      <SelectFilter label="All source requirements" value={requirement} onChange={setRequirement} options={requirements.map(([value, label]) => ({ value, label }))} />
    </FilterBar>
    <DataTable<TrainingVersion> rows={rows} noun="training records" rowKey={(row) => row.trainingId} rowHref={(row) => `/training/${row.trainingId}`}
      emptyTitle="Belum ada training yang cocok" emptyText="Training dibuat dari development requirement. Ubah filter atau tambah training baru."
      columns={[
        { key: "employee", header: "Employee", cell: (row) => { const employee = employeeById(snapshot, row.employeeId); return <PersonCell name={employee?.fullName ?? "—"} code={employee?.employeeId ?? ""} />; } },
        { key: "activity", header: "Training", wrap: true, cell: (row) => <span className="font-semibold">{row.activity}</span> },
        { key: "source", header: "Source requirement", wrap: true, className: "max-w-[260px]", cell: (row) => <span className="line-clamp-2 text-ink-2">{trainingSource(snapshot, row)?.objective ?? "—"}</span> },
        { key: "date", header: "Date", cell: (row) => formatDate(row.date) },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
      ]}
      actions={(row) => <RowActionMenu label={`Aksi untuk ${row.activity}`} actions={[
        { label: "View Detail", icon: <Eye />, href: `/training/${row.trainingId}` },
        { label: "View History", icon: <History />, href: `/training/${row.trainingId}/history` },
        { label: "Update Progress", icon: <RefreshCw />, onSelect: () => setProgressFor(row.trainingId), hidden: !writer },
        { label: "Open Source Requirement", icon: <FileSearch />, href: `/development/${row.developmentNeedId}` },
      ]} />} />
    {adding && <TrainingFormModal onClose={() => setAdding(false)} />}
    {progressFor && <TrainingProgressModal trainingId={progressFor} onClose={() => setProgressFor(null)} />}
  </>;
}

export function TrainingDetailPage({ trainingId }: { trainingId: string }) {
  const snapshot = useSnapshot();
  const [progressOpen, setProgressOpen] = useState(false);
  const record = trainingById(snapshot, trainingId);
  const employee = record && employeeById(snapshot, record.employeeId);
  if (!record || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Training" backHref="/training" backLabel="Kembali ke Training Tracking" />;
  const need = trainingSource(snapshot, record);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Training Tracking", href: "/training" }, { label: "Detail" }]} backHref="/training"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, record.activity]} status={record.status}
      actions={<>
        <ButtonLink href={`/training/${record.trainingId}/history`} icon={<History className="size-4" />}>View History</ButtonLink>
        {/* Completion never closes the gap; this only leads to the manual reassessment. */}
        {record.status === "Completed" && need?.sourceType === "competency_gap" && <ButtonLink href={`/competency/${employee.id}`} icon={<ClipboardCheck className="size-4" />}>Nilai ulang kompetensi</ButtonLink>}
        {canWrite(snapshot) && <Button icon={<RefreshCw className="size-4" />} onClick={() => setProgressOpen(true)}>Update Progress</Button>}
      </>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title="Training">
        <p className="font-display text-lg text-ink">{record.activity}</p>
        <div className="mt-6"><InfoGrid columns={3} items={[
          { label: "Date", value: formatDate(record.date) },
          { label: "Status", value: <StatusBadge status={record.status} /> },
          { label: "Version", value: String(record.revision) },
          { label: "Result", value: record.result || "Belum dicatat" },
          { label: "Last updated", value: `${formatDate(record.createdAt)} · ${record.actor}` },
        ]} /></div>
        <h3 className="mb-2 mt-8 text-sm font-semibold text-ink-2">Notes</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-2">{record.notes || "—"}</p>
      </Card>
      <div className="space-y-6">
        <Card title="Source requirement">
          {need ? <><SourceChip label="Development Requirement" reference={need.status} href={`/development/${need.needId}`} /><p className="mt-3 text-sm text-ink">{need.objective}</p></> : <p className="text-sm text-ink-3">Requirement sumber tidak tersedia.</p>}
        </Card>
        <Notice tone="warning">Training Completed tidak otomatis mengubah competency gap menjadi terpenuhi. Gap tetap terbuka sampai ada reassessment.</Notice>
      </div>
    </div>
    {progressOpen && <TrainingProgressModal trainingId={record.trainingId} onClose={() => setProgressOpen(false)} />}
  </>;
}

export function TrainingHistoryPage({ trainingId }: { trainingId: string }) {
  const snapshot = useSnapshot();
  const record = trainingById(snapshot, trainingId);
  const employee = record && employeeById(snapshot, record.employeeId);
  if (!record || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Training" backHref="/training" backLabel="Kembali ke Training Tracking" />;
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Training Tracking", href: "/training" }, { label: "History" }]} backHref={`/training/${record.trainingId}`}
      name={employee.fullName} meta={[record.activity]} status={record.status} />
    <Card title="Status history">
      <Timeline empty="Belum ada riwayat status." entries={trainingHistory(snapshot, record.trainingId).map((item) => ({
        id: item.id, date: formatDate(item.createdAt), title: `Versi ${item.revision}`, status: item.status, actor: item.actor,
        body: [item.result && `Hasil: ${item.result}`, item.notes].filter(Boolean).join(" · ") || undefined,
      }))} />
    </Card>
  </>;
}

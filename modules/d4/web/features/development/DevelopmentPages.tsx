"use client";

import { GraduationCap, History, Plus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import type { DevelopmentNeedVersion, DevelopmentSourceType } from "../../../development/types";
import { useSnapshot } from "../../data/D4DataProvider";
import { canWrite, describeSource, developmentById, developmentHistory, developmentNeeds, employeeById, formatDate, formatPeriod, includesText, positionOf, sourceTypeLabel, trainings, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, statusLabel, StatusBadge } from "../../ui/primitives";
import { TrainingFormModal } from "../training/TrainingModals";
import { DevelopmentFormModal, DevelopmentStatusModal } from "./DevelopmentModals";

export function DevelopmentListPage() {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [adding, setAdding] = useState(false);
  const [statusFor, setStatusFor] = useState<string | null>(null);
  const [trainingFor, setTrainingFor] = useState<DevelopmentNeedVersion | null>(null);
  // FR-04.8: filter by employee, source, period (month the requirement was last recorded) and status.
  const periods = useMemo(() => [...new Set(developmentNeeds(snapshot).map((need) => need.createdAt.slice(0, 7)))].sort().reverse(), [snapshot]);
  const rows = useMemo(() => {
    const visible = new Set(visibleEmployees(snapshot).map((item) => item.id));
    return developmentNeeds(snapshot).filter((need) => {
      const employee = employeeById(snapshot, need.employeeId);
      return visible.has(need.employeeId) && includesText(`${employee?.fullName ?? ""} ${employee?.employeeId ?? ""} ${need.objective}`, search)
        && (!sourceType || need.sourceType === sourceType) && (!status || need.status === status) && (!period || need.createdAt.startsWith(period));
    });
  }, [snapshot, search, sourceType, status, period]);

  return <>
    <PageHeader title="Development Requirement" subtitle="Kebutuhan development/training dengan alasan dan sumber yang dapat ditelusuri."
      actions={writer && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-requirement">Tambah Requirement</Button>} />
    <FilterBar canReset={Boolean(search || sourceType || status || period)} onReset={() => { setSearch(""); setSourceType(""); setStatus(""); setPeriod(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Cari karyawan atau tujuan" />
      <SelectFilter label="Semua sumber" testId="all-sources" value={sourceType} onChange={setSourceType} options={(Object.keys(sourceTypeLabel) as DevelopmentSourceType[]).map((key) => ({ value: key, label: sourceTypeLabel[key] }))} />
      <SelectFilter label="Semua status" testId="all-status" value={status} onChange={setStatus} options={["Identified", "Planned", "In Progress", "Completed"].map((item) => ({ value: item, label: statusLabel(item) }))} />
      <SelectFilter label="Semua periode" testId="all-periods" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
    </FilterBar>
    <DataTable<DevelopmentNeedVersion> rows={rows} noun="requirement" rowKey={(row) => row.needId} rowHref={(row) => `/development/${row.needId}`}
      emptyTitle="Belum ada development requirement" emptyText="Buat requirement dari competency gap, perubahan posisi, atau evaluasi kinerja."
      columns={[
        { key: "employee", header: "Karyawan", cell: (row) => { const employee = employeeById(snapshot, row.employeeId); return <PersonCell name={employee?.fullName ?? "—"} code={employee?.employeeId ?? ""} />; } },
        { key: "objective", header: "Tujuan", wrap: true, className: "max-w-[320px]", cell: (row) => <span className="line-clamp-2">{row.objective}</span> },
        { key: "source", header: "Sumber", cell: (row) => <SourceChip label={sourceTypeLabel[row.sourceType]} /> },
        { key: "priority", header: "Prioritas", cell: (row) => statusLabel(row.priority) },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        { key: "updated", header: "Diperbarui", cell: (row) => formatDate(row.createdAt) },
      ]}
      actions={(row) => <RowActionMenu label={`Aksi untuk ${row.objective}`} actions={[
        { label: "Lihat Riwayat", testId: "view-history", icon: <History />, href: `/development/${row.needId}/history` },
        { label: "Buat Training", testId: "create-training", icon: <GraduationCap />, onSelect: () => setTrainingFor(row), hidden: !writer || row.status === "Completed" },
        { label: "Ubah Status", testId: "update-status", icon: <RefreshCw />, onSelect: () => setStatusFor(row.needId), hidden: !writer },
      ]} />} />
    {adding && <DevelopmentFormModal onClose={() => setAdding(false)} />}
    {statusFor && <DevelopmentStatusModal needId={statusFor} onClose={() => setStatusFor(null)} />}
    {trainingFor && <TrainingFormModal employeeId={trainingFor.employeeId} developmentNeedId={trainingFor.needId} onClose={() => setTrainingFor(null)} />}
  </>;
}

export function DevelopmentDetailPage({ needId }: { needId: string }) {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const [statusOpen, setStatusOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const need = developmentById(snapshot, needId);
  const employee = need && employeeById(snapshot, need.employeeId);
  if (!need || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Development requirement" backHref="/development" backLabel="Kembali ke Development Requirement" />;
  const source = describeSource(snapshot, need);
  const linked = trainings(snapshot).filter((item) => item.developmentNeedId === need.needId);
  const history = developmentHistory(snapshot, need.needId);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Development Requirement", href: "/development" }, { label: "Detail" }]} backHref="/development"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, `Revisi ${need.revision}`]} status={need.status}
      actions={<>
        <ButtonLink href={`/development/${need.needId}/history`} icon={<History className="size-4" />} testId="view-history">Lihat Riwayat</ButtonLink>
        {writer && <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => setStatusOpen(true)} data-testid="btn-update-status">Ubah Status</Button>}
        {/* A completed requirement cannot take new training (assertNeedOpen). */}
        {writer && need.status !== "Completed" && <Button icon={<GraduationCap className="size-4" />} onClick={() => setTrainingOpen(true)} data-testid="btn-create-training">Buat Training</Button>}
      </>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title="Requirement">
        <p className="font-display text-lg text-ink">{need.objective}</p>
        <div className="mt-6"><InfoGrid columns={3} items={[
          { label: "Prioritas", testId: "priority", value: statusLabel(need.priority) },
          { label: "Status", value: <StatusBadge status={need.status} /> },
          { label: "Terakhir diperbarui", testId: "last-updated", value: `${formatDate(need.createdAt)} · ${need.actor}` },
          { label: "Dibuat", testId: "created", value: formatDate(history[history.length - 1]?.createdAt) },
          { label: "Revisi", testId: "revisions", value: String(history.length) },
        ]} /></div>
        <h3 className="mb-2 mt-8 text-sm font-semibold text-ink-2">Catatan</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-2">{need.notes || "—"}</p>
      </Card>
      <div className="space-y-6">
        <Card title="Sumber (keterlacakan)" testId="source-traceability">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">{sourceTypeLabel[need.sourceType]}</p>
          <div className="mt-2"><SourceChip label={source.label} href={source.href} /></div>
          <p className="mt-4 text-xs text-ink-3">Requirement tetap terhubung ke sumber aslinya meskipun posisi karyawan berubah.</p>
        </Card>
        <Card title="Training terkait" testId="linked-training">
          {linked.length ? <div className="flex flex-col items-start gap-2">{linked.map((item) => <SourceChip key={item.trainingId} label={item.activity} reference={statusLabel(item.status)} href={`/training/${item.trainingId}`} />)}</div>
            : <p className="text-sm text-ink-3">Belum ada training untuk requirement ini.</p>}
        </Card>
      </div>
    </div>
    <Notice>Status development atau training yang selesai tidak menutup competency gap secara otomatis; reassessment tetap dilakukan manusia.</Notice>
    {statusOpen && <DevelopmentStatusModal needId={need.needId} onClose={() => setStatusOpen(false)} />}
    {trainingOpen && <TrainingFormModal employeeId={need.employeeId} developmentNeedId={need.needId} onClose={() => setTrainingOpen(false)} />}
  </>;
}

export function DevelopmentHistoryPage({ needId }: { needId: string }) {
  const snapshot = useSnapshot();
  const need = developmentById(snapshot, needId);
  const employee = need && employeeById(snapshot, need.employeeId);
  if (!need || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Development requirement" backHref="/development" backLabel="Kembali ke Development Requirement" />;
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Development Requirement", href: "/development" }, { label: "Riwayat" }]} backHref={`/development/${need.needId}`}
      name={employee.fullName} meta={[need.objective]} status={need.status} />
    <Card title="Riwayat revisi" testId="revision-history">
      <Timeline empty="Belum ada revisi." entries={developmentHistory(snapshot, need.needId).map((item) => ({
        id: item.id, date: formatDate(item.createdAt), title: `Revisi ${item.revision}`, status: item.status, actor: item.actor, body: item.notes || undefined,
      }))} />
    </Card>
  </>;
}

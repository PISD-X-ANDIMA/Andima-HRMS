"use client";

import { ClipboardCheck, Eye, GraduationCap, History, Pencil, Plus, RefreshCw, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import type { DevelopmentNeedVersion, DevelopmentSourceType } from "../../../development/types";
import { useSnapshot } from "../../data/D4DataProvider";
import { canWrite, describeSource, developmentById, developmentHistory, developmentNeeds, employeeById, employeeMeta, formatDate, formatPeriod, REASSESSMENT_PENDING, reassessmentFor, revisionChanges, sourceTypeLabel, trainings, visibleEmployees, type Snapshot } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, SourceChip, statusLabel, StatusBadge } from "../../ui/primitives";
import { TrainingFormModal } from "../training/TrainingModals";
import { DevelopmentEditModal, DevelopmentFormModal, DevelopmentStatusModal, ReassessmentModal } from "./DevelopmentModals";
import { competencyOptions } from "../competency/rows";
import { developmentRows } from "./rows";

/**
 * Reassessment result of a need, or nothing while it is still open.
 * `compact`: a short line in the list's Action column, which may wrap so the table still fits a laptop.
 */
export function ReassessmentBadge({ snapshot, needId, compact }: { snapshot: Snapshot; needId: string; compact?: boolean }) {
  const state = reassessmentFor(snapshot, needId);
  if (!state) return null;
  const status = state === "pending" ? REASSESSMENT_PENDING : state;
  return compact
    ? <span data-testid="reassessment-result" className="block max-w-28 text-xs leading-4 text-ink-2">{statusLabel(status)}</span>
    : <span data-testid="reassessment-result"><StatusBadge status={status} /></span>;
}

/**
 * Action column of the list (Q10): a Completed requirement waiting for HR's decision gets the Record Reassessment
 * button; once recorded, the decision shows here instead (Retraining stays until the requirement is Completed again).
 * The button wraps to two lines so the column stays narrow; changing a recorded decision goes through the ⋮ menu.
 */
function ReassessmentAction({ snapshot, needId, writer, onRecord }: { snapshot: Snapshot; needId: string; writer: boolean; onRecord: () => void }) {
  const state = reassessmentFor(snapshot, needId);
  if (state === "pending" && writer) return <button type="button" data-testid="btn-row-record-reassessment" onClick={onRecord}
    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-left text-xs font-semibold leading-4 text-primary-600 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
    <Scale aria-hidden="true" className="size-3.5 shrink-0" />Record Reassessment</button>;
  return state ? <ReassessmentBadge snapshot={snapshot} needId={needId} compact /> : <span className="text-ink-3">—</span>;
}

export function DevelopmentListPage() {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [competency, setCompetency] = useState("");
  const [priority, setPriority] = useState("");
  const [adding, setAdding] = useState(false);
  const [statusFor, setStatusFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [reassessFor, setReassessFor] = useState<string | null>(null);
  const [trainingFor, setTrainingFor] = useState<DevelopmentNeedVersion | null>(null);
  // FR-04.8: filter by employee, source, period (month the requirement was last recorded) and status; FR-D4-002 B adds competency and priority.
  const periods = useMemo(() => [...new Set(developmentNeeds(snapshot).map((need) => need.createdAt.slice(0, 7)))].sort().reverse(), [snapshot]);
  const rows = useMemo(() => developmentRows(snapshot, { search, department, sourceType, status, period, competency, priority }), [snapshot, search, department, sourceType, status, period, competency, priority]);

  return <>
    <PageHeader title="Development Requirement" subtitle="Kebutuhan development dan training dengan alasan dan sumber yang dapat ditelusuri."
      actions={writer && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-requirement">Add Requirement</Button>} />
    <FilterBar canReset={Boolean(search || department || sourceType || status || period || competency || priority)} onReset={() => { setSearch(""); setDepartment(""); setSourceType(""); setStatus(""); setPeriod(""); setCompetency(""); setPriority(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or position" />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All departments" testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label="All sources" testId="all-sources" value={sourceType} onChange={setSourceType} options={(Object.keys(sourceTypeLabel) as DevelopmentSourceType[]).map((key) => ({ value: key, label: sourceTypeLabel[key] }))} />
      <SelectFilter label="All periods" testId="all-periods" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item) }))} />
      <SelectFilter label="All status" testId="all-status" value={status} onChange={setStatus} options={["Identified", "Planned", "In Progress", "Completed"].map((item) => ({ value: item, label: statusLabel(item) }))} />
      <SelectFilter label="All competencies" testId="all-competencies" value={competency} onChange={setCompetency} options={competencyOptions(snapshot)} />
      <SelectFilter label="All priorities" testId="all-priorities" value={priority} onChange={setPriority} options={["High", "Medium", "Low"].map((item) => ({ value: item, label: statusLabel(item) }))} />
    </FilterBar>
    <DataTable<DevelopmentNeedVersion> rows={rows} noun="requirements" rowKey={(row) => row.needId}
      emptyTitle="Belum ada development requirement" emptyText="Buat dari gap kompetensi, perubahan posisi, atau evaluasi performance."
      columns={[
        { key: "employee", header: "Employee", cell: (row) => { const employee = employeeById(snapshot, row.employeeId); return <PersonCell name={employee?.fullName ?? "—"} code={employee?.employeeId ?? ""} />; } },
        // The source sits under the objective it explains, so the Action column fits 1280 px without scrolling (Q10).
        { key: "objective-source", header: "Objective / Source", wrap: true, className: "max-w-[320px]", cell: (row) => <>
          <span data-testid="cell-objective" className="line-clamp-2">{row.objective}</span>
          <span data-testid="cell-source" className="mt-1.5 block"><SourceChip label={sourceTypeLabel[row.sourceType]} /></span>
        </> },
        { key: "priority", header: "Priority", cell: (row) => statusLabel(row.priority) },
        // One column, as Position / Department on the People Dashboard, so the table fits a laptop screen.
        { key: "method-pic", header: "Method / PIC", wrap: true, className: "max-w-[160px]", cell: (row) => <>
          <span data-testid="cell-method" className="block">{row.method || "—"}</span>
          <span data-testid="cell-pic" className="block text-xs text-ink-3">{row.pic || "—"}</span>
        </> },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        { key: "action", header: "Action", wrap: true, cell: (row) => <ReassessmentAction snapshot={snapshot} needId={row.needId} writer={writer} onRecord={() => setReassessFor(row.needId)} /> },
        // Below 1400 px the date gives way (it is also on the detail page), so Method / PIC stays visible for the "Tanpa PIC" alert.
        { key: "updated", header: "Updated", secondary: true, cell: (row) => formatDate(row.createdAt) },
      ]}
      actions={(row) => <RowActionMenu label={`Actions for ${row.objective}`} actions={[
        { label: "View Detail", testId: "view-detail", icon: <Eye />, href: `/development/${row.needId}` },
        { label: "View History", testId: "view-history", icon: <History />, href: `/development/${row.needId}/history` },
        { label: "Create Training", testId: "create-training", icon: <GraduationCap />, onSelect: () => setTrainingFor(row), hidden: !writer || row.status === "Completed" },
        { label: "Update Status", testId: "update-status", icon: <RefreshCw />, onSelect: () => setStatusFor(row.needId), hidden: !writer },
        { label: "Edit Requirement", testId: "edit-requirement", icon: <Pencil />, onSelect: () => setEditFor(row.needId), hidden: !writer },
        { label: "Record Reassessment", testId: "record-reassessment", icon: <Scale />, onSelect: () => setReassessFor(row.needId), hidden: !writer || row.status !== "Completed" },
      ]} />} />
    {adding && <DevelopmentFormModal onClose={() => setAdding(false)} />}
    {statusFor && <DevelopmentStatusModal needId={statusFor} onClose={() => setStatusFor(null)} />}
    {editFor && <DevelopmentEditModal needId={editFor} onClose={() => setEditFor(null)} />}
    {reassessFor && <ReassessmentModal needId={reassessFor} onClose={() => setReassessFor(null)} />}
    {trainingFor && <TrainingFormModal employeeId={trainingFor.employeeId} developmentNeedId={trainingFor.needId} onClose={() => setTrainingFor(null)} />}
  </>;
}

export function DevelopmentDetailPage({ needId }: { needId: string }) {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reassessOpen, setReassessOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const need = developmentById(snapshot, needId);
  const employee = need && employeeById(snapshot, need.employeeId);
  if (!need || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Development requirement" backHref="/development" backLabel="Back to Development Requirement" />;
  const source = describeSource(snapshot, need);
  const linked = trainings(snapshot).filter((item) => item.developmentNeedId === need.needId);
  const history = developmentHistory(snapshot, need.needId);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Development Requirement", href: "/development" }, { label: "Detail" }]} backHref="/development"
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee), `Revision ${need.revision}`]} status={need.status}
      actions={<>
        <ButtonLink href={`/development/${need.needId}/history`} icon={<History className="size-4" />} testId="view-history">View History</ButtonLink>
        {writer && <Button icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)} data-testid="btn-edit-requirement">Edit Requirement</Button>}
        {writer && <Button icon={<RefreshCw className="size-4" />} onClick={() => setStatusOpen(true)} data-testid="btn-update-status">Update Status</Button>}
        {/* A completed requirement cannot take new training (assertNeedOpen). */}
        {writer && need.status !== "Completed" && <Button icon={<GraduationCap className="size-4" />} onClick={() => setTrainingOpen(true)} data-testid="btn-create-training">Create Training</Button>}
        {/* Completed does not close the gap by itself: the next step is a fresh competency assessment. */}
        {writer && need.status === "Completed" && <ButtonLink href={`/competency/${employee.id}`} icon={<ClipboardCheck className="size-4" />} testId="reassess-competency">Reassess Competency</ButtonLink>}
        {writer && need.status === "Completed" && <Button icon={<Scale className="size-4" />} onClick={() => setReassessOpen(true)} data-testid="btn-record-reassessment">Record Reassessment</Button>}
      </>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title="Requirement">
        <p className="font-display font-semibold text-lg text-ink">{need.objective}</p>
        <div className="mt-6"><InfoGrid columns={3} items={[
          { label: "Priority", testId: "priority", value: statusLabel(need.priority) },
          { label: "Method", testId: "method", value: need.method || "—" },
          { label: "PIC", testId: "pic", value: need.pic || "—" },
          { label: "Status", value: <StatusBadge status={need.status} /> },
          { label: "Reassessment", testId: "reassessment", value: reassessmentFor(snapshot, need.needId) ? <ReassessmentBadge snapshot={snapshot} needId={need.needId} /> : "—" },
          { label: "Last updated", testId: "last-updated", value: `${formatDate(need.createdAt)} · ${need.actor}` },
          { label: "Created", testId: "created", value: formatDate(history[history.length - 1]?.createdAt) },
          { label: "Revisions", testId: "revisions", value: String(history.length) },
        ]} /></div>
        <h3 className="mb-2 mt-8 text-sm font-semibold text-ink-2">Notes</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-2">{need.notes || "—"}</p>
      </Card>
      <div className="space-y-6">
        <Card title="Source (traceability)" testId="source-traceability">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">{sourceTypeLabel[need.sourceType]}</p>
          <div className="mt-2"><SourceChip label={source.label} href={source.href} /></div>
          <p className="mt-4 text-xs text-ink-3">Requirement tetap terhubung ke sumber aslinya walaupun posisi pegawai berubah.</p>
        </Card>
        <Card title="Linked training" testId="linked-training">
          {linked.length ? <div className="flex flex-col items-start gap-2">{linked.map((item) => <SourceChip key={item.trainingId} label={item.activity} reference={statusLabel(item.status)} href={`/training/${item.trainingId}`} />)}</div>
            : <p className="text-sm text-ink-3">Belum ada training untuk requirement ini.</p>}
        </Card>
      </div>
    </div>
    <Notice>Status development atau training yang selesai tidak otomatis menutup gap kompetensi; gap tetap harus dinilai ulang.</Notice>
    {statusOpen && <DevelopmentStatusModal needId={need.needId} onClose={() => setStatusOpen(false)} />}
    {editOpen && <DevelopmentEditModal needId={need.needId} onClose={() => setEditOpen(false)} />}
    {reassessOpen && <ReassessmentModal needId={need.needId} onClose={() => setReassessOpen(false)} />}
    {trainingOpen && <TrainingFormModal employeeId={need.employeeId} developmentNeedId={need.needId} onClose={() => setTrainingOpen(false)} />}
  </>;
}

export function DevelopmentHistoryPage({ needId }: { needId: string }) {
  const snapshot = useSnapshot();
  const need = developmentById(snapshot, needId);
  const employee = need && employeeById(snapshot, need.employeeId);
  if (!need || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Development requirement" backHref="/development" backLabel="Back to Development Requirement" />;
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Development Requirement", href: "/development" }, { label: "History" }]} backHref={`/development/${need.needId}`}
      name={employee.fullName} meta={employeeMeta(snapshot, employee)} status={need.status} />
    <Card title="Revision history" testId="revision-history">
      <Timeline empty="Belum ada revisi." entries={developmentHistory(snapshot, need.needId).map((item, index, all) => ({
        id: item.id, date: formatDate(item.createdAt), title: `Revision ${item.revision}`, status: item.status, actor: item.actor,
        body: [...revisionChanges(item, all[index + 1]), item.notes].filter(Boolean).join(" · ") || undefined,
      }))} />
    </Card>
  </>;
}

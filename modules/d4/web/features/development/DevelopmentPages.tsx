"use client";

import { useSearchParams } from "next/navigation";
import { CircleCheck, Eye, GraduationCap, History, ListChecks, Pencil, Plus, RefreshCw, Scale } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DevelopmentNeedVersion, DevelopmentSourceType } from "../../../development/types";
import { useSnapshot } from "../../data/D4DataProvider";
import { useLanguage } from "../../i18n/LanguageProvider";
import { canAssess, canWrite, describeSource, developmentById, developmentHistory, developmentNeeds, employeeById, employeeMeta, formatDate, formatDateTime, formatPeriod, nextStep, recentLabel, REASSESSMENT_PENDING, reassessmentFor, revisionChanges, sourceFinding, sourceTypeLabel, trainings, visibleEmployees, type NeedStep, type Snapshot } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, PeriodFilter, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, RecentBadge, SavedNotice, SourceChip, statusLabel, StatusBadge } from "../../ui/primitives";
import { BulkTrainingModal } from "../training/BulkModals";
import { LevelLine, TrainingFormModal, TrainingProgressModal } from "../training/TrainingModals";
import { closeEvidence, CloseAsMetModal, DevelopmentEditModal, DevelopmentFormModal, openTrainingOf } from "./DevelopmentModals";
import { competencyOptions } from "../competency/rows";
import { archivedCount, developmentRows } from "./rows";

/**
 * High priority as a badge, Medium and Low as text, so the requirements a manager must act on first stand out
 * (interview 13 Nov 2026, 1:06:52). `compact`: under the objective, where the Priority column is hidden below 1280 px.
 */
function PriorityCell({ priority, compact }: { priority: DevelopmentNeedVersion["priority"]; compact?: boolean }) {
  const { t } = useLanguage();
  if (priority !== "High") return compact ? null : <>{t(statusLabel(priority))}</>;
  return <span data-testid={compact ? "cell-priority-compact" : "priority-high"} className={compact ? "mt-1.5 block min-[1280px]:hidden" : undefined}><StatusBadge status="High" /></span>;
}


/**
 * Reassessment result of a need, or nothing while it is still open.
 * `compact`: a short line next to the status, which may wrap so the table still fits a laptop.
 */
export function ReassessmentBadge({ snapshot, needId, compact }: { snapshot: Snapshot; needId: string; compact?: boolean }) {
  const { t } = useLanguage();
  const state = reassessmentFor(snapshot, needId);
  if (!state) return null;
  const status = state === "pending" ? REASSESSMENT_PENDING : state;
  return compact
    ? <span data-testid="reassessment-result" className="block max-w-28 text-xs leading-4 text-ink-2">{t(statusLabel(status))}</span>
    : <span data-testid="reassessment-result"><StatusBadge status={status} /></span>;
}

/**
 * Under the status while one of the requirement's trainings waits for HR (result, follow-up or reassessment): a
 * requirement stays In Progress after its training is Completed until Meets requirement is recorded, which the team
 * read as a mismatch with Training Tracking (17 Nov 2026).
 */
function AwaitingDecision({ snapshot, need }: { snapshot: Snapshot; need: DevelopmentNeedVersion }) {
  const { t } = useLanguage();
  return nextStep(snapshot, need).kind === "decide" ? <span data-testid="awaiting-decision" className="mt-1 block text-xs text-ink-2">{t("Menunggu keputusan")}</span> : null;
}

type StepHandlers = { onDecide: (trainingId: string) => void; onCreate: () => void };

/** The button of a step, or null when the step needs none. `row`: the small button of the list. */
function StepButton({ step, row, onDecide, onCreate }: { step: NeedStep; row?: boolean } & StepHandlers) {
  const { t } = useLanguage();
  const action = step.kind === "decide"
    ? step.decision === "result"
      ? { label: t("Record Result"), testId: "record-result", icon: ListChecks, onClick: () => onDecide(step.training.trainingId) }
      : step.decision === "follow-up"
      ? { label: t("Retraining / Follow-up"), testId: "record-follow-up", icon: ListChecks, onClick: () => onDecide(step.training.trainingId) }
      // In the narrow list column the two choices themselves fit; "Reassessment" alone would widen it past 1024 px.
      : { label: row ? "Meets / Retraining" : t("Record Reassessment"), testId: "record-reassessment", icon: Scale, onClick: () => onDecide(step.training.trainingId) }
    : step.kind === "create" ? { label: step.retraining ? t("Create Retraining") : t("Create Training"), testId: "next-create-training", icon: GraduationCap, onClick: onCreate } : null;
  if (!action) return null;
  const Icon = action.icon;
  return row
    ? <button type="button" data-testid={`btn-row-${action.testId}`} onClick={action.onClick}
        className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1.5 text-left text-xs font-semibold leading-4 text-primary-600 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />{action.label}</button>
    : <Button icon={<Icon className="size-4" />} onClick={action.onClick} data-testid={`btn-${action.testId}`}>{action.label}</Button>;
}

/**
 * Next step column (Q10, 10 Nov 2026): what happens next for the requirement, with the button that does it. A decision
 * on a training (Retraining included) opens the same form as Training Tracking, so there is still one way to record it.
 */
function NextStepCell({ snapshot, need, writer, ...handlers }: { snapshot: Snapshot; need: DevelopmentNeedVersion; writer: boolean } & StepHandlers) {
  const { t } = useLanguage();
  const step = nextStep(snapshot, need);
  if (step.kind === "decide") return <div className="space-y-1.5">
    <span className="block text-xs text-ink-2">{step.decision === "result" ? t("Training Completed, hasil belum dicatat") : `Training ${step.decision === "follow-up" ? "Not Passed" : "Passed"}`}</span>
    {writer ? <StepButton step={step} row {...handlers} /> : <span className="block text-xs text-ink-3">{t("Menunggu keputusan HR")}</span>}
  </div>;
  // Two lines rather than a chip, so the training name is not cut to a few letters in this narrow column.
  if (step.kind === "running") return <Link href={`/training/${step.training.trainingId}`} data-testid="link-row-training" className="block rounded-lg text-xs leading-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
    <span className="font-semibold text-primary-600">{step.retraining ? "Retraining" : "Training"}</span><span className="text-ink-3"> · {t(statusLabel(step.training.status))}</span>
    <span className="mt-0.5 line-clamp-2 break-words text-ink-2">{step.training.activity}</span>
  </Link>;
  if (step.kind === "create") return writer ? <StepButton step={step} row {...handlers} /> : <span className="text-xs text-ink-3">{t("Belum ada training")}</span>;
  return step.meets ? <StatusBadge status="Meets requirement" /> : <span className="text-xs text-ink-3">{t("Closed")}</span>;
}

/** The detail page's version of the Next step column: one sentence on what to do, and the same button. */
function NextStepCard({ snapshot, need, writer, ...handlers }: { snapshot: Snapshot; need: DevelopmentNeedVersion; writer: boolean } & StepHandlers) {
  const { t } = useLanguage();
  const step = nextStep(snapshot, need);
  const finding = step.kind === "decide" && step.decision === "reassessment" ? sourceFinding(snapshot, need) : undefined;
  const text = step.kind === "decide"
    ? step.decision === "result"
      ? t("Training \"{activity}\" Completed, tetapi hasilnya belum dicatat sebagai Passed atau Not Passed. Catat hasil dan keputusannya; status requirement mengikuti.", { activity: step.training.activity })
      : step.decision === "follow-up"
      ? t("Training \"{activity}\" Not Passed. Pilih Retraining (training ulang dibuat, status Planned) atau Other follow-up dengan catatan.", { activity: step.training.activity })
      : t("Training \"{activity}\" Passed. Pilih Meets requirement bila level kompetensi sudah memenuhi, atau Retraining bila penilaian ulang di Competency Gap sesudah training masih menunjukkan gap.", { activity: step.training.activity })
    : step.kind === "running"
      ? t("{kind} berjalan: \"{activity}\" ({status}). Perbarui progresnya di Training Tracking; setelah Completed, keputusan berikutnya muncul di sini.", { kind: step.retraining ? "Retraining" : "Training", activity: step.training.activity, status: t(statusLabel(step.training.status)) })
      : step.kind === "create"
        ? step.retraining ? t("Retraining sudah dipilih, tetapi training ulangnya belum dibuat. Buat training ulang untuk requirement ini.") : t("Belum ada training untuk requirement ini. Buat training; status requirement ikut berubah otomatis.")
        : step.meets ? t("Requirement ditutup: Meets requirement.") : t("Requirement ditutup tanpa reassessment.");
  return <Card title={t("Next step")} testId="development-next-step">
    <p data-testid="next-step-text" className="break-words text-sm text-ink-2">{text}</p>
    {finding && <div className="mt-3"><LevelLine finding={finding} /></div>}
    {step.kind === "running" && <div className="mt-3"><SourceChip label={step.retraining ? "Retraining" : "Training"} reference={t(statusLabel(step.training.status))} href={`/training/${step.training.trainingId}`} /></div>}
    {writer && (step.kind === "decide" || step.kind === "create") && <div className="mt-4"><StepButton step={step} {...handlers} /></div>}
  </Card>;
}

export function DevelopmentListPage() {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const writer = canWrite(snapshot);
  // K15: dashboard alerts link here with ?q=<name>. Read from the router: during a client navigation window.location is still the previous page.
  const params = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [now] = useState(Date.now);
  const [department, setDepartment] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [competency, setCompetency] = useState("");
  const [priority, setPriority] = useState("");
  const [adding, setAdding] = useState(false);
  const [closingFor, setClosingFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [trainingFor, setTrainingFor] = useState<DevelopmentNeedVersion | null>(null);
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ needId: string; trainingId?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // FR-04.8: filter by employee, source, period (month the requirement was last recorded) and status; FR-D4-002 B adds competency and priority.
  const periods = useMemo(() => [...new Set(developmentNeeds(snapshot).map((need) => need.createdAt.slice(0, 7)))].sort().reverse(), [snapshot]);
  const rows = useMemo(() => developmentRows(snapshot, { search, department, sourceType, status, period, competency, priority }), [snapshot, search, department, sourceType, status, period, competency, priority]);
  const archived = useMemo(() => archivedCount(snapshot, { search, department, sourceType, status, period, competency, priority }), [snapshot, search, department, sourceType, status, period, competency, priority]);
  const filtered = Boolean(search || department || sourceType || status || period || competency || priority);
  // A Completed requirement takes no new training (assertNeedOpen), and nobody adds training for themselves.
  const selectable = (need: DevelopmentNeedVersion) => need.status !== "Completed" && canAssess(snapshot, need.employeeId);
  const rowLabel = (need: DevelopmentNeedVersion) => `${employeeById(snapshot, need.employeeId)?.fullName ?? "—"} · ${need.objective}`;
  const bulkNeeds = rows.filter((need) => selected.has(need.needId) && selectable(need)).map((need) => ({ key: need.needId, label: rowLabel(need), employeeId: need.employeeId }));
  const savedNeed = saved && developmentNeeds(snapshot).find((need) => need.needId === saved.needId);
  const savedTraining = saved?.trainingId && trainings(snapshot).find((item) => item.trainingId === saved.trainingId);
  const savedName = savedNeed ? employeeById(snapshot, savedNeed.employeeId)?.fullName : "";

  return <>
    <PageHeader title="Development Requirement" subtitle={t("Kebutuhan development dan training dengan alasan dan sumber yang dapat ditelusuri.")}
      actions={writer && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-requirement">{t("Add Requirement")}</Button>} />
    <FilterBar canReset={filtered} onReset={() => { setSearch(""); setDepartment(""); setSourceType(""); setStatus(""); setPeriod(""); setCompetency(""); setPriority(""); }}
      search={<SearchInput value={search} onChange={setSearch} placeholder={t("Search name or position")} />}
      period={<PeriodFilter label={t("Periods")} testId="all-periods" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item, language) }))} />}>
      <SelectFilter label={t("Sources")} testId="all-sources" value={sourceType} onChange={setSourceType} options={(Object.keys(sourceTypeLabel) as DevelopmentSourceType[]).map((key) => ({ value: key, label: t(sourceTypeLabel[key]) }))} />
      <SelectFilter label={t("Status")} testId="all-status" value={status} onChange={setStatus} options={["Identified", "Planned", "In Progress", "Completed"].map((item) => ({ value: item, label: t(statusLabel(item)) }))} />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Departments")} testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label={t("Competencies")} testId="all-competencies" value={competency} onChange={setCompetency} options={competencyOptions(snapshot)} />
      <SelectFilter label={t("Priorities")} testId="all-priorities" value={priority} onChange={setPriority} options={["High", "Medium", "Low"].map((item) => ({ value: item, label: t(statusLabel(item)) }))} />
    </FilterBar>
    {archived > 0 && <p data-testid="archived-hint" className="px-1 text-xs text-ink-2">
      {t("{count} requirement Completed tidak tampil di daftar aktif. Pilih Status Completed di Filter untuk melihatnya.", { count: archived })}
    </p>}
    {savedTraining ? <SavedNotice text={t("Training \"{activity}\" untuk {name} tersimpan.", { activity: savedTraining.activity, name: savedName ?? "" })} href={`/training/${savedTraining.trainingId}`} />
      : savedNeed && <SavedNotice text={t("Development requirement {name} tersimpan ({status}).", { name: savedName ?? "", status: t(statusLabel(savedNeed.status)) })} href={`/development/${savedNeed.needId}`} />}
    <DataTable<DevelopmentNeedVersion> rows={rows} noun="requirements" rowKey={(row) => row.needId} justSaved={savedNeed || undefined}
      emptyTitle={filtered ? t("Tidak ada requirement yang cocok") : archived ? t("Semua requirement sudah Completed") : t("Belum ada development requirement")}
      emptyText={filtered ? t("Ubah kata kunci atau reset filter.") : archived ? t("Pilih Status Completed di Filter untuk melihatnya.") : writer ? t("Buat dari gap kompetensi, perubahan posisi, atau evaluasi performance dengan Add Requirement.") : t("Belum ada development requirement yang tercatat.")}
      selection={writer ? { selected, onChange: setSelected, selectable, rowLabel,
        actions: <Button variant="primary" icon={<GraduationCap className="size-4" />} onClick={() => setBulkOpen(true)} data-testid="btn-bulk-add-training">{t("Add Training")}</Button> } : undefined}
      columns={[
        { key: "employee", header: t("Employee"), cell: (row) => { const employee = employeeById(snapshot, row.employeeId); return <PersonCell name={employee?.fullName ?? "—"} code={employee?.employeeId ?? ""} />; } },
        // The source sits under the objective it explains, so the Action column fits 1280 px without scrolling (Q10).
        { key: "objective-source", header: t("Objective / Source"), wrap: true, className: "max-w-[320px]", cell: (row) => <>
          <span data-testid="cell-objective" className="line-clamp-2">{row.objective}</span>
          <span data-testid="cell-source" className="mt-1.5 block"><SourceChip label={t(sourceTypeLabel[row.sourceType])} /></span>
          <PriorityCell priority={row.priority} compact />
          {/* Under the objective while Last updated is hidden (below 1400 px), as the High badge. */}
          <RecentBadge label={recentLabel(row, now)} testId="label-recent-compact" className="mt-1.5 block min-[1400px]:hidden" />
        </> },
        { key: "priority", header: t("Priority"), optional: true, cell: (row) => <PriorityCell priority={row.priority} /> },
        // One column, as Position / Department on the People Dashboard, so the table fits a laptop screen.
        { key: "method-pic", header: t("Method / PIC"), wrap: true, optional: true, className: "max-w-[160px]", cell: (row) => <>
          <span data-testid="cell-method" className="block">{row.method || "—"}</span>
          <span data-testid="cell-pic" className="block text-xs text-ink-3">{row.pic || "—"}</span>
        </> },
        // Display only: a gap requirement of a former position stays open until HR closes it, so the list says why it looks stuck.
        // Wraps so that note does not widen the column (the badge itself stays on one line).
        { key: "status", header: t("Status"), wrap: true, cell: (row) => <><StatusBadge status={row.status} /><AwaitingDecision snapshot={snapshot} need={row} />{row.sourceType === "competency_gap" && row.status !== "Completed" && !sourceFinding(snapshot, row)
          && <span data-testid="not-in-position" className="mt-1 block text-xs text-ink-2">{t("Not in current position")}</span>}</> },
        { key: "next-step", header: t("Next step"), wrap: true, className: "max-w-[200px]", cell: (row) => <NextStepCell snapshot={snapshot} need={row} writer={canAssess(snapshot, row.employeeId)} onDecide={setProgressFor} onCreate={() => setTrainingFor(row)} /> },
        // The list is sorted by this date (interview 13 Nov 2026, 1:21:38). Below 1400 px it gives way (it is also on the
        // detail page), so Method / PIC stays visible for the "Tanpa PIC" alert.
        { key: "updated", header: t("Last updated"), secondary: true, cell: (row) => <>
          <span className="block">{formatDateTime(row.createdAt, language)}</span>
          <span data-testid="cell-updated-by" className="block text-xs text-ink-3">{row.actor}</span>
          {/* Its own line: beside the time it widened the column and the table scrolled at 1440 px. */}
          <RecentBadge label={recentLabel(row, now)} />
        </> },
      ]}
      actions={(row) => { const step = nextStep(snapshot, row); return <RowActionMenu label={t("Actions for {name}", { name: row.objective })} actions={[
        { label: t("View Detail"), testId: "view-detail", icon: <Eye />, href: `/development/${row.needId}` },
        { label: t("View History"), testId: "view-history", icon: <History />, href: `/development/${row.needId}/history` },
        // One action, one place (13 Nov 2026): what the Next step column already offers (a decision, or the first training)
        // is not repeated here; the menu keeps Create Training only for another training next to a running one.
        { label: t("Create Training"), testId: "create-training", icon: <GraduationCap />, onSelect: () => setTrainingFor(row), hidden: !canAssess(snapshot, row.employeeId) || row.status === "Completed" || step.kind === "create" },
        // 13 Nov 2026: progress is written once, in Training Tracking; this only takes HR there.
        { label: t("Update progress in Training"), testId: "update-progress-in-training", icon: <RefreshCw />, href: `/training/${openTrainingOf(snapshot, row.needId)?.trainingId}`, hidden: !canAssess(snapshot, row.employeeId) || !openTrainingOf(snapshot, row.needId) },
        { label: t("Close as Met"), testId: "close-as-met", icon: <CircleCheck />, onSelect: () => setClosingFor(row.needId), hidden: !canAssess(snapshot, row.employeeId) || Boolean(closeEvidence(snapshot, row).blocked) },
        { label: t("Edit Requirement"), testId: "edit-requirement", icon: <Pencil />, onSelect: () => setEditFor(row.needId), hidden: !canAssess(snapshot, row.employeeId) },
      ]} />; }} />
    {adding && <DevelopmentFormModal onClose={() => setAdding(false)} onSaved={(needId) => setSaved({ needId })} />}
    {closingFor && <CloseAsMetModal needId={closingFor} onClose={() => setClosingFor(null)} onSaved={() => setSaved({ needId: closingFor })} />}
    {editFor && <DevelopmentEditModal needId={editFor} onClose={() => setEditFor(null)} onSaved={() => setSaved({ needId: editFor })} />}
    {trainingFor && <TrainingFormModal employeeId={trainingFor.employeeId} developmentNeedId={trainingFor.needId} onClose={() => setTrainingFor(null)} onSaved={(trainingId) => setSaved({ needId: trainingFor.needId, trainingId })} />}
    {progressFor && <TrainingProgressModal trainingId={progressFor} onClose={() => setProgressFor(null)} />}
    {bulkOpen && <BulkTrainingModal needs={bulkNeeds} onClose={() => setBulkOpen(false)}
      onDone={(outcome) => setSelected((current) => new Set([...current].filter((key) => !outcome.done.includes(key))))} />}
  </>;
}

export function DevelopmentDetailPage({ needId }: { needId: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const [closing, setClosing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const need = developmentById(snapshot, needId);
  const employee = need && employeeById(snapshot, need.employeeId);
  if (!need || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Development requirement" backHref="/development" backLabel={t("Back to Development Requirement")} />;
  // Nobody follows up their own requirement (SR-D4-EMP-23).
  const writer = canAssess(snapshot, need.employeeId);
  const source = describeSource(snapshot, need, t);
  const linked = trainings(snapshot).filter((item) => item.developmentNeedId === need.needId);
  const open = openTrainingOf(snapshot, need.needId);
  const history = developmentHistory(snapshot, need.needId);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Development Requirement", href: "/development" }, { label: t("Detail") }]} backHref="/development"
      name={employee.fullName} meta={employeeMeta(snapshot, employee, t)} status={need.status}
      actions={<>
        <ButtonLink href={`/development/${need.needId}/history`} icon={<History className="size-4" />} testId="view-history">{t("View History")}</ButtonLink>
        {writer && <Button icon={<Pencil className="size-4" />} onClick={() => setEditOpen(true)} data-testid="btn-edit-requirement">{t("Edit Requirement")}</Button>}
        {/* 13 Nov 2026: progress is written once, in Training Tracking. A completed requirement takes no new training (assertNeedOpen). */}
        {writer && open && <ButtonLink href={`/training/${open.trainingId}`} icon={<RefreshCw className="size-4" />} testId="btn-update-progress-in-training">{t("Update progress in Training")}</ButtonLink>}
        {/* Not twice on one screen: with no training yet, the Next step card below holds this button. */}
        {writer && need.status !== "Completed" && nextStep(snapshot, need).kind !== "create" && <Button icon={<GraduationCap className="size-4" />} onClick={() => setTrainingOpen(true)} data-testid="btn-create-training">{t("Create Training")}</Button>}
        {writer && !closeEvidence(snapshot, need).blocked && <Button icon={<CircleCheck className="size-4" />} onClick={() => setClosing(true)} data-testid="btn-close-as-met">{t("Close as Met")}</Button>}
      </>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title="Requirement">
        <p className="break-words font-display font-semibold text-lg text-ink">{need.objective}</p>
        <div className="mt-6"><InfoGrid columns={3} items={[
          { label: t("Priority"), testId: "priority", value: t(statusLabel(need.priority)) },
          { label: t("Method"), testId: "method", value: need.method || "—" },
          { label: "PIC", testId: "pic", value: need.pic || "—" },
          { label: t("Status"), value: <><StatusBadge status={need.status} /><AwaitingDecision snapshot={snapshot} need={need} /></> },
          { label: "Reassessment", testId: "reassessment", value: reassessmentFor(snapshot, need.needId) ? <ReassessmentBadge snapshot={snapshot} needId={need.needId} /> : "—" },
          { label: t("Last updated"), testId: "last-updated", value: `${formatDateTime(need.createdAt, language)} · ${need.actor}` },
          { label: t("Created"), testId: "created", value: formatDate(history[history.length - 1]?.createdAt, language) },
        ]} /></div>
        <h3 className="mb-2 mt-8 font-display text-sm font-semibold text-ink-2">{t("Notes")}</h3>
        <p className="whitespace-pre-wrap break-words text-sm text-ink-2">{need.notes || "—"}</p>
      </Card>
      <div className="min-w-0 space-y-6">
        <NextStepCard snapshot={snapshot} need={need} writer={writer} onDecide={setProgressFor} onCreate={() => setTrainingOpen(true)} />
        <Card title={t("Source (traceability)")} testId="source-traceability">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">{t(sourceTypeLabel[need.sourceType])}</p>
          <div className="mt-2"><SourceChip label={source.label} href={source.href} /></div>
          <p className="mt-4 text-xs text-ink-3">{t("Requirement tetap terhubung ke sumber aslinya walaupun posisi pegawai berubah.")}</p>
        </Card>
        <Card title={t("Linked training")} testId="linked-training">
          {linked.length ? <div className="flex flex-col items-start gap-2">{linked.map((item) => <SourceChip key={item.trainingId} label={item.activity} reference={t(statusLabel(item.status))} href={`/training/${item.trainingId}`} />)}</div>
            : <p className="text-sm text-ink-3">{t("Belum ada training untuk requirement ini.")}</p>}
        </Card>
      </div>
    </div>
    <Notice>{t("Status requirement mengikuti Training Tracking: training dibuat menjadi Planned, training berjalan menjadi In Progress. Completed hanya lewat training Passed dengan Meets requirement, atau Close as Met saat level di data kompetensi sudah memenuhi. Training yang selesai tidak otomatis menutup gap; gap tetap harus dinilai ulang.")}</Notice>
    {closing && <CloseAsMetModal needId={need.needId} onClose={() => setClosing(false)} />}
    {editOpen && <DevelopmentEditModal needId={need.needId} onClose={() => setEditOpen(false)} />}
    {trainingOpen && <TrainingFormModal employeeId={need.employeeId} developmentNeedId={need.needId} onClose={() => setTrainingOpen(false)} />}
    {progressFor && <TrainingProgressModal trainingId={progressFor} onClose={() => setProgressFor(null)} />}
  </>;
}

export function DevelopmentHistoryPage({ needId }: { needId: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const need = developmentById(snapshot, needId);
  const employee = need && employeeById(snapshot, need.employeeId);
  if (!need || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what="Development requirement" backHref="/development" backLabel={t("Back to Development Requirement")} />;
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Development Requirement", href: "/development" }, { label: t("History") }]} backHref={`/development/${need.needId}`}
      name={employee.fullName} meta={employeeMeta(snapshot, employee, t)} status={need.status} />
    <Card title={t("Development Requirement history")} testId="revision-history">
      <Timeline empty={t("Belum ada revisi.")} entries={developmentHistory(snapshot, need.needId).map((item, index, all) => ({
        id: item.id, date: formatDateTime(item.createdAt, language), title: t("Revision {n}", { n: item.revision }), status: item.status, actor: item.actor,
        body: [...revisionChanges(item, all[index + 1], t), item.notes].filter(Boolean).join(" · ") || undefined,
      }))} />
    </Card>
  </>;
}

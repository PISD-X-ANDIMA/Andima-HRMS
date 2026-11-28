"use client";

import { useSearchParams } from "next/navigation";
import { Eye, FileSearch, History, ListChecks, Plus, RefreshCw, Scale, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import type { TrainingVersion } from "../../../training/types";
import { completedAt, followUpOf } from "../../../shared/rules";
import { msg } from "../../../shared/text";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { byProgress, canAssess, canWrite, developmentNeeds, employeeById, employeeMeta, employeeSearchText, formatDate, formatDateTime, formatPeriod, includesText, recentLabel, sourceFinding, trainingById, trainingDecision, trainingHistory, trainings, trainingSource, visibleEmployees } from "../../data/selectors";
import { useLanguage } from "../../i18n/LanguageProvider";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, PeriodFilter, SearchInput, SelectFilter } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, InfoGrid, Notice, RecentBadge, SavedNotice, SourceChip, statusLabel, StatusBadge } from "../../ui/primitives";
import { ReassessmentBadge } from "../development/DevelopmentPages";
import { BulkProgressModal, BulkTrainingModal } from "./BulkModals";
import { LevelLine, TrainingProgressModal } from "./TrainingModals";
import { isTrainingArchived } from "./rows";

/** Open requirements a training can be added to, by employee name; when joining, not those already on that training (same name and date). */
function openNeedChoices(snapshot: ReturnType<typeof useSnapshot>, join?: TrainingVersion) {
  const visible = new Set(visibleEmployees(snapshot).map((item) => item.id));
  const joined = new Set(join ? trainings(snapshot).filter((item) => item.status !== "Cancelled" && item.date === join.date
    && item.activity.trim().toLowerCase() === join.activity.trim().toLowerCase()).map((item) => item.developmentNeedId) : []);
  return developmentNeeds(snapshot).filter((need) => need.status !== "Completed" && !joined.has(need.needId) && visible.has(need.employeeId) && canAssess(snapshot, need.employeeId))
    .map((need) => ({ key: need.needId, employeeId: need.employeeId, label: `${employeeById(snapshot, need.employeeId)?.fullName ?? "—"} · ${need.objective}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// A result still waiting for HR's decision first (Q16 follow-up, Passed reassessment), then planned and running trainings; finished and cancelled last.
const TRAINING_RANK: Record<string, number> = { Planned: 1, "In Progress": 2, Completed: 3, Cancelled: 4 };

export function TrainingListPage() {
  const snapshot = useSnapshot();
  const { busy } = useD4();
  const { t, language } = useLanguage();
  // K15: dashboard alerts link here with ?q=<name>. Read from the router: during a client navigation window.location is still the previous page.
  const params = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [department, setDepartment] = useState("");
  const [period, setPeriod] = useState("");
  // The People Dashboard "Training in progress" dialog links here with ?status=In%20Progress.
  const [status, setStatus] = useState(() => params.get("status") ?? "");
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [savedId, setSavedId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [now] = useState(Date.now);
  const all = useMemo(() => {
    const visible = new Set(visibleEmployees(snapshot).map((item) => item.id));
    return trainings(snapshot).filter((item) => visible.has(item.employeeId));
  }, [snapshot]);
  const periods = [...new Set(all.map((item) => item.date.slice(0, 7)))].sort().reverse();
  const saved = savedId ? all.find((item) => item.trainingId === savedId) : undefined;
  const matching = all.filter((item) => {
    const employee = employeeById(snapshot, item.employeeId);
    return includesText(`${employeeSearchText(snapshot, employee)} ${item.activity}`, search)
      && (!department || employee?.departmentId === department)
      && (!period || item.date.startsWith(period)) && (!status || item.status === status);
  });
  // Finished trainings show only when the Status filter asks for them; DataTable keeps the one just saved (justSaved).
  const archived = status ? [] : matching.filter((item) => isTrainingArchived(snapshot, item));
  const archivedCompleted = archived.filter((item) => item.status === "Completed").length;
  const archivedCancelled = archived.length - archivedCompleted;
  const rows = matching.filter((item) => status || !isTrainingArchived(snapshot, item))
    .sort(byProgress((item) => trainingDecision(snapshot, item) ? 0 : TRAINING_RANK[item.status] ?? 3,
      (item) => employeeById(snapshot, item.employeeId)?.fullName ?? ""));
  const filtered = Boolean(search || department || period || status);
  // Bulk progress is for trainings still running; a finished one takes its decision per person from its Next step.
  const selectable = (item: TrainingVersion) => (item.status === "Planned" || item.status === "In Progress") && canAssess(snapshot, item.employeeId);
  const rowLabel = (item: TrainingVersion) => `${employeeById(snapshot, item.employeeId)?.fullName ?? "—"} · ${item.activity}`;
  const bulkTrainings = rows.filter((item) => selected.has(item.trainingId) && selectable(item)).map((item) => ({ key: item.trainingId, label: rowLabel(item), detail: `${formatDate(item.date, language)} · ${t(statusLabel(item.status))}`, status: item.status }));

  return <>
    <PageHeader title="Training Tracking" subtitle={t("Pantau training dan development dari requirement sumber sampai hasilnya.")}
      actions={canWrite(snapshot) && <Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)} data-testid="btn-add-training">{t("Add Training")}</Button>} />
    <FilterBar canReset={filtered} onReset={() => { setSearch(""); setDepartment(""); setPeriod(""); setStatus(""); }}
      search={<SearchInput value={search} onChange={setSearch} placeholder={t("Search name or position")} />}
      period={<PeriodFilter label={t("Periods")} testId="all-periods" value={period} onChange={setPeriod} options={periods.map((item) => ({ value: item, label: formatPeriod(item, language) }))} />}>
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Departments")} testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label={t("Status")} testId="all-status" value={status} onChange={setStatus} options={["Planned", "In Progress", "Completed", "Cancelled"].map((item) => ({ value: item, label: t(statusLabel(item)) }))} />
    </FilterBar>
    {/* PST 2: no "Show Completed" link beside the filter; the Status filter is the one way in, and its panel holds Reset. */}
    {archived.length > 0 && <p data-testid="archived-hint" className="px-1 text-xs text-ink-2">
      {archivedCompleted && archivedCancelled
        ? t("{completed} training Completed dan {cancelled} training Cancelled tidak tampil di daftar aktif. Pilih Status di Filter untuk melihatnya.", { completed: archivedCompleted, cancelled: archivedCancelled })
        : archivedCompleted ? t("{count} training Completed tidak tampil di daftar aktif. Pilih Status di Filter untuk melihatnya.", { count: archivedCompleted })
        : t("{count} training Cancelled tidak tampil di daftar aktif. Pilih Status di Filter untuk melihatnya.", { count: archivedCancelled })}
    </p>}
    {/* Update Progress closes before the refresh; until it lands the notice would name the old status. */}
    {saved && !busy && <SavedNotice text={t("Training \"{activity}\" untuk {name} tersimpan ({status}).", { activity: saved.activity, name: employeeById(snapshot, saved.employeeId)?.fullName ?? "", status: t(statusLabel(saved.status)) })} href={`/training/${saved.trainingId}`} />}
    <DataTable<TrainingVersion> rows={rows} noun="trainings" rowKey={(row) => row.trainingId} justSaved={saved}
      emptyTitle={filtered ? t("Tidak ada training yang cocok") : archived.length ? t("Semua training sudah selesai") : t("Belum ada training")}
      emptyText={filtered ? t("Ubah kata kunci atau reset filter.") : archived.length ? t("Pilih Status Completed atau Cancelled di Filter untuk melihatnya.") : canWrite(snapshot) ? t("Buat dengan Add Training: pilih requirement setiap pegawai yang ikut.") : t("Belum ada training yang tercatat.")}
      selection={canWrite(snapshot) ? { selected, onChange: setSelected, selectable, rowLabel,
        actions: <Button variant="primary" icon={<RefreshCw className="size-4" />} onClick={() => setBulkOpen(true)} data-testid="btn-bulk-update-progress">{t("Update Progress")}</Button> } : undefined}
      columns={[
        { key: "employee", header: t("Employee"), cell: (row) => { const employee = employeeById(snapshot, row.employeeId); return <PersonCell name={employee?.fullName ?? "—"} code={employee?.employeeId ?? ""} />; } },
        { key: "activity", header: t("Training"), wrap: true, cell: (row) => <>
          <span className="font-semibold">{row.activity}</span>
          {/* Under the training while Last updated is hidden (below 1400 px), as on Development Requirement. */}
          <RecentBadge label={recentLabel(row, now)} testId="label-recent-compact" className="mt-1.5 block min-[1400px]:hidden" />
        </> },
        { key: "source", header: t("Source requirement"), wrap: true, optional: true, className: "max-w-[260px]", cell: (row) => <span className="line-clamp-2 text-ink-2">{trainingSource(snapshot, row)?.objective ?? "—"}</span> },
        // "Training date" is when the training takes place; Last updated is when its record last changed.
        { key: "date", header: t("Training date"), cell: (row) => formatDate(row.date, language) },
        { key: "status", header: t("Status"), cell: (row) => <StatusBadge status={row.status} /> },
        // Below 1400 px it gives way (it is on the detail page too): with it the table scrolled at 1280 and 768 px.
        { key: "updated", header: t("Last updated"), secondary: true, cell: (row) => <>
          <span className="block">{formatDateTime(row.createdAt, language)}</span>
          <span data-testid="cell-updated-by" className="block text-xs text-ink-3">{row.actor}</span>
          <RecentBadge label={recentLabel(row, now)} />
        </> },
      ]}
      actions={(row) => <RowActionMenu label={t("Actions for {name}", { name: row.activity })} actions={[
        { label: t("View Detail"), testId: "view-detail", icon: <Eye />, href: `/training/${row.trainingId}` },
        { label: t("View History"), testId: "view-history", icon: <History />, href: `/training/${row.trainingId}/history` },
        { label: t("Update Progress"), testId: "update-progress", icon: <RefreshCw />, onSelect: () => setProgressFor(row.trainingId), hidden: !canAssess(snapshot, row.employeeId) },
        { label: t("Open Source Requirement"), testId: "open-source-requirement", icon: <FileSearch />, href: `/development/${row.developmentNeedId}` },
      ]} />} />
    {progressFor && <TrainingProgressModal trainingId={progressFor} onClose={() => setProgressFor(null)} onSaved={() => setSavedId(progressFor)} />}
    {adding && <BulkTrainingModal choices={openNeedChoices(snapshot)} onClose={() => setAdding(false)} />}
    {bulkOpen && <BulkProgressModal trainings={bulkTrainings} onClose={() => setBulkOpen(false)}
      onDone={(outcome) => setSelected((current) => new Set([...current].filter((key) => !outcome.done.includes(key))))} />}
  </>;
}

export function TrainingDetailPage({ trainingId }: { trainingId: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const [progressOpen, setProgressOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const record = trainingById(snapshot, trainingId);
  const employee = record && employeeById(snapshot, record.employeeId);
  if (!record || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what={t("Training")} backHref="/training" backLabel={t("Back to Training Tracking")} />;
  const need = trainingSource(snapshot, record);
  // Q16: a Not Passed result waits for HR's follow-up; Retraining links to the trainings created with it.
  const notPassed = record.status === "Completed" && record.result === "Not Passed";
  const versions = trainingHistory(snapshot, record.trainingId);
  const followUp = followUpOf(versions) && versions.find((item) => item.followUp);
  const retrainings = followUp?.followUp === "Retraining" ? trainings(snapshot).filter((item) => item.developmentNeedId === record.developmentNeedId && item.trainingId !== record.trainingId
    && (trainingHistory(snapshot, item.trainingId).at(-1)?.createdAt ?? "") >= followUp.createdAt) : [];
  const pending = trainingDecision(snapshot, record);
  // Passed + Retraining: the trainings of the next round, created after this pass.
  const passedAt = record.status === "Completed" && record.result === "Passed" ? completedAt(versions) ?? "" : "";
  const nextRound = passedAt ? trainings(snapshot).filter((item) => item.developmentNeedId === record.developmentNeedId && item.trainingId !== record.trainingId
    && (trainingHistory(snapshot, item.trainingId).at(-1)?.createdAt ?? "") > passedAt) : [];
  const finding = need && sourceFinding(snapshot, need);
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Training Tracking", href: "/training" }, { label: t("Detail") }]} backHref="/training"
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee, t), record.activity]} status={record.status}
      actions={<>
        <ButtonLink href={`/training/${record.trainingId}/history`} icon={<History className="size-4" />} testId="view-history">{t("View History")}</ButtonLink>
        {/* PST 2: a colleague joins by getting the same training on their own requirement; a finished training takes nobody new. */}
        {canWrite(snapshot) && (record.status === "Planned" || record.status === "In Progress") && <Button variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => setJoining(true)} data-testid="btn-add-participants">{t("Add Participants")}</Button>}
        {/* V2: while the Next step card holds the primary action, this one steps back. */}
        {canAssess(snapshot, record.employeeId) && <Button variant={pending ? "secondary" : "primary"} icon={<RefreshCw className="size-4" />} onClick={() => setProgressOpen(true)} data-testid="btn-update-progress">{t("Update Progress")}</Button>}
      </>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <Card title={t("Training")}>
        <p className="break-words font-display font-semibold text-lg text-ink">{record.activity}</p>
        <div className="mt-6"><InfoGrid columns={3} items={[
          { label: t("Training date"), testId: "date", value: formatDate(record.date, language) },
          { label: t("Status"), value: <StatusBadge status={record.status} /> },
          { label: t("Result"), testId: "result", value: record.result ? t(record.result) : t("Not recorded yet") },
          { label: t("Last updated"), testId: "last-updated", value: `${formatDateTime(record.createdAt, language)} · ${record.actor}` },
        ]} /></div>
        <h3 className="mb-2 mt-8 font-display text-sm font-semibold text-ink-2">{t("Notes")}</h3>
        <p className="whitespace-pre-wrap break-words text-sm text-ink-2">{record.notes || "—"}</p>
      </Card>
      <div className="min-w-0 space-y-6">
        {/* Q14/Q16: the decision after a result is recorded here, in the same Update Progress form. */}
        {pending && <Card title={t("Next step")} testId="training-next-step">
          {pending === "result"
            ? <Notice tone="warning"><strong>{t("Hasil belum dicatat.")}</strong> {t("Training ini Completed tanpa hasil Passed atau Not Passed. Catat hasil dan keputusannya lewat Update Progress.")}</Notice>
            : pending === "follow-up"
            ? <Notice tone="warning"><strong>{t("Awaiting follow-up.")}</strong> {t("Hasil Not Passed wajib ditindaklanjuti HR: Retraining, atau Other follow-up (coaching, rotasi, eskalasi ke atasan) dengan catatan.")}</Notice>
            : <div className="space-y-3">
                <p className="text-sm text-ink-2">{t("Training Passed. Catat hasil reassessment: Meets requirement bila level kompetensinya sudah memenuhi, atau Retraining bila penilaian ulang di Competency Gap sesudah training masih menunjukkan gap.")}</p>
                {finding && <LevelLine finding={finding} employeeId={record.employeeId} />}
              </div>}
          {canAssess(snapshot, record.employeeId) && <div className="mt-4"><Button variant="primary" icon={pending === "reassessment" ? <Scale className="size-4" /> : <ListChecks className="size-4" />} onClick={() => setProgressOpen(true)}
            data-testid={`btn-record-${pending === "result" ? "result" : pending === "follow-up" ? "follow-up" : "reassessment"}`}>{pending === "result" ? t("Record Result") : pending === "follow-up" ? t("Record Follow-up") : t("Record Reassessment")}</Button></div>}
        </Card>}
        {notPassed && followUp && <Card title={t("Follow-up")} testId="training-follow-up">
          <p className="text-sm text-ink"><span data-testid="follow-up-value" className="font-semibold">{followUp.followUp}</span> · {formatDate(followUp.createdAt, language)} · {followUp.actor}</p>
          {followUp.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-2">{followUp.notes}</p>}
          {retrainings.map((item) => <div key={item.trainingId} data-testid={`retraining-${item.trainingId}`} className="mt-3"><SourceChip label="Retraining" reference={`${item.activity} · ${t(statusLabel(item.status))}`} href={`/training/${item.trainingId}`} /></div>)}
        </Card>}
        <Card title={t("Source requirement")} testId="source-requirement">
          {need ? <><SourceChip label="Development Requirement" reference={t(statusLabel(need.status))} href={`/development/${need.needId}`} /><p className="mt-3 text-sm text-ink">{need.objective}</p>
            <div className="mt-3"><ReassessmentBadge snapshot={snapshot} needId={need.needId} /></div>
            {nextRound.map((item) => <div key={item.trainingId} data-testid={`retraining-${item.trainingId}`} className="mt-3"><SourceChip label="Retraining" reference={`${item.activity} · ${t(statusLabel(item.status))}`} href={`/training/${item.trainingId}`} /></div>)}</> : <p className="text-sm text-ink-3">{t("Requirement sumber tidak tersedia.")}</p>}
        </Card>
        {/* Once Completed, the Next step or Follow-up card above already says what comes after. */}
        {record.status !== "Completed" && <Notice tone="warning">{t("Training yang Completed tidak otomatis membuat gap kompetensi terpenuhi. Gap tetap terbuka sampai dinilai ulang.")}</Notice>}
      </div>
    </div>
    {progressOpen && <TrainingProgressModal trainingId={record.trainingId} onClose={() => setProgressOpen(false)} />}
    {joining && <BulkTrainingModal title={msg("Add Participants")} choices={openNeedChoices(snapshot, record)} initial={record} onClose={() => setJoining(false)} />}
  </>;
}

export function TrainingHistoryPage({ trainingId }: { trainingId: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const record = trainingById(snapshot, trainingId);
  const employee = record && employeeById(snapshot, record.employeeId);
  if (!record || !employee || !visibleEmployees(snapshot).some((item) => item.id === employee.id)) return <NotFound what={t("Training")} backHref="/training" backLabel={t("Back to Training Tracking")} />;
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Training Tracking", href: "/training" }, { label: t("History") }]} backHref={`/training/${record.trainingId}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee, t), record.activity]} status={record.status} />
    <Card title={t("Training history")} testId="status-history">
      <Timeline empty={t("Belum ada revisi.")} entries={trainingHistory(snapshot, record.trainingId).map((item) => ({
        id: item.id, date: formatDateTime(item.createdAt, language), title: t("Revision {n}", { n: item.revision }), status: item.status, actor: item.actor,
        body: [item.result && t("Result: {result}", { result: item.result }), item.followUp && t("Follow-up: {followUp}", { followUp: item.followUp }), item.notes].filter(Boolean).join(" · ") || undefined,
      }))} />
    </Card>
  </>;
}

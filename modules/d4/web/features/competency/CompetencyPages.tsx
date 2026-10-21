"use client";

import { ArrowRightLeft, Eye, FilePlus2, History, Save } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { CompetencyFinding } from "../../../competency/types";
import type { DevelopmentNeedVersion } from "../../../development/types";
import type { EmployeeReference } from "../../../shared/types";
import { openNeedFor } from "../../../shared/rules";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { canWrite, currentCompetencyStatus, currentGap, departmentOf, developmentNeeds, employeeById, employeeMeta, formatDate, latestCurrentPositionAssessment, positionById, positionOptions, today, trainingsOf, visibleEmployees, type Snapshot } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, FormError, FormModal, ModalActions, SearchInput, SearchSelectField, SelectFilter, TextField } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, cx, InfoGrid, Notice, statusLabel, StatusBadge } from "../../ui/primitives";
import { DevelopmentFormModal } from "../development/DevelopmentModals";
import { ReassessmentBadge } from "../development/DevelopmentPages";
import { closingRequirement, competencyOptions, competencyRows, findingLogic, formatDifference, type CompetencyRow as Row } from "./rows";

// Compared with statusLabel(row.status), so these are the English display labels.
const STATUS_FILTER = ["Not Evaluated", "Met", "Gap", "Insufficient Data"];

/** Optional "Dinilai bersama" (interview D4: after training HR evaluates with the department that raised the need). */
function AssessedWithField({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return <TextField label="Assessed with" testId="assessed-with" maxLength={200} value={value} onChange={(event) => onChange(event.target.value)} className={className}
    placeholder="Contoh: Rina, Finance Manager" helper="Opsional. Dinilai bersama atasan atau departemen yang mengajukan kebutuhan pegawai (nama/jabatan)." />;
}

// Below md each competency becomes a stacked block and every cell shows its column name (same pattern as the KPI lines table).
const stacked = "max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]";

const assessedWithText = (value?: string | null) => value?.trim() ? `Dinilai bersama ${value.trim()}` : "";

/** The requirement that closes a gap (Q15): its objective links to it, then its status, the reassessment and the latest training. */
function ClosingRequirement({ snapshot, need }: { snapshot: Snapshot; need: DevelopmentNeedVersion }) {
  const training = trainingsOf(snapshot, need.employeeId).find((item) => item.developmentNeedId === need.needId);
  return <div className="flex max-w-[280px] flex-col items-start gap-1.5">
    <Link href={`/development/${need.needId}`} data-testid="link-gap-requirement" className="line-clamp-2 font-semibold text-primary-600 hover:underline">{need.objective}</Link>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><StatusBadge status={need.status} /><ReassessmentBadge snapshot={snapshot} needId={need.needId} compact /></div>
    {training && <span data-testid="gap-training" className="text-xs text-ink-3">Training: {training.activity} · {statusLabel(training.status === "Completed" && training.result ? training.result : training.status)}</span>}
  </div>;
}

export function CompetencyListPage() {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const allNeeds = developmentNeeds(snapshot);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [competency, setCompetency] = useState("");
  const [devFor, setDevFor] = useState<string | null>(null);
  const [changing, setChanging] = useState<EmployeeReference | null>(null);
  const rows = useMemo(() => competencyRows(snapshot, { search, position, department, status, competency }), [snapshot, search, position, department, status, competency]);
  const filtered = Boolean(search || position || department || status || competency);
  // UAT-11: the list holds only employees in scope; anyone else is reached from People Dashboard, whose employee detail links here.
  const outOfScope = writer ? "Untuk pegawai lain, buka detailnya dari People Dashboard lalu klik Assess Position Change." : "Penilaian perubahan posisi untuk pegawai lain dimulai oleh HR.";

  return <>
    <PageHeader title="Competency Gap" subtitle="Bandingkan kemampuan pegawai dengan persyaratan posisinya." />
    <FilterBar canReset={filtered} onReset={() => { setSearch(""); setPosition(""); setDepartment(""); setStatus(""); setCompetency(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search name or position" />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All positions" testId="all-positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All departments" testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label="All status" testId="all-gap-status" value={status} onChange={setStatus} options={STATUS_FILTER.map((item) => ({ value: item, label: item }))} />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label="All competencies" testId="all-competencies" value={competency} onChange={setCompetency} options={competencyOptions(snapshot)} />}
    </FilterBar>
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id}
      emptyTitle="Tidak ada pegawai yang cocok" emptyText={snapshot.role === "EMPLOYEE" ? "Ubah kata kunci atau reset filter." : filtered ? `Ubah kata kunci atau reset filter. ${outOfScope}` : `Belum ada pegawai yang sedang training atau naik jabatan. ${outOfScope}`}
      columns={[
        { key: "employee", header: "Employee", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: "Position", wrap: true, cell: (row) => row.position },
        { key: "department", header: "Department", wrap: true, cell: (row) => departmentOf(snapshot, row.employee)?.name ?? "—" },
        { key: "requirements", header: "Requirement", className: "tabular-nums", cell: (row) => row.findings.length || "—" },
        { key: "gaps", header: "Gap", className: "tabular-nums", cell: (row) => row.findings.filter((item) => item.status === "Gap").length || "—" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        { key: "assessed", header: "Last saved", cell: (row) => formatDate(row.lastAssessed) },
      ]}
      actions={(row) => <RowActionMenu label={`Actions for ${row.employee.fullName}`} actions={[
        { label: "View Detail", testId: "view-detail", icon: <Eye />, href: `/competency/${row.employee.id}` },
        { label: "View History", testId: "view-history", icon: <History />, href: `/competency/${row.employee.id}/history` },
        { label: "Create Development Requirement", testId: "create-development-requirement", icon: <FilePlus2 />, onSelect: () => setDevFor(row.employee.id),
          hidden: !writer || row.status === "Not Evaluated" || row.findings.filter((item) => item.status === "Gap").every((item) => openNeedFor(allNeeds, row.employee.id, "competency_gap", item.requirementId)) },
        { label: "Assess Position Change", testId: "assess-position-change", icon: <ArrowRightLeft />, onSelect: () => setChanging(row.employee), hidden: !writer },
      ]} />} />
    {devFor && <DevelopmentFormModal employeeId={devFor} sourceType="competency_gap" onClose={() => setDevFor(null)} />}
    {changing && <PositionChangeModal employee={changing} onClose={() => setChanging(null)} />}
  </>;
}

/** Opened for one employee, from the list row menu or the detail page. */
function PositionChangeModal({ employee, onClose }: { employee: EmployeeReference; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const [position, setPosition] = useState("");
  const [date, setDate] = useState(today());
  const [assessedWith, setAssessedWith] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!position) { setError("Pilih posisi baru."); return; }
    const result = await run((source) => source.saveCompetency({ employeeId: employee.id, positionId: position, effectiveDate: date, assessedWith }), "Penilaian perubahan posisi tersimpan.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Position Change Assessment" description={`${employee.fullName} · ${employee.employeeId}. Riwayat gap untuk posisi lama tetap disimpan.`} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Assessment" />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <SearchSelectField label="New position" testId="new-position" required value={position} onChange={(value) => setPosition(value)} placeholder="Select position"
        options={snapshot.reference.positions.filter((item) => item.id !== employee.positionId).map((item) => ({ value: item.id, label: `${item.title}` }))} />
      <TextField label="Effective date" testId="effective-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <AssessedWithField value={assessedWith} onChange={setAssessedWith} />
      <Notice>Penilaian ini tidak mengubah data master posisi pegawai dan tidak memindahkan siapa pun secara otomatis.</Notice>
    </form>
  </FormModal>;
}

export function CompetencyDetailPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const writer = canWrite(snapshot);
  const [devRef, setDevRef] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [assessedWith, setAssessedWith] = useState("");
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Employee" backHref="/competency" backLabel="Back to Competency Gap" />;
  const gap = currentGap(snapshot, employee);
  const needs = developmentNeeds(snapshot);
  const saved = latestCurrentPositionAssessment(snapshot, employee);
  const assessed = Boolean(saved);
  // Saving again the same day with the same result only duplicates history.
  const sameAsSaved = (item: CompetencyFinding) => `${item.requirementId}:${item.actualLevel}:${item.status}`;
  // Naming a different co-assessor makes it a new snapshot, as on the server; an empty field changes nothing.
  const savedToday = Boolean(saved && gap && saved.effectiveDate === today() && (!assessedWith.trim() || (saved.assessedWith ?? "") === assessedWith.trim())
    && saved.findings.map(sameAsSaved).sort().join("|") === gap.findings.map(sameAsSaved).sort().join("|"));
  const canSave = writer && Boolean(gap?.findings.length);
  const saveSnapshot = () => employee.positionId && void run((source) => source.saveCompetency({ employeeId: employee.id, positionId: employee.positionId!, effectiveDate: today(), assessedWith }), "Penilaian kompetensi tersimpan ke riwayat.");

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: "Detail" }]} backHref="/competency"
      name={employee.fullName} meta={employeeMeta(snapshot, employee)}
      status={currentCompetencyStatus(snapshot, employee)}
      actions={<>
        <ButtonLink href={`/competency/${employee.id}/history`} icon={<History className="size-4" />} testId="view-history">View History</ButtonLink>
        {writer && <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => setChanging(true)} data-testid="btn-assess-position-change">Assess Position Change</Button>}
      </>} />
    <Notice>{!assessed && <>Status keseluruhan tetap <strong>Not Evaluated</strong> sampai penilaian untuk posisi aktif disimpan; Development Requirement dari gap baru bisa dibuat setelah itu. </>}Bukti yang belum ada pada perbandingan persyaratan ditandai <strong>Insufficient Data</strong>, bukan otomatis Gap. Requirement <strong>Opsional</strong> ditampilkan tetapi tidak menentukan status keseluruhan. Gap tidak pernah otomatis menetapkan training, promosi, atau sertifikasi.</Notice>
    {(saved || canSave) && <Card title="Assessment" testId="assessment-saved">
      <InfoGrid columns={3} items={[
        { label: "Last saved", testId: "last-saved", value: saved ? formatDate(saved.effectiveDate) : "Not saved yet" },
        { label: "Recorded by", testId: "recorded-by", value: saved?.actor ?? "—" },
        { label: "Last assessed with", testId: "assessed-with-saved", value: saved?.assessedWith || "—" },
      ]} />
      {/* The next save sits apart from what was saved last, and its button sits right next to the field it sends. */}
      {canSave && <div className="mt-5 flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-line pt-5">
        <AssessedWithField className="min-w-[240px] flex-[1_1_320px]" value={assessedWith} onChange={setAssessedWith} />
        <Button icon={<Save className="size-4" />} className="sm:mt-[26px]" disabled={busy || savedToday} title={savedToday ? "Sudah disimpan hari ini dengan hasil yang sama." : undefined} onClick={saveSnapshot} data-testid="btn-save-assessment">{savedToday ? "Saved Today" : "Save Assessment"}</Button>
      </div>}
    </Card>}
    <Card title="Requirement vs capability" testId="requirement-vs-capability" padded={false}>
      {/* Q15: the rule behind each row, so the table shows the logic and not only the data. */}
      <p data-testid="gap-logic" className="px-6 pb-4 text-xs leading-5 text-ink-3">Difference = level dimiliki − level dibutuhkan. Negatif dengan bukti berarti <strong>Gap</strong>; level atau bukti yang belum ada berarti <strong>Insufficient Data</strong>. Gap tertutup hanya bila penilaian baru menunjukkan level sudah memenuhi; requirement atau training yang Completed tidak menutupnya sendiri.</p>
      <div className="overflow-x-auto">
        <table data-testid="competency-gap-table" className="w-full text-left text-sm max-md:block md:min-w-[980px]">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3 max-md:hidden"><tr><th className="px-5 py-2.5">Competency</th><th className="px-5 py-2.5">Required</th><th className="px-5 py-2.5">Actual</th><th className="px-5 py-2.5">Difference</th><th className="px-5 py-2.5">Evidence</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5">Development requirement</th></tr></thead>
          <tbody className="max-md:block">{(gap?.findings ?? []).map((finding) => {
            // The unfinished requirement first; a completed one stays visible but does not block raising a new one for a gap that remains.
            const linked = closingRequirement(needs, employee.id, finding.requirementId);
            const open = linked && linked.status !== "Completed";
            const logic = findingLogic(finding);
            return <tr key={finding.requirementId} data-testid={`gap-${finding.requirementId}`} className="border-t border-line align-top max-md:grid max-md:grid-cols-3 max-md:gap-3 max-md:p-5">
              <td data-label="Competency" className={cx("px-5 py-3 font-semibold max-md:col-span-3", stacked)}>{finding.competencyName}{finding.isMandatory === false && <span className="ml-2 rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] font-semibold text-neutral" title="Tidak menentukan status keseluruhan">Opsional</span>}</td>
              <td data-label="Required" className={cx("whitespace-nowrap px-5 py-3 tabular-nums", stacked)}>Level {finding.requiredLevel}</td>
              <td data-label="Actual" className={cx("whitespace-nowrap px-5 py-3 tabular-nums", stacked)}>{finding.actualLevel === null ? "—" : `Level ${finding.actualLevel}`}</td>
              <td data-testid="gap-difference" data-label="Difference" className={cx("px-5 py-3 tabular-nums", stacked, logic.difference !== null && logic.difference < 0 && "font-semibold text-danger")}>{formatDifference(logic.difference)}</td>
              <td data-label="Evidence" className={cx("max-w-[240px] px-5 py-3 text-ink-2 max-md:col-span-3 max-md:max-w-none", stacked)}>{finding.evidenceNotes?.trim() || "Belum ada bukti"}</td>
              <td data-label="Status" className={cx("max-w-[220px] px-5 py-3 max-md:col-span-3 max-md:max-w-none", stacked)}><StatusBadge status={finding.status} /><span data-testid="gap-reason" className="mt-1.5 block text-xs leading-4 text-ink-3">{logic.reason}</span></td>
              <td data-testid="gap-requirement" data-label="Development requirement" className={cx("px-5 py-3 max-md:col-span-3", stacked)}>
                <div className="flex flex-col items-start gap-2">
                  {linked && <ClosingRequirement snapshot={snapshot} need={linked} />}
                  {!open && finding.status === "Gap" && (writer
                    ? assessed ? <Button variant="ghost" className="h-9" icon={<FilePlus2 className="size-4" />} onClick={() => setDevRef(finding.requirementId)} data-testid="btn-create-development-requirement">Create Development Requirement</Button>
                      : <span className="text-xs text-ink-3">Simpan penilaian dulu</span>
                    : !linked && <span className="text-xs text-ink-3">Belum ada requirement</span>)}
                  {!linked && finding.status !== "Gap" && <span className="text-xs text-ink-3">{finding.status === "Terpenuhi" ? "Tidak perlu" : "Lengkapi level dan bukti dulu"}</span>}
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table>
        {!gap?.findings.length && <p className="px-5 py-10 text-center text-sm text-ink-3">{gap ? "Posisi ini belum memiliki persyaratan kompetensi." : "Pegawai belum memiliki posisi aktif."}</p>}
      </div>
    </Card>
    {devRef && <DevelopmentFormModal employeeId={employee.id} sourceType="competency_gap" sourceRef={devRef} onClose={() => setDevRef(null)} />}
    {changing && <PositionChangeModal employee={employee} onClose={() => setChanging(false)} />}
  </>;
}

export function CompetencyHistoryPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Employee" backHref="/competency" backLabel="Back to Competency Gap" />;
  const saved = snapshot.competency.filter((item) => item.employeeId === employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: "History" }]} backHref={`/competency/${employee.id}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee), `${saved.length} saved ${saved.length === 1 ? "assessment" : "assessments"}`]} />
    <Card title="Assessment history" testId="assessment-history">
      <Timeline empty="Belum ada penilaian kompetensi yang tersimpan untuk pegawai ini." entries={saved.map((item) => ({
        id: item.id, date: formatDate(item.effectiveDate), status: item.overallStatus, actor: item.actor,
        title: `${positionById(snapshot, item.positionId)?.title ?? "Position"} — ${item.context === "role-change" ? "position change" : "current position"}`,
        body: [`${item.findings.length} requirement · ${item.findings.filter((finding) => finding.status === "Gap").length} gap · ${item.findings.filter((finding) => finding.status === "Bukti Belum Cukup").length} insufficient data`, assessedWithText(item.assessedWith)].filter(Boolean).join(" · "),
      }))} />
    </Card>
  </>;
}

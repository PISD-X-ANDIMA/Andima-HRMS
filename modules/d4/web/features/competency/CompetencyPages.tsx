"use client";

import { ArrowRightLeft, Eye, History, Save } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { CompetencyFinding, CompetencyOverallStatus } from "../../../competency/types";
import type { EmployeeReference } from "../../../shared/types";
import { openNeedFor } from "../../../shared/rules";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { canWrite, currentGap, departmentOf, developmentNeeds, employeeById, formatDate, includesText, positionById, positionOf, positionOptions, today, visibleEmployees } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { FilterBar, FormError, FormModal, ModalActions, SearchInput, SelectField, SelectFilter, TextField } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, cx, Notice, SourceChip, statusLabel, StatusBadge } from "../../ui/primitives";

type Row = { employee: EmployeeReference; position: string; status: CompetencyOverallStatus | "Belum Ada Posisi"; findings: CompetencyFinding[]; lastAssessed?: string };

const STATUS_FILTER = ["Terpenuhi", "Gap", "Data Belum Cukup", "Belum Ada Persyaratan"];

/**
 * Display-only gap size (actual − required). The status stays binary (Gap/Terpenuhi); this only shows
 * how far apart they are. No level recorded = "—", never a guessed number.
 */
function GapDelta({ finding }: { finding: CompetencyFinding }) {
  if (finding.actualLevel === null) return <span className="text-ink-3">—</span>;
  // Without evidence the level is unverified, so a numeric delta would contradict "Data Belum Cukup".
  if (finding.status === "Bukti Belum Cukup") return <span className="text-ink-3" title="Level belum terverifikasi evidence">—</span>;
  const delta = finding.actualLevel - finding.requiredLevel;
  return <span className={cx("font-semibold tabular-nums", delta <= -2 ? "text-danger" : delta === -1 ? "text-warning" : delta > 0 ? "text-success" : "text-ink-2")}>
    {delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0"}
  </span>;
}

export function CompetencyListPage() {
  const snapshot = useSnapshot();
  const writer = canWrite(snapshot);
  const allNeeds = developmentNeeds(snapshot);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("");
  const rows = useMemo<Row[]>(() => visibleEmployees(snapshot).map((employee) => {
    const gap = currentGap(snapshot, employee);
    const saved = snapshot.competency.filter((item) => item.employeeId === employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { employee, position: positionOf(snapshot, employee)?.title ?? "—", status: (gap?.overallStatus ?? "Belum Ada Posisi") as Row["status"], findings: gap?.findings ?? [], lastAssessed: saved?.effectiveDate };
  }).filter((row) => includesText(`${row.employee.fullName} ${row.employee.employeeId}`, search)
    && (!position || row.employee.positionId === position) && (!status || statusLabel(row.status) === status))
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName)), [snapshot, search, position, status]);

  return <>
    <PageHeader title="Competency Gap" subtitle="Bandingkan capability/evidence employee dengan requirement position aktif." />
    <FilterBar canReset={Boolean(search || position || status)} onReset={() => { setSearch(""); setPosition(""); setStatus(""); }}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search employee name or ID" />
      <SelectFilter label="All positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />
      <SelectFilter label="All gap status" value={status} onChange={setStatus} options={STATUS_FILTER.map((item) => ({ value: item, label: item }))} />
    </FilterBar>
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id} rowHref={(row) => `/competency/${row.employee.id}`}
      emptyTitle="Tidak ada employee yang cocok" emptyText="Ubah kata kunci atau reset filter."
      columns={[
        { key: "employee", header: "Employee", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: "Position", wrap: true, cell: (row) => row.position },
        { key: "requirements", header: "Requirements", className: "tabular-nums", cell: (row) => row.findings.length || "—" },
        { key: "gaps", header: "Gap", className: "tabular-nums", cell: (row) => row.findings.filter((item) => item.status === "Gap").length || "—" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        { key: "assessed", header: "Last saved", cell: (row) => formatDate(row.lastAssessed) },
      ]}
      actions={(row) => <RowActionMenu label={`Aksi untuk ${row.employee.fullName}`} actions={[
        { label: "View Detail", icon: <Eye />, href: `/competency/${row.employee.id}` },
        { label: "View History", icon: <History />, href: `/competency/${row.employee.id}/history` },
      ]} />} />
  </>;
}

function PositionChangeModal({ employee, onClose }: { employee: EmployeeReference; onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const [position, setPosition] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!position) { setError("Pilih position baru."); return; }
    const result = await run((source) => source.saveCompetency({ employeeId: employee.id, positionId: position, effectiveDate: date }), "Assessment perubahan posisi tersimpan.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Assess Position Change" description="Bandingkan capability employee dengan requirement position baru. Riwayat gap position lama tetap tersimpan." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Save Assessment" />}>
    <form id="d4-modal-form" onSubmit={submit} className="space-y-5">
      <FormError message={error} />
      <SelectField label="New position" required value={position} onChange={(event) => setPosition(event.target.value)}>
        <option value="">Select position</option>
        {snapshot.reference.positions.filter((item) => item.id !== employee.positionId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </SelectField>
      <TextField label="Effective date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <Notice>Assessment ini tidak mengubah master position employee dan tidak melakukan reassignment otomatis.</Notice>
    </form>
  </FormModal>;
}

export function CompetencyDetailPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const writer = canWrite(snapshot);
  const [changing, setChanging] = useState(false);
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Employee" backHref="/competency" backLabel="Kembali ke Competency Gap" />;
  const gap = currentGap(snapshot, employee);
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee.id && item.sourceType === "competency_gap");
  const saveSnapshot = () => employee.positionId && void run((source) => source.saveCompetency({ employeeId: employee.id, positionId: employee.positionId!, effectiveDate: today() }), "Assessment kompetensi tersimpan ke riwayat.");

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: "Detail" }]} backHref="/competency"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "Belum ada posisi", employee.employeeId, departmentOf(snapshot, employee)?.name ?? ""]}
      status={gap?.overallStatus}
      actions={<>
        <ButtonLink href={`/competency/${employee.id}/history`} icon={<History className="size-4" />}>View History</ButtonLink>
        {writer && <Button variant="secondary" icon={<ArrowRightLeft className="size-4" />} onClick={() => setChanging(true)}>Assess Position Change</Button>}
        {writer && gap && gap.findings.length > 0 && <Button icon={<Save className="size-4" />} disabled={busy} onClick={saveSnapshot}>Save Assessment</Button>}
      </>} />
    <Notice>Ketiadaan evidence ditandai <strong>Data Belum Cukup</strong>, bukan otomatis Gap. Requirement <strong>Opsional</strong> ditampilkan tetapi tidak menentukan status keseluruhan. Gap tidak otomatis menugaskan training, promosi, atau sertifikasi.</Notice>
    <Card title="Requirement vs capability" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="px-5 py-2.5">Competency</th><th className="px-5 py-2.5">Required</th><th className="px-5 py-2.5">Actual</th><th className="px-5 py-2.5">Selisih</th><th className="px-5 py-2.5">Evidence</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Action</th></tr></thead>
          <tbody>{(gap?.findings ?? []).map((finding) => {
            // Prefer the unfinished need; a completed one does not block raising a new need for a gap that remains.
            const open = needs.find((need) => need.sourceRef === finding.requirementId && need.status !== "Completed");
            const linked = open ?? needs.find((need) => need.sourceRef === finding.requirementId);
            return <tr key={finding.requirementId} className="border-t border-line align-middle">
              <td className="px-5 py-3 font-semibold">{finding.competencyName}{finding.isMandatory === false && <span className="ml-2 rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] font-semibold text-neutral" title="Tidak menentukan status keseluruhan">Opsional</span>}</td>
              <td className="px-5 py-3 tabular-nums">Level {finding.requiredLevel}</td>
              <td className="px-5 py-3 tabular-nums">{finding.actualLevel === null ? "—" : `Level ${finding.actualLevel}`}</td>
              <td className="px-5 py-3"><GapDelta finding={finding} /></td>
              <td className="max-w-[280px] px-5 py-3 text-ink-2">{finding.evidenceNotes?.trim() || "Belum ada evidence"}</td>
              <td className="px-5 py-3"><StatusBadge status={finding.status} /></td>
              <td className="px-5 py-3 text-right">{linked && (open || finding.status !== "Gap" || !writer) ? <SourceChip label="Development" reference={linked.status} href={`/development/${linked.needId}`} /> : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
        {!gap?.findings.length && <p className="px-5 py-10 text-center text-sm text-ink-3">{gap ? "Position ini belum memiliki requirement kompetensi." : "Employee belum memiliki position aktif."}</p>}
      </div>
    </Card>
    {changing && <PositionChangeModal employee={employee} onClose={() => setChanging(false)} />}
  </>;
}

export function CompetencyHistoryPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Employee" backHref="/competency" backLabel="Kembali ke Competency Gap" />;
  const saved = snapshot.competency.filter((item) => item.employeeId === employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: "History" }]} backHref={`/competency/${employee.id}`}
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, `${saved.length} assessment tersimpan`]} />
    <Card title="Assessment history">
      <Timeline empty="Belum ada assessment kompetensi yang disimpan untuk employee ini." entries={saved.map((item) => ({
        id: item.id, date: formatDate(item.effectiveDate), status: item.overallStatus, actor: item.actor,
        title: `${positionById(snapshot, item.positionId)?.title ?? "Position"} — ${item.context === "role-change" ? "perubahan posisi" : "posisi saat ini"}`,
        body: `${item.findings.length} requirement · ${item.findings.filter((finding) => finding.status === "Gap").length} gap · ${item.findings.filter((finding) => finding.status === "Bukti Belum Cukup").length} data belum cukup`,
      }))} />
    </Card>
  </>;
}

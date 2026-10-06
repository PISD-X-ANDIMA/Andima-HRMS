"use client";

import { ArrowRightLeft, FilePlus2, History, Save } from "lucide-react";
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
import { DevelopmentFormModal } from "../development/DevelopmentModals";

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
  const [devFor, setDevFor] = useState<string | null>(null);
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
      <SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau ID karyawan" />
      <SelectFilter label="Semua posisi" testId="all-positions" value={position} onChange={setPosition} options={positionOptions(snapshot)} />
      <SelectFilter label="Semua status gap" testId="all-gap-status" value={status} onChange={setStatus} options={STATUS_FILTER.map((item) => ({ value: item, label: item }))} />
    </FilterBar>
    <DataTable<Row> rows={rows} noun="karyawan" rowKey={(row) => row.employee.id} rowHref={(row) => `/competency/${row.employee.id}`}
      emptyTitle="Tidak ada karyawan yang cocok" emptyText="Ubah kata kunci atau reset filter."
      columns={[
        { key: "employee", header: "Karyawan", cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: "Posisi", wrap: true, cell: (row) => row.position },
        { key: "requirements", header: "Requirement", className: "tabular-nums", cell: (row) => row.findings.length || "—" },
        { key: "gaps", header: "Gap", className: "tabular-nums", cell: (row) => row.findings.filter((item) => item.status === "Gap").length || "—" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        { key: "assessed", header: "Terakhir disimpan", cell: (row) => formatDate(row.lastAssessed) },
      ]}
      actions={(row) => <RowActionMenu label={`Aksi untuk ${row.employee.fullName}`} actions={[
        { label: "Lihat Riwayat", testId: "view-history", icon: <History />, href: `/competency/${row.employee.id}/history` },
        { label: "Buat Development Requirement", testId: "create-development-requirement", icon: <FilePlus2 />, onSelect: () => setDevFor(row.employee.id),
          hidden: !writer || row.status !== "Gap" || row.findings.filter((item) => item.status === "Gap").every((item) => openNeedFor(allNeeds, row.employee.id, "competency_gap", item.requirementId)) },
      ]} />} />
    {devFor && <DevelopmentFormModal employeeId={devFor} sourceType="competency_gap" onClose={() => setDevFor(null)} />}
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
    if (!position) { setError("Pilih posisi baru."); return; }
    const result = await run((source) => source.saveCompetency({ employeeId: employee.id, positionId: position, effectiveDate: date }), "Assessment perubahan posisi tersimpan.");
    if (result.ok) onClose(); else setError(result.error);
  }
  return <FormModal title="Assessment Perubahan Posisi" description="Bandingkan capability karyawan dengan requirement posisi baru. Riwayat gap posisi lama tetap tersimpan." onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel="Simpan Assessment" />}>
    <form id="d4-modal-form" onSubmit={submit} className="space-y-5">
      <FormError message={error} />
      <SelectField label="Posisi baru" testId="new-position" required value={position} onChange={(event) => setPosition(event.target.value)}>
        <option value="">Pilih posisi</option>
        {snapshot.reference.positions.filter((item) => item.id !== employee.positionId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </SelectField>
      <TextField label="Tanggal efektif" testId="effective-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      <Notice>Assessment ini tidak mengubah master posisi karyawan dan tidak melakukan reassignment otomatis.</Notice>
    </form>
  </FormModal>;
}

export function CompetencyDetailPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const writer = canWrite(snapshot);
  const [devRef, setDevRef] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Karyawan" backHref="/competency" backLabel="Kembali ke Competency Gap" />;
  const gap = currentGap(snapshot, employee);
  const needs = developmentNeeds(snapshot).filter((item) => item.employeeId === employee.id && item.sourceType === "competency_gap");
  const saveSnapshot = () => employee.positionId && void run((source) => source.saveCompetency({ employeeId: employee.id, positionId: employee.positionId!, effectiveDate: today() }), "Assessment kompetensi tersimpan ke riwayat.");

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: "Detail" }]} backHref="/competency"
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "Belum ada posisi", employee.employeeId, departmentOf(snapshot, employee)?.name ?? ""]}
      status={gap?.overallStatus}
      actions={<>
        <ButtonLink href={`/competency/${employee.id}/history`} icon={<History className="size-4" />} testId="view-history">Lihat Riwayat</ButtonLink>
        {writer && <Button variant="secondary" icon={<ArrowRightLeft className="size-4" />} onClick={() => setChanging(true)} data-testid="btn-assess-position-change">Nilai Perubahan Posisi</Button>}
        {writer && gap && gap.findings.length > 0 && <Button icon={<Save className="size-4" />} disabled={busy} onClick={saveSnapshot} data-testid="btn-save-assessment">Simpan Assessment</Button>}
      </>} />
    <Notice>Ketiadaan evidence ditandai <strong>Data Belum Cukup</strong>, bukan otomatis Gap. Requirement <strong>Opsional</strong> ditampilkan tetapi tidak menentukan status keseluruhan. Gap tidak otomatis menugaskan training, promosi, atau sertifikasi.</Notice>
    <Card title="Requirement vs kemampuan" testId="requirement-vs-capability" padded={false}>
      <div className="overflow-x-auto">
        <table data-testid="competency-gap-table" className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3"><tr><th className="px-5 py-2.5">Kompetensi</th><th className="px-5 py-2.5">Dibutuhkan</th><th className="px-5 py-2.5">Aktual</th><th className="px-5 py-2.5">Selisih</th><th className="px-5 py-2.5">Bukti</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Aksi</th></tr></thead>
          <tbody>{(gap?.findings ?? []).map((finding) => {
            // Prefer the unfinished need; a completed one does not block raising a new need for a gap that remains.
            const open = needs.find((need) => need.sourceRef === finding.requirementId && need.status !== "Completed");
            const linked = open ?? needs.find((need) => need.sourceRef === finding.requirementId);
            return <tr key={finding.requirementId} data-testid={`gap-${finding.requirementId}`} className="border-t border-line align-middle">
              <td className="px-5 py-3 font-semibold">{finding.competencyName}{finding.isMandatory === false && <span className="ml-2 rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] font-semibold text-neutral" title="Tidak menentukan status keseluruhan">Opsional</span>}</td>
              <td className="px-5 py-3 tabular-nums">Level {finding.requiredLevel}</td>
              <td className="px-5 py-3 tabular-nums">{finding.actualLevel === null ? "—" : `Level ${finding.actualLevel}`}</td>
              <td className="px-5 py-3"><GapDelta finding={finding} /></td>
              <td className="max-w-[280px] px-5 py-3 text-ink-2">{finding.evidenceNotes?.trim() || "Belum ada bukti"}</td>
              <td className="px-5 py-3"><StatusBadge status={finding.status} /></td>
              <td className="px-5 py-3 text-right">{linked && (open || finding.status !== "Gap" || !writer) ? <SourceChip label="Development" reference={statusLabel(linked.status)} href={`/development/${linked.needId}`} />
                : finding.status === "Gap" && writer ? <Button variant="ghost" className="h-9" icon={<FilePlus2 className="size-4" />} onClick={() => setDevRef(finding.requirementId)} data-testid="btn-create-development-requirement">Buat Development Requirement</Button> : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
        {!gap?.findings.length && <p className="px-5 py-10 text-center text-sm text-ink-3">{gap ? "Posisi ini belum memiliki requirement kompetensi." : "Karyawan belum memiliki posisi aktif."}</p>}
      </div>
    </Card>
    {devRef && <DevelopmentFormModal employeeId={employee.id} sourceType="competency_gap" sourceRef={devRef} onClose={() => setDevRef(null)} />}
    {changing && <PositionChangeModal employee={employee} onClose={() => setChanging(false)} />}
  </>;
}

export function CompetencyHistoryPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what="Karyawan" backHref="/competency" backLabel="Kembali ke Competency Gap" />;
  const saved = snapshot.competency.filter((item) => item.employeeId === employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: "Riwayat" }]} backHref={`/competency/${employee.id}`}
      name={employee.fullName} meta={[positionOf(snapshot, employee)?.title ?? "", employee.employeeId, `${saved.length} assessment tersimpan`]} />
    <Card title="Riwayat assessment" testId="assessment-history">
      <Timeline empty="Belum ada assessment kompetensi yang disimpan untuk karyawan ini." entries={saved.map((item) => ({
        id: item.id, date: formatDate(item.effectiveDate), status: item.overallStatus, actor: item.actor,
        title: `${positionById(snapshot, item.positionId)?.title ?? "Posisi"} — ${item.context === "role-change" ? "perubahan posisi" : "posisi saat ini"}`,
        body: `${item.findings.length} requirement · ${item.findings.filter((finding) => finding.status === "Gap").length} gap · ${item.findings.filter((finding) => finding.status === "Bukti Belum Cukup").length} data belum cukup`,
      }))} />
    </Card>
  </>;
}

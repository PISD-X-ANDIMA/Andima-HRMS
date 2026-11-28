"use client";

import { useSearchParams } from "next/navigation";
import { ArrowRightLeft, Eye, FilePlus2, History, Save } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { CompetencyFinding } from "../../../competency/types";
import type { DevelopmentNeedVersion } from "../../../development/types";
import type { EmployeeReference } from "../../../shared/types";
import { openNeedFor } from "../../../shared/rules";
import type { Translate } from "../../../shared/text";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { useLanguage } from "../../i18n/LanguageProvider";
import { canAssess, canWrite, currentCompetencyStatus, currentGap, departmentOf, developmentNeeds, employeeById, employeeMeta, formatDate, inTrainingOrPositionChange, latestCurrentPositionAssessment, POSITION_CHANGE_SCOPE_MONTHS, positionTitle, today, trainingsOf, visibleEmployees, type Snapshot } from "../../data/selectors";
import { DataTable, PersonCell } from "../../ui/DataTable";
import { DateField, FilterBar, FormError, FormModal, ModalActions, SearchInput, SearchSelectField, SelectFilter, TextField } from "../../ui/forms";
import { DetailHeader, NotFound, PageHeader, Timeline } from "../../ui/layout";
import { RowActionMenu } from "../../ui/RowActionMenu";
import { Button, ButtonLink, Card, cx, InfoGrid, Notice, SavedNotice, statusLabel, StatusBadge } from "../../ui/primitives";
import { DevelopmentFormModal } from "../development/DevelopmentModals";
import { ReassessmentBadge } from "../development/DevelopmentPages";
import { closingRequirement, competencyOptions, competencyRows, findingLogic, formatDifference, type CompetencyRow as Row } from "./rows";

// Compared with t(statusLabel(row.status)), so these are the English display labels.
const STATUS_FILTER = ["Not Evaluated", "Met", "Gap", "Insufficient Data"];

/** Optional "Dinilai bersama" (interview D4: after training HR evaluates with the department that raised the need). */
function AssessedWithField({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const { t } = useLanguage();
  return <TextField label={t("Assessed with")} testId="assessed-with" maxLength={200} value={value} onChange={(event) => onChange(event.target.value)} className={className}
    placeholder={t("Contoh: Rina, Finance Manager")} helper={`${t("Opsional. Dinilai bersama atasan atau departemen yang mengajukan kebutuhan pegawai (nama/jabatan).")} ${value.length}/200`} />;
}

// Below md each competency becomes a stacked block and every cell shows its column name (same pattern as the KPI lines table).
const stacked = "max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-[0.04em] max-md:before:text-ink-3 max-md:before:content-[attr(data-label)]";

const assessedWithText = (value: string | null | undefined, t: Translate) => value?.trim() ? t("Dinilai bersama {name}", { name: value.trim() }) : "";

/** A translated sentence with its {placeholders} filled in bold: the status names it explains. */
function Bold({ text, words }: { text: string; words: Record<string, string> }) {
  return <>{text.split(/\{(\w+)\}/).map((part, index) => index % 2 ? <strong key={index}>{words[part]}</strong> : part)}</>;
}

/** The requirement that closes a gap (Q15): its objective links to it, then its status, the reassessment and the latest training. */
function ClosingRequirement({ snapshot, need }: { snapshot: Snapshot; need: DevelopmentNeedVersion }) {
  const { t } = useLanguage();
  const training = trainingsOf(snapshot, need.employeeId).find((item) => item.developmentNeedId === need.needId);
  return <div className="flex max-w-[280px] flex-col items-start gap-1.5">
    <Link href={`/development/${need.needId}`} data-testid="link-gap-requirement" className="line-clamp-2 font-semibold text-primary-600 hover:underline">{need.objective}</Link>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><StatusBadge status={need.status} /><ReassessmentBadge snapshot={snapshot} needId={need.needId} compact /></div>
    {training && <span data-testid="gap-training" className="text-xs text-ink-3">Training: {training.activity} · {t(statusLabel(training.status === "Completed" && training.result ? training.result : training.status))}</span>}
  </div>;
}

export function CompetencyListPage() {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const writer = canWrite(snapshot);
  const allNeeds = developmentNeeds(snapshot);
  // K15: dashboard alerts link here with ?q=<name>. Read from the router: during a client navigation window.location is still the previous page.
  const params = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [competency, setCompetency] = useState("");
  const [devFor, setDevFor] = useState<string | null>(null);
  const [changing, setChanging] = useState<EmployeeReference | null>(null);
  const [saved, setSaved] = useState<{ employeeId: string; needId?: string } | null>(null);
  const rows = useMemo(() => competencyRows(snapshot, { search, position, department, status, competency }), [snapshot, search, position, department, status, competency]);
  const savedRow = useMemo(() => saved ? competencyRows(snapshot, { search: "", position: "", department: "", status: "", competency: "" })
    .find((row) => row.employee.id === saved.employeeId) : undefined, [snapshot, saved]);
  const filtered = Boolean(search || position || department || status || competency);
  // UAT-11: the list holds only employees in scope; anyone else is reached from their People Dashboard profile, whose
  // Competency Gap card links to the detail page that has Assess Position Change.
  const outOfScope = writer ? t("Pegawai lain: buka profilnya di People Dashboard, klik View source pada kartu Competency Gap, lalu Assess Position Change.") : t("Penilaian perubahan posisi untuk pegawai lain dimulai oleh HR atau manager.");
  const all = visibleEmployees(snapshot);
  const inScope = all.filter((employee) => inTrainingOrPositionChange(snapshot, employee.id)).length;
  const scopeRule = t("pegawai probation atau intern, yang punya development requirement terbuka, atau yang perubahan posisinya dinilai dalam {months} bulan terakhir", { months: POSITION_CHANGE_SCOPE_MONTHS });

  return <>
    <PageHeader title="Competency Gap" subtitle={t("Bandingkan kemampuan pegawai dengan persyaratan posisinya.")} />
    {/* N2: the list is scoped, so its count differs from the People Dashboard; say who is listed and why. */}
    {snapshot.role !== "EMPLOYEE" && <div data-testid="competency-scope"><Notice>{t("Daftar ini memuat {count} dari {total} pegawai: {rule}. {next}", { count: inScope, total: all.length, rule: scopeRule, next: outOfScope })}</Notice></div>}
    <FilterBar canReset={filtered} onReset={() => { setSearch(""); setPosition(""); setDepartment(""); setStatus(""); setCompetency(""); }}
      search={<SearchInput value={search} onChange={setSearch} placeholder={t("Search name or position")} />}>
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Departments")} testId="all-departments" value={department} onChange={setDepartment} options={snapshot.reference.departments.map((item) => ({ value: item.id, label: item.name }))} />}
      <SelectFilter label={t("Status")} testId="all-gap-status" value={status} onChange={setStatus} options={STATUS_FILTER.map((item) => ({ value: item, label: t(item) }))} />
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Competencies")} testId="all-competencies" value={competency} onChange={setCompetency} options={competencyOptions(snapshot)} />}
      {snapshot.role !== "EMPLOYEE" && <SelectFilter label={t("Positions")} testId="all-positions" value={position} onChange={setPosition} options={snapshot.reference.positions.map((item) => ({ value: item.id, label: item.title }))} />}
    </FilterBar>
    {saved && <SavedNotice text={saved.needId ? t("Development requirement {name} tersimpan.", { name: employeeById(snapshot, saved.employeeId)?.fullName ?? "" }) : t("Penilaian perubahan posisi {name} tersimpan.", { name: employeeById(snapshot, saved.employeeId)?.fullName ?? "" })}
      href={saved.needId ? `/development/${saved.needId}` : `/competency/${saved.employeeId}/history`} />}
    <DataTable<Row> rows={rows} noun="employees" rowKey={(row) => row.employee.id} justSaved={savedRow}
      emptyTitle={filtered || snapshot.role === "EMPLOYEE" ? t("Tidak ada pegawai yang cocok") : t("Belum ada pegawai dalam cakupan")} emptyText={filtered || snapshot.role === "EMPLOYEE" ? t("Ubah kata kunci atau reset filter.") : t("Daftar ini hanya memuat {rule}. {next}", { rule: scopeRule, next: outOfScope })}
      columns={[
        { key: "employee", header: t("Employee"), cell: (row) => <PersonCell name={row.employee.fullName} code={row.employee.employeeId} /> },
        { key: "position", header: t("Position"), wrap: true, cell: (row) => row.position },
        { key: "department", header: t("Department"), wrap: true, optional: true, cell: (row) => departmentOf(snapshot, row.employee)?.name ?? "—" },
        { key: "requirements", header: "Requirement", className: "tabular-nums", optional: true, cell: (row) => row.findings.length || "—" },
        // Before the assessment is saved there is no gap to count yet (K19).
        { key: "gaps", header: "Gap", className: "tabular-nums", cell: (row) => row.status === "Not Evaluated" ? "—" : row.findings.filter((item) => item.status === "Gap").length || "—" },
        { key: "status", header: t("Status"), cell: (row) => <StatusBadge status={row.status} /> },
        { key: "assessed", header: t("Last saved"), optional: true, cell: (row) => formatDate(row.lastAssessed, language) },
      ]}
      actions={(row) => <RowActionMenu label={t("Actions for {name}", { name: row.employee.fullName })} actions={[
        { label: t("View Detail"), testId: "view-detail", icon: <Eye />, href: `/competency/${row.employee.id}` },
        { label: t("View History"), testId: "view-history", icon: <History />, href: `/competency/${row.employee.id}/history` },
        { label: t("Create Development Requirement"), testId: "create-development-requirement", icon: <FilePlus2 />, onSelect: () => setDevFor(row.employee.id),
          hidden: !canAssess(snapshot, row.employee.id) || row.status === "Not Evaluated" || row.findings.filter((item) => item.status === "Gap").every((item) => openNeedFor(allNeeds, row.employee.id, "competency_gap", item.requirementId)) },
        { label: t("Assess Position Change"), testId: "assess-position-change", icon: <ArrowRightLeft />, onSelect: () => setChanging(row.employee), hidden: !canAssess(snapshot, row.employee.id) },
      ]} />} />
    {devFor && <DevelopmentFormModal employeeId={devFor} sourceType="competency_gap" onClose={() => setDevFor(null)} onSaved={(needId) => setSaved({ employeeId: devFor, needId })} />}
    {changing && <PositionChangeModal employee={changing} onClose={() => setChanging(null)} onSaved={() => setSaved({ employeeId: changing.id })} />}
  </>;
}

/** Opened for one employee, from the list row menu or the detail page. */
function PositionChangeModal({ employee, onClose, onSaved }: { employee: EmployeeReference; onClose: () => void; onSaved?: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t } = useLanguage();
  const [position, setPosition] = useState("");
  const [date, setDate] = useState(today());
  const [assessedWith, setAssessedWith] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!position) { setError(t("Pilih posisi baru.")); return; }
    const result = await run((source) => source.saveCompetency({ employeeId: employee.id, positionId: position, effectiveDate: date, assessedWith }), t("Penilaian perubahan posisi tersimpan."));
    if (result.ok) { onSaved?.(); onClose(); } else setError(result.error);
  }
  return <FormModal title={t("Position Change Assessment")} description={`${employee.fullName} · ${employee.employeeId}. ${t("Riwayat gap untuk posisi lama tetap disimpan.")}`} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Save Assessment")} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      <SearchSelectField label={t("New position")} testId="new-position" required value={position} onChange={(value) => setPosition(value)} placeholder={t("Select position")}
        options={snapshot.reference.positions.filter((item) => item.id !== employee.positionId).map((item) => ({ value: item.id, label: `${item.title}` }))} />
      <DateField label={t("Effective date")} testId="effective-date" required value={date} onChange={(event) => setDate(event.target.value)} />
      <AssessedWithField value={assessedWith} onChange={setAssessedWith} />
      <Notice>{t("Penilaian ini tidak mengubah data master posisi pegawai dan tidak memindahkan siapa pun secara otomatis.")}</Notice>
    </form>
  </FormModal>;
}

export function CompetencyDetailPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t, language } = useLanguage();
  // Nobody assesses themselves (SR-D4-EMP-23): their own page is read-only.
  const writer = canAssess(snapshot, employeeId);
  const [devRef, setDevRef] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [assessedWith, setAssessedWith] = useState("");
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what={t("Employee")} backHref="/competency" backLabel={t("Back to Competency Gap")} />;
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
  const saveSnapshot = () => employee.positionId && void run((source) => source.saveCompetency({ employeeId: employee.id, positionId: employee.positionId!, effectiveDate: today(), assessedWith }), t("Penilaian kompetensi tersimpan ke riwayat."));

  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: t("Detail") }]} backHref="/competency"
      name={employee.fullName} meta={employeeMeta(snapshot, employee, t)}
      status={currentCompetencyStatus(snapshot, employee)}
      actions={<>
        <ButtonLink href={`/competency/${employee.id}/history`} icon={<History className="size-4" />} testId="view-history">{t("View History")}</ButtonLink>
        {writer && <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => setChanging(true)} data-testid="btn-assess-position-change">{t("Assess Position Change")}</Button>}
      </>} />
    <Notice>{!assessed && <><Bold text={t("Status keseluruhan tetap {status} sampai penilaian untuk posisi aktif disimpan; Development Requirement dari gap baru bisa dibuat setelah itu.")} words={{ status: "Not Evaluated" }} /> </>}<Bold text={t("Bukti yang belum ada pada perbandingan persyaratan ditandai {status}, bukan otomatis Gap. Gap tidak pernah otomatis menetapkan training, promosi, atau sertifikasi.")} words={{ status: "Insufficient Data" }} /></Notice>
    {(saved || canSave) && <Card title={t("Assessment")} testId="assessment-saved">
      <InfoGrid columns={3} items={[
        { label: t("Last saved"), testId: "last-saved", value: saved ? formatDate(saved.effectiveDate, language) : t("Not saved yet") },
        { label: t("Recorded by"), testId: "recorded-by", value: saved?.actor ?? "—" },
        { label: t("Last assessed with"), testId: "assessed-with-saved", value: saved?.assessedWith || "—" },
      ]} />
      {/* The next save sits apart from what was saved last, and its button sits right next to the field it sends. */}
      {canSave && <div className="mt-5 flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-line pt-5">
        <AssessedWithField className="min-w-[240px] flex-[1_1_320px]" value={assessedWith} onChange={setAssessedWith} />
        <Button icon={<Save className="size-4" />} className="sm:mt-[26px]" disabled={busy || savedToday} title={savedToday ? t("Sudah disimpan hari ini dengan hasil yang sama. Untuk penilaian ulang sesudah training, isi Assessed with.") : undefined} onClick={saveSnapshot} data-testid="btn-save-assessment">{savedToday ? t("Saved Today") : t("Save Assessment")}</Button>
      </div>}
    </Card>}
    <Card title={t("Requirement vs capability")} testId="requirement-vs-capability" padded={false}>
      {/* Q15: the rule behind each row, so the table shows the logic and not only the data. */}
      <p data-testid="gap-logic" className="px-6 pb-4 text-xs leading-5 text-ink-3"><Bold text={t("Difference = level dimiliki − level dibutuhkan. Negatif dengan bukti berarti {gap}; level atau bukti yang belum ada berarti {insufficient}. Gap tertutup hanya bila penilaian baru menunjukkan level sudah memenuhi; requirement atau training yang Completed tidak menutupnya sendiri.")} words={{ gap: "Gap", insufficient: "Insufficient Data" }} /></p>
      <div className="overflow-x-auto">
        <table data-testid="competency-gap-table" className="w-full text-left text-sm max-md:block md:min-w-[980px]">
          <thead className="bg-app text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3 max-md:hidden"><tr><th className="px-5 py-2.5">{t("Competency")}</th><th className="px-5 py-2.5">{t("Required")}</th><th className="px-5 py-2.5">{t("Actual")}</th><th className="px-5 py-2.5">{t("Difference")}</th><th className="px-5 py-2.5">{t("Evidence")}</th><th className="px-5 py-2.5">{t("Status")}</th><th className="px-5 py-2.5">Development requirement</th></tr></thead>
          <tbody className="max-md:block">{(gap?.findings ?? []).map((finding) => {
            // The unfinished requirement first; a completed one stays visible but does not block raising a new one for a gap that remains.
            const linked = closingRequirement(needs, employee.id, finding.requirementId);
            const open = linked && linked.status !== "Completed";
            const logic = findingLogic(finding, t);
            return <tr key={finding.requirementId} data-testid={`gap-${finding.requirementId}`} className="border-t border-line align-top max-md:grid max-md:grid-cols-3 max-md:gap-3 max-md:p-5">
              <td data-label={t("Competency")} className={cx("px-5 py-3 font-semibold max-md:col-span-3", stacked)}>{finding.competencyName}</td>
              <td data-label={t("Required")} className={cx("whitespace-nowrap px-5 py-3 tabular-nums", stacked)}>Level {finding.requiredLevel}</td>
              <td data-label={t("Actual")} className={cx("whitespace-nowrap px-5 py-3 tabular-nums", stacked)}>{finding.actualLevel === null ? "—" : `Level ${finding.actualLevel}`}</td>
              <td data-testid="gap-difference" data-label={t("Difference")} className={cx("px-5 py-3 tabular-nums", stacked, logic.difference !== null && logic.difference < 0 && "font-semibold text-danger")}>{formatDifference(logic.difference)}</td>
              <td data-label={t("Evidence")} className={cx("max-w-[240px] px-5 py-3 text-ink-2 max-md:col-span-3 max-md:max-w-none", stacked)}>{finding.evidenceNotes?.trim() || t("Belum ada bukti")}</td>
              <td data-label={t("Status")} className={cx("max-w-[220px] px-5 py-3 max-md:col-span-3 max-md:max-w-none", stacked)}><StatusBadge status={finding.status} /><span data-testid="gap-reason" className="mt-1.5 block text-xs leading-4 text-ink-3">{logic.reason}</span></td>
              <td data-testid="gap-requirement" data-label="Development requirement" className={cx("px-5 py-3 max-md:col-span-3", stacked)}>
                <div className="flex flex-col items-start gap-2">
                  {linked && <ClosingRequirement snapshot={snapshot} need={linked} />}
                  {!open && finding.status === "Gap" && (writer
                    ? assessed ? <Button variant="ghost" className="h-9" icon={<FilePlus2 className="size-4" />} onClick={() => setDevRef(finding.requirementId)} data-testid="btn-create-development-requirement">{t("Create Development Requirement")}</Button>
                      : <span className="text-xs text-ink-3">{t("Simpan penilaian dulu")}</span>
                    : !linked && <span className="text-xs text-ink-3">{t("Belum ada requirement")}</span>)}
                  {!linked && (finding.status === "Terpenuhi" || (finding.status !== "Gap" && writer)) && <span className="text-xs text-ink-3">{finding.status === "Terpenuhi" ? t("Tidak perlu") : t("Lengkapi level dan bukti dulu")}</span>}
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table>
        {!gap?.findings.length && <p className="px-5 py-10 text-center text-sm text-ink-3">{gap ? t("Posisi ini belum memiliki persyaratan kompetensi.") : t("Pegawai belum memiliki posisi aktif.")}</p>}
      </div>
    </Card>
    {devRef && <DevelopmentFormModal employeeId={employee.id} sourceType="competency_gap" sourceRef={devRef} onClose={() => setDevRef(null)} />}
    {changing && <PositionChangeModal employee={employee} onClose={() => setChanging(false)} />}
  </>;
}

export function CompetencyHistoryPage({ employeeId }: { employeeId: string }) {
  const snapshot = useSnapshot();
  const { t, language } = useLanguage();
  const employee = employeeById(snapshot, employeeId);
  if (!employee || !visibleEmployees(snapshot).some((item) => item.id === employeeId)) return <NotFound what={t("Employee")} backHref="/competency" backLabel={t("Back to Competency Gap")} />;
  const saved = snapshot.competency.filter((item) => item.employeeId === employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <>
    <DetailHeader crumbs={[{ label: "HRMS" }, { label: "Competency Gap", href: "/competency" }, { label: t("History") }]} backHref={`/competency/${employee.id}`}
      name={employee.fullName} meta={[...employeeMeta(snapshot, employee, t), saved.length === 1 ? t("{count} saved assessment", { count: saved.length }) : t("{count} saved assessments", { count: saved.length })]} />
    <Card title={t("Competency Gap history")} testId="assessment-history">
      <Timeline empty={t("Belum ada penilaian kompetensi yang tersimpan untuk pegawai ini.")} entries={saved.map((item) => ({
        id: item.id, date: formatDate(item.effectiveDate, language), status: item.overallStatus, actor: item.actor,
        title: `${positionTitle(snapshot, item.positionId, item.positionTitle, t)} · ${item.context === "role-change" ? t("position change") : t("current position")}`,
        body: [`${item.findings.length} requirement · ${item.findings.filter((finding) => finding.status === "Gap").length} gap · ${item.findings.filter((finding) => finding.status === "Bukti Belum Cukup").length} insufficient data`, assessedWithText(item.assessedWith, t)].filter(Boolean).join(" · "),
      }))} />
    </Card>
  </>;
}

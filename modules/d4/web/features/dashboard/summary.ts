import type { CompetencyAssessment } from "../../../competency/types";
import type { DevelopmentNeedVersion } from "../../../development/types";
import { roleForPosition, scorableSet, type KpiCatalog } from "../../../kpi/catalog";
import { allTopScores, bandRun, dailyEntriesOf } from "../../../kpi/daily";
import { HIGH_ABOVE, performanceBand, scaleMaxOf, UNDER_BELOW, type PerformanceBand } from "../../../kpi/scale";
import { completedAt, followUpOf, isDirectorPosition, localMonth, localToday, retrainedAt } from "../../../shared/rules";
import { plainText, type Translate } from "../../../shared/text";
import type { EmployeeReference } from "../../../shared/types";
import type { KpiAssessment } from "../../../supabase/types";
import type { BulkNeed } from "../../data/bulk";
import { canAssess, currentGap, developmentHistory, formatDate, formatPeriod, formatScorecard, needsOf, needsTraining, pendingCompilation, positionById, positionTitle, revisionChanges, scorecardsOf, trainingHistory, trainingsOf, type Snapshot } from "../../data/selectors";
import type { TimelineEntry } from "../../ui/layout";
import { slug, statusLabel } from "../../ui/primitives";

/** What the People Dashboard charts need from one listed row: the employee, the period's scorecard, the competency status. */
export type DashboardRow = { employee: EmployeeReference; scorecard?: KpiAssessment; gap: string };
export type Slice = { key: string; label: string; count: number };

/** FR-06.9 validation state: a scorecard is only summarised when its KPI weights total 100% (D1 decides the count). */
export const validScorecard = (item: KpiAssessment) => scorableSet(item.lines);

/**
 * Period the dashboard opens on: the latest one that has started (WIB), so a record saved for a future month does not
 * become the default and leave every other row empty. Falls back to the latest period when all of them are ahead.
 */
export const defaultPeriod = (periods: readonly string[], today = localMonth()) => periods.find((period) => period <= today) ?? periods[0] ?? "";

/** Profile period when none is chosen: the latest started scorecard period, else the latest started evaluation period (FR-06.1). */
export const profilePeriod = (scorecardPeriods: readonly string[], evaluationPeriods: readonly string[], today = localMonth()) =>
  defaultPeriod(scorecardPeriods, today) || defaultPeriod(evaluationPeriods, today) || undefined;

/**
 * Average Total KPI of the valid scorecards listed, one entry per scale (1–5 or 1–100), most scorecards first. A period
 * can hold both scales when a scorecard was saved under the older catalog, and the two must not be averaged together.
 */
export function averageScores(rows: readonly DashboardRow[]) {
  const groups = new Map<number, number[]>();
  for (const row of rows) {
    if (!row.scorecard || !validScorecard(row.scorecard) || row.scorecard.overallScore === null || row.scorecard.overallScore === undefined) continue;
    const max = scaleMaxOf(row.scorecard.definitionVersion);
    groups.set(max, [...(groups.get(max) ?? []), Number(row.scorecard.overallScore)]);
  }
  return [...groups].map(([scaleMax, scores]) => ({ scaleMax, count: scores.length, average: scores.reduce((sum, score) => sum + score, 0) / scores.length }))
    .sort((a, b) => b.count - a.count);
}

/** Rows without a scorecard, and scorecards left out of the average because they are invalid (FR-06.9) or have no score. */
export function reviewCounts(rows: readonly DashboardRow[]) {
  const reviewed = rows.filter((row) => row.scorecard).length;
  const scored = averageScores(rows).reduce((sum, item) => sum + item.count, 0);
  return { missing: rows.length - reviewed, scored, unscored: reviewed - scored };
}

/**
 * Employees without a scorecard whose position has no KPI role in the period's catalog: they cannot get a Performance
 * Review (FR-02.11). Some positions have no KPI by design (Commissioner, HR Manager) and only a catalog migration adds a
 * role, so the dashboard shows this as information, not as an alert HR could act on.
 */
export const withoutKpiRole = (snapshot: Snapshot, rows: readonly DashboardRow[], catalog: KpiCatalog | null) =>
  catalog ? rows.filter((row) => !row.scorecard && positionById(snapshot, row.employee.positionId) && !roleForPosition(catalog, row.employee.positionId)) : [];

// An invalid scorecard (FR-06.9) has no category, so it never reaches the donut, the filter or the Under Performance alert.
const bandOf = (row: DashboardRow) => row.scorecard && validScorecard(row.scorecard) ? performanceBand(row.scorecard.overallScore, row.scorecard.definitionVersion) : null;

export const BANDS: readonly PerformanceBand[] = ["Under Performance", "Average Performance", "High Performance"];

/**
 * Performance category of the listed rows (interview D4, 14 Oct 2026). Only 1–100 scorecards have a category;
 * 1–5 scorecards (V3.1/V5.1) and employees without a scorecard stay unrated instead of being mapped onto a band.
 */
export function performanceSlices(rows: readonly DashboardRow[]) {
  const bands = rows.map(bandOf);
  return {
    slices: BANDS.map((band): Slice => ({ key: slug(band), label: band, count: bands.filter((item) => item === band).length })),
    rated: bands.filter(Boolean).length,
    total: rows.length,
  };
}

export const COMPETENCY_ORDER = ["Met", "Insufficient Data", "Gap", "Not Evaluated"];

/** Competency status by display label, so two stored statuses that read "Insufficient Data" are one slice. */
export function competencySlices(rows: readonly DashboardRow[]): Slice[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(statusLabel(row.gap), (counts.get(statusLabel(row.gap)) ?? 0) + 1);
  const rank = (label: string) => COMPETENCY_ORDER.includes(label) ? COMPETENCY_ORDER.indexOf(label) : COMPETENCY_ORDER.length;
  return [...counts].map(([label, count]) => ({ key: slug(label), label, count })).sort((a, b) => rank(a.label) - rank(b.label));
}

/** Empty string = no filter. `band` a PerformanceBand, `competency` a competency status label, `training` the latest training status. */
export type DashboardFilters = { band: string; competency: string; training: string };

/**
 * FR-D4-004 B filters, combinable with each other and with search, position, department and period. A row without a
 * 1–100 scorecard has no category, so it drops out once a category is chosen; a row without training likewise.
 */
export const matchesDashboardFilters = (row: DashboardRow & { training?: string }, filters: DashboardFilters) =>
  (!filters.band || bandOf(row) === filters.band) && (!filters.competency || statusLabel(row.gap) === filters.competency) && (!filters.training || row.training === filters.training);

/** Open gap findings of assessed rows; "Not Evaluated" rows are skipped so the bars match the competency donut. */
function gapFindings(snapshot: Snapshot, row: DashboardRow) {
  if (row.gap === "Not Evaluated") return [];
  return (currentGap(snapshot, row.employee)?.findings ?? []).filter((finding) => finding.status === "Gap");
}

/** Competencies ranked by how many listed employees have an open gap in them ("kompetensi gap apa"). */
export function gapRanking(snapshot: Snapshot, rows: readonly DashboardRow[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (const row of rows) {
    for (const finding of gapFindings(snapshot, row)) {
      const item = counts.get(finding.competencyId) ?? { id: finding.competencyId, name: finding.competencyName, count: 0 };
      item.count += 1;
      counts.set(finding.competencyId, item);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Requirements still to finish for one employee, behind the "Need training" tile (UAT-19): the latest revision of
 * each need that is not Completed. Retraining reopens a need as Planned, so it counts again; a Completed need still
 * awaiting reassessment does not, because its training is done.
 */
export const openNeedsOf = (snapshot: Snapshot, employeeId: string) => needsOf(snapshot, employeeId).filter((need) => need.status !== "Completed");
export const openNeedCount = (snapshot: Snapshot, employeeId: string) => openNeedsOf(snapshot, employeeId).length;

/** Latest training of a requirement that is not Cancelled, by training date; undefined while it has none (PST 2). */
export const latestTrainingOf = (snapshot: Snapshot, need: DevelopmentNeedVersion) => trainingsOf(snapshot, need.employeeId)
  .filter((item) => item.developmentNeedId === need.needId && item.status !== "Cancelled")
  .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];

/**
 * Open requirements that have no training yet, among rows the user may write for: what the Need training tile offers to
 * plan in one form (transcript 24 Nov 2026), labelled as in Development Requirement's own bulk form.
 */
export const needsWithoutTraining = (snapshot: Snapshot, rows: readonly DashboardRow[]): BulkNeed[] => rows
  .filter((row) => canAssess(snapshot, row.employee.id))
  .flatMap((row) => openNeedsOf(snapshot, row.employee.id).filter((need) => !latestTrainingOf(snapshot, need))
    .map((need) => ({ key: need.needId, label: `${row.employee.fullName} · ${need.objective}`, employeeId: row.employee.id })));

/** Trainings of one employee still In Progress, behind the "Training in progress" tile. */
export const trainingsInProgress = (snapshot: Snapshot, employeeId: string) => trainingsOf(snapshot, employeeId).filter((item) => item.status === "In Progress");

/** Row fields the summary tiles count on, worked out once per row by the dashboard. */
export type TileRow = DashboardRow & { openNeeds: number; trainingInProgress: boolean };

/**
 * The people behind each summary tile (Pak Emanuel, 17 Nov 2026: "bisa dilihat di mana siapa yang butuh training?").
 * A tile shows `list.length` and its dialog lists the same rows, so the two cannot disagree. Performance Review rows
 * split four ways, each row once: valid scorecard (the tile's count), invalid scorecard (FR-06.9), no scorecard yet,
 * and no KPI role in the catalog (K4), which can never be reviewed.
 */
export function tileMembers<T extends TileRow>(rows: readonly T[], noKpi: readonly DashboardRow[]) {
  const unreviewable = new Set(noKpi.map((row) => row.employee.id));
  return {
    dev: rows.filter((row) => row.openNeeds > 0),
    training: rows.filter((row) => row.trainingInProgress),
    reviewed: rows.filter((row) => row.scorecard && validScorecard(row.scorecard)),
    invalid: rows.filter((row) => row.scorecard && !validScorecard(row.scorecard)),
    notReviewed: rows.filter((row) => !row.scorecard && !unreviewable.has(row.employee.id)),
    noKpi: rows.filter((row) => !row.scorecard && unreviewable.has(row.employee.id)),
  };
}

/**
 * Q14 (20 Oct 2026): when the training of a gap-based need finished, or undefined while it has not. A need counts once
 * it is Completed or a training of the current round (since the last Retraining) was Passed. The moment is when the
 * latest completed training was recorded Completed; a need completed without training counts from when it was raised.
 */
export function trainingFinishedAt(snapshot: Snapshot, need: DevelopmentNeedVersion): string | undefined {
  const history = developmentHistory(snapshot, need.needId);
  const since = retrainedAt(history);
  const done = trainingsOf(snapshot, need.employeeId).filter((item) => item.developmentNeedId === need.needId && item.status === "Completed" && (!since || item.createdAt > since))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (need.status !== "Completed" && !done.some((item) => item.result === "Passed")) return undefined;
  return done[0] ? completedAt(trainingHistory(snapshot, done[0].trainingId)) : history.at(-1)?.createdAt ?? need.createdAt;
}

/**
 * Q14: HR reassesses in D4 after training. The gap counts as closed only when the latest competency assessment saved
 * after `finishedAt` that covers the requirement shows it met. An older assessment, newer skill data that was never
 * saved as an assessment, or a recorded reassessment decision does not close it.
 */
export function gapClosedAfter(assessments: readonly Pick<CompetencyAssessment, "createdAt" | "findings">[], requirementId: string, finishedAt: string): boolean {
  const finding = (item: Pick<CompetencyAssessment, "findings">) => item.findings.find((entry) => entry.requirementId === requirementId);
  const latest = assessments.filter((item) => Date.parse(item.createdAt) > Date.parse(finishedAt) && finding(item))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return latest ? finding(latest)?.status === "Terpenuhi" : false;
}

/** Under Performance row HR can assign training to (Q16): a requirement from that period's scorecard. */
export type AssignTarget = { employeeId: string; name: string; scorecardId: string };
/**
 * `label`: state shown next to the title, e.g. a Not Passed training still awaiting HR's follow-up (Q16).
 * `action`: the follow-up sentence, shown only to HR and managers since the other roles cannot do it (K9).
 * `assign`: per employee of the Under Performance alert, the scorecard a training requirement is raised from.
 */
export type DashboardAlert = { key: string; title: string; detail: string; action?: string; href: string; count: number; people: string[]; label?: string; assign?: AssignTarget[] };

/** Ended periods whose Daily KPI compilation was never finalized into a scorecard, so they do not vanish at month end (W1). */
export const unfinalizedPeriods = (snapshot: Snapshot, employeeId: string, today = localMonth()) =>
  [...new Set((snapshot.kpiDaily ?? []).filter((item) => item.employeeId === employeeId && item.period < today).map((item) => item.period))]
    .filter((period) => pendingCompilation(snapshot, employeeId, period)).sort().reverse();

/**
 * Follow-ups HR should act on, computed from D4 data only (interview D4, 14 Oct 2026). Alerts that need data D4
 * does not hold (field agent vacancy, maternity leave) are not computed here.
 * The rows, and so the Under Performance alert, belong to `period`, the period the dashboard shows. The Daily KPI
 * alerts look at the running WIB period `today` whatever period is shown, since they ask for action now, and name that
 * month. `dailyCatalog` is the catalog of that period: only employees with a KPI role are expected to fill Daily KPI.
 * An alert about one person links to the list narrowed to them (`?q=<name>`, K15).
 */
export function dashboardAlerts(snapshot: Snapshot, rows: readonly DashboardRow[], dailyCatalog: KpiCatalog | null = null, period = "", today = localMonth(), t: Translate = plainText): DashboardAlert[] {
  const found = { under: [] as string[], unfinalized: [] as string[], completedGap: [] as string[], notPassed: [] as string[], noPlan: [] as string[], noPic: [] as string[], dailyUnder: [] as string[], dailyHigh: [] as string[], dailyAllTop: [] as string[], noDaily: [] as string[], noTraining: [] as string[] };
  const assign: AssignTarget[] = [];
  let unfinalizedPeriod = "";
  for (const row of rows) {
    const name = row.employee.fullName;
    const ended = unfinalizedPeriods(snapshot, row.employee.id, today)[0];
    if (ended) {
      found.unfinalized.push(name);
      if (ended > unfinalizedPeriod) unfinalizedPeriod = ended;
    }
    if (row.scorecard && bandOf(row) === "Under Performance") {
      found.under.push(name);
      assign.push({ employeeId: row.employee.id, name, scorecardId: row.scorecard.id });
    }
    const needs = needsOf(snapshot, row.employee.id);
    for (const finding of gapFindings(snapshot, row)) {
      // A need answers this gap only when it was raised from the same position requirement.
      if (!needs.some((need) => need.sourceType === "competency_gap" && need.sourceRef === finding.requirementId)) found.noPlan.push(name);
    }
    // Requirement Completed or training Passed, but no newer assessment shows the level met (Q14). Only requirements of
    // the current position count: an assessment never covers a requirement of a former position.
    for (const need of needs) {
      const finished = need.sourceType === "competency_gap" ? trainingFinishedAt(snapshot, need) : undefined;
      if (!finished || !snapshot.reference.positionRequirements.some((item) => item.id === need.sourceRef && item.positionId === row.employee.positionId)) continue;
      if (!gapClosedAfter(snapshot.competency.filter((item) => item.employeeId === row.employee.id), need.sourceRef, finished)) found.completedGap.push(name);
    }
    if (snapshot.kpiDaily) {
      const days = dailyEntriesOf(snapshot.kpiDaily, row.employee.id, today);
      if (bandRun(days, "Under Performance") >= 3) found.dailyUnder.push(name);
      if (bandRun(days, "High Performance") >= 3) found.dailyHigh.push(name);
      if (days.some(allTopScores)) found.dailyAllTop.push(name);
      // Directors have a KPI role for their Performance Review but do not fill Daily KPI (decision 13 Nov 2026).
      if (!days.length && dailyCatalog && roleForPosition(dailyCatalog, row.employee.positionId) && !isDirectorPosition(positionById(snapshot, row.employee.positionId)?.code)) found.noDaily.push(name);
    }
    for (const need of needs) {
      if (need.status === "Completed") continue;
      if (!need.pic?.trim()) found.noPic.push(name);
      if (needsTraining(snapshot, need)) found.noTraining.push(name);
      const last = latestTrainingOf(snapshot, need);
      // Q16: waits for HR's follow-up. Retraining adds a newer training; any recorded follow-up clears it.
      if (last?.status === "Completed" && last.result === "Not Passed" && !followUpOf(trainingHistory(snapshot, last.trainingId))) found.notPassed.push(name);
    }
  }
  const alerts: (Omit<DashboardAlert, "count" | "people"> & { list: string[]; period?: string })[] = [
    { key: "under-performance", list: found.under, assign, title: "Under Performance", href: "/performance", period, detail: period ? t("pegawai di bawah 80 pada {period}.", { period: formatPeriod(period, t.language), count: found.under.length }) : t("pegawai di bawah 80 pada periode ini.", { count: found.under.length }), action: t("Tindak lanjuti dengan Assign training: development requirement dari Performance Review-nya.") },
    { key: "daily-not-finalized", list: found.unfinalized, title: t("Daily KPI belum difinalisasi"), href: "/performance", period: unfinalizedPeriod, detail: t("pegawai punya skor Compiled dari Daily KPI periode yang sudah berakhir, belum menjadi Performance Review.", { count: found.unfinalized.length }), action: t("Finalize from Daily KPI di Performance Review periode itu.") },
    { key: "completed-gap-open", list: found.completedGap, title: t("Completed, gap masih terbuka"), href: "/training", detail: t("development requirement Completed atau training Passed, tetapi belum ada penilaian kompetensi baru yang menunjukkan level terpenuhi.", { count: found.completedGap.length }), action: t("Catat hasil reassessment di detail training.") },
    { key: "training-not-passed", list: found.notPassed, title: "Training Not Passed", label: t("Awaiting follow-up"), href: "/training", detail: t("development requirement dengan training terakhir Not Passed dan belum ada tindak lanjut.", { count: found.notPassed.length }), action: t("Catat Retraining atau Other follow-up di detail training.") },
    { key: "gap-no-requirement", list: found.noPlan, title: t("Gap tanpa development requirement"), href: "/competency", detail: t("gap kompetensi belum dibuatkan development requirement.", { count: found.noPlan.length }) },
    { key: "requirement-no-training", list: found.noTraining, title: t("Belum punya training"), href: "/development", detail: t("development requirement terbuka menunggu training.", { count: found.noTraining.length }), action: t("Pilih requirement-nya di Development Requirement, lalu Add Training (bisa beberapa sekaligus).") },
    { key: "daily-under", list: found.dailyUnder, title: t("Daily KPI Under Performance 3 hari"), href: "/daily-kpi", detail: t("pegawai dengan total Daily KPI di bawah {limit} pada tiga entri terakhir berturut-turut di {period}.", { limit: UNDER_BELOW, period: formatPeriod(today, t.language), count: found.dailyUnder.length }), action: t("Panggil pegawai ini untuk ditindaklanjuti.") },
    { key: "daily-high", list: found.dailyHigh, title: t("Daily KPI High Performance 3 hari"), href: "/daily-kpi", detail: t("pegawai dengan total Daily KPI di atas {limit} pada tiga entri terakhir berturut-turut di {period}.", { limit: HIGH_ABOVE, period: formatPeriod(today, t.language), count: found.dailyHigh.length }), action: t("Panggil pegawai ini untuk mengonfirmasi capaiannya.") },
    { key: "daily-all-top", list: found.dailyAllTop, title: t("Daily KPI terisi 100 semua"), href: "/daily-kpi", detail: t("pegawai mengisi 100 untuk semua KPI pada entri Daily KPI di {period}.", { period: formatPeriod(today, t.language), count: found.dailyAllTop.length }), action: t("Periksa kewajaran skor itu bersama pegawai.") },
    { key: "daily-missing", list: found.noDaily, title: t("Belum mengisi Daily KPI"), href: "/daily-kpi", detail: t("pegawai dengan KPI di katalog belum punya entri Daily KPI di {period}.", { period: formatPeriod(today, t.language), count: found.noDaily.length }) },
    { key: "requirement-no-pic", list: found.noPic, title: t("Tanpa PIC"), href: "/development", detail: t("development requirement terbuka belum punya PIC.", { count: found.noPic.length }) },
  ];
  return alerts.filter((item) => item.list.length).map(({ list, period: at, href, ...item }) => {
    const people = [...new Set(list)];
    const query = [at && `period=${at}`, people.length === 1 && `q=${encodeURIComponent(people[0])}`].filter(Boolean).join("&");
    return { ...item, href: query ? `${href}?${query}` : href, count: list.length, people };
  });
}

export type HistoryEntry = TimelineEntry & { kind: "competency" | "performance" | "development" | "training"; day: string; createdAt: string };

/** Day an entry happened (YYYY-MM-DD, WIB): a timestamp saved before 07:00 WIB belongs to that WIB day, not the UTC one. */
const dayOf = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localToday(new Date(value));

/**
 * One employee's history across D4 modules, newest first (profile card "Riwayat"): competency assessments
 * (a position change shows its effective date), Performance Review per period with total and category, and every
 * development and training revision. Each entry links to its source page. D4 keeps no position history table, so
 * past positions appear only through position change assessments.
 */
export function employeeHistory(snapshot: Snapshot, employeeId: string, t: Translate = plainText): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const item of snapshot.competency) {
    if (item.employeeId !== employeeId) continue;
    const position = positionTitle(snapshot, item.positionId, item.positionTitle, t);
    const roleChange = item.context === "role-change";
    entries.push({ id: `competency-${item.id}`, kind: "competency", day: item.effectiveDate, createdAt: item.createdAt, actor: item.actor,
      date: roleChange ? t("Efektif {date}", { date: formatDate(item.effectiveDate, t.language) }) : formatDate(item.effectiveDate, t.language), status: item.overallStatus, href: `/competency/${employeeId}/history`,
      title: roleChange ? t("Position change assessment · {position}", { position }) : t("Competency assessment · {position}", { position }),
      body: [t("{requirements} requirement · {gaps} gap", { requirements: item.findings.length, gaps: item.findings.filter((finding) => finding.status === "Gap").length }), item.assessedWith?.trim() && t("Dinilai bersama {name}", { name: item.assessedWith.trim() })].filter(Boolean).join(" · ") });
  }
  for (const item of scorecardsOf(snapshot, employeeId)) {
    const on = item.evaluationDate || item.createdAt;
    entries.push({ id: `performance-${item.id}`, kind: "performance", day: dayOf(on), createdAt: item.createdAt, actor: item.actor,
      date: `${formatPeriod(item.period, t.language)} · ${formatDate(on, t.language)}`, status: performanceBand(item.overallScore, item.definitionVersion) ?? undefined,
      title: `Performance Review ${formatPeriod(item.period, t.language)} · ${formatScorecard(item)}`, body: `Evaluator ${item.evaluatorName || "—"}`, href: `/performance/scorecard/${item.id}` });
  }
  for (const need of needsOf(snapshot, employeeId)) {
    const versions = developmentHistory(snapshot, need.needId);
    versions.forEach((version, index) => entries.push({ id: `development-${version.id}`, kind: "development", day: dayOf(version.createdAt), createdAt: version.createdAt,
      actor: version.actor, date: formatDate(version.createdAt, t.language), status: version.status, href: `/development/${need.needId}`,
      title: `Development Requirement rev. ${version.revision}: ${version.objective}`,
      body: [...revisionChanges(version, versions[index + 1], t), version.notes].filter(Boolean).join(" · ") || undefined }));
  }
  for (const training of trainingsOf(snapshot, employeeId)) {
    for (const version of trainingHistory(snapshot, training.trainingId)) {
      entries.push({ id: `training-${version.id}`, kind: "training", day: dayOf(version.createdAt), createdAt: version.createdAt, actor: version.actor,
        date: formatDate(version.createdAt, t.language), status: version.status, href: `/training/${training.trainingId}`,
        title: `Training v${version.revision}: ${version.activity}`,
        body: [version.result && t("Result: {result}", { result: version.result }), version.followUp && t("Follow-up: {followUp}", { followUp: version.followUp }), version.notes].filter(Boolean).join(" · ") || undefined });
    }
  }
  return entries.sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
}

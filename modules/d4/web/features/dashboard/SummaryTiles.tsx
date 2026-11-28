"use client";

import Link from "next/link";
import { ArrowDown, ArrowUpRight, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DailyCompilation } from "../../../kpi/daily";
import { performanceBand } from "../../../kpi/scale";
import { canAssess, formatDate, formatPeriod, formatScorecard, type Snapshot } from "../../data/selectors";
import { FormModal } from "../../ui/forms";
import { Button, ButtonLink, cx, Notice, SavedNotice, StatusBadge } from "../../ui/primitives";
import { FinalizeDailyModal } from "../kpi/FinalizeDailyModal";
import { KpiFormModal } from "../kpi/KpiFormModal";
import { BulkTrainingModal } from "../training/BulkModals";
import { TrainingFormModal, TrainingProgressModal } from "../training/TrainingModals";
import { bulkSummary, type BulkNeed } from "../../data/bulk";
import { latestTrainingOf, needsWithoutTraining, openNeedsOf, tileMembers, trainingsInProgress, type DashboardRow, type TileRow } from "./summary";
import { msg } from "../../../shared/text";
import { useLanguage } from "../../i18n/LanguageProvider";

export type SummaryRow = TileRow & { position: string; period?: string; compiled: DailyCompilation | null };
type TileKey = "dev" | "training" | "kpi";
type Action = { name: string } & ({ kind: "training"; employeeId: string; needId: string } | { kind: "progress"; trainingId: string } | { kind: "review"; employeeId: string } | { kind: "finalize"; employeeId: string; compiled: DailyCompilation } | { kind: "bulk-training"; needs: BulkNeed[] });

/** Anchor of the People Dashboard table, which the Employees tile jumps to. */
export const DASHBOARD_TABLE_ID = "dashboard-table";

// A flex column, since a button centres its content vertically and the tiles in one row stretch to the tallest.
const tileBox = "flex w-full flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-card";
const tileLink = "group transition-colors hover:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";
const textLink = "hover:text-primary-600 hover:underline";

/**
 * Headline counts over the rows currently listed (mentor review, 14 Oct 2026). Each count opens who is behind it
 * (Pak Emanuel, 17 Nov 2026): Employees jumps to the table, the other three open a list with the action each person
 * needs. An action replaces the list for as long as its form is open and returns to it afterwards, so the user never
 * stacks two dialogs and never loses their place.
 */
export function SummaryTiles({ snapshot, rows, period, noKpi }: { snapshot: Snapshot; rows: readonly SummaryRow[]; period: string; noKpi: readonly DashboardRow[] }) {
  const { t, language } = useLanguage();
  const members = tileMembers(rows, noKpi);
  const [open, setOpen] = useState<TileKey | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [saved, setSaved] = useState<{ text: string; href: string } | null>(null);
  // K4: employees whose position has no KPI can never be reviewed, so they are not part of the share HR can complete.
  const reviewable = rows.length - members.noKpi.length;
  const reviewed = members.reviewed.length;
  const compiled = rows.filter((row) => row.compiled).length;
  // Order set by the client (interview 13 Nov 2026, 0:32:14): Employees, Need training, Training in progress, and
  // Performance Review complete last. Completion of the period's reviews stays a plain integer for Katalon.
  const tiles = [
    { key: "total", label: t("Employees"), value: rows.length, hint: t("sesuai filter"), opens: rows.length > 0 },
    // UAT-19: the partner asked for "jumlah karyawan yang butuh training"; testId summary-dev stays for Katalon.
    { key: "dev", label: t("Need training"), value: members.dev.length, hint: t("punya development requirement yang belum selesai"), opens: members.dev.length > 0 },
    { key: "training", label: t("Training in progress"), value: members.training.length, hint: t("punya training In Progress"), opens: members.training.length > 0 },
    // Opens while anyone can be reviewed, since the list starts with who is still waiting for a review.
    { key: "kpi", label: t("Performance Review complete"), value: reviewed, opens: reviewable > 0,
      hint: `${t("dari {count} pegawai yang bisa direview ({percent}%)", { count: reviewable, percent: reviewable ? Math.round((reviewed / reviewable) * 100) : 0 })} · ${formatPeriod(period, language)}${compiled ? ` · ${t("{count} Compiled, menunggu finalisasi", { count: compiled })}` : ""}` },
  ] as const;

  const show = (key: TileKey) => { setSaved(null); setOpen(key); };
  const close = () => { setOpen(null); setSaved(null); };
  const back = () => setAction(null);
  const notice = (text: string, href: string) => setSaved({ text, href });

  return <>
    <section aria-label={t("Summary")} data-testid="dashboard-summary" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {tiles.map((tile) => {
        const body = <>
          <span className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-3">{tile.label}</span>
            {/* Employees jumps down to the table, the other tiles open a list: the mark says which. */}
            {tile.opens && (tile.key === "total" ? <ArrowDown aria-hidden="true" data-testid="summary-total-jump" className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-primary-600" />
              : <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-primary-600" />)}
          </span>
          <span className="mt-2 block font-display text-3xl font-semibold tabular-nums text-ink">{tile.value}</span>
          <span data-testid={`summary-${tile.key}-hint`} className="mt-1 block text-xs text-ink-3">{tile.hint}</span>
        </>;
        if (!tile.opens) return <div key={tile.key} data-testid={`summary-${tile.key}`} className={tileBox}>{body}</div>;
        if (tile.key === "total") return <a key={tile.key} href={`#${DASHBOARD_TABLE_ID}`} data-testid="summary-total" className={cx(tileBox, tileLink)}>{body}</a>;
        return <button key={tile.key} type="button" aria-haspopup="dialog" data-testid={`summary-${tile.key}`} onClick={() => show(tile.key)} className={cx(tileBox, tileLink)}>{body}</button>;
      })}
    </section>

    {open && !action && <TileDialog tile={open} period={period} members={members} reviewable={reviewable} onClose={close}>
      {saved && <div className="mb-4"><SavedNotice text={saved.text} href={saved.href} /></div>}
      {open === "dev" && <NeedList snapshot={snapshot} rows={members.dev} onAction={setAction} />}
      {open === "training" && <TrainingList snapshot={snapshot} rows={members.training} onAction={setAction} />}
      {open === "kpi" && <ReviewList snapshot={snapshot} period={period} members={members} onAction={setAction} />}
    </TileDialog>}

    {action?.kind === "training" && <TrainingFormModal employeeId={action.employeeId} developmentNeedId={action.needId} onClose={back}
      onSaved={(id) => notice(t("Training untuk {name} tersimpan.", { name: action.name }), `/training/${id}`)} />}
    {action?.kind === "progress" && <TrainingProgressModal trainingId={action.trainingId} onClose={back}
      onSaved={() => notice(t("Progress training {name} tersimpan.", { name: action.name }), `/training/${action.trainingId}`)} />}
    {action?.kind === "review" && <KpiFormModal employeeId={action.employeeId} period={period} onClose={back}
      onSaved={(id) => notice(t("Performance Review {name} tersimpan.", { name: action.name }), `/performance/scorecard/${id}`)} />}
    {action?.kind === "bulk-training" && <BulkTrainingModal needs={action.needs} onClose={back}
      onDone={(outcome) => notice(bulkSummary(outcome, "training", t), "/training")} />}
    {action?.kind === "finalize" && <FinalizeDailyModal employeeId={action.employeeId} period={period} compiled={action.compiled} onClose={back}
      onSaved={(id) => notice(t("Performance Review {name} tersimpan dari Daily KPI.", { name: action.name }), `/performance/scorecard/${id}`)} />}
  </>;
}

type Members = ReturnType<typeof tileMembers<SummaryRow>>;

// Titles and labels are dictionary keys; TileDialog translates them and fills {period}.
const DIALOGS: Record<TileKey, { title: string; page: (period: string) => string; pageLabel: string }> = {
  dev: { title: msg("Need training"), page: () => "/development", pageLabel: msg("Open Development Requirement") },
  training: { title: msg("Training in progress"), page: () => "/training?status=In%20Progress", pageLabel: msg("Open Training Tracking") },
  kpi: { title: msg("Performance Review {period}"), page: (period) => period ? `/performance?period=${period}` : "/performance", pageLabel: msg("Buka Performance Review") },
};

function TileDialog({ tile, period, members, reviewable, onClose, children }: { tile: TileKey; period: string; members: Members; reviewable: number; onClose: () => void; children: ReactNode }) {
  const { t, language } = useLanguage();
  const dialog = DIALOGS[tile];
  // Need training and Training in progress are the state today, so only the review list names the period.
  const description = tile === "dev" ? t("{count} pegawai sesuai filter punya development requirement yang belum selesai.", { count: members.dev.length })
    : tile === "training" ? t("{count} pegawai sesuai filter punya training In Progress.", { count: members.training.length })
    : t("{reviewed} dari {count} pegawai sesuai filter sudah direview.", { reviewed: members.reviewed.length, count: reviewable });
  return <FormModal title={t(dialog.title, { period: formatPeriod(period, language) })} description={description} size="lg" onClose={onClose}
    footer={<>
      <ButtonLink href={dialog.page(period)} testId={`summary-page-${tile}`} icon={<ArrowUpRight aria-hidden="true" className="size-4" />}>{t(dialog.pageLabel)}</ButtonLink>
      <Button data-testid="btn-summary-close" onClick={onClose}>{t("Close")}</Button>
    </>}>
    <div data-testid={`summary-dialog-${tile}`}>{children}</div>
  </FormModal>;
}

const profileHref = (row: SummaryRow) => `/dashboard/employee/${row.employee.id}${row.period ? `?period=${row.period}` : ""}`;

function Person({ row }: { row: SummaryRow }) {
  return <div className="min-w-0">
    <Link href={profileHref(row)} className={cx("font-semibold text-ink", textLink)}>{row.employee.fullName}</Link>
    <span className="block text-xs text-ink-3">{[row.employee.employeeId, row.position].filter(Boolean).join(" · ")}</span>
  </div>;
}

function Empty() {
  const { t } = useLanguage();
  return <p data-testid="summary-dialog-empty" className="text-sm text-ink-3">{t("Tidak ada pegawai lagi di daftar ini.")}</p>;
}

/** One line under a person: what the item is on the left, its action on the right; wraps under it on phones. */
function Item({ testId, children, action }: { testId: string; children: ReactNode; action?: ReactNode }) {
  return <li data-testid={testId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-app px-3 py-2.5">
    <div className="min-w-0 flex-1 basis-56">{children}</div>{action}
  </li>;
}

function NeedList({ snapshot, rows, onAction }: { snapshot: Snapshot; rows: readonly SummaryRow[]; onAction: (action: Action) => void }) {
  const { t } = useLanguage();
  if (!rows.length) return <Empty />;
  // Transcript 24 Nov 2026: one form for every requirement still without a training, instead of one per row.
  const waiting = needsWithoutTraining(snapshot, rows);
  return <>
  {waiting.length > 1 && <div data-testid="summary-bulk-training" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
    <span className="text-sm text-ink-2">{t("{count} requirement belum punya training.", { count: waiting.length })}</span>
    <Button variant="primary" data-testid="btn-summary-create-training-all" onClick={() => onAction({ kind: "bulk-training", needs: waiting, name: "" })}>{t("Create training for all ({count})", { count: waiting.length })}</Button>
  </div>}
  <ul className="divide-y divide-line">
    {rows.map((row) => {
      const writer = canAssess(snapshot, row.employee.id);
      return <li key={row.employee.id} data-testid={`summary-person-${row.employee.id}`} className="py-4 first:pt-0 last:pb-0">
        <Person row={row} />
        <ul className="mt-2 space-y-2">
          {openNeedsOf(snapshot, row.employee.id).map((need) => {
            const training = latestTrainingOf(snapshot, need);
            const running = training && (training.status === "Planned" || training.status === "In Progress");
            return <Item key={need.needId} testId={`summary-need-${need.needId}`}
              action={writer && !training ? <Button variant="secondary" data-testid={`btn-summary-create-training-${need.needId}`} onClick={() => onAction({ kind: "training", employeeId: row.employee.id, needId: need.needId, name: row.employee.fullName })}>{t("Create Training")}</Button>
                : writer && running ? <Button variant="secondary" data-testid={`btn-summary-update-progress-${training.trainingId}`} onClick={() => onAction({ kind: "progress", trainingId: training.trainingId, name: row.employee.fullName })}>{t("Update Progress")}</Button>
                : undefined}>
              <Link href={`/development/${need.needId}`} className={cx("text-sm text-ink", textLink)}>{need.objective}</Link>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                {/* A Completed training shows its result, so a Not Passed one does not read as done (Q16). */}
                {training ? <><StatusBadge status={training.status} />{training.status === "Completed" && training.result && <span className={cx("font-semibold", training.result === "Not Passed" ? "text-warning" : "text-success")}>{t(training.result)}</span>}<Link href={`/training/${training.trainingId}`} className={cx("min-w-0 truncate", textLink)}>{training.activity}</Link></>
                  : <span className="font-semibold text-warning">{t("Belum punya training")}</span>}
              </span>
            </Item>;
          })}
        </ul>
      </li>;
    })}
  </ul>
  </>;
}

function TrainingList({ snapshot, rows, onAction }: { snapshot: Snapshot; rows: readonly SummaryRow[]; onAction: (action: Action) => void }) {
  const { t, language } = useLanguage();
  if (!rows.length) return <Empty />;
  return <ul className="divide-y divide-line">
    {rows.map((row) => <li key={row.employee.id} data-testid={`summary-person-${row.employee.id}`} className="py-4 first:pt-0 last:pb-0">
      <Person row={row} />
      <ul className="mt-2 space-y-2">
        {trainingsInProgress(snapshot, row.employee.id).map((training) => <Item key={training.trainingId} testId={`summary-training-${training.trainingId}`}
          action={canAssess(snapshot, row.employee.id) ? <Button variant="secondary" data-testid={`btn-summary-update-progress-${training.trainingId}`} onClick={() => onAction({ kind: "progress", trainingId: training.trainingId, name: row.employee.fullName })}>{t("Update Progress")}</Button> : undefined}>
          <Link href={`/training/${training.trainingId}`} className={cx("text-sm text-ink", textLink)}>{training.activity}</Link>
          <span className="mt-1 block text-xs text-ink-3">{formatDate(training.date, language)}</span>
        </Item>)}
      </ul>
    </li>)}
  </ul>;
}

function Section({ title, count, testId, children }: { title: string; count: number; testId: string; children: ReactNode }) {
  return <section data-testid={testId} className="mt-6 first:mt-0">
    <h3 className="text-sm font-semibold text-ink">{title} <span className="font-normal tabular-nums text-ink-3">({count})</span></h3>
    <ul className="mt-2 divide-y divide-line">{children}</ul>
  </section>;
}

/** Waiting for a review first, since that is where the work is; then scorecards to fix, then the ones done. */
function ReviewList({ snapshot, period, members, onAction }: { snapshot: Snapshot; period: string; members: Members; onAction: (action: Action) => void }) {
  const { t, language } = useLanguage();
  const row = (item: SummaryRow, right: ReactNode) => <li key={item.employee.id} data-testid={`summary-person-${item.employee.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
    <div className="min-w-0 flex-1 basis-56"><Person row={item} /></div>
    <div className="flex flex-wrap items-center gap-3">{right}</div>
  </li>;
  const scorecardLink = (item: SummaryRow, label: string) => item.scorecard && <Link href={`/performance/scorecard/${item.scorecard.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">{label}<ArrowUpRight aria-hidden="true" className="size-4" /></Link>;
  if (!members.notReviewed.length && !members.invalid.length && !members.reviewed.length) return <Empty />;
  return <>
    {members.notReviewed.length > 0 && <Section title={t("Belum direview")} count={members.notReviewed.length} testId="summary-review-missing">
      {members.notReviewed.map((item) => {
        const writer = canAssess(snapshot, item.employee.id);
        const name = item.employee.fullName;
        const compiled = item.compiled;
        return row(item, compiled ? <>
          <span className="inline-flex items-center gap-2 text-sm tabular-nums text-ink">{formatScorecard({ overallScore: compiled.total, definitionVersion: compiled.definitionVersion })}<StatusBadge status="Compiled" /></span>
          {writer && <Button variant="secondary" data-testid={`btn-summary-finalize-${item.employee.id}`} onClick={() => onAction({ kind: "finalize", employeeId: item.employee.id, compiled, name })}>{t("Finalize")}</Button>}
        </> : writer ? <Button variant="secondary" data-testid={`btn-summary-add-review-${item.employee.id}`} onClick={() => onAction({ kind: "review", employeeId: item.employee.id, name })}>{t("Add Performance Review")}</Button>
          : <span className="text-sm text-ink-3">{t("Belum ada")}</span>);
      })}
    </Section>}
    {members.invalid.length > 0 && <Section title={t("Data tidak valid")} count={members.invalid.length} testId="summary-review-invalid">
      {members.invalid.map((item) => row(item, <>
        <span className="text-xs text-danger">{t("Total bobot KPI tidak 100%")}</span>
        {scorecardLink(item, t("View"))}
      </>))}
    </Section>}
    {members.reviewed.length > 0 && <Section title={t("Sudah direview")} count={members.reviewed.length} testId="summary-review-done">
      {members.reviewed.map((item) => {
        const band = item.scorecard && performanceBand(item.scorecard.overallScore, item.scorecard.definitionVersion);
        return row(item, <>
          <span className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-ink">{item.scorecard && formatScorecard(item.scorecard)}{band && <StatusBadge status={band} />}</span>
          {scorecardLink(item, t("View"))}
        </>);
      })}
    </Section>}
    {members.noKpi.length > 0 && <div className="mt-6"><Notice>{t("{count} pegawai tidak punya KPI di katalog {period}, jadi tidak bisa direview dan tidak dihitung: {names}.", { count: members.noKpi.length, period: formatPeriod(period, language), names: members.noKpi.map((item) => item.employee.fullName).join(", ") })}</Notice></div>}
  </>;
}

import { msg, plainText, type Translate } from "../../../shared/text";
import type { KpiDailyEntry } from "../../../supabase/types";

/** K5: how the compiled score is made (modules/d4/kpi/daily.ts), so it is not read as the plain average of daily totals. */
export const COMPILED_RULE = msg("Compiled score: skor tiap KPI dirata-rata dari hari yang terisi lalu dibulatkan ke bilangan bulat, kemudian dikali bobotnya dan dijumlahkan. Karena pembulatan per KPI, hasilnya bisa sedikit berbeda dari rata-rata Total harian.");

export type DailyLine = { score: string; comment: string };

/**
 * Why a typed score is refused, or "" when it is fine. The raw text is checked, not Number(text): Number reads
 * "1e2" as 100 and "85.5" as a decimal, and the scorecard only takes whole scores.
 */
export function scoreProblem(raw: string, max: number, t: Translate = plainText): string {
  const text = raw.trim();
  if (!text) return t("Wajib diisi, bilangan bulat 1 sampai {max}.", { max });
  if (!/^\d+$/.test(text)) return t("Hanya angka bulat 1 sampai {max}, tanpa koma, titik, atau huruf.", { max });
  const score = Number(text);
  return score < 1 || score > max ? t("Di luar rentang: isi 1 sampai {max}.", { max }) : "";
}

export type DailyForm = { date: string; correcting: boolean; lines: DailyLine[] };

/**
 * What "My KPI today" shows for a date (BUG-FN-D4-002, QA 17 Nov 2026): empty Score and Comment when Daily KPI opens,
 * after a Save and on a date pick, also for a day that already has an entry. Only Correct loads that day's saved scores
 * and comments, so a correction still starts from what was saved.
 */
export function openDailyForm(date: string, count: number, saved?: KpiDailyEntry, correct = false): DailyForm {
  const from = correct ? saved : undefined;
  return {
    date,
    correcting: Boolean(from),
    lines: Array.from({ length: count }, (_, index) => ({ score: from?.lines[index]?.raw_score?.toString() ?? "", comment: from?.lines[index]?.comment ?? "" })),
  };
}

/** Typed values that differ from what the form opened with; the server trims comments, so trailing spaces do not count. */
export const isDirty = (lines: readonly DailyLine[], saved: readonly DailyLine[]) =>
  lines.some((line, index) => line.score.trim() !== saved[index]?.score || line.comment.trim() !== saved[index]?.comment);

/** Corrections per day of one employee and period: every row after the first for the same date. */
export function correctionsByDay(entries: readonly KpiDailyEntry[], employeeId: string, period: string): Map<string, number> {
  const rows = new Map<string, number>();
  for (const entry of entries) if (entry.employeeId === employeeId && entry.period === period) rows.set(entry.entryDate, (rows.get(entry.entryDate) ?? 0) + 1);
  return new Map([...rows].filter(([, count]) => count > 1).map(([day, count]) => [day, count - 1]));
}

/** Monday to Friday from the first of the period up to today (the whole month once it is over). Holidays are not known here. */
export function workingDaysSoFar(period: string, today: string): number {
  if (period > today.slice(0, 7)) return 0;
  const [year, month] = period.split("-").map(Number);
  const last = period === today.slice(0, 7) ? Number(today.slice(8, 10)) : new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= last; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/**
 * Working days (Monday to Friday) of the running period before `today` that have no entry, oldest first. They can still
 * be filled one by one until the period ends; today has its own reminder. Lecturer, 22 Nov 2026: "kalau lupa isinya
 * lebih dari 1 hari?"
 */
export function missedWorkingDays(period: string, today: string, filled: ReadonlySet<string>): string[] {
  if (period !== today.slice(0, 7)) return [];
  const [year, month] = period.split("-").map(Number);
  const missed: string[] = [];
  for (let day = 1; day < Number(today.slice(8, 10)); day += 1) {
    const date = `${period}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !filled.has(date)) missed.push(date);
  }
  return missed;
}

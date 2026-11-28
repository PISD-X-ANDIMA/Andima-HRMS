import { KPI_TARGET } from "./catalog";

/**
 * KPI score scale per catalog version.
 *
 * V3.1 and V5.1 follow the Excel rule: integer raw score 1–5. Every later version (V6 onward) is scored 1–100
 * (interview D4, 14 Oct 2026: the daily KPI the company uses is 1–100 with a target of 85).
 * Scorecards keep the scale of the version they were saved under, so old 1–5 scorecards stay valid and readable.
 */
const FIVE_POINT_VERSIONS: readonly string[] = ["V3.1", "V5.1"];

/** Highest raw score (and overall score) a catalog version allows; unknown or missing version = the legacy 1–5. */
export const scaleMaxOf = (definitionVersion?: string | null): 5 | 100 =>
  !definitionVersion || FIVE_POINT_VERSIONS.includes(definitionVersion) ? 5 : 100;

/**
 * Typed text that reads as a number above the scale (999 or 1000 on 1–100). The score fields refuse such a keystroke
 * or paste, so the field never shows it; the API and the database check the same bound.
 */
export const aboveScale = (typed: string, max: number) => Number(typed.trim()) > max;

/**
 * Text a score field keeps of a keystroke or paste, or null to refuse it (BUG-FN-D4-001). Zeros in front of another digit
 * are dropped as they are typed, so "00085" reads "85" and "00000" reads "0"; a lone 0 stays visible and is refused on
 * Save with the 1–max range. Above the scale is refused as before. Performance Review and Daily KPI share this rule.
 */
export function typedScore(typed: string, max: number): string | null {
  // Digits only (lecturer, 24 Nov 2026): a minus, letter or decimal point is refused as typed, since the score is a whole number.
  if (/[^\d]/.test(typed.trim())) return null;
  const text = typed.trimStart().replace(/^0+(?=\d)/, "");
  return aboveScale(text, max) ? null : text;
}

/** A score as shown: a whole number without decimals ("100", not "100.00", lecturer 24 Nov 2026), otherwise two decimals; "—" without one. */
export const scoreText = (value: number | null | undefined) => value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2);

/** Interview D4 (14 Oct 2026): below 80 is Under Performance, 80–85 is Average Performance, above 85 is High Performance. */
export const UNDER_BELOW = 80;
export const HIGH_ABOVE = 85;

export type PerformanceBand = "Under Performance" | "Average Performance" | "High Performance";

/** Band of an overall score; only defined for 1–100 scorecards (a 1–5 score has no official threshold). */
export function performanceBand(score: number | null | undefined, definitionVersion?: string | null): PerformanceBand | null {
  if (score === null || score === undefined || scaleMaxOf(definitionVersion) !== 100) return null;
  if (score < UNDER_BELOW) return "Under Performance";
  return score <= HIGH_ABOVE ? "Average Performance" : "High Performance";
}

/**
 * KPI gap: score minus the target 85 (KPI_TARGET). Only 1–100 scores have one; a 1–5 score is not on the target's
 * scale and is not converted (FR-D4-002 defines no conversion), so its gap is null.
 */
export function kpiGap(score: number | null | undefined, definitionVersion?: string | null): number | null {
  if (score === null || score === undefined || scaleMaxOf(definitionVersion) !== 100) return null;
  return Math.round((score - Number(KPI_TARGET)) * 100) / 100;
}

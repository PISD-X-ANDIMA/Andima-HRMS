import { describe, expect, it } from "vitest";
import { scoreText, typedScore } from "@/modules/d4/kpi/scale";
import type { KpiDailyEntry } from "@/modules/d4/supabase/types";
import { listScore } from "@/modules/d4/web/data/selectors";
import { isDirty, openDailyForm, scoreProblem } from "@/modules/d4/web/features/daily/entry";
import { actualInput, scorecardTotal } from "@/modules/d4/web/features/kpi/KpiFormModal";

// BUG-FN-D4-001 (QA, 17 Nov 2026): Actual 1–100 accepted and showed "00000" and "00085".
describe("typedScore: score fields drop leading zeros (BUG-FN-D4-001)", () => {
  it("drops zeros in front of another digit, typed or pasted", () => {
    expect(typedScore("00085", 100)).toBe("85");
    expect(typedScore("0085", 100)).toBe("85");
    expect(typedScore("085", 100)).toBe("85");
    expect(typedScore("0100", 100)).toBe("100");
    expect(typedScore("05", 5)).toBe("5");
  });

  it("shrinks repeated zeros to one 0, which Save refuses with the 1–100 range", () => {
    expect(typedScore("00000", 100)).toBe("0");
    expect(typedScore("0", 100)).toBe("0");
    expect(scoreProblem(typedScore("00000", 100) ?? "", 100)).toBe("Di luar rentang: isi 1 sampai 100.");
    expect(actualInput(typedScore("00000", 100) ?? "").raw_score).toBe(0);
  });

  it("still refuses text above the scale, so at most three digits fit", () => {
    for (const typed of ["150", "101", "1000", "000150"]) expect(typedScore(typed, 100), typed).toBeNull();
    expect(typedScore("6", 5)).toBeNull();
  });

  // Lecturer (24 Nov 2026): a minus could be typed into Actual; letters and decimals are refused the same way.
  it("refuses a minus, letter, exponent or decimal point as typed, so it never turns into another number", () => {
    for (const typed of ["-", "-5", "8.5", "0.5", "9.", "1e2", "+5", "abc", "8a"]) expect(typedScore(typed, 100), typed).toBeNull();
    expect(typedScore("", 100)).toBe("");
    expect(scoreProblem("8.5", 100)).toMatch(/angka bulat 1 sampai 100/);
  });

  it("keeps Weighted and Total as before for the cleaned value (regression)", () => {
    const lines = ["00085", "090", "0100", "70", "080"].map((typed, index) => ({ weight_percent: [25, 25, 20, 15, 15][index], ...actualInput(typedScore(typed, 100) ?? "") }));
    expect(lines.map((line) => line.actual)).toEqual(["85", "90", "100", "70", "80"]);
    expect(scorecardTotal(lines, 100)).toBe(86.25);
  });
});

// BUG-FN-D4-002 (QA, 17 Nov 2026): Score and Comment still showed the saved values when Daily KPI was opened again.
describe("openDailyForm: Daily KPI opens empty, Correct loads the saved day (BUG-FN-D4-002)", () => {
  const saved = {
    id: "d1", employeeId: "e1", period: "2026-11", entryDate: "2026-11-23", createdAt: "2026-11-23T09:00:00Z",
    lines: [100, 90, 100, 90, 85].map((score, index) => ({ indicator_order: index + 1, raw_score: score, comment: `catatan ${index + 1}` })),
  } as unknown as KpiDailyEntry;

  it("opens empty on a day that already has an entry: on page load, after Save and on a date pick", () => {
    const form = openDailyForm("2026-11-23", 5, saved);
    expect(form.correcting).toBe(false);
    expect(form.lines).toEqual(Array.from({ length: 5 }, () => ({ score: "", comment: "" })));
  });

  it("loads the saved scores and comments only for Correct", () => {
    const form = openDailyForm("2026-11-23", 5, saved, true);
    expect(form.correcting).toBe(true);
    expect(form.lines.map((line) => line.score)).toEqual(["100", "90", "100", "90", "85"]);
    expect(form.lines[0].comment).toBe("catatan 1");
  });

  it("counts as unchanged right after opening either way, so leaving the page asks nothing", () => {
    for (const form of [openDailyForm("2026-11-23", 5, saved), openDailyForm("2026-11-23", 5, saved, true)]) expect(isDirty(form.lines, form.lines)).toBe(false);
    const blank = openDailyForm("2026-11-23", 5, saved);
    expect(isDirty(blank.lines.map((line, index) => index === 0 ? { ...line, score: "80" } : line), blank.lines)).toBe(true);
  });
});

// PST 2: the scale stands once in the "Total KPI (/100)" header, also in the People Dashboard table.
describe("listScore: the scale is in the header, not on every row", () => {
  it("shows the bare number for a row on the list's scale", () => {
    expect(listScore(82.5, "V6", 100)).toBe("82.50");
    expect(listScore(null, "V6", 100)).toBe("—");
  });

  it("keeps the scale of a row saved on the other one", () => {
    expect(listScore(4.1, "V5.1", 100)).toBe("4.10 / 5");
  });
});

// Lecturer (24 Nov 2026): a total of "100.00" reads as noise; whole numbers drop the decimals.
describe("scoreText: whole scores without trailing zeros", () => {
  it("drops .00 from a whole number and keeps two decimals otherwise", () => {
    expect(scoreText(100)).toBe("100");
    expect(scoreText(85)).toBe("85");
    expect(scoreText(86.25)).toBe("86.25");
    expect(scoreText(82.5)).toBe("82.50");
    expect(scoreText(null)).toBe("—");
    expect(listScore(90, "V6", 100)).toBe("90");
  });
});

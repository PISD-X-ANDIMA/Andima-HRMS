import { describe, expect, it } from "vitest";
import { correctionsByDay, isDirty, missedWorkingDays, scoreProblem, workingDaysSoFar } from "@/modules/d4/web/features/daily/entry";
import type { KpiDailyEntry } from "@/modules/d4/supabase/types";

describe("scoreProblem (K22)", () => {
  it("accepts whole numbers typed as digits within the scale", () => {
    expect(scoreProblem("1", 100)).toBe("");
    expect(scoreProblem(" 85 ", 100)).toBe("");
    expect(scoreProblem("100", 100)).toBe("");
    expect(scoreProblem("5", 5)).toBe("");
  });

  it("rejects exponent, decimal, sign and letters instead of reading them as numbers", () => {
    for (const raw of ["1e2", "85.5", "85,5", "-5", "+5", "abc", "0x10"]) expect(scoreProblem(raw, 100), raw).toMatch(/angka bulat 1 sampai 100/);
  });

  it("names the range for empty and out-of-range scores", () => {
    expect(scoreProblem("", 100)).toMatch(/Wajib diisi/);
    expect(scoreProblem("0", 100)).toMatch(/1 sampai 100/);
    expect(scoreProblem("101", 100)).toMatch(/1 sampai 100/);
    expect(scoreProblem("6", 5)).toMatch(/1 sampai 5/);
  });
});

describe("isDirty (K12)", () => {
  const saved = [{ score: "80", comment: "ok" }, { score: "", comment: "" }];
  it("is clean when the form shows what is saved, ignoring spaces the server trims", () => {
    expect(isDirty([{ score: "80 ", comment: "ok  " }, { score: "", comment: "" }], saved)).toBe(false);
  });
  it("is dirty after a score or a comment changes", () => {
    expect(isDirty([{ score: "81", comment: "ok" }, { score: "", comment: "" }], saved)).toBe(true);
    expect(isDirty([{ score: "80", comment: "ok" }, { score: "", comment: "new" }], saved)).toBe(true);
  });
});

describe("correctionsByDay (W3)", () => {
  const row = (day: string, createdAt: string, patch: Partial<KpiDailyEntry> = {}) =>
    ({ id: `${day}-${createdAt}`, employeeId: "e1", period: "2026-11", entryDate: `2026-11-${day}`, createdAt, ...patch }) as KpiDailyEntry;
  it("counts every saved row after the first of a day, for one employee and period", () => {
    const counts = correctionsByDay([row("05", "a"), row("05", "b"), row("05", "c"), row("06", "a"), row("05", "d", { employeeId: "e2" }), row("05", "e", { period: "2026-10" })], "e1", "2026-11");
    expect([...counts]).toEqual([["2026-11-05", 2]]);
  });
});

describe("workingDaysSoFar (R1)", () => {
  it("counts Monday to Friday up to today in the running month", () => {
    // 1 Nov 2026 is a Sunday; 12 Nov is a Thursday: 2-6 and 9-12 November.
    expect(workingDaysSoFar("2026-11", "2026-11-12")).toBe(9);
  });
  it("counts the whole month once it is over, and nothing for a future month", () => {
    expect(workingDaysSoFar("2026-10", "2026-11-12")).toBe(22);
    expect(workingDaysSoFar("2026-12", "2026-11-12")).toBe(0);
  });
});

describe("missed Daily KPI days (lecturer, 22 Nov 2026)", () => {
  it("lists the empty working days before today, oldest first, without weekends", () => {
    // Fri 20, Sat 21, Sun 22 Nov 2026: the weekend is not a missed day, today has its own reminder.
    expect(missedWorkingDays("2026-11", "2026-11-23", new Set(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"])))
      .toEqual(["2026-11-02", "2026-11-20"]);
  });
  it("offers nothing outside the running period, which can no longer be filled", () => {
    expect(missedWorkingDays("2026-10", "2026-11-23", new Set())).toEqual([]);
  });
});

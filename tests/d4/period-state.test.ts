import { describe, expect, it } from "vitest";
import { assertReopening, openPeriods, periodState, previousMonth, reopenablePeriods, type PeriodReopening } from "@/modules/d4/shared/rules";

// 03:00 UTC is 10:00 WIB, the same day in Jakarta.
const at = (day: string) => new Date(`${day}T03:00:00Z`);
const reopen = (period: string, openUntil: string, createdAt = "2026-11-20T01:00:00Z"): PeriodReopening => ({ period, openUntil, reason: "Uji", createdAt });

describe("open and closed assessment periods (lecturer review, 24 Nov 2026)", () => {
  it("opens the running month and the one before, closes older ones", () => {
    const now = at("2026-11-24");
    expect(periodState("2026-11", [], now)).toBe("open");
    expect(periodState("2026-10", [], now)).toBe("open");
    expect(periodState("2026-09", [], now)).toBe("closed");
    expect(periodState("2026-12", [], now)).toBe("not-started");
    expect(periodState("2026-08", [], now)).toBe("before-start");
    expect(openPeriods([], now)).toEqual(["2026-11", "2026-10"]);
  });

  it("closes last month on the first day of the next one, in WIB", () => {
    // 30 Nov 17:30 UTC is already 1 Dec 00:30 in Jakarta.
    expect(periodState("2026-10", [], new Date("2026-11-30T16:30:00Z"))).toBe("open");
    expect(periodState("2026-10", [], new Date("2026-11-30T17:30:00Z"))).toBe("closed");
  });

  it("crosses the year: in January, December is last month", () => {
    expect(previousMonth("2027-01")).toBe("2026-12");
    expect(openPeriods([], at("2027-01-05"))).toEqual(["2027-01", "2026-12"]);
  });

  it("keeps a reopened period open up to and including its last day", () => {
    const rows = [reopen("2026-09", "2026-11-30")];
    expect(periodState("2026-09", rows, at("2026-11-30"))).toBe("open");
    expect(periodState("2026-09", rows, at("2026-12-01"))).toBe("closed");
    expect(openPeriods(rows, at("2026-11-24"))).toEqual(["2026-11", "2026-10", "2026-09"]);
  });

  it("lets the newest row decide, so HR can close a reopened period early", () => {
    const rows = [reopen("2026-09", "2026-12-31", "2026-11-20T01:00:00Z"), reopen("2026-09", "2026-11-21", "2026-11-22T01:00:00Z")];
    expect(periodState("2026-09", rows, at("2026-11-24"))).toBe("closed");
  });

  it("never opens a period before September 2026, even when a row names it", () => {
    expect(periodState("2026-08", [reopen("2026-08", "2026-12-31")], at("2026-11-24"))).toBe("before-start");
  });

  it("lists the periods HR can reopen: from September 2026 up to the month before last", () => {
    expect(reopenablePeriods(at("2026-11-24"))).toEqual(["2026-09"]);
    expect(reopenablePeriods(at("2026-10-05"))).toEqual([]);
    expect(reopenablePeriods(at("2027-01-05"))).toEqual(["2026-11", "2026-10", "2026-09"]);
  });

  it("checks a reopening like the table does", () => {
    const now = at("2026-11-24");
    expect(() => assertReopening({ period: "2026-09", openUntil: "2026-11-30", reason: "Terlambat" }, now)).not.toThrow();
    expect(() => assertReopening({ period: "2026-10", openUntil: "2026-11-30", reason: "Terlambat" }, now)).toThrow(/terbuka dengan sendirinya/);
    expect(() => assertReopening({ period: "2026-09", openUntil: "2026-08-31", reason: "Terlambat" }, now)).toThrow(/awal periode/);
    expect(() => assertReopening({ period: "2026-09", openUntil: "2026-11-30", reason: "    " }, now)).toThrow(/5 sampai 500/);
  });
});

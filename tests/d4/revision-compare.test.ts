import { describe, expect, it } from "vitest";
import { totalComparison } from "@/modules/d4/web/features/kpi/KpiFormModal";

// R2 (dosen, 10 Nov 2026): when a score is changed the evaluator must still see the value before the change, and
// whether the new total is lower, in words.
describe("total of a Performance Review revision against the saved one", () => {
  it("says the new total is lower, with the difference", () => {
    expect(totalComparison(82, 80)).toBe("Saved total 82 · New total 80 · Lower than saved (-2)");
  });
  it("says the new total is higher, with the difference", () => {
    expect(totalComparison(82, 84.5)).toBe("Saved total 82 · New total 84.50 · Higher than saved (+2.50)");
  });
  it("says when nothing changed", () => {
    expect(totalComparison(82, 82)).toBe("Saved total 82 · New total 82 · sama dengan yang tersimpan");
  });
  it("keeps the saved total visible while a score is still empty", () => {
    expect(totalComparison(82, null)).toBe("Saved total 82. Isi semua Actual untuk melihat total baru.");
  });
});

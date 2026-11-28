import { describe, expect, it } from "vitest";
import { pageWindow } from "@/modules/d4/web/ui/DataTable";

// Load test: 1000 rows = 100 pages; the footer shows a handful of buttons, never all of them.
describe("pageWindow", () => {
  it("shows first, last and neighbours with gaps", () => {
    expect(pageWindow(50, 100)).toEqual([1, "gap", 49, 50, 51, "gap", 100]);
    expect(pageWindow(1, 100)).toEqual([1, 2, "gap", 100]);
    expect(pageWindow(100, 100)).toEqual([1, "gap", 99, 100]);
  });
  it("lists every page when there are few", () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
  // D4-UI-01: a gap that would hide exactly one page shows that page instead of "…".
  it("never hides a single page behind a gap", () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(4, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 5)).toEqual([1, 2, "gap", 5]);
  });
});

import { describe, expect, it } from "vitest";
import { dropdownPlacement } from "@/modules/d4/web/ui/forms";

// D4-UI-02: the open list is fixed to the viewport, so a scrolling modal body cannot clip it.
describe("dropdownPlacement", () => {
  it("opens below the trigger with the trigger's width", () => {
    // "Pilih pegawai" in the Simulasi Employee modal at 1440×900 (body ended at y 519, the list was drawn below it).
    expect(dropdownPlacement({ top: 465, bottom: 505, left: 431, width: 578 }, 900))
      .toEqual({ top: "509px", bottom: "", left: "431px", width: "578px", maxHeight: "320px" });
  });
  it("opens above when there is more room there", () => {
    expect(dropdownPlacement({ top: 800, bottom: 840, left: 16, width: 343 }, 900))
      .toEqual({ top: "", bottom: "104px", left: "16px", width: "343px", maxHeight: "320px" });
  });
  it("fits its height into the room left", () => {
    expect(dropdownPlacement({ top: 100, bottom: 140, left: 0, width: 200 }, 400).maxHeight).toBe("248px");
  });
});

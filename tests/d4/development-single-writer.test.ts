import { describe, expect, it } from "vitest";
import type { DevelopmentNeedVersion } from "@/modules/d4/development/types";
import { closeGapBlockedReason, statusFromTrainings, trainingSyncRevision } from "@/modules/d4/shared/rules";
import type { TrainingStatus } from "@/modules/d4/training/types";

// Decision 13 Nov 2026: Training Tracking is the one writer of a requirement's progress.
const training = (status: TrainingStatus, createdAt = "2026-11-05T00:00:00.000Z", result = "") => ({ developmentNeedId: "n1", status, result, createdAt });
const need = (patch: Partial<DevelopmentNeedVersion> = {}): DevelopmentNeedVersion => ({
  id: "v1", needId: "n1", revision: 1, source: "supabase", employeeId: "e1", sourceType: "competency_gap", sourceRef: "r1", objective: "Uji",
  priority: "High", method: "Coaching", pic: "Bu Maya", reassessment: null, status: "Identified", notes: "", createdAt: "2026-11-01T00:00:00.000Z", actor: "HR", ...patch,
} as DevelopmentNeedVersion);

describe("statusFromTrainings", () => {
  it.each([
    ["no training", [], "Identified"],
    ["only Cancelled", [training("Cancelled")], "Identified"],
    ["only Planned", [training("Planned"), training("Planned")], "Planned"],
    ["Planned and Cancelled", [training("Planned"), training("Cancelled")], "Planned"],
    ["one In Progress", [training("Planned"), training("In Progress")], "In Progress"],
    ["Completed awaiting a decision", [training("Completed", undefined, "Passed")], "In Progress"],
    ["Completed Not Passed", [training("Completed", undefined, "Not Passed")], "In Progress"],
  ] as const)("%s gives %s", (_name, trainings, expected) => {
    expect(statusFromTrainings(trainings, "n1")).toBe(expected);
  });

  it("counts only the round after the last Retraining, and only this requirement's trainings", () => {
    const trainings = [training("Completed", "2026-11-02T00:00:00.000Z", "Passed"), training("Planned", "2026-11-04T00:00:00.000Z"), { ...training("In Progress"), developmentNeedId: "n2" }];
    expect(statusFromTrainings(trainings, "n1", "2026-11-03T00:00:00.000Z")).toBe("Planned");
  });
});

describe("trainingSyncRevision", () => {
  it("writes the derived status with a system note and keeps priority, method and PIC", () => {
    expect(trainingSyncRevision(need(), [training("Planned")], [])).toEqual({ status: "Planned", notes: "Mengikuti Training Tracking.", priority: "High", method: "Coaching", pic: "Bu Maya", reassessment: null });
  });

  it("writes nothing when the status already matches or the requirement is Completed", () => {
    expect(trainingSyncRevision(need({ status: "Planned" }), [training("Planned")], [])).toBeNull();
    expect(trainingSyncRevision(need({ status: "Completed" }), [training("Cancelled")], [])).toBeNull();
  });
});

describe("closeGapBlockedReason (path B)", () => {
  const met = { competencyName: "Tax Reporting", requiredLevel: 4, actualLevel: 4, status: "Terpenuhi" as const };
  it("allows a gap requirement with the level met and no open training", () => {
    expect(closeGapBlockedReason(need(), met, 0)).toBe("");
  });

  it.each([
    ["not from a competency gap", need({ sourceType: "performance_context" }), met, 0, /Hanya requirement dari Competency Gap/],
    ["already Completed", need({ status: "Completed" }), met, 0, /sudah Completed/],
    ["a training still open", need(), met, 1, /Training Tracking/],
    ["not part of the current position", need(), undefined, 0, /bukan bagian dari posisi/],
    ["the level below the minimum", need(), { ...met, actualLevel: 2, status: "Gap" as const }, 0, /level saat ini 2, required 4/],
  ] as const)("refuses %s", (_name, requirement, finding, open, message) => {
    expect(closeGapBlockedReason(requirement, finding, open)).toMatch(message);
  });
});

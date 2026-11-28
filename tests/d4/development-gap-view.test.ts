import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentNeedVersion } from "@/modules/d4/development/types";
import { compareCompetencies } from "@/modules/d4/competency/service";
import { currentGap, DEFAULT_SOURCE_TYPE, employeeById, positionOf, sourceTypeLabel, visibleEmployees } from "@/modules/d4/web/data/selectors";
import { closingRequirement, findingLogic, formatDifference } from "@/modules/d4/web/features/competency/rows";
import { picOptions } from "@/modules/d4/web/features/development/rows";

// Employees are picked by id, never by name: the fixture names follow the organisation master.
const HR_ACTOR = "d4000000-0000-4000-8000-000000000012";

async function fixtureSnapshot() {
  vi.stubEnv("NEXT_PUBLIC_D4_FIXTURE_ROLE", "HR");
  vi.resetModules();
  const { createFixtureSource } = await import("@/modules/d4/web/data/fixture-source");
  return createFixtureSource().loadSnapshot();
}
afterEach(() => { vi.unstubAllEnvs(); });

describe("Development Requirement source (Q9)", () => {
  it("starts from a competency gap and keeps Position Change and Performance Review as other sources", () => {
    expect(DEFAULT_SOURCE_TYPE).toBe("competency_gap");
    expect(Object.keys(sourceTypeLabel)).toEqual(["competency_gap", "role_change", "performance_context"]);
  });
});

describe("PIC picked from the employee list (Q13)", () => {
  it("offers every employee once, by name, labelled with the position", async () => {
    const snapshot = await fixtureSnapshot();
    const options = picOptions(snapshot);
    const names = [...new Set(visibleEmployees(snapshot).map((item) => item.fullName))];
    expect(options.map((item) => item.value).sort()).toEqual(names.sort());
    const hr = employeeById(snapshot, HR_ACTOR)!;
    expect(options.find((item) => item.value === hr.fullName)?.label).toBe(`${hr.fullName} · ${positionOf(snapshot, hr)!.title}`);
  });

  it("keeps an older free-text PIC selectable so editing never blanks it, without duplicating an employee name", async () => {
    const snapshot = await fixtureSnapshot();
    const plain = picOptions(snapshot);
    const legacy = picOptions(snapshot, " Bu Rina (Finance) ");
    expect(legacy[0]).toEqual({ value: "Bu Rina (Finance)", label: "Bu Rina (Finance) (not in employee list)" });
    expect(legacy.slice(1)).toEqual(plain);
    expect(picOptions(snapshot, employeeById(snapshot, HR_ACTOR)!.fullName)).toEqual(plain);
    expect(picOptions(snapshot, "  ")).toEqual(plain);
  });
});

describe("Competency Gap detail logic per competency (Q15)", () => {
  const finding = (actualLevel: number | null, evidenceNotes: string | null, requiredLevel = 4) => ({ requiredLevel, actualLevel, evidenceNotes });

  it("explains each status with the difference: below the requirement, met, missing level, missing evidence", () => {
    expect(findingLogic(finding(3, "Audit"))).toEqual({ difference: -1, reason: "Level 3 di bawah minimal 4: kurang 1 level." });
    expect(findingLogic(finding(4, "Audit"))).toEqual({ difference: 0, reason: "Level 4 memenuhi minimal 4." });
    expect(findingLogic(finding(5, "Audit")).difference).toBe(1);
    expect(findingLogic(finding(null, null))).toEqual({ difference: null, reason: "Level belum tercatat, jadi belum bisa dibandingkan dengan minimal 4." });
    // Below the requirement without evidence is Insufficient Data, not a Gap.
    expect(findingLogic(finding(2, "  "))).toEqual({ difference: -2, reason: "Level 2 belum punya bukti, jadi belum disimpulkan Gap atau Met." });
  });

  it("formats the difference with a sign, and a dash while no level is recorded", () => {
    expect([-2, -1, 0, 1].map(formatDifference)).toEqual(["−2", "−1", "0", "+1"]);
    expect(formatDifference(null)).toBe("—");
  });

  it("agrees with compareCompetencies on every fixture finding", async () => {
    const snapshot = await fixtureSnapshot();
    const findings = visibleEmployees(snapshot).flatMap((employee) => currentGap(snapshot, employee)?.findings ?? []);
    expect(findings.length).toBeGreaterThan(0);
    for (const item of findings) {
      const { difference, reason } = findingLogic(item);
      if (item.status === "Gap") expect(difference !== null && difference < 0 && reason.includes("kurang")).toBe(true);
      if (item.status === "Terpenuhi") expect(difference !== null && difference >= 0 && reason.includes("memenuhi")).toBe(true);
      if (item.status === "Bukti Belum Cukup") expect(/belum tercatat|belum punya bukti/.test(reason)).toBe(true);
    }
    // The same rule on a level below the requirement whose evidence is missing.
    const { reference } = snapshot;
    const skill = reference.employeeSkills[0];
    const requirement = reference.positionRequirements.find((item) => item.competencyId === skill.competencyId)!;
    const noEvidence = { ...reference, employeeSkills: [{ ...skill, proficiencyLevel: requirement.minProficiencyLevel - 1, evidenceNotes: "" }] };
    const [result] = compareCompetencies(skill.employeeId, requirement.positionId, noEvidence).findings.filter((item) => item.requirementId === requirement.id);
    expect(result.status).toBe("Bukti Belum Cukup");
    expect(findingLogic(result).reason).toMatch(/belum punya bukti/);
  });

  it("links the unfinished requirement first, otherwise the latest one, only for the same employee and gap", () => {
    const need = (patch: Partial<DevelopmentNeedVersion>): DevelopmentNeedVersion => ({
      id: "V", needId: "N", revision: 1, source: "fixture", employeeId: "E1", sourceType: "competency_gap", sourceRef: "REQ-1",
      objective: "Uji", priority: "Medium", status: "Completed", notes: "", createdAt: "2026-10-01T08:00:00.000Z", actor: "HR", ...patch,
    });
    const older = need({ needId: "OLD", createdAt: "2026-09-01T08:00:00.000Z" });
    const newer = need({ needId: "NEW", createdAt: "2026-10-05T08:00:00.000Z" });
    const open = need({ needId: "OPEN", status: "Planned", createdAt: "2026-08-01T08:00:00.000Z" });
    const other = [need({ needId: "X1", employeeId: "E2", status: "Planned" }), need({ needId: "X2", sourceRef: "REQ-2", status: "Planned" }), need({ needId: "X3", sourceType: "role_change", status: "Planned" })];
    expect(closingRequirement([older, newer, ...other], "E1", "REQ-1")?.needId).toBe("NEW");
    expect(closingRequirement([older, newer, open, ...other], "E1", "REQ-1")?.needId).toBe("OPEN");
    expect(closingRequirement(other, "E1", "REQ-1")).toBeUndefined();
  });
});

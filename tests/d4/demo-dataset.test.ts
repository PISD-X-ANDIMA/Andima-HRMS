import { describe, expect, it } from "vitest";
import { compareCompetencies } from "@/modules/d4/competency/service";
import { createDemoSeed, DEMO_LEVEL_SCALE, DEMO_PERSONAS, DEMO_POSITION_ROLES, DEMO_TODAY, demoKpiTotal } from "@/modules/d4/demo/dataset";
import { indicatorsFor, KPI_V51_CATALOG, roleForPositionTitle, selectCatalog } from "@/modules/d4/kpi/catalog";
import { validatePerformanceInput } from "@/modules/d4/performance/validation";
import { latestDevelopment, latestTraining, type D4LiveSnapshot } from "@/modules/d4/supabase/types";

const seed: D4LiveSnapshot = { ...createDemoSeed(), role: "HR", actorEmployeeId: DEMO_PERSONAS[0].employeeId };
const ref = seed.reference;
const catalog = selectCatalog(KPI_V51_CATALOG);
const employee = (id: string) => ref.employees.find((item) => item.id === id);
const positionTitle = (employeeId: string) => ref.positions.find((item) => item.id === employee(employeeId)?.positionId)?.title;
const unique = (ids: readonly string[]) => new Set(ids).size === ids.length;
const BANNED = ["gabriella", "geby", "keizia", "raka", "delta", "kevin", "arslanian", "andima", "alfa", "bravo", "charlie", "echo", "foxtrot", "golf", "hotel", "india", "juliett", "kilo", "lima", "mike", "november", "oscar", "mercury"];

describe("demo dataset: shape and integrity", () => {
  it("has the expected size and a fresh copy per call", () => {
    expect(ref.source).toBe("fixture");
    expect(seed.kpi).toEqual([]);
    expect(ref.employees.length).toBeGreaterThanOrEqual(40);
    expect(ref.employees.length).toBeLessThanOrEqual(50);
    expect(ref.competencies.length).toBeGreaterThanOrEqual(15);
    const other = createDemoSeed();
    expect({ ...other, role: seed.role, actorEmployeeId: seed.actorEmployeeId }).toEqual(seed);
    expect(other.reference.employees).not.toBe(seed.reference.employees);
  });

  it("uses unique ids everywhere", () => {
    for (const ids of [ref.departments, ref.positions, ref.employees, ref.competencies, ref.positionRequirements, ref.employeeSkills,
      seed.performance, seed.kpiAssessments ?? [], seed.competency, seed.developmentVersions, seed.trainingVersions].map((list) => list.map((item) => item.id))) {
      expect(unique(ids)).toBe(true);
    }
    expect(unique(ref.employees.map((item) => item.employeeId))).toBe(true);
    expect(unique(ref.employees.map((item) => item.fullName))).toBe(true);
    for (const item of ref.employees) expect(item.employeeId).toMatch(/^ATI-20\d\d-\d{3}$/);
  });

  it("resolves every foreign key", () => {
    const has = (list: readonly { id: string }[], id: string | null) => list.some((item) => item.id === id);
    for (const item of ref.positions) expect(has(ref.departments, item.departmentId)).toBe(true);
    for (const item of ref.employees) { expect(has(ref.positions, item.positionId)).toBe(true); expect(has(ref.departments, item.departmentId)).toBe(true); }
    for (const item of ref.positionRequirements) { expect(has(ref.positions, item.positionId)).toBe(true); expect(has(ref.competencies, item.competencyId)).toBe(true); }
    for (const item of ref.employeeSkills) { expect(has(ref.employees, item.employeeId)).toBe(true); expect(has(ref.competencies, item.competencyId)).toBe(true); }
    for (const list of [seed.performance, seed.kpiAssessments ?? [], seed.competency, seed.developmentVersions, seed.trainingVersions]) {
      for (const item of list) expect(has(ref.employees, item.employeeId)).toBe(true);
    }
    for (const item of seed.competency) expect(has(ref.positions, item.positionId)).toBe(true);
  });

  it("uses fictional names only and real dataset people as actors", () => {
    for (const item of ref.employees) {
      const words = item.fullName.toLowerCase().split(/\s+/);
      for (const banned of BANNED) expect(words).not.toContain(banned);
    }
    const names = new Set(ref.employees.map((item) => item.fullName));
    const actors = [...seed.performance.flatMap((item) => [item.actor, item.evaluator]), ...(seed.kpiAssessments ?? []).flatMap((item) => [item.actor, item.evaluatorName]),
      ...seed.competency.map((item) => item.actor), ...seed.developmentVersions.map((item) => item.actor), ...seed.trainingVersions.map((item) => item.actor)];
    for (const actor of actors) expect(names.has(actor)).toBe(true);
  });

  it("keeps levels within 1..5 and has 3–5 requirements per position, some optional", () => {
    expect(DEMO_LEVEL_SCALE.map((item) => item.level)).toEqual([1, 2, 3, 4, 5]);
    for (const item of ref.employeeSkills) expect(item.proficiencyLevel).toBeGreaterThanOrEqual(1);
    for (const item of ref.employeeSkills) expect(item.proficiencyLevel).toBeLessThanOrEqual(5);
    for (const item of ref.positionRequirements) expect([1, 2, 3, 4, 5]).toContain(item.minProficiencyLevel);
    for (const position of ref.positions) {
      const count = ref.positionRequirements.filter((item) => item.positionId === position.id).length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(ref.positionRequirements.some((item) => !item.isMandatory)).toBe(true);
  });

  it("keeps all dates on or before DEMO_TODAY except planned future training", () => {
    const today = DEMO_TODAY;
    for (const item of seed.performance) { expect(item.evaluationDate <= today).toBe(true); expect(item.createdAt.slice(0, 10) <= today).toBe(true); }
    for (const item of seed.kpiAssessments ?? []) { expect(item.evaluationDate <= today).toBe(true); expect(item.createdAt.slice(0, 10) <= today).toBe(true); }
    for (const item of [...seed.competency, ...seed.developmentVersions, ...seed.trainingVersions]) expect(item.createdAt.slice(0, 10) <= today).toBe(true);
    for (const item of seed.trainingVersions) if (item.date > today) expect(item.status).toBe("Planned");
  });
});

describe("demo dataset: personas", () => {
  it("has HR, Manager and Employee personas that exist", () => {
    expect(DEMO_PERSONAS.map((item) => [item.key, item.role])).toEqual([["hr", "HR"], ["manager", "MANAGER"], ["employee", "EMPLOYEE"]]);
    for (const persona of DEMO_PERSONAS) {
      expect(employee(persona.employeeId)).toBeDefined();
      expect(positionTitle(persona.employeeId)).toBe(persona.title);
    }
  });

  it("puts the employee persona in the manager persona's department of at least 6 staff", () => {
    const manager = employee(DEMO_PERSONAS[1].employeeId)!;
    const staff = ref.employees.filter((item) => item.departmentId === manager.departmentId && item.id !== manager.id);
    expect(staff.length).toBeGreaterThanOrEqual(6);
    expect(employee(DEMO_PERSONAS[2].employeeId)?.departmentId).toBe(manager.departmentId);
  });

  it("gives the employee persona a rich history", () => {
    const id = DEMO_PERSONAS[2].employeeId;
    expect(seed.performance.filter((item) => item.employeeId === id).length).toBeGreaterThanOrEqual(3);
    expect((seed.kpiAssessments ?? []).filter((item) => item.employeeId === id).length).toBeGreaterThanOrEqual(3);
    expect(compareCompetencies(id, employee(id)!.positionId!, ref).findings.some((item) => item.status === "Gap")).toBe(true);
    expect(latestDevelopment(seed).some((item) => item.employeeId === id)).toBe(true);
    expect(latestTraining(seed).some((item) => item.employeeId === id)).toBe(true);
  });
});

describe("demo dataset: KPI", () => {
  it("maps every position title to the intended KPI role", () => {
    for (const [, , title, , role] of DEMO_POSITION_ROLES) expect([title, roleForPositionTitle(catalog, title)]).toEqual([title, role]);
    const noKpi = DEMO_POSITION_ROLES.filter(([, , , , role]) => role === 0);
    expect(noKpi.length).toBeGreaterThanOrEqual(2);
    expect(noKpi.length).toBeLessThanOrEqual(3);
  });

  it("has at least two employees for every KPI role", () => {
    for (let role = 1; role <= 10; role++) {
      expect(ref.employees.filter((item) => roleForPositionTitle(catalog, positionTitle(item.id)) === role).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("builds every scorecard from the employee's role with the V5.1 formula", () => {
    const scorecards = seed.kpiAssessments ?? [];
    expect(scorecards.length).toBeGreaterThan(80);
    for (const item of scorecards) {
      expect(item.roleOrder).toBe(roleForPositionTitle(catalog, positionTitle(item.employeeId)));
      expect(item.definitionVersion).toBe(catalog.version);
      expect(item.status).toBe("completed");
      expect(item.lines).toHaveLength(5);
      expect(item.lines.map((line) => line.kpi_name)).toEqual(indicatorsFor(catalog, item.roleOrder).map((row) => row.kpi_name));
      expect(item.lines.reduce((sum, line) => sum + line.weight_percent, 0)).toBe(100);
      for (const line of item.lines) { expect(line.raw_score).not.toBeNull(); expect(line.target).not.toBe(""); expect(line.actual).not.toBe(""); }
      const expected = Math.round(item.lines.reduce((sum, line) => sum + line.weight_percent * (line.raw_score ?? 0) / 100, 0) * 100) / 100;
      expect(item.overallScore).toBe(expected);
      expect(demoKpiTotal(item.lines)).toBe(expected);
      expect(["2026-03", "2026-06", "2026-09"]).toContain(item.period);
      expect(item.evaluatorName).not.toBe(employee(item.employeeId)?.fullName);
      expect(item.generalNotes.trim()).not.toBe("");
    }
  });
});

describe("demo dataset: performance and revisions", () => {
  it("passes validatePerformanceInput and never evaluates oneself", () => {
    expect(seed.performance.length).toBeGreaterThan(100);
    for (const item of seed.performance) {
      expect(() => validatePerformanceInput(item)).not.toThrow();
      expect(item.status).toBe("completed");
      expect(item.evaluator).not.toBe(employee(item.employeeId)?.fullName);
    }
  });

  it("explains every revision of the same employee and period", () => {
    for (const list of [seed.performance, seed.kpiAssessments ?? []]) {
      const groups = new Map<string, typeof list[number][]>();
      for (const item of list) groups.set(`${item.employeeId}|${item.period}`, [...(groups.get(`${item.employeeId}|${item.period}`) ?? []), item]);
      const revised = [...groups.values()].filter((items) => items.length > 1);
      expect(revised.length).toBeGreaterThanOrEqual(1);
      for (const items of revised) {
        const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        expect(unique(sorted.map((item) => item.createdAt))).toBe(true);
        for (const later of sorted.slice(1)) expect(later.generalNotes).toMatch(/^Revisi/);
      }
    }
  });

  it("keeps development and training revisions sequential and chronological", () => {
    for (const [list, key] of [[seed.developmentVersions, "needId"], [seed.trainingVersions, "trainingId"]] as const) {
      const groups = new Map<string, { revision: number; createdAt: string; employeeId: string }[]>();
      for (const item of list) { const id = (item as unknown as Record<string, string>)[key]; groups.set(id, [...(groups.get(id) ?? []), item]); }
      for (const items of groups.values()) {
        const sorted = [...items].sort((a, b) => a.revision - b.revision);
        expect(sorted.map((item) => item.revision)).toEqual(sorted.map((_, index) => index + 1));
        for (let i = 1; i < sorted.length; i++) expect(sorted[i].createdAt > sorted[i - 1].createdAt).toBe(true);
        expect(new Set(sorted.map((item) => item.employeeId)).size).toBe(1);
      }
    }
  });
});

describe("demo dataset: competency, development and training", () => {
  it("stores competency assessments exactly as compareCompetencies computes them", () => {
    expect(seed.competency.filter((item) => item.context === "current-position").length).toBeGreaterThanOrEqual(15);
    expect(seed.competency.filter((item) => item.context === "role-change").length).toBe(2);
    for (const item of seed.competency) {
      const result = compareCompetencies(item.employeeId, item.positionId, ref);
      expect(item.findings).toEqual(result.findings);
      expect(item.overallStatus).toBe(result.overallStatus);
      expect(item.context === "current-position").toBe(employee(item.employeeId)?.positionId === item.positionId);
    }
  });

  it("has a realistic distribution of findings", () => {
    const perEmployee = ref.employees.map((item) => compareCompetencies(item.id, item.positionId!, ref).findings);
    const findings = perEmployee.flat();
    const gapShare = findings.filter((item) => item.status === "Gap").length / findings.length;
    const missingShare = findings.filter((item) => item.status === "Bukti Belum Cukup").length / findings.length;
    expect(gapShare).toBeGreaterThanOrEqual(0.1);
    expect(gapShare).toBeLessThanOrEqual(0.4);
    expect(missingShare).toBeGreaterThan(0.05);
    expect(missingShare).toBeLessThan(0.2);
    expect(perEmployee.some((list) => list.every((item) => item.status === "Bukti Belum Cukup"))).toBe(true);
    expect(perEmployee.some((list) => list.every((item) => item.status === "Terpenuhi"))).toBe(true);
    // At least one employee whose only gap is on an optional requirement.
    const optional = new Set(ref.positionRequirements.filter((item) => !item.isMandatory).map((item) => item.id));
    expect(perEmployee.some((list) => {
      const gaps = list.filter((item) => item.status === "Gap");
      return gaps.length > 0 && gaps.every((item) => optional.has(item.requirementId));
    })).toBe(true);
  });

  it("references valid sources for development needs", () => {
    const needs = latestDevelopment(seed);
    expect(needs.length).toBeGreaterThanOrEqual(18);
    for (const need of needs) {
      const owner = employee(need.employeeId)!;
      if (need.sourceType === "competency_gap") {
        const requirement = ref.positionRequirements.find((item) => item.id === need.sourceRef);
        expect(requirement?.positionId).toBe(owner.positionId);
        if (need.status !== "Completed") {
          const finding = compareCompetencies(owner.id, owner.positionId!, ref).findings.find((item) => item.requirementId === need.sourceRef);
          expect(finding?.status).toBe("Gap");
        }
      } else if (need.sourceType === "role_change") {
        const assessment = seed.competency.find((item) => item.id === need.sourceRef);
        expect(assessment?.context).toBe("role-change");
        expect(assessment?.employeeId).toBe(need.employeeId);
      } else {
        const evaluation = seed.performance.find((item) => item.id === need.sourceRef);
        expect(evaluation?.employeeId).toBe(need.employeeId);
        expect(evaluation?.status).toBe("completed");
      }
      const first = seed.developmentVersions.filter((item) => item.needId === need.needId).sort((a, b) => a.revision - b.revision)[0];
      const source = need.sourceType === "role_change" ? seed.competency.find((item) => item.id === need.sourceRef)?.createdAt :
        need.sourceType === "performance_context" ? seed.performance.find((item) => item.id === need.sourceRef)?.createdAt : undefined;
      if (source) expect(first.createdAt > source).toBe(true);
      expect(need.objective.trim()).not.toBe("");
    }
  });

  it("has at most one open need per competency gap", () => {
    const open = latestDevelopment(seed).filter((item) => item.sourceType === "competency_gap" && item.status !== "Completed");
    expect(unique(open.map((item) => `${item.employeeId}|${item.sourceRef}`))).toBe(true);
  });

  it("links trainings to an open need of the same employee at creation time", () => {
    const trainings = latestTraining(seed);
    expect(trainings.length).toBeGreaterThanOrEqual(15);
    for (const version of seed.trainingVersions) {
      const needVersions = seed.developmentVersions.filter((item) => item.needId === version.developmentNeedId);
      expect(needVersions.length).toBeGreaterThan(0);
      expect(needVersions[0].employeeId).toBe(version.employeeId);
      if (version.revision === 1) {
        const atCreation = needVersions.filter((item) => item.createdAt <= version.createdAt).sort((a, b) => b.revision - a.revision)[0];
        expect(atCreation).toBeDefined();
        expect(atCreation.status).not.toBe("Completed");
      }
      if (version.status === "Completed") { expect(version.result.trim()).not.toBe(""); expect(version.date <= DEMO_TODAY).toBe(true); }
      if (version.status === "Cancelled") expect(version.notes.trim()).not.toBe("");
    }
    expect(new Set(trainings.map((item) => item.status))).toEqual(new Set(["Planned", "In Progress", "Completed", "Cancelled"]));
  });
});

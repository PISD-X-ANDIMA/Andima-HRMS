import type { DevelopmentNeedVersion } from "../../../development/types";
import { developmentNeeds, employeeById, employeeSearchText, includesText, positionOf, visibleEmployees, type Snapshot } from "../../data/selectors";

/** Empty string = no filter. `period` is the month the requirement was last recorded (YYYY-MM). */
export type DevelopmentFilters = { search: string; department: string; sourceType: string; status: string; period: string; competency: string; priority: string };

/**
 * Competencies a requirement is about (FR-D4-002 B filter). A gap need names one position requirement; a position
 * change need was raised from that assessment, so it covers the competencies with a Gap there. A need from a
 * performance review has no competency.
 */
export function needCompetencyIds(snapshot: Snapshot, need: Pick<DevelopmentNeedVersion, "sourceType" | "sourceRef">): string[] {
  if (need.sourceType === "competency_gap") {
    const requirement = snapshot.reference.positionRequirements.find((item) => item.id === need.sourceRef);
    return requirement ? [requirement.competencyId] : [];
  }
  if (need.sourceType === "role_change") {
    const assessment = snapshot.competency.find((item) => item.id === need.sourceRef);
    return (assessment?.findings ?? []).filter((item) => item.status === "Gap").map((item) => item.competencyId);
  }
  return [];
}

/** Rows of the Development Requirement list: the latest revision of each visible need, every filter combined (FR-04.8). */
export function developmentRows(snapshot: Snapshot, filters: DevelopmentFilters): DevelopmentNeedVersion[] {
  const visible = new Set(visibleEmployees(snapshot).map((item) => item.id));
  return developmentNeeds(snapshot).filter((need) => {
    const employee = employeeById(snapshot, need.employeeId);
    return visible.has(need.employeeId) && includesText(`${employeeSearchText(snapshot, employee)} ${need.objective}`, filters.search)
      && (!filters.department || employee?.departmentId === filters.department)
      && (!filters.sourceType || need.sourceType === filters.sourceType) && (!filters.status || need.status === filters.status) && (!filters.period || need.createdAt.startsWith(filters.period))
      && (!filters.priority || need.priority === filters.priority) && (!filters.competency || needCompetencyIds(snapshot, need).includes(filters.competency));
  });
}

/**
 * PIC choices (Q13): employees by name, labelled with their position; the name is what is stored (pic, text <= 120).
 * A PIC typed as free text before Q13 stays first in the list, so editing a requirement never blanks it.
 */
export function picOptions(snapshot: Snapshot, current = ""): { value: string; label: string }[] {
  const byName = new Map(visibleEmployees(snapshot).map((item) => [item.fullName, item]));
  const options = [...byName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((item) => ({ value: item.fullName, label: [item.fullName, positionOf(snapshot, item)?.title].filter(Boolean).join(" · ") }));
  const kept = current.trim();
  return kept && !byName.has(kept) ? [{ value: kept, label: `${kept} (not in employee list)` }, ...options] : options;
}

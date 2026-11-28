import type { DevelopmentNeedVersion } from "../../../development/types";
import { plainText, type Translate } from "../../../shared/text";
import { developmentNeeds, employeeById, employeeSearchText, includesText, positionOf, reassessmentFor, visibleEmployees, type Snapshot } from "../../data/selectors";

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

/**
 * Interview 13 Nov 2026 (1:08:36): a requirement that is Completed and decided leaves the list; its record stays in the
 * employee's history and in Training Tracking. One still waiting for HR's reassessment stays, since HR must act on it.
 */
export const isArchived = (snapshot: Snapshot, need: DevelopmentNeedVersion) => need.status === "Completed" && reassessmentFor(snapshot, need.needId) !== "pending";

/** The latest revision of each visible need that every filter keeps, archived ones included (FR-04.8). */
function matchingNeeds(snapshot: Snapshot, filters: DevelopmentFilters): DevelopmentNeedVersion[] {
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
 * Rows of the Development Requirement list. Archived requirements show only when the Status filter asks for them.
 * Order (interview 13 Nov 2026, 1:06:52 and 1:21:38): open requirements first, then Completed ones still waiting for
 * reassessment, then decided ones; within each, High before Medium before Low, and the most recently updated first.
 */
export function developmentRows(snapshot: Snapshot, filters: DevelopmentFilters): DevelopmentNeedVersion[] {
  const group = (need: DevelopmentNeedVersion) => need.status !== "Completed" ? 0 : reassessmentFor(snapshot, need.needId) === "pending" ? 1 : 2;
  const name = (need: DevelopmentNeedVersion) => employeeById(snapshot, need.employeeId)?.fullName ?? "";
  return matchingNeeds(snapshot, filters).filter((need) => filters.status || !isArchived(snapshot, need))
    .sort((a, b) => group(a) - group(b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || b.createdAt.localeCompare(a.createdAt) || name(a).localeCompare(name(b)));
}

/** Archived requirements the other filters keep but the default list hides; 0 once a Status is picked. */
export const archivedCount = (snapshot: Snapshot, filters: DevelopmentFilters) =>
  filters.status ? 0 : matchingNeeds(snapshot, filters).filter((need) => isArchived(snapshot, need)).length;

const PRIORITY_RANK: Record<DevelopmentNeedVersion["priority"], number> = { High: 0, Medium: 1, Low: 2 };

/**
 * PIC choices (Q13): employees by name, labelled with their position; the name is what is stored (pic, text <= 120).
 * A PIC typed as free text before Q13 stays first in the list, so editing a requirement never blanks it.
 */
export function picOptions(snapshot: Snapshot, current = "", t: Translate = plainText): { value: string; label: string }[] {
  const byName = new Map(visibleEmployees(snapshot).map((item) => [item.fullName, item]));
  const options = [...byName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((item) => ({ value: item.fullName, label: [item.fullName, positionOf(snapshot, item)?.title].filter(Boolean).join(" · ") }));
  const kept = current.trim();
  return kept && !byName.has(kept) ? [{ value: kept, label: t("{name} (not in employee list)", { name: kept }) }, ...options] : options;
}

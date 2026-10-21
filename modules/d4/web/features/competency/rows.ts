import type { CompetencyFinding } from "../../../competency/types";
import type { DevelopmentNeedVersion } from "../../../development/types";
import { openNeedFor } from "../../../shared/rules";
import type { EmployeeReference } from "../../../shared/types";
import { currentCompetencyStatus, currentGap, employeeSearchText, inTrainingOrPositionChange, includesText, latestCurrentPositionAssessment, positionOf, visibleEmployees, type CurrentCompetencyStatus, type Snapshot } from "../../data/selectors";
import { statusLabel } from "../../ui/primitives";

export type CompetencyRow = { employee: EmployeeReference; position: string; status: CurrentCompetencyStatus; findings: CompetencyFinding[]; lastAssessed?: string };
/** Empty string = no filter. `status` is the English display label (statusLabel); `competency` a competency id. */
export type CompetencyFilters = { search: string; position: string; department: string; status: string; competency: string };

/** Competency filter options (FR-D4-002 A and B), by name. */
export const competencyOptions = (snapshot: Snapshot) => [...snapshot.reference.competencies].sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ value: item.id, label: item.name }));

/**
 * Rows of the Competency Gap list (UAT-11). HR and managers only see employees in scope: trainees, a position
 * change saved in the last 6 months, or an open requirement (inTrainingOrPositionChange). Anyone else is assessed
 * through Assess Position Change, which brings them into scope. Employees see only themselves.
 */
export function competencyRows(snapshot: Snapshot, filters: CompetencyFilters): CompetencyRow[] {
  const scoped = snapshot.role !== "EMPLOYEE";
  return visibleEmployees(snapshot).filter((employee) => !scoped || inTrainingOrPositionChange(snapshot, employee.id)).map((employee) => {
    const gap = currentGap(snapshot, employee);
    const saved = latestCurrentPositionAssessment(snapshot, employee);
    return { employee, position: positionOf(snapshot, employee)?.title ?? "—", status: currentCompetencyStatus(snapshot, employee), findings: gap?.findings ?? [], lastAssessed: saved?.effectiveDate };
  }).filter((row) => includesText(employeeSearchText(snapshot, row.employee), filters.search)
    && (!filters.position || row.employee.positionId === filters.position) && (!filters.department || row.employee.departmentId === filters.department)
    && (!filters.status || statusLabel(row.status) === filters.status) && (!filters.competency || row.findings.some((item) => item.competencyId === filters.competency)))
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));
}

/** Difference shown per competency, actual minus required: "−1" is one level short, "—" while no level is recorded. */
export const formatDifference = (difference: number | null) =>
  difference === null ? "—" : difference > 0 ? `+${difference}` : difference < 0 ? `−${-difference}` : "0";

/**
 * Why a competency has its status (Q15: show the logic, not only the data). Same rules as compareCompetencies:
 * no level or no evidence is Insufficient Data, a level below the requirement is a Gap, otherwise Met.
 */
export function findingLogic(finding: Pick<CompetencyFinding, "requiredLevel" | "actualLevel" | "evidenceNotes">): { difference: number | null; reason: string } {
  const { requiredLevel: required, actualLevel: actual } = finding;
  if (actual === null) return { difference: null, reason: `Level belum tercatat, jadi belum bisa dibandingkan dengan minimal ${required}.` };
  const difference = actual - required;
  if (!finding.evidenceNotes?.trim()) return { difference, reason: `Level ${actual} belum punya bukti, jadi belum disimpulkan Gap atau Met.` };
  return { difference, reason: difference < 0 ? `Level ${actual} di bawah minimal ${required}: kurang ${-difference} level.` : `Level ${actual} memenuhi minimal ${required}.` };
}

/** The requirement raised to close a competency gap: the unfinished one first, otherwise the latest one (Q15). */
export function closingRequirement(needs: readonly DevelopmentNeedVersion[], employeeId: string, requirementId: string): DevelopmentNeedVersion | undefined {
  return openNeedFor(needs, employeeId, "competency_gap", requirementId) ?? needs
    .filter((need) => need.employeeId === employeeId && need.sourceType === "competency_gap" && need.sourceRef === requirementId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

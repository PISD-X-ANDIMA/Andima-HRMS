import { ApiError } from "../shared/errors";
import type { ReferenceDataSnapshot } from "../shared/types";
import type { CompetencyFinding, CompetencyOverallStatus } from "./types";

export function compareCompetencies(employeeId: string, positionId: string, reference: ReferenceDataSnapshot): {
  findings: CompetencyFinding[];
  overallStatus: CompetencyOverallStatus;
} {
  if (!reference.employees.some((item) => item.id === employeeId)) throw new ApiError("NOT_FOUND", "Employee tidak ditemukan.");
  if (!reference.positions.some((item) => item.id === positionId)) throw new ApiError("NOT_FOUND", "Posisi tidak ditemukan.");
  const requirements = reference.positionRequirements.filter((item) => item.positionId === positionId);
  const findings = requirements.map((requirement): CompetencyFinding => {
    const competency = reference.competencies.find((item) => item.id === requirement.competencyId);
    const skill = reference.employeeSkills.find((item) => item.employeeId === employeeId && item.competencyId === requirement.competencyId);
    const hasEvidence = Boolean(skill?.evidenceNotes?.trim());
    const status = !skill || !hasEvidence ? "Bukti Belum Cukup" :
      skill.proficiencyLevel < requirement.minProficiencyLevel ? "Gap" : "Terpenuhi";
    return {
      requirementId: requirement.id,
      competencyId: requirement.competencyId,
      competencyName: competency?.name ?? "Kompetensi tidak ditemukan",
      requiredLevel: requirement.minProficiencyLevel,
      actualLevel: skill?.proficiencyLevel ?? null,
      evidenceNotes: skill?.evidenceNotes ?? null,
      sourceReference: `position_requirements:${requirement.id}${skill ? ` | employee_skills:${skill.id}` : ""}`,
      status,
      isMandatory: requirement.isMandatory,
    };
  });
  // Only mandatory requirements decide the overall status: an optional Gap alone does not make the employee "Gap".
  const mandatory = findings.filter((item) => item.isMandatory !== false);
  const overallStatus: CompetencyOverallStatus = findings.length === 0 ? "Belum Ada Persyaratan" :
    mandatory.some((item) => item.status === "Gap") ? "Gap" :
    mandatory.some((item) => item.status === "Bukti Belum Cukup") ? "Bukti Belum Cukup" : "Terpenuhi";
  return { findings, overallStatus };
}

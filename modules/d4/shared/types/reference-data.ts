/** Shared D4 view models. The Supabase adapter will map database rows in STEP 6. */
export type ReferenceSource = "fixture" | "supabase";

export interface DepartmentReference {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface PositionReference {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly departmentId: string | null;
}

export interface EmployeeReference {
  /** Stable employees.id UUID. Use this for relationships. */
  readonly id: string;
  /** Human-readable employees.employee_id code. Never use it as a foreign key. */
  readonly employeeId: string;
  readonly fullName: string;
  readonly positionId: string | null;
  readonly departmentId: string | null;
}

export interface CompetencyReference {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly category: string | null;
}

export interface PositionRequirementReference {
  readonly id: string;
  readonly positionId: string;
  readonly competencyId: string;
  readonly minProficiencyLevel: number;
  readonly isMandatory: boolean;
}

export interface EmployeeSkillReference {
  readonly id: string;
  readonly employeeId: string;
  readonly competencyId: string;
  readonly proficiencyLevel: number;
  readonly evidenceNotes: string | null;
}

export interface ReferenceDataSnapshot {
  readonly source: ReferenceSource;
  readonly departments: readonly DepartmentReference[];
  readonly positions: readonly PositionReference[];
  readonly employees: readonly EmployeeReference[];
  readonly competencies: readonly CompetencyReference[];
  readonly positionRequirements: readonly PositionRequirementReference[];
  readonly employeeSkills: readonly EmployeeSkillReference[];
}

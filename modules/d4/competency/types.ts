export type CompetencyStatus = "Terpenuhi" | "Gap" | "Bukti Belum Cukup";
export type CompetencyOverallStatus = CompetencyStatus | "Belum Ada Persyaratan";

export interface CompetencyFinding {
  readonly requirementId: string;
  readonly competencyId: string;
  readonly competencyName: string;
  readonly requiredLevel: number;
  readonly actualLevel: number | null;
  readonly evidenceNotes: string | null;
  readonly sourceReference: string;
  readonly status: CompetencyStatus;
  /** False for an optional requirement, which is shown but does not decide the overall status. Absent on older saved findings (= mandatory). */
  readonly isMandatory?: boolean;
}

export interface CompetencyAssessment {
  readonly id: string;
  readonly source: "local-demo" | "supabase";
  readonly employeeId: string;
  /** Position snapshot at assessment time; does not update employee master. */
  readonly positionId: string;
  readonly effectiveDate: string;
  readonly context: "current-position" | "role-change";
  readonly findings: readonly CompetencyFinding[];
  readonly overallStatus: CompetencyOverallStatus;
  readonly createdAt: string;
  readonly actor: string;
}

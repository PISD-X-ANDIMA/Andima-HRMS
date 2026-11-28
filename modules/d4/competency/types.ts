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
}

export interface CompetencyAssessment {
  readonly id: string;
  readonly source: "local-demo" | "supabase";
  readonly employeeId: string;
  /** Position snapshot at assessment time; does not update employee master. */
  readonly positionId: string;
  /** Position title saved with the assessment, so history keeps a name after the position leaves the master. */
  readonly positionTitle?: string | null;
  readonly effectiveDate: string;
  readonly context: "current-position" | "role-change";
  readonly findings: readonly CompetencyFinding[];
  readonly overallStatus: CompetencyOverallStatus;
  readonly createdAt: string;
  readonly actor: string;
  /** Optional: the supervisor or requesting department HR assessed together with ("Dinilai bersama"). */
  readonly assessedWith?: string | null;
}

export type OrganizationRole = "HR" | "MANAGER" | "EMPLOYEE";

export interface OrganizationAccess {
  employee_id: string;
  app_role: OrganizationRole;
}

export interface EmployeeIdentity {
  id: string;
  employee_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface RecordBase {
  id: number;
  employee_id: string;
  date: string;
  created_at: string;
  employee: EmployeeIdentity | null;
}

export interface Feedback extends RecordBase {
  given_by: string;
  feedback_text: string;
  giver: EmployeeIdentity | null;
}

export interface Reward extends RecordBase {
  reward_name: string;
  description: string;
}

export interface AuditEntry {
  id: string;
  entity_type: "FEEDBACK" | "REWARD";
  entity_id: number;
  target_employee_id: string;
  action: "CREATE";
  actor_employee_id: string | null;
  created_at: string;
  employee: EmployeeIdentity | null;
  actor: EmployeeIdentity | null;
}

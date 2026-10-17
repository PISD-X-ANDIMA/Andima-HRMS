export type OrganizationRole = "HR" | "MANAGER" | "EMPLOYEE";
export type FeedbackType = "APPRECIATION" | "IMPROVEMENT" | "PERFORMANCE_NOTE";
export type FeedbackCategory = "DISCIPLINE" | "TEAMWORK" | "COMMUNICATION" | "WORKPLACE_SAFETY" | "QUALITY" | "SERVICE" | "OTHER";
export type FollowUpStatus = "NEW" | "READ" | "IN_PROGRESS" | "COMPLETED";
export type RewardStatus = "SUBMITTED" | "APPROVED" | "PUBLISHED" | "REJECTED";
export type RewardVisibility = "PRIVATE" | "PUBLIC";

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
  title: string;
  feedback_type: FeedbackType;
  category: FeedbackCategory;
  follow_up_text: string | null;
  target_date: string | null;
  follow_up_status: FollowUpStatus;
  progress_note: string | null;
  updated_at: string;
  giver: EmployeeIdentity | null;
}

export interface Reward extends RecordBase {
  reward_name: string;
  description: string;
  reward_type: string;
  title: string;
  reason: string;
  proposed_by: string | null;
  status: RewardStatus;
  visibility: RewardVisibility;
  approval_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  evidence_path: string | null;
  is_legacy: boolean;
  updated_at: string;
  proposer: EmployeeIdentity | null;
}

export interface AuditEntry {
  id: string;
  entity_type: "FEEDBACK" | "REWARD";
  entity_id: number;
  target_employee_id: string;
  action: "CREATE" | "UPDATE" | "STATUS_CHANGE" | "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH";
  actor_employee_id: string | null;
  created_at: string;
  employee: EmployeeIdentity | null;
  actor: EmployeeIdentity | null;
}

export interface FeedbackRewardNotification {
  id: string;
  entity_type: "FEEDBACK" | "REWARD";
  entity_id: number;
  event_type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface EmployeeListItem {
  id: string;
  employee_id: string;
  full_name: string;
  position_title: string | null;
  department_name: string | null;
  employment_status: string | null;
  work_location: string | null;
  join_date: string | null;
}

export interface EmployeeProfile extends EmployeeListItem {
  email: string | null;
  phone: string | null;
  identity_type: string | null;
  identity_number: string | null;
  position_id: string | null;
  department_id: string | null;
  tenure_years: number | null;
  tenure_months: number | null;
}

export interface EmployeeSkill {
  competency_id: string;
  proficiency_level: string | null;
  evidence_notes: string | null;
  competencies: {
    name: string | null;
  } | null;
}

export interface EmployeeCertification {
  title: string | null;
  issuing_organization: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  status: string | null;
}

export interface EmployeeAttendance {
  date: string | null;
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
  notes: string | null;
}

export interface EmployeeFeedbackReward {
  type: string | null;
  category: string | null;
  title: string | null;
  message: string | null;
  points: number | null;
  created_at: string | null;
}

export interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

export interface PositionOption {
  id: string;
  code: string;
  title: string;
  department_id: string;
}

export const employmentStatuses = [
  "PERMANENT",
  "CONTRACT",
  "PROBATION",
  "INTERN",
  "RESIGNED",
  "TERMINATED",
] as const;

export type EmploymentStatus = (typeof employmentStatuses)[number];

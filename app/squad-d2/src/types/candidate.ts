/**
 * Squad D2 (Recruitment Management) - Type Definitions
 * Specification: FR-D2-001 (FR-01.1 s/d FR-01.8, VR-01.1 s/d VR-01.4)
 * Target Table: d2_candidates, d2_job_posts
 */

export type RegistrationWayUi = 'scouting' | 'recommendation';

export type RegistrationWayDb = 'scouting/interview-based' | 'recommendation-based';

export type CandidateStage = 'screening' | 'assessment' | 'interview' | 'offering' | 'hired' | 'rejected';

export type CandidateStatus =
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'interviewed'
  | 'offered'
  | 'rejected'
  | 'in_review'
  | 'shortlisted';

export type JobPostStatus = 'active' | 'inactive' | 'closed' | 'coming_soon';

export interface JobPost {
  id: string;
  title: string;
  department: string;
  status: JobPostStatus;
  created_at?: string;
  description?: string;
  tags?: string[];
  location?: string;
  isPlaceholder?: boolean;
}

export interface Candidate {
  id: string;
  job_id: string;
  full_name: string;
  nik?: string | null;
  email: string;
  phone_number?: string | null;
  registration_way: RegistrationWayDb;
  cv_file_path: string;
  stage: CandidateStage;
  status: CandidateStatus;
  rejection_reason?: string | null;
  application_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CandidateWithJob extends Candidate {
  d2_job_posts?: {
    id?: string;
    title: string;
    department?: string;
  } | null;
  job_title?: string;
}

export type RequirementStatus = 'Fullfilled' | 'Unfullfilled' | null;

export interface FitProperRequirement {
  id: string;
  candidate_id: string;
  name: string;
  status: RequirementStatus;
  is_deleted: boolean;
  created_at: string;
}

export interface ApplicationHistoryItem {
  id: string;
  candidate_id?: string;
  email: string;
  nik?: string | null;
  full_name: string;
  job_id?: string;
  job_title: string;
  application_date: string;
  application_round: number;
  status: string;
  assessment_score?: number | null;
  assessment_notes?: string | null;
  rejection_reason?: string | null;
  is_read_only: boolean;
  is_deleted?: boolean;
}


export interface AuditLog {
  id: string;
  candidate_id: string;
  actor_id?: string | null;
  actor_name: string;
  old_status: string;
  new_status: string;
  change_reason?: string | null;
  created_at: string;
  d2_candidates?: {
    full_name: string;
    email?: string;
  } | null;
}

export interface CandidateSubmissionInput {
  fullName: string;
  email: string;
  phoneNumber?: string;
  registrationWay: RegistrationWayUi | RegistrationWayDb;
  jobId?: string;
  cvFile: File;
}

export interface CandidateSubmissionResult {
  success: boolean;
  message: string;
  candidateId?: string;
  cvFilePath?: string;
  errors?: Record<string, string[]>;
  timestamp?: string;
}

/**
 * Normalizes UI radio value into database CHECK constraint compatible value (VR-01.1)
 */
export function normalizeRegistrationWay(value: string): RegistrationWayDb {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'scouting' || trimmed === 'scouting/interview-based') {
    return 'scouting/interview-based';
  }
  if (trimmed === 'recommendation' || trimmed === 'recommendation-based') {
    return 'recommendation-based';
  }
  // Default fallback if matching partially
  if (trimmed.includes('scout')) {
    return 'scouting/interview-based';
  }
  return 'recommendation-based';
}

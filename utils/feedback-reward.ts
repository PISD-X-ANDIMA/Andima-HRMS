import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { AuditEntry, EmployeeIdentity, Feedback, OrganizationAccess, Reward } from "@/types/feedback-reward";

export type SearchParams = Record<string, string | string[] | undefined>;

const roles = ["HR", "MANAGER", "EMPLOYEE"] as const;
const identityFields = "id, employee_id, full_name, avatar_url";
export const feedbackFields = `id, employee_id, given_by, date, feedback_text, title, feedback_type, category, follow_up_text, target_date, follow_up_status, progress_note, updated_at, created_at, employee:d3_employee!d3_employee_feedback_employee_id_fkey(${identityFields}), giver:d3_employee!d3_employee_feedback_given_by_fkey(${identityFields})`;
export const rewardFields = `id, employee_id, reward_name, date, description, reward_type, title, reason, proposed_by, status, visibility, approval_reason, approved_by, approved_at, evidence_path, is_legacy, updated_at, created_at, employee:d3_employee!d3_employee_rewards_employee_id_fkey(${identityFields}), proposer:d3_employee!d3_employee_rewards_proposed_by_fkey(${identityFields})`;
const auditFields = `id, entity_type, entity_id, target_employee_id, action, actor_employee_id, created_at, employee:d3_employee!d3_feedback_reward_audit_log_target_employee_id_fkey(${identityFields}), actor:d3_employee!d3_feedback_reward_audit_log_actor_employee_id_fkey(${identityFields})`;

export function queryError(source: string, error: { code?: string; message?: string; details?: string; hint?: string }): never {
  console.error("D3 Feedback & Reward query failed", { source, code: error.code, message: error.message, details: error.details, hint: error.hint });
  throw new Error("Data Feedback & Reward belum dapat dimuat. Silakan coba lagi.");
}

export const getFeedbackContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: access, error } = await supabase
    .from("d3_user_access")
    .select("employee_id, app_role")
    .eq("auth_user_id", user.id)
    .maybeSingle<OrganizationAccess>();

  if (error) queryError("access", error);
  if (!access || !roles.includes(access.app_role)) notFound();
  return { supabase, user, access, canCreate: access.app_role !== "EMPLOYEE" };
});

export function param(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function pageNumber(params: SearchParams) {
  return Math.max(1, Math.min(100000, Number.parseInt(param(params, "page"), 10) || 1));
}

function periodBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const [year, month] = period.split("-").map(Number);
  return { start: `${period}-01`, end: month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01` };
}

async function getB2EmployeeIds(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("d3_b2_employee_sources")
    .select("employee_id")
    .returns<{ employee_id: string }[]>();
  if (error) queryError("B2 employee source filter", error);
  return [...new Set((data ?? []).map((source) => source.employee_id).filter(Boolean))];
}

export async function getEmployeeOptions(): Promise<EmployeeIdentity[]> {
  const { supabase, access, canCreate } = await getFeedbackContext();
  if (!canCreate) return [];

  const b2EmployeeIds = await getB2EmployeeIds(supabase);
  if (!b2EmployeeIds.length) return [];

  if (access.app_role === "MANAGER") {
    const { data, error } = await supabase
      .from("d3_employee_reporting")
      .select(`employee:d3_employee!d3_employee_reporting_subordinate_employee_id_fkey(${identityFields})`)
      .eq("manager_employee_id", access.employee_id)
      .eq("is_active", true)
      .order("id")
      .returns<{ employee: EmployeeIdentity | null }[]>();
    if (error) queryError("subordinate options", error);
    return (data ?? [])
      .flatMap((row) => row.employee && b2EmployeeIds.includes(row.employee.id) ? [row.employee] : [])
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  const { data, error } = await supabase
    .from("d3_employee")
    .select(identityFields)
    .in("id", b2EmployeeIds)
    .order("full_name")
    .returns<EmployeeIdentity[]>();
  if (error) queryError("employee options", error);
  return data ?? [];
}

export async function getOverview() {
  const { supabase } = await getFeedbackContext();
  const b2EmployeeIds = await getB2EmployeeIds(supabase);
  if (!b2EmployeeIds.length) return { feedback: [], rewards: [], feedbackCount: 0, rewardCount: 0 };
  const [feedback, rewards] = await Promise.all([
    supabase.from("d3_employee_feedback").select(feedbackFields, { count: "exact" }).in("employee_id", b2EmployeeIds).order("date", { ascending: false }).order("id", { ascending: false }).limit(3).returns<Feedback[]>(),
    supabase.from("d3_employee_rewards").select(rewardFields, { count: "exact" }).in("employee_id", b2EmployeeIds).order("date", { ascending: false }).order("id", { ascending: false }).limit(3).returns<Reward[]>(),
  ]);
  if (feedback.error) queryError("recent feedback", feedback.error);
  if (rewards.error) queryError("recent rewards", rewards.error);
  return { feedback: feedback.data ?? [], rewards: rewards.data ?? [], feedbackCount: feedback.count ?? 0, rewardCount: rewards.count ?? 0 };
}

export async function getRecords(kind: "feedback" | "reward", params: SearchParams) {
  const { supabase } = await getFeedbackContext();
  const b2EmployeeIds = await getB2EmployeeIds(supabase);
  if (!b2EmployeeIds.length) return { records: [], count: 0, page: pageNumber(params), pageSize: kind === "reward" ? 10 : 5 };
  const page = pageNumber(params);
  const bounds = periodBounds(param(params, "period"));
  const search = param(params, "search").trim().slice(0, 100);
  // The generated Supabase relation type becomes too large when both shaped selects are unioned.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any;
  const pageSize = kind === "reward" ? 10 : 5;
  if (kind === "feedback") query = supabase.from("d3_employee_feedback").select(feedbackFields, { count: "exact" }).order("date", { ascending: false }).order("id", { ascending: false });
  else query = supabase.from("d3_employee_rewards").select(rewardFields, { count: "exact" }).order("date", { ascending: false }).order("id", { ascending: false });
  query = query.in("employee_id", b2EmployeeIds);
  if (bounds) query = query.gte("date", bounds.start).lt("date", bounds.end);
  if (search) {
    const safeSearch = search.replace(/[,%()]/g, "");
    query = query.or(`full_name.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%`, { referencedTable: "employee" });
  }
  const dateFrom = param(params, "date_from");
  const dateTo = param(params, "date_to");
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) query = query.gte("date", dateFrom);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) query = query.lte("date", dateTo);
  if (kind === "feedback") {
    const feedbackType = param(params, "feedback_type");
    const followUpStatus = param(params, "follow_up_status");
    if (feedbackType) query = query.eq("feedback_type", feedbackType);
    if (followUpStatus) query = query.eq("follow_up_status", followUpStatus);
  }
  if (kind === "reward") {
    const employeeId = param(params, "employee_id");
    const rewardType = param(params, "reward_type");
    const status = param(params, "status");
    const proposedBy = param(params, "proposed_by");
    if (employeeId) {
      if (!b2EmployeeIds.includes(employeeId)) return { records: [], count: 0, page, pageSize };
      query = query.eq("employee_id", employeeId);
    }
    if (rewardType) query = query.eq("reward_type", rewardType);
    if (status) query = query.eq("status", status);
    if (proposedBy) query = query.eq("proposed_by", proposedBy);
  }
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) queryError(`${kind} list`, error);
  return { records: data ?? [], count: count ?? 0, page, pageSize };
}

export async function getRecord(kind: "feedback" | "reward", id: string) {
  if (!/^[1-9]\d*$/.test(id)) notFound();
  const { supabase } = await getFeedbackContext();
  const b2EmployeeIds = await getB2EmployeeIds(supabase);
  if (!b2EmployeeIds.length) notFound();
  // Keep the two shaped selects separate from the generated union type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = kind === "feedback"
    ? supabase.from("d3_employee_feedback").select(feedbackFields).eq("id", id).in("employee_id", b2EmployeeIds)
    : supabase.from("d3_employee_rewards").select(rewardFields).eq("id", id).in("employee_id", b2EmployeeIds);
  const { data, error } = await query.maybeSingle();
  if (error) queryError(`${kind} detail`, error);
  if (!data) notFound();
  return data;
}

export async function getAudit(params: SearchParams) {
  const { supabase, canCreate } = await getFeedbackContext();
  if (!canCreate) notFound();
  const b2EmployeeIds = await getB2EmployeeIds(supabase);
  const page = pageNumber(params);
  const bounds = periodBounds(param(params, "period"));
  let query = supabase.from("d3_feedback_reward_audit_log").select(auditFields, { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (!b2EmployeeIds.length) return { records: [], count: 0, page, pageSize: 10 };
  query = query.in("target_employee_id", b2EmployeeIds);
  if (param(params, "module") === "FEEDBACK" || param(params, "module") === "REWARD") query = query.eq("entity_type", param(params, "module"));
  if (bounds) query = query.gte("created_at", `${bounds.start}T00:00:00Z`).lt("created_at", `${bounds.end}T00:00:00Z`);
  const pageSize = 10;
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1).returns<AuditEntry[]>();
  if (error) queryError("audit", error);
  return { records: data ?? [], count: count ?? 0, page, pageSize };
}

export async function getNotifications() {
  const { supabase } = await getFeedbackContext();
  const { data, error } = await supabase.from("d3_feedback_reward_notifications").select("id, entity_type, entity_id, event_type, message, read_at, created_at").order("created_at", { ascending: false }).limit(20);
  if (error) queryError("notifications", error);
  return data ?? [];
}

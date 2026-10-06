import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { AuditEntry, EmployeeIdentity, Feedback, OrganizationAccess, Reward } from "@/types/feedback-reward";

export type SearchParams = Record<string, string | string[] | undefined>;

const roles = ["HR", "MANAGER", "EMPLOYEE"] as const;
const identityFields = "id, employee_id, full_name, avatar_url";
export const feedbackFields = `id, employee_id, given_by, date, feedback_text, created_at, employee:d3_employee!d3_employee_feedback_employee_id_fkey(${identityFields}), giver:d3_employee!d3_employee_feedback_given_by_fkey(${identityFields})`;
export const rewardFields = `id, employee_id, reward_name, date, description, created_at, employee:d3_employee!d3_employee_rewards_employee_id_fkey(${identityFields})`;
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

export async function getEmployeeOptions(): Promise<EmployeeIdentity[]> {
  const { supabase, access, canCreate } = await getFeedbackContext();
  if (!canCreate) return [];

  if (access.app_role === "MANAGER") {
    const { data, error } = await supabase
      .from("d3_employee_reporting")
      .select(`employee:d3_employee!d3_employee_reporting_subordinate_employee_id_fkey(${identityFields})`)
      .eq("manager_employee_id", access.employee_id)
      .eq("is_active", true)
      .order("id")
      .returns<{ employee: EmployeeIdentity | null }[]>();
    if (error) queryError("subordinate options", error);
    return (data ?? []).flatMap((row) => row.employee ? [row.employee] : []).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  const { data, error } = await supabase.from("d3_employee").select(identityFields).order("full_name").returns<EmployeeIdentity[]>();
  if (error) queryError("employee options", error);
  return data ?? [];
}

export async function getOverview() {
  const { supabase } = await getFeedbackContext();
  const [feedback, rewards] = await Promise.all([
    supabase.from("d3_employee_feedback").select(feedbackFields, { count: "exact" }).order("date", { ascending: false }).order("id", { ascending: false }).limit(3).returns<Feedback[]>(),
    supabase.from("d3_employee_rewards").select(rewardFields, { count: "exact" }).order("date", { ascending: false }).order("id", { ascending: false }).limit(3).returns<Reward[]>(),
  ]);
  if (feedback.error) queryError("recent feedback", feedback.error);
  if (rewards.error) queryError("recent rewards", rewards.error);
  return { feedback: feedback.data ?? [], rewards: rewards.data ?? [], feedbackCount: feedback.count ?? 0, rewardCount: rewards.count ?? 0 };
}

export async function getRecords(kind: "feedback" | "reward", params: SearchParams) {
  const { supabase } = await getFeedbackContext();
  const page = pageNumber(params);
  const bounds = periodBounds(param(params, "period"));
  const search = param(params, "search").trim().slice(0, 100);
  const fields = kind === "feedback" ? feedbackFields : rewardFields;
  let query = supabase.from(kind === "feedback" ? "d3_employee_feedback" : "d3_employee_rewards").select(fields, { count: "exact" }).order("date", { ascending: false }).order("id", { ascending: false });
  if (bounds) query = query.gte("date", bounds.start).lt("date", bounds.end);
  if (search) {
    const safeSearch = search.replace(/[,%()]/g, "");
    query = query.or(`full_name.ilike.%${safeSearch}%,employee_id.ilike.%${safeSearch}%`, { referencedTable: "employee" });
  }
  const { data, error, count } = await query.range((page - 1) * 5, page * 5 - 1).returns<(Feedback | Reward)[]>();
  if (error) queryError(`${kind} list`, error);
  return { records: data ?? [], count: count ?? 0, page };
}

export async function getRecord(kind: "feedback" | "reward", id: string) {
  if (!/^[1-9]\d*$/.test(id)) notFound();
  const { supabase } = await getFeedbackContext();
  const { data, error } = await supabase.from(kind === "feedback" ? "d3_employee_feedback" : "d3_employee_rewards").select(kind === "feedback" ? feedbackFields : rewardFields).eq("id", id).maybeSingle<Feedback | Reward>();
  if (error) queryError(`${kind} detail`, error);
  if (!data) notFound();
  return data;
}

export async function getAudit(params: SearchParams) {
  const { supabase, canCreate } = await getFeedbackContext();
  if (!canCreate) notFound();
  const page = pageNumber(params);
  const bounds = periodBounds(param(params, "period"));
  let query = supabase.from("d3_feedback_reward_audit_log").select(auditFields, { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (param(params, "module") === "FEEDBACK" || param(params, "module") === "REWARD") query = query.eq("entity_type", param(params, "module"));
  if (bounds) query = query.gte("created_at", `${bounds.start}T00:00:00Z`).lt("created_at", `${bounds.end}T00:00:00Z`);
  const { data, error, count } = await query.range((page - 1) * 6, page * 6 - 1).returns<AuditEntry[]>();
  if (error) queryError("audit", error);
  return { records: data ?? [], count: count ?? 0, page };
}

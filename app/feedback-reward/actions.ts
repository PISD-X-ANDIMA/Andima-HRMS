"use server";

import { revalidatePath } from "next/cache";
import { getFeedbackContext } from "@/utils/feedback-reward";

const value = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
const uuid = (input: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input);

function fail(error: { code?: string; message?: string; details?: string; hint?: string }, stage: string) {
  console.error("D3 Feedback & Reward action failed", { stage, code: error.code, message: error.message, details: error.details, hint: error.hint });
  return { error: error.code === "42501" ? "Akses ditolak oleh permission D3." : "Data belum dapat disimpan. Periksa isian dan coba lagi." };
}

export async function createFeedbackReward(kind: "feedback" | "reward", form: FormData) {
  const { supabase, access, canCreate } = await getFeedbackContext();
  if (!canCreate) return { error: "Anda tidak memiliki izin untuk menambahkan feedback atau reward." };
  const employee_id = value(form, "employee_id");
  const date = value(form, "date");
  if (!uuid(employee_id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Employee dan tanggal wajib valid." };
  if (kind === "feedback") {
    const payload = { employee_id, given_by: access.employee_id, date, feedback_text: value(form, "content"), title: value(form, "title") || "Catatan Kinerja", feedback_type: value(form, "feedback_type") || "PERFORMANCE_NOTE", category: value(form, "category") || "OTHER", follow_up_text: value(form, "follow_up_text") || null, target_date: value(form, "target_date") || null, follow_up_status: "NEW" };
    if (!payload.feedback_text) return { error: "Isi feedback wajib diisi." };
    const result = await supabase.from("d3_employee_feedback").insert(payload);
    if (result.error) return fail(result.error, "create_feedback");
  } else {
    const payload = { employee_id, proposed_by: access.employee_id, reward_name: value(form, "reward_name") || value(form, "title"), title: value(form, "title") || value(form, "reward_name"), reward_type: value(form, "reward_type") || "OTHER", date, description: value(form, "content"), reason: value(form, "content"), status: "SUBMITTED", visibility: "PRIVATE" };
    if (!payload.title || !payload.description) return { error: "Judul dan alasan reward wajib diisi." };
    const result = await supabase.from("d3_employee_rewards").insert(payload);
    if (result.error) return fail(result.error, "submit_reward");
  }
  revalidatePath("/feedback-reward", "layout");
  return { success: true };
}

export async function updateFeedbackProgress(form: FormData) {
  const { supabase, access } = await getFeedbackContext();
  const id = Number(value(form, "id"));
  const status = value(form, "status");
  const progress_note = value(form, "progress_note");
  if (!Number.isInteger(id) || !["NEW", "READ", "IN_PROGRESS", "COMPLETED"].includes(status)) return { error: "Status feedback tidak valid." };
  if (status === "COMPLETED" && access.app_role === "EMPLOYEE") return { error: "Employee tidak dapat menetapkan status Selesai." };
  const result = await supabase.from("d3_employee_feedback").update({ follow_up_status: status, progress_note }).eq("id", id);
  if (result.error) return fail(result.error, "update_feedback_progress");
  revalidatePath("/feedback-reward", "layout");
  return { success: true };
}

export async function updateRewardStatus(form: FormData) {
  const { supabase, access } = await getFeedbackContext();
  if (access.app_role !== "HR") return { error: "Hanya HR yang dapat memproses approval reward." };
  const id = Number(value(form, "id"));
  const status = value(form, "status");
  const approval_reason = value(form, "approval_reason");
  if (!Number.isInteger(id) || !["APPROVED", "REJECTED", "PUBLISHED"].includes(status)) return { error: "Status reward tidak valid." };
  if ((status === "APPROVED" || status === "REJECTED") && !approval_reason) return { error: "Alasan approval/rejection wajib diisi." };
  const payload: Record<string, string | null> = { status };
  if (status === "APPROVED" || status === "REJECTED") payload.approval_reason = approval_reason;
  if (status === "APPROVED") { payload.approved_by = access.employee_id; payload.approved_at = new Date().toISOString(); }
  const result = await supabase.from("d3_employee_rewards").update(payload).eq("id", id);
  if (result.error) return fail(result.error, "update_reward_status");
  revalidatePath("/feedback-reward", "layout");
  return { success: true };
}

export async function markNotificationRead(form: FormData) {
  const { supabase } = await getFeedbackContext();
  const id = value(form, "id");
  if (!uuid(id)) return { error: "Notifikasi tidak valid." };
  const result = await supabase.from("d3_feedback_reward_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (result.error) return fail(result.error, "mark_notification_read");
  revalidatePath("/feedback-reward", "layout");
  return { success: true };
}

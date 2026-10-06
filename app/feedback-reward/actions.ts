"use server";

import { revalidatePath } from "next/cache";
import { getFeedbackContext } from "@/utils/feedback-reward";

export async function createFeedbackReward(kind: "feedback" | "reward", form: FormData) {
  const { supabase, access, canCreate } = await getFeedbackContext();
  if (!canCreate) return { error: "Anda tidak memiliki izin untuk menambahkan feedback atau reward." };
  const value = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const employee_id = value("employee_id");
  const date = value("date");
  const content = value("content");
  const reward_name = value("reward_name");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(employee_id)) return { error: "Pilih employee yang valid." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { error: "Tanggal wajib diisi dengan tanggal yang valid." };
  if (!content || (kind === "reward" && !reward_name)) return { error: "Lengkapi seluruh field wajib. Teks tidak boleh hanya spasi." };

  const result = kind === "feedback"
    ? await supabase.from("d3_employee_feedback").insert({ employee_id, given_by: access.employee_id, date, feedback_text: content })
    : await supabase.from("d3_employee_rewards").insert({ employee_id, reward_name, date, description: content });
  if (result.error) {
    console.error("D3 Feedback & Reward insert failed", { source: kind, code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint });
    return { error: result.error.code === "42501" ? "Akses ditolak untuk employee tersebut." : "Data belum dapat disimpan. Periksa isian dan coba lagi." };
  }
  revalidatePath("/feedback-reward", "layout");
  return { success: true };
}

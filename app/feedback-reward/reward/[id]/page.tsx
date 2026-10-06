import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeedbackContext, getRecord } from "@/utils/feedback-reward";
import { dateLabel } from "@/utils/feedback-reward-format";

export default async function RewardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ access }, record] = await Promise.all([getFeedbackContext(), getRecord("reward", (await params).id)]);
  if ("feedback_text" in record) notFound();
  return <section className="space-y-6"><Link className="text-sm font-semibold text-[#155cfd]" href={access.app_role === "EMPLOYEE" ? "/feedback-reward" : "/feedback-reward"}>← Back to Overview</Link><h1 className="text-3xl font-bold text-slate-900">Reward Detail</h1><article className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-6"><div><p className="text-sm text-slate-500">Employee</p><p className="font-semibold">{record.employee?.full_name ?? "Identity unavailable"}</p></div><div><p className="text-sm text-slate-500">Reward Name / Type</p><p>{record.reward_name}</p></div><div><p className="text-sm text-slate-500">Description</p><p className="whitespace-pre-wrap">{record.description}</p></div><div><p className="text-sm text-slate-500">Reward Date</p><p>{dateLabel(record.date)}</p></div><div><p className="text-sm text-slate-500">Access</p><p>Based on organization access</p></div></article></section>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { updateRewardStatus } from "@/app/feedback-reward/actions";
import { StatusBadge, WorkflowStepper } from "@/components/feedback-reward/FeedbackRewardUI";
import { getFeedbackContext, getRecord } from "@/utils/feedback-reward";
import { dateLabel } from "@/utils/feedback-reward-format";

export default async function RewardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ access }, record] = await Promise.all([getFeedbackContext(), getRecord("reward", (await params).id)]);
  if ("feedback_text" in record) notFound();
  const submitStatus = async (form: FormData) => { "use server"; await updateRewardStatus(form); };
  const canApprove = access.app_role === "HR" && !record.is_legacy;
  return <section className="space-y-6">
    <Link className="text-sm font-semibold text-[#155cfd]" href="/feedback-reward/reward">← Kembali ke Reward List</Link>
    <h1 className="text-3xl font-bold text-slate-900">Reward Detail</h1>
    <article className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div><p className="text-sm text-slate-500">Pegawai</p><p className="font-semibold">{record.employee?.full_name ?? "Identity unavailable"}</p><p className="text-sm text-slate-500">{record.employee?.employee_id ?? "-"}</p></div>
      <div><p className="text-sm text-slate-500">Reward</p><p>{record.title} · {record.reward_type}</p>{record.is_legacy && <p className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Data Legacy</p>}</div>
      <div><p className="text-sm text-slate-500">Status · Visibilitas</p><div className="mt-2 flex flex-wrap items-center gap-3"><StatusBadge status={record.status} /><WorkflowStepper status={record.status} steps={["SUBMITTED", "APPROVED", "PUBLISHED"]} /></div><p className="mt-3 text-sm text-slate-500">Visibilitas: <StatusBadge status={record.visibility} /></p></div>
      <div><p className="text-sm text-slate-500">Alasan / Pencapaian</p><p className="whitespace-pre-wrap">{record.reason}</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-slate-500">Tanggal reward</p><p>{dateLabel(record.date)}</p></div><div><p className="text-sm text-slate-500">Pengaju</p><p>{record.proposer?.full_name ?? "Tidak tersedia"}</p></div></div>
      <div><p className="text-sm text-slate-500">Alasan approval</p><p>{record.approval_reason ?? "Belum ada"}</p></div>
      {canApprove && record.status === "SUBMITTED" && <div className="space-y-3 rounded-lg bg-slate-50 p-4"><p className="font-bold text-[#1e3765]">Approval HR</p><div className="grid gap-3 sm:grid-cols-2"><form action={submitStatus} className="space-y-2"><input type="hidden" name="id" value={record.id} /><input type="hidden" name="status" value="APPROVED" /><input name="approval_reason" placeholder="Alasan persetujuan" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" required /><button className="h-10 w-full rounded-md bg-[#155cfd] px-4 font-semibold text-white">Approve</button></form><form action={submitStatus} className="space-y-2"><input type="hidden" name="id" value={record.id} /><input type="hidden" name="status" value="REJECTED" /><input name="approval_reason" placeholder="Alasan penolakan" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" required /><button className="h-10 w-full rounded-md bg-rose-600 px-4 font-semibold text-white">Reject</button></form></div></div>}
      {canApprove && record.status === "APPROVED" && <div className="rounded-lg bg-slate-50 p-4"><p className="mb-3 font-bold text-[#1e3765]">Approval HR</p><form action={submitStatus}><input type="hidden" name="id" value={record.id} /><input type="hidden" name="status" value="PUBLISHED" /><button className="h-10 rounded-md bg-[#155cfd] px-4 font-semibold text-white">Publish</button></form></div>}
    </article>
  </section>;
}

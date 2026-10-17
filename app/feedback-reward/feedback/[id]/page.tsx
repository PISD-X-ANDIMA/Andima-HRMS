import Link from "next/link";
import { notFound } from "next/navigation";
import { updateFeedbackProgress } from "@/app/feedback-reward/actions";
import { WorkflowStepper } from "@/components/feedback-reward/FeedbackRewardUI";
import { getFeedbackContext, getRecord } from "@/utils/feedback-reward";
import { dateLabel } from "@/utils/feedback-reward-format";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ access }, record] = await Promise.all([getFeedbackContext(), getRecord("feedback", (await params).id)]);
  if (!("feedback_text" in record)) notFound();
  const submitProgress = async (form: FormData) => { "use server"; await updateFeedbackProgress(form); };
  return <section className="space-y-6">
    <Link className="text-sm font-semibold text-[#155cfd]" href={access.app_role === "EMPLOYEE" ? "/feedback-reward" : "/feedback-reward/feedback"}>← Back</Link>
    <h1 className="text-3xl font-bold text-slate-900">Feedback Detail</h1>
    <article className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div><p className="text-sm text-slate-500">Employee</p><p className="font-semibold">{record.employee?.full_name ?? "Identity unavailable"}</p></div>
      <div><p className="text-sm text-slate-500">Judul · Tipe · Kategori</p><p>{record.title} · {record.feedback_type} · {record.category}</p></div>
      <div><p className="text-sm text-slate-500">Feedback</p><p className="whitespace-pre-wrap">{record.feedback_text}</p></div>
      <div><p className="text-sm text-slate-500">Status tindak lanjut</p><div className="mt-2"><WorkflowStepper status={record.follow_up_status} steps={["NEW", "READ", "IN_PROGRESS", "COMPLETED"]} /></div><p className="mt-3 text-sm text-slate-600">{record.follow_up_text ?? "Tidak ada tindak lanjut tambahan."}</p>{record.progress_note && <p className="mt-2 text-sm text-slate-600">Progress: {record.progress_note}</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm text-slate-500">Feedback Date</p><p>{dateLabel(record.date)}</p></div><div><p className="text-sm text-slate-500">Given By</p><p>{record.giver?.full_name ?? "Identity unavailable"}</p></div></div>
      <form action={submitProgress} className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-[1fr_2fr_auto]"><input type="hidden" name="id" value={record.id} /><select name="status" defaultValue={record.follow_up_status} className="h-10 rounded-md border border-slate-300 bg-white px-3"><option value="NEW">Baru</option><option value="READ">Sudah Dibaca</option><option value="IN_PROGRESS">Ditindaklanjuti</option>{access.app_role !== "EMPLOYEE" && <option value="COMPLETED">Selesai</option>}</select><input name="progress_note" defaultValue={record.progress_note ?? ""} placeholder="Catatan progres" className="h-10 rounded-md border border-slate-300 bg-white px-3" /><button className="h-10 rounded-md bg-[#155cfd] px-4 font-semibold text-white">Simpan progres</button></form>
    </article>
  </section>;
}

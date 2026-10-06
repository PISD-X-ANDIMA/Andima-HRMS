import Link from "next/link";
import { redirect } from "next/navigation";
import CreateRecordForm from "@/components/feedback-reward/CreateRecordForm";
import { RecordList } from "@/components/feedback-reward/RecordList";
import { getEmployeeOptions, getFeedbackContext, getRecords, param, type SearchParams } from "@/utils/feedback-reward";

export default async function FeedbackListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { canCreate } = await getFeedbackContext();
  if (!canCreate) redirect("/feedback-reward");
  const params = await searchParams;
  const [data, employees] = await Promise.all([getRecords("feedback", params), getEmployeeOptions()]);
  return <section className="space-y-6"><header className="flex flex-wrap items-center gap-4"><Link className="text-sm font-semibold text-[#155cfd]" href="/feedback-reward">← Back to Overview</Link><h1 className="text-3xl font-bold text-slate-900">Feedback</h1></header><CreateRecordForm kind="feedback" employees={employees} /><form className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input name="search" defaultValue={param(params, "search")} placeholder="Employee name or ID" className="h-10 min-w-56 rounded-md border border-slate-300 px-3" /><input name="period" type="month" defaultValue={param(params, "period")} className="h-10 rounded-md border border-slate-300 px-3" /><button className="h-10 rounded-md border border-[#155cfd] px-4 font-semibold text-[#155cfd]">Apply</button></form><RecordList records={data.records} /><p className="text-sm text-slate-500">{data.count} feedback ditemukan.</p></section>;
}

import Link from "next/link";
import CreateRecordForm from "@/components/feedback-reward/CreateRecordForm";
import { RecordCards } from "@/components/feedback-reward/RecordList";
import { getEmployeeOptions, getFeedbackContext, getOverview, getRecords, param, type SearchParams } from "@/utils/feedback-reward";

export default async function FeedbackRewardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { canCreate } = await getFeedbackContext();
  const params = await searchParams;
  if (!canCreate) {
    const tab = param(params, "tab") === "reward" ? "reward" : "feedback";
    const { records } = await getRecords(tab, params);
    return <section className="space-y-6"><header><h1 className="text-3xl font-bold text-slate-900">My Feedback &amp; Reward</h1><p className="mt-2 text-slate-600">Riwayat feedback dan reward pribadi Anda.</p></header><nav className="flex gap-5 border-b text-sm font-semibold"><Link className={tab === "feedback" ? "border-b-2 border-[#155cfd] pb-3 text-[#155cfd]" : "pb-3 text-slate-500"} href="/feedback-reward">Feedback</Link><Link className={tab === "reward" ? "border-b-2 border-[#155cfd] pb-3 text-[#155cfd]" : "pb-3 text-slate-500"} href="/feedback-reward?tab=reward">Reward</Link></nav><RecordCards records={records} /></section>;
  }
  const [overview, employees] = await Promise.all([getOverview(), getEmployeeOptions()]);
  return <section className="space-y-7"><header><h1 className="text-3xl font-bold text-slate-900">Feedback &amp; Reward</h1><p className="mt-2 text-slate-600">Kelola feedback dan reward sesuai akses organisasi.</p></header><nav className="flex flex-wrap gap-5 border-b pb-3 text-sm font-semibold"><span className="text-[#155cfd]">Overview</span><Link className="text-slate-600 hover:text-[#155cfd]" href="/feedback-reward/feedback">Feedback List</Link><Link className="text-slate-600 hover:text-[#155cfd]" href="/feedback-reward/audit">Audit Trail</Link></nav><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-xl border border-slate-200 bg-slate-50 p-6"><p className="font-semibold">Feedback</p><p className="mt-3 text-4xl font-bold">{overview.feedbackCount}</p><p className="mt-2 text-sm text-slate-500">Total visible feedback</p></article><article className="rounded-xl border border-slate-200 bg-slate-50 p-6"><p className="font-semibold">Reward</p><p className="mt-3 text-4xl font-bold">{overview.rewardCount}</p><p className="mt-2 text-sm text-slate-500">Total visible rewards</p></article></div><div className="grid gap-6 lg:grid-cols-2"><section className="space-y-4 rounded-xl border border-slate-200 p-5"><h2 className="text-lg font-bold">Recent Feedback</h2><CreateRecordForm kind="feedback" employees={employees} /><RecordCards records={overview.feedback} /></section><section className="space-y-4 rounded-xl border border-slate-200 p-5"><h2 className="text-lg font-bold">Recent Reward</h2><CreateRecordForm kind="reward" employees={employees} /><RecordCards records={overview.rewards} /></section></div></section>;
}

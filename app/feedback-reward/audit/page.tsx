import Link from "next/link";
import { RecordList } from "@/components/feedback-reward/RecordList";
import { getAudit, type SearchParams } from "@/utils/feedback-reward";

export default async function AuditTrailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const data = await getAudit(await searchParams);
  return <section className="space-y-6"><header className="flex flex-wrap items-center gap-4"><Link className="text-sm font-semibold text-[#155cfd]" href="/feedback-reward">← Back to Overview</Link><h1 className="text-3xl font-bold text-slate-900">Audit Trail</h1></header><RecordList records={data.records} audit /><p className="text-sm text-slate-500">{data.count} audit record ditemukan.</p></section>;
}

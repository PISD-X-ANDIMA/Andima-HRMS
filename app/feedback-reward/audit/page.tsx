import Link from "next/link";
import { RecordList } from "@/components/feedback-reward/RecordList";
import { getAudit, type SearchParams } from "@/utils/feedback-reward";

export default async function AuditTrailPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const data = await getAudit(params);
  const totalPages = Math.max(1, Math.ceil(data.count / data.pageSize));
  const start = data.count === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.count);
  const hrefForPage = (page: number) => {
    const query = new URLSearchParams();
    query.set("page", String(page));
    const moduleFilter = typeof params.module === "string" ? params.module : "";
    const period = typeof params.period === "string" ? params.period : "";
    if (moduleFilter) query.set("module", moduleFilter);
    if (period) query.set("period", period);
    return `/feedback-reward/audit?${query.toString()}`;
  };
  return <section className="space-y-6"><header className="flex flex-wrap items-center gap-4"><Link className="text-sm font-semibold text-[#155cfd]" href="/feedback-reward">← Back to Overview</Link><h1 className="text-3xl font-bold text-slate-900">Audit Trail</h1></header><RecordList records={data.records} audit /><div className="flex flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>Menampilkan {start}–{end} dari {data.count} record</p>{totalPages > 1 && <nav aria-label="Pagination audit trail" className="flex items-center gap-1"><Link aria-disabled={data.page <= 1} className={`rounded-lg border px-3 py-2 font-semibold ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-[#cbd6ee] text-[#155cfd] hover:bg-[#eef4ff]"}`} href={hrefForPage(Math.max(1, data.page - 1))}>Sebelumnya</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <Link key={page} aria-current={page === data.page ? "page" : undefined} className={`grid size-9 place-items-center rounded-lg border text-sm font-bold ${page === data.page ? "border-[#155cfd] bg-[#155cfd] text-white" : "border-[#cbd6ee] text-[#155cfd] hover:bg-[#eef4ff]"}`} href={hrefForPage(page)}>{page}</Link>)}<Link aria-disabled={data.page >= totalPages} className={`rounded-lg border px-3 py-2 font-semibold ${data.page >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-[#cbd6ee] text-[#155cfd] hover:bg-[#eef4ff]"}`} href={hrefForPage(Math.min(totalPages, data.page + 1))}>Berikutnya</Link></nav>}</div></section>;
}

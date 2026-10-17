import Link from "next/link";
import { RewardList } from "@/components/feedback-reward/RecordList";
import { getEmployeeOptions, getFeedbackContext, getRecords, param, type SearchParams } from "@/utils/feedback-reward";

const rewardTypes = [["EMPLOYEE_OF_THE_MONTH", "Karyawan Teladan"], ["SAFETY_CHAMPION", "Safety Champion"], ["SERVICE_EXCELLENCE", "Service Excellence"], ["BEST_ATTENDANCE", "Kehadiran Terbaik"], ["SPECIAL_CONTRIBUTION", "Kontribusi Khusus"], ["OTHER", "Lainnya"]] as const;
const rewardStatuses = [["SUBMITTED", "Diajukan"], ["APPROVED", "Disetujui HR"], ["PUBLISHED", "Dipublikasikan"], ["REJECTED", "Ditolak"]] as const;

export default async function RewardListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { access, canCreate } = await getFeedbackContext();
  const params = await searchParams;
  const [data, employees] = await Promise.all([getRecords("reward", params), canCreate ? getEmployeeOptions() : Promise.resolve([])]);
  const totalPages = Math.max(1, Math.ceil(data.count / data.pageSize));
  const hrefForPage = (page: number) => {
    const query = new URLSearchParams();
    query.set("page", String(page));
    for (const key of ["employee_id", "reward_type", "status", "proposed_by", "date_from", "date_to"]) {
      const value = param(params, key);
      if (value) query.set(key, value);
    }
    return `/feedback-reward/reward?${query.toString()}`;
  };
  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><Link className="text-sm font-bold text-[#155cfd]" href="/feedback-reward">← Dashboard</Link><h1 className="mt-3 text-3xl font-bold text-[#121b2e]">Reward List</h1><p className="mt-2 text-slate-600">Daftar reward yang dapat Anda akses sesuai role dan permission.</p></div></header>
    {canCreate && <form className="grid grid-cols-1 gap-4 rounded-xl border border-[#d9e2fc] bg-white p-4 shadow-[0_4px_16px_rgba(15,35,66,0.04)] sm:grid-cols-2 lg:grid-cols-6"><label className="grid min-w-0 gap-1 text-xs font-bold text-[#1e3765]">Pegawai<select name="employee_id" defaultValue={param(params, "employee_id")} className="mt-1 h-11 w-full rounded-lg border border-[#cbd6ee] bg-white px-3 text-sm font-normal"><option value="">Semua pegawai</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_id}</option>)}</select></label><label className="grid min-w-0 gap-1 text-xs font-bold text-[#1e3765]">Jenis reward<select name="reward_type" defaultValue={param(params, "reward_type")} className="mt-1 h-11 w-full rounded-lg border border-[#cbd6ee] bg-white px-3 text-sm font-normal"><option value="">Semua jenis</option>{rewardTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid min-w-0 gap-1 text-xs font-bold text-[#1e3765]">Status<select name="status" defaultValue={param(params, "status")} className="mt-1 h-11 w-full rounded-lg border border-[#cbd6ee] bg-white px-3 text-sm font-normal"><option value="">Semua status</option>{rewardStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid min-w-0 gap-1 text-xs font-bold text-[#1e3765]">Pengaju<input name="proposed_by" defaultValue={param(params, "proposed_by")} placeholder="ID pengaju" className="mt-1 h-11 w-full rounded-lg border border-[#cbd6ee] px-3 text-sm font-normal" /></label><label className="grid min-w-0 gap-1 text-xs font-bold text-[#1e3765]">Dari tanggal<input type="date" name="date_from" defaultValue={param(params, "date_from")} aria-label="Dari tanggal" className="mt-1 h-11 w-full rounded-lg border border-[#cbd6ee] bg-white px-3 text-sm font-normal" /></label><label className="grid min-w-0 gap-1 text-xs font-bold text-[#1e3765]">Sampai tanggal<input type="date" name="date_to" defaultValue={param(params, "date_to")} aria-label="Sampai tanggal" className="mt-1 h-11 w-full rounded-lg border border-[#cbd6ee] bg-white px-3 text-sm font-normal" /></label><button className="h-11 rounded-lg bg-[#155cfd] px-5 text-sm font-bold text-white lg:col-span-6 lg:justify-self-end">Terapkan filter</button></form>}
    <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{data.count} reward ditemukan · Urut terbaru</p>{access.app_role === "EMPLOYEE" && <span className="text-xs font-semibold text-slate-500">Reward saya</span>}</div>
    <RewardList records={data.records as never[]} />
    {totalPages > 1 && <nav aria-label="Pagination reward" className="flex flex-wrap items-center justify-center gap-2"><Link aria-disabled={data.page <= 1} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${data.page <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-[#cbd6ee] text-[#155cfd]"}`} href={hrefForPage(Math.max(1, data.page - 1))}>Sebelumnya</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <Link key={page} aria-current={page === data.page ? "page" : undefined} className={`grid size-9 place-items-center rounded-lg border text-sm font-bold ${page === data.page ? "border-[#155cfd] bg-[#155cfd] text-white" : "border-[#cbd6ee] text-[#155cfd]"}`} href={hrefForPage(page)}>{page}</Link>)}<Link aria-disabled={data.page >= totalPages} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${data.page >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-[#cbd6ee] text-[#155cfd]"}`} href={hrefForPage(Math.min(totalPages, data.page + 1))}>Berikutnya</Link></nav>}
  </section>;
}

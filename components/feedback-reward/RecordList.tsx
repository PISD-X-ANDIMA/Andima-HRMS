import Link from "next/link";
import { dateLabel } from "@/utils/feedback-reward-format";
import type { AuditEntry, EmployeeIdentity, Feedback, Reward } from "@/types/feedback-reward";

function identity(employee: EmployeeIdentity | null) {
  return employee ? `${employee.full_name} · ${employee.employee_id}` : "Identity unavailable";
}

export function RecordList({ records, audit = false }: { records: (Feedback | Reward | AuditEntry)[]; audit?: boolean }) {
  if (!records.length) return <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Belum ada data yang tersedia.</p>;
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{audit ? <><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Modul</th><th className="px-4 py-3">Aktor</th></> : <><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Ringkasan</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Aksi</th></>}</tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{records.map((record) => {
    if ("entity_type" in record) return <tr key={record.id}><td className="px-4 py-3">{dateLabel(record.created_at, true)}</td><td className="px-4 py-3">{identity(record.employee)}</td><td className="px-4 py-3">{record.entity_type === "FEEDBACK" ? "Feedback" : "Reward"}</td><td className="px-4 py-3">{identity(record.actor)}</td></tr>;
    const feedback = "feedback_text" in record;
    const kind = feedback ? "feedback" : "reward";
    const summary = feedback ? record.feedback_text : record.reward_name;
    return <tr key={record.id}><td className="px-4 py-3 font-medium">{identity(record.employee)}</td><td className="max-w-sm px-4 py-3">{summary}</td><td className="px-4 py-3 whitespace-nowrap">{dateLabel(record.date)}</td><td className="px-4 py-3"><Link className="font-semibold text-[#155cfd] hover:underline" href={`/feedback-reward/${kind}/${record.id}`}>View</Link></td></tr>;
  })}</tbody></table></div>;
}

export function RecordCards({ records }: { records: (Feedback | Reward)[] }) {
  if (!records.length) return <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Belum ada data yang tersedia.</p>;
  return <div className="space-y-3">{records.map((record) => {
    const feedback = "feedback_text" in record;
    const kind = feedback ? "feedback" : "reward";
    return <Link key={record.id} href={`/feedback-reward/${kind}/${record.id}`} className="block rounded-lg border border-slate-200 p-4 transition hover:border-[#155cfd] hover:bg-slate-50"><p className="font-semibold text-slate-900">{record.employee?.full_name ?? "Identity unavailable"}</p><p className="mt-1 text-sm text-slate-600">{feedback ? record.feedback_text : record.reward_name}</p><p className="mt-2 text-xs text-slate-500">{dateLabel(record.date)}</p></Link>;
  })}</div>;
}

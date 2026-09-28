interface HrmsStatusPillProps {
  value: string | null;
}

function statusClass(value: string) {
  const normalized = value.toUpperCase();

  if (["PERMANENT", "VALID", "PRESENT"].includes(normalized)) return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (["CONTRACT", "PROBATION", "INTERN", "EXPIRING", "LATE"].includes(normalized)) return "bg-amber-50 text-amber-700 ring-amber-600/20";
  if (["RESIGNED", "TERMINATED", "EXPIRED", "ABSENT"].includes(normalized)) return "bg-rose-50 text-rose-700 ring-rose-600/20";

  return "bg-slate-100 text-slate-700 ring-slate-600/15";
}

export default function HrmsStatusPill({ value }: HrmsStatusPillProps) {
  const label = value || "Belum tersedia";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ${statusClass(label)}`}>{label}</span>;
}

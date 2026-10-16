interface EmployeeSyncHistoryItem {
  id: string;
  event_kind: string;
  message: string;
  created_at: string;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function eventLabel(kind: string) {
  switch (kind) {
    case "CREATED": return "Employee dibuat";
    case "MATCHED": return "Employee dikaitkan";
    case "WAITING_MASTER": return "Menunggu master";
    case "AMBIGUOUS_IDENTIFIER": return "Perlu ditinjau";
    case "SYNC_ERROR": return "Sinkronisasi gagal";
    default: return kind;
  }
}

function eventClassName(kind: string) {
  switch (kind) {
    case "CREATED": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "MATCHED": return "border-sky-200 bg-sky-50 text-sky-700";
    case "WAITING_MASTER": return "border-amber-200 bg-amber-50 text-amber-700";
    default: return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

export default function EmployeeSyncHistory({ events }: { events: EmployeeSyncHistoryItem[] }) {
  return (
    <section className="mt-5 rounded-[10px] border border-[#578AFC]/30 bg-white p-5 shadow-[3px_3px_16px_rgba(87,138,252,0.16)]">
      <div>
        <h2 className="text-base font-bold text-[#121B2E]">Riwayat Sinkronisasi Pegawai</h2>
        <p className="mt-1 text-xs text-slate-500">Data baru dari registrasi B2 yang PROVISIONED disinkronkan otomatis.</p>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada riwayat sinkronisasi.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((event) => (
            <li className="flex flex-col gap-2 border-b border-[#D9E2FC] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between" key={event.id}>
              <div>
                <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${eventClassName(event.event_kind)}`}>{eventLabel(event.event_kind)}</span>
                <p className="mt-2 text-sm font-medium text-[#26334F]">{event.message}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500" dateTime={event.created_at}>{formatTimestamp(event.created_at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

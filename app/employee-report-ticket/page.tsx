"use client";

import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FilePlus2,
  Filter,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type TicketStatus = "SUBMITTED" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
type ViewRole = "manager" | "employee";

type Activity = {
  id: string;
  kind: "status" | "followup" | "created";
  message: string;
  actor: string;
  at: string;
};

type TicketItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  title: string;
  category: string;
  description: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  status: TicketStatus;
  attachment?: string;
  history: Activity[];
};

const currentEmployeeId = "EMP-AND-001";

const initialTickets: TicketItem[] = [
  {
    id: "TCK-2026-0042",
    employeeId: currentEmployeeId,
    employeeName: "Nadira Putri",
    department: "Operations",
    title: "Perbaikan kursi kerja di area dispatch",
    category: "Workplace facility",
    description: "Kursi kerja di meja dispatch sudah tidak stabil dan mengganggu pekerjaan saat input dokumen.",
    occurredAt: "2026-09-21T09:15:00",
    createdAt: "2026-09-21T09:22:00",
    updatedAt: "2026-09-22T10:05:00",
    status: "IN_PROGRESS",
    attachment: "foto-kursi-dispatch.jpg",
    history: [
      { id: "h-1", kind: "created", message: "Ticket berhasil diajukan.", actor: "Nadira Putri", at: "2026-09-21T09:22:00" },
      { id: "h-2", kind: "status", message: "Status diubah menjadi In progress.", actor: "Dina HR", at: "2026-09-22T10:05:00" },
      { id: "h-3", kind: "followup", message: "Vendor fasilitas telah dihubungi untuk pemeriksaan kursi.", actor: "Dina HR", at: "2026-09-22T10:05:00" },
    ],
  },
  {
    id: "TCK-2026-0041",
    employeeId: "EMP-AND-002",
    employeeName: "Bagas Ramadhan",
    department: "Finance",
    title: "Akses aplikasi pengajuan belum aktif",
    category: "System access",
    description: "Akun pengajuan biaya operasional belum dapat diakses setelah proses onboarding.",
    occurredAt: "2026-09-20T13:30:00",
    createdAt: "2026-09-20T13:34:00",
    updatedAt: "2026-09-21T08:40:00",
    status: "IN_REVIEW",
    history: [
      { id: "h-4", kind: "created", message: "Ticket berhasil diajukan.", actor: "Bagas Ramadhan", at: "2026-09-20T13:34:00" },
      { id: "h-5", kind: "status", message: "Status diubah menjadi In review.", actor: "Dina HR", at: "2026-09-21T08:40:00" },
    ],
  },
  {
    id: "TCK-2026-0039",
    employeeId: currentEmployeeId,
    employeeName: "Nadira Putri",
    department: "Operations",
    title: "Permintaan alat pelindung tambahan",
    category: "Safety",
    description: "Membutuhkan tambahan rompi reflektif untuk kegiatan pengecekan muatan di malam hari.",
    occurredAt: "2026-09-18T19:00:00",
    createdAt: "2026-09-18T19:10:00",
    updatedAt: "2026-09-19T14:20:00",
    status: "RESOLVED",
    history: [
      { id: "h-6", kind: "created", message: "Ticket berhasil diajukan.", actor: "Nadira Putri", at: "2026-09-18T19:10:00" },
      { id: "h-7", kind: "followup", message: "Rompi reflektif telah diserahkan ke tim Operations.", actor: "Dina HR", at: "2026-09-19T14:20:00" },
      { id: "h-8", kind: "status", message: "Status diubah menjadi Resolved.", actor: "Dina HR", at: "2026-09-19T14:20:00" },
    ],
  },
  {
    id: "TCK-2026-0037",
    employeeId: "EMP-AND-004",
    employeeName: "Raka Prasetyo",
    department: "Warehouse",
    title: "Pencahayaan area loading perlu diperiksa",
    category: "Safety",
    description: "Lampu di sisi timur area loading berkedip saat shift malam.",
    occurredAt: "2026-09-17T21:30:00",
    createdAt: "2026-09-17T21:45:00",
    updatedAt: "2026-09-18T09:15:00",
    status: "SUBMITTED",
    history: [{ id: "h-9", kind: "created", message: "Ticket berhasil diajukan.", actor: "Raka Prasetyo", at: "2026-09-17T21:45:00" }],
  },
  {
    id: "TCK-2026-0034",
    employeeId: "EMP-AND-005",
    employeeName: "Salsa Maharani",
    department: "Customer Service",
    title: "Permintaan penyesuaian jadwal shift",
    category: "Work arrangement",
    description: "Meminta peninjauan jadwal shift untuk minggu berikutnya.",
    occurredAt: "2026-09-15T08:10:00",
    createdAt: "2026-09-15T08:20:00",
    updatedAt: "2026-09-16T11:10:00",
    status: "REJECTED",
    history: [
      { id: "h-10", kind: "created", message: "Ticket berhasil diajukan.", actor: "Salsa Maharani", at: "2026-09-15T08:20:00" },
      { id: "h-11", kind: "followup", message: "Permintaan tidak dapat diproses karena jadwal shift telah dikunci.", actor: "Dina HR", at: "2026-09-16T11:10:00" },
      { id: "h-12", kind: "status", message: "Status diubah menjadi Rejected.", actor: "Dina HR", at: "2026-09-16T11:10:00" },
    ],
  },
];

const statusMeta: Record<TicketStatus, { label: string; className: string }> = {
  SUBMITTED: { label: "Submitted", className: "border-[#d9e2fc] bg-[#f1f3ff] text-[#4d5f81]" },
  IN_REVIEW: { label: "In review", className: "border-[#b9d6ff] bg-[#edf6ff] text-[#1971c2]" },
  IN_PROGRESS: { label: "In progress", className: "border-[#fde68a] bg-[#fef9c3] text-[#b7791f]" },
  RESOLVED: { label: "Resolved", className: "border-[#bbf0d2] bg-[#eaf7f0] text-[#16834b]" },
  REJECTED: { label: "Rejected", className: "border-[#fecaca] bg-[#fff1f2] text-[#d64545]" },
};

const categories = ["Workplace facility", "System access", "Safety", "Work arrangement", "Operational issue", "Other"];

function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export default function EmployeeReportTicketPage() {
  const [tickets, setTickets] = useState<TicketItem[]>(initialTickets);
  const [selectedId, setSelectedId] = useState(initialTickets[0].id);
  const [viewRole, setViewRole] = useState<ViewRole>("manager");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [isHrmsOpen, setIsHrmsOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [notice, setNotice] = useState("");

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const isOwned = viewRole === "manager" || ticket.employeeId === currentEmployeeId;
      const isMatchingStatus = statusFilter === "ALL" || ticket.status === statusFilter;
      const searchable = `${ticket.id} ${ticket.employeeName} ${ticket.title} ${ticket.category}`.toLowerCase();
      return isOwned && isMatchingStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, statusFilter, tickets, viewRole]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) ?? visibleTickets[0];

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function changeStatus(status: TicketStatus) {
    if (!selectedTicket || viewRole !== "manager" || selectedTicket.status === status) return;
    const now = new Date().toISOString();
    setTickets((current) => current.map((ticket) => ticket.id === selectedTicket.id
      ? {
          ...ticket,
          status,
          updatedAt: now,
          history: [...ticket.history, { id: crypto.randomUUID(), kind: "status", message: `Status diubah menjadi ${statusMeta[status].label}.`, actor: "Dina HR", at: now }],
        }
      : ticket));
    showNotice("Status ticket diperbarui.");
  }

  function addFollowUp() {
    if (!selectedTicket || viewRole !== "manager" || !followUp.trim()) return;
    const now = new Date().toISOString();
    setTickets((current) => current.map((ticket) => ticket.id === selectedTicket.id
      ? {
          ...ticket,
          updatedAt: now,
          history: [...ticket.history, { id: crypto.randomUUID(), kind: "followup", message: followUp.trim(), actor: "Dina HR", at: now }],
        }
      : ticket));
    setFollowUp("");
    showNotice("Follow-up tersimpan di riwayat ticket.");
  }

  function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const occurredAt = String(formData.get("occurredAt") ?? "");
    const attachment = String(formData.get("attachment") ?? "");
    if (!title || !category || !description || !occurredAt) return;

    const now = new Date().toISOString();
    const created: TicketItem = {
      id: `TCK-${new Date().getFullYear()}-${String(tickets.length + 43).padStart(4, "0")}`,
      employeeId: currentEmployeeId,
      employeeName: "Nadira Putri",
      department: "Operations",
      title,
      category,
      description,
      occurredAt,
      createdAt: now,
      updatedAt: now,
      status: "SUBMITTED",
      attachment: attachment || undefined,
      history: [{ id: crypto.randomUUID(), kind: "created", message: "Ticket berhasil diajukan.", actor: "Nadira Putri", at: now }],
    };
    setTickets((current) => [created, ...current]);
    setSelectedId(created.id);
    setIsCreateOpen(false);
    showNotice(`${created.id} berhasil dibuat.`);
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] text-[#121b2e]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f2342] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-lg bg-[#069494] shadow-sm"><BriefcaseBusiness size={19} className="text-white" /></div>
          <div><p className="text-xl font-bold tracking-[-0.5px] text-white">ANDIMA</p><p className="text-xs text-[#d9e2fc]/80">Logistics Suite</p></div>
          <button onClick={() => setIsSidebarOpen(false)} className="ml-auto rounded p-1 text-[#d9e2fc] lg:hidden" aria-label="Tutup navigasi"><X size={18} /></button>
        </div>

        <nav className="mt-8 space-y-1.5 text-sm font-semibold">
          <SidebarItem icon={<LayoutDashboard size={16} />} label="Dashboard" />
          <SidebarItem icon={<BriefcaseBusiness size={16} />} label="POS" />
          <SidebarItem icon={<UsersRound size={16} />} label="CRM" suffix={<ChevronRight size={15} />} />
          <div>
            <button onClick={() => setIsHrmsOpen((value) => !value)} className="flex w-full items-center justify-between rounded-lg bg-[#069494] px-3 py-2.5 text-white shadow-sm">
              <span className="flex items-center gap-3"><ClipboardList size={17} /> HRMS</span><ChevronDown size={16} className={isHrmsOpen ? "rotate-0" : "-rotate-90"} />
            </button>
            {isHrmsOpen && <div className="ml-5 mt-2 border-l border-[#d9e2fc]/20 pl-3">
              <SidebarSubItem label="Employee Profile" />
              <SidebarSubItem label="Attendance & Productivity" />
              <SidebarSubItem label="Feedback & Reward" />
              <SidebarSubItem label="Employee Report & Ticket" active />
            </div>}
          </div>
          <SidebarItem icon={<ShieldCheck size={16} />} label="MID" suffix={<ChevronRight size={15} />} />
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-[#d9e2fc]/15 bg-[#1e3765] p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-white"><CircleHelp size={14} className="text-[#77d8cd]" /> Customer Support</div><p className="mt-1 text-[10px] text-[#d9e2fc]/80">24/7 Operations Line</p></div>
          <SidebarItem icon={<Settings size={15} />} label="Settings" />
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5"><span className="grid size-7 place-items-center rounded-full bg-[#16834b] text-[10px] font-bold text-white">NN</span><div><p className="text-xs font-bold text-white">Nick Nelson</p><p className="text-[10px] text-[#d9e2fc]/75">Web Developer</p></div></div>
        </div>
      </aside>

      <section className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#d9e2fc] bg-white px-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setIsSidebarOpen(true)} className="rounded p-1.5 text-[#1e3765] lg:hidden" aria-label="Buka navigasi"><Menu size={20} /></button><div className="hidden items-center gap-3 sm:flex"><span className="font-bold">ANDIMA HRMS</span><span className="text-[#d9e2fc]">|</span><span className="text-xs font-semibold text-[#3f4940]">HRMS</span><ChevronRight size={13} className="text-[#4d5f81]/50" /><span className="truncate text-xs font-semibold text-[#006838]">Employee Report & Ticket</span></div></div>
          <label className="hidden w-64 items-center gap-2 rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 md:flex"><Search size={14} className="text-[#4d5f81]/70" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-[#4d5f81]/70" placeholder="Cari ticket, employee..." /></label>
          <div className="flex items-center gap-2 sm:gap-3"><button className="relative grid size-9 place-items-center rounded-lg text-[#4d5f81] hover:bg-[#f1f3ff]" aria-label="Notifikasi"><Bell size={17} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64545]" /></button><button className="grid size-9 place-items-center rounded-lg text-[#4d5f81] hover:bg-[#f1f3ff]" aria-label="Bantuan"><CircleHelp size={17} /></button><div className="hidden items-center gap-2 border-l border-[#d9e2fc] pl-3 sm:flex"><span className="grid size-8 place-items-center rounded-full border border-[#006838]/30 bg-[#16834b]/15 text-xs font-bold text-[#006838]">NN</span><div className="text-left"><p className="text-xs font-bold">Nick Nelson</p><p className="text-[10px] text-[#4d5f81]">HRMS Team</p></div></div></div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          <div className="flex flex-col justify-between gap-4 border-b border-[#d9e2fc] pb-5 xl:flex-row xl:items-end">
            <div><div className="mb-3 flex items-center gap-5 text-xs font-semibold text-[#4d5f81]"><span>Overview</span><span className="rounded-full bg-[#d9e2fc]/60 px-2 py-0.5">12</span><span className="border-b-2 border-[#069494] pb-2 text-[#006838]">Tickets</span><span>My tasks</span></div><h1 className="text-2xl font-bold tracking-[-0.4px]">Employee Report & Ticket</h1><p className="mt-1 text-sm text-[#4d5f81]">Catat, tindak lanjuti, dan pantau kebutuhan pekerjaan secara terstruktur.</p></div>
            <div className="flex flex-wrap items-center gap-2"><select value={viewRole} onChange={(event) => setViewRole(event.target.value as ViewRole)} className="rounded-lg border border-[#becabd]/60 bg-white px-3 py-2 text-xs font-semibold text-[#3f4940] outline-none"><option value="manager">HR / Manager view</option><option value="employee">Employee view</option></select><button onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#006838]"><FilePlus2 size={15} /> Buat Ticket</button></div>
          </div>

          <div className="mt-5 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="flex flex-col gap-3 border-b border-[#becabd]/35 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><Filter size={15} className="text-[#4d5f81]" /><FilterButton active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>Semua <span className="rounded bg-[#1e3765] px-1.5 py-0.5 text-[10px] text-white">{tickets.length}</span></FilterButton>{(["SUBMITTED", "IN_REVIEW", "IN_PROGRESS", "RESOLVED"] as TicketStatus[]).map((status) => <FilterButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>{statusMeta[status].label}</FilterButton>)}</div><label className="flex items-center gap-2 rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 md:hidden"><Search size={14} className="text-[#4d5f81]/70" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="Cari ticket..." /></label></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="border-b border-[#becabd]/35 bg-[#f7f8ff] text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]"><tr><th className="w-10 px-4 py-3"><input aria-label="Pilih semua ticket" type="checkbox" className="size-4 accent-[#16834b]" /></th><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Ticket</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Status</th><th className="w-12 px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#becabd]/25">{visibleTickets.map((ticket) => <tr key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`cursor-pointer transition hover:bg-[#f7f8ff] ${selectedTicket?.id === ticket.id ? "bg-[#eaf7f0]" : "bg-white"}`}><td className="px-4 py-3.5"><input onClick={(event) => event.stopPropagation()} aria-label={`Pilih ${ticket.id}`} type="checkbox" className="size-4 accent-[#16834b]" /></td><td className="px-3 py-3.5"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#b0c6d4] text-[10px] font-bold text-[#1e3765]">{ticket.employeeName.split(" ").map((name) => name[0]).join("").slice(0, 2)}</span><div><p className="text-xs font-bold">{ticket.employeeName}</p><p className="text-[10px] text-[#4d5f81]">{ticket.employeeId}</p></div></div></td><td className="px-3 py-3.5"><p className="text-xs font-semibold">{ticket.title}</p><p className="mt-0.5 text-[10px] text-[#4d5f81]">{ticket.id} · {ticket.category}</p></td><td className="px-3 py-3.5 text-xs text-[#3f4940]">{formatDate(ticket.createdAt)}</td><td className="px-3 py-3.5"><StatusBadge status={ticket.status} /></td><td className="px-3 py-3.5"><button onClick={(event) => { event.stopPropagation(); setSelectedId(ticket.id); }} className="rounded p-1.5 text-[#4d5f81] hover:bg-[#d9e2fc]/55" aria-label={`Lihat ${ticket.id}`}><MoreHorizontal size={17} /></button></td></tr>)}{visibleTickets.length === 0 && <tr><td colSpan={6} className="px-6 py-14 text-center text-sm text-[#4d5f81]">Tidak ada ticket yang sesuai dengan filter.</td></tr>}</tbody></table></div>
              <div className="flex flex-col gap-2 border-t border-[#becabd]/35 px-4 py-3 text-xs text-[#4d5f81] sm:flex-row sm:items-center sm:justify-between"><span>Menampilkan <b className="text-[#121b2e]">{visibleTickets.length}</b> dari <b className="text-[#121b2e]">{viewRole === "manager" ? tickets.length : tickets.filter((ticket) => ticket.employeeId === currentEmployeeId).length}</b> ticket</span><div className="flex items-center gap-1"><button disabled className="rounded border border-[#becabd]/35 px-2.5 py-1.5 opacity-50">Previous</button><button className="rounded bg-[#16834b] px-2.5 py-1.5 font-bold text-white">1</button><button className="rounded border border-[#becabd]/45 px-2.5 py-1.5">Next</button></div></div>
            </section>

            <TicketDetail ticket={selectedTicket} role={viewRole} followUp={followUp} onFollowUpChange={setFollowUp} onAddFollowUp={addFollowUp} onChangeStatus={changeStatus} />
          </div>
        </div>
      </section>

      {notice && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-3 text-sm font-semibold text-white shadow-xl"><CheckCircle2 size={17} className="text-[#77d8cd]" />{notice}</div>}
      {isCreateOpen && <CreateTicketModal onClose={() => setIsCreateOpen(false)} onSubmit={createTicket} />}
    </main>
  );
}

function SidebarItem({ icon, label, suffix }: { icon: React.ReactNode; label: string; suffix?: React.ReactNode }) {
  return <button className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10"><span className="flex items-center gap-3">{icon}{label}</span>{suffix}</button>;
}

function SidebarSubItem({ label, active = false }: { label: string; active?: boolean }) {
  return <button className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${active ? "bg-[#b0c6d4] font-bold text-[#1e3765]" : "text-[#d9e2fc] hover:bg-white/10"}`}><span className={`size-1.5 rounded-full ${active ? "bg-[#069494]" : "bg-[#d9e2fc]/40"}`} />{label}</button>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${active ? "bg-[#1e3765] text-white" : "bg-[#f1f3ff] text-[#4d5f81] hover:bg-[#d9e2fc]"}`}>{children}</button>;
}

function TicketDetail({ ticket, role, followUp, onFollowUpChange, onAddFollowUp, onChangeStatus }: { ticket?: TicketItem; role: ViewRole; followUp: string; onFollowUpChange: (value: string) => void; onAddFollowUp: () => void; onChangeStatus: (status: TicketStatus) => void }) {
  if (!ticket) return <aside className="rounded-xl border border-[#becabd]/45 bg-white p-6 text-sm text-[#4d5f81]">Pilih ticket untuk melihat detail.</aside>;
  return <aside className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:sticky xl:top-21 xl:h-fit">
    <div className="flex items-start justify-between bg-[#1e3765] px-5 py-4 text-white"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg border border-[#069494] bg-[#577c8e]"><Ticket size={15} /></span><div><p className="text-sm font-bold">Ticket Details — {ticket.id.replace("TCK-2026-", "")}</p><p className="text-[11px] text-[#d9e2fc]">Employee report workflow</p></div></div><button className="rounded p-1 text-[#d9e2fc] hover:bg-white/10" aria-label="Tutup detail"><X size={16} /></button></div>
    <div className="space-y-5 p-5"><div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4d5f81]">Current status</p><StatusBadge status={ticket.status} /></div>{role === "manager" ? <select value={ticket.status} onChange={(event) => onChangeStatus(event.target.value as TicketStatus)} className="w-full rounded-lg border border-[#becabd]/60 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#069494]">{(Object.keys(statusMeta) as TicketStatus[]).map((status) => <option key={status} value={status}>{statusMeta[status].label}</option>)}</select> : <p className="text-xs text-[#4d5f81]">Status dapat diperbarui oleh HR atau Manager.</p>}</div>
      <div className="border-y border-[#becabd]/35 py-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[#b0c6d4] text-[10px] font-bold text-[#1e3765]">{ticket.employeeName.split(" ").map((name) => name[0]).join("").slice(0, 2)}</span><div><p className="text-xs font-bold">{ticket.employeeName}</p><p className="text-[10px] text-[#4d5f81]">{ticket.employeeId} · {ticket.department}</p></div></div><h2 className="mt-4 text-base font-bold leading-6">{ticket.title}</h2><p className="mt-1 text-xs text-[#4d5f81]">{ticket.category} · Dilaporkan {formatDate(ticket.createdAt, true)}</p><p className="mt-3 text-sm leading-6 text-[#3f4940]">{ticket.description}</p>{ticket.attachment && <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 text-xs font-semibold text-[#1e3765]"><Paperclip size={14} />{ticket.attachment}</div>}</div>
      <div><div className="mb-3 flex items-center gap-2"><Clock3 size={15} className="text-[#069494]" /><p className="text-xs font-bold">Progress & history</p></div><ol className="space-y-4 border-l border-[#d9e2fc] pl-4">{[...ticket.history].reverse().map((activity) => <li key={activity.id} className="relative"><span className={`absolute -left-[21px] top-1 grid size-3 place-items-center rounded-full ${activity.kind === "status" ? "bg-[#069494]" : activity.kind === "followup" ? "bg-[#16834b]" : "bg-[#b0c6d4]"}`}><span className="size-1 rounded-full bg-white" /></span><p className="text-xs font-semibold text-[#3f4940]">{activity.message}</p><p className="mt-1 text-[10px] text-[#4d5f81]">{activity.actor} · {formatDate(activity.at, true)}</p></li>)}</ol></div>
      {role === "manager" && <div className="rounded-lg bg-[#f1f3ff] p-3"><label className="flex items-center gap-2 text-xs font-bold text-[#1e3765]"><MessageSquareText size={14} /> Tambah follow-up</label><textarea value={followUp} onChange={(event) => onFollowUpChange(event.target.value)} className="mt-2 min-h-20 w-full resize-none rounded-lg border border-[#d9e2fc] bg-white p-2.5 text-xs outline-none focus:border-[#069494]" placeholder="Tuliskan tindakan atau informasi tindak lanjut..." /><button disabled={!followUp.trim()} onClick={onAddFollowUp} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={13} /> Simpan follow-up</button></div>}</div>
  </aside>;
}

function CreateTicketModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4"><section role="dialog" aria-modal="true" aria-labelledby="create-ticket-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#d9e2fc] px-6 py-4"><div><h2 id="create-ticket-title" className="text-lg font-bold">Buat Employee Ticket</h2><p className="mt-0.5 text-xs text-[#4d5f81]">Employee ID akan terhubung otomatis setelah login.</p></div><button onClick={onClose} className="rounded p-1.5 text-[#4d5f81] hover:bg-[#f1f3ff]" aria-label="Tutup form"><X size={18} /></button></div><form onSubmit={onSubmit} className="space-y-4 p-6"><Field label="Judul ticket" required><input name="title" required className="field" placeholder="Contoh: Perbaikan kursi kerja di area dispatch" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Kategori" required><select name="category" required defaultValue="" className="field"><option value="" disabled>Pilih kategori</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Tanggal / waktu kejadian" required><input name="occurredAt" type="datetime-local" required className="field" /></Field></div><Field label="Deskripsi" required><textarea name="description" required className="field min-h-28 resize-y" placeholder="Jelaskan kondisi, masalah, atau kebutuhan pekerjaan secara singkat dan jelas." /></Field><Field label="Nama lampiran" hint="Opsional pada preview ini"><input name="attachment" className="field" placeholder="Contoh: foto-kondisi.jpg" /></Field><div className="flex justify-end gap-2 border-t border-[#d9e2fc] pt-4"><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-[#4d5f81] hover:bg-[#f1f3ff]">Batal</button><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#006838]"><FilePlus2 size={14} /> Ajukan Ticket</button></div></form></section></div>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-[#3f4940]"><span>{label}{required && <span className="ml-1 text-[#d64545]">*</span>}</span>{hint && <span className="ml-2 font-normal text-[#4d5f81]">{hint}</span>}<span className="mt-1.5 block [&_.field]:w-full [&_.field]:rounded-lg [&_.field]:border [&_.field]:border-[#becabd]/60 [&_.field]:bg-white [&_.field]:px-3 [&_.field]:py-2.5 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:outline-none [&_.field]:focus:border-[#069494]">{children}</span></label>;
}

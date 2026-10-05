"use client";

import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FilePlus2,
  Filter,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Ticket,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type TicketStatus = "SUBMITTED" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
type ViewRole = "manager" | "employee";
type AppRole = "EMPLOYEE" | "HR" | "MANAGER";

type Activity = {
  id: string;
  kind: "status" | "followup" | "created";
  message: string;
  actor: string;
  at: string;
};

type TicketItem = {
  dbId: string;
  id: string;
  employeeUuid: string;
  employeeId: string;
  employeeName: string;
  department: string;
  title: string;
  category: string;
  description: string;
  occurredAt?: string;
  createdAt: string;
  updatedAt: string;
  status: TicketStatus;
  attachment?: { fileName: string; storagePath: string };
  history: Activity[];
};

type CreateTicketInput = {
  title: string;
  category: string;
  description: string;
  occurredAt?: string;
  attachment?: File;
};

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

function currentLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export default function EmployeeReportTicketPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [viewRole, setViewRole] = useState<ViewRole>("employee");
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [viewerEmployeeId, setViewerEmployeeId] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [isAccountLoading, setIsAccountLoading] = useState(true);
  const [isTicketLoading, setIsTicketLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [followUpAt, setFollowUpAt] = useState(currentLocalDateTime);
  const [notice, setNotice] = useState("");

  async function loadTickets(actorEmployeeId = viewerEmployeeId, actorName = viewerName) {
    const supabase = createClient();
    setIsTicketLoading(true);
    const { data: ticketRows, error: ticketError } = await supabase
      .from("d3_tickets")
      .select("id, ticket_code, employee_id, reporter_name, reporter_employee_code, reporter_department, title, category, description, occurred_at, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (ticketError) {
      showNotice("Ticket belum dapat dimuat. Silakan coba lagi.");
      setIsTicketLoading(false);
      return;
    }

    const ticketIds = (ticketRows ?? []).map((ticket) => ticket.id);
    const [historyResult, followUpResult, attachmentResult] = ticketIds.length
      ? await Promise.all([
          supabase.from("d3_ticket_history").select("id, ticket_id, actor_employee_id, event_type, from_status, to_status, note, created_at").in("ticket_id", ticketIds).order("created_at"),
          supabase.from("d3_ticket_followups").select("id, ticket_id, actor_employee_id, note, follow_up_at, created_at").in("ticket_id", ticketIds).order("created_at"),
          supabase.from("d3_ticket_attachments").select("ticket_id, file_name, storage_path").in("ticket_id", ticketIds).order("created_at"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

    if (historyResult.error || followUpResult.error || attachmentResult.error) {
      showNotice("Sebagian riwayat ticket belum dapat dimuat.");
    }

    const historiesByTicket = new Map<string, Activity[]>();
    for (const history of historyResult.data ?? []) {
      const current = historiesByTicket.get(history.ticket_id) ?? [];
      const status = history.to_status as TicketStatus | null;
      const message = history.event_type === "CREATED"
        ? "Ticket berhasil diajukan."
        : history.event_type === "STATUS_CHANGED" && status
          ? `Status diubah menjadi ${statusMeta[status].label}.`
          : history.note ?? "Tindak lanjut ditambahkan.";
      current.push({
        id: history.id,
        kind: history.event_type === "CREATED" ? "created" : "status",
        message,
        actor: history.actor_employee_id === actorEmployeeId ? actorName || "Employee" : "HR / Manager",
        at: history.created_at,
      });
      historiesByTicket.set(history.ticket_id, current);
    }
    for (const followUp of followUpResult.data ?? []) {
      const current = historiesByTicket.get(followUp.ticket_id) ?? [];
      current.push({
        id: `followup-${followUp.id}`,
        kind: "followup",
        message: followUp.note,
        actor: followUp.actor_employee_id === actorEmployeeId ? actorName || "HR / Manager" : "HR / Manager",
        at: followUp.follow_up_at ?? followUp.created_at,
      });
      historiesByTicket.set(followUp.ticket_id, current);
    }
    const attachmentsByTicket = new Map((attachmentResult.data ?? []).map((attachment) => [attachment.ticket_id, { fileName: attachment.file_name, storagePath: attachment.storage_path }]));
    const loadedTickets = (ticketRows ?? []).map((ticket): TicketItem => ({
      dbId: ticket.id,
      id: ticket.ticket_code,
      employeeUuid: ticket.employee_id,
      employeeId: ticket.reporter_employee_code ?? "Employee",
      employeeName: ticket.reporter_name ?? "Employee",
      department: ticket.reporter_department ?? "-",
      title: ticket.title,
      category: ticket.category,
      description: ticket.description,
      occurredAt: ticket.occurred_at ?? undefined,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      status: ticket.status as TicketStatus,
      attachment: attachmentsByTicket.get(ticket.id),
      history: (historiesByTicket.get(ticket.id) ?? []).sort((a, b) => a.at.localeCompare(b.at)),
    }));
    setTickets(loadedTickets);
    setSelectedId((current) => loadedTickets.some((ticket) => ticket.id === current) ? current : (loadedTickets[0]?.id ?? ""));
    setIsTicketLoading(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAccountAccess() {
      try {
        const supabase = createClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData.user) {
          router.replace("/login");
          return;
        }

        const { data: access, error: accessError } = await supabase
          .from("d3_user_access")
          .select("app_role, employee_id")
          .eq("auth_user_id", userData.user.id)
          .maybeSingle();

        if (accessError || !access) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (!isMounted) return;
        const role = access.app_role as AppRole;
        const metadataName = userData.user.user_metadata?.full_name;
        const fallbackName = userData.user.email?.split("@")[0] ?? "User Andima";
        const accountName = typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : fallbackName;
        setViewerName(accountName);
        setAppRole(role);
        setViewRole(role === "EMPLOYEE" ? "employee" : "manager");
        setViewerEmployeeId(access.employee_id);
        setAuthUserId(userData.user.id);
        await loadTickets(access.employee_id, accountName);
      } catch {
        router.replace("/login");
      } finally {
        if (isMounted) setIsAccountLoading(false);
      }
    }

    void loadAccountAccess();
    return () => { isMounted = false; };
  // loadTickets only uses the active authenticated browser session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const viewerInitials = viewerName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AU";
  const viewerRoleLabel = appRole === "HR" ? "HR" : appRole === "MANAGER" ? "Manager" : "Employee";

  const accessibleTickets = useMemo(() => tickets.filter((ticket) => viewRole === "manager" || ticket.employeeUuid === viewerEmployeeId), [tickets, viewRole, viewerEmployeeId]);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accessibleTickets.filter((ticket) => {
      const isMatchingStatus = statusFilter === "ALL" || ticket.status === statusFilter;
      const searchable = `${ticket.id} ${ticket.employeeName} ${ticket.title} ${ticket.category}`.toLowerCase();
      return isMatchingStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [accessibleTickets, query, statusFilter]);

  const selectedTicket = visibleTickets.find((ticket) => ticket.id === selectedId);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function changeStatus(status: TicketStatus) {
    if (!selectedTicket || viewRole !== "manager" || selectedTicket.status === status) return;
    setIsSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("d3_tickets").update({ status }).eq("id", selectedTicket.dbId);
    setIsSaving(false);
    if (error) {
      showNotice("Status ticket belum berhasil diperbarui.");
      return;
    }
    await loadTickets();
    showNotice("Status ticket diperbarui.");
  }

  async function addFollowUp() {
    if (!selectedTicket || viewRole !== "manager" || !followUp.trim()) return;
    if (!viewerEmployeeId) return;
    setIsSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("d3_ticket_followups").insert({
      ticket_id: selectedTicket.dbId,
      actor_employee_id: viewerEmployeeId,
      note: followUp.trim(),
      follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
    });
    setIsSaving(false);
    if (error) {
      showNotice("Follow-up belum berhasil disimpan.");
      return;
    }
    setFollowUp("");
    setFollowUpAt(currentLocalDateTime());
    await loadTickets();
    showNotice("Follow-up tersimpan di riwayat ticket.");
  }

  async function createTicket(input: CreateTicketInput) {
    if (!viewerEmployeeId || !authUserId) return { ok: false, message: "Akses employee belum siap. Login ulang lalu coba lagi." };
    const { title, category, description, occurredAt, attachment } = input;
    if (attachment && attachment.size > 5 * 1024 * 1024) return { ok: false, message: "Lampiran maksimal 5 MB." };
    const supabase = createClient();
    const { data: created, error } = await supabase.from("d3_tickets").insert({
      employee_id: viewerEmployeeId,
      title,
      category,
      description,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
    }).select("id, ticket_code").single();

    if (error || !created) return { ok: false, message: "Ticket belum berhasil dibuat. Periksa kembali data lalu coba lagi." };

    if (attachment) {
      const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${authUserId}/${created.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("d3-ticket-attachments").upload(storagePath, attachment, { contentType: attachment.type || undefined });
      if (uploadError) {
        await loadTickets();
        setSelectedId(created.ticket_code);
        setIsCreateOpen(false);
        showNotice(`${created.ticket_code} dibuat, tetapi lampiran belum berhasil diunggah.`);
        return { ok: true };
      }
      const { error: attachmentError } = await supabase.from("d3_ticket_attachments").insert({
        ticket_id: created.id,
        storage_path: storagePath,
        file_name: attachment.name,
        mime_type: attachment.type || null,
        byte_size: attachment.size,
      });
      if (attachmentError) {
        await loadTickets();
        setSelectedId(created.ticket_code);
        setIsCreateOpen(false);
        showNotice(`${created.ticket_code} dibuat, tetapi metadata lampiran belum tersimpan.`);
        return { ok: true };
      }
    }

    await loadTickets();
    setSelectedId(created.ticket_code);
    setIsCreateOpen(false);
    showNotice(`${created.ticket_code} berhasil dibuat.`);
    return { ok: true };
  }

  async function openAttachment(attachment: { fileName: string; storagePath: string }) {
    const { data, error } = await createClient().storage.from("d3-ticket-attachments").createSignedUrl(attachment.storagePath, 60);
    if (error || !data?.signedUrl) {
      showNotice("Lampiran belum dapat dibuka.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (isAccountLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8ff] text-sm font-semibold text-[#4d5f81]">Memuat akses HRMS...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] text-[#121b2e]">
      <section className="min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#d9e2fc] bg-white px-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><div className="hidden items-center gap-3 sm:flex"><span className="font-bold">ANDIMA HRMS</span><span className="text-[#d9e2fc]">|</span><span className="text-xs font-semibold text-[#3f4940]">HRMS</span><ChevronRight size={13} className="text-[#4d5f81]/50" /><span className="truncate text-xs font-semibold text-[#006838]">Employee Report & Ticket</span></div></div>
          <label className="hidden w-64 items-center gap-2 rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 md:flex"><Search size={14} className="text-[#4d5f81]/70" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-[#4d5f81]/70" placeholder="Cari ticket, employee..." /></label>
          <div className="flex items-center gap-2 sm:gap-3"><button className="relative grid size-9 place-items-center rounded-lg text-[#4d5f81] hover:bg-[#f1f3ff]" aria-label="Notifikasi"><Bell size={17} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64545]" /></button><div className="hidden items-center gap-2 border-l border-[#d9e2fc] pl-3 sm:flex"><span className="grid size-8 place-items-center rounded-full border border-[#006838]/30 bg-[#16834b]/15 text-xs font-bold text-[#006838]">{viewerInitials}</span><div className="text-left"><p className="text-xs font-bold">{viewerName}</p><p className="text-[10px] text-[#4d5f81]">{viewerRoleLabel}</p></div></div></div>
        </header>

        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          <div className="flex flex-col justify-between gap-4 border-b border-[#d9e2fc] pb-5 xl:flex-row xl:items-end">
            <div><div className="mb-3 flex items-center gap-5 text-xs font-semibold text-[#4d5f81]"><span>Overview</span><span className="rounded-full bg-[#d9e2fc]/60 px-2 py-0.5">{accessibleTickets.length}</span><span className="border-b-2 border-[#069494] pb-2 text-[#006838]">Tickets</span><span>My tasks</span></div><h1 className="text-2xl font-bold tracking-[-0.4px]">Employee Report & Ticket</h1><p className="mt-1 text-sm text-[#4d5f81]">Catat, tindak lanjuti, dan pantau kebutuhan pekerjaan secara terstruktur.</p></div>
            <div className="flex flex-wrap items-center gap-2">{viewRole === "employee" && <button onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#006838]"><FilePlus2 size={15} /> Buat Ticket</button>}</div>
          </div>

          <div className="mt-5 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="flex flex-col gap-3 border-b border-[#becabd]/35 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-2"><Filter size={15} className="text-[#4d5f81]" /><FilterButton active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>Semua <span className="rounded bg-[#1e3765] px-1.5 py-0.5 text-[10px] text-white">{accessibleTickets.length}</span></FilterButton>{(["SUBMITTED", "IN_REVIEW", "IN_PROGRESS", "RESOLVED", "REJECTED"] as TicketStatus[]).map((status) => <FilterButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>{statusMeta[status].label}</FilterButton>)}</div><label className="flex items-center gap-2 rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 md:hidden"><Search size={14} className="text-[#4d5f81]/70" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="Cari ticket..." /></label></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="border-b border-[#becabd]/35 bg-[#f7f8ff] text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]"><tr><th className="w-10 px-4 py-3"><input aria-label="Pilih semua ticket" type="checkbox" className="size-4 accent-[#16834b]" /></th><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Ticket</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Status</th><th className="w-12 px-3 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#becabd]/25">{isTicketLoading ? <tr><td colSpan={6} className="px-6 py-14 text-center text-sm text-[#4d5f81]">Memuat ticket dari database...</td></tr> : visibleTickets.map((ticket) => <tr key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`cursor-pointer transition hover:bg-[#f7f8ff] ${selectedTicket?.id === ticket.id ? "bg-[#eaf7f0]" : "bg-white"}`}><td className="px-4 py-3.5"><input onClick={(event) => event.stopPropagation()} aria-label={`Pilih ${ticket.id}`} type="checkbox" className="size-4 accent-[#16834b]" /></td><td className="px-3 py-3.5"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#b0c6d4] text-[10px] font-bold text-[#1e3765]">{ticket.employeeName.split(" ").map((name) => name[0]).join("").slice(0, 2)}</span><div><p className="text-xs font-bold">{ticket.employeeName}</p><p className="text-[10px] text-[#4d5f81]">{ticket.employeeId}</p></div></div></td><td className="px-3 py-3.5"><p className="text-xs font-semibold">{ticket.title}</p><p className="mt-0.5 text-[10px] text-[#4d5f81]">{ticket.id} · {ticket.category}</p></td><td className="px-3 py-3.5 text-xs text-[#3f4940]">{formatDate(ticket.createdAt)}</td><td className="px-3 py-3.5"><StatusBadge status={ticket.status} /></td><td className="px-3 py-3.5"><button onClick={(event) => { event.stopPropagation(); setSelectedId(ticket.id); }} className="rounded p-1.5 text-[#4d5f81] hover:bg-[#d9e2fc]/55" aria-label={`Lihat ${ticket.id}`}><MoreHorizontal size={17} /></button></td></tr>)}{!isTicketLoading && visibleTickets.length === 0 && <tr><td colSpan={6} className="px-6 py-14 text-center text-sm text-[#4d5f81]">Belum ada ticket yang sesuai dengan filter.</td></tr>}</tbody></table></div>
              <div className="flex flex-col gap-2 border-t border-[#becabd]/35 px-4 py-3 text-xs text-[#4d5f81] sm:flex-row sm:items-center sm:justify-between"><span>Menampilkan <b className="text-[#121b2e]">{visibleTickets.length}</b> dari <b className="text-[#121b2e]">{accessibleTickets.length}</b> ticket</span><div className="flex items-center gap-1"><button disabled className="rounded border border-[#becabd]/35 px-2.5 py-1.5 opacity-50">Previous</button><button className="rounded bg-[#16834b] px-2.5 py-1.5 font-bold text-white">1</button><button disabled className="rounded border border-[#becabd]/45 px-2.5 py-1.5 opacity-50">Next</button></div></div>
            </section>

            <TicketDetail ticket={selectedTicket} role={viewRole} followUp={followUp} followUpAt={followUpAt} isSaving={isSaving} onFollowUpChange={setFollowUp} onFollowUpAtChange={setFollowUpAt} onAddFollowUp={addFollowUp} onChangeStatus={changeStatus} onOpenAttachment={openAttachment} onClose={() => setSelectedId("")} />
          </div>
        </div>
      </section>

      {notice && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[#0f2342] px-4 py-3 text-sm font-semibold text-white shadow-xl"><CheckCircle2 size={17} className="text-[#77d8cd]" />{notice}</div>}
      {isCreateOpen && <CreateTicketModal onClose={() => setIsCreateOpen(false)} onSubmit={createTicket} />}
    </main>
  );
}

function FilterButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${active ? "bg-[#1e3765] text-white" : "bg-[#f1f3ff] text-[#4d5f81] hover:bg-[#d9e2fc]"}`}>{children}</button>;
}

function TicketDetail({ ticket, role, followUp, followUpAt, isSaving, onFollowUpChange, onFollowUpAtChange, onAddFollowUp, onChangeStatus, onOpenAttachment, onClose }: { ticket?: TicketItem; role: ViewRole; followUp: string; followUpAt: string; isSaving: boolean; onFollowUpChange: (value: string) => void; onFollowUpAtChange: (value: string) => void; onAddFollowUp: () => void; onChangeStatus: (status: TicketStatus) => void; onOpenAttachment: (attachment: { fileName: string; storagePath: string }) => void; onClose: () => void }) {
  if (!ticket) return <aside className="rounded-xl border border-[#becabd]/45 bg-white p-6 text-sm text-[#4d5f81]">Pilih ticket untuk melihat detail.</aside>;
  return <aside className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:sticky xl:top-21 xl:h-fit">
    <div className="flex items-start justify-between bg-[#1e3765] px-5 py-4 text-white"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg border border-[#069494] bg-[#577c8e]"><Ticket size={15} /></span><div><p className="text-sm font-bold">Ticket Details — {ticket.id}</p><p className="text-[11px] text-[#d9e2fc]">Employee report workflow</p></div></div><button onClick={onClose} className="rounded p-1 text-[#d9e2fc] hover:bg-white/10" aria-label="Tutup detail"><X size={16} /></button></div>
    <div className="space-y-5 p-5"><div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4d5f81]">Current status</p><StatusBadge status={ticket.status} /></div>{role === "manager" ? <select disabled={isSaving} value={ticket.status} onChange={(event) => onChangeStatus(event.target.value as TicketStatus)} className="w-full rounded-lg border border-[#becabd]/60 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-[#069494] disabled:opacity-60">{(Object.keys(statusMeta) as TicketStatus[]).map((status) => <option key={status} value={status}>{statusMeta[status].label}</option>)}</select> : <p className="text-xs text-[#4d5f81]">Status dapat diperbarui oleh HR atau Manager.</p>}</div>
      <div className="border-y border-[#becabd]/35 py-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[#b0c6d4] text-[10px] font-bold text-[#1e3765]">{ticket.employeeName.split(" ").map((name) => name[0]).join("").slice(0, 2)}</span><div><p className="text-xs font-bold">{ticket.employeeName}</p><p className="text-[10px] text-[#4d5f81]">{ticket.employeeId} · {ticket.department}</p></div></div><h2 className="mt-4 text-base font-bold leading-6">{ticket.title}</h2><p className="mt-1 text-xs text-[#4d5f81]">{ticket.category} · Dilaporkan {formatDate(ticket.createdAt, true)}</p>{ticket.occurredAt && <p className="mt-1 text-xs text-[#4d5f81]">Kejadian/pengajuan: {formatDate(ticket.occurredAt, true)}</p>}<p className="mt-3 text-sm leading-6 text-[#3f4940]">{ticket.description}</p>{ticket.attachment && <button onClick={() => onOpenAttachment(ticket.attachment!)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 text-xs font-semibold text-[#1e3765] hover:bg-[#d9e2fc]"><Paperclip size={14} />{ticket.attachment.fileName}</button>}</div>
      <div><div className="mb-3 flex items-center gap-2"><Clock3 size={15} className="text-[#069494]" /><p className="text-xs font-bold">Progress & history</p></div>{!ticket.history.some((activity) => activity.kind === "followup") && <p className="mb-3 rounded-lg bg-[#f7f8ff] px-3 py-2 text-xs text-[#4d5f81]">Belum ada tindak lanjut untuk ticket ini.</p>}<ol className="space-y-4 border-l border-[#d9e2fc] pl-4">{[...ticket.history].reverse().map((activity) => <li key={activity.id} className="relative"><span className={`absolute -left-[21px] top-1 grid size-3 place-items-center rounded-full ${activity.kind === "status" ? "bg-[#069494]" : activity.kind === "followup" ? "bg-[#16834b]" : "bg-[#b0c6d4]"}`}><span className="size-1 rounded-full bg-white" /></span><p className="text-xs font-semibold text-[#3f4940]">{activity.message}</p><p className="mt-1 text-[10px] text-[#4d5f81]">{activity.actor} · {formatDate(activity.at, true)}</p></li>)}</ol></div>
      {role === "manager" && <div className="rounded-lg bg-[#f1f3ff] p-3"><label className="flex items-center gap-2 text-xs font-bold text-[#1e3765]"><MessageSquareText size={14} /> Tambah follow-up</label><textarea disabled={isSaving} value={followUp} onChange={(event) => onFollowUpChange(event.target.value)} className="mt-2 min-h-20 w-full resize-none rounded-lg border border-[#d9e2fc] bg-white p-2.5 text-xs outline-none focus:border-[#069494] disabled:opacity-60" placeholder="Tuliskan tindakan atau informasi tindak lanjut..." /><label className="mt-2 block text-[11px] font-semibold text-[#4d5f81]">Tanggal / waktu tindak lanjut<input disabled={isSaving} value={followUpAt} onChange={(event) => onFollowUpAtChange(event.target.value)} type="datetime-local" className="mt-1 block w-full rounded-lg border border-[#d9e2fc] bg-white px-2.5 py-2 text-xs font-normal outline-none focus:border-[#069494] disabled:opacity-60" /></label><button disabled={!followUp.trim() || isSaving} onClick={onAddFollowUp} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={13} /> {isSaving ? "Menyimpan..." : "Simpan follow-up"}</button></div>}</div>
  </aside>;
}

function CreateTicketModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: CreateTicketInput) => Promise<{ ok: boolean; message?: string }> }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const occurredAt = String(formData.get("occurredAt") ?? "");
    const attachmentValue = formData.get("attachment");
    const attachment = attachmentValue instanceof File && attachmentValue.name ? attachmentValue : undefined;
    if (!title || !category || !description) {
      setError("Judul, kategori, dan deskripsi wajib diisi sebelum ticket diajukan.");
      return;
    }
    setIsSubmitting(true);
    const result = await onSubmit({ title, category, description, occurredAt: occurredAt || undefined, attachment });
    setIsSubmitting(false);
    if (!result.ok) setError(result.message ?? "Ticket belum berhasil dibuat.");
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4"><section role="dialog" aria-modal="true" aria-labelledby="create-ticket-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#d9e2fc] px-6 py-4"><div><h2 id="create-ticket-title" className="text-lg font-bold">Buat Employee Ticket</h2><p className="mt-0.5 text-xs text-[#4d5f81]">Employee ID akan terhubung otomatis setelah login.</p></div><button disabled={isSubmitting} onClick={onClose} className="rounded p-1.5 text-[#4d5f81] hover:bg-[#f1f3ff] disabled:opacity-50" aria-label="Tutup form"><X size={18} /></button></div><form noValidate onSubmit={handleSubmit} className="space-y-4 p-6"><Field label="Judul ticket" required><input disabled={isSubmitting} name="title" className="field" placeholder="Contoh: Perbaikan kursi kerja di area dispatch" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Kategori" required><select disabled={isSubmitting} name="category" defaultValue="" className="field"><option value="" disabled>Pilih kategori</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="Tanggal / waktu kejadian" hint="Opsional"><input disabled={isSubmitting} name="occurredAt" type="datetime-local" className="field" /></Field></div><Field label="Deskripsi" required><textarea disabled={isSubmitting} name="description" className="field min-h-28 resize-y" placeholder="Jelaskan kondisi, masalah, atau kebutuhan pekerjaan secara singkat dan jelas." /></Field><Field label="Lampiran" hint="Opsional, maksimal 5 MB"><input disabled={isSubmitting} name="attachment" type="file" className="field file:mr-3 file:rounded file:border-0 file:bg-[#eaf7f0] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[#006838]" /></Field>{error && <p role="alert" className="rounded-lg bg-[#fff1f2] px-3 py-2 text-xs font-semibold text-[#d64545]">{error}</p>}<div className="flex justify-end gap-2 border-t border-[#d9e2fc] pt-4"><button disabled={isSubmitting} type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-[#4d5f81] hover:bg-[#f1f3ff] disabled:opacity-50">Batal</button><button disabled={isSubmitting} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#006838] disabled:opacity-50"><FilePlus2 size={14} /> {isSubmitting ? "Mengajukan..." : "Ajukan Ticket"}</button></div></form></section></div>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-[#3f4940]"><span>{label}{required && <span className="ml-1 text-[#d64545]">*</span>}</span>{hint && <span className="ml-2 font-normal text-[#4d5f81]">{hint}</span>}<span className="mt-1.5 block [&_.field]:w-full [&_.field]:rounded-lg [&_.field]:border [&_.field]:border-[#becabd]/60 [&_.field]:bg-white [&_.field]:px-3 [&_.field]:py-2.5 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:outline-none [&_.field]:focus:border-[#069494]">{children}</span></label>;
}

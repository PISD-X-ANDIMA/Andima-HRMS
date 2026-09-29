import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Link2, Mail, MapPin, Phone } from "lucide-react";
import HrmsShell from "@/components/hrms/HrmsShell";
import HrmsStatusPill from "@/components/hrms/HrmsStatusPill";
import type {
  EmployeeAttendance,
  EmployeeCertification,
  EmployeeFeedbackReward,
  EmployeeProfile,
  EmployeeSkill,
} from "@/types/employee";
import { canManageEmployeeProfiles, getD3AppRole } from "@/utils/employee-access";
import { createClient } from "@/utils/supabase/server";

interface EmployeeProfilePageProps {
  params: Promise<{ employeeId: string }>;
}

function displayValue(value: string | null) {
  return value || "Belum tersedia";
}

function formatDate(value: string | null) {
  if (!value) return "Belum tersedia";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(value: string | null) {
  if (!value) return "Belum tersedia";

  const match = value.match(/(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function formatTenure(years: number | null, months: number | null, joinDate: string | null) {
  if (!joinDate || years === null || months === null) return "Belum tersedia";
  if (years === 0 && months === 0) return "Kurang dari 1 bulan";

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);

  return parts.length > 0 ? parts.join(" ") : "Belum tersedia";
}

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("") || "EP";
}

function ProfileSection({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[10px] border border-[rgba(87,138,252,0.22)] bg-white p-5 shadow-[3px_3px_16px_rgba(87,138,252,0.16)] sm:p-6 ${className}`}>
      <h2 className="text-lg font-bold tracking-tight text-[#121B2E]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ children = "Belum tersedia" }: { children?: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

function logRelatedQueryError(source: string, error: { code: string; message: string }) {
  console.error("Employee profile related query failed", {
    source,
    code: error.code,
    message: error.message,
  });
}

export default async function EmployeeProfilePage({ params }: EmployeeProfilePageProps) {
  const { employeeId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userRole = await getD3AppRole(supabase, user.id);
  const canManageEmployees = canManageEmployeeProfiles(userRole);

  const { data: employee, error: employeeError } = await supabase
    .from("d3_view_employee_360")
    .select(
      "id, employee_id, full_name, email, phone, identity_type, identity_number, join_date, employment_status, work_location, position_id, position_title, department_id, department_name, tenure_years, tenure_months"
    )
    .eq("employee_id", employeeId)
    .maybeSingle()
    .returns<EmployeeProfile>();

  if (employeeError) {
    console.error("Employee profile query failed", {
      code: employeeError.code,
      message: employeeError.message,
    });

    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <h1 className="text-xl font-bold">Employee Profile</h1>
          <p className="mt-2">Profil pegawai belum dapat dimuat. Silakan coba lagi nanti.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Employee Directory
          </Link>
        </section>
      </HrmsShell>
    );
  }

  if (!employee) {
    return (
      <HrmsShell userEmail={user.email} userRole={userRole}>
        <section className="mx-auto max-w-7xl rounded-xl border border-[#D9E2FC] bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#121B2E]">Employee Profile</h1>
          <p className="mt-2 text-slate-600">Data pegawai tidak ditemukan.</p>
          <Link className="mt-4 inline-block text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">
            ← Employee Directory
          </Link>
        </section>
      </HrmsShell>
    );
  }

  const [skillsResult, certificationsResult, attendancesResult, feedbackRewardsResult] = await Promise.all([
    supabase
      .from("employee_skills")
      .select("competency_id, proficiency_level, evidence_notes, competencies(name)")
      .eq("employee_id", employee.id)
      .returns<EmployeeSkill[]>(),
    supabase
      .from("view_employee_certifications")
      .select("title, issuing_organization, issue_date, expiry_date, credential_id, status")
      .eq("employee_id", employee.id)
      .returns<EmployeeCertification[]>(),
    supabase
      .from("attendances")
      .select("date, clock_in, clock_out, status, notes")
      .eq("employee_id", employee.id)
      .order("date", { ascending: false })
      .returns<EmployeeAttendance[]>(),
    supabase
      .from("feedback_rewards")
      .select("type, category, title, message, points, created_at")
      .eq("receiver_id", employee.id)
      .order("created_at", { ascending: false })
      .returns<EmployeeFeedbackReward[]>(),
  ]);

  if (skillsResult.error) logRelatedQueryError("employee_skills", skillsResult.error);
  if (certificationsResult.error) logRelatedQueryError("view_employee_certifications", certificationsResult.error);
  if (attendancesResult.error) logRelatedQueryError("attendances", attendancesResult.error);
  if (feedbackRewardsResult.error) logRelatedQueryError("feedback_rewards", feedbackRewardsResult.error);

  const skills = skillsResult.data ?? [];
  const certifications = certificationsResult.data ?? [];
  const attendances = attendancesResult.data ?? [];
  const feedbackRewards = feedbackRewardsResult.data ?? [];
  const tenure = formatTenure(employee.tenure_years, employee.tenure_months, employee.join_date);
  const attendanceSummary = attendances.reduce(
    (summary, attendance) => {
      const status = attendance.status?.toUpperCase() ?? "";
      if (status.includes("LATE") || status.includes("TERLAMBAT")) summary.late += 1;
      else if (status.includes("ABSENT") || status.includes("ALPHA")) summary.absent += 1;
      else if (status.includes("PRESENT") || status.includes("HADIR")) summary.present += 1;
      return summary;
    },
    { present: 0, late: 0, absent: 0 }
  );

  return (
    <HrmsShell userEmail={user.email} userRole={userRole}>
      <section className="mx-auto max-w-[1240px] space-y-6 xl:space-y-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-[#1E3765] transition hover:text-[#155DFC]" href="/employees">← Employee Directory</Link>
            <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.04em] text-[#121B2E] sm:text-[42px]">Employee Profile</h1>
          </div>
          {canManageEmployees && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Link className="inline-flex h-11 items-center justify-center rounded-[15px] border border-[#155DFC] bg-[#EEF4FF] px-5 text-sm font-bold text-[#155DFC] transition hover:bg-[#DCE8FF]" href={`/employees/${encodeURIComponent(employee.employee_id)}/edit`}>
                Edit Profile
              </Link>
              <Link className="inline-flex h-11 items-center justify-center rounded-[15px] bg-[#155DFC] px-5 text-sm font-bold text-white shadow-[3px_3px_14px_rgba(87,138,252,0.4)] transition hover:bg-[#0D4FDB]" href={`/employees/${encodeURIComponent(employee.employee_id)}/status`}>
                Ubah Employment Status
              </Link>
            </div>
          )}
        </div>

        <header className="rounded-[10px] border border-[rgba(87,138,252,0.3)] bg-white p-6 shadow-[3px_3px_20px_rgba(87,138,252,0.5)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <span className="flex size-[90px] shrink-0 items-center justify-center rounded-full bg-[#1E3765] text-3xl font-extrabold tracking-tight text-white shadow-[0_0_0_8px_rgba(87,138,252,0.16)]">{initials(employee.full_name)}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[#121B2E] sm:text-[38px]">{employee.full_name}</h2>
                  <HrmsStatusPill value={employee.employment_status} />
                </div>
                <p className="mt-2 text-base font-medium text-[#1E3765]">{[employee.position_title, employee.department_name, employee.work_location].filter(Boolean).join(" · ") || "Belum tersedia"}</p>
                <p className="mt-3 text-sm font-semibold text-[#121B2E]">{employee.employee_id} <span className="px-1.5 text-[#577CFC]">·</span> Joined {formatDate(employee.join_date)} <span className="px-1.5 text-[#577CFC]">·</span> Tenure: {tenure}</p>
                <p className="mt-4 flex max-w-2xl items-start gap-2 rounded-lg border border-[#D9E2FC] bg-[#F5F8FF] px-3 py-2 text-xs leading-5 text-[#1E3765]">
                  <Link2 className="mt-0.5 size-4 shrink-0 text-[#155DFC]" aria-hidden="true" />
                  Attendance, certification, feedback, and reward data are linked through this Employee ID.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-2 xl:gap-6">
          <ProfileSection title="Contact Information">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#155DFC]/10 text-[#155DFC]"><Mail className="size-4" aria-hidden="true" /></span><div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Email</dt><dd className="mt-0.5 break-all text-sm font-semibold text-[#121B2E]">{displayValue(employee.email)}</dd></div></div>
              <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#155DFC]/10 text-[#155DFC]"><Phone className="size-4" aria-hidden="true" /></span><div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Phone</dt><dd className="mt-0.5 text-sm font-semibold text-[#121B2E]">{displayValue(employee.phone)}</dd></div></div>
              <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#155DFC]/10 text-[#155DFC]"><MapPin className="size-4" aria-hidden="true" /></span><div className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Work Location</dt><dd className="mt-0.5 text-sm font-semibold text-[#121B2E]">{displayValue(employee.work_location)}</dd></div></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Identity</dt><dd className="mt-0.5 text-sm font-semibold text-[#121B2E]">{[employee.identity_type, employee.identity_number].filter(Boolean).join(" · ") || "Belum tersedia"}</dd></div>
            </dl>
          </ProfileSection>

          <ProfileSection title="Skill &amp; Competency">
            {skills.length === 0 ? <EmptyState>No skill data available.</EmptyState> : (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span className="inline-flex max-w-full items-center rounded-full border border-[#577CFC]/45 bg-[#155DFC]/10 px-3 py-1.5 text-xs font-bold text-[#1E3765]" key={skill.competency_id} title={skill.evidence_notes || undefined}>
                    <span className="truncate">{displayValue(skill.competencies?.name ?? null)}</span>{skill.proficiency_level && <span className="ml-1.5 shrink-0 border-l border-[#577CFC]/40 pl-1.5 text-[10px] font-semibold text-[#577CFC]">{skill.proficiency_level}</span>}
                  </span>
                ))}
              </div>
            )}
          </ProfileSection>

          <ProfileSection title="Certification">
            {certifications.length === 0 ? <EmptyState>Belum tersedia</EmptyState> : (
              <div className="space-y-3">
                {certifications.map((certification, index) => (
                  <article className="flex flex-col gap-3 border-b border-[#D9E2FC] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between" key={`${certification.credential_id ?? certification.title ?? "certification"}-${index}`}>
                    <div className="min-w-0"><h3 className="text-sm font-bold text-[#121B2E]">{displayValue(certification.title)}</h3><p className="mt-1 text-xs font-medium text-[#1E3765]">{displayValue(certification.issuing_organization)}</p><p className="mt-2 text-xs leading-5 text-slate-500">Issued {formatDate(certification.issue_date)} · Expires {formatDate(certification.expiry_date)}</p>{certification.credential_id && <p className="mt-1 text-[11px] text-slate-500">Credential ID: {certification.credential_id}</p>}</div>
                    <HrmsStatusPill value={certification.status} />
                  </article>
                ))}
              </div>
            )}
          </ProfileSection>

          <ProfileSection title="Attendance Summary">
            {attendances.length === 0 ? <EmptyState>Belum ada data attendance.</EmptyState> : (
              <><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg border border-emerald-500/20 bg-emerald-50/60 px-2 py-3"><p className="text-2xl font-extrabold text-emerald-700">{attendanceSummary.present}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Present</p></div><div className="rounded-lg border border-amber-500/20 bg-amber-50/60 px-2 py-3"><p className="text-2xl font-extrabold text-amber-700">{attendanceSummary.late}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Late</p></div><div className="rounded-lg border border-rose-500/20 bg-rose-50/60 px-2 py-3"><p className="text-2xl font-extrabold text-rose-700">{attendanceSummary.absent}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">Absent</p></div></div><div className="mt-5 space-y-2 border-t border-[#D9E2FC] pt-4">{attendances.map((attendance, index) => (<article className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F5F8FF] px-3 py-2.5" key={`${attendance.date ?? "attendance"}-${index}`}><div><p className="text-xs font-bold text-[#121B2E]">{formatDate(attendance.date)}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatTime(attendance.clock_in)} – {formatTime(attendance.clock_out)}{attendance.notes ? ` · ${attendance.notes}` : ""}</p></div><HrmsStatusPill value={attendance.status} /></article>))}</div></>
            )}
          </ProfileSection>

          <ProfileSection title="Feedback &amp; Reward" className="lg:col-span-2">
            {feedbackRewards.length === 0 ? <EmptyState>Belum tersedia</EmptyState> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {feedbackRewards.map((feedbackReward, index) => (
                  <article className="rounded-lg border border-[#D9E2FC] bg-[#F5F8FF]/70 p-4" key={`${feedbackReward.created_at ?? "feedback"}-${index}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#121B2E]">{displayValue(feedbackReward.title)}</p><span className="shrink-0 rounded-full border border-[#577CFC]/35 bg-white px-2 py-1 text-[10px] font-bold text-[#1E3765]">{feedbackReward.points === null ? "—" : `${feedbackReward.points} pts`}</span></div><p className="mt-1 text-[11px] font-semibold text-[#577CFC]">{[feedbackReward.type, feedbackReward.category].filter(Boolean).join(" · ") || "Feedback"}</p>{feedbackReward.message && <p className="mt-2 text-sm leading-5 text-slate-600">{feedbackReward.message}</p>}</article>
                ))}
              </div>
            )}
          </ProfileSection>
        </div>
      </section>
    </HrmsShell>
  );
}

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HrmsShell from "@/components/hrms/HrmsShell";
import HrmsStatusPill from "@/components/hrms/HrmsStatusPill";
import type {
  EmployeeAttendance,
  EmployeeCertification,
  EmployeeFeedbackReward,
  EmployeeProfile,
  EmployeeSkill,
} from "@/types/employee";
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
    <section className={`rounded-xl border border-[#D9E2FC] bg-white p-5 shadow-[0_4px_16px_rgba(15,35,66,0.04)] ${className}`}>
      <h2 className="text-base font-bold text-[#121B2E]">{title}</h2>
      <div className="mt-4">{children}</div>
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
      <HrmsShell userEmail={user.email}>
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
      <HrmsShell userEmail={user.email}>
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
    <HrmsShell userEmail={user.email}>
      <section className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <Link className="text-sm font-semibold text-[#1E3765] hover:text-[#0F2342]" href="/employees">← Employee Directory</Link>
          <div className="flex flex-wrap justify-end gap-2">
            <Link className="inline-flex h-10 items-center rounded-lg border border-[#1E3765] bg-white px-4 text-sm font-bold text-[#1E3765] transition hover:bg-[#F2F5FB]" href={`/employees/${encodeURIComponent(employee.employee_id)}/edit`}>
              Edit Profile
            </Link>
            <Link className="inline-flex h-10 items-center rounded-lg bg-[#1E3765] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0F2342]" href={`/employees/${encodeURIComponent(employee.employee_id)}/status`}>
              Ubah Employment Status
            </Link>
          </div>
        </div>

        <header className="rounded-xl border border-[#D9E2FC] bg-white p-5 shadow-[0_4px_16px_rgba(15,35,66,0.04)] sm:p-6">
          <p className="text-xs font-bold tracking-[0.16em] text-[#1E3765]">EMPLOYEE PROFILE</p>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#D9E2FC] text-lg font-bold text-[#1E3765]">{initials(employee.full_name)}</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#121B2E]">{employee.full_name}</h1>
                <p className="mt-1 text-sm text-slate-600">{[employee.position_title, employee.department_name, employee.work_location].filter(Boolean).join(" · ") || "Belum tersedia"}</p>
                <p className="mt-2 text-xs font-semibold text-[#1E3765]">{employee.employee_id} · Joined {formatDate(employee.join_date)} · Tenure: {tenure}</p>
              </div>
            </div>
            <HrmsStatusPill value={employee.employment_status} />
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <ProfileSection title="Contacts">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone</dt><dd className="mt-1 text-sm font-medium text-[#121B2E]">{displayValue(employee.phone)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</dt><dd className="mt-1 break-all text-sm font-medium text-[#121B2E]">{displayValue(employee.email)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Work Location</dt><dd className="mt-1 text-sm font-medium text-[#121B2E]">{displayValue(employee.work_location)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Identity Type</dt><dd className="mt-1 text-sm font-medium text-[#121B2E]">{displayValue(employee.identity_type)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Identity Number</dt><dd className="mt-1 text-sm font-medium text-[#121B2E]">{displayValue(employee.identity_number)}</dd></div>
              </dl>
            </ProfileSection>

            <ProfileSection title="Skill">
              {skills.length === 0 ? <EmptyState /> : (
                <div className="flex flex-wrap gap-2.5">
                  {skills.map((skill) => (
                    <div className="rounded-lg bg-[#F2F5FB] px-3 py-2" key={skill.competency_id}>
                      <p className="text-sm font-semibold text-[#1E3765]">{displayValue(skill.competencies?.name ?? null)}</p>
                      {skill.proficiency_level && <p className="mt-0.5 text-xs text-slate-500">{skill.proficiency_level}</p>}
                      {skill.evidence_notes && <p className="mt-1 max-w-60 text-xs text-slate-500">{skill.evidence_notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            <ProfileSection title="Certification">
              {certifications.length === 0 ? <EmptyState /> : (
                <div className="space-y-3">
                  {certifications.map((certification, index) => (
                    <article className="flex flex-col gap-3 rounded-lg border border-[#D9E2FC] p-4 sm:flex-row sm:items-start sm:justify-between" key={`${certification.credential_id ?? certification.title ?? "certification"}-${index}`}>
                      <div>
                        <h3 className="text-sm font-bold text-[#121B2E]">{displayValue(certification.title)}</h3>
                        <p className="mt-1 text-sm text-slate-600">{displayValue(certification.issuing_organization)}</p>
                        <p className="mt-1 text-xs text-slate-500">Expiry: {formatDate(certification.expiry_date)}</p>
                      </div>
                      <HrmsStatusPill value={certification.status} />
                    </article>
                  ))}
                </div>
              )}
            </ProfileSection>
          </div>

          <div className="space-y-5">
            <ProfileSection title="Attendance Summary">
              {attendances.length === 0 ? <EmptyState>Belum ada data attendance.</EmptyState> : (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-50 px-2 py-3"><p className="text-xl font-bold text-emerald-700">{attendanceSummary.present}</p><p className="mt-1 text-[11px] font-semibold text-emerald-700">Present</p></div>
                  <div className="rounded-lg bg-amber-50 px-2 py-3"><p className="text-xl font-bold text-amber-700">{attendanceSummary.late}</p><p className="mt-1 text-[11px] font-semibold text-amber-700">Late</p></div>
                  <div className="rounded-lg bg-rose-50 px-2 py-3"><p className="text-xl font-bold text-rose-700">{attendanceSummary.absent}</p><p className="mt-1 text-[11px] font-semibold text-rose-700">Absent</p></div>
                </div>
              )}
            </ProfileSection>

            <ProfileSection title="Feedback &amp; Reward">
              {feedbackRewards.length === 0 ? <EmptyState /> : (
                <div className="space-y-3">
                  {feedbackRewards.slice(0, 3).map((feedbackReward, index) => (
                    <article className="border-b border-[#D9E2FC]/70 pb-3 last:border-0 last:pb-0" key={`${feedbackReward.created_at ?? "feedback"}-${index}`}>
                      <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#121B2E]">{displayValue(feedbackReward.title)}</p><span className="text-xs font-semibold text-[#1E3765]">{feedbackReward.points === null ? "—" : `${feedbackReward.points} pts`}</span></div>
                      <p className="mt-1 text-xs text-slate-500">{[feedbackReward.type, feedbackReward.category].filter(Boolean).join(" · ")}</p>
                      {feedbackReward.message && <p className="mt-2 text-sm text-slate-600">{feedbackReward.message}</p>}
                    </article>
                  ))}
                </div>
              )}
            </ProfileSection>
          </div>
        </div>

        <ProfileSection title="Attendance History">
          {attendances.length === 0 ? <EmptyState>Belum ada data attendance.</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[#D9E2FC] text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Clock In</th><th className="px-3 py-3">Clock Out</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Notes</th></tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2FC]/60 text-slate-700">
                  {attendances.map((attendance, index) => (
                    <tr key={`${attendance.date ?? "attendance"}-${index}`}>
                      <td className="px-3 py-3 font-medium">{formatDate(attendance.date)}</td>
                      <td className="px-3 py-3">{formatTime(attendance.clock_in)}</td>
                      <td className="px-3 py-3">{formatTime(attendance.clock_out)}</td>
                      <td className="px-3 py-3"><HrmsStatusPill value={attendance.status} /></td>
                      <td className="px-3 py-3">{displayValue(attendance.notes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ProfileSection>
      </section>
    </HrmsShell>
  );
}

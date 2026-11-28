import { EmployeeProfilePage } from "@/modules/d4/web/features/dashboard/DashboardPages";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period } = await searchParams;
  return <EmployeeProfilePage employeeId={id} initialPeriod={typeof period === "string" && /^\d{4}-\d{2}$/.test(period) ? period : ""} />;
}

import { KpiHistoryPage } from "@/modules/d4/web/features/kpi/KpiPages";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <KpiHistoryPage employeeId={employeeId} />;
}

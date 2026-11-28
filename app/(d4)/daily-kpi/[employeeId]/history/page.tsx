import { DailyKpiHistoryPage } from "@/modules/d4/web/features/daily/DailyKpiPages";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <DailyKpiHistoryPage employeeId={employeeId} />;
}

import { PerformanceHistoryPage } from "@/modules/d4/web/features/performance/PerformancePages";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <PerformanceHistoryPage employeeId={employeeId} />;
}

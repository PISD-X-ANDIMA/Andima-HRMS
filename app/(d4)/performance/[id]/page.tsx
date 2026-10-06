import { PerformanceDetailPage } from "@/modules/d4/web/features/performance/PerformancePages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PerformanceDetailPage id={id} />;
}

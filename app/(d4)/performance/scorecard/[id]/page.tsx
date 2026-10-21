import { KpiDetailPage } from "@/modules/d4/web/features/kpi/KpiPages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KpiDetailPage id={id} />;
}

import { CompetencyDetailPage } from "@/modules/d4/web/features/competency/CompetencyPages";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <CompetencyDetailPage employeeId={employeeId} />;
}

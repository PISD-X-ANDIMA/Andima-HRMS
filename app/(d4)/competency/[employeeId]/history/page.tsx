import { CompetencyHistoryPage } from "@/modules/d4/web/features/competency/CompetencyPages";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <CompetencyHistoryPage employeeId={employeeId} />;
}

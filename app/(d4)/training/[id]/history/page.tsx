import { TrainingHistoryPage } from "@/modules/d4/web/features/training/TrainingPages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrainingHistoryPage trainingId={id} />;
}

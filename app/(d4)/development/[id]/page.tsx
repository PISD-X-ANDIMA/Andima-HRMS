import { DevelopmentDetailPage } from "@/modules/d4/web/features/development/DevelopmentPages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DevelopmentDetailPage needId={id} />;
}

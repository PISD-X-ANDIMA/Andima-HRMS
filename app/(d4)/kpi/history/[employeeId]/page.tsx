import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  redirect(`/performance/history/${encodeURIComponent(employeeId)}`);
}

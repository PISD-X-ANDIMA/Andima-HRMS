import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateRecordWizard } from "@/components/feedback-reward/FeedbackRewardUI";
import { getEmployeeOptions, getFeedbackContext } from "@/utils/feedback-reward";

export default async function NewRewardPage() {
  const { canCreate } = await getFeedbackContext();
  if (!canCreate) notFound();
  const employees = await getEmployeeOptions();
  return <section className="mx-auto max-w-3xl space-y-6"><header><Link className="text-sm font-bold text-[#155cfd]" href="/feedback-reward">← Kembali ke Dashboard</Link><h1 className="mt-3 text-3xl font-bold text-[#121b2e]">Ajukan Reward</h1><p className="mt-2 text-slate-600">Ajukan penghargaan pegawai melalui form bertahap.</p></header><CreateRecordWizard kind="reward" employees={employees} /></section>;
}

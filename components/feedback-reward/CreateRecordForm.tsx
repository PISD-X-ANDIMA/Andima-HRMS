import { createFeedbackReward } from "@/app/feedback-reward/actions";
import type { EmployeeIdentity } from "@/types/feedback-reward";

export default function CreateRecordForm({ kind, employees }: { kind: "feedback" | "reward"; employees: EmployeeIdentity[] }) {
  const title = kind === "feedback" ? "Feedback" : "Reward";
  const action = createFeedbackReward.bind(null, kind);
  async function submit(formData: FormData) {
    "use server";
    await action(formData);
  }
  return <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-[#1e3765]">+ Add {title}</summary><form action={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">Employee<select name="employee_id" required defaultValue="" className="h-10 rounded-md border border-slate-300 bg-white px-3"><option value="" disabled>Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_id}</option>)}</select></label>{kind === "reward" && <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">Reward Name / Type<input name="reward_name" required className="h-10 rounded-md border border-slate-300 px-3" /></label>}<label className="grid gap-1 text-sm font-medium text-slate-700">{title} Date<input type="date" name="date" required className="h-10 rounded-md border border-slate-300 px-3" /></label><label className="grid gap-1 text-sm font-medium text-slate-700">Access<input readOnly value="Based on organization access" className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-slate-500" /></label><label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">{kind === "feedback" ? "Feedback" : "Description"}<textarea name="content" required className="min-h-28 rounded-md border border-slate-300 p-3" /></label><button type="submit" disabled={!employees.length} className="h-10 rounded-md bg-[#155cfd] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:justify-self-end">Save {title}</button></form></details>;
}

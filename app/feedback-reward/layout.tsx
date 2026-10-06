import HrmsShell from "@/components/hrms/HrmsShell";
import { getFeedbackContext } from "@/utils/feedback-reward";

export default async function FeedbackRewardLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await getFeedbackContext();
  return <HrmsShell userEmail={user.email} userRole={access.app_role} contentClassName="bg-white"><div className="mx-auto w-full max-w-6xl">{children}</div></HrmsShell>;
}

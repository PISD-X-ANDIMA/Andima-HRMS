import { notFound } from "next/navigation";
import { GuidePage } from "@/modules/d4/demo/GuidePage";
import { isDemoMode } from "@/modules/d4/web/data/mode";

/** Demo-only explanation of the D4 features, rules and flow. */
export default function Page() {
  if (!isDemoMode) notFound();
  return <GuidePage />;
}

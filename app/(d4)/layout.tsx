import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { LANGUAGE_COOKIE, normalizeLanguage } from "@/modules/d4/shared/text";
import { D4App } from "@/modules/d4/web/D4App";
import { d4DataMode } from "@/modules/d4/web/data/mode";

export default async function D4Layout({ children }: { children: ReactNode }) {
  const language = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
  return <D4App mode={d4DataMode} language={language}>{children}</D4App>;
}

import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, normalizeLanguage } from "@/modules/d4/shared/text";
import { LanguageProvider } from "@/modules/d4/web/i18n/LanguageProvider";
import { MissingPage } from "@/modules/d4/web/ui/layout";

export default async function PageNotFound() {
  const language = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
  return <LanguageProvider initialLanguage={language}><main className="mx-auto max-w-xl p-6"><MissingPage /></main></LanguageProvider>;
}

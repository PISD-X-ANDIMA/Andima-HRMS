"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/utils/supabase/client";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/register" ||
    pathname === "/registration-form" ||
    pathname === "/jobs" ||
    pathname.startsWith("/squad-d2/src/app/register") ||
    pathname.startsWith("/squad-d2/src/app/jobs");

  useEffect(() => {
    // If user is trying to access protected internal pages, check auth
    if (!isPublicRoute) {
      try {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) {
            router.replace("/login");
          }
        });
      } catch {
        router.replace("/login");
      }
    }
  }, [pathname, isPublicRoute, router]);

  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div className="min-h-full lg:pl-[260px] flex flex-col">{children}</div>
    </>
  );
}
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PREVIEW_SESSION_COOKIE } from "@/modules/d4/web/data/preview-session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
// Local preview with fictional data (never active in production builds).
const fixturePreview = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_D4_DATA_MODE === "fixture";

export async function proxy(request: NextRequest) {
  if (fixturePreview) {
    // Same gate as below, but the session is the preview cookie set by the login page: no request to Supabase.
    const path = request.nextUrl.pathname;
    const signedIn = request.cookies.has(PREVIEW_SESSION_COOKIE);
    const isLogin = path === "/login" || path === "/register";
    if (path.startsWith("/api/")) return NextResponse.next({ request });
    if (!signedIn && !isLogin) return NextResponse.redirect(new URL("/login", request.url));
    if (signedIn && isLogin) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next({ request });
  }
  // Without Supabase configuration only the login page (which explains the problem) and API errors are served.
  if (!supabaseUrl || !publishableKey) {
    if (["/login", "/register"].includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next({ request });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  // API routes answer 401 JSON themselves instead of redirecting to the login page.
  if (request.nextUrl.pathname.startsWith("/api/")) return response;
  // /register follows the team's B2 flow: login -> register (no account yet) -> login again.
  const isLogin = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register";
  if (!user && !isLogin) {
    const destination = new URL("/login", request.url);
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
    return redirect;
  }
  if (user && isLogin) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf)$).*)"],
};

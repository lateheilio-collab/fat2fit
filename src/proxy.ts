import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({ name, value, ...options })
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/chat") ||
    request.nextUrl.pathname.startsWith("/meals") ||
    request.nextUrl.pathname.startsWith("/plan") ||
    request.nextUrl.pathname.startsWith("/progress") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  // Whitelist check if user is logged in
  if (user) {
    const allowedEmail = process.env.ALLOWED_USER_EMAIL;
    if (allowedEmail && user.email?.toLowerCase() !== allowedEmail.toLowerCase()) {
      // User is logged in but not allowed! Sign them out and redirect to access-denied
      await supabase.auth.signOut();
      
      // If we are not already on the access-denied route, redirect
      if (request.nextUrl.pathname !== "/access-denied") {
        return NextResponse.redirect(new URL("/access-denied", request.url));
      }
    }
  }

  // Redirect unauthenticated users to login
  if (!user && isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users trying to access login
  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/integrations/strava/webhook (allow webhooks without auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/integrations/strava/webhook).*)",
  ],
};

import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request);

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/history", "/favorites", "/settings"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // API routes that require authentication
  const protectedApiRoutes = [
    "/api/chat",
    "/api/history",
    "/api/favorites",
    "/api/usage",
  ];
  const isProtectedApiRoute = protectedApiRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  // Redirect to login if accessing protected routes without auth
  if (!user && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Return 401 for protected API routes without auth
  if (!user && isProtectedApiRoute) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Please log in to access this resource",
      },
      { status: 401 },
    );
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

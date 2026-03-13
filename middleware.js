import { NextResponse } from "next/server";

// Simple middleware — client-side auth handles most routing
// This just protects /owner /secretary /housekeeper /driver from unauthenticated access
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedPaths = ["/owner", "/secretary", "/housekeeper", "/driver"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected) {
    // Check for Supabase auth cookie
    const hasAuth =
      request.cookies.get("sb-access-token") ||
      request.cookies.get("sb-refresh-token") ||
      // Supabase v2 cookie format
      Array.from(request.cookies.getAll()).some((c) => c.name.includes("supabase") || c.name.includes("sb-"));

    if (!hasAuth) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/secretary/:path*", "/housekeeper/:path*", "/driver/:path*"],
};

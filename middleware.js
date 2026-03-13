import { NextResponse } from "next/server";

// Client-side Supabase auth currently owns session handling.
// Keep middleware disabled to avoid false redirects when magic-link
// sessions exist in the browser but are not represented as server cookies.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};

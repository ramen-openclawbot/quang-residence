/**
 * Shared server-side authentication helpers for API routes.
 *
 * Usage:
 *   import { resolveUser, supabaseAdmin } from "@/lib/api-auth";
 *
 *   const auth = await resolveUser(request);
 *   if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   const { user, profile } = auth;
 */
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Extract bearer token from the request Authorization header.
 * Returns null if missing or malformed.
 */
export function extractToken(request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * Resolve the caller's identity from the bearer token.
 *
 * @param {Request} request
 * @param {Object} [options]
 * @param {boolean} [options.requireProfile=true] - Also fetch the profile row (role, full_name).
 * @returns {{ user, profile? } | { error, status }}
 */
export async function resolveUser(request, { requireProfile = true } = {}) {
  const token = extractToken(request);
  if (!token) return { error: "Missing bearer token", status: 401 };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { error: "Invalid session", status: 401 };

  if (!requireProfile) return { user };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profile not found", status: 403 };

  return { user, profile };
}

/**
 * Convenience: resolve user and require a specific role (or set of roles).
 *
 * @param {Request} request
 * @param {string|string[]} roles - Allowed role(s), e.g. "owner" or ["owner","secretary"]
 */
export async function requireRole(request, roles) {
  const auth = await resolveUser(request);
  if (auth.error) return auth;

  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(auth.profile.role)) {
    return { error: "Not authorised", status: 403 };
  }
  return auth;
}

/**
 * Send a real-time notification to a specific user.
 */
export async function notify(userId, title, body, type = "info", link = null, payload = null) {
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    type,
    link,
    payload,
  });
}

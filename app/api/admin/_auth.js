/**
 * Admin-specific auth helper.
 * Thin wrapper around the shared lib/api-auth module.
 */
import { requireRole, supabaseAdmin } from "../../../lib/api-auth";

export { supabaseAdmin };

export async function requireOwner(request) {
  return requireRole(request, "owner");
}

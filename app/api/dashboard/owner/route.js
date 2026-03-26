import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { isOpsTransaction } from "../../../../lib/finance-ops";

/**
 * GET /api/dashboard/owner
 *
 * Owner home/support payload only.
 * Financial canonical data should come from dedicated report routes:
 * - /api/reports/finance-summary
 * - /api/reports/cash-ledger-summary
 * - /api/transactions
 * - /api/cash-ledger
 */
export async function GET(request) {
  try {
    const auth = await requireRole(request, "owner");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [recentTxRes, tasksRes, maintenanceRes, scheduleRes, profilesRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("transactions").select("*").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true }).limit(120),
      supabaseAdmin.from("home_maintenance").select("*").order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("family_schedule").select("*").order("event_date", { ascending: true }).limit(120),
      supabaseAdmin.from("profiles").select("id, full_name, role"),
      supabaseAdmin.from("home_settings").select("*").order("setting_key"),
    ]);

    return NextResponse.json({
      success: true,
      recentTx: (recentTxRes.data || []).filter(isOpsTransaction),
      tasks: tasksRes.data || [],
      maintenance: maintenanceRes.data || [],
      familySchedule: scheduleRes.data || [],
      staffProfiles: profilesRes.data || [],
      settingsData: settingsRes.data || [],
    });
  } catch (err) {
    console.error("Owner dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the owner dashboard." }, { status: 500 });
  }
}

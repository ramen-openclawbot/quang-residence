import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { getSignedAmount } from "../../../../lib/transaction";

/**
 * GET /api/dashboard/secretary
 *
 * Returns a lightweight summary payload for the secretary Home tab:
 *   - funds: full funds rows (small table, always needed for balance)
 *   - tasks: all tasks (needed for today/overdue counts)
 *   - recentTx: last 10 transactions with submitter profile
 *   - todaySummary: { income, expense } for today's date
 *   - pendingCount: number of pending transactions
 *
 * Requires bearer token from a secretary or owner.
 */
export async function GET(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Compute today's date in server local time (same timezone as DB seed data)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    const [fundsRes, tasksRes, maintenanceRes, scheduleRes, tripsRes, profilesRes, recentTxRes, todayTxRes, pendingRes] = await Promise.all([
      supabaseAdmin.from("funds").select("*").order("id"),
      supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true }),
      supabaseAdmin.from("home_maintenance").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("family_schedule").select("*").order("event_date", { ascending: true }),
      supabaseAdmin.from("driving_trips").select("*").order("scheduled_time", { ascending: true }),
      supabaseAdmin.from("profiles").select("id, full_name, role"),
      supabaseAdmin
        .from("transactions")
        .select("*, profiles!created_by(id, full_name, role)")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("transactions")
        .select("type, amount, adjustment_direction")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const todayIncome = (todayTxRes.data || []).reduce((s, t) => {
      const signed = getSignedAmount(t);
      return signed > 0 ? s + signed : s;
    }, 0);
    const todayExpense = (todayTxRes.data || []).reduce((s, t) => {
      const signed = getSignedAmount(t);
      return signed < 0 ? s + Math.abs(signed) : s;
    }, 0);

    return NextResponse.json({
      success: true,
      funds: fundsRes.data || [],
      tasks: tasksRes.data || [],
      maintenance: maintenanceRes.data || [],
      familySchedule: scheduleRes.data || [],
      drivingTrips: tripsRes.data || [],
      staffProfiles: profilesRes.data || [],
      recentTx: recentTxRes.data || [],
      todaySummary: { income: todayIncome, expense: todayExpense },
      pendingCount: pendingRes.count || 0,
    });
  } catch (err) {
    console.error("Secretary dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the dashboard." }, { status: 500 });
  }
}

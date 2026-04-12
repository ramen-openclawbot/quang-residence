import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { fetchPagedRows, isOpsTransaction, summarizeOpsTransactions } from "../../../../lib/finance-ops";

/**
 * GET /api/dashboard/secretary
 *
 * Mixed-domain home payload for secretary/owner.
 *
 * Response keeps legacy top-level keys for compatibility, but now also exposes
 * clearer grouped domains:
 * - resources: funds / tasks / maintenance / schedule / trips / staffProfiles
 * - ops: recent transactions + today summary + pending count
 */
export async function GET(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    const [fundsRes, tasksRes, maintenanceRes, scheduleRes, tripsRes, profilesRes, recentTxRes, todayTxRes, pendingTxRes, allOpsTxRes] = await Promise.all([
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
        .limit(20),
      supabaseAdmin
        .from("transactions")
        .select("type, amount, adjustment_direction, status, created_by")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
      supabaseAdmin
        .from("transactions")
        .select("id, status, created_by")
        .eq("status", "pending")
        .limit(5000),
      fetchPagedRows((from, to) => supabaseAdmin
        .from("transactions")
        .select("type, amount, adjustment_direction, status, created_by, profiles!created_by(id, full_name, role)")
        .order("created_at", { ascending: false })
        .range(from, to)),
    ]);

    const recentTx = (recentTxRes.data || []).filter(isOpsTransaction).slice(0, 10);
    const todayRows = (todayTxRes.data || []).filter(isOpsTransaction);
    const pendingRows = (pendingTxRes.data || []).filter(isOpsTransaction);
    const todaySummary = summarizeOpsTransactions(todayRows, { includePending: true, includeRejected: false });

    const opsBalanceMap = new Map();
    for (const tx of (allOpsTxRes || []).filter(isOpsTransaction)) {
      const actor = tx.profiles || {};
      const userId = String(tx.created_by || "");
      if (!userId) continue;
      const prev = opsBalanceMap.get(userId) || {
        userId,
        name: actor.full_name || "Nhân sự",
        role: actor.role || "secretary",
        balance: 0,
        totalIn: 0,
        totalOut: 0,
      };
      const amount = Number(tx.amount || 0);
      const signed = tx.type === "income" ? amount : tx.type === "adjustment" ? (tx.adjustment_direction === "increase" ? amount : -amount) : -amount;
      prev.balance += signed;
      if (signed > 0) prev.totalIn += signed;
      if (signed < 0) prev.totalOut += Math.abs(signed);
      opsBalanceMap.set(userId, prev);
    }
    const opsBalances = Array.from(opsBalanceMap.values());

    const response = {
      success: true,
      resources: {
        funds: fundsRes.data || [],
        tasks: tasksRes.data || [],
        maintenance: maintenanceRes.data || [],
        familySchedule: scheduleRes.data || [],
        drivingTrips: tripsRes.data || [],
        staffProfiles: profilesRes.data || [],
      },
      ops: {
        recentTx,
        todaySummary: { income: todaySummary.income, expense: todaySummary.expense },
        pendingCount: pendingRows.length,
        balances: opsBalances,
      },

      // Backward-compatible fields used by current secretary page
      funds: fundsRes.data || [],
      tasks: tasksRes.data || [],
      maintenance: maintenanceRes.data || [],
      familySchedule: scheduleRes.data || [],
      drivingTrips: tripsRes.data || [],
      staffProfiles: profilesRes.data || [],
      recentTx,
      todaySummary: { income: todaySummary.income, expense: todaySummary.expense },
      pendingCount: pendingRows.length,
      opsBalances,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Secretary dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the dashboard." }, { status: 500 });
  }
}

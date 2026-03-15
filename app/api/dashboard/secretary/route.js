import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || !["owner", "secretary"].includes(profile.role)) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    // Compute today's date in server local time (same timezone as DB seed data)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayStart = `${todayStr}T00:00:00`;
    const todayEnd = `${todayStr}T23:59:59`;

    const [fundsRes, tasksRes, recentTxRes, todayTxRes, pendingRes] = await Promise.all([
      supabaseAdmin.from("funds").select("*").order("id"),
      supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true }),
      supabaseAdmin
        .from("transactions")
        .select("*, profiles!created_by(id, full_name, role)")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("transactions")
        .select("type, amount")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
      supabaseAdmin
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const todayIncome = (todayTxRes.data || [])
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const todayExpense = (todayTxRes.data || [])
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    return NextResponse.json({
      success: true,
      funds: fundsRes.data || [],
      tasks: tasksRes.data || [],
      recentTx: recentTxRes.data || [],
      todaySummary: { income: todayIncome, expense: todayExpense },
      pendingCount: pendingRes.count || 0,
    });
  } catch (err) {
    console.error("Secretary dashboard API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

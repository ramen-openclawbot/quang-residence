import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { fetchUserBalanceRows, summarizeBalanceRows } from "../../../../lib/dashboard-finance";

export async function GET(request) {
  try {
    const auth = await requireRole(request, "driver");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const monthKey = todayKey.slice(0, 7);

    const [tripsRes, txRes, tasksRes, txSummaryRes] = await Promise.all([
      supabaseAdmin.from("driving_trips").select("*").eq("assigned_to", profile.id).order("scheduled_time", { ascending: true }),
      supabaseAdmin.from("transactions").select("*, categories!category_id(id, code, name_vi, name, color)").eq("created_by", profile.id).order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("tasks").select("*").or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`).order("due_date", { ascending: true }),
      supabaseAdmin.from("transactions").select("type, amount, adjustment_direction, transaction_date, created_at").eq("created_by", profile.id).order("created_at", { ascending: false }).limit(5000),
    ]);

    const txSummaryRows = txSummaryRes.data || [];
    const { current_balance, today_expense, month_expense } = summarizeBalanceRows(txSummaryRows, { todayKey, monthKey });

    return NextResponse.json({
      success: true,
      trips: tripsRes.data || [],
      transactions: txRes.data || [],
      tasks: tasksRes.data || [],
      summary: {
        current_balance,
        today_expense,
        month_expense,
      },
    });
  } catch (err) {
    console.error("Driver dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the driver dashboard." }, { status: 500 });
  }
}

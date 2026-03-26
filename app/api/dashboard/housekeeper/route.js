import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { getSignedAmount } from "../../../../lib/transaction";

export async function GET(request) {
  try {
    const auth = await requireRole(request, "housekeeper");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const monthKey = todayKey.slice(0, 7);

    const [txRes, txSummaryRes, maintenanceRes, scheduleRes] = await Promise.all([
      supabaseAdmin.from("transactions").select("*, categories!category_id(id, code, name_vi, name, color)").eq("created_by", profile.id).order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("transactions").select("type, amount, adjustment_direction, transaction_date, created_at").eq("created_by", profile.id).order("created_at", { ascending: false }).limit(5000),
      supabaseAdmin.from("home_maintenance").select("*").or(`created_by.eq.${profile.id},reported_by.eq.${profile.id}`).order("created_at", { ascending: false }),
      supabaseAdmin.from("family_schedule").select("*").eq("created_by", profile.id).order("event_date", { ascending: true }),
    ]);

    const txSummaryRows = txSummaryRes.data || [];
    const current_balance = txSummaryRows.reduce((sum, tx) => sum + getSignedAmount(tx), 0);
    const today_expense = txSummaryRows.reduce((sum, tx) => {
      const txDay = String(tx?.transaction_date || tx?.created_at || "").slice(0, 10);
      const signed = getSignedAmount(tx);
      return txDay === todayKey && signed < 0 ? sum + Math.abs(signed) : sum;
    }, 0);
    const month_expense = txSummaryRows.reduce((sum, tx) => {
      const txMonth = String(tx?.transaction_date || tx?.created_at || "").slice(0, 7);
      const signed = getSignedAmount(tx);
      return txMonth === monthKey && signed < 0 ? sum + Math.abs(signed) : sum;
    }, 0);

    return NextResponse.json({
      success: true,
      transactions: txRes.data || [],
      maintenance: maintenanceRes.data || [],
      familySchedule: scheduleRes.data || [],
      summary: {
        current_balance,
        today_expense,
        month_expense,
      },
    });
  } catch (err) {
    console.error("Housekeeper dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the housekeeper dashboard." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { fetchUserBalanceRows, summarizeBalanceRows } from "../../../../lib/dashboard-finance";

const DEBUG_DATA_VIEW_MAP = {
  c42db3e0: "a325bb7b",
};

function getEffectiveProfileId(profileId) {
  const entry = Object.entries(DEBUG_DATA_VIEW_MAP).find(([fromId]) => profileId?.startsWith(fromId));
  return entry ? entry[1] : profileId;
}

export async function GET(request) {
  try {
    const auth = await requireRole(request, "housekeeper");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;
    const effectiveProfileId = getEffectiveProfileId(profile.id);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const monthKey = todayKey.slice(0, 7);

    const [txRes, txSummaryRows, maintenanceRes, scheduleRes] = await Promise.all([
      supabaseAdmin.from("transactions").select("*, categories!category_id(id, code, name_vi, name, color)").eq("created_by", effectiveProfileId).order("created_at", { ascending: false }).limit(120),
      fetchUserBalanceRows(supabaseAdmin, effectiveProfileId),
      supabaseAdmin.from("home_maintenance").select("*").or(`created_by.eq.${effectiveProfileId},reported_by.eq.${effectiveProfileId}`).order("created_at", { ascending: false }),
      supabaseAdmin.from("family_schedule").select("*").eq("created_by", effectiveProfileId).order("event_date", { ascending: true }),
    ]);

    const { current_balance, today_expense, month_expense } = summarizeBalanceRows(txSummaryRows || [], { todayKey, monthKey });

    return NextResponse.json({
      success: true,
      transactions: txRes.data || [],
      maintenance: maintenanceRes.data || [],
      familySchedule: scheduleRes.data || [],
      summary: { current_balance, today_expense, month_expense },
    });
  } catch (err) {
    console.error("Housekeeper dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the housekeeper dashboard." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { getSignedAmount } from "../../../../lib/transaction";

const CACHE_TTL_MS = 20 * 1000;
const summaryCache = new Map();

function buildSummary(rows = []) {
  const income = rows.reduce((sum, tx) => {
    const signed = getSignedAmount(tx);
    return signed > 0 ? sum + signed : sum;
  }, 0);
  const expense = rows.reduce((sum, tx) => {
    const signed = getSignedAmount(tx);
    return signed < 0 ? sum + Math.abs(signed) : sum;
  }, 0);
  const pending = rows.filter((tx) => String(tx?.status || "").trim().toLowerCase() === "pending").length;
  return { income, expense, net: income - expense, pending, sampleSize: rows.length };
}

async function getCachedSummary(cacheKey, loader) {
  const now = Date.now();
  const hit = summaryCache.get(cacheKey);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.value;
  const value = await loader();
  summaryCache.set(cacheKey, { ts: now, value });
  return value;
}

export async function GET(request) {
  try {
    const auth = await requireRole(request, "owner");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const month = Number(searchParams.get("month") ?? new Date().getMonth()); // 0-based
    const year = Number(searchParams.get("year") ?? new Date().getFullYear());

    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const [recentTxRes, tasksRes, profilesRes, settingsRes, allSummary, monthSummary] = await Promise.all([
      supabaseAdmin.from("transactions").select("*").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true }).limit(120),
      supabaseAdmin.from("profiles").select("id, full_name, role"),
      supabaseAdmin.from("home_settings").select("*").order("setting_key"),
      getCachedSummary("owner:summary:all", async () => {
        const { data } = await supabaseAdmin.from("transactions").select("type, amount, adjustment_direction, status").limit(5000);
        return buildSummary(data || []);
      }),
      getCachedSummary(`owner:summary:${year}-${String(month + 1).padStart(2, "0")}`, async () => {
        const { data } = await supabaseAdmin
          .from("transactions")
          .select("type, amount, adjustment_direction, status")
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate)
          .limit(5000);
        return buildSummary(data || []);
      }),
    ]);

    return NextResponse.json({
      success: true,
      recentTx: recentTxRes.data || [],
      tasks: tasksRes.data || [],
      staffProfiles: profilesRes.data || [],
      settingsData: settingsRes.data || [],
      summary: {
        all: allSummary,
        month: monthSummary,
      },
    });
  } catch (err) {
    console.error("Owner dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the owner dashboard." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { summarizeOpsTransactions, buildMonthDateRange, isOpsTransaction } from "../../../../lib/finance-ops";

const CACHE_TTL_MS = 20 * 1000;
const summaryCache = new Map();

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
    const { startDate, endDate } = buildMonthDateRange(year, month);

    const [recentTxRes, tasksRes, maintenanceRes, scheduleRes, profilesRes, settingsRes, allSummary, monthSummary] = await Promise.all([
      supabaseAdmin.from("transactions").select("*").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true }).limit(120),
      supabaseAdmin.from("home_maintenance").select("*").order("created_at", { ascending: false }).limit(120),
      supabaseAdmin.from("family_schedule").select("*").order("event_date", { ascending: true }).limit(120),
      supabaseAdmin.from("profiles").select("id, full_name, role"),
      supabaseAdmin.from("home_settings").select("*").order("setting_key"),
      getCachedSummary("owner:summary:all", async () => {
        const { data } = await supabaseAdmin.from("transactions").select("type, amount, adjustment_direction, status, created_by").limit(5000);
        const rows = (data || []).filter(isOpsTransaction);
        const s = summarizeOpsTransactions(rows, { includePending: true, includeRejected: false });
        return { income: s.income, expense: s.expense, net: s.net, pending: s.pending_count, sampleSize: rows.length };
      }),
      getCachedSummary(`owner:summary:${year}-${String(month + 1).padStart(2, "0")}`, async () => {
        const { data } = await supabaseAdmin
          .from("transactions")
          .select("type, amount, adjustment_direction, status, created_by")
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate)
          .limit(5000);
        const rows = (data || []).filter(isOpsTransaction);
        const s = summarizeOpsTransactions(rows, { includePending: true, includeRejected: false });
        return { income: s.income, expense: s.expense, net: s.net, pending: s.pending_count, sampleSize: rows.length };
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

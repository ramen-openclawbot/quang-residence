import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { getSignedAmount } from "../../../../lib/transaction";

const OPS_EXCLUDED_USER_PREFIX = "6487c846";

function parseMonth(searchParams) {
  const month = searchParams.get("month"); // YYYY-MM
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function shouldIncludeStatus(status, includePending, includeRejected) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "rejected") return !!includeRejected;
  if (s === "pending") return !!includePending;
  return true;
}

async function fetchAllTransactionsInRange(startDateIso, endDateIso) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("type,amount,adjustment_direction,status,transaction_date,created_by")
      .gte("transaction_date", startDateIso)
      .lte("transaction_date", endDateIso)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    if (from > 100000) break; // hard safety
  }

  return all;
}

export async function GET(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const includePending = String(searchParams.get("include_pending") || "true") === "true";
    const includeRejected = String(searchParams.get("include_rejected") || "false") === "true";

    const scope = String(searchParams.get("scope") || "month").toLowerCase();
    let year = null;
    let monthIndex = null;
    let startDate = null;
    let endDate = null;

    if (scope === "all") {
      startDate = "2000-01-01T00:00:00.000Z";
      endDate = new Date(2100, 0, 1).toISOString();
    } else {
      const parsed = parseMonth(searchParams);
      year = parsed.year;
      monthIndex = parsed.monthIndex;
      startDate = new Date(year, monthIndex, 1).toISOString();
      endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59).toISOString();
    }

    const rawRows = await fetchAllTransactionsInRange(startDate, endDate);
    const rows = rawRows.filter((tx) => !String(tx?.created_by || "").startsWith(OPS_EXCLUDED_USER_PREFIX));

    let income = 0;
    let expense = 0;
    let pending = 0;

    for (const tx of rows) {
      const status = String(tx?.status || "").trim().toLowerCase();
      if (status === "pending") pending += 1;
      if (!shouldIncludeStatus(status, includePending, includeRejected)) continue;

      const signed = getSignedAmount(tx);
      if (signed > 0) income += signed;
      if (signed < 0) expense += Math.abs(signed);
    }

    return NextResponse.json({
      success: true,
      source: "transactions",
      scope,
      period: scope === "all" ? null : { year, month: monthIndex + 1, monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}` },
      income,
      expense,
      net: income - expense,
      pending_count: pending,
      row_count: rows.length,
      include_pending: includePending,
      include_rejected: includeRejected,
    });
  } catch (err) {
    console.error("finance-summary API error:", err);
    return NextResponse.json({ error: "Failed to compute finance summary" }, { status: 500 });
  }
}

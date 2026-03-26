import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";

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

async function fetchAllEntriesInRange(startDateIso, endDateIso) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("cash_ledger_entries")
      .select("type,amount,status,entry_kind,transaction_date")
      .gte("transaction_date", startDateIso)
      .lte("transaction_date", endDateIso)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    if (from > 100000) break;
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

    const rows = await fetchAllEntriesInRange(startDate, endDate);

    let income = 0;
    let expense = 0;
    let pending = 0;

    const byKind = {
      ops: { income: 0, expense: 0 },
      fund_transfer_out: { income: 0, expense: 0 },
      fund_transfer_in_auto: { income: 0, expense: 0 },
    };

    for (const entry of rows) {
      const status = String(entry?.status || "").trim().toLowerCase();
      if (status === "pending") pending += 1;
      if (!shouldIncludeStatus(status, includePending, includeRejected)) continue;

      const amount = Math.abs(Number(entry?.amount || 0));
      const kind = String(entry?.entry_kind || "ops");
      const isIncome = String(entry?.type || "").trim().toLowerCase() === "income";

      if (isIncome) {
        income += amount;
        if (byKind[kind]) byKind[kind].income += amount;
      } else {
        expense += amount;
        if (byKind[kind]) byKind[kind].expense += amount;
      }
    }

    return NextResponse.json({
      success: true,
      source: "cash_ledger_entries",
      scope,
      period: scope === "all" ? null : { year, month: monthIndex + 1, monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}` },
      income,
      expense,
      net: income - expense,
      pending_count: pending,
      row_count: rows.length,
      include_pending: includePending,
      include_rejected: includeRejected,
      by_kind: byKind,
      legacy_by_kind: legacy,
      note: "fund_transfer_in_auto is legacy-only and no longer part of active cash-ledger flow",
    });
  } catch (err) {
    console.error("cash-ledger-summary API error:", err);
    return NextResponse.json({ error: "Failed to compute cash ledger summary" }, { status: 500 });
  }
}

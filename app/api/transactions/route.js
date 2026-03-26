import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin, notify } from "../../../lib/api-auth";
import { buildMonthDateRange, fetchPagedRows, isOpsTransaction, summarizeOpsTransactions } from "../../../lib/finance-ops";

const MAX_REJECT_REASON_LENGTH = 500;

async function fetchFilteredTransactionRows({ month, year, columns = "created_by" }) {
  let startDate = null;
  let endDate = null;
  if (month !== null && year !== null) {
    ({ startDate, endDate } = buildMonthDateRange(Number(year), Number(month)));
  }

  return fetchPagedRows((from, to) => {
    let query = supabaseAdmin
      .from("transactions")
      .select(columns)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (startDate && endDate) {
      query = query.gte("transaction_date", startDate).lte("transaction_date", endDate);
    }
    return query;
  });
}

async function computeFilteredTotal({ month, year }) {
  const rows = await fetchFilteredTransactionRows({ month, year, columns: "created_by" });
  return rows.filter(isOpsTransaction).length;
}

// ─── GET: list transactions for owner / secretary ──────────────────────
export async function GET(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    if (!["owner", "secretary"].includes(profile.role)) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 40), 1), 300);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    let query = supabaseAdmin
      .from("transactions")
      .select("*, profiles!created_by(id, full_name, role), categories!category_id(id, code, name_vi, name, color), approved_by_profile:profiles!approved_by(id, full_name), reviewed_by_profile:profiles!reviewed_by(id, full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (month !== null && year !== null) {
      const { startDate, endDate } = buildMonthDateRange(Number(year), Number(month));
      query = query.gte("transaction_date", startDate).lte("transaction_date", endDate);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("Transaction GET error:", error);
      return NextResponse.json({ error: "Failed to fetch transactions." }, { status: 500 });
    }

    const opsData = (data || []).filter(isOpsTransaction);
    const filteredTotal = await computeFilteredTotal({ month, year });

    let summary = null;
    if (month !== null && year !== null) {
      try {
        const summaryRows = await fetchFilteredTransactionRows({ month, year, columns: "type, amount, adjustment_direction, status, created_by" });
        const rows = summaryRows.filter(isOpsTransaction);
        const opsSummary = summarizeOpsTransactions(rows, { includePending: true, includeRejected: false });
        summary = {
          income: opsSummary.income,
          expense: opsSummary.expense,
          pending: opsSummary.pending_count,
          sampleSize: rows.length,
        };
      } catch (summaryError) {
        console.warn("Transaction summary query error:", summaryError);
      }
    }

    return NextResponse.json({
      success: true,
      data: opsData,
      total: filteredTotal,
      raw_total: count,
      hasMore: (offset + opsData.length) < filteredTotal,
      summary,
      ops_filtered: true,
    });
  } catch (err) {
    console.error("Transaction GET error:", err);
    return NextResponse.json({ error: "An error occurred while fetching transactions." }, { status: 500 });
  }
}

// ─── PATCH: approve or reject a transaction ──────────────────────
export async function PATCH(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    if (!["owner", "secretary"].includes(profile.role)) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const { transaction_id, action, reject_reason } = await request.json();

    if (!transaction_id || (typeof transaction_id !== "number" && typeof transaction_id !== "string")) {
      return NextResponse.json({ error: "Valid transaction_id is required" }, { status: 400 });
    }
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("*, profiles!created_by(id, full_name, role)")
      .eq("id", transaction_id)
      .single();

    if (txErr || !tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (profile.role === "secretary" && tx.created_by === profile.id) {
      return NextResponse.json({ error: "Cannot review your own transaction" }, { status: 403 });
    }

    if (tx.status !== "pending") {
      return NextResponse.json({ error: `Transaction is already ${tx.status}` }, { status: 409 });
    }

    const amount = Number(tx.amount || 0);
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Transaction has invalid amount" }, { status: 422 });
    }

    const amountStr = amount.toLocaleString("vi-VN") + "đ";
    const txLabel = tx.type === "adjustment" ? "adjustment" : tx.type;

    if (action === "approve") {
      const reviewedAt = new Date().toISOString();

      if (tx.type === "adjustment" && !["increase", "decrease"].includes(tx.adjustment_direction)) {
        return NextResponse.json({ error: "Adjustment transaction is missing a valid direction" }, { status: 422 });
      }

      if (tx.fund_id) {
        const { data: fund, error: fundErr } = await supabaseAdmin
          .from("funds")
          .select("id, current_balance, name")
          .eq("id", tx.fund_id)
          .single();

        if (fundErr || !fund) {
          console.error("Fund lookup failed", { fund_id: tx.fund_id, fundErr, transaction_id });
          return NextResponse.json({ error: "Linked fund not found" }, { status: 404 });
        }

        const currentBalance = Number(fund.current_balance || 0);
        const nextBalance = tx.type === "income"
          ? currentBalance + amount
          : tx.type === "adjustment"
            ? (tx.adjustment_direction === "increase" ? currentBalance + amount : currentBalance - amount)
            : currentBalance - amount;

        const { error: fundUpdateError } = await supabaseAdmin
          .from("funds")
          .update({ current_balance: nextBalance })
          .eq("id", tx.fund_id);

        if (fundUpdateError) {
          console.error("Fund update failed", { fund_id: tx.fund_id, fundUpdateError });
          return NextResponse.json({ error: "Failed to update fund balance." }, { status: 500 });
        }
      }

      const { error } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "approved",
          approved_by: profile.id,
          approved_at: reviewedAt,
          reviewed_by: profile.id,
          reviewed_at: reviewedAt,
          reject_reason: null,
        })
        .eq("id", transaction_id);

      if (error) {
        console.error("CRITICAL: Transaction approval failed, rolling back fund balance", { transaction_id, fund_id: tx.fund_id, error });

        if (tx.fund_id) {
          const { data: currentFund } = await supabaseAdmin
            .from("funds")
            .select("current_balance")
            .eq("id", tx.fund_id)
            .single();

          if (currentFund) {
            const rollbackBalance = Number(currentFund.current_balance || 0);
            const restoredBalance = tx.type === "income"
              ? rollbackBalance - amount
              : tx.type === "adjustment"
                ? (tx.adjustment_direction === "increase" ? rollbackBalance - amount : rollbackBalance + amount)
                : rollbackBalance + amount;

            const { error: rollbackErr } = await supabaseAdmin
              .from("funds")
              .update({ current_balance: restoredBalance })
              .eq("id", tx.fund_id);

            if (rollbackErr) {
              console.error("CRITICAL: Fund rollback also failed — manual intervention required", { transaction_id, fund_id: tx.fund_id, rollbackErr });
            }
          }
        }

        return NextResponse.json({ error: "Failed to approve transaction." }, { status: 500 });
      }

      if (tx.created_by) {
        try {
          await notify(
            tx.created_by,
            "Transaction approved",
            `Your ${txLabel} of ${amountStr} — "${tx.description || "no description"}" has been approved by ${profile.full_name}.`,
            "info",
            "/transactions",
            { transaction_id, fund_id: tx.fund_id || null }
          );
        } catch (notifyErr) {
          console.warn("Transaction approve notify failed:", notifyErr);
        }
      }

      return NextResponse.json({ success: true, action: "approved" });
    }

    if (action === "reject") {
      if (!reject_reason?.trim()) {
        return NextResponse.json({ error: "reject_reason is required" }, { status: 400 });
      }
      if (reject_reason.trim().length > MAX_REJECT_REASON_LENGTH) {
        return NextResponse.json({ error: `reject_reason must be under ${MAX_REJECT_REASON_LENGTH} characters` }, { status: 400 });
      }

      const reviewedAt = new Date().toISOString();
      let rejectUpdateError = null;

      const { error } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "rejected",
          reviewed_by: profile.id,
          reviewed_at: reviewedAt,
          reject_reason: reject_reason.trim(),
        })
        .eq("id", transaction_id);

      rejectUpdateError = error;

      if (rejectUpdateError) {
        console.error("Transaction reject full audit update error:", rejectUpdateError);

        const { error: fallbackError } = await supabaseAdmin
          .from("transactions")
          .update({
            status: "rejected",
            reject_reason: reject_reason.trim(),
          })
          .eq("id", transaction_id);

        if (fallbackError) {
          console.error("Transaction reject fallback update error:", fallbackError);
          return NextResponse.json({
            error: fallbackError.message || rejectUpdateError.message || "Failed to reject transaction.",
          }, { status: 500 });
        }
      }

      if (tx.created_by) {
        try {
          await notify(
            tx.created_by,
            "Transaction rejected",
            `Your ${txLabel} of ${amountStr} — "${tx.description || "no description"}" was rejected by ${profile.full_name}. Reason: ${reject_reason.trim()}. Please review and resubmit if needed.`,
            "warning",
            "/transactions",
            { transaction_id, reject_reason: reject_reason.trim(), original_amount: tx.amount, original_description: tx.description }
          );
        } catch (notifyErr) {
          console.warn("Transaction reject notify failed:", notifyErr);
        }
      }

      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (err) {
    console.error("Transaction audit error:", err);
    return NextResponse.json({ error: "An error occurred while processing the transaction." }, { status: 500 });
  }
}

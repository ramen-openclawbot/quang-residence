import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin, notify } from "../../../lib/api-auth";

const MAX_REJECT_REASON_LENGTH = 500;

function getSignedAmount(tx) {
  const amount = Math.abs(Number(tx?.amount || 0));
  const type = String(tx?.type || "").trim().toLowerCase();
  const direction = String(tx?.adjustment_direction || "").trim().toLowerCase();
  if (type === "income") return amount;
  if (type === "expense") return -amount;
  if (type === "adjustment") {
    if (direction === "increase") return amount;
    if (direction === "decrease") return -amount;
  }
  return 0;
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

    let query = supabaseAdmin
      .from("transactions")
      .select("*, profiles!created_by(id, full_name, role), categories!category_id(id, code, name_vi, name, color), approved_by_profile:profiles!approved_by(id, full_name), reviewed_by_profile:profiles!reviewed_by(id, full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Optional month/year filter — use transaction_date for consistency with display
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    if (month !== null && year !== null) {
      const m = Number(month);
      const y = Number(year);
      const startDate = new Date(y, m, 1).toISOString();
      const endDate = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
      query = query
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Transaction GET error:", error);
      return NextResponse.json({ error: "Failed to fetch transactions." }, { status: 500 });
    }

    // Month-level summary across the full filtered month/year set (not only current page)
    let summary = null;
    if (month !== null && year !== null) {
      let summaryQuery = supabaseAdmin
        .from("transactions")
        .select("type, amount, adjustment_direction, status")
        .order("created_at", { ascending: false })
        .limit(3000);

      const m = Number(month);
      const y = Number(year);
      const startDate = new Date(y, m, 1).toISOString();
      const endDate = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
      summaryQuery = summaryQuery
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      const { data: summaryRows, error: summaryError } = await summaryQuery;
      if (summaryError) {
        console.warn("Transaction summary query error:", summaryError);
      } else {
        const rows = summaryRows || [];
        const income = rows.reduce((sum, tx) => {
          const signed = getSignedAmount(tx);
          return signed > 0 ? sum + signed : sum;
        }, 0);
        const expense = rows.reduce((sum, tx) => {
          const signed = getSignedAmount(tx);
          return signed < 0 ? sum + Math.abs(signed) : sum;
        }, 0);
        const pending = rows.filter((tx) => String(tx?.status || "").trim().toLowerCase() === "pending").length;
        summary = { income, expense, pending, sampleSize: rows.length };
      }
    }

    return NextResponse.json({ success: true, data: data || [], total: count, hasMore: (offset + limit) < (count || 0), summary });
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

    // Validate transaction_id format
    if (!transaction_id || (typeof transaction_id !== "number" && typeof transaction_id !== "string")) {
      return NextResponse.json({ error: "Valid transaction_id is required" }, { status: 400 });
    }
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    // Fetch the transaction
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("*, profiles!created_by(id, full_name, role)")
      .eq("id", transaction_id)
      .single();

    if (txErr || !tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Secretary cannot review their own transactions
    if (profile.role === "secretary" && tx.created_by === profile.id) {
      return NextResponse.json({ error: "Cannot review your own transaction" }, { status: 403 });
    }

    // Idempotency guard — prevent double-approval / double-rejection
    if (tx.status !== "pending") {
      return NextResponse.json({ error: `Transaction is already ${tx.status}` }, { status: 409 });
    }

    const submitterName = tx.profiles?.full_name || "Staff";
    const amount = Number(tx.amount || 0);

    // Validate amount is a valid positive number
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

      // Mark as approved
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
        // CRITICAL: Fund was updated but transaction approval failed — rollback fund balance
        console.error("CRITICAL: Transaction approval failed, rolling back fund balance", {
          transaction_id, fund_id: tx.fund_id, error
        });

        if (tx.fund_id) {
          // Reverse the balance change
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
              console.error("CRITICAL: Fund rollback also failed — manual intervention required", {
                transaction_id, fund_id: tx.fund_id, rollbackErr
              });
            }
          }
        }

        return NextResponse.json({ error: "Failed to approve transaction." }, { status: 500 });
      }

      // Notify submitter (non-fatal)
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

      // Keep the transaction for audit trail, mark it as rejected instead of deleting.
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

      // Fallback for production schema drift / FK mismatch on audit fields:
      // still allow the rejection state to be stored even if reviewed_by/reviewed_at fails.
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

      // Notify submitter after the audit state is stored (non-fatal).
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

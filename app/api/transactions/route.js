import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Resolve the caller's profile from the bearer token.
 * Returns { user, profile } or { error, status }.
 */
async function resolveUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Missing bearer token", status: 401 };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { error: "Invalid session", status: 401 };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profile not found", status: 403 };

  return { user, profile };
}

/**
 * Send a real-time notification to a specific user.
 */
async function notify(userId, title, body, type = "info", link = null, payload = null) {
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    type,
    link,
    payload,
  });
}

const MAX_REJECT_REASON_LENGTH = 500;

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
      .select("*, profiles!created_by(id, full_name, role), approved_by_profile:profiles!approved_by(id, full_name), reviewed_by_profile:profiles!reviewed_by(id, full_name)", { count: "exact" })
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
    return NextResponse.json({ success: true, data: data || [], total: count, hasMore: (offset + limit) < (count || 0) });
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
        // CRITICAL: Fund was updated but transaction approval failed — log for manual recovery
        console.error("CRITICAL: Fund updated but transaction approval failed", {
          transaction_id, fund_id: tx.fund_id, error
        });
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

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
    if (!transaction_id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "transaction_id and action (approve|reject) required" }, { status: 400 });
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

    const submitterName = tx.profiles?.full_name || "Staff";
    const amountStr = Number(tx.amount || 0).toLocaleString("vi-VN") + "đ";

    if (action === "approve") {
      const reviewedAt = new Date().toISOString();
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

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Notify submitter
      if (tx.created_by) {
        await notify(
          tx.created_by,
          "Transaction approved",
          `Your ${tx.type} of ${amountStr} — "${tx.description || "no description"}" has been approved by ${profile.full_name}.`,
          "info",
          "/transactions",
          { transaction_id }
        );
      }

      return NextResponse.json({ success: true, action: "approved" });
    }

    if (action === "reject") {
      if (!reject_reason?.trim()) {
        return NextResponse.json({ error: "reject_reason is required" }, { status: 400 });
      }

      const reviewedAt = new Date().toISOString();

      // Keep the transaction for audit trail, mark it as rejected instead of deleting.
      const { error } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "rejected",
          reviewed_by: profile.id,
          reviewed_at: reviewedAt,
          reject_reason: reject_reason.trim(),
        })
        .eq("id", transaction_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Notify submitter after the audit state is stored.
      if (tx.created_by) {
        await notify(
          tx.created_by,
          "Transaction rejected",
          `Your ${tx.type} of ${amountStr} — "${tx.description || "no description"}" was rejected by ${profile.full_name}. Reason: ${reject_reason.trim()}. Please review and resubmit if needed.`,
          "warning",
          "/transactions",
          { transaction_id, reject_reason: reject_reason.trim(), original_amount: tx.amount, original_description: tx.description }
        );
      }

      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (err) {
    console.error("Transaction audit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

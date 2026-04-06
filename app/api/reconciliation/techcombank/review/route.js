import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../../lib/api-auth";

export async function POST(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { entryId, matchedTransactionId, reviewReason } = body || {};
    if (!entryId || !matchedTransactionId) {
      return NextResponse.json({ error: "entryId and matchedTransactionId are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bank_statement_entries")
      .update({
        match_status: "approved_manual",
        matched_transaction_id: matchedTransactionId,
        review_reason: reviewReason || "Approved manually",
        reviewed_by: auth.profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message || "Failed to approve reconciliation entry" }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Reconciliation review error:", err);
    return NextResponse.json({ error: "Failed to review reconciliation entry" }, { status: 500 });
  }
}

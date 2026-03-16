import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin } from "../../../../lib/api-auth";

/**
 * POST: notify reviewers when a transaction is submitted.
 *
 * - Housekeeper/Driver submits → notify all secretaries
 * - Secretary submits → notify all owners
 */
export async function POST(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    const { transaction_id, amount, type, description } = await request.json();
    const amountStr = Number(amount || 0).toLocaleString("vi-VN") + "đ";
    const typeLabel = type === "income" ? "Income" : type === "adjustment" ? "Adjustment" : "Expense";

    // Determine who to notify
    let targetRole;
    if (["housekeeper", "driver"].includes(profile.role)) {
      targetRole = "secretary";
    } else if (profile.role === "secretary") {
      targetRole = "owner";
    } else {
      // Owner submitting — no notification needed
      return NextResponse.json({ success: true, notified: 0 });
    }

    const { data: targets } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", targetRole);

    if (!targets || targets.length === 0) {
      return NextResponse.json({ success: true, notified: 0 });
    }

    const notifications = targets.map((t) => ({
      user_id: t.id,
      title: `New ${typeLabel.toLowerCase()} submitted`,
      body: `${profile.full_name} submitted a ${typeLabel.toLowerCase()} of ${amountStr}${description ? ` — "${description}"` : ""}. Tap to review.`,
      type: "pending_approval",
      link: "/transactions",
      payload: { transaction_id, submitter: profile.full_name, submitter_role: profile.role },
    }));

    await supabaseAdmin.from("notifications").insert(notifications);

    return NextResponse.json({ success: true, notified: targets.length });
  } catch (err) {
    console.error("Notify submit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

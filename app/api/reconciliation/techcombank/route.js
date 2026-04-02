import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";
import { parseTechcombankStatement, reconcileStatementWithTransactions } from "../../../../lib/techcombank-statement";

export async function POST(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const form = await request.formData();
    const file = form.get("file");
    const profileId = String(form.get("profileId") || "").trim();
    const monthKey = String(form.get("monthKey") || "").trim();

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Statement file is required" }, { status: 400 });
    }
    if (!profileId) {
      return NextResponse.json({ error: "profileId is required" }, { status: 400 });
    }

    const parsed = parseTechcombankStatement(Buffer.from(await file.arrayBuffer()));

    let query = supabaseAdmin
      .from("transactions")
      .select("id, amount, type, transaction_date, created_at, description, recipient_name, transaction_code, status, created_by")
      .eq("created_by", profileId)
      .neq("status", "rejected")
      .order("created_at", { ascending: false });

    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
      query = query
        .gte("transaction_date", `${monthKey}-01`)
        .lt("transaction_date", nextMonth(monthKey));
    }

    const { data: txs, error } = await query;
    if (error) return NextResponse.json({ error: error.message || "Failed to load transactions" }, { status: 500 });

    const reconciliation = reconcileStatementWithTransactions(parsed.entries, txs || []);

    return NextResponse.json({
      success: true,
      parsed,
      reconciliation,
    });
  } catch (err) {
    console.error("Techcombank reconciliation error:", err);
    return NextResponse.json({ error: "Failed to reconcile Techcombank statement" }, { status: 500 });
  }
}

function nextMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

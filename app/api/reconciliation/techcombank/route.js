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

    let uploadRecord = null;
    try {
      const { data: uploadData } = await supabaseAdmin
        .from("bank_statement_uploads")
        .insert({
          uploaded_by: auth.profile.id,
          profile_id: profileId,
          bank_name: "techcombank",
          account_holder: parsed.meta?.customer_name || null,
          statement_month: monthKey || null,
          file_name: typeof file.name === "string" ? file.name : null,
        })
        .select("id")
        .single();
      uploadRecord = uploadData || null;

      if (uploadRecord?.id && parsed.entries?.length) {
        const matchedByStatementKey = new Map();
        for (const item of reconciliation.matched || []) {
          matchedByStatementKey.set(`${item.statement.row_number}:${item.statement.transaction_no || ""}:${item.statement.amount || 0}`, { status: "matched", txId: item.transaction?.id || null, reason: item.reason || null });
        }
        for (const item of reconciliation.needsReview || []) {
          matchedByStatementKey.set(`${item.statement.row_number}:${item.statement.transaction_no || ""}:${item.statement.amount || 0}`, { status: "needs_review", txId: item.candidate?.id || null, reason: item.reason || null });
        }
        const reversalKeys = new Set();
        for (const pair of reconciliation.reversalPairs || []) {
          reversalKeys.add(`${pair.debit?.row_number}:${pair.debit?.transaction_no || ""}:${pair.debit?.amount || 0}`);
          reversalKeys.add(`${pair.credit?.row_number}:${pair.credit?.transaction_no || ""}:${pair.credit?.amount || 0}`);
        }

        const entryRows = parsed.entries.map((entry) => {
          const key = `${entry.row_number}:${entry.transaction_no || ""}:${entry.amount || 0}`;
          const matchMeta = matchedByStatementKey.get(key);
          return {
            upload_id: uploadRecord.id,
            row_number: entry.row_number,
            statement_date: entry.statement_date,
            partner_name: entry.partner_name,
            partner_bank: entry.partner_bank,
            details: entry.details,
            transaction_no: entry.transaction_no,
            debit: entry.debit,
            credit: entry.credit,
            balance: entry.balance,
            direction: entry.direction,
            amount: entry.amount,
            match_status: reversalKeys.has(key)
              ? "reversal"
              : matchMeta?.status || ((reconciliation.missingInApp || []).some((x) => x.row_number === entry.row_number) ? "missing_in_app" : "unreviewed"),
            matched_transaction_id: matchMeta?.txId || null,
            review_reason: matchMeta?.reason || null,
          };
        });

        const { data: persistedEntries } = await supabaseAdmin
          .from("bank_statement_entries")
          .insert(entryRows)
          .select("id,row_number,transaction_no,amount,match_status");

        const entryIdMap = new Map((persistedEntries || []).map((x) => [`${x.row_number}:${x.transaction_no || ""}:${x.amount || 0}`, x.id]));
        reconciliation.needsReview = (reconciliation.needsReview || []).map((item) => ({
          ...item,
          entryId: entryIdMap.get(`${item.statement.row_number}:${item.statement.transaction_no || ""}:${item.statement.amount || 0}`) || null,
        }));
        reconciliation.matched = (reconciliation.matched || []).map((item) => ({
          ...item,
          entryId: entryIdMap.get(`${item.statement.row_number}:${item.statement.transaction_no || ""}:${item.statement.amount || 0}`) || null,
        }));
      }
    } catch (persistErr) {
      console.error("Failed to persist reconciliation run:", persistErr);
    }

    return NextResponse.json({
      success: true,
      parsed,
      reconciliation,
      uploadId: uploadRecord?.id || null,
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

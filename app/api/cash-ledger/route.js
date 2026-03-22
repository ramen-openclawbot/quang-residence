import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin } from "../../../lib/api-auth";

const ALLOWED_ROLES = ["owner", "secretary"];
const ALLOWED_TYPES = ["income", "expense"];
const ALLOWED_KINDS = ["ops", "fund_transfer_out", "fund_transfer_in_auto"];

export async function GET(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    if (!ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 300);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const { data, error, count } = await supabaseAdmin
      .from("cash_ledger_entries")
      .select("*, creator:profiles!created_by(id, full_name, role)", { count: "exact" })
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("cash-ledger GET error:", error);
      return NextResponse.json({ error: "Failed to fetch cash ledger entries" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [], total: count || 0 });
  } catch (err) {
    console.error("cash-ledger GET unhandled error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

    if (!ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const body = await request.json();
    const type = String(body?.type || "").trim();
    const entry_kind = String(body?.entry_kind || "ops").trim();
    const amount = Number(body?.amount || 0);
    const transactionDate = body?.transaction_date || new Date().toISOString();
    const recipientUserId = body?.recipient_user_id || null;

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!ALLOWED_KINDS.includes(entry_kind)) {
      return NextResponse.json({ error: "Invalid entry_kind" }, { status: 400 });
    }
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    if (entry_kind === "fund_transfer_out") {
      if (type !== "expense") {
        return NextResponse.json({ error: "fund_transfer_out must use expense type" }, { status: 400 });
      }
      if (!recipientUserId) {
        return NextResponse.json({ error: "recipient_user_id is required for fund_transfer_out" }, { status: 400 });
      }
    }

    // Duplicate protection: if there's already an auto-created transfer-in for the same recipient,
    // amount and date, block creating another manual income from the same slip/code.
    const duplicateTargetUserId = recipientUserId || profile.id;
    if (entry_kind !== "fund_transfer_in_auto" && type === "income" && duplicateTargetUserId) {
      const datePrefix = String(transactionDate).slice(0, 10);
      let dupQuery = supabaseAdmin
        .from("cash_ledger_entries")
        .select("id, transaction_code, slip_image_url")
        .eq("created_by", duplicateTargetUserId)
        .eq("entry_kind", "fund_transfer_in_auto")
        .eq("amount", amount)
        .gte("transaction_date", `${datePrefix}T00:00:00.000Z`)
        .lte("transaction_date", `${datePrefix}T23:59:59.999Z`)
        .limit(20);

      const { data: dupRows, error: dupError } = await dupQuery;
      if (dupError) {
        console.error("cash-ledger duplicate check error:", dupError);
      } else {
        const code = String(body?.transaction_code || "").trim();
        const slip = String(body?.slip_image_url || "").trim();
        const matched = (dupRows || []).find((x) => {
          if (code && x.transaction_code && String(x.transaction_code).trim() === code) return true;
          if (slip && x.slip_image_url && String(x.slip_image_url).trim() === slip) return true;
          return !code && !slip;
        });
        if (matched) {
          return NextResponse.json({
            error: "Đã có bút toán thu tự động cho giao dịch chuyển quỹ này. Vui lòng không tạo trùng.",
            duplicate_id: matched.id,
          }, { status: 409 });
        }
      }
    }

    const payload = {
      created_by: profile.id,
      type,
      entry_kind,
      amount,
      transaction_date: transactionDate,
      recipient_user_id: recipientUserId,
      recipient_name: body?.recipient_name || null,
      bank_name: body?.bank_name || null,
      bank_account: body?.bank_account || null,
      transaction_code: body?.transaction_code || null,
      description: body?.description || null,
      notes: body?.notes || null,
      slip_image_url: body?.slip_image_url || null,
      status: "pending",
    };

    if (entry_kind === "fund_transfer_out") {
      const transferGroupId = crypto.randomUUID();
      const { data: outEntry, error: outError } = await supabaseAdmin
        .from("cash_ledger_entries")
        .insert({ ...payload, transfer_group_id: transferGroupId })
        .select("*")
        .single();

      if (outError || !outEntry) {
        console.error("cash-ledger transfer out create error:", outError);
        return NextResponse.json({ error: "Failed to create transfer-out entry" }, { status: 500 });
      }

      const { data: recipientProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .eq("id", recipientUserId)
        .single();

      const autoInPayload = {
        created_by: recipientUserId,
        type: "income",
        entry_kind: "fund_transfer_in_auto",
        amount,
        transaction_date: transactionDate,
        transfer_group_id: transferGroupId,
        linked_entry_id: outEntry.id,
        recipient_user_id: profile.id,
        recipient_name: profile.full_name || null,
        bank_name: body?.bank_name || null,
        bank_account: body?.bank_account || null,
        transaction_code: body?.transaction_code || null,
        description: body?.description || `Thu tự động từ chuyển quỹ của ${profile.full_name || "thư ký"}`,
        notes: body?.notes || `Auto-created from transfer group ${transferGroupId}`,
        slip_image_url: body?.slip_image_url || null,
        status: "approved",
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      };

      const { data: inEntry, error: inError } = await supabaseAdmin
        .from("cash_ledger_entries")
        .insert(autoInPayload)
        .select("*")
        .single();

      if (inError) {
        console.error("cash-ledger auto transfer-in create error:", inError);
        return NextResponse.json({
          error: "Đã tạo chuyển quỹ đi nhưng tạo thu tự động thất bại. Cần kiểm tra lại.",
          transfer_out_id: outEntry.id,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: outEntry,
        auto_created_income: inEntry,
        transfer_group_id: transferGroupId,
        recipient: recipientProfile || null,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("cash_ledger_entries")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("cash-ledger POST error:", error);
      return NextResponse.json({ error: "Failed to create cash ledger entry" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("cash-ledger POST unhandled error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

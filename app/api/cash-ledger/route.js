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

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!ALLOWED_KINDS.includes(entry_kind)) {
      return NextResponse.json({ error: "Invalid entry_kind" }, { status: 400 });
    }
    if (!isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
    }

    const payload = {
      created_by: profile.id,
      type,
      entry_kind,
      amount,
      transaction_date: body?.transaction_date || new Date().toISOString(),
      recipient_user_id: body?.recipient_user_id || null,
      recipient_name: body?.recipient_name || null,
      bank_name: body?.bank_name || null,
      bank_account: body?.bank_account || null,
      transaction_code: body?.transaction_code || null,
      description: body?.description || null,
      notes: body?.notes || null,
      slip_image_url: body?.slip_image_url || null,
      status: "pending",
    };

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

import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../../lib/api-auth";

export async function POST(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { uploadId, notes } = body || {};
    if (!uploadId) {
      return NextResponse.json({ error: "uploadId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bank_statement_uploads")
      .update({
        status: "saved",
        saved_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq("id", uploadId)
      .select("id,status,saved_at,notes")
      .single();

    if (error) return NextResponse.json({ error: error.message || "Failed to save reconciliation" }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Reconciliation save error:", err);
    return NextResponse.json({ error: "Failed to save reconciliation" }, { status: 500 });
  }
}

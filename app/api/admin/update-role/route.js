import { NextResponse } from "next/server";
import { requireOwner, supabaseAdmin } from "../_auth";

const VALID_ROLES = ["owner", "secretary", "housekeeper", "driver"];

export async function POST(request) {
  try {
    const auth = await requireOwner(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { user_id, role } = await request.json();

    if (!user_id || !role) {
      return NextResponse.json({ error: "user_id and role are required" }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, role });
  } catch (err) {
    console.error("Update role error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

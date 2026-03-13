import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_ROLES = ["owner", "secretary", "housekeeper", "driver"];

export async function POST(request) {
  try {
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

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses Service Role key (server-side only) to create users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_ROLES = ["owner", "secretary", "housekeeper", "driver"];

export async function POST(request) {
  try {
    const { email, full_name, role, secret } = await request.json();

    // Simple secret check — prevents random people from creating users
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: "email, full_name, role are required" }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }

    // Create a real auth user immediately so magic-link login can find it.
    // This app uses signInWithOtp(... shouldCreateUser: false), so invite-only
    // users can fail to log in cleanly until they complete the invite flow.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Upsert profile (trigger handles creation, but upsert ensures role is set)
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      full_name,
      role,
    }, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã tạo user ${email}. User có thể đăng nhập bằng magic link ngay bây giờ.`,
      user_id: data.user.id,
    });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner, supabaseAdmin } from "../_auth";

const VALID_ROLES = ["owner", "secretary", "housekeeper", "driver"];

function generateTemporaryPassword() {
  const bytes = crypto.randomBytes(9);
  return "Zen@" + bytes.toString("base64url").slice(0, 10);
}

export async function POST(request) {
  try {
    const auth = await requireOwner(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { email, full_name, role } = await request.json();

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: "email, full_name, role are required" }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }

    const temporaryPassword = generateTemporaryPassword();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) {
      console.error("Create user error:", error);
      return NextResponse.json({ error: "Failed to create user. Please try again." }, { status: 500 });
    }

    // Upsert profile (trigger handles creation, but upsert ensures role is set)
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      full_name,
      role,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      return NextResponse.json({ error: "User created but profile setup failed." }, { status: 500 });
    }

    // NOTE: Temporary password returned so owner can share it securely with the new member.
    // In production, consider sending via email/SMS instead.
    return NextResponse.json({
      success: true,
      message: `Created ${email} with a temporary password.`,
      user_id: data.user.id,
      temporary_password: temporaryPassword,
    });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "An error occurred while creating the user." }, { status: 500 });
  }
}

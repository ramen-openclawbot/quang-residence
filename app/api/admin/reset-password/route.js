import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner, supabaseAdmin } from "../_auth";

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

    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const temporaryPassword = generateTemporaryPassword();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: temporaryPassword,
    });

    if (error) {
      console.error("Reset password error:", error);
      return NextResponse.json({ error: "Failed to reset password. Please try again." }, { status: 500 });
    }

    // NOTE: Temporary password returned so owner can share it securely.
    // In production, consider sending via email/SMS instead.
    return NextResponse.json({
      success: true,
      temporary_password: temporaryPassword,
      message: "Password reset successful.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "An error occurred while resetting the password." }, { status: 500 });
  }
}

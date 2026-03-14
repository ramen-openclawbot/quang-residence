import { NextResponse } from "next/server";
import { requireOwner, supabaseAdmin } from "../_auth";

function generateTemporaryPassword() {
  const rand = Math.random().toString(36).slice(-6);
  return `Zen@${rand}9`;
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      temporary_password: temporaryPassword,
      message: "Password reset successful.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

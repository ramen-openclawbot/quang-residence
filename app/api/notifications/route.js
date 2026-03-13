import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: list notifications for current user (client calls with auth header)
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unread = data?.filter((n) => !n.read_at).length || 0;
  return NextResponse.json({ notifications: data || [], unread });
}

// PATCH: mark notification(s) as read
export async function PATCH(request) {
  const { notification_id, mark_all } = await request.json();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();

  if (mark_all) {
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
  } else if (notification_id) {
    await supabaseAdmin
      .from("notifications")
      .update({ read_at: now })
      .eq("id", notification_id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}

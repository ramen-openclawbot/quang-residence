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

  if (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications." }, { status: 500 });
  }

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
    const { data } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: now })
      .eq("id", notification_id)
      .eq("user_id", user.id)
      .select("id");
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: "notification_id or mark_all required" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// DELETE: delete all notifications for current user only
export async function DELETE(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Notifications DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete notifications." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

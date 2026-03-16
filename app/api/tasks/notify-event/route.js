import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();
    if (!actor) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const { task_id, event_type, status } = await request.json();
    if (!task_id) return NextResponse.json({ error: "task_id required" }, { status: 400 });

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("id, title, status")
      .eq("id", task_id)
      .single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const { data: targets } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .in("role", ["owner", "secretary"]);

    if (!targets?.length) return NextResponse.json({ success: true, notified: 0 });

    const actorName = actor.full_name || "Staff";
    const taskTitle = task.title || `Task #${task.id}`;
    let title = "Task update";
    let body = `${actorName} updated "${taskTitle}".`;

    if (event_type === "created") {
      title = "New task created";
      body = `${actorName} created "${taskTitle}".`;
    } else if (event_type === "status_changed") {
      const effectiveStatus = status || task.status || "updated";
      title = "Task status updated";
      body = `${actorName} moved "${taskTitle}" to ${effectiveStatus}.`;
    }

    const rows = targets.map((target) => ({
      user_id: target.id,
      title,
      body,
      type: "info",
      link: target.role === "owner"
        ? `/owner?tab=agenda&task=${task.id}`
        : `/secretary?tab=tasks&task=${task.id}`,
      payload: {
        task_id: task.id,
        event_type: event_type || "updated",
        status: status || task.status || null,
        actor_id: actor.id,
        actor_name: actorName,
        actor_role: actor.role,
      },
    }));

    await supabaseAdmin.from("notifications").insert(rows);
    return NextResponse.json({ success: true, notified: rows.length });
  } catch (err) {
    console.error("Task notify-event error:", err);
    return NextResponse.json({ error: err.message || "Failed to notify task event" }, { status: 500 });
  }
}

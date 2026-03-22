import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin } from "../../../../lib/api-auth";

export async function POST(request) {
  try {
    const auth = await resolveUser(request, { requireProfile: false });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user } = auth;
    const { task_id } = await request.json();
    if (!task_id) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("id, created_by")
      .eq("id", task_id)
      .single();

    if (taskError || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const isOwner = profile?.role === "owner";
    if (!isOwner && task.created_by !== user.id) return NextResponse.json({ error: "You can only delete your own task" }, { status: 403 });

    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", task_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Task delete error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete task" }, { status: 500 });
  }
}

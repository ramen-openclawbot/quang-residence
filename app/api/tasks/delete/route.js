import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resolveUser(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Missing bearer token", status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { error: "Invalid session", status: 401 };
  return { user };
}

export async function POST(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user } = auth;
    const { task_id } = await request.json();
    if (!task_id) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("id, created_by")
      .eq("id", task_id)
      .single();

    if (taskError || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (task.created_by !== user.id) return NextResponse.json({ error: "Only the creator can delete this task" }, { status: 403 });

    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", task_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Task delete error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete task" }, { status: 500 });
  }
}

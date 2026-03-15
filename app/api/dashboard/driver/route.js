import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "driver") {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const [tripsRes, txRes, tasksRes] = await Promise.all([
      supabaseAdmin.from("driving_trips").select("*").eq("assigned_to", profile.id).order("scheduled_time", { ascending: true }),
      supabaseAdmin.from("transactions").select("*").eq("created_by", profile.id).order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("tasks").select("*").or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`).order("due_date", { ascending: true }),
    ]);

    return NextResponse.json({
      success: true,
      trips: tripsRes.data || [],
      transactions: txRes.data || [],
      tasks: tasksRes.data || [],
    });
  } catch (err) {
    console.error("Driver dashboard API error:", err);
    return NextResponse.json({ error: "An error occurred while loading the driver dashboard." }, { status: 500 });
  }
}

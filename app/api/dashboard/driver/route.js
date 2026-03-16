import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";

export async function GET(request) {
  try {
    const auth = await requireRole(request, "driver");
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { profile } = auth;

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

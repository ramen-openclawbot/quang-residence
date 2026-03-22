import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";

function normalizeAgendaRows({ tasks = [], maintenance = [], schedule = [] }) {
  const taskRows = (tasks || []).map((t) => ({
    id: `task_${t.id}`,
    raw_id: t.id,
    source: "task",
    title: t.title,
    description: t.description || null,
    date: t.due_date || t.created_at,
    status: t.status || "pending",
    priority: t.priority || "medium",
    assigned_to: t.assigned_to || null,
    created_by: t.created_by || null,
    payload: t,
  }));

  const maintenanceRows = (maintenance || []).map((m) => ({
    id: `maintenance_${m.id}`,
    raw_id: m.id,
    source: "maintenance",
    title: m.title || "Chăm sóc nhà",
    description: m.description || null,
    date: m.created_at,
    status: m.status || "reported",
    priority: "medium",
    assigned_to: m.assigned_to || m.reported_by || null,
    created_by: m.created_by || m.reported_by || null,
    payload: m,
  }));

  const scheduleRows = (schedule || []).map((s) => ({
    id: `schedule_${s.id}`,
    raw_id: s.id,
    source: "schedule",
    title: s.title || "Lịch gia đình",
    description: s.notes || s.description || null,
    date: s.event_date,
    status: "scheduled",
    priority: "medium",
    assigned_to: s.assigned_to || null,
    created_by: s.created_by || null,
    payload: s,
  }));

  return [...taskRows, ...maintenanceRows, ...scheduleRows]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

export async function GET(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary", "driver", "housekeeper"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const role = auth.profile?.role;
    const userId = auth.user?.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

    let tasksQ = supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true }).limit(limit);
    let maintenanceQ = supabaseAdmin.from("home_maintenance").select("*").order("created_at", { ascending: false }).limit(limit);
    let scheduleQ = supabaseAdmin.from("family_schedule").select("*").order("event_date", { ascending: true }).limit(limit);

    if (role === "driver") {
      tasksQ = supabaseAdmin
        .from("tasks")
        .select("*")
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .order("due_date", { ascending: true })
        .limit(limit);
      maintenanceQ = supabaseAdmin.from("home_maintenance").select("id").limit(0);
      scheduleQ = supabaseAdmin.from("family_schedule").select("id").limit(0);
    }

    if (role === "housekeeper") {
      tasksQ = supabaseAdmin
        .from("tasks")
        .select("*")
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
        .order("due_date", { ascending: true })
        .limit(limit);
      maintenanceQ = supabaseAdmin
        .from("home_maintenance")
        .select("*")
        .or(`created_by.eq.${userId},reported_by.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      scheduleQ = supabaseAdmin
        .from("family_schedule")
        .select("*")
        .eq("created_by", userId)
        .order("event_date", { ascending: true })
        .limit(limit);
    }

    const [tasksRes, maintenanceRes, scheduleRes] = await Promise.all([tasksQ, maintenanceQ, scheduleQ]);
    const items = normalizeAgendaRows({
      tasks: tasksRes.data || [],
      maintenance: maintenanceRes.data || [],
      schedule: scheduleRes.data || [],
    });

    return NextResponse.json({
      success: true,
      role,
      items,
      counts: {
        task: (tasksRes.data || []).length,
        maintenance: (maintenanceRes.data || []).length,
        schedule: (scheduleRes.data || []).length,
      },
    });
  } catch (err) {
    console.error("Agenda feed API error:", err);
    return NextResponse.json({ error: "Failed to load agenda feed" }, { status: 500 });
  }
}

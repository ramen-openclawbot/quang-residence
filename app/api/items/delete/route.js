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

const TABLES = {
  tasks: { table: "tasks", ownerField: "created_by" },
  maintenance: { table: "home_maintenance", ownerField: "reported_by" },
  family: { table: "family_schedule", ownerField: "created_by" },
};

export async function POST(request) {
  try {
    const auth = await resolveUser(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user } = auth;
    const { kind, id } = await request.json();
    if (!kind || !id) return NextResponse.json({ error: "kind and id are required" }, { status: 400 });

    const cfg = TABLES[kind];
    if (!cfg) return NextResponse.json({ error: "Unsupported delete kind" }, { status: 400 });

    const { data: row, error: rowError } = await supabaseAdmin
      .from(cfg.table)
      .select(`id, ${cfg.ownerField}`)
      .eq("id", id)
      .single();

    if (rowError || !row) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    if (row[cfg.ownerField] !== user.id) return NextResponse.json({ error: "Only the creator can delete this item" }, { status: 403 });

    const { error } = await supabaseAdmin.from(cfg.table).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Item delete error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete item" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin } from "../../../../lib/api-auth";

export async function GET(request) {
  try {
    const auth = await resolveUser(request, { requireProfile: false });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Fetch all templates, ordered by extraction count and last used
    const { data: templates, error } = await supabaseAdmin
      .from("ocr_templates")
      .select("bank_name,bank_identifier,extraction_count,last_used_at,created_at")
      .order("extraction_count", { ascending: false })
      .order("last_used_at", { ascending: false });

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: templates || [],
    });
  } catch (err) {
    console.error("Templates route error:", err);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}

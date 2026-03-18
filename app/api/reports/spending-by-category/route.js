import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";

function parseMonthParam(searchParams) {
  const monthParam = searchParams.get("month"); // YYYY-MM
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("monthIndex"));
  if (!Number.isNaN(y) && !Number.isNaN(m)) return { year: y, month: m };

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

async function resolveCategoryByQuery(q) {
  if (!q) return null;
  const query = String(q).trim().toLowerCase();
  if (!query) return null;

  const { data } = await supabaseAdmin
    .from("categories")
    .select("id, code, name_vi, name")
    .or(`code.ilike.%${query}%,name_vi.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(1);

  return data?.[0] || null;
}

export async function GET(request) {
  try {
    const auth = await requireRole(request, ["owner", "secretary"]);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const { year, month } = parseMonthParam(searchParams);
    const categoryCode = searchParams.get("categoryCode");
    const q = searchParams.get("q");

    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    let categoryFilter = null;
    if (categoryCode) {
      const { data } = await supabaseAdmin
        .from("categories")
        .select("id, code, name_vi, name")
        .eq("code", categoryCode)
        .limit(1);
      categoryFilter = data?.[0] || null;
    } else if (q) {
      categoryFilter = await resolveCategoryByQuery(q);
    }

    let query = supabaseAdmin
      .from("transactions")
      .select("amount, category_id, status, categories!category_id(id, code, name_vi, name)")
      .eq("type", "expense")
      .neq("status", "rejected")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .limit(5000);

    if (categoryFilter?.id) {
      query = query.eq("category_id", categoryFilter.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("spending-by-category error", error);
      return NextResponse.json({ error: "Failed to load spending report" }, { status: 500 });
    }

    const rows = data || [];
    const byCategoryMap = new Map();
    let total = 0;

    for (const row of rows) {
      const amount = Math.abs(Number(row?.amount || 0));
      total += amount;
      const cat = row?.categories || null;
      const key = cat?.code || `UNCATEGORIZED_${row?.category_id || "NONE"}`;
      const prev = byCategoryMap.get(key) || {
        code: cat?.code || null,
        name_vi: cat?.name_vi || cat?.name || "Chưa phân loại",
        count: 0,
        total: 0,
      };
      prev.count += 1;
      prev.total += amount;
      byCategoryMap.set(key, prev);
    }

    const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      period: {
        year,
        month: month + 1,
        monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
      },
      total,
      transactionCount: rows.length,
      category: categoryFilter
        ? {
            id: categoryFilter.id,
            code: categoryFilter.code,
            name_vi: categoryFilter.name_vi || categoryFilter.name,
          }
        : null,
      byCategory,
    });
  } catch (err) {
    console.error("spending-by-category fatal", err);
    return NextResponse.json({ error: "An error occurred while loading spending report." }, { status: 500 });
  }
}

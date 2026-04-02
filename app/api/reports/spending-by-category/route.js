import { NextResponse } from "next/server";
import { requireRole, supabaseAdmin } from "../../../../lib/api-auth";

function getCategoryPathParts(category) {
  if (!category) return [];
  const parts = [];
  const seen = new Set();
  let current = category;
  while (current && !seen.has(current.id) && parts.length < 6) {
    seen.add(current.id);
    parts.unshift({
      id: current.id || null,
      code: current.code || null,
      name_vi: current.name_vi || current.name || "",
      name: current.name || current.name_vi || "",
    });
    current = current.parent || null;
  }
  return parts.filter((part) => part.name_vi);
}

function getCategoryPathLabel(category) {
  const parts = getCategoryPathParts(category);
  return parts.map((part) => part.name_vi).join(" / ") || "Chưa phân loại";
}

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
      .select("amount, category_id, status, categories!category_id(id, code, name_vi, name, parent_id, parent:categories!parent_id(id, code, name_vi, name, parent_id, parent:categories!parent_id(id, code, name_vi, name)))")
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
    const parentSummaryMap = new Map();
    let total = 0;

    for (const row of rows) {
      const amount = Math.abs(Number(row?.amount || 0));
      total += amount;
      const cat = row?.categories || null;
      const parts = getCategoryPathParts(cat);
      const fullName = getCategoryPathLabel(cat);
      const leaf = parts[parts.length - 1] || null;
      const parent = parts[0] || leaf || { code: null, name_vi: "Chưa phân loại", id: null };
      const leafKey = cat?.code || `UNCATEGORIZED_${row?.category_id || "NONE"}`;
      const parentKey = parent?.code || `PARENT_${parent?.id || parent?.name_vi || "NONE"}`;

      const prev = byCategoryMap.get(leafKey) || {
        id: cat?.id || row?.category_id || null,
        code: cat?.code || null,
        name_vi: leaf?.name_vi || cat?.name_vi || cat?.name || "Chưa phân loại",
        full_name_vi: fullName,
        parent_code: parent?.code || null,
        parent_name_vi: parent?.name_vi || "Chưa phân loại",
        count: 0,
        total: 0,
      };
      prev.count += 1;
      prev.total += amount;
      byCategoryMap.set(leafKey, prev);

      const parentPrev = parentSummaryMap.get(parentKey) || {
        id: parent?.id || null,
        code: parent?.code || null,
        name_vi: parent?.name_vi || "Chưa phân loại",
        count: 0,
        total: 0,
        children: new Map(),
      };
      parentPrev.count += 1;
      parentPrev.total += amount;
      const childPrev = parentPrev.children.get(leafKey) || {
        id: cat?.id || row?.category_id || null,
        code: cat?.code || null,
        name_vi: leaf?.name_vi || cat?.name_vi || cat?.name || "Chưa phân loại",
        full_name_vi: fullName,
        count: 0,
        total: 0,
      };
      childPrev.count += 1;
      childPrev.total += amount;
      parentPrev.children.set(leafKey, childPrev);
      parentSummaryMap.set(parentKey, parentPrev);
    }

    const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => b.total - a.total);
    const parentSummary = Array.from(parentSummaryMap.values())
      .sort((a, b) => b.total - a.total)
      .map((parent) => ({
        id: parent.id,
        code: parent.code,
        name_vi: parent.name_vi,
        total: parent.total,
        count: parent.count,
        percent: total > 0 ? (parent.total / total) * 100 : 0,
        children: Array.from(parent.children.values())
          .sort((a, b) => b.total - a.total)
          .map((child) => ({
            ...child,
            percent_of_parent: parent.total > 0 ? (child.total / parent.total) * 100 : 0,
            percent_of_total: total > 0 ? (child.total / total) * 100 : 0,
          })),
      }));

    const childSummary = byCategory.map((child) => ({
      ...child,
      percent_of_total: total > 0 ? (child.total / total) * 100 : 0,
    }));

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
      parentSummary,
      childSummary,
    });
  } catch (err) {
    console.error("spending-by-category fatal", err);
    return NextResponse.json({ error: "An error occurred while loading spending report." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Called by Vercel Cron every day at 22:00 UTC (= 05:00 Vietnam UTC+7 next day)
export async function GET(request) {
  // Verify cron secret
  const secret = request.headers.get("x-cron-secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reportDate = today.toISOString().split("T")[0];

    // 1. Fetch today's transactions
    const { data: txns } = await supabaseAdmin
      .from("transactions")
      .select(`
        *,
        funds(name),
        categories(name_vi),
        profiles!created_by(full_name, role)
      `)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString())
      .order("created_at", { ascending: false });

    // 2. Fetch pending transactions (needing Mr. Quang's approval)
    const { data: pendingTxns } = await supabaseAdmin
      .from("transactions")
      .select("*, funds(name), categories(name_vi), profiles!created_by(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // 3. Fetch today's completed/updated tasks
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("*, profiles!assigned_to(full_name)")
      .gte("updated_at", today.toISOString())
      .lt("updated_at", tomorrow.toISOString());

    // 4. Fetch overdue tasks
    const { data: overdueTasks } = await supabaseAdmin
      .from("tasks")
      .select("*, profiles!assigned_to(full_name)")
      .neq("status", "done")
      .neq("status", "cancelled")
      .lt("due_date", today.toISOString())
      .not("due_date", "is", null);

    // 5. Fetch funds current balances
    const { data: funds } = await supabaseAdmin
      .from("funds")
      .select("*")
      .order("id");

    // 6. Fetch savings/loans maturing in next 7 days
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const { data: maturingItems } = await supabaseAdmin
      .from("savings_loans")
      .select("*")
      .eq("status", "active")
      .lte("maturity_date", nextWeek.toISOString().split("T")[0])
      .gte("maturity_date", reportDate);

    // === Build report data ===
    const getSignedAmount = (t) => {
      const amount = Math.abs(Number(t?.amount || 0));
      if (t?.type === "income") return amount;
      if (t?.type === "adjustment") return t.adjustment_direction === "increase" ? amount : -amount;
      if (t?.type === "expense") return -amount;
      return 0;
    };

    const totalExpenseToday = txns?.reduce((s, t) => {
      const signed = getSignedAmount(t);
      return signed < 0 ? s + Math.abs(signed) : s;
    }, 0) || 0;
    const totalIncomeToday = txns?.reduce((s, t) => {
      const signed = getSignedAmount(t);
      return signed > 0 ? s + signed : s;
    }, 0) || 0;

    // Group transactions by staff
    const byStaff = {};
    txns?.forEach((t) => {
      const name = t.profiles?.full_name || "Unknown";
      if (!byStaff[name]) byStaff[name] = { expense: 0, income: 0, count: 0 };
      byStaff[name][t.type] += Number(t.amount);
      byStaff[name].count++;
    });

    const reportData = {
      date: reportDate,
      summary: {
        total_expense: totalExpenseToday,
        total_income: totalIncomeToday,
        transaction_count: txns?.length || 0,
        pending_approvals: pendingTxns?.length || 0,
        overdue_tasks: overdueTasks?.length || 0,
        maturing_savings: maturingItems?.length || 0,
      },
      by_staff: byStaff,
      transactions: txns?.slice(0, 20) || [],
      pending_transactions: pendingTxns?.slice(0, 10) || [],
      overdue_tasks: overdueTasks?.slice(0, 5) || [],
      maturing_items: maturingItems || [],
      fund_balances: funds || [],
    };

    // 7. Generate AI summary using OpenAI
    let aiSummary = null;
    if (OPENAI_API_KEY && txns && txns.length > 0) {
      try {
        const prompt = buildReportPrompt(reportData);
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Bạn là trợ lý tài chính thông minh cho gia đình Mr. Quang.
Viết báo cáo tổng kết ngày ngắn gọn, súc tích, bằng tiếng Việt.
Format: markdown với emoji. Tối đa 300 từ.`,
              },
              { role: "user", content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });
        const aiData = await res.json();
        aiSummary = aiData.choices?.[0]?.message?.content || null;
      } catch (err) {
        console.error("AI summary error:", err);
      }
    }

    // 8. Save report to database
    const { data: savedReport } = await supabaseAdmin
      .from("daily_reports")
      .insert({
        report_date: reportDate,
        report_type: "daily_expense",
        content: { ...reportData, ai_summary: aiSummary },
      })
      .select()
      .single();

    // 9. Send notification to owner
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "owner")
      .single();

    if (ownerProfile) {
      const notifBody = aiSummary
        ? aiSummary.substring(0, 200) + "..."
        : `Chi: ${formatVND(totalExpenseToday)} | Thu: ${formatVND(totalIncomeToday)} | ${txns?.length || 0} giao dịch`;

      await supabaseAdmin.from("notifications").insert({
        user_id: ownerProfile.id,
        title: `📊 Báo cáo ngày ${formatDate(reportDate)}`,
        body: notifBody,
        type: "report",
        link: "/owner?tab=wealth",
        payload: { report_id: savedReport?.id, date: reportDate },
      });

      // Also notify about pending approvals
      if (pendingTxns && pendingTxns.length > 0) {
        await supabaseAdmin.from("notifications").insert({
          user_id: ownerProfile.id,
          title: `⏳ ${pendingTxns.length} giao dịch chờ duyệt`,
          body: pendingTxns.slice(0, 3).map((t) =>
            `• ${t.profiles?.full_name}: ${formatVND(t.amount)}`
          ).join("\n"),
          type: "pending_approval",
          link: "/owner?tab=wealth",
          payload: { count: pendingTxns.length },
        });
      }

      // Notify about overdue tasks
      if (overdueTasks && overdueTasks.length > 0) {
        await supabaseAdmin.from("notifications").insert({
          user_id: ownerProfile.id,
          title: `⚠️ ${overdueTasks.length} nhiệm vụ quá hạn`,
          body: overdueTasks.slice(0, 3).map((t) =>
            `• ${t.title} — ${t.profiles?.full_name}`
          ).join("\n"),
          type: "warning",
          link: "/owner?tab=agenda",
        });
      }

      // Notify about maturing savings
      if (maturingItems && maturingItems.length > 0) {
        await supabaseAdmin.from("notifications").insert({
          user_id: ownerProfile.id,
          title: `🏦 ${maturingItems.length} sổ tiết kiệm/vay sắp đáo hạn`,
          body: maturingItems.map((s) =>
            `• ${s.bank_name}: ${formatVND(s.principal_amount)} — đáo hạn ${s.maturity_date}`
          ).join("\n"),
          type: "reminder",
          link: "/secretary?tab=calendar",
        });
      }
    }

    // 10. Send reminders to secretary (Thuỷ) for overdue tasks
    const { data: secretaryProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "secretary")
      .single();

    if (secretaryProfile && overdueTasks && overdueTasks.length > 0) {
      await supabaseAdmin.from("notifications").insert({
        user_id: secretaryProfile.id,
        title: `⚠️ ${overdueTasks.length} việc chưa xử lý quá hạn`,
        body: overdueTasks.slice(0, 5).map((t) =>
          `• ${t.title} (${t.profiles?.full_name}) — hạn ${t.due_date ? new Date(t.due_date).toLocaleDateString("vi-VN") : "N/A"}`
        ).join("\n"),
        type: "warning",
        link: "/secretary?tab=tasks",
      });
    }

    console.log(`✅ Daily report generated for ${reportDate}`);

    return NextResponse.json({
      success: true,
      date: reportDate,
      report_id: savedReport?.id,
      summary: reportData.summary,
      notifications_sent: true,
    });
  } catch (err) {
    console.error("Daily report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function buildReportPrompt(data) {
  const { summary, by_staff, transactions, overdue_tasks, maturing_items } = data;
  return `
Tổng kết ngày ${data.date} cho gia đình Mr. Quang:

**Tổng quan:**
- Chi tiêu: ${formatVND(summary.total_expense)} VND
- Thu vào: ${formatVND(summary.total_income)} VND
- Số giao dịch: ${summary.transaction_count}
- Chờ duyệt: ${summary.pending_approvals} giao dịch
- Nhiệm vụ quá hạn: ${summary.overdue_tasks}
${summary.maturing_savings > 0 ? `- Sổ tiết kiệm/vay sắp đáo hạn trong 7 ngày: ${summary.maturing_savings}` : ""}

**Theo nhân viên:**
${Object.entries(by_staff).map(([name, s]) => `- ${name}: Chi ${formatVND(s.expense)}, Thu ${formatVND(s.income)} (${s.count} giao dịch)`).join("\n")}

**5 giao dịch lớn nhất:**
${transactions.slice(0, 5).map((t) =>
  `- ${t.profiles?.full_name}: ${t.type === "expense" ? "Chi" : "Thu"} ${formatVND(t.amount)} — ${t.description || t.recipient_name || "N/A"} (${t.funds?.name})`
).join("\n")}

${overdue_tasks?.length > 0 ? `**Nhiệm vụ quá hạn:**\n${overdue_tasks.map((t) => `- ${t.title} (${t.profiles?.full_name})`).join("\n")}` : ""}

${maturing_items?.length > 0 ? `**Sắp đáo hạn:**\n${maturing_items.map((s) => `- ${s.bank_name}: ${formatVND(s.principal_amount)} (${s.maturity_date})`).join("\n")}` : ""}

Hãy tổng kết ngắn gọn, súc tích, nêu điểm đáng chú ý và khuyến nghị nếu có.
`;
}

function formatVND(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "numeric", year: "numeric",
  });
}

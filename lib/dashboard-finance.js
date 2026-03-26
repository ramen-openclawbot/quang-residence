import { getSignedAmount } from "./transaction";
import { fetchPagedRows } from "./finance-ops";

export function summarizeBalanceRows(rows = [], { todayKey = null, monthKey = null } = {}) {
  let current_balance = 0;
  let today_expense = 0;
  let month_expense = 0;

  for (const tx of rows) {
    const signed = getSignedAmount(tx);
    current_balance += signed;

    const rawDate = String(tx?.transaction_date || tx?.created_at || "");
    const txDay = rawDate.slice(0, 10);
    const txMonth = rawDate.slice(0, 7);

    if (signed < 0 && todayKey && txDay === todayKey) today_expense += Math.abs(signed);
    if (signed < 0 && monthKey && txMonth === monthKey) month_expense += Math.abs(signed);
  }

  return { current_balance, today_expense, month_expense };
}

export async function fetchUserBalanceRows(supabaseAdmin, userId, { pageSize = 1000 } = {}) {
  return fetchPagedRows(
    (from, to) => supabaseAdmin
      .from("transactions")
      .select("type, amount, adjustment_direction, transaction_date, created_at")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .range(from, to),
    { pageSize }
  );
}

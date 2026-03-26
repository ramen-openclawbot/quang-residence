import { getSignedAmount } from "./transaction";

export const OPS_EXCLUDED_USER_PREFIX = "6487c846";

export function isOpsTransaction(tx) {
  const createdBy = String(tx?.created_by || "");
  return !createdBy.startsWith(OPS_EXCLUDED_USER_PREFIX);
}

export function parseMonthParam(monthStr) {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const [year, month] = monthStr.split("-").map(Number);
    return { year, monthIndex: month - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

export function buildMonthDateRange(year, monthIndex) {
  return {
    startDate: new Date(year, monthIndex, 1).toISOString(),
    endDate: new Date(year, monthIndex + 1, 0, 23, 59, 59).toISOString(),
  };
}

export function shouldIncludeStatus(status, includePending, includeRejected) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "rejected") return !!includeRejected;
  if (s === "pending") return !!includePending;
  return true;
}

export function summarizeOpsTransactions(rows = [], { includePending = true, includeRejected = false } = {}) {
  let income = 0;
  let expense = 0;
  let pending_count = 0;

  for (const tx of rows) {
    const status = String(tx?.status || "").trim().toLowerCase();
    if (status === "pending") pending_count += 1;
    if (!shouldIncludeStatus(status, includePending, includeRejected)) continue;

    const signed = getSignedAmount(tx);
    if (signed > 0) income += signed;
    if (signed < 0) expense += Math.abs(signed);
  }

  return {
    income,
    expense,
    net: income - expense,
    pending_count,
    row_count: rows.length,
  };
}

export async function fetchPagedRows(queryBuilder, { pageSize = 1000, maxRows = 100000 } = {}) {
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder(from, to);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    if (from >= maxRows) break;
  }

  return all;
}

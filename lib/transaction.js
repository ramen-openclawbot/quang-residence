/**
 * Shared transaction utility functions.
 * Centralised here to avoid copy-paste drift across role pages.
 */

/**
 * Returns the signed monetary value of a transaction.
 *  - income           → +amount
 *  - expense          → −amount
 *  - adjustment+increase → +amount
 *  - adjustment+decrease → −amount
 *  - unknown type     → 0  (safe default)
 */
export function getSignedAmount(tx) {
  const amount = Math.abs(Number(tx?.amount || 0));
  const type = String(tx?.type || "").trim().toLowerCase();
  const direction = String(tx?.adjustment_direction || "").trim().toLowerCase();
  if (type === "income") return amount;
  if (type === "adjustment") {
    if (direction === "increase") return amount;
    if (direction === "decrease") return -amount;
    return 0;
  }
  if (type === "expense") return -amount;
  return 0;
}

/**
 * Convert a date value (ISO string, Date, or date-only string) to a
 * local-timezone "YYYY-MM-DD" key suitable for day-level comparisons.
 */
/**
 * Return today's date as a "YYYY-MM-DD" string in local timezone.
 * Pure function (no hooks) — safe to call in useMemo or plain code.
 */
export function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalDateKey(value) {
  if (!value) return "";
  // Fast path: if the string already starts with YYYY-MM-DD, return it directly
  if (typeof value === "string") {
    const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns "YYYY-MM-DD" key prioritising transaction_date over created_at.
 */
export function getTransactionDateKey(tx) {
  return getLocalDateKey(tx?.transaction_date || tx?.created_at);
}

/**
 * Classify a transaction into income/expense/pending/other for UI filters.
 */
export function classifyTransaction(tx) {
  if (String(tx?.status || "").trim().toLowerCase() === "pending") return "pending";

  const type = String(tx?.type || "").trim().toLowerCase();
  const direction = String(tx?.adjustment_direction || "").trim().toLowerCase();

  if (type === "income") return "income";
  if (type === "expense") return "expense";
  if (type === "adjustment") {
    if (direction === "increase") return "income";
    if (direction === "decrease") return "expense";
  }

  const signed = getSignedAmount(tx);
  if (signed > 0) return "income";
  if (signed < 0) return "expense";
  return "other";
}

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

  const status = String(tx?.status || "").trim().toLowerCase();
  if (status === "pending") return "pending";
  return "other";
}

export function matchesTransactionFilter(tx, filterKey) {
  if (!filterKey) return true;
  const signed = getSignedAmount(tx);
  const category = classifyTransaction(tx);
  const status = String(tx?.status || "").trim().toLowerCase();

  if (filterKey === "income") return category === "income" && signed > 0;
  if (filterKey === "expense") return category === "expense" && signed < 0;
  if (filterKey === "pending") return status === "pending";
  return true;
}

export function getCategoryPathParts(category) {
  if (!category) return [];
  const parts = [];
  const seen = new Set();
  let current = category;

  while (current && !seen.has(current.id) && parts.length < 6) {
    seen.add(current.id);
    const label = current.name_vi || current.name || "";
    if (label) parts.unshift(label);
    current = current.parent || null;
  }

  return parts;
}

export function getCategoryDisplayLabel(category, options = {}) {
  const { withParents = false, separator = " / " } = options;
  if (!category) return "Chưa phân loại";
  const parts = getCategoryPathParts(category);
  if (!parts.length) return "Chưa phân loại";
  return withParents ? parts.join(separator) : parts[parts.length - 1];
}

export function getTransactionCategoryMeta(tx) {
  if (tx?.type !== "expense") return null;
  const c = tx?.categories;
  if (c) {
    const parts = getCategoryPathParts(c);
    return {
      key: c.code || String(c.id || getCategoryDisplayLabel(c, { withParents: true })),
      label: getCategoryDisplayLabel(c),
      fullLabel: getCategoryDisplayLabel(c, { withParents: true }),
      rootLabel: parts[0] || getCategoryDisplayLabel(c),
      branchLabel: parts.slice(0, -1).join(" / ") || getCategoryDisplayLabel(c),
      leafLabel: parts[parts.length - 1] || getCategoryDisplayLabel(c),
      pathParts: parts,
      color: c.color || "#94a3b8",
      code: c.code || null,
    };
  }
  const m = tx?.ocr_raw_data?.category_meta;
  if (m) {
    const label = m.full_label_vi || m.label_vi || m.code || "Chưa phân loại";
    const parts = String(label).split("/").map((x) => x.trim()).filter(Boolean);
    return {
      key: m.code || label,
      label,
      fullLabel: label,
      rootLabel: parts[0] || label,
      branchLabel: parts.slice(0, -1).join(" / ") || label,
      leafLabel: parts[parts.length - 1] || label,
      pathParts: parts,
      color: "#94a3b8",
      code: m.code || null,
    };
  }
  return { key: "UNCATEGORIZED", label: "Chưa phân loại", fullLabel: "Chưa phân loại", rootLabel: "Chưa phân loại", branchLabel: "Chưa phân loại", leafLabel: "Chưa phân loại", pathParts: ["Chưa phân loại"], color: "#94a3b8", code: null };
}

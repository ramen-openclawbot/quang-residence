import * as XLSX from "xlsx";

export function normalizeNumber(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/,/g, "").replace(/\s+/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dmy) return null;
  const d = String(Number(dmy[1])).padStart(2, "0");
  const m = String(Number(dmy[2])).padStart(2, "0");
  const y = dmy[3];
  return `${y}-${m}-${d}`;
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(a, b) {
  if (!a || !b) return 999;
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((da - db) / 86400000);
}

export function parseTechcombankStatement(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

  const meta = {
    bank_name: "Techcombank",
    sheet_name: sheetName,
    customer_name: null,
    customer_id: null,
    opening_balance: 0,
  };

  for (const row of rows.slice(0, 35)) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      if (!cell) continue;
      const text = String(cell).trim();
      if (text.includes("Tên khách hàng") && row[i + 11]) meta.customer_name = String(row[i + 11]).trim();
      if (text.includes("Customer ID") && row[i + 10]) meta.customer_id = String(row[i + 10]).trim();
      if (text.includes("Số dư đầu kỳ") && row[i + 41]) meta.opening_balance = normalizeNumber(row[i + 41]);
    }
  }

  const entries = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx] || [];
    const date = normalizeDate(row[1]);
    const details = row[17] ? String(row[17]).trim() : "";
    const txNo = row[21] ? String(row[21]).trim() : "";
    const debit = normalizeNumber(row[31]);
    const credit = normalizeNumber(row[37]);
    const balance = normalizeNumber(row[42]);
    if (!date) continue;
    if (!details && !txNo && !debit && !credit) continue;

    entries.push({
      row_number: idx + 1,
      statement_date: date,
      partner_name: row[6] ? String(row[6]).trim() : "",
      partner_bank: row[11] ? String(row[11]).trim() : "",
      details,
      transaction_no: txNo,
      debit,
      credit,
      balance,
      direction: credit > 0 ? "in" : debit > 0 ? "out" : "unknown",
      amount: credit > 0 ? credit : debit,
      source_bank: "techcombank",
      account_holder: meta.customer_name,
    });
  }

  return {
    meta,
    entries,
    summary: {
      total_entries: entries.length,
      total_in: entries.reduce((s, x) => s + (x.credit || 0), 0),
      total_out: entries.reduce((s, x) => s + (x.debit || 0), 0),
      closing_balance: entries.length ? entries[entries.length - 1].balance : meta.opening_balance,
    },
  };
}

export function reconcileStatementWithTransactions(statementEntries = [], appTransactions = []) {
  const unmatchedApp = [...appTransactions];
  const matched = [];
  const missingInApp = [];
  const needsReview = [];

  for (const entry of statementEntries) {
    const exactIdx = unmatchedApp.findIndex((tx) => {
      const txAmount = Math.abs(Number(tx.amount || 0));
      const txDate = String(tx.transaction_date || tx.created_at || "").slice(0, 10);
      const sameDirection = entry.direction === "in" ? tx.type === "income" : tx.type === "expense";
      return sameDirection && txAmount === Number(entry.amount || 0) && txDate === entry.statement_date;
    });

    if (exactIdx >= 0) {
      const tx = unmatchedApp.splice(exactIdx, 1)[0];
      matched.push({ statement: entry, transaction: tx, confidence: 1 });
      continue;
    }

    const candidate = unmatchedApp.find((tx) => {
      const txAmount = Math.abs(Number(tx.amount || 0));
      const txDate = String(tx.transaction_date || tx.created_at || "").slice(0, 10);
      const sameDirection = entry.direction === "in" ? tx.type === "income" : tx.type === "expense";
      if (!sameDirection || txAmount !== Number(entry.amount || 0)) return false;
      const dayDiff = Math.abs(daysBetween(txDate, entry.statement_date));
      if (dayDiff <= 1) return true;
      const hayA = normalizeText([entry.details, entry.partner_name, entry.transaction_no].join(" "));
      const hayB = normalizeText([tx.description, tx.recipient_name, tx.transaction_code].join(" "));
      return !!hayA && !!hayB && (hayA.includes(hayB) || hayB.includes(hayA));
    });

    if (candidate) {
      needsReview.push({ statement: entry, candidate, reason: "same_amount_close_date_or_similar_text" });
      continue;
    }

    missingInApp.push(entry);
  }

  const extraInApp = unmatchedApp;

  return {
    summary: {
      statement_count: statementEntries.length,
      app_count: appTransactions.length,
      matched_count: matched.length,
      missing_count: missingInApp.length,
      extra_count: extraInApp.length,
      review_count: needsReview.length,
      matched_amount: matched.reduce((s, x) => s + Number(x.statement.amount || 0), 0),
      missing_amount: missingInApp.reduce((s, x) => s + Number(x.amount || 0), 0),
      extra_amount: extraInApp.reduce((s, x) => s + Math.abs(Number(x.amount || 0)), 0),
    },
    matched,
    missingInApp,
    extraInApp,
    needsReview,
  };
}

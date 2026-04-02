"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIcon } from "../../components/shared/StaffShell";
import TransactionDetail from "../../components/shared/TransactionDetail";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { getSignedAmount, getTransactionDateKey, matchesTransactionFilter, getTransactionCategoryMeta } from "../../lib/transaction";
import { fmtAmountVND as fmtVND, fmtDate } from "../../lib/format";

/* ─── design tokens (must match app-wide palette) ─── */
const T = {
  primary: "#56c91d",
  bg: "#f6f8f6",
  card: "#ffffff",
  text: "#1a2e1a",
  textMuted: "#7c8b7a",
  border: "#e6ede4",
  success: "#10b981",
  danger: "#ef4444",
  amber: "#f59e0b",
  blue: "#3b82f6",
};

const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
  boxShadow: "0 4px 20px rgba(16,24,16,0.03)",
};

/* ─── Golden-ratio type scale (φ ≈ 1.618) ───
   8 → 10 → 13 → 16 → 20 → 26
   Spacing: 6 → 8 → 10 → 13 → 16 → 20 → 26
   ────────────────────────────────────────────── */

const MONTHS = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
const STATUS_VI = { approved: "Đã duyệt", pending: "Chờ duyệt", rejected: "Từ chối" };

function getCategoryMeta(tx) {
  return getTransactionCategoryMeta(tx);
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE — Transaction Ledger
   ═══════════════════════════════════════════════════════ */
const PAGE_SIZE = 30;

export default function TransactionsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(null); // null = all days, or 1-31
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [detail, setDetail] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // "income" | "expense" | "pending" | null
  const [monthSummary, setMonthSummary] = useState(null);
  const txCountRef = useRef(0);
  useEffect(() => { txCountRef.current = transactions.length; }, [transactions.length]);

  /* ── Fetch via server API with month/year filter + pagination ── */
  const fetchTransactions = useCallback(async (append = false, silent = false) => {
    if (append) setLoadingMore(true); else if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isServerFilteredMode = !!activeFilter;
      const requestLimit = isServerFilteredMode ? 3000 : PAGE_SIZE;
      const offset = append && !isServerFilteredMode ? txCountRef.current : 0;
      const params = new URLSearchParams({
        limit: String(requestLimit),
        offset: String(offset),
        month: String(selectedMonth),
        year: String(selectedYear),
      });
      const res = await fetch(`/api/transactions?${params}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (append) {
          setTransactions((prev) => [...prev, ...(json.data || [])]);
        } else {
          setTransactions(json.data || []);
        }
        setHasMore(isServerFilteredMode ? false : (json.hasMore || false));
        if (!append) {
          const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
          try {
            const sumRes = await fetch(`/api/reports/finance-summary?scope=month&month=${monthKey}&include_pending=true&include_rejected=false`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const sumJson = await sumRes.json();
            if (sumRes.ok && sumJson?.success) {
              setMonthSummary({
                income: sumJson.income,
                expense: sumJson.expense,
                pending: sumJson.pending_count,
              });
            } else {
              setMonthSummary(json.summary || null);
            }
          } catch {
            setMonthSummary(json.summary || null);
          }
        }
      } else {
        /* Fallback: direct Supabase query */
        const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();
        const { data } = await supabase
          .from("transactions")
          .select("*, profiles!created_by(id, full_name, role)")
          .gte("transaction_date", startDate)
          .lte("transaction_date", endDate)
          .order("created_at", { ascending: false })
          .limit(requestLimit);
        setTransactions(data || []);
        setHasMore(false);
        setMonthSummary(null);
      }
    } catch (err) {
      console.error("fetchTransactions error:", err);
      if (!append) setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedMonth, selectedYear, activeFilter]);

  /* Reset + fetch when month/year/activeFilter changes */
  useEffect(() => {
    fetchTransactions(false);
  }, [fetchTransactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetTx = new URLSearchParams(window.location.search).get("tx");
    if (!targetTx || !transactions.length || detail) return;
    const matched = transactions.find((tx) => String(tx.id) === String(targetTx));
    if (matched) setDetail(matched);
  }, [transactions, detail]);

  // Realtime subscription for new/updated/deleted transactions (silent reload — no spinner)
  useEffect(() => {
    const ch = supabase
      .channel("transactions-ledger")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions(false, true);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [selectedMonth, selectedYear]);

  const getTxDateParts = (tx) => {
    const key = getTransactionDateKey(tx);
    if (!key) return null;
    const [y, m, d] = key.split("-").map((v) => Number(v));
    if (!y || !m || !d) return null;
    return { year: y, month: m - 1, day: d };
  };

  // Step 1: Filter by day (if selected)
  const dayFiltered = useMemo(() => {
    if (selectedDay === null) return transactions;
    return transactions.filter((tx) => getTxDateParts(tx)?.day === selectedDay);
  }, [transactions, selectedDay]);

  // Step 2: Filter by search
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return dayFiltered;
    const q = search.toLowerCase();
    return dayFiltered.filter((tx) =>
      (tx.description || "").toLowerCase().includes(q) ||
      (tx.recipient_name || "").toLowerCase().includes(q) ||
      (tx.bank_name || "").toLowerCase().includes(q) ||
      (tx.transaction_code || "").toLowerCase().includes(q) ||
      (tx.notes || "").toLowerCase().includes(q) ||
      (tx.profiles?.full_name || "").toLowerCase().includes(q) ||
      String(tx.amount || "").includes(q)
    );
  }, [dayFiltered, search]);

  // Step 3: Apply activeFilter (income/expense/pending)
  const filtered = useMemo(() => {
    if (!activeFilter) return searchFiltered;
    return searchFiltered.filter((tx) => matchesTransactionFilter(tx, activeFilter));
  }, [searchFiltered, activeFilter]);

  // Summary stats — computed from filtered (reflects day + search + activeFilter)
  const totalIncome = useMemo(() => filtered.reduce((s, t) => {
    const signed = getSignedAmount(t);
    return signed > 0 ? s + signed : s;
  }, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.reduce((s, t) => {
    const signed = getSignedAmount(t);
    return signed < 0 ? s + Math.abs(signed) : s;
  }, 0), [filtered]);
  const pendingCount = useMemo(() => filtered.filter((t) => t.status === "pending").length, [filtered]);

  const usingMonthSummary = useMemo(() => !search.trim() && selectedDay === null && !activeFilter && !!monthSummary, [search, selectedDay, activeFilter, monthSummary]);
  const displayIncome = usingMonthSummary ? Number(monthSummary?.income || 0) : totalIncome;
  const displayExpense = usingMonthSummary ? Number(monthSummary?.expense || 0) : totalExpense;
  const displayPending = usingMonthSummary ? Number(monthSummary?.pending || 0) : pendingCount;


  // Group transactions by date (stable even if same date appears non-contiguously)
  const groupedByDate = useMemo(() => {
    const order = [];
    const bucket = new Map();
    for (const tx of filtered) {
      const dateKey = fmtDate(tx.transaction_date || tx.created_at);
      if (!bucket.has(dateKey)) {
        bucket.set(dateKey, []);
        order.push(dateKey);
      }
      bucket.get(dateKey).push(tx);
    }
    return order.map((date) => ({ date, transactions: bucket.get(date) || [] }));
  }, [filtered]);

  const handleAction = (action, txId) => {
    // Optimistic update + close detail immediately
    setTransactions((prev) => prev.map((t) => {
      if (t.id !== txId) return t;
      if (action === "reject") return { ...t, status: "rejected" };
      return { ...t, status: "approved" };
    }));
    setDetail(null);
    // Silent background refetch to sync with server
    fetchTransactions(false, true);
  };

  // Year options: current year ± 2
  const yearOptions = [];
  const now = new Date().getFullYear();
  for (let y = now - 2; y <= now + 1; y++) yearOptions.push(y);

  // Auth guard: only owner + secretary
  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ fontSize: 13, color: T.textMuted }}>Đang tải...</div>
    </div>;
  }
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  if (profile && !["owner", "secretary"].includes(profile.role)) {
    if (typeof window !== "undefined") window.location.href = `/${profile.role}`;
    return null;
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'Be Vietnam Pro','Inter',-apple-system,sans-serif", boxShadow: "0 0 60px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 16px 13px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
            <div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sổ kiểm toán</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Giao dịch</div>
            </div>
            <button onClick={() => {
              const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
              if (from === "owner") {
                window.location.href = "/owner";
                return;
              }
              if (from === "secretary") {
                window.location.href = "/secretary";
                return;
              }
              window.history.back();
            }} style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon name="arrow_back" size={18} color={T.text} />
            </button>
          </div>

          {/* Day / Month / Year filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDate(value);
                if (!value) {
                  setSelectedDay(null);
                  return;
                }
                const [y, m, d] = value.split("-").map(Number);
                if (y && m && d) {
                  setSelectedYear(y);
                  setSelectedMonth(m - 1);
                  setSelectedDay(d);
                }
              }}
              style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${selectedDate ? T.primary : T.border}`, background: selectedDate ? `${T.primary}08` : T.card, padding: "0 10px", fontSize: 12, fontWeight: 600, color: T.text, boxSizing: "border-box", WebkitAppearance: "none", appearance: "none" }}
            />
            {selectedDate && (
              <button
                onClick={() => { setSelectedDate(""); setSelectedDay(null); }}
                style={{ height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, padding: "0 10px", fontSize: 11, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}
              >
                Xóa
              </button>
            )}
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedDay(null); setSelectedDate(""); }}
              style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, padding: "0 10px", fontSize: 12, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedDay(null); setSelectedDate(""); }}
              style={{ width: 80, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, padding: "0 10px", fontSize: 12, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <MIcon name="search" size={16} color={T.textMuted} style={{ position: "absolute", left: 12, top: 10 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm giao dịch..."
              style={{ width: "100%", height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, paddingLeft: 34, paddingRight: 12, fontSize: 12, color: T.text, boxSizing: "border-box" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer" }}>
                <MIcon name="close" size={16} color={T.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* Summary strip — clickable filters */}
        <div style={{ padding: "0 16px 10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { key: "income", label: "Thu nhập", value: fmtVND(displayIncome), color: T.success },
            { key: "expense", label: "Chi tiêu", value: fmtVND(displayExpense), color: T.danger },
            { key: "pending", label: "Chờ duyệt", value: displayPending, color: T.amber },
          ].map((item) => {
            const isActive = activeFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveFilter(isActive ? null : item.key)}
                style={{
                  ...cardStyle,
                  padding: "8px 10px",
                  textAlign: "center",
                  cursor: "pointer",
                  border: isActive ? `2px solid ${item.color}` : `1px solid ${T.border}`,
                  background: isActive ? `${item.color}10` : T.card,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: item.color, letterSpacing: "0.06em" }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: item.color, marginTop: 3 }}>{item.value}</div>
              </button>
            );
          })}
        </div>
        {/* Active filter indicator */}
        {activeFilter && (
          <div style={{ padding: "0 16px 8px" }}>
            <button
              onClick={() => setActiveFilter(null)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 8,
                background: `${activeFilter === "income" ? T.success : activeFilter === "expense" ? T.danger : T.amber}15`,
                color: activeFilter === "income" ? T.success : activeFilter === "expense" ? T.danger : T.amber,
                fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
              }}
            >
              <MIcon name="filter_list" size={14} color={activeFilter === "income" ? T.success : activeFilter === "expense" ? T.danger : T.amber} />
              {activeFilter === "income" ? "Thu nhập" : activeFilter === "expense" ? "Chi tiêu" : "Chờ duyệt"}
              <MIcon name="close" size={12} color={activeFilter === "income" ? T.success : activeFilter === "expense" ? T.danger : T.amber} />
            </button>
          </div>
        )}

        {/* Transaction list — grouped by date */}
        <div style={{ padding: "0 16px 100px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: 26, fontSize: 12 }}>Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: 26 }}>
              <MIcon name="receipt_long" size={32} color={T.border} />
              <div style={{ marginTop: 10, fontSize: 12 }}>Không tìm thấy giao dịch</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {groupedByDate.map((group) => {
                const dayIncome = group.transactions.reduce((s, t) => { const v = getSignedAmount(t); return v > 0 ? s + v : s; }, 0);
                const dayExpense = group.transactions.reduce((s, t) => { const v = getSignedAmount(t); return v < 0 ? s + Math.abs(v) : s; }, 0);
                return (
                  <div key={group.date}>
                    {/* Date header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 6px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {group.date}
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: 10, fontWeight: 700 }}>
                        {dayIncome > 0 && <span style={{ color: T.success }}>+{fmtVND(dayIncome)}</span>}
                        {dayExpense > 0 && <span style={{ color: T.danger }}>−{fmtVND(dayExpense)}</span>}
                      </div>
                    </div>
                    {/* Transactions for this date */}
                    <div style={{ display: "grid", gap: 6 }}>
                      {group.transactions.map((tx) => {
                        const signedAmount = getSignedAmount(tx);
                        const isIncome = signedAmount > 0;
                        const txType = String(tx?.type || "").trim().toLowerCase();
                        const statusColor = tx.status === "approved" ? T.success : tx.status === "pending" ? T.amber : T.danger;
                        return (
                          <button
                            key={tx.id}
                            onClick={() => setDetail(tx)}
                            style={{ ...cardStyle, padding: "9px 10px", width: "calc(100% - 4px)", margin: "0 auto", textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", alignItems: "center", columnGap: 9, boxSizing: "border-box", maxWidth: "100%" }}
                          >
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: isIncome ? "#ecfdf3" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <MIcon name={isIncome ? "trending_up" : "trending_down"} size={16} color={isIncome ? T.success : T.danger} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {tx.description || tx.recipient_name || (txType === "income" ? "Thu nhập" : txType === "adjustment" ? "Điều chỉnh" : "Chi tiêu")}
                              </div>
                              {(() => { const cat = getCategoryMeta(tx); if (!cat) return null; return (
                                <div style={{ marginTop: 4 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}33`, fontSize: 10, fontWeight: 700 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: 999, background: cat.color }} />{cat.label}
                                  </span>
                                </div>
                              ); })()}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 8 }}>
                                <div style={{ fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                  {tx.profiles?.full_name || "—"}
                                </div>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 5, background: `${statusColor}15`, color: statusColor, fontSize: 9, fontWeight: 700, textTransform: "uppercase", flexShrink: 0, whiteSpace: "nowrap" }}>
                                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: statusColor }} />
                                  {STATUS_VI[tx.status] || tx.status}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", minWidth: 86, paddingLeft: 4 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: signedAmount >= 0 ? T.success : T.danger, whiteSpace: "nowrap" }}>
                                {signedAmount >= 0 ? "+" : "−"}{fmtVND(Math.abs(signedAmount))}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Load more */}
              {hasMore && !search.trim() && !activeFilter && (
                <button
                  onClick={() => fetchTransactions(true)}
                  disabled={loadingMore}
                  style={{
                    width: "100%", height: 38, borderRadius: 10,
                    border: `1px solid ${T.border}`, background: T.card,
                    color: T.primary, fontWeight: 700, fontSize: 12,
                    cursor: loadingMore ? "default" : "pointer",
                    opacity: loadingMore ? 0.6 : 1,
                    marginTop: 3,
                  }}
                >
                  {loadingMore ? "Đang tải..." : "Xem thêm"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Detail overlay */}
        {detail && (
          <TransactionDetail
            tx={detail}
            profile={profile}
            onClose={() => setDetail(null)}
            onAction={handleAction}
          />
        )}
      </div>
  );
}

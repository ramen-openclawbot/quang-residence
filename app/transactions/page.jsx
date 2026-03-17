"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIcon } from "../../components/shared/StaffShell";
import TransactionDetail from "../../components/shared/TransactionDetail";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { getSignedAmount } from "../../lib/transaction";
import { fmtAmountVND as fmtVND, fmtDateEN as fmtDate } from "../../lib/format";

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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [detail, setDetail] = useState(null);
  const txCountRef = useRef(0);
  useEffect(() => { txCountRef.current = transactions.length; }, [transactions.length]);

  /* ── Fetch via server API with month/year filter + pagination ── */
  const fetchTransactions = useCallback(async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const offset = append ? txCountRef.current : 0;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
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
        setHasMore(json.hasMore || false);
      } else {
        /* Fallback: direct Supabase query */
        const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();
        const { data } = await supabase
          .from("transactions")
          .select("*, profiles!created_by(id, full_name, role)")
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        setTransactions(data || []);
        setHasMore(false);
      }
    } catch (err) {
      console.error("fetchTransactions error:", err);
      if (!append) setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedMonth, selectedYear]);

  /* Reset + fetch when month/year changes */
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

  // Realtime subscription for new/updated/deleted transactions
  useEffect(() => {
    const ch = supabase
      .channel("transactions-ledger")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions(false);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [selectedMonth, selectedYear]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter((tx) =>
      (tx.description || "").toLowerCase().includes(q) ||
      (tx.recipient_name || "").toLowerCase().includes(q) ||
      (tx.bank_name || "").toLowerCase().includes(q) ||
      (tx.transaction_code || "").toLowerCase().includes(q) ||
      (tx.notes || "").toLowerCase().includes(q) ||
      (tx.profiles?.full_name || "").toLowerCase().includes(q) ||
      String(tx.amount || "").includes(q)
    );
  }, [transactions, search]);

  // Summary stats
  const totalIncome = useMemo(() => filtered.reduce((s, t) => {
    const signed = getSignedAmount(t);
    return signed > 0 ? s + signed : s;
  }, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.reduce((s, t) => {
    const signed = getSignedAmount(t);
    return signed < 0 ? s + Math.abs(signed) : s;
  }, 0), [filtered]);
  const pendingCount = useMemo(() => filtered.filter((t) => t.status === "pending").length, [filtered]);

  const handleAction = (action, txId) => {
    setTransactions((prev) => prev.map((t) => {
      if (t.id !== txId) return t;
      if (action === "reject") return { ...t, status: "rejected" };
      return { ...t, status: "approved" };
    }));
    setDetail(null);
  };

  // Year options: current year ± 2
  const yearOptions = [];
  const now = new Date().getFullYear();
  for (let y = now - 2; y <= now + 1; y++) yearOptions.push(y);

  // Auth guard: only owner + secretary
  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ fontSize: 13, color: T.textMuted }}>Loading...</div>
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
    <div style={{ background: T.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'Manrope','Inter',-apple-system,sans-serif", boxShadow: "0 0 60px rgba(0,0,0,0.06)" }}>
        {/* Header */}
        <div style={{ padding: "20px 16px 13px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
            <div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Audit Ledger</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Transactions</div>
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

          {/* Month/Year filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, padding: "0 10px", fontSize: 12, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
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
              placeholder="Search transactions..."
              style={{ width: "100%", height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, paddingLeft: 34, paddingRight: 12, fontSize: 12, color: T.text, boxSizing: "border-box" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer" }}>
                <MIcon name="close" size={16} color={T.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ padding: "0 16px 10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div style={{ ...cardStyle, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: T.success, letterSpacing: "0.06em" }}>Income</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.success, marginTop: 3 }}>{fmtVND(totalIncome)}</div>
          </div>
          <div style={{ ...cardStyle, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: T.danger, letterSpacing: "0.06em" }}>Expense</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.danger, marginTop: 3 }}>{fmtVND(totalExpense)}</div>
          </div>
          <div style={{ ...cardStyle, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: T.amber, letterSpacing: "0.06em" }}>Pending</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.amber, marginTop: 3 }}>{pendingCount}</div>
          </div>
        </div>

        {/* Transaction list */}
        <div style={{ padding: "0 16px 100px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: 26, fontSize: 12 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: 26 }}>
              <MIcon name="receipt_long" size={32} color={T.border} />
              <div style={{ marginTop: 10, fontSize: 12 }}>No transactions found</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {filtered.map((tx) => {
                const signedAmount = getSignedAmount(tx);
                const isIncome = signedAmount >= 0;
                const statusColor = tx.status === "approved" ? T.success : tx.status === "pending" ? T.amber : T.danger;
                return (
                  <button
                    key={tx.id}
                    onClick={() => setDetail(tx)}
                    style={{ ...cardStyle, padding: "10px 12px", width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                  >
                    {/* Icon */}
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: isIncome ? "#ecfdf3" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MIcon name={isIncome ? "trending_up" : "trending_down"} size={16} color={isIncome ? T.success : T.danger} />
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                          {tx.description || tx.recipient_name || (isIncome ? "Income" : "Expense")}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isIncome ? T.success : T.danger, flexShrink: 0, whiteSpace: "nowrap" }}>
                          {isIncome ? "+" : "−"}{fmtVND(Math.abs(signedAmount))}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                        <div style={{ fontSize: 11, color: T.textMuted }}>
                          {tx.profiles?.full_name || "—"} · {fmtDate(tx.transaction_date || tx.created_at)}
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 5, background: `${statusColor}15`, color: statusColor, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: statusColor }} />
                          {tx.status}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {/* Load more */}
              {hasMore && !search.trim() && (
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
                  {loadingMore ? "Loading..." : "Load more"}
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

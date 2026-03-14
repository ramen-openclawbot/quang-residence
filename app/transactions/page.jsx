"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MIcon } from "../../components/shared/StaffShell";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

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
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(16,24,16,0.04)",
};

/* ─── helpers ─── */
const fmtVND = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtTime = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ═══════════════════════════════════════════════════════
   IMAGE LIGHTBOX — tap to zoom, swipe left/right
   ═══════════════════════════════════════════════════════ */
function ImageLightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const [touchStart, setTouchStart] = useState(null);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (diff > 60) prev();
    else if (diff < -60) next();
    setTouchStart(null);
  };

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}>
        <MIcon name="close" size={28} color="white" />
      </button>
      <img
        src={images[idx]}
        alt={`Image ${idx + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8 }}
      />
      <div style={{ color: "white", marginTop: 12, fontSize: 14, fontWeight: 600 }}>
        {idx + 1} / {images.length}
      </div>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MIcon name="chevron_left" size={28} color="white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MIcon name="chevron_right" size={28} color="white" />
          </button>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TRANSACTION DETAIL PANEL — full info + audit actions
   ═══════════════════════════════════════════════════════ */
function TransactionDetail({ tx, profile, onClose, onAction }) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const supportingUrls = tx.ocr_raw_data?.supporting_proof_urls || [];
  const proofLinks = tx.ocr_raw_data?.proof_links || [];
  const proofNote = tx.ocr_raw_data?.proof_note || "";
  const allImages = [tx.slip_image_url, ...supportingUrls].filter(Boolean);

  const canReview = tx.status === "pending" && (
    profile.role === "owner" ||
    (profile.role === "secretary" && tx.created_by !== profile.id)
  );

  const handleAction = async (action) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ transaction_id: tx.id, action, reject_reason: rejectReason }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      onAction(action, tx.id);
    } catch (err) {
      alert(err.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const InfoRow = ({ label, value, mono }) => value ? (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: T.text, fontWeight: 500, fontFamily: mono ? "monospace" : "inherit" }}>{value}</div>
    </div>
  ) : null;

  const statusColor = tx.status === "approved" ? T.success : tx.status === "rejected" ? T.danger : T.amber;
  const statusLabel = tx.status === "approved" ? "Approved" : tx.status === "rejected" ? "Rejected" : "Pending review";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(8,15,8,0.32)", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      {lightbox && <ImageLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <div style={{ width: "100%", maxWidth: 430, background: T.bg, borderRadius: "24px 24px 0 0", maxHeight: "94vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 14px", background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", color: T.text, fontSize: 15, fontWeight: 600 }}>
            <MIcon name="arrow_back" size={20} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Transaction detail</span>
          <div style={{ width: 48 }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "grid", gap: 14 }}>
          {/* Amount + status hero */}
          <div style={{ ...cardStyle, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: tx.type === "income" ? T.success : T.danger }}>
              {tx.type === "income" ? "Income" : "Expense"}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: T.text, marginTop: 6 }}>{fmtVND(tx.amount)}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 12px", borderRadius: 999, background: `${statusColor}15`, color: statusColor, fontSize: 12, fontWeight: 700 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />
              {statusLabel}
            </div>
          </div>

          {/* Info section */}
          <div style={{ ...cardStyle, padding: 18 }}>
            <InfoRow label="Description" value={tx.description} />
            <InfoRow label="Recipient" value={tx.recipient_name} />
            <InfoRow label="Bank" value={tx.bank_name} />
            <InfoRow label="Account number" value={tx.bank_account} mono />
            <InfoRow label="Transaction code" value={tx.transaction_code} mono />
            <InfoRow label="Date" value={fmtDate(tx.transaction_date)} />
            <InfoRow label="Submitted" value={`${fmtDate(tx.created_at)} ${fmtTime(tx.created_at)}`} />
            <InfoRow label="Submitted by" value={tx.profiles?.full_name || "—"} />
            <InfoRow label="Notes" value={tx.notes} />
            {tx.approved_by_profile && <InfoRow label="Approved by" value={tx.approved_by_profile.full_name} />}
            {tx.reviewed_by_profile && !tx.approved_by_profile && <InfoRow label="Reviewed by" value={tx.reviewed_by_profile.full_name} />}
            {tx.reviewed_at && <InfoRow label="Reviewed at" value={`${fmtDate(tx.reviewed_at)} ${fmtTime(tx.reviewed_at)}`} />}
            {tx.reject_reason && <InfoRow label="Reject reason" value={tx.reject_reason} />}
          </div>

          {/* Bank slip + supporting images */}
          {allImages.length > 0 && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 12 }}>Attachments</div>
              <div style={{ display: "grid", gridTemplateColumns: allImages.length === 1 ? "1fr" : "1fr 1fr", gap: 10 }}>
                {allImages.map((url, i) => (
                  <div key={i} onClick={() => setLightbox({ images: allImages, index: i })} style={{ cursor: "pointer", position: "relative" }}>
                    <img src={url} alt={i === 0 ? "Bank slip" : `Proof ${i}`} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 14, border: `1px solid ${T.border}` }} />
                    <div style={{ position: "absolute", bottom: 8, left: 8, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 10, fontWeight: 700 }}>
                      {i === 0 ? "Slip" : `Proof ${i}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof links */}
          {proofLinks.length > 0 && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 10 }}>Proof links</div>
              {proofLinks.map((link, i) => (
                <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 13, color: T.blue, marginBottom: 6, wordBreak: "break-all" }}>{link}</a>
              ))}
            </div>
          )}

          {/* Proof note */}
          {proofNote && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 6 }}>Proof note</div>
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5 }}>{proofNote}</div>
            </div>
          )}

          {/* Audit actions */}
          {canReview && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 14 }}>Audit</div>
              {!showRejectInput ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => handleAction("approve")} disabled={loading} style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: loading ? 0.6 : 1 }}>
                    {loading ? "..." : "Approve"}
                  </button>
                  <button onClick={() => setShowRejectInput(true)} disabled={loading} style={{ height: 46, borderRadius: 12, border: `1.5px solid ${T.danger}`, background: "white", color: T.danger, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
                    Reject
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Why is this transaction rejected? This note will be sent to the submitter."
                    style={{ width: "100%", minHeight: 80, borderRadius: 12, border: `1px solid ${T.border}`, padding: 14, fontSize: 14, boxSizing: "border-box", resize: "vertical" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={() => setShowRejectInput(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", color: T.text, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                      Cancel
                    </button>
                    <button onClick={() => handleAction("reject")} disabled={loading || !rejectReason.trim()} style={{ height: 46, borderRadius: 12, border: "none", background: T.danger, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: loading || !rejectReason.trim() ? 0.5 : 1 }}>
                      {loading ? "..." : "Confirm reject"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE — Transaction Ledger
   ═══════════════════════════════════════════════════════ */
export default function TransactionsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [detail, setDetail] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("transactions")
      .select("*, profiles!created_by(id, full_name, role), approved_by_profile:profiles!approved_by(id, full_name), reviewed_by_profile:profiles!reviewed_by(id, full_name)")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: false });

    setTransactions(data || []);
    setLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Realtime subscription for new/updated/deleted transactions
  useEffect(() => {
    const ch = supabase
      .channel("transactions-ledger")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchTransactions]);

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
  const totalIncome = useMemo(() => filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0), [filtered]);
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
        <div style={{ padding: "24px 18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Audit Ledger</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Transactions</div>
            </div>
            <button onClick={() => window.history.back()} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon name="arrow_back" size={20} color={T.text} />
            </button>
          </div>

          {/* Month/Year filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{ flex: 1, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ width: 90, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <MIcon name="search" size={18} color={T.textMuted} style={{ position: "absolute", left: 14, top: 12 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, paddingLeft: 40, paddingRight: 14, fontSize: 14, color: T.text, boxSizing: "border-box" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer" }}>
                <MIcon name="close" size={18} color={T.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ padding: "0 18px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.success, letterSpacing: "0.06em" }}>Income</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.success, marginTop: 4 }}>{fmtVND(totalIncome)}</div>
          </div>
          <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.danger, letterSpacing: "0.06em" }}>Expense</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.danger, marginTop: 4 }}>{fmtVND(totalExpense)}</div>
          </div>
          <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.amber, letterSpacing: "0.06em" }}>Pending</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.amber, marginTop: 4 }}>{pendingCount}</div>
          </div>
        </div>

        {/* Transaction list */}
        <div style={{ padding: "0 18px 100px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: 40, fontSize: 14 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: T.textMuted, padding: 40 }}>
              <MIcon name="receipt_long" size={40} color={T.border} />
              <div style={{ marginTop: 12, fontSize: 14 }}>No transactions found</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {filtered.map((tx) => {
                const isIncome = tx.type === "income";
                const statusColor = tx.status === "approved" ? T.success : tx.status === "pending" ? T.amber : T.danger;
                return (
                  <button
                    key={tx.id}
                    onClick={() => setDetail(tx)}
                    style={{ ...cardStyle, padding: 14, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    {/* Icon */}
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: isIncome ? "#ecfdf3" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <MIcon name={isIncome ? "trending_up" : "trending_down"} size={20} color={isIncome ? T.success : T.danger} />
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                          {tx.description || tx.recipient_name || (isIncome ? "Income" : "Expense")}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isIncome ? T.success : T.text, flexShrink: 0 }}>
                          {isIncome ? "+" : "−"}{fmtVND(tx.amount)}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {tx.profiles?.full_name || "—"} · {fmtDate(tx.transaction_date || tx.created_at)}
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: `${statusColor}15`, color: statusColor, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                          {tx.status}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
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

"use client";

import { useState } from "react";
import { MIcon } from "./StaffShell";
import ImageLightbox from "./ImageLightbox";
import { supabase } from "../../lib/supabase";
import { fmtAmountVND as fmtVND, fmtDateEN as fmtDate, fmtTime } from "../../lib/format";

/* ─── design tokens (match app-wide palette) ─── */
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

/**
 * Full-screen transaction detail panel with audit actions.
 * Shared across /transactions (ledger page) and secretary → Transactions tab.
 *
 * Props:
 *   tx         — transaction row (with joined profiles)
 *   profile    — current user's profile { id, role, full_name }
 *   onClose    — close the detail overlay
 *   onAction   — callback(action, txId) after approve/reject succeeds
 */
export default function TransactionDetail({ tx, profile, onClose, onAction }) {
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
      if (!res.ok) throw new Error(result.error || "Action failed");
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
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: tx.type === "adjustment" ? (tx.adjustment_direction === "increase" ? T.success : T.danger) : tx.type === "income" ? T.success : T.danger }}>
              {tx.type === "adjustment" ? `Adjustment · ${tx.adjustment_direction === "increase" ? "Increase" : "Decrease"}` : tx.type === "income" ? "Income" : "Expense"}
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

"use client";

import { T } from "../../lib/tokens";

const LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  waiting: "Waiting",
  tracking: "Tracking",
  registered: "Registered",
  bidding: "Bidding",
  won: "Won",
  lost: "Lost",
  paid: "Paid",
  shipping: "Shipping",
  received: "Received",
  reported: "Reported",
  active: "Active",
  matured: "Matured",
  closed: "Closed",
};

const BADGE_STYLES = {
  pending: { bg: "#f1f5f9", color: "#64748b" },
  approved: { bg: "#f0fdf4", color: "#22c55e" },
  rejected: { bg: "#fef2f2", color: "#ef4444" },
  in_progress: { bg: T.primary, color: "#fff" },
  done: { bg: "#dcfce7", color: "#16a34a" },
  cancelled: { bg: "#f1f5f9", color: "#94a3b8" },
  scheduled: { bg: `${T.primary}18`, color: T.primary },
  waiting: { bg: "#f1f5f9", color: "#64748b" },
};

export default function StatusBadge({ status, style = {} }) {
  const s = BADGE_STYLES[status] || BADGE_STYLES.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 4,
      backgroundColor: s.bg, color: s.color,
      whiteSpace: "nowrap",
      ...style,
    }}>
      {LABELS[status] || status}
    </span>
  );
}

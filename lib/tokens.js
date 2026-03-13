// ZenHome Design Tokens — shared across all screens
export const T = {
  primary: "#56c91d",
  primaryDark: "#43a516",
  primaryBg: "#56c91d10",
  primaryBg2: "#56c91d18",
  bg: "#f6f8f6",
  card: "#ffffff",
  border: "#e2e8e2",
  borderLight: "#56c91d0d",
  text: "#1a2e1a",
  textSec: "#4a5544",
  textMuted: "#94a3b8",
  textLabel: "#94a3b8",
  white: "#fff",
  danger: "#ef4444",
  dangerBg: "#fef2f2",
  orange: "#f97316",
  orangeBg: "#fff7ed",
  blue: "#3b82f6",
  blueBg: "#eff6ff",
  purple: "#8b5cf6",
  purpleBg: "#f5f3ff",
  green: "#22c55e",
  greenBg: "#f0fdf4",
  shadow: "0 1px 3px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.06)",
  font: "'Manrope', 'Inter', -apple-system, sans-serif",
};

// Shared styles
export const card = {
  backgroundColor: T.card,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 12,
  padding: 20,
  boxShadow: T.shadow,
};

export const cardCompact = {
  ...card,
  padding: 16,
};

export const sectionLabel = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: T.textLabel,
  marginBottom: 16,
};

export const flexBetween = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export const flexCenter = {
  display: "flex",
  alignItems: "center",
};

// Status badge colors
export const STATUS_COLORS = {
  pending: { bg: "#f1f5f9", color: T.textMuted },
  approved: { bg: T.greenBg, color: T.green },
  rejected: { bg: T.dangerBg, color: T.danger },
  in_progress: { bg: T.primaryBg, color: T.primary },
  done: { bg: "#dcfce7", color: "#16a34a" },
  cancelled: { bg: "#f1f5f9", color: T.textMuted },
  scheduled: { bg: T.blueBg, color: T.blue },
  waiting: { bg: T.orangeBg, color: T.orange },
};

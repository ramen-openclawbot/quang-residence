"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/* ═══════════════════════════════════════════
   DESIGN TOKENS — ZenHome
   ═══════════════════════════════════════════ */
const T = {
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
  orange: "#f97316",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  shadow: "0 1px 3px rgba(0,0,0,0.04)",
};

/* ═══════════════════════════════════════════
   ICON COMPONENTS
   ═══════════════════════════════════════════ */
const Icon = ({ children, size = 24, color = "currentColor", filled = false, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={filled ? "none" : color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
);

const HomeIcon = (p) => <Icon {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
const WalletIcon = (p) => <Icon {...p}><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a1 1 0 100 2 1 1 0 000-2z" /></Icon>;
const LeafIcon = (p) => <Icon {...p}><path d="M11 20A7 7 0 019.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></Icon>;
const CalendarIcon = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon>;
const BellIcon = (p) => <Icon {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></Icon>;
const CameraIcon = (p) => <Icon {...p}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></Icon>;
const LightIcon = (p) => <Icon {...p}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2v1" /><path d="M4.93 4.93l.7.7" /><path d="M2 12h1" /><path d="M20 12h1" /><path d="M19.07 4.93l-.7.7" /><path d="M15.54 8.46A5 5 0 008.46 15.54" /><circle cx="12" cy="12" r="5" /></Icon>;
const ShieldIcon = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>;
const CarIcon = (p) => <Icon {...p}><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2" /><circle cx="6.5" cy="16.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></Icon>;
const PlaneIcon = (p) => <Icon {...p}><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></Icon>;
const FileIcon = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></Icon>;
const MapIcon = (p) => <Icon {...p}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></Icon>;
const EditIcon = (p) => <Icon {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></Icon>;
const ShoppingIcon = (p) => <Icon {...p}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></Icon>;
const ZapIcon = (p) => <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>;
const WifiIcon = (p) => <Icon {...p}><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></Icon>;
const SunIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></Icon>;
const MoonIcon = (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></Icon>;
const TrendUpIcon = (p) => <Icon {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Icon>;
const DropIcon = (p) => <Icon {...p}><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></Icon>;
const CheckCircle = (p) => <Icon {...p} filled><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></Icon>;
const PlayIcon = (p) => <Icon {...p} filled><path d="M8 5v14l11-7z" /></Icon>;
const WindIcon = (p) => <Icon {...p}><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" /></Icon>;

/* ═══════════════════════════════════════════
   ICON MAP
   ═══════════════════════════════════════════ */
const ICON_MAP = {
  shopping: ShoppingIcon,
  zap: ZapIcon,
  wifi: WifiIcon,
  plane: PlaneIcon,
  car: CarIcon,
  map: MapIcon,
  edit: EditIcon,
  file: FileIcon,
};

const getIcon = (name) => ICON_MAP[name] || FileIcon;

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
const fmt = (n) =>
  Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  });

const card = {
  backgroundColor: T.card,
  border: `1px solid ${T.borderLight}`,
  borderRadius: 12,
  padding: 20,
  boxShadow: T.shadow,
};
const sectionLabel = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: T.textLabel,
  marginBottom: 16,
};
const flexBetween = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const flexCenter = { display: "flex", alignItems: "center" };

/* ═══════════════════════════════════════════
   LOADING SKELETON
   ═══════════════════════════════════════════ */
const Skeleton = ({ width = "100%", height = 16, radius = 8 }) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius,
      background: "linear-gradient(90deg, #f0f4f0 25%, #e8ede8 50%, #f0f4f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }}
  />
);

/* ═══════════════════════════════════════════
   HOME SCREEN
   ═══════════════════════════════════════════ */
const HomeScreen = ({ onNav, spendingItems, agendaTasks, loading }) => {
  const driverTask = agendaTasks.find((t) => t.category === "driver");
  const secTask = agendaTasks.find((t) => t.category === "secretary");

  const totalSpend = spendingItems.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div style={{ padding: "0 24px", paddingBottom: 40 }}>
      {/* Wealth Summary */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ ...flexBetween, marginBottom: 16 }}>
          <div style={sectionLabel}>Wealth</div>
          <span
            onClick={() => onNav("wealth")}
            style={{ fontSize: 13, color: T.primary, fontWeight: 600, cursor: "pointer" }}
          >
            View Report
          </span>
        </div>
        <div style={card}>
          <div style={{ ...flexCenter, gap: 8, marginBottom: 16 }}>
            {loading ? (
              <Skeleton width={120} height={36} />
            ) : (
              <>
                <span style={{ fontSize: 32, fontWeight: 300, color: T.text }}>{fmt(totalSpend)}</span>
                <span style={{ fontSize: 14, color: T.textMuted }}>this month</span>
              </>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...flexBetween, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: T.textMuted }}>Investments</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>$2,500</span>
            </div>
            <div style={{ height: 4, backgroundColor: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "58%", backgroundColor: T.primary, borderRadius: 99 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.textLabel, marginBottom: 4 }}>
                Groceries
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                {loading ? <Skeleton width={60} height={14} /> : fmt(spendingItems.find((i) => i.name === "Groceries")?.amount || 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.textLabel, marginBottom: 4 }}>
                Utilities
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                {loading ? <Skeleton width={60} height={14} /> : fmt(spendingItems.find((i) => i.name === "Bill Payments")?.amount || 0)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ambiance */}
      <section style={{ marginBottom: 32 }}>
        <div style={sectionLabel}>Ambiance</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div onClick={() => onNav("ambiance")} style={{ ...card, cursor: "pointer", padding: 16 }}>
            <div style={{ ...flexBetween, marginBottom: 12 }}>
              <CameraIcon size={22} color={T.primary} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: T.primary }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Security</div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", marginTop: 2 }}>4 Cameras Active</div>
          </div>
          <div onClick={() => onNav("ambiance")} style={{ ...card, cursor: "pointer", padding: 16 }}>
            <div style={{ ...flexBetween, marginBottom: 12 }}>
              <LightIcon size={22} color={T.primary} />
              <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, padding: "2px 8px", backgroundColor: T.primaryBg, borderRadius: 99 }}>
                60%
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Lighting</div>
            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", marginTop: 2 }}>Soft Warm Preset</div>
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section>
        <div style={sectionLabel}>Agenda</div>
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 16 }}>
              <Skeleton height={40} />
            </div>
          ) : (
            [
              driverTask && { type: "Driver", task: driverTask.title + " at " + driverTask.time, time: driverTask.duration + " left", Ic: CarIcon },
              secTask && { type: "Secretary", task: secTask.title, time: secTask.time, Ic: FileIcon },
            ]
              .filter(Boolean)
              .map((item, i, arr) => (
                <div
                  key={i}
                  onClick={() => onNav("agenda")}
                  style={{ ...flexCenter, gap: 16, padding: 16, cursor: "pointer", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <item.Ic size={20} color={T.textMuted} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: T.textLabel }}>{item.type}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginTop: 2 }}>{item.task}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{item.time}</div>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════
   WEALTH SCREEN
   ═══════════════════════════════════════════ */
const WealthScreen = ({ monthlyData, spendingItems, investments, loading }) => {
  const [period, setPeriod] = useState("month");

  const maxSpend = Math.max(...monthlyData.map((d) => d.spend), 1);
  const maxBudget = Math.max(...monthlyData.map((d) => d.budget), 1);
  const maxVal = Math.max(maxSpend, maxBudget);

  const totalSpend = spendingItems.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div style={{ padding: "0 24px", paddingBottom: 40 }}>
      {/* Period Toggle */}
      <div style={{ display: "flex", height: 44, backgroundColor: T.primaryBg, borderRadius: 12, padding: 4, border: `1px solid ${T.primaryBg2}`, marginBottom: 32 }}>
        {["month", "year"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{ flex: 1, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, backgroundColor: period === p ? T.card : "transparent", color: T.textSec, boxShadow: period === p ? T.shadow : "none", textTransform: "capitalize" }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Net Worth */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 4 }}>
          Total Net Worth
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: T.text, letterSpacing: "-0.02em", marginBottom: 8 }}>$1,240,500.00</div>
        <div style={{ ...flexCenter, justifyContent: "center", gap: 6, color: T.primary }}>
          <TrendUpIcon size={14} color={T.primary} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>+2.4% vs last month</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ ...card, marginBottom: 32, padding: 24 }}>
        <div style={{ ...flexBetween, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Spending vs Budget</div>
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: T.textMuted }}>Last 6 Months</span>
        </div>
        {loading ? (
          <Skeleton height={128} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 128, gap: 8 }}>
              {monthlyData.map((d, i) => {
                const h = Math.round((d.spend / maxVal) * 100);
                const fill = Math.round((d.spend / d.budget) * 100);
                return (
                  <div key={i} style={{ flex: 1, backgroundColor: T.primaryBg2, borderRadius: "6px 6px 0 0", height: `${h}%`, position: "relative" }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.min(fill, 100)}%`, backgroundColor: i === 3 ? T.primary : T.primary + "66", borderRadius: "6px 6px 0 0" }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "0 2px" }}>
              {monthlyData.map((d, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted + "66" }}>
                  {d.month}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Spending Breakdown */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...flexBetween, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Spending Breakdown</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.primary, cursor: "pointer" }}>View All</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading
            ? [1, 2, 3, 4].map((i) => <Skeleton key={i} height={72} radius={12} />)
            : spendingItems.map((item, i) => {
                const Ic = getIcon(item.icon_name);
                return (
                  <div key={i} style={{ ...flexBetween, ...card, padding: 16 }}>
                    <div style={{ ...flexCenter, gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: item.bg_color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Ic size={20} color={item.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{item.description}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>-{fmt(item.amount)}</div>
                  </div>
                );
              })}
        </div>
      </div>

      {/* Investments */}
      <div>
        <div style={{ ...flexBetween, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Small Investments</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.primary, cursor: "pointer" }}>Manage Assets</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {loading
            ? [1, 2].map((i) => <Skeleton key={i} height={160} radius={12} />)
            : investments.map((inv, i) => (
                <div key={i} style={{ ...card, padding: 16 }}>
                  <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, marginBottom: 12, background: `linear-gradient(135deg, ${inv.color}22, ${inv.color}44)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShoppingIcon size={32} color={inv.color} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{inv.name}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, marginBottom: 8 }}>{inv.date_acquired}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.primary }}>{inv.price}</div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AMBIANCE SCREEN
   ═══════════════════════════════════════════ */
const AmbianceScreen = ({ homeSettings, onSettingUpdate }) => {
  const lighting = homeSettings.lighting || { brightness: 80, preset: "warm" };
  const climate = homeSettings.climate || { current_temp: 24, target_temp: 22.5, humidity: 45 };
  const airPurifier = homeSettings.air_purifier || { on: true };
  const smartBlinds = homeSettings.smart_blinds || { on: false };

  const [brightness, setBrightness] = useState(lighting.brightness);
  const [preset, setPreset] = useState(lighting.preset);
  const [purifier, setPurifier] = useState(airPurifier.on);
  const [blinds, setBlinds] = useState(smartBlinds.on);

  const handleBrightnessChange = async (val) => {
    setBrightness(val);
    await supabase.from("home_settings").update({ setting_value: JSON.stringify({ brightness: val, preset }) }).eq("setting_key", "lighting");
  };

  const handlePresetChange = async (val) => {
    setPreset(val);
    await supabase.from("home_settings").update({ setting_value: JSON.stringify({ brightness, preset: val }) }).eq("setting_key", "lighting");
  };

  const handleToggle = async (device, current, setter, key) => {
    setter(!current);
    await supabase.from("home_settings").update({ setting_value: JSON.stringify({ on: !current }) }).eq("setting_key", key);
  };

  return (
    <div style={{ padding: "0 24px", paddingBottom: 40 }}>
      {/* Security */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ ...flexBetween, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Security</div>
          <span style={{ ...flexCenter, gap: 6, fontSize: 14, fontWeight: 500, color: T.primary }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: T.primary, display: "inline-block" }} /> Live
          </span>
        </div>
        <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", backgroundColor: "#2a3a2d", border: `1px solid ${T.borderLight}`, marginBottom: 16 }}>
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #3a5a3d 0%, #1a2e1a 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}>
              <PlayIcon size={28} color="white" />
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 12, backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", padding: "4px 12px", borderRadius: 99 }}>
            <span style={{ fontSize: 10, color: "white", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Living Room Camera</span>
          </div>
        </div>
        <div style={{ ...flexBetween, ...card, padding: 16 }}>
          <div style={{ ...flexCenter, gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: T.primaryBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldIcon size={20} color={T.primary} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>4 Cameras Active</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>System armed & secured</div>
            </div>
          </div>
          <CheckCircle size={22} color={T.primary} />
        </div>
      </section>

      {/* Lighting */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 16 }}>Lighting</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[
            { id: "warm", label: "Soft Warm", Ic: SunIcon },
            { id: "natural", label: "Natural", Ic: LightIcon },
            { id: "dim", label: "Dim", Ic: MoonIcon },
          ].map((p) => (
            <button key={p.id} onClick={() => handlePresetChange(p.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, border: preset === p.id ? "none" : `1px solid ${T.primaryBg2}`, cursor: "pointer", backgroundColor: preset === p.id ? T.primary : T.card, color: preset === p.id ? T.white : T.textSec, boxShadow: preset === p.id ? `0 4px 12px ${T.primary}33` : "none" }}>
              <p.Ic size={22} color={preset === p.id ? "white" : T.textMuted} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>{p.label}</span>
            </button>
          ))}
        </div>
        <div style={{ ...card, padding: 20 }}>
          <div style={{ ...flexBetween, marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Brightness</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>{brightness}%</span>
          </div>
          <div style={{ position: "relative", width: "100%", height: 6, backgroundColor: "#e2e8f0", borderRadius: 99 }}>
            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${brightness}%`, backgroundColor: T.primary, borderRadius: 99 }} />
            <input type="range" min="0" max="100" value={brightness} onChange={(e) => handleBrightnessChange(+e.target.value)}
              style={{ position: "absolute", top: -8, left: 0, width: "100%", height: 22, opacity: 0, cursor: "pointer" }} />
            <div style={{ position: "absolute", top: "50%", left: `${brightness}%`, transform: "translate(-50%, -50%)", width: 20, height: 20, borderRadius: "50%", backgroundColor: T.white, border: `2px solid ${T.primary}`, boxShadow: T.shadow, pointerEvents: "none" }} />
          </div>
        </div>
      </section>

      {/* Climate */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 16 }}>Climate</div>
        <div style={{ ...card, ...flexBetween, padding: 24, borderRadius: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 4 }}>Current</div>
            <div style={{ fontSize: 40, fontWeight: 300, color: T.text }}>
              {climate.current_temp}<span style={{ color: T.primary }}>°C</span>
            </div>
            <div style={{ ...flexCenter, gap: 4, fontSize: 12, color: T.textMuted, marginTop: 8 }}>
              <DropIcon size={12} color={T.textMuted} /> {climate.humidity}% Humidity
            </div>
          </div>
          <div style={{ position: "relative", width: 112, height: 112 }}>
            <svg width="112" height="112" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
              <circle cx="50" cy="50" r="40" fill="transparent" stroke={T.primary} strokeWidth="6" strokeDasharray="251.2" strokeDashoffset="180" strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{climate.target_temp}</span>
              <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.05em", color: T.textMuted }}>Target</span>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Devices */}
      <section>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 16 }}>Smart Devices</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { name: "Air Purifier", desc: "Auto Mode", on: purifier, toggle: () => handleToggle("air_purifier", purifier, setPurifier, "air_purifier"), color: "#3b82f6", bg: "#eff6ff", Ic: WindIcon },
            { name: "Smart Blinds", desc: "Closed", on: blinds, toggle: () => handleToggle("smart_blinds", blinds, setBlinds, "smart_blinds"), color: "#f97316", bg: "#fff7ed", Ic: LightIcon },
          ].map((d, i) => (
            <div key={i} style={{ ...card, ...flexCenter, gap: 12, padding: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: d.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <d.Ic size={20} color={d.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{d.name}</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{d.desc}</div>
              </div>
              <button onClick={d.toggle} style={{ width: 32, height: 16, borderRadius: 99, position: "relative", border: "none", cursor: "pointer", backgroundColor: d.on ? T.primary : "#e2e8f0" }}>
                <span style={{ position: "absolute", top: 2, width: 12, height: 12, borderRadius: "50%", backgroundColor: T.white, transition: "left 0.2s", left: d.on ? 18 : 2 }} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AGENDA SCREEN
   ═══════════════════════════════════════════ */
const AgendaScreen = ({ agendaTasks, loading, onStatusUpdate }) => {
  const statusStyle = {
    scheduled: { bg: T.primaryBg, color: T.primary },
    waiting: { bg: "#f1f5f9", color: T.textMuted },
    "in-progress": { bg: T.primary, color: T.white },
    pending: { bg: "#f1f5f9", color: T.textMuted },
    done: { bg: "#dcfce7", color: "#16a34a" },
  };

  const driverTasks = agendaTasks.filter((t) => t.category === "driver");
  const secTasks = agendaTasks.filter((t) => t.category === "secretary");

  const today = new Date();
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + 1 + i);
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      num: d.getDate(),
      active: d.toDateString() === today.toDateString(),
    };
  });

  const handleStatusChange = async (id, newStatus) => {
    await supabase.from("agenda_tasks").update({ status: newStatus }).eq("id", id);
    onStatusUpdate(id, newStatus);
  };

  const renderTask = (task) => {
    const st = statusStyle[task.status] || statusStyle.pending;
    const Ic = getIcon(task.icon_name);
    return (
      <div key={task.id} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 48, flexShrink: 0, paddingTop: 4, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{task.time}</div>
          <div style={{ fontSize: 10, color: T.textMuted }}>{task.duration}</div>
        </div>
        <div style={{ flex: 1, ...card, padding: 16 }}>
          <div style={{ ...flexBetween, marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: T.text }}>{task.title}</div>
            <Ic size={18} color={T.primary} />
          </div>
          <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>{task.location}</div>
          <div style={{ ...flexBetween }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 4, backgroundColor: st.bg, color: st.color }}>
              {task.status.replace("-", " ")}
            </span>
            {task.status !== "done" && (
              <button onClick={() => handleStatusChange(task.id, "done")} style={{ fontSize: 10, fontWeight: 600, color: T.primary, border: `1px solid ${T.primaryBg2}`, backgroundColor: T.primaryBg, padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>
                Mark Done
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "0 24px", paddingBottom: 40 }}>
      {/* Date Header */}
      <div style={{ ...flexBetween, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, fontWeight: 600 }}>
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: T.text, marginTop: 4 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric" })}
          </div>
        </div>
        <span style={{ ...flexCenter, gap: 4, fontSize: 14, fontWeight: 500, color: T.primary, cursor: "pointer" }}>
          <CalendarIcon size={14} color={T.primary} /> Month View
        </span>
      </div>

      {/* Week Strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "space-between" }}>
        {weekDays.map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 48, padding: "12px 0", borderRadius: 12, border: d.active ? "none" : `1px solid ${T.border}`, backgroundColor: d.active ? T.primary : "transparent", color: d.active ? T.white : T.text, boxShadow: d.active ? `0 4px 12px ${T.primary}33` : "none" }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: d.active ? "rgba(255,255,255,0.7)" : T.textMuted, marginBottom: 4 }}>{d.day}</span>
            <span style={{ fontSize: 14, fontWeight: d.active ? 700 : 500 }}>{d.num}</span>
          </div>
        ))}
      </div>

      {/* Driver Section */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ ...flexCenter, gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 1, backgroundColor: T.primary + "66" }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: T.textLabel }}>Driver</span>
        </div>
        {loading ? <Skeleton height={80} radius={12} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {driverTasks.length > 0 ? driverTasks.map(renderTask) : (
              <div style={{ ...card, padding: 16, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No driver tasks today</div>
            )}
          </div>
        )}
      </section>

      {/* Secretary Section */}
      <section>
        <div style={{ ...flexCenter, gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 1, backgroundColor: T.primary + "66" }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", color: T.textLabel }}>Secretary</span>
        </div>
        {loading ? <Skeleton height={80} radius={12} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {secTasks.length > 0 ? secTasks.map(renderTask) : (
              <div style={{ ...card, padding: 16, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No secretary tasks today</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
const TABS = [
  { id: "home", label: "ZenHome", Ic: HomeIcon },
  { id: "wealth", label: "Wealth", Ic: WalletIcon },
  { id: "ambiance", label: "Ambiance", Ic: LeafIcon },
  { id: "agenda", label: "Agenda", Ic: CalendarIcon },
];

export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);

  // Data state
  const [monthlyData, setMonthlyData] = useState([]);
  const [spendingItems, setSpendingItems] = useState([]);
  const [agendaTasks, setAgendaTasks] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [homeSettings, setHomeSettings] = useState({});

  // Fetch all data from Supabase
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [monthly, spending, agenda, invest, settings] = await Promise.all([
          supabase.from("monthly_data").select("*").order("id"),
          supabase.from("spending_items").select("*").order("sort_order"),
          supabase.from("agenda_tasks").select("*").order("time"),
          supabase.from("investments").select("*").order("id"),
          supabase.from("home_settings").select("*"),
        ]);

        if (monthly.data) setMonthlyData(monthly.data);
        if (spending.data) setSpendingItems(spending.data);
        if (agenda.data) setAgendaTasks(agenda.data);
        if (invest.data) setInvestments(invest.data);
        if (settings.data) {
          const map = {};
          settings.data.forEach((s) => {
            map[s.setting_key] = typeof s.setting_value === "string" ? JSON.parse(s.setting_value) : s.setting_value;
          });
          setHomeSettings(map);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleStatusUpdate = (id, newStatus) => {
    setAgendaTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  };

  const screenTitle = { home: null, wealth: "Wealth Analytics", ambiance: "Ambiance", agenda: null };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ minHeight: "100vh", backgroundColor: T.bg, fontFamily: "'Manrope', 'Inter', -apple-system, sans-serif", maxWidth: 430, margin: "0 auto", position: "relative", boxShadow: "0 0 60px rgba(0,0,0,0.08)" }}>

        {/* Header */}
        {tab === "home" ? (
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "32px 24px 24px" }}>
            <div style={{ ...flexCenter, gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: T.primaryBg, border: `1px solid ${T.primaryBg2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: T.primary }}>Q</div>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, fontWeight: 600 }}>Welcome back</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>Mr. Quang</div>
              </div>
            </div>
            <button style={{ width: 40, height: 40, borderRadius: "50%", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BellIcon size={22} color={T.text} />
            </button>
          </header>
        ) : tab === "agenda" ? (
          <header style={{ padding: "32px 24px 16px" }}>
            <div style={{ ...flexBetween }}>
              <div style={{ fontSize: 24, fontWeight: 300, textTransform: "uppercase", letterSpacing: "-0.01em", color: T.text }}>Agenda</div>
              <div style={{ position: "relative" }}>
                <BellIcon size={22} color={T.textSec} />
                <span style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderRadius: "50%", backgroundColor: T.primary }} />
              </div>
            </div>
          </header>
        ) : (
          <header style={{ ...flexBetween, padding: "24px 24px 16px" }}>
            <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: T.card, border: `1px solid ${T.primaryBg2}`, boxShadow: T.shadow, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{screenTitle[tab]}</div>
            <button style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: T.card, border: `1px solid ${T.primaryBg2}`, boxShadow: T.shadow, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <BellIcon size={18} color={T.text} />
            </button>
          </header>
        )}

        {/* Content */}
        <main style={{ paddingBottom: 80 }}>
          {tab === "home" && (
            <HomeScreen onNav={setTab} spendingItems={spendingItems} agendaTasks={agendaTasks} loading={loading} />
          )}
          {tab === "wealth" && (
            <WealthScreen monthlyData={monthlyData} spendingItems={spendingItems} investments={investments} loading={loading} />
          )}
          {tab === "ambiance" && (
            <AmbianceScreen homeSettings={homeSettings} onSettingUpdate={setHomeSettings} />
          )}
          {tab === "agenda" && (
            <AgendaScreen agendaTasks={agendaTasks} loading={loading} onStatusUpdate={handleStatusUpdate} />
          )}
        </main>

        {/* Bottom Nav */}
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderTop: `1px solid ${T.border}`, padding: "12px 24px 24px", zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, border: "none", backgroundColor: "transparent", cursor: "pointer", padding: 0 }}>
                  <t.Ic size={22} color={active ? T.primary : T.textMuted} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? T.primary : T.textMuted }}>{t.label}</span>
                  {active && <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: T.primary, marginTop: 2 }} />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}

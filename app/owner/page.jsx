"use client";

import { useState, useEffect } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { T, card, flexBetween, sectionLabel } from "../../lib/tokens";

const NAV_TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "wealth", label: "Wealth", icon: "account_balance_wallet" },
  { id: "ambiance", label: "Ambiance", icon: "nest_eco_leaf" },
  { id: "agenda", label: "Agenda", icon: "calendar_today" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function OwnerPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");

  const handleLogout = async () => { await signOut(); window.location.href = "/login"; };

  return (
    <StaffShell role="owner">
      <div style={{ maxWidth: 430, margin: "0 auto" }}>

        {/* ════════ TAB 1: HOME ════════ */}
        {tab === "home" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 24px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.primary}10`, border: `1px solid ${T.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGmyE-3dyCKlh1adLXn5e7UyrjgO0tWTGCQw8KwLk04d7PRw4Tu9icxPfldEkoJpRhFcOFo0-6440ii_mDApyGKxmwAydSCc05m4_5AKySSrhSld4Yi2irzKZtqSicvfb9rUgXp7V9uxQ70m_h-CsxDtliMhBf21QQUjUB2TPRstzXiPn95d57BGvGhaZ0ajorIrJ95FEPLkDSzPO-o5JsHz00un61VjYOwYAx_p9iUAtRohSJ1ABB-eXFnNEiQYEWQiK3nWmQnw" alt="Mr. Quang" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: T.textMuted, fontWeight: 600 }}>Welcome back</p>
                <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: T.text, margin: 0 }}>Mr. Quang</h1>
              </div>
            </div>
            <button style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <MIcon name="notifications" size={24} color={T.text} />
            </button>
          </header>

          <main style={{ padding: "0 24px 120px", display: "flex", flexDirection: "column", gap: 32 }}>
            {/* WEALTH */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted }}>Wealth</h2>
                <span style={{ fontSize: 12, color: T.primary, fontWeight: 500, cursor: "pointer" }}>View Report</span>
              </div>
              <div style={{ ...card, padding: 20, background: "#fff", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 30, fontWeight: 300, color: T.text }}>$4,250</span>
                  <span style={{ fontSize: 14, color: T.textMuted }}>this month</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: T.textMuted }}>Investments</span>
                      <span style={{ fontWeight: 600 }}>$2,500</span>
                    </div>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: T.primary, borderRadius: 99, width: "58%" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>Groceries</p>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>$800</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>Utilities</p>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>$950</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* AMBIANCE */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 16 }}>Ambiance</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <MIcon name="videocam" size={24} color={T.primary} />
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>Security</p>
                    <p style={{ fontSize: 10, textTransform: "uppercase", color: T.textMuted, margin: 0 }}>4 Cameras Active</p>
                  </div>
                </div>
                <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <MIcon name="light_group" size={24} color={T.primary} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, padding: "2px 8px", background: `${T.primary}10`, borderRadius: 99 }}>60%</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>Lighting</p>
                    <p style={{ fontSize: 10, textTransform: "uppercase", color: T.textMuted, margin: 0 }}>Soft Warm Preset</p>
                  </div>
                </div>
              </div>
            </section>

            {/* AGENDA */}
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 16 }}>Agenda</h2>
              <div style={{ ...card, padding: 0, overflow: "hidden", background: "#fff", borderRadius: 12 }}>
                <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MIcon name="directions_car" size={20} color={T.textMuted} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: T.textMuted, margin: 0 }}>Driver</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: T.text, margin: 0 }}>Airport Transfer at 14:00</p>
                  </div>
                  <span style={{ fontSize: 10, color: T.textMuted }}>2h left</span>
                </div>
                <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MIcon name="article" size={20} color={T.textMuted} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: T.textMuted, margin: 0 }}>Secretary</p>
                    <p style={{ fontSize: 14, fontWeight: 500, color: T.text, margin: 0 }}>Sign Q4 budget report</p>
                  </div>
                  <span style={{ fontSize: 10, color: T.textMuted }}>16:30</span>
                </div>
              </div>
            </section>
          </main>
        </>)}

        {/* ════════ TAB 2: WEALTH ════════ */}
        {tab === "wealth" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 16px" }}>
            <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <MIcon name="arrow_back" size={20} color={T.text} />
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Wealth Analytics</h1>
            <button style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <MIcon name="search" size={20} color={T.text} />
            </button>
          </header>

          <main style={{ padding: "0 24px 120px", display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Month/Year Toggle */}
            <div style={{ display: "flex", height: 48, background: `${T.primary}08`, borderRadius: 12, padding: 4, border: `1px solid ${T.primary}10` }}>
              <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <input type="radio" defaultChecked style={{ display: "none" }} />
                <span>Month</span>
              </label>
              <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: 14, color: T.textMuted, cursor: "pointer" }}>
                <input type="radio" style={{ display: "none" }} />
                <span>Year</span>
              </label>
            </div>

            {/* Total Net Worth */}
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 8 }}>Total Net Worth</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: T.text, margin: "0 0 8px" }}>$1,240,500.00</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: T.primary }}>
                <MIcon name="trending_up" size={16} color={T.primary} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>+2.4% vs last month</span>
              </div>
            </div>

            {/* Spending vs Budget Chart */}
            <div style={{ ...card, padding: 24, background: "#fff", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>Spending vs Budget</h3>
                <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", color: T.textMuted }}>Last 6 Months</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 128, gap: 8 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: "66%", background: `${T.primary}28`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>Jan</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: "75%", background: `${T.primary}28`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>Feb</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: "50%", background: `${T.primary}28`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>Mar</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: "83%", background: T.primary, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>Apr</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: "66%", background: `${T.primary}28`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>May</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: "50%", background: `${T.primary}28`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: 9, color: T.textMuted }}>Jun</span>
                </div>
              </div>
            </div>

            {/* Spending Breakdown */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>Spending Breakdown</h3>
                <a style={{ fontSize: 14, fontWeight: 700, color: T.primary, cursor: "pointer", textDecoration: "none" }}>View All</a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "shopping_basket", label: "Groceries", sub: "Weekly Restock", amount: "-$1,240.00", bg: "#fed7aa" },
                  { icon: "bolt", label: "Bill Payments", sub: "Electricity & Water", amount: "-$450.20", bg: "#bfdbfe" },
                  { icon: "subscriptions", label: "Online Subscriptions", sub: "Netflix, Spotify, iCloud", amount: "-$89.99", bg: "#e9d5ff" },
                  { icon: "flight", label: "Travel", sub: "Weekend Retreat", amount: "-$2,800.00", bg: "#dcfce7" }
                ].map((item, i) => (
                  <div key={i} style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <MIcon name={item.icon} size={20} color={T.text} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>{item.label}</p>
                        <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{item.sub}</p>
                      </div>
                    </div>
                    <p style={{ fontWeight: 700, color: T.text, margin: 0 }}>{item.amount}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Small Investments */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>Small Investments</h3>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.primary, cursor: "pointer" }}>Manage Assets</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", flexDirection: "column" }}>
                  <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, marginBottom: 12, overflow: "hidden", background: "#f0f0f0" }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBy24kIoNlgftW32XJ44AxDJNfC86HHull45VzX0kKykjDAXMLOcBcKlzC_QFNluaqczxApt3fGgfpPkbMCcuNL3LBdTH6ZE0P-dB65rTjuUM7eALqa9GFa9_PbuvKhsZPRW0B4jaEbfUJ0lNO3oHtadi78jtxMEjqFkmQW6PMZsiRQ_2rI8mAous6u1_1__fuDpaNOHsrHAO-QYIzHzDwvMjF7wpqWLlbLSlCWWzLqUEA6vQjDQlU3ZoPhRCh_4Um50_iRT1Aj3A" alt="Original Painting" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>Original Painting</p>
                  <p style={{ fontSize: 10, color: T.textMuted, margin: "0 0 8px" }}>Acquired: Jan 2024</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: T.primary, margin: 0 }}>$12,500</p>
                </div>
                <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", flexDirection: "column" }}>
                  <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, marginBottom: 12, overflow: "hidden", background: "#f0f0f0" }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC99C79_6learAJ3V0xtqQMIkNiYiCdgg8FJaqLUo1qaBd2hEaqZeWQEMKTL6B3bHh2QTTs5HS2lZX5G76leMGBkP4gz5FTf9e-NZ8ajPXFBWHlxc289RWiaf2r6sMCC9rbZLcDW59Vl0o70U5I5AfFC9Cz_--gijuXZKAmutoVJXOLak3jl658YALwq_GM7FZKAzqaGP167HdQ45LYgofdr33I9xuDZAJrhc1ob2adGPoj_-KX7Vfq7CGtYpC_R237YmuVKpwi6w" alt="Vintage Furniture" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>Vintage Furniture</p>
                  <p style={{ fontSize: 10, color: T.textMuted, margin: "0 0 8px" }}>Acquired: Mar 2024</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: T.primary, margin: 0 }}>$4,200</p>
                </div>
              </div>
            </div>
          </main>
        </>)}

        {/* ════════ TAB 3: AMBIANCE ════════ */}
        {tab === "ambiance" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 16px", position: "sticky", top: 0, background: "#f6f8f6", backdropFilter: "blur(12px)", zIndex: 10 }}>
            <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <MIcon name="arrow_back" size={20} color={T.text} />
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: T.text }}>Ambiance</h1>
            <button style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <MIcon name="notifications" size={20} color={T.text} />
            </button>
          </header>

          <main style={{ padding: "24px", paddingBottom: 120, display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Security */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>Security</h2>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.primary, fontWeight: 500 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary }} />
                  Live
                </span>
              </div>
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", marginBottom: 16, border: `1px solid ${T.primary}08` }}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkeMrhxcy4tkQFNGHOxaTsvmR8lL96FArdho9kjlE7zW4ZPHcX7UfV2HPO0S3cCLjt7ALZi8FcarF9RIEKXxOFDOdd_9VBKd6kLajmHsftsTOwtvCzNCY_kfGQT5Mr1KqGzdDthf0IIOK5xcvabxfDc5s7R8Eo5kCD_r7TBKPFX5FkHC7GEU25MvqO60UgqxcmIpLOl5e3lhdf7a5488FNDpTnOte_743VXrKm4f22Y8lwdbD4wZZwgbZnHjzAPb8JitSCKlxUmQ" alt="Camera feed" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.1)" }}>
                  <button style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                    <MIcon name="play_arrow" size={32} color="#fff" />
                  </button>
                </div>
              </div>
              <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MIcon name="shield_with_heart" size={20} color={T.primary} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>4 Cameras Active</p>
                  <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>System armed & secured</p>
                </div>
                <MIcon name="check_circle" size={24} color={T.primary} />
              </div>
            </section>

            {/* Lighting */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Lighting</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                <button style={{ padding: 16, background: T.primary, color: "#fff", border: "none", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500, fontSize: 12 }}>
                  <MIcon name="light_mode" size={24} color="#fff" />
                  Soft Warm
                </button>
                <button style={{ padding: 16, background: "#fff", color: T.text, border: `1px solid ${T.primary}10`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500, fontSize: 12 }}>
                  <MIcon name="wb_sunny" size={24} color={T.textMuted} />
                  Natural
                </button>
                <button style={{ padding: 16, background: "#fff", color: T.text, border: `1px solid ${T.primary}10`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500, fontSize: 12 }}>
                  <MIcon name="nights_stay" size={24} color={T.textMuted} />
                  Dim
                </button>
              </div>
              <div style={{ ...card, padding: 20, background: "#fff", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Brightness</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>80%</span>
                </div>
                <div style={{ position: "relative", width: "100%", height: 6, background: "#e2e8f0", borderRadius: 99 }}>
                  <div style={{ position: "absolute", inset: 0, width: "80%", background: T.primary, borderRadius: 99 }} />
                  <input type="range" min="0" max="100" defaultValue="80" style={{ position: "absolute", width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
                </div>
              </div>
            </section>

            {/* Climate */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Climate</h2>
              <div style={{ ...card, padding: 24, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, margin: 0, marginBottom: 4 }}>Current</p>
                  <p style={{ fontSize: 32, fontWeight: 300, margin: 0 }}>24<span style={{ color: T.primary }}>°C</span></p>
                  <p style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 4, margin: 0, marginTop: 8 }}>
                    <MIcon name="water_drop" size={14} color={T.primary} />
                    45% Humidity
                  </p>
                </div>
                <div style={{ position: "relative", width: 112, height: 112, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={T.primary} strokeWidth="6" strokeDasharray="251.2" strokeDashoffset="180" strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", textAlign: "center" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>22.5</p>
                    <p style={{ fontSize: 8, textTransform: "uppercase", color: T.textMuted, margin: 0 }}>Target</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Smart Devices */}
            <section>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Smart Devices</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MIcon name="air_purifier_gen" size={20} color="#3b82f6" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.text, margin: 0 }}>Air Purifier</p>
                    <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>Auto Mode</p>
                  </div>
                  <div style={{ width: 32, height: 16, background: T.primary, borderRadius: 8, position: "relative" }}>
                    <div style={{ position: "absolute", right: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: "50%" }} />
                  </div>
                </div>
                <div style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "#fed7aa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MIcon name="blinds" size={20} color="#f97316" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.text, margin: 0 }}>Smart Blinds</p>
                    <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>Closed</p>
                  </div>
                  <div style={{ width: 32, height: 16, background: "#cbd5e1", borderRadius: 8, position: "relative" }}>
                    <div style={{ position: "absolute", left: 2, top: 2, width: 12, height: 12, background: "#fff", borderRadius: "50%" }} />
                  </div>
                </div>
              </div>
            </section>
          </main>
        </>)}

        {/* ════════ TAB 4: AGENDA ════════ */}
        {tab === "agenda" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 24px 16px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, textTransform: "uppercase", color: T.text, margin: 0 }}>Agenda</h1>
            <button style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <MIcon name="notifications" size={24} color={T.text} />
              <span style={{ position: "absolute", top: 8, right: 8, width: 4, height: 4, borderRadius: "50%", background: T.primary }} />
            </button>
          </header>

          <main style={{ padding: "0 24px 120px", display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Date Header */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, fontWeight: 600, margin: 0 }}>October 2023</p>
                  <p style={{ fontSize: 18, fontWeight: 500, color: T.text, margin: 0 }}>Thursday, 5th</p>
                </div>
                <button style={{ display: "flex", alignItems: "center", gap: 4, color: T.primary, fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
                  <MIcon name="calendar_today" size={16} color={T.primary} />
                  Month View
                </button>
              </div>

              {/* Week Days */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", borderRadius: 12, background: i === 3 ? T.primary : "transparent", border: i === 3 ? "none" : `1px solid ${T.border}`, color: i === 3 ? "#fff" : T.text, textAlign: "center" }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, opacity: i === 3 ? 0.7 : 0.5, margin: 0 }}>{day}</span>
                    <span style={{ fontSize: 14, fontWeight: i === 3 ? 700 : 500, margin: 0 }}>{[2, 3, 4, 5, 6, 7][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Section */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 8, height: 1, background: `${T.primary}40` }} />
                <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, color: T.textMuted, margin: 0 }}>Driver</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { time: "14:00", duration: "2h", title: "Airport Transfer", desc: "Narita International Terminal 3", icon: "flight_takeoff", status: "Scheduled" },
                  { time: "19:30", duration: "1h", title: "Evening Gala Drop-off", desc: "Imperial Hotel Main Entrance", icon: "directions_car", status: "Waiting" }
                ].map((task, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 48, flexShrink: 0, paddingTop: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{task.time}</p>
                      <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>{task.duration}</p>
                    </div>
                    <div style={{ ...card, padding: 16, flex: 1, background: "#fff", borderRadius: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 500, color: T.text, margin: 0 }}>{task.title}</h3>
                        <MIcon name={task.icon} size={20} color={T.primary} />
                      </div>
                      <p style={{ fontSize: 14, color: T.textMuted, margin: 0, marginBottom: 12 }}>{task.desc}</p>
                      <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", background: task.status === "Scheduled" ? `${T.primary}10` : "#f3f4f6", color: task.status === "Scheduled" ? T.primary : T.textMuted, borderRadius: 4 }}>{task.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Secretary Section */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 8, height: 1, background: `${T.primary}40` }} />
                <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, color: T.textMuted, margin: 0 }}>Secretary</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { time: "10:00", duration: "1h", title: "Review travel itinerary", desc: "Kyoto Autumn Season 2023", icon: "map", status: "In Progress" },
                  { time: "16:30", duration: "30m", title: "Sign Q4 budget report", desc: "Office Lounge / Remote", icon: "draw", status: "Pending" }
                ].map((task, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 48, flexShrink: 0, paddingTop: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{task.time}</p>
                      <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>{task.duration}</p>
                    </div>
                    <div style={{ ...card, padding: 16, flex: 1, background: "#fff", borderRadius: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 500, color: T.text, margin: 0 }}>{task.title}</h3>
                        <MIcon name={task.icon} size={20} color={T.primary} />
                      </div>
                      <p style={{ fontSize: 14, color: T.textMuted, margin: 0, marginBottom: 12 }}>{task.desc}</p>
                      <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "4px 8px", background: task.status === "In Progress" ? T.primary : "#f3f4f6", color: task.status === "In Progress" ? "#fff" : T.textMuted, borderRadius: 4 }}>{task.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </>)}

        {/* ════════ TAB 5: SETTINGS ════════ */}
        {tab === "settings" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 16px", position: "sticky", top: 0, background: "#f6f8f6", backdropFilter: "blur(12px)", zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
                <MIcon name="arrow_back" size={20} color={T.text} />
              </button>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>Settings</h1>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon name="hdr_strong" size={20} color={T.primary} />
            </div>
          </header>

          <main style={{ padding: "0 24px 120px", display: "flex", flexDirection: "column" }}>
            {/* Profile */}
            <section style={{ padding: "32px 0", textAlign: "center", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ position: "relative", width: 112, height: 112, borderRadius: "50%", margin: "0 auto 16px", overflow: "hidden", border: `4px solid #fff`, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", background: "#eef5ea" }}>
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuASIEz91IzrEkP7RNXc8g1rGUkJm2kA8wQzOMcHKfgNnnmtrSbFch2Mvf9oVl00l2GHvaJoPrTEyGXlECA8CfwTlzYevA10fTPWseUVbflxWGJLnnaFUFjOlcfV1CGKv6AvMPGyUXyuUo7_avO1ghB5hc1qzPzafmszY3WoSw45STKOps8JIpN3eM3G6WovKQq39DmbNkehjFr4vfQumAWXQ_2Ms04b1za0VqDKOeq_FwitXAmpCJWGw7qc9BzhDLDZYvLS_e64Lg" alt="Mr. Quang" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: "50%", background: T.primary, border: `2px solid #fff`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MIcon name="edit" size={16} color="#fff" />
                </div>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: "0 0 8px" }}>Mr. Quang</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, margin: "0 0 8px" }}>
                <MIcon name="verified" size={14} color={T.primary} />
                <p style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: "uppercase", margin: 0 }}>Premium Member</p>
              </div>
              <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>quang@zenhome.com</p>
            </section>

            {/* Account Section */}
            <section style={{ padding: "24px 0" }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 16 }}>Account</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "person", label: "Account Management" },
                  { icon: "fingerprint", label: "Security & Biometrics" }
                ].map((item, i) => (
                  <div key={i} style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#eef5ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon name={item.icon} size={20} color={T.primary} />
                    </div>
                    <span style={{ flex: 1, fontWeight: 500, color: T.text }}>{item.label}</span>
                    <MIcon name="chevron_right" size={20} color={T.textMuted} />
                  </div>
                ))}
              </div>
            </section>

            {/* App Experience Section */}
            <section style={{ padding: "24px 0" }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 16 }}>App Experience</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "notifications_active", label: "Notifications", sub: "Smart Alerts" },
                  { icon: "palette", label: "Display & Theme", sub: null }
                ].map((item, i) => (
                  <div key={i} style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#eef5ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon name={item.icon} size={20} color={T.primary} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 500, color: T.text, margin: 0 }}>{item.label}</p>
                      {item.sub && <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{item.sub}</p>}
                    </div>
                    <MIcon name="chevron_right" size={20} color={T.textMuted} />
                  </div>
                ))}
              </div>
            </section>

            {/* Support Section */}
            <section style={{ padding: "24px 0" }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 16 }}>Support</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "help_center", label: "Help Center" },
                  { icon: "info", label: "About ZenHome", sub: "v2.4.0" }
                ].map((item, i) => (
                  <div key={i} style={{ ...card, padding: 16, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#eef5ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon name={item.icon} size={20} color={T.primary} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 500, color: T.text, margin: 0 }}>{item.label}</p>
                      {item.sub && <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>{item.sub}</p>}
                    </div>
                    <MIcon name="chevron_right" size={20} color={T.textMuted} />
                  </div>
                ))}
              </div>
            </section>

            {/* Logout Button */}
            <section style={{ padding: "24px 0" }}>
              <button onClick={handleLogout} style={{ width: "100%", padding: 16, background: "transparent", border: `2px solid #cbd5e1`, borderRadius: 12, color: "#ef4444", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                <MIcon name="logout" size={20} color="#ef4444" />
                Logout
              </button>
            </section>
          </main>
        </>)}

        {/* ════════ BOTTOM NAV ════════ */}
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", borderTop: `1px solid ${T.primary}08`, padding: "12px 24px 24px", zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {NAV_TABS.map((t) => {
              const a = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "transparent", cursor: "pointer", padding: "4px 8px", minWidth: 48, fontFamily: "inherit" }}>
                  <MIcon name={t.icon} size={24} color={a ? T.primary : T.textMuted} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: a ? T.primary : T.textMuted }}>{t.label}</span>
                  {a && <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.primary }} />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </StaffShell>
  );
}

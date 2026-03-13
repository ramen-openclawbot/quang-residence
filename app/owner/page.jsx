"use client";

import { useState, useEffect } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { T, card, flexBetween, sectionLabel } from "../../lib/tokens";
import { fmtVND, fmtShort, fmtDate } from "../../lib/format";
import StatusBadge from "../../components/shared/StatusBadge";
import NotificationCenter from "../../components/shared/NotificationCenter";

const NAV_TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "wealth", label: "Wealth", icon: "account_balance_wallet" },
  { id: "ambiance", label: "Ambiance", icon: "nest_eco_leaf" },
  { id: "agenda", label: "Agenda", icon: "calendar_today" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const ROLE_LABELS = { secretary: "Secretary", housekeeper: "Housekeeper", driver: "Driver" };

export default function OwnerPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [funds, setFunds] = useState([]);
  const [homeSettings, setHomeSettings] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("secretary");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const router = (typeof window !== "undefined") ? require("next/navigation") : null;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txnRes, taskRes, fundRes, settingsRes, staffRes] = await Promise.all([
        supabase.from("transactions").select("*, funds(name), categories(name_vi), profiles!created_by(full_name)").order("transaction_date", { ascending: false }).limit(50),
        supabase.from("tasks").select("*, profiles!assigned_to(full_name)").order("created_at", { ascending: false }),
        supabase.from("funds").select("*").order("id"),
        supabase.from("home_settings").select("*"),
        supabase.from("profiles").select("id, full_name, role, created_at").neq("role", "owner").order("created_at"),
      ]);
      setTransactions(txnRes.data || []);
      setTasks(taskRes.data || []);
      setFunds(fundRes.data || []);
      setStaffList(staffRes.data || []);
      if (settingsRes.data) {
        const map = {};
        settingsRes.data.forEach((s) => { let v = s.setting_value; try { v = JSON.parse(v); } catch {} map[s.setting_key] = v; });
        setHomeSettings(map);
      }
    } catch (err) { console.error("fetchData:", err); }
    finally { setLoading(false); }
  };

  const handleApproval = async (txId, status) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("transactions").update({ status, approved_by: user?.id }).eq("id", txId);
    setTransactions((p) => p.map((t) => t.id === txId ? { ...t, status } : t));
  };

  const handleSetting = async (key, value) => {
    const { data: ex } = await supabase.from("home_settings").select("id").eq("setting_key", key).single();
    const sv = typeof value === "string" ? value : JSON.stringify(value);
    if (ex) await supabase.from("home_settings").update({ setting_value: sv }).eq("id", ex.id);
    else await supabase.from("home_settings").insert({ setting_key: key, setting_value: sv });
    setHomeSettings((p) => ({ ...p, [key]: value }));
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) { setInviteMsg({ ok: false, text: "Please fill all fields." }); return; }
    setInviting(true); setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/create-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }) });
      const data = await res.json();
      if (res.ok) { setInviteMsg({ ok: true, text: `Created ${inviteEmail}. Temp password: ${data.temporary_password}` }); setInviteEmail(""); setInviteName(""); fetchData(); }
      else setInviteMsg({ ok: false, text: data.error || "Failed" });
    } catch { setInviteMsg({ ok: false, text: "Server error" }); }
    finally { setInviting(false); }
  };

  const handleLogout = async () => { await signOut(); window.location.href = "/login"; };

  const mo = new Date().toISOString().substring(0, 7);
  const totalExp = transactions.filter((t) => t.type === "expense" && t.transaction_date?.startsWith(mo)).reduce((s, t) => s + (t.amount || 0), 0);
  const pending = transactions.filter((t) => t.status === "pending");

  const weekDays = (() => {
    const today = new Date(); const dow = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - dow + 1);
    return Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  })();

  const dn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <StaffShell role="owner">
      <div style={{ maxWidth: 430, margin: "0 auto" }}>

        {/* ════════ HOME ════════ */}
        {tab === "home" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 24px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.primary}10`, border: `1px solid ${T.primary}20`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: T.primary }}>Q</div>
              <div>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: T.textMuted, fontWeight: 600 }}>Welcome back</p>
                <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>Mr. Quang</h1>
              </div>
            </div>
            <NotificationCenter userId={profile?.id} />
          </header>

          <div style={{ padding: "0 24px 24px" }}>
            {/* Wealth */}
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ ...sectionLabel, marginBottom: 0 }}>Wealth</h2>
                <button onClick={() => setTab("wealth")} style={{ fontSize: 12, color: T.primary, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>View Report</button>
              </div>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 30, fontWeight: 300, color: T.text }}>{loading ? "..." : fmtVND(totalExp)}</span>
                  <span style={{ fontSize: 14, color: T.textMuted }}>this month</span>
                </div>
                {!loading && funds.length > 0 && (<div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: T.textMuted }}>{funds[0]?.name}</span>
                    <span style={{ fontWeight: 600 }}>{fmtVND(funds[0]?.current_balance)}</span>
                  </div>
                  <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: T.primary, borderRadius: 99, width: `${Math.min(100, ((funds[0]?.current_balance || 0) / (funds[0]?.budget_monthly || 1)) * 100)}%` }} />
                  </div>
                </div>)}
                {!loading && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {funds.slice(1, 3).map((f) => (<div key={f.id}><p style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>{f.name}</p><p style={{ fontSize: 14, fontWeight: 600 }}>{fmtShort(f.current_balance)}</p></div>))}
                </div>}
              </div>
            </section>

            {/* Ambiance */}
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ ...sectionLabel }}>Ambiance</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ ...card, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <MIcon name="videocam" size={22} color={T.primary} />
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary }} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Security</p>
                  <p style={{ fontSize: 10, textTransform: "uppercase", color: T.textMuted }}>4 Cameras Active</p>
                </div>
                <div style={{ ...card, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <MIcon name="light_group" size={22} color={T.primary} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, padding: "2px 8px", background: `${T.primary}10`, borderRadius: 99 }}>{homeSettings.brightness || 60}%</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Lighting</p>
                  <p style={{ fontSize: 10, textTransform: "uppercase", color: T.textMuted }}>{homeSettings.lighting_preset === "natural" ? "Natural Preset" : homeSettings.lighting_preset === "dim" ? "Dim Preset" : "Soft Warm Preset"}</p>
                </div>
              </div>
            </section>

            {/* Agenda */}
            <section>
              <h2 style={{ ...sectionLabel }}>Agenda</h2>
              <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                {!loading && tasks.length === 0 && <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No tasks scheduled</div>}
                {tasks.slice(0, 3).map((t, i) => (
                  <div key={t.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 16, borderBottom: i < Math.min(tasks.length, 3) - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon name="article" size={20} color={T.textMuted} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: T.textMuted }}>{t.profiles?.full_name || "Staff"}</p>
                      <p style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{t.title}</p>
                    </div>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{t.due_date ? fmtDate(t.due_date) : ""}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>)}

        {/* ════════ WEALTH ════════ */}
        {tab === "wealth" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 16px" }}>
            <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: T.shadow }}>
              <MIcon name="arrow_back" size={20} color={T.text} />
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Wealth Analytics</h1>
            <button style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: T.shadow }}>
              <MIcon name="search" size={20} color={T.text} />
            </button>
          </header>

          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <p style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 4 }}>Total Net Worth</p>
              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: T.text, marginBottom: 8 }}>{loading ? "..." : fmtVND(funds.reduce((s, f) => s + (f.current_balance || 0), 0))}</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: T.primary }}>
                <MIcon name="trending_up" size={16} color={T.primary} /><span style={{ fontSize: 14, fontWeight: 700 }}>+2.4% vs last month</span>
              </div>
            </div>

            {pending.length > 0 && <section style={{ marginBottom: 24 }}>
              <h3 style={{ fontWeight: 700, color: T.text, marginBottom: 12 }}>Pending Approvals ({pending.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pending.map((tx) => (
                  <div key={tx.id} style={{ ...card, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div><p style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{tx.description || "Transaction"}</p><p style={{ fontSize: 12, color: T.textMuted }}>{tx.profiles?.full_name} &middot; {tx.funds?.name}</p></div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: T.danger }}>-{fmtVND(tx.amount)}</p>
                    </div>
                    {tx.slip_image_url && <img src={tx.slip_image_url} alt="slip" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8, cursor: "pointer" }} onClick={() => window.open(tx.slip_image_url, "_blank")} />}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleApproval(tx.id, "approved")} style={{ flex: 1, padding: "10px", background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Approve</button>
                      <button onClick={() => handleApproval(tx.id, "rejected")} style={{ flex: 1, padding: "10px", background: T.bg, color: T.danger, border: `1px solid ${T.danger}`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>}

            <section>
              <div style={{ ...flexBetween, marginBottom: 12 }}><h3 style={{ fontWeight: 700, fontSize: 18 }}>Spending Breakdown</h3><span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>View All</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {transactions.filter(t => t.type === "expense").slice(0, 5).map((tx) => (
                  <div key={tx.id} style={{ ...card, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <MIcon name="receipt_long" size={20} color={T.primary} />
                      </div>
                      <div><p style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{tx.description || "Expense"}</p><p style={{ fontSize: 12, color: T.textMuted }}>{tx.profiles?.full_name}</p></div>
                    </div>
                    <p style={{ fontWeight: 700 }}>-{fmtVND(tx.amount)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>)}

        {/* ════════ AMBIANCE ════════ */}
        {tab === "ambiance" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 16px" }}>
            <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: T.shadow }}><MIcon name="arrow_back" size={20} color={T.text} /></button>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Ambiance</h1>
            <NotificationCenter userId={profile?.id} />
          </header>
          <div style={{ padding: "0 24px 24px" }}>
            <section style={{ marginBottom: 32 }}>
              <div style={{ ...flexBetween, marginBottom: 12 }}><h3 style={{ fontWeight: 700, fontSize: 18 }}>Security</h3><span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.primary, fontWeight: 500 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary }} /> Live</span></div>
              <div style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name="shield" size={20} color={T.primary} /></div>
                <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 600 }}>4 Cameras Active</p><p style={{ fontSize: 12, color: T.textMuted }}>System armed &amp; secured</p></div>
                <MIcon name="check_circle" size={22} color={T.primary} filled />
              </div>
            </section>
            <section style={{ marginBottom: 32 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Lighting</h3>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {[{ id: "warm", label: "Soft Warm", icon: "wb_sunny" }, { id: "natural", label: "Natural", icon: "light_mode" }, { id: "dim", label: "Dim", icon: "dark_mode" }].map((p) => {
                  const a = (homeSettings.lighting_preset || "warm") === p.id;
                  return (<button key={p.id} onClick={() => handleSetting("lighting_preset", p.id)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "none", cursor: "pointer", background: a ? T.primary : `${T.primary}08`, color: a ? "#fff" : T.textSec, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: T.font, fontWeight: 600, fontSize: 12 }}>
                    <MIcon name={p.icon} size={20} color={a ? "#fff" : T.textSec} />{p.label}
                  </button>);
                })}
              </div>
              <div><div style={{ ...flexBetween, marginBottom: 8 }}><span style={{ fontSize: 14, fontWeight: 500 }}>Brightness</span><span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>{homeSettings.brightness || 80}%</span></div>
              <input type="range" min="0" max="100" value={homeSettings.brightness || 80} onChange={(e) => handleSetting("brightness", parseInt(e.target.value))} style={{ width: "100%" }} /></div>
            </section>
            <section style={{ marginBottom: 32 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Climate</h3>
              <div style={{ ...card, padding: 20, display: "flex", alignItems: "center", gap: 24 }}>
                <div><p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 4 }}>Current</p><p style={{ fontSize: 32, fontWeight: 300 }}>{homeSettings.temperature || 24}°C</p><p style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}><MIcon name="water_drop" size={14} color={T.primary} /> {homeSettings.humidity || 45}% Humidity</p></div>
                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${T.primary}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ textAlign: "center" }}><p style={{ fontSize: 20, fontWeight: 700 }}>22.5</p><p style={{ fontSize: 9, textTransform: "uppercase", color: T.textMuted }}>Target</p></div>
                  </div>
                </div>
              </div>
            </section>
            <section>
              <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Smart Devices</h3>
              <div style={{ display: "flex", gap: 16 }}>
                {[{ id: "air_purifier", label: "Air Purifier", sub: "Auto Mode", icon: "air" }, { id: "smart_blinds", label: "Smart Blinds", sub: "Closed", icon: "blinds" }].map((d) => (
                  <div key={d.id} style={{ flex: 1, textAlign: "center" }}>
                    <MIcon name={d.icon} size={28} color={T.text} /><p style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{d.label}</p><p style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>{d.sub}</p>
                    <label style={{ position: "relative", display: "inline-block", width: 44, height: 24 }}>
                      <input type="checkbox" checked={homeSettings[d.id] || false} onChange={(e) => handleSetting(d.id, e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", cursor: "pointer", inset: 0, background: homeSettings[d.id] ? T.primary : "#ccc", borderRadius: 12, transition: "0.3s" }}><span style={{ position: "absolute", height: 18, width: 18, left: homeSettings[d.id] ? 22 : 3, bottom: 3, background: "#fff", borderRadius: "50%", transition: "0.3s" }} /></span>
                    </label>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>)}

        {/* ════════ AGENDA ════════ */}
        {tab === "agenda" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 24px 16px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 300, textTransform: "uppercase", color: T.text }}>Agenda</h1>
            <NotificationCenter userId={profile?.id} />
          </header>
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, fontWeight: 600 }}>{new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}</p>
                <p style={{ fontSize: 18, fontWeight: 500, color: T.text }}>{new Date().toLocaleString("en-US", { weekday: "long" })}, {new Date().getDate()}{["st","nd","rd"][((new Date().getDate()+90)%100-10)%10-1]||"th"}</p>
              </div>
              <button style={{ display: "flex", alignItems: "center", gap: 4, color: T.primary, fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}><MIcon name="calendar_today" size={16} color={T.primary} /> Month View</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 32 }}>
              {weekDays.map((day, i) => { const today = day.toDateString() === new Date().toDateString(); return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", borderRadius: 12, background: today ? T.primary : "transparent", border: today ? "none" : `1px solid ${T.border}`, color: today ? "#fff" : T.text, boxShadow: today ? `0 4px 12px ${T.primary}33` : "none" }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, opacity: today ? 0.7 : 0.5, marginBottom: 4 }}>{dn[i]}</span>
                  <span style={{ fontSize: 14, fontWeight: today ? 700 : 500 }}>{day.getDate()}</span>
                </div>);
              })}
            </div>
            {tasks.map((task) => (
              <div key={task.id} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ width: 48, flexShrink: 0, paddingTop: 4 }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{task.due_date ? new Date(task.due_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}</p>
                  <p style={{ fontSize: 10, color: T.textMuted }}>1h</p>
                </div>
                <div style={{ ...card, padding: 16, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 500 }}>{task.title}</h3>
                    <MIcon name="draw" size={18} color={T.primary} />
                  </div>
                  <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>{task.description || ""}</p>
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))}
            {!loading && tasks.length === 0 && <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>No scheduled tasks</div>}
          </div>
        </>)}

        {/* ════════ SETTINGS ════════ */}
        {tab === "settings" && (<>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 16px" }}>
            <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff", border: `1px solid ${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: T.shadow }}><MIcon name="arrow_back" size={20} color={T.text} /></button>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Settings</h1>
            <div style={{ width: 40 }} />
          </header>
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: `${T.primary}10`, border: `2px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 36, fontWeight: 700, color: T.primary, position: "relative" }}>Q
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: T.primary, display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name="edit" size={14} color="#fff" /></div>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Mr. Quang</h2>
              <p style={{ fontSize: 12, fontWeight: 700, color: T.primary, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}><MIcon name="verified" size={14} color={T.primary} filled /> PREMIUM MEMBER</p>
            </div>

            <section style={{ marginBottom: 24 }}>
              <h3 style={{ ...sectionLabel }}>Staff Management</h3>
              <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                {staffList.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No staff members yet</div> : staffList.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: i < staffList.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${T.primary}10`, display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name="person" size={18} color={T.primary} /></div>
                      <div><p style={{ fontSize: 14, fontWeight: 600 }}>{s.full_name || "—"}</p><p style={{ fontSize: 12, color: T.textMuted }}>{ROLE_LABELS[s.role] || s.role}</p></div>
                    </div>
                    <MIcon name="chevron_right" size={20} color={T.textMuted} />
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 32 }}>
              <h3 style={{ ...sectionLabel }}>Invite New Staff</h3>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 6, fontWeight: 600 }}>Full Name</label><input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Doe" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: T.font }} /></div>
                <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 6, fontWeight: 600 }}>Email</label><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jane@email.com" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: T.font }} /></div>
                <div style={{ marginBottom: 18 }}><label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 6, fontWeight: 600 }}>Role</label>
                  <div style={{ display: "flex", gap: 8 }}>{Object.entries(ROLE_LABELS).map(([r, l]) => (<button key={r} onClick={() => setInviteRole(r)} style={{ flex: 1, padding: "10px 4px", background: inviteRole === r ? T.primary : T.bg, color: inviteRole === r ? "#fff" : T.text, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: T.font }}>{l}</button>))}</div>
                </div>
                {inviteMsg && <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, background: inviteMsg.ok ? "#f0fdf4" : "#fef2f2", color: inviteMsg.ok ? T.primary : T.danger }}>{inviteMsg.text}</div>}
                <button onClick={handleInvite} disabled={inviting} style={{ width: "100%", padding: "14px", background: T.primary, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1, fontFamily: T.font }}>{inviting ? "Creating..." : "Create Staff Account"}</button>
              </div>
            </section>

            <button onClick={handleLogout} style={{ width: "100%", padding: "14px", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 10, color: T.danger, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: T.font, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <MIcon name="logout" size={18} color={T.danger} /> Logout
            </button>
          </div>
        </>)}

        {/* ════════ BOTTOM NAV ════════ */}
        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", borderTop: `1px solid ${T.primary}08`, padding: "12px 24px 24px", zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {NAV_TABS.map((t) => { const a = tab === t.id; return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "transparent", cursor: "pointer", padding: "4px 8px", minWidth: 48 }}>
                <MIcon name={t.icon} size={24} color={a ? T.primary : T.textMuted} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: a ? T.primary : T.textMuted }}>{t.label}</span>
                {a && <div style={{ width: 4, height: 4, borderRadius: "50%", background: T.primary }} />}
              </button>);
            })}
          </div>
        </nav>
      </div>
    </StaffShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import NotificationCenter from "../../components/shared/NotificationCenter";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtVND } from "../../lib/format";

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

const NAV_TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "wealth", label: "Wealth", icon: "account_balance_wallet" },
  { id: "ambiance", label: "Ambiance", icon: "nest_eco_leaf" },
  { id: "agenda", label: "Agenda", icon: "calendar_today" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(16,24,16,0.04)",
};

const softCard = {
  ...cardStyle,
  background: "linear-gradient(180deg,#ffffff 0%, #fbfdf9 100%)",
};

function OwnerAvatar({ name }) {
  const letter = (name || "Q").trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: "linear-gradient(135deg,#7ed957,#56c91d)",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      fontWeight: 800,
      boxShadow: "0 8px 20px rgba(86,201,29,0.25)",
      flexShrink: 0,
    }}>{letter}</div>
  );
}

function SmallStat({ label, value, color }) {
  return (
    <div style={{ ...softCard, padding: 14 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || T.text, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const panelBtn = {
  height: 46,
  borderRadius: 12,
  border: "none",
  background: T.primary,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  minHeight: 46,
  borderRadius: 12,
  border: `1px solid ${T.border}`,
  background: "white",
  padding: "0 14px",
  fontSize: 14,
  boxSizing: "border-box",
};

export default function OwnerPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountUsers, setAccountUsers] = useState([]);
  const [accountMsg, setAccountMsg] = useState("");
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "driver" });
  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [settingsData, setSettingsData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [fundsRes, txRes, tasksRes, settingsRes] = await Promise.all([
        supabase.from("funds").select("*").order("id"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }).limit(20),
        supabase.from("home_settings").select("*").order("setting_key"),
      ]);
      setFunds(fundsRes.data || []);
      setTransactions(txRes.data || []);
      setTasks(tasksRes.data || []);
      setSettingsData(settingsRes.data || []);
    } catch (error) {
      console.error("Owner fetchData error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    window.location.href = "/login";
  }

  async function loadAccountUsers() {
    setAccountLoading(true);
    setAccountMsg("");
    try {
      const { data, error } = await supabase.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      setAccountUsers(data || []);
    } catch (error) {
      console.error("loadAccountUsers error:", error);
      setAccountMsg(error.message || "Không tải được danh sách user.");
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setAccountLoading(true);
    setAccountMsg("");
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo user thất bại");
      setAccountMsg(`Đã tạo ${inviteForm.email} • mật khẩu tạm: ${data.temporary_password}`);
      setInviteForm({ email: "", full_name: "", role: "driver" });
      await loadAccountUsers();
    } catch (error) {
      console.error("handleCreateUser error:", error);
      setAccountMsg(error.message || "Tạo user thất bại");
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleRoleChange(userId, role) {
    setAccountLoading(true);
    setAccountMsg("");
    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Đổi role thất bại");
      setAccountMsg(`Đã đổi role thành ${role}`);
      await loadAccountUsers();
    } catch (error) {
      console.error("handleRoleChange error:", error);
      setAccountMsg(error.message || "Đổi role thất bại");
    } finally {
      setAccountLoading(false);
    }
  }

  const totalBalance = useMemo(() => funds.reduce((sum, fund) => sum + Number(fund.current_balance || 0), 0), [funds]);
  const totalBudget = useMemo(() => funds.reduce((sum, fund) => sum + Number(fund.budget_monthly || 0), 0), [funds]);
  const pendingTransactions = useMemo(() => transactions.filter((tx) => tx.status === "pending"), [transactions]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const spentThisMonth = useMemo(() => transactions.filter((tx) => tx.type === "expense" && (tx.transaction_date || tx.created_at || "").slice(0, 7) === thisMonthKey).reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [transactions, thisMonthKey]);
  const topFunds = useMemo(() => [...funds].sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0)).slice(0, 4), [funds]);
  const recentTasks = useMemo(() => tasks.slice(0, 4), [tasks]);

  const securitySetting = settingsData.find((x) => x.setting_key === "security")?.setting_value || {};
  const lightingSetting = settingsData.find((x) => x.setting_key === "lighting")?.setting_value || {};
  const climateSetting = settingsData.find((x) => x.setting_key === "climate")?.setting_value || {};
  const purifierSetting = settingsData.find((x) => x.setting_key === "air_purifier")?.setting_value || {};
  const blindsSetting = settingsData.find((x) => x.setting_key === "smart_blinds")?.setting_value || {};

  return (
    <StaffShell role="owner">
      <div style={{ background: T.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
        {tab === "home" && (
          <>
            <div style={{ padding: "24px 18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <OwnerAvatar name={profile?.full_name || "Mr. Quang"} />
                  <div>
                    <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Owner Dashboard</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Mr. Quang"}</div>
                  </div>
                </div>
                <NotificationCenter userId={profile?.id} />
              </div>

              {loading ? (
                <div style={{ fontSize: 13, color: T.textMuted }}>Loading...</div>
              ) : (
                <>
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#1f331b 0%, #2b4b24 58%, #3d6b30 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -22, top: -22, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Estate overview</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Quiet control</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Owner</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Finance, estate, team, and rhythm.</div>
                      <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 16 }}>{fmtVND(totalBalance)}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Pending</div><div style={{ fontSize: 18, fontWeight: 800 }}>{pendingTransactions.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Open tasks</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openTasks.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Active funds</div><div style={{ fontSize: 18, fontWeight: 800 }}>{funds.length}</div></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <SmallStat label="Spent this month" value={fmtVND(spentThisMonth)} color={T.danger} />
                    <SmallStat label="Monthly budget" value={fmtVND(totalBudget)} color={T.text} />
                  </div>

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Wealth snapshot</div>
                      <button onClick={() => setTab("wealth")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {topFunds.map((fund) => {
                        const balance = Number(fund.current_balance || 0);
                        const budget = Number(fund.budget_monthly || 0);
                        const pct = budget > 0 ? Math.min((balance / budget) * 100, 100) : 0;
                        return (
                          <div key={fund.id} style={{ paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fund.name}</div>
                                <div style={{ fontSize: 12, color: T.textMuted }}>Budget: {fmtVND(budget)}</div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fmtVND(balance)}</div>
                            </div>
                            <div style={{ height: 7, borderRadius: 999, background: "#edf3ea", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: pct > 85 ? T.amber : T.primary }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Ambience</div>
                      <button onClick={() => setTab("ambiance")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="videocam" size={20} color={T.primary} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: securitySetting.armed ? T.primary : T.textMuted }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Security</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{securitySetting.cameras_active || 0} cameras • {securitySetting.armed ? "armed" : "disarmed"}</div>
                      </div>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="light_group" size={20} color={T.primary} />
                          <div style={{ fontSize: 11, color: T.primary, fontWeight: 800 }}>{lightingSetting.brightness || 0}%</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Lighting</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{lightingSetting.preset || "warm"} preset</div>
                      </div>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="device_thermostat" size={20} color={T.primary} />
                          <div style={{ fontSize: 11, color: T.primary, fontWeight: 800 }}>{climateSetting.current_temp || 0}°C</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Climate</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Target {climateSetting.target_temp || 0}°C • {climateSetting.humidity || 0}% RH</div>
                      </div>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="air_purifier_gen" size={20} color={T.primary} />
                          <div style={{ fontSize: 11, color: purifierSetting.on ? T.primary : T.textMuted, fontWeight: 800 }}>{purifierSetting.on ? "ON" : "OFF"}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Devices</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Purifier {purifierSetting.mode || "manual"} • Blinds {blindsSetting.on ? "on" : "off"}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Collected pieces</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 168, background: "linear-gradient(135deg,#d9d1c3,#8d7555)" }}>
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.45), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Art holding</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Ceramic horse</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Quiet value, warm materiality.</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 168, background: "linear-gradient(135deg,#304432,#0f1f12)" }}>
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Private collection</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Ink landscape</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>A slower, calmer dashboard note.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Agenda</div>
                      <button onClick={() => setTab("agenda")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {recentTasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Chưa có task nào để hiển thị.</div>
                    ) : recentTasks.map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.due_date ? fmtDate(task.due_date) : "No deadline"}</div>
                        </div>
                        <div style={{ padding: "6px 10px", borderRadius: 999, background: task.status === "done" ? "#e9fff5" : task.status === "in_progress" ? "#fff7e6" : "#eef4ff", color: task.status === "done" ? T.success : task.status === "in_progress" ? T.amber : T.blue, fontSize: 11, fontWeight: 800 }}>{task.status}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {tab === "wealth" && (
          <div style={{ padding: "24px 18px 120px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="arrow_back" size={20} color={T.text} /></button>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Wealth Analytics</div>
              <button style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="search" size={20} color={T.textMuted} /></button>
            </div>

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total liquid balance</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: T.text, marginTop: 8 }}>{fmtVND(totalBalance)}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.primary, fontSize: 13, fontWeight: 800, marginTop: 8 }}><MIcon name="trending_up" size={16} color={T.primary} />Stable runway across active funds</div>
            </div>

            <div style={{ ...softCard, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Fund allocation</div>
              <div style={{ display: "grid", gap: 12 }}>
                {topFunds.map((fund) => {
                  const balance = Number(fund.current_balance || 0);
                  const share = totalBalance > 0 ? Math.round((balance / totalBalance) * 100) : 0;
                  return (
                    <div key={fund.id} style={{ paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fund.name}</div>
                          <div style={{ fontSize: 12, color: T.textMuted }}>{share}% of active balance</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fmtVND(balance)}</div>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "#edf3ea", overflow: "hidden" }}>
                        <div style={{ width: `${share}%`, height: "100%", borderRadius: 999, background: T.primary }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Recent approvals / spend</div>
              {transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{tx.description || tx.recipient_name || "Transaction"}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(tx.transaction_date || tx.created_at)} • {tx.status || "pending"}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: tx.type === "income" ? T.success : T.danger }}>{tx.type === "income" ? "+" : "-"}{fmtVND(Math.abs(Number(tx.amount || 0)))}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "ambiance" && (
          <div style={{ padding: "24px 18px 120px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="arrow_back" size={20} color={T.text} /></button>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Ambiance</div>
              <NotificationCenter userId={profile?.id} />
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ ...softCard, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Security</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: securitySetting.armed ? T.primary : T.textMuted }}><span style={{ width: 7, height: 7, borderRadius: 999, background: securitySetting.armed ? T.primary : T.textMuted }} />{securitySetting.armed ? "armed" : "disarmed"}</div>
                </div>
                <div style={{ fontSize: 13, color: T.textMuted }}>{securitySetting.cameras_active || 0} camera active • live monitoring</div>
              </div>

              <div style={{ ...softCard, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Lighting</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: T.textMuted }}>Brightness</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.primary }}>{lightingSetting.brightness || 0}%</div>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "#edf3ea", overflow: "hidden", marginBottom: 8 }}><div style={{ width: `${lightingSetting.brightness || 0}%`, height: "100%", background: T.primary, borderRadius: 999 }} /></div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{lightingSetting.preset || "warm"} preset active</div>
              </div>

              <div style={{ ...softCard, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Climate</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <SmallStat label="Current" value={`${climateSetting.current_temp || 0}°C`} />
                  <SmallStat label="Target" value={`${climateSetting.target_temp || 0}°C`} color={T.primary} />
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10 }}>Humidity {climateSetting.humidity || 0}%</div>
              </div>

              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Devices</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Air Purifier</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{purifierSetting.on ? "On" : "Off"} • {purifierSetting.mode || "manual"}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Smart Blinds</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{blindsSetting.on ? "On" : "Off"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "agenda" && (
          <div style={{ padding: "24px 18px 120px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="arrow_back" size={20} color={T.text} /></button>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Agenda</div>
              <button onClick={() => setActivePanel("agenda-help")} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="calendar_today" size={20} color={T.textMuted} /></button>
            </div>

            <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Upcoming focus</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 8 }}>Today & next few items</div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {tasks.slice(0, 10).map((task) => (
                <div key={task.id} style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.due_date ? fmtDate(task.due_date) : "No deadline"}</div>
                    </div>
                    <div style={{ padding: "6px 10px", borderRadius: 999, background: task.status === "done" ? "#e9fff5" : task.status === "in_progress" ? "#fff7e6" : "#eef4ff", color: task.status === "done" ? T.success : task.status === "in_progress" ? T.amber : T.blue, fontSize: 11, fontWeight: 800 }}>{task.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div style={{ padding: "24px 18px 120px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <button onClick={() => setTab("home")} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="arrow_back" size={20} color={T.text} /></button>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Settings</div>
              <div style={{ width: 40 }} />
            </div>

            <div style={{ textAlign: "center", paddingBottom: 24, borderBottom: `1px solid ${T.border}` }}>
              <OwnerAvatar name={profile?.full_name || "Mr. Quang"} />
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 12 }}>{profile?.full_name || "Mr. Quang"}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, color: T.primary }}><MIcon name="verified" size={14} color={T.primary} /><span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Owner Access</span></div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
              {[
                { icon: "person", label: "Account Management", sub: "User roles & owner profile", panel: "account" },
                { icon: "fingerprint", label: "Security & Biometrics", sub: "Session & authentication", panel: "security" },
                { icon: "notifications_active", label: "Notifications", sub: "Smart alerts & approvals", panel: "notifications" },
                { icon: "palette", label: "Display & Theme", sub: "Visual preferences", panel: "theme" },
                { icon: "help_center", label: "Help Center", sub: "Support & documentation", panel: "help" },
              ].map((item, i) => (
                <button key={i} onClick={() => { setActivePanel(item.panel); if (item.panel === "account") loadAccountUsers(); }} style={{ ...cardStyle, width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: `1px solid ${T.border}`, textAlign: "left" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#eef8e8", display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name={item.icon} size={20} color={T.primary} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.sub}</div>
                  </div>
                  <MIcon name="chevron_right" size={20} color={T.textMuted} />
                </button>
              ))}
            </div>

            <button onClick={handleLogout} style={{ marginTop: 24, width: "100%", height: 48, borderRadius: 14, border: `1px solid #fecaca`, background: "#fff5f5", color: T.danger, fontWeight: 800, cursor: "pointer" }}>
              Logout
            </button>
          </div>
        )}

        {activePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 140, display: "flex", justifyContent: "center", alignItems: "flex-end" }} onClick={() => setActivePanel("")}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: T.card, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "78vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
                  {activePanel === "account" && "Account Management"}
                  {activePanel === "security" && "Security & Biometrics"}
                  {activePanel === "notifications" && "Notifications"}
                  {activePanel === "theme" && "Display & Theme"}
                  {activePanel === "help" && "Help Center"}
                  {activePanel === "agenda-help" && "Agenda Tips"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>

              {activePanel === "account" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 10 }}>Tạo user mới</div>
                    <form onSubmit={handleCreateUser} style={{ display: "grid", gap: 10 }}>
                      <input value={inviteForm.full_name} onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })} placeholder="Họ tên" required style={inputStyle} />
                      <input value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="Email" type="email" required style={inputStyle} />
                      <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} style={inputStyle}>
                        <option value="owner">owner</option>
                        <option value="secretary">secretary</option>
                        <option value="housekeeper">housekeeper</option>
                        <option value="driver">driver</option>
                      </select>
                      <button type="submit" disabled={accountLoading} style={{ ...panelBtn }}>{accountLoading ? "Đang tạo..." : "Tạo user"}</button>
                    </form>
                  </div>

                  {accountMsg && <div style={{ ...softCard, padding: 14, fontSize: 12, color: T.text }}>{accountMsg}</div>}

                  <div style={{ ...cardStyle, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Danh sách user</div>
                      <button onClick={loadAccountUsers} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Refresh</button>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {accountUsers.map((u) => (
                        <div key={u.id} style={{ ...softCard, padding: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{u.full_name || "No name"}</div>
                              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{u.id.slice(0, 8)} • {u.created_at ? fmtDate(u.created_at) : "n/a"}</div>
                            </div>
                            <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} style={{ ...inputStyle, width: 122, minHeight: 38, height: 38, padding: "0 10px" }}>
                              <option value="owner">owner</option>
                              <option value="secretary">secretary</option>
                              <option value="housekeeper">housekeeper</option>
                              <option value="driver">driver</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      {!accountLoading && accountUsers.length === 0 && <div style={{ fontSize: 12, color: T.textMuted }}>Chưa có user nào hiển thị.</div>}
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "security" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Auth mode</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Email + password login đang được dùng thay cho magic link.</div></div>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Recommendation</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Nên bổ sung reset password và harden create-user route ở vòng tiếp theo.</div></div>
                </div>
              )}

              {activePanel === "notifications" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Notification center</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Dùng icon chuông ở header để xem và đánh dấu đã đọc realtime.</div></div>
                  <button onClick={() => setActivePanel("")} style={{ ...panelBtn }}>Đã hiểu</button>
                </div>
              )}

              {activePanel === "theme" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Current theme</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>ZenHome green visual system đang được áp dụng đồng bộ cho 4 role.</div></div>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Next option</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Có thể làm thêm theme toggle / density controls ở vòng sau.</div></div>
                </div>
              )}

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Quick help</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Home: overview tổng thể\n• Wealth: quỹ và chi tiêu\n• Ambiance: trạng thái nhà thông minh\n• Agenda: việc sắp tới\n• Settings: tuỳ chọn hệ thống</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("home"); }} style={{ ...panelBtn }}>Về Home</button>
                </div>
              )}

              {activePanel === "agenda-help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Agenda view</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Tab Agenda đang lấy từ tasks hiện có trong hệ thống để owner nhìn nhanh các việc gần nhất.</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("agenda"); }} style={{ ...panelBtn }}>Mở Agenda</button>
                </div>
              )}
            </div>
          </div>
        )}

        <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", borderTop: `1px solid ${T.border}`, padding: "10px 12px 18px", zIndex: 50 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {NAV_TABS.map((t) => {
              const a = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, border: "none", background: "transparent", cursor: "pointer", padding: "4px 8px", minWidth: 48 }}>
                  <MIcon name={t.icon} size={22} color={a ? T.primary : T.textMuted} />
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: a ? T.primary : T.textMuted }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </StaffShell>
  );
}

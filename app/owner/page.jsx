"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
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

export default function OwnerPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
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
                <button style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="notifications" size={22} color={T.textMuted} />
                </button>
              </div>

              {loading ? (
                <div style={{ fontSize: 13, color: T.textMuted }}>Đang tải dữ liệu...</div>
              ) : (
                <>
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#1f331b 0%, #2b4b24 58%, #3d6b30 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -22, top: -22, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Estate overview</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Tổng quan vận hành</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Owner</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Tài chính, nhà cửa, nhân sự và lịch trình trong một màn nhìn</div>
                      <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 16 }}>{fmtVND(totalBalance)}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Pending duyệt</div><div style={{ fontSize: 18, fontWeight: 800 }}>{pendingTransactions.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Task mở</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openTasks.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Quỹ hoạt động</div><div style={{ fontSize: 18, fontWeight: 800 }}>{funds.length}</div></div>
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
                      <button onClick={() => setTab("wealth")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở wealth</button>
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
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Ambiance snapshot</div>
                      <button onClick={() => setTab("ambiance")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở ambiance</button>
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

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Agenda highlights</div>
                      <button onClick={() => setTab("agenda")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở agenda</button>
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
              <button style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="notifications" size={20} color={T.textMuted} /></button>
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
              <button style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="calendar_today" size={20} color={T.textMuted} /></button>
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
                { icon: "person", label: "Account Management", sub: "User roles & owner profile" },
                { icon: "fingerprint", label: "Security & Biometrics", sub: "Session & authentication" },
                { icon: "notifications_active", label: "Notifications", sub: "Smart alerts & approvals" },
                { icon: "palette", label: "Display & Theme", sub: "Visual preferences" },
                { icon: "help_center", label: "Help Center", sub: "Support & documentation" },
              ].map((item, i) => (
                <div key={i} style={{ ...cardStyle, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#eef8e8", display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name={item.icon} size={20} color={T.primary} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.sub}</div>
                  </div>
                  <MIcon name="chevron_right" size={20} color={T.textMuted} />
                </div>
              ))}
            </div>

            <button onClick={handleLogout} style={{ marginTop: 24, width: "100%", height: 48, borderRadius: 14, border: `1px solid #fecaca`, background: "#fff5f5", color: T.danger, fontWeight: 800, cursor: "pointer" }}>
              Logout
            </button>
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

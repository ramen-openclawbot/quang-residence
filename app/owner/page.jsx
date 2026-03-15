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
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingNotifTaskId, setPendingNotifTaskId] = useState(null);
  const [notifReturnTab, setNotifReturnTab] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountUsers, setAccountUsers] = useState([]);
  const [accountMsg, setAccountMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "driver" });
  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [settingsData, setSettingsData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    const urlTask = params.get("task");
    if (urlTab && NAV_TABS.some((item) => item.id === urlTab)) setTab(urlTab);
    if (urlTask) {
      setTab("agenda");
      setPendingNotifTaskId(urlTask);
    }
  }, []);

  useEffect(() => {
    if (!pendingNotifTaskId || !tasks.length) return;
    const match = tasks.find((task) => String(task.id) === String(pendingNotifTaskId));
    if (match) {
      setSelectedTask(match);
      setActivePanel("task-detail");
      setPendingNotifTaskId(null);
    }
  }, [pendingNotifTaskId, tasks]);

  async function fetchData() {
    try {
      setLoading(true);
      const [fundsRes, txRes, tasksRes, profilesRes, settingsRes] = await Promise.all([
        supabase.from("funds").select("*").order("id"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }).limit(20),
        supabase.from("profiles").select("id, full_name, role"),
        supabase.from("home_settings").select("*").order("setting_key"),
      ]);
      setFunds(fundsRes.data || []);
      setTransactions(txRes.data || []);
      setTasks(tasksRes.data || []);
      setStaffProfiles(profilesRes.data || []);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Role update failed");
      setAccountMsg(`Role updated to ${role}`);
      await loadAccountUsers();
    } catch (error) {
      console.error("handleRoleChange error:", error);
      setAccountMsg(error.message || "Role update failed");
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleResetPassword(userId) {
    setAccountLoading(true);
    setAccountMsg("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password reset failed");
      setAccountMsg(`Temporary password: ${data.temporary_password}`);
    } catch (error) {
      console.error("handleResetPassword error:", error);
      setAccountMsg(error.message || "Password reset failed");
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleChangeOwnPassword(e) {
    e.preventDefault();
    setPasswordMsg("");
    if (!passwordForm.next || passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg("New passwords do not match.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (error) throw error;
      setPasswordMsg("Password updated successfully.");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      console.error("handleChangeOwnPassword error:", error);
      setPasswordMsg(error.message || "Password update failed.");
    }
  }

  const fundsBalance = useMemo(() => funds.reduce((sum, fund) => sum + Number(fund.current_balance || 0), 0), [funds]);
  const fundedEntries = useMemo(() => funds.filter((fund) => Number(fund.current_balance || 0) !== 0).length, [funds]);
  const ledgerBalance = useMemo(() => transactions.reduce((sum, tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.type === "income") return sum + amount;
    if (tx.type === "expense") return sum - amount;
    return sum;
  }, 0), [transactions]);
  const usingLedgerFallback = useMemo(() => fundedEntries === 0 && transactions.length > 0, [fundedEntries, transactions.length]);
  const totalBalance = useMemo(() => (usingLedgerFallback ? ledgerBalance : fundsBalance), [usingLedgerFallback, fundsBalance, ledgerBalance]);
  const activeFunds = useMemo(() => funds.filter((fund) => Number(fund.current_balance || 0) > 0).length, [funds]);
  const pendingTransactions = useMemo(() => transactions.filter((tx) => tx.status === "pending"), [transactions]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const getLocalDateKey = (value) => {
    if (!value) return "";
    if (typeof value === "string") {
      const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (direct) return direct[1];
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const thisMonthKey = today.slice(0, 7);
  const spentThisMonth = useMemo(() => transactions.filter((tx) => tx.type === "expense" && [getLocalDateKey(tx.transaction_date), getLocalDateKey(tx.created_at)].some((key) => key.startsWith(thisMonthKey))).reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [transactions, thisMonthKey]);
  const incomeThisMonth = useMemo(() => transactions.filter((tx) => tx.type === "income" && [getLocalDateKey(tx.transaction_date), getLocalDateKey(tx.created_at)].some((key) => key.startsWith(thisMonthKey))).reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [transactions, thisMonthKey]);
  const topFunds = useMemo(() => [...funds].sort((a, b) => Number(b.current_balance || 0) - Number(a.current_balance || 0)).slice(0, 4), [funds]);
  const recentTasks = useMemo(() => tasks.slice(0, 4), [tasks]);
  const staffById = useMemo(() => Object.fromEntries((staffProfiles || []).map((p) => [p.id, p])), [staffProfiles]);

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
                    <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Owner Studio</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Mr. Quang"}</div>
                  </div>
                </div>
                <NotificationCenter userId={profile?.id} onOpenNotification={(notif) => {
                  const txId = notif?.payload?.transaction_id;
                  const taskId = notif?.payload?.task_id;
                  if (taskId) {
                    const match = tasks.find((t) => String(t.id) === String(taskId));
                    setTab("agenda");
                    if (match) setSelectedTask(match);
                    setActivePanel("task-detail");
                    return;
                  }
                  const target = txId ? `/transactions?tx=${txId}&from=owner` : (notif?.link || null);
                  if (target && typeof window !== "undefined") window.location.href = target;
                }} />
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
                      <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{fmtVND(totalBalance)}</div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: usingLedgerFallback ? "#fbbf24" : "#86efac" }} />
                        {usingLedgerFallback ? "Ledger fallback" : "Synced from funds"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Pending</div><div style={{ fontSize: 18, fontWeight: 800 }}>{pendingTransactions.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Open tasks</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openTasks.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Active funds</div><div style={{ fontSize: 18, fontWeight: 800 }}>{activeFunds}</div></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <SmallStat label="Spent this month" value={fmtVND(spentThisMonth)} color={T.danger} />
                    <SmallStat label="Income this month" value={fmtVND(incomeThisMonth)} color={T.success} />
                  </div>


                  <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Collected pieces</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 168, background: "#8d7555" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(18,18,14,0.04) 0%, rgba(18,18,14,0.42) 58%, rgba(18,18,14,0.78) 100%), url('/art-blocks/owner-ceramic-horse.jpg')", backgroundSize: "cover", backgroundPosition: "center 36%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.40), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Art holding</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Ceramic horse</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Quiet value, warm materiality.</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 168, background: "#304432" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(8,16,12,0.04) 0%, rgba(8,16,12,0.42) 58%, rgba(8,16,12,0.80) 100%), url('/art-blocks/owner-ink-landscape.jpg')", backgroundSize: "cover", backgroundPosition: "center 34%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Private collection</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Ink landscape</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>A slower, calmer dashboard note.</div>
                        </div>
                      </div>
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

            <button onClick={() => window.location.href = "/transactions"} style={{ ...cardStyle, width: "100%", padding: 14, marginBottom: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${T.primary}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name="receipt_long" size={20} color={T.primary} /></div>
                <div><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Audit Ledger</div><div style={{ fontSize: 12, color: T.textMuted }}>Review all transactions</div></div>
              </div>
              <MIcon name="chevron_right" size={20} color={T.textMuted} />
            </button>

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
              <NotificationCenter userId={profile?.id} onOpenNotification={(notif) => {
                const txId = notif?.payload?.transaction_id;
                const taskId = notif?.payload?.task_id;
                if (taskId) {
                  const match = tasks.find((t) => String(t.id) === String(taskId));
                  setTab("agenda");
                  if (match) setSelectedTask(match);
                  setActivePanel("task-detail");
                  return;
                }
                const target = txId ? `/transactions?tx=${txId}&from=owner` : (notif?.link || null);
                if (target && typeof window !== "undefined") window.location.href = target;
              }} />
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
              {tasks.slice(0, 10).map((task) => {
                const tone = task.status === "done" ? { bg: "#e9fff5", color: T.success } : task.status === "in_progress" ? { bg: "#fff7e6", color: T.amber } : { bg: "#eef4ff", color: T.blue };
                const assignee = staffById[task.assigned_to]?.full_name || staffById[task.created_by]?.full_name || "Unassigned";
                return (
                  <button key={task.id} onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }} style={{ ...cardStyle, padding: 16, width: "100%", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.due_date ? fmtDate(task.due_date) : "No deadline"}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Assignee: {assignee}</div>
                      </div>
                      <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{task.status}</div>
                    </div>
                  </button>
                );
              })}
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
                  {activePanel === "task-detail" && "Task detail"}
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
                      <button type="submit" disabled={accountLoading} style={{ ...panelBtn }}>{accountLoading ? "Creating..." : "Create user"}</button>
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
                          <button onClick={() => handleResetPassword(u.id)} style={{ marginTop: 10, width: "100%", height: 38, borderRadius: 10, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700, color: T.text }}>Reset password</button>
                        </div>
                      ))}
                      {!accountLoading && accountUsers.length === 0 && <div style={{ fontSize: 12, color: T.textMuted }}>No users yet.</div>}
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "security" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Auth mode</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Email + password is now the primary sign-in method.</div></div>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 10 }}>Change your password</div>
                    <form onSubmit={handleChangeOwnPassword} style={{ display: "grid", gap: 10 }}>
                      <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} placeholder="Current password" style={inputStyle} />
                      <input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} placeholder="New password" style={inputStyle} />
                      <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Confirm new password" style={inputStyle} />
                      <button type="submit" style={{ ...panelBtn }}>Update password</button>
                    </form>
                    {passwordMsg && <div style={{ marginTop: 10, fontSize: 12, color: T.textMuted }}>{passwordMsg}</div>}
                  </div>
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
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Quick help</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Home: overall view\n• Wealth: funds and spend\n• Ambience: estate state\n• Agenda: upcoming priorities\n• Settings: system controls</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("home"); }} style={{ ...panelBtn }}>Về Home</button>
                </div>
              )}

              {activePanel === "agenda-help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Agenda view</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Agenda surfaces the nearest tasks already stored in the system.</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("agenda"); }} style={{ ...panelBtn }}>Open Agenda</button>
                </div>
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "No deadline"}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Status: <strong>{selectedTask.status}</strong></div>
                    <div>Assignee: <strong>{staffById[selectedTask.assigned_to]?.full_name || staffById[selectedTask.created_by]?.full_name || "Unassigned"}</strong></div>
                    <div>Priority: <strong>{selectedTask.priority || "medium"}</strong></div>
                    <div style={{ marginTop: 8 }}>{selectedTask.description || "No notes"}</div>
                  </div>
                  <button onClick={() => setActivePanel("")} style={{ ...panelBtn }}>Back</button>
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

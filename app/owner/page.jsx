"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import NotificationCenter from "../../components/shared/NotificationCenter";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtVND } from "../../lib/format";
import { getSignedAmount } from "../../lib/transaction";

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
  { id: "home", label: "Tổng quan", icon: "home" },
  { id: "wealth", label: "Tài chính", icon: "account_balance_wallet" },
  { id: "ambiance", label: "Không gian", icon: "nest_eco_leaf" },
  { id: "agenda", label: "Lịch trình", icon: "calendar_today" },
  { id: "settings", label: "Cài đặt", icon: "settings" },
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
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountUsers, setAccountUsers] = useState([]);
  const [accountMsg, setAccountMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "driver" });
  const [transactions, setTransactions] = useState([]);
  const [allOpsTransactions, setAllOpsTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [familySchedule, setFamilySchedule] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [settingsData, setSettingsData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [cashLedgerSummary, setCashLedgerSummary] = useState(null);
  const [cashLedgerEntries, setCashLedgerEntries] = useState([]);
  const [agendaItems, setAgendaItems] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [txSearch, setTxSearch] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);
  const ownerDebugMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

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

  /* Auto-hide balance when leaving home tab (privacy) */
  useEffect(() => {
    if (tab !== "home") setBalanceRevealed(false);
  }, [tab]);

  async function fetchData() {
    try {
      setLoading(true);
      const month = selectedMonth;
      const year = selectedYear;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing session token");

      const headers = { Authorization: `Bearer ${token}` };
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      const [res, agendaRes, monthSummaryRes, allSummaryRes, cashLedgerAllRes, cashLedgerMonthRes, txListRes, allTxListRes, cashLedgerListRes] = await Promise.all([
        fetch(`/api/dashboard/owner?month=${month}&year=${year}`, { headers }),
        fetch(`/api/agenda/feed?limit=300`, { headers }),
        fetch(`/api/reports/finance-summary?scope=month&month=${monthKey}&include_pending=true&include_rejected=false`, { headers }),
        fetch(`/api/reports/finance-summary?scope=all&include_pending=true&include_rejected=false`, { headers }),
        fetch(`/api/reports/cash-ledger-summary?scope=all&include_pending=true&include_rejected=false`, { headers }),
        fetch(`/api/reports/cash-ledger-summary?scope=month&month=${monthKey}&include_pending=true&include_rejected=false`, { headers }),
        fetch(`/api/transactions?limit=300&month=${month}&year=${year}`, { headers }),
        fetch(`/api/transactions?limit=1000`, { headers }),
        fetch(`/api/cash-ledger?limit=300`, { headers }),
      ]);

      if (!res.ok) throw new Error("Owner dashboard API failed");

      const json = await res.json();
      const agendaJson = agendaRes.ok ? await agendaRes.json() : { items: [] };
      const monthSummaryJson = monthSummaryRes.ok ? await monthSummaryRes.json() : null;
      const allSummaryJson = allSummaryRes.ok ? await allSummaryRes.json() : null;
      const cashLedgerAllJson = cashLedgerAllRes.ok ? await cashLedgerAllRes.json() : null;
      const cashLedgerMonthJson = cashLedgerMonthRes.ok ? await cashLedgerMonthRes.json() : null;
      const txListJson = txListRes.ok ? await txListRes.json() : null;
      const allTxListJson = allTxListRes.ok ? await allTxListRes.json() : null;
      const cashLedgerListJson = cashLedgerListRes.ok ? await cashLedgerListRes.json() : null;

      if (ownerDebugMode) {
        setDebugInfo({
          statuses: {
            dashboardOwner: res.status,
            agenda: agendaRes.status,
            financeMonth: monthSummaryRes.status,
            financeAll: allSummaryRes.status,
            cashLedgerAll: cashLedgerAllRes.status,
            cashLedgerMonth: cashLedgerMonthRes.status,
            txMonth: txListRes.status,
            txAll: allTxListRes.status,
            cashLedgerList: cashLedgerListRes.status,
          },
          counts: {
            transactionsMonth: txListJson?.data?.length || 0,
            transactionsAll: allTxListJson?.data?.length || 0,
            cashLedgerEntries: cashLedgerListJson?.data?.length || 0,
            recentTx: json?.recentTx?.length || 0,
          },
          values: {
            cashLedgerAllNet: cashLedgerAllJson?.net ?? null,
            cashLedgerMonthIncome: cashLedgerMonthJson?.income ?? null,
            cashLedgerMonthExpense: cashLedgerMonthJson?.expense ?? null,
            opsMonthIncome: monthSummaryJson?.income ?? null,
            opsMonthExpense: monthSummaryJson?.expense ?? null,
            ownerSummaryAllNet: allSummaryJson?.net ?? null,
          },
        });
      }

      setTransactions(txListJson?.data || json.recentTx || []);
      setAllOpsTransactions(allTxListJson?.data || []);
      setTasks(json.tasks || []);
      setMaintenanceItems(json.maintenance || []);
      setFamilySchedule(json.familySchedule || []);
      setStaffProfiles(json.staffProfiles || []);
      setSettingsData(json.settingsData || []);
      setSummaryData({
        all: allSummaryJson ? { income: allSummaryJson.income, expense: allSummaryJson.expense, net: allSummaryJson.net, pending: allSummaryJson.pending_count } : (json.summary?.all || null),
        month: monthSummaryJson ? { income: monthSummaryJson.income, expense: monthSummaryJson.expense, net: monthSummaryJson.net, pending: monthSummaryJson.pending_count } : (json.summary?.month || null),
      });
      setCashLedgerSummary({
        all: cashLedgerAllJson ? { income: cashLedgerAllJson.income, expense: cashLedgerAllJson.expense, net: cashLedgerAllJson.net, pending: cashLedgerAllJson.pending_count } : null,
        month: cashLedgerMonthJson ? { income: cashLedgerMonthJson.income, expense: cashLedgerMonthJson.expense, net: cashLedgerMonthJson.net, pending: cashLedgerMonthJson.pending_count } : null,
      });
      setCashLedgerEntries(cashLedgerListJson?.data || []);
      setAgendaItems(agendaJson.items || []);
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
      if (!res.ok) throw new Error(data.error || "Cập nhật vai trò thất bại");
      setAccountMsg(`Đã cập nhật vai trò thành ${role}`);
      await loadAccountUsers();
    } catch (error) {
      console.error("handleRoleChange error:", error);
      setAccountMsg(error.message || "Cập nhật vai trò thất bại");
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
      if (!res.ok) throw new Error(data.error || "Đặt lại mật khẩu thất bại");
      setAccountMsg(`Mật khẩu tạm: ${data.temporary_password}`);
    } catch (error) {
      console.error("handleResetPassword error:", error);
      setAccountMsg(error.message || "Đặt lại mật khẩu thất bại");
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleChangeOwnPassword(e) {
    e.preventDefault();
    setPasswordMsg("");
    if (!passwordForm.next || passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg("Mật khẩu mớis do not match.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (error) throw error;
      setPasswordMsg("Đã cập nhật mật khẩu thành công.");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      console.error("handleChangeOwnPassword error:", error);
      setPasswordMsg(error.message || "Cập nhật mật khẩu thất bại.");
    }
  }

  const fallbackLedgerBalance = useMemo(() => transactions.reduce((sum, tx) => {
    if (String(tx?.status || "").toLowerCase() === "rejected") return sum;
    return sum + getSignedAmount(tx);
  }, 0), [transactions]);
  const pendingTransactions = useMemo(() => transactions.filter((tx) => tx.status === "pending"), [transactions]);
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);

  const cashLedgerFallbackAll = useMemo(() => (cashLedgerEntries || []).reduce((sum, entry) => {
    const status = String(entry?.status || "").toLowerCase();
    if (status === "rejected") return sum;
    const amount = Math.abs(Number(entry?.amount || 0));
    return String(entry?.type || "").toLowerCase() === "income" ? sum + amount : sum - amount;
  }, 0), [cashLedgerEntries]);

  const cashLedgerMonthFallback = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const entry of cashLedgerEntries || []) {
      const raw = String(entry?.transaction_date || entry?.created_at || "");
      const y = Number(raw.slice(0, 4));
      const m = Number(raw.slice(5, 7)) - 1;
      const status = String(entry?.status || "").toLowerCase();
      if (status === "rejected") continue;
      if (y !== selectedYear || m !== selectedMonth) continue;
      const amount = Math.abs(Number(entry?.amount || 0));
      if (String(entry?.type || "").toLowerCase() === "income") income += amount;
      else expense += amount;
    }
    return { income, expense, net: income - expense };
  }, [cashLedgerEntries, selectedMonth, selectedYear]);

  const opsMonthFallback = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions || []) {
      const signed = getSignedAmount(tx);
      if (signed > 0) income += signed;
      if (signed < 0) expense += Math.abs(signed);
    }
    return { income, expense };
  }, [transactions]);

  const ledgerBalance = cashLedgerSummary?.all?.net ?? cashLedgerFallbackAll;
  const incomeThisMonth = cashLedgerSummary?.month?.income ?? cashLedgerMonthFallback.income;
  const spentThisMonth = cashLedgerSummary?.month?.expense ?? cashLedgerMonthFallback.expense;
  const pendingCount = cashLedgerSummary?.all?.pending ?? 0;
  const opsIncomeThisMonth = summaryData?.month?.income ?? opsMonthFallback.income;
  const opsSpentThisMonth = summaryData?.month?.expense ?? opsMonthFallback.expense;
  const recentTasks = useMemo(() => tasks.slice(0, 4), [tasks]);
  const staffById = useMemo(() => Object.fromEntries((staffProfiles || []).map((p) => [p.id, p])), [staffProfiles]);
  const ROLE_VI = { secretary: "Thư ký", driver: "Lái xe", housekeeper: "Quản gia" };

  const txDayFiltered = useMemo(() => {
    if (selectedDay === null) return transactions;
    return transactions.filter((tx) => {
      const raw = String(tx?.transaction_date || tx?.created_at || "").slice(8, 10);
      return Number(raw) === selectedDay;
    });
  }, [transactions, selectedDay]);

  const txSearchFiltered = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    if (!q) return txDayFiltered;
    return txDayFiltered.filter((tx) => [
      tx.description,
      tx.recipient_name,
      tx.bank_name,
      tx.transaction_code,
      tx.profiles?.full_name,
      tx.status,
      tx.type,
    ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [txDayFiltered, txSearch]);

  const spendingPieData = useMemo(() => {
    const expenseRows = txSearchFiltered.filter((tx) => getSignedAmount(tx) < 0);
    const total = expenseRows.reduce((sum, tx) => sum + Math.abs(getSignedAmount(tx)), 0);
    const palette = ["#56c91d", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
    const buckets = new Map();
    for (const tx of expenseRows) {
      const key = tx?.categories?.name_vi || tx?.categories?.name || tx?.ocr_raw_data?.category_meta?.label_vi || "Chưa phân loại";
      const color = tx?.categories?.color || palette[buckets.size % palette.length];
      const prev = buckets.get(key) || { label: key, value: 0, color };
      prev.value += Math.abs(getSignedAmount(tx));
      buckets.set(key, prev);
    }
    const items = Array.from(buckets.values()).sort((a, b) => b.value - a.value);
    let cursor = 0;
    return {
      total,
      items: items.map((item) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const slice = { ...item, percent: pct, dash: `${pct} ${100 - pct}`, offset: -cursor };
        cursor += pct;
        return slice;
      }),
    };
  }, [txSearchFiltered]);

  const staffFundBalanceSource = allOpsTransactions.length > 0 ? allOpsTransactions : transactions;

  const staffFundBalances = useMemo(() => {
    const recipients = new Set();
    for (const tx of staffFundBalanceSource) {
      const note = String(tx?.notes || "");
      if (!note.includes("[AUTO_FUND_TRANSFER:")) continue;
      const userId = String(tx?.created_by || "");
      const profileInfo = staffById[userId] || null;
      if (!profileInfo || !["driver", "housekeeper"].includes(profileInfo.role)) continue;
      recipients.add(userId);
    }
    const map = new Map();
    for (const tx of staffFundBalanceSource) {
      const userId = String(tx?.created_by || "");
      if (!recipients.has(userId)) continue;
      const profileInfo = staffById[userId] || null;
      if (!profileInfo || !["driver", "housekeeper"].includes(profileInfo.role)) continue;
      const prev = map.get(userId) || { userId, name: profileInfo.full_name || "Nhân sự", role: profileInfo.role, balance: 0, totalIn: 0, totalOut: 0 };
      const signed = getSignedAmount(tx);
      prev.balance += signed;
      if (signed > 0) prev.totalIn += signed;
      if (signed < 0) prev.totalOut += Math.abs(signed);
      map.set(userId, prev);
    }
    return Array.from(map.values()).filter((x) => x.totalIn > 0).sort((a, b) => {
      if (a.role !== b.role) return a.role === "housekeeper" ? -1 : 1;
      return Math.abs(b.balance) - Math.abs(a.balance);
    });
  }, [staffFundBalanceSource, staffById]);
  const ownerAgendaTasks = useMemo(() => {
    if (agendaItems.length) return agendaItems;
    const taskRows = (tasks || []).map((t) => ({
      source: "task",
      id: `task_${t.id}`,
      rawId: t.id,
      title: t.title,
      description: t.description,
      date: t.due_date || t.created_at,
      status: t.status,
      assigneeId: t.assigned_to,
      creatorId: t.created_by,
      item: t,
    }));
    const maintenanceRows = (maintenanceItems || []).map((m) => ({
      source: "maintenance",
      id: `maintenance_${m.id}`,
      rawId: m.id,
      title: m.title || "Chăm sóc nhà",
      description: m.description,
      date: m.created_at,
      status: m.status,
      assigneeId: m.assigned_to || m.reported_by || null,
      creatorId: m.created_by || m.reported_by || null,
      item: m,
    }));
    const scheduleRows = (familySchedule || []).map((s) => ({
      source: "schedule",
      id: `schedule_${s.id}`,
      rawId: s.id,
      title: s.title || "Lịch gia đình",
      description: s.description,
      date: s.event_date,
      status: "scheduled",
      assigneeId: s.assigned_to,
      creatorId: s.created_by,
      item: s,
    }));
    return [...taskRows, ...maintenanceRows, ...scheduleRows]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [agendaItems, tasks, maintenanceItems, familySchedule]);

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
              {ownerDebugMode && debugInfo && (
                <div style={{ ...softCard, padding: 14, marginBottom: 14, background: "#fffaf0", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>Owner debug</div>
                  <pre style={{ margin: 0, fontSize: 10, lineHeight: 1.45, color: T.textMuted, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(debugInfo, null, 2)}</pre>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <OwnerAvatar name={profile?.full_name || "Mr. Quang"} />
                  <div>
                    <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Chủ nhà</div>
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
                  <button
                    type="button"
                    onClick={() => setBalanceRevealed((v) => !v)}
                    style={{ ...cardStyle, padding: 0, marginBottom: 14, background: "linear-gradient(135deg,#1a2b18 0%, #243822 40%, #2f5228 72%, #1a2b18 100%)", color: "white", overflow: "hidden", position: "relative", width: "100%", textAlign: "left", cursor: "pointer", border: "none" }}
                  >
                    {/* Premium aurora mist animations */}
                    <style>{`
                      @keyframes ownerMist1 {
                        0%, 100% { opacity: 0.06; transform: translate(0, 0) scale(1); }
                        33% { opacity: 0.12; transform: translate(12px, -8px) scale(1.15); }
                        66% { opacity: 0.08; transform: translate(-8px, 4px) scale(1.08); }
                      }
                      @keyframes ownerMist2 {
                        0%, 100% { opacity: 0.05; transform: translate(0, 0) scale(1.1); }
                        50% { opacity: 0.10; transform: translate(-14px, 6px) scale(1.25); }
                      }
                      @keyframes ownerGlow {
                        0%, 100% { opacity: 0.04; }
                        50% { opacity: 0.09; }
                      }
                      @keyframes ownerBreath {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-3px); }
                      }
                      @keyframes ownerFadeIn {
                        0% { opacity: 0; transform: translateY(6px); }
                        100% { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>

                    {/* Decorative orb */}
                    <div style={{ position: "absolute", right: -28, top: -24, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

                    {!balanceRevealed ? (
                      /* ── ZEN STATE: premium aurora mist ── */
                      <div style={{ position: "relative", zIndex: 1, padding: 18, minHeight: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tổng quan tài sản</div>
                            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Kiểm soát yên tĩnh</div>
                          </div>
                          <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Chủ nhà</div>
                        </div>

                        {/* Aurora mist layers */}
                        <div style={{ position: "relative", height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {/* Mist orb 1 — soft green */}
                          <div style={{
                            position: "absolute",
                            width: 100, height: 60,
                            borderRadius: "50%",
                            background: "radial-gradient(ellipse, rgba(86,201,29,0.18) 0%, transparent 70%)",
                            left: "20%", top: "10%",
                            animation: "ownerMist1 8s ease-in-out infinite",
                            willChange: "transform, opacity",
                          }} />
                          {/* Mist orb 2 — cool emerald */}
                          <div style={{
                            position: "absolute",
                            width: 80, height: 50,
                            borderRadius: "50%",
                            background: "radial-gradient(ellipse, rgba(134,239,172,0.14) 0%, transparent 70%)",
                            right: "18%", top: "20%",
                            animation: "ownerMist2 10s ease-in-out infinite",
                            willChange: "transform, opacity",
                          }} />
                          {/* Center glow pulse */}
                          <div style={{
                            width: 6, height: 6,
                            borderRadius: "50%",
                            background: "rgba(134,239,172,0.5)",
                            boxShadow: "0 0 20px 8px rgba(134,239,172,0.12), 0 0 40px 16px rgba(86,201,29,0.06)",
                            animation: "ownerGlow 4s ease-in-out infinite",
                          }} />
                        </div>

                        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.5, fontWeight: 600, animation: "ownerBreath 4s ease-in-out infinite" }}>
                          Chạm để hiện
                        </div>
                      </div>
                    ) : (
                      /* ── REVEALED STATE: balance + stats ── */
                      <div style={{ position: "relative", zIndex: 1, padding: 18, animation: "ownerFadeIn 0.4s ease-out" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tổng quan tài sản</div>
                            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Kiểm soát yên tĩnh</div>
                          </div>
                          <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Chủ nhà</div>
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Tài chính, tài sản, đội ngũ và nhịp sống.</div>
                        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{fmtVND(ledgerBalance)}</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 999, background: "#86efac" }} />
                          Số dư sổ cái
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div><div style={{ fontSize: 11, opacity: 0.7 }}>Chờ duyệt</div><div style={{ fontSize: 18, fontWeight: 800 }}>{pendingCount}</div></div>
                          <div><div style={{ fontSize: 11, opacity: 0.7 }}>Việc đang mở</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openTasks.length}</div></div>
                        </div>
                      </div>
                    )}
                  </button>

                  {/* Spent / Income monthly cards — hidden until revealed */}
                  {balanceRevealed ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, animation: "ownerFadeIn 0.5s ease-out 0.1s both" }}>
                      <SmallStat label="Chi sổ quỹ tháng này" value={fmtVND(spentThisMonth)} color={T.danger} />
                      <SmallStat label="Thu sổ quỹ tháng này" value={fmtVND(incomeThisMonth)} color={T.success} />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div style={{ ...softCard, padding: 14 }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Chi tháng này</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.textMuted, marginTop: 6, opacity: 0.3 }}>• • •</div>
                      </div>
                      <div style={{ ...softCard, padding: 14 }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Thu tháng này</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.textMuted, marginTop: 6, opacity: 0.3 }}>• • •</div>
                      </div>
                    </div>
                  )}


                  <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Bộ sưu tập</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 168, background: "#8d7555" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(18,18,14,0.04) 0%, rgba(18,18,14,0.42) 58%, rgba(18,18,14,0.78) 100%), url('/art-blocks/owner-ceramic-horse.jpg')", backgroundSize: "cover", backgroundPosition: "center 36%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.40), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Nghệ thuật</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Ngựa gốm sứ</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Giá trị trầm lắng, chất liệu ấm áp.</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 168, background: "#304432" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(8,16,12,0.04) 0%, rgba(8,16,12,0.42) 58%, rgba(8,16,12,0.80) 100%), url('/art-blocks/owner-ink-landscape.jpg')", backgroundSize: "cover", backgroundPosition: "center 34%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Bộ sưu tập riêng</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>Tranh thủy mặc</div>
                          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Một nốt nhạc trầm lắng trên bảng điều khiển.</div>
                        </div>
                      </div>
                    </div>
                  </div>


                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Không gian</div>
                      <button onClick={() => setTab("ambiance")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="videocam" size={20} color={T.primary} />
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: securitySetting.armed ? T.primary : T.textMuted }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>An ninh</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{securitySetting.cameras_active || 0} camera • {securitySetting.armed ? "bật canh giữ" : "tắt canh giữ"}</div>
                      </div>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="light_group" size={20} color={T.primary} />
                          <div style={{ fontSize: 11, color: T.primary, fontWeight: 800 }}>{lightingSetting.brightness || 0}%</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Chiếu sáng</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{lightingSetting.preset || "warm"} chế độ</div>
                      </div>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="device_thermostat" size={20} color={T.primary} />
                          <div style={{ fontSize: 11, color: T.primary, fontWeight: 800 }}>{climateSetting.current_temp || 0}°C</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Khí hậu</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Mục tiêu {climateSetting.target_temp || 0}°C • {climateSetting.humidity || 0}% RH</div>
                      </div>
                      <div style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <MIcon name="air_purifier_gen" size={20} color={T.primary} />
                          <div style={{ fontSize: 11, color: purifierSetting.on ? T.primary : T.textMuted, fontWeight: 800 }}>{purifierSetting.on ? "ON" : "OFF"}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Thiết bị</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Máy lọc {purifierSetting.mode || "thủ công"} • Blinds {blindsSetting.on ? "on" : "off"}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Lịch trình</div>
                      <button onClick={() => setTab("agenda")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    {recentTasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Chưa có việc nào.</div>
                    ) : recentTasks.map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.due_date ? fmtDate(task.due_date) : "Không có hạn"}</div>
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
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Phân tích tài chính</div>
              <div style={{ width: 40 }} />
            </div>

            <div style={{ ...softCard, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Tìm giao dịch vận hành..." style={{ ...inputStyle, height: 42 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ ...inputStyle, height: 42 }}>
                  {Array.from({ length: 12 }).map((_, idx) => <option key={idx} value={idx}>Tháng {idx + 1}</option>)}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ ...inputStyle, height: 42 }}>
                  {[selectedYear - 1, selectedYear, selectedYear + 1].filter((v, i, arr) => arr.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={selectedDay ?? "all"} onChange={(e) => setSelectedDay(e.target.value === "all" ? null : Number(e.target.value))} style={{ ...inputStyle, height: 42 }}>
                  <option value="all">Cả tháng</option>
                  {Array.from({ length: 31 }).map((_, idx) => <option key={idx + 1} value={idx + 1}>Ngày {idx + 1}</option>)}
                </select>
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Số dư sổ quỹ</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: T.text, marginTop: 8 }}>{fmtVND(ledgerBalance)}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Thu sổ quỹ</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.success, marginTop: 2 }}>+{fmtVND(incomeThisMonth)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Chi sổ quỹ</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.danger, marginTop: 2 }}>-{fmtVND(spentThisMonth)}</div>
                </div>
              </div>
            </div>

            <div style={{ ...softCard, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "132px 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <svg width="120" height="120" viewBox="0 0 42 42" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="21" cy="21" r="15.915" fill="none" stroke="#edf3ea" strokeWidth="5.2" />
                    {spendingPieData.items.length === 0 ? (
                      <circle cx="21" cy="21" r="15.915" fill="none" stroke="#dfe8da" strokeWidth="5.2" strokeDasharray="100 0" />
                    ) : spendingPieData.items.map((item) => (
                      <circle key={item.label} cx="21" cy="21" r="15.915" fill="none" stroke={item.color} strokeWidth="5.2" strokeDasharray={item.dash} strokeDashoffset={item.offset} strokeLinecap="butt" />
                    ))}
                  </svg>
                  <div style={{ marginTop: -72, textAlign: "center", pointerEvents: "none" }}>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase" }}>% Chi tiêu</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{spendingPieData.total > 0 ? `${Math.round((spendingPieData.items[0]?.percent || 0))}%` : "0%"}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>Cơ cấu chi tiêu vận hành</div>
                  {spendingPieData.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.textMuted }}>Chưa có dữ liệu chi tiêu vận hành.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {spendingPieData.items.slice(0, 5).map((item) => (
                        <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: T.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{Math.round(item.percent)}%</div>
                            <div style={{ fontSize: 10, color: T.textMuted }}>{fmtVND(item.value)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ ...softCard, padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 10 }}>Số dư quỹ hiện có của nhân sự</div>
              {staffFundBalances.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted }}>Chưa có số dư quỹ nào từ luồng chuyển quỹ.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {staffFundBalances.map((item) => (
                    <div key={item.userId} style={{ ...cardStyle, boxShadow: "none", padding: 12, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{ROLE_VI[item.role] || item.role}</div>
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>Thu {fmtVND(item.totalIn)} • Chi {fmtVND(item.totalOut)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: item.balance >= 0 ? T.success : T.danger, whiteSpace: "nowrap" }}>{fmtVND(item.balance)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>


            <button onClick={() => window.location.href = "/transactions"} style={{ ...cardStyle, width: "100%", padding: 14, marginBottom: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${T.primary}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name="receipt_long" size={20} color={T.primary} /></div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Sổ kiểm toán</div><div style={{ fontSize: 12, color: T.textMuted }}>Xem tất cả giao dịch</div></div>
              </div>
              <MIcon name="chevron_right" size={20} color={T.textMuted} />
            </button>

            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Giao dịch gần đây</div>
              {txSearchFiltered.slice(0, 6).map((tx) => {
                const signedAmount = getSignedAmount(tx);
                const isPositive = signedAmount >= 0;
                return (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description || tx.recipient_name || "Giao dịch"}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtDate(tx.transaction_date || tx.created_at)} · {tx.status === "approved" ? "Đã duyệt" : tx.status === "rejected" ? "Từ chối" : "Chờ duyệt"}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isPositive ? T.success : T.danger, flexShrink: 0, whiteSpace: "nowrap" }}>{isPositive ? "+" : "-"}{fmtVND(Math.abs(signedAmount))}</div>
                </div>
              );})}
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
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>An ninh</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: securitySetting.armed ? T.primary : T.textMuted }}><span style={{ width: 7, height: 7, borderRadius: 999, background: securitySetting.armed ? T.primary : T.textMuted }} />{securitySetting.armed ? "bật canh giữ" : "tắt canh giữ"}</div>
                </div>
                <div style={{ fontSize: 13, color: T.textMuted }}>{securitySetting.cameras_active || 0} camera đang hoạt động • giám sát trực tiếp</div>
              </div>

              <div style={{ ...softCard, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Chiếu sáng</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: T.textMuted }}>Độ sáng</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.primary }}>{lightingSetting.brightness || 0}%</div>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "#edf3ea", overflow: "hidden", marginBottom: 8 }}><div style={{ width: `${lightingSetting.brightness || 0}%`, height: "100%", background: T.primary, borderRadius: 999 }} /></div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{lightingSetting.preset || "warm"} chế độ đang bật</div>
              </div>

              <div style={{ ...softCard, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Khí hậu</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <SmallStat label="Hiện tại" value={`${climateSetting.current_temp || 0}°C`} />
                  <SmallStat label="Mục tiêu" value={`${climateSetting.target_temp || 0}°C`} color={T.primary} />
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10 }}>Độ ẩm {climateSetting.humidity || 0}%</div>
              </div>

              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>Thiết bị</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Máy lọc không khí</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{purifierSetting.on ? "On" : "Off"} • {purifierSetting.mode || "thủ công"}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Rèm thông minh</div>
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
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Lịch trình</div>
              <button onClick={() => setActivePanel("agenda-help")} style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.border}`, background: "white", cursor: "pointer" }}><MIcon name="calendar_today" size={20} color={T.textMuted} /></button>
            </div>

            <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sắp tới</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 8 }}>Hôm nay & các mục tiếp theo</div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {ownerAgendaTasks.slice(0, 30).map((row) => {
                const tone = row.status === "done" || row.status === "completed"
                  ? { bg: "#e9fff5", color: T.success, label: "done" }
                  : row.status === "in_progress"
                    ? { bg: "#fff7e6", color: T.amber, label: "in_progress" }
                    : { bg: "#eef4ff", color: T.blue, label: "pending" };
                const assigneeProfile = staffById[row.assigneeId] || staffById[row.creatorId] || null;
                const assignee = assigneeProfile?.full_name || null;
                const roleVi = ROLE_VI[assigneeProfile?.role] || null;
                const roleIcon = assigneeProfile?.role === "driver" ? "two_wheeler" : assigneeProfile?.role === "housekeeper" ? "home_repair_service" : "badge";
                const sourceLabel = row.source === "maintenance" ? "Việc chăm sóc nhà" : row.source === "schedule" ? "Việc gia đình" : row.source === "trip" ? "Việc lái xe" : "Task";
                const sourceIcon = row.source === "maintenance" ? "home_repair_service" : row.source === "schedule" ? "event" : row.source === "trip" ? "two_wheeler" : "task_alt";
                const sourceTone = row.source === "maintenance"
                  ? { bg: "#eef8e8", color: T.primary }
                  : row.source === "schedule"
                    ? { bg: "#fff7e6", color: T.amber }
                    : row.source === "trip"
                      ? { bg: "#eef4ff", color: T.blue }
                      : { bg: "#f2f4f1", color: T.textMuted };
                return (
                  <button key={row.id} onClick={() => { if (row.source === "task") { setSelectedTask(row.item); setActivePanel("task-detail"); } }} style={{ ...cardStyle, padding: 16, width: "100%", textAlign: "left", cursor: row.source === "task" ? "pointer" : "default" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.title}</div>
                        {row.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.description}</div>}
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{row.date ? fmtDate(row.date) : "Không có hạn"}</div>
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: sourceTone.bg, color: sourceTone.color, fontSize: 10, fontWeight: 700 }}>
                            <MIcon name={sourceIcon} size={12} color={sourceTone.color} />
                            {sourceLabel}
                          </span>
                          {assignee && roleVi && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#eef4ff", color: T.blue, fontSize: 10, fontWeight: 700 }}>
                              <MIcon name={roleIcon} size={12} color={T.blue} />
                              {roleVi} · {assignee}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{tone.label}</div>
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
                { icon: "person", label: "Quản lý tài khoản", sub: "Vai trò & hồ sơ chủ nhà", panel: "account" },
                { icon: "fingerprint", label: "Bảo mật & Sinh trắc", sub: "Phiên & xác thực", panel: "security" },
                { icon: "notifications_active", label: "Thông báo", sub: "Cảnh báo & phê duyệt thông minh", panel: "notifications" },
                { icon: "palette", label: "Giao diện & Chủ đề", sub: "Tùy chỉnh giao diện", panel: "theme" },
                { icon: "help_center", label: "Trợ giúp", sub: "Hỗ trợ & tài liệu", panel: "help" },
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
                  {activePanel === "account" && "Quản lý tài khoản"}
                  {activePanel === "security" && "Bảo mật & Sinh trắc"}
                  {activePanel === "notifications" && "Thông báo"}
                  {activePanel === "theme" && "Giao diện & Chủ đề"}
                  {activePanel === "help" && "Trợ giúp"}
                  {activePanel === "agenda-help" && "Mẹo lịch trình"}
                  {activePanel === "task-detail" && "Chi tiết công việc"}
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
                      <button type="submit" disabled={accountLoading} style={{ ...panelBtn }}>{accountLoading ? "Đang tạo..." : "Tạo tài khoản"}</button>
                    </form>
                  </div>

                  {accountMsg && <div style={{ ...softCard, padding: 14, fontSize: 12, color: T.text }}>{accountMsg}</div>}

                  <div style={{ ...cardStyle, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Danh sách user</div>
                      <button onClick={loadAccountUsers} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Tải lại</button>
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
                          <button onClick={() => handleResetPassword(u.id)} style={{ marginTop: 10, width: "100%", height: 38, borderRadius: 10, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700, color: T.text }}>Đặt lại mật khẩu</button>
                        </div>
                      ))}
                      {!accountLoading && accountUsers.length === 0 && <div style={{ fontSize: 12, color: T.textMuted }}>Chưa có tài khoản nào.</div>}
                    </div>
                  </div>
                </div>
              )}

              {activePanel === "security" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Phương thức xác thực</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Đăng nhập bằng email & mật khẩu là phương thức chính.</div></div>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 10 }}>Đổi mật khẩu</div>
                    <form onSubmit={handleChangeOwnPassword} style={{ display: "grid", gap: 10 }}>
                      <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} placeholder="Mật khẩu hiện tại" style={inputStyle} />
                      <input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} placeholder="Mật khẩu mới" style={inputStyle} />
                      <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Xác nhận mật khẩu mới" style={inputStyle} />
                      <button type="submit" style={{ ...panelBtn }}>Cập nhật mật khẩu</button>
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
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Chủ đề hiện tại</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>ZenHome green visual system đang được áp dụng đồng bộ cho 4 role.</div></div>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Tùy chọn tiếp theo</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Có thể làm thêm theme toggle / density controls ở vòng sau.</div></div>
                </div>
              )}

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Hướng dẫn nhanh</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Tổng quan: xem chung
• Tài chính: thu chi
• Không gian: trạng thái nhà
• Lịch trình: công việc ưu tiên
• Cài đặt: điều khiển hệ thống</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("home"); }} style={{ ...panelBtn }}>Về trang chính</button>
                </div>
              )}

              {activePanel === "agenda-help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Xem lịch trình</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Lịch trình hiển thị các công việc sắp tới đã được lưu trong hệ thống.</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("agenda"); }} style={{ ...panelBtn }}>Mở lịch trình</button>
                </div>
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "Không có hạn"}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Trạng thái: <strong>{selectedTask.status}</strong></div>
                    <div>Phụ trách: <strong>{staffById[selectedTask.assigned_to]?.full_name || staffById[selectedTask.created_by]?.full_name || "Chưa phân công"}</strong></div>
                    <div>Ưu tiên: <strong>{selectedTask.priority || "medium"}</strong></div>
                    <div style={{ marginTop: 8 }}>{selectedTask.description || "Không có ghi chú"}</div>
                  </div>
                  <button onClick={() => setActivePanel("")} style={{ ...panelBtn }}>Quay lại</button>
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

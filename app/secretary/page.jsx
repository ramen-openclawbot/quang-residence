"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import NotificationCenter from "../../components/shared/NotificationCenter";
import TransactionDetail from "../../components/shared/TransactionDetail";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtRelative, fmtVND } from "../../lib/format";
import { getSignedAmount, getLocalDateKey, getTodayKey, getTransactionDateKey, matchesTransactionFilter } from "../../lib/transaction";
import TransactionForm from "../../components/TransactionForm";

const MONTHS = ["Thg 1","Thg 2","Thg 3","Thg 4","Thg 5","Thg 6","Thg 7","Thg 8","Thg 9","Thg 10","Thg 11","Thg 12"];

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
};

const TABS = [
  { id: "home", label: "Tổng quan", icon: "home" },
  { id: "transactions", label: "Giao dịch", icon: "receipt_long" },
  { id: "tasks", label: "Công việc", icon: "task_alt" },
  { id: "cash-ledger", label: "Sổ quỹ", icon: "account_balance_wallet" },
];

const OPS_EXCLUDED_USER_PREFIX = "6487c846";

function getCategoryMeta(tx) {
  if (tx?.type !== "expense") return null;
  const c = tx?.categories;
  if (c) return { label: c.name_vi || c.name || "Chưa phân loại", color: c.color || "#94a3b8" };
  const m = tx?.ocr_raw_data?.category_meta;
  if (m) return { label: m.label_vi || m.code || "Chưa phân loại", color: "#94a3b8" };
  return { label: "Chưa phân loại", color: "#94a3b8" };
}

const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(16,24,16,0.04)",
};

const subtleCard = {
  ...cardStyle,
  background: "linear-gradient(180deg,#ffffff 0%, #fbfdf9 100%)",
};

function Avatar({ name }) {
  const letter = (name || "S").trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: "linear-gradient(135deg, #7ed957, #56c91d)",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      fontWeight: 800,
      boxShadow: "0 8px 20px rgba(86,201,29,0.28)",
      flexShrink: 0,
    }}>{letter}</div>
  );
}

function QuickAction({ icon, label, sub, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...cardStyle,
        width: "100%",
        padding: 16,
        textAlign: "left",
        cursor: "pointer",
        background: primary ? "linear-gradient(135deg,#69d834,#56c91d)" : T.card,
        color: primary ? "white" : T.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: primary ? "rgba(255,255,255,0.18)" : "#eef8e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <MIcon name={icon} size={22} color={primary ? "white" : T.primary} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 12, color: primary ? "rgba(255,255,255,0.85)" : T.textMuted }}>{sub}</div>
        </div>
      </div>
    </button>
  );
}

/* ImageLightbox + TransactionDetail are now shared — see components/shared/ */

export default function SecretaryPage() {
  const { profile, signOut, getToken } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingNotifTxId, setPendingNotifTxId] = useState(null);
  const [pendingNotifTaskId, setPendingNotifTaskId] = useState(null);
  const [notifReturnTab, setNotifReturnTab] = useState(null);
  const [txSearch, setTxSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState(null); // null = all days, or 1-31
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [txActiveFilter, setTxActiveFilter] = useState(null); // "income" | "expense" | "pending" | null

  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [familySchedule, setFamilySchedule] = useState([]);
  const [drivingTrips, setDrivingTrips] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [agendaItems, setAgendaItems] = useState([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  const [txFullLoaded, setTxFullLoaded] = useState(false);
  const [txPage, setTxPage] = useState(0);
  const TX_PER_PAGE = 10;

  const [cashLedgerEntries, setCashLedgerEntries] = useState([]);
  const [cashLedgerLoaded, setCashLedgerLoaded] = useState(false);
  const [cashLedgerLoading, setCashLedgerLoading] = useState(false);
  const [showCashLedgerForm, setShowCashLedgerForm] = useState(false);
  const [cashLedgerSubmitting, setCashLedgerSubmitting] = useState(false);
  const [cashLedgerSearch, setCashLedgerSearch] = useState("");
  const [cashLedgerTypeFilter, setCashLedgerTypeFilter] = useState("all");
  const [cashLedgerKindFilter, setCashLedgerKindFilter] = useState("all");
  const [cashLedgerForm, setCashLedgerForm] = useState({
    type: "expense",
    entry_kind: "ops",
    amount: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    recipient_user_id: "",
    recipient_name: "",
    bank_name: "",
    bank_account: "",
    transaction_code: "",
    slip_image_url: "",
    notes: "",
    description: "",
  });

  const [serverSummary, setServerSummary] = useState(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [revealedTaskId, setRevealedTaskId] = useState(null);
  const [balanceRevealed, setBalanceRevealed] = useState(false);

  /* ESC key handler for modals */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (activePanel) setActivePanel("");
        else if (showTaskForm) setShowTaskForm(false);
        else if (showTxForm) setShowTxForm(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, showTaskForm, showTxForm]);

  /* ── Home summary: single API call for dashboard data ── */
  const loadSummary = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [res, agendaRes] = await Promise.all([
        fetch("/api/dashboard/secretary", { headers }),
        fetch("/api/agenda/feed?limit=300", { headers }),
      ]);
      if (res.ok) {
        const json = await res.json();
        const agendaJson = agendaRes.ok ? await agendaRes.json() : { items: [] };
        setFunds(json.funds || []);
        setTasks(json.tasks || []);
        setMaintenanceItems(json.maintenance || []);
        setFamilySchedule(json.familySchedule || []);
        setDrivingTrips(json.drivingTrips || []);
        setStaffProfiles(json.staffProfiles || []);
        setAgendaItems(agendaJson.items || []);
        setTransactions(json.recentTx || []);
        setServerSummary({ todaySummary: json.todaySummary, pendingCount: json.pendingCount });
      } else {
        /* Fallback: direct Supabase queries */
        const [fundsRes, tasksRes, maintenanceRes, scheduleRes, tripsRes, profilesRes, txRes] = await Promise.all([
          supabase.from("funds").select("*").order("id"),
          supabase.from("tasks").select("*").order("due_date", { ascending: true }),
          supabase.from("home_maintenance").select("*").order("created_at", { ascending: false }),
          supabase.from("family_schedule").select("*").order("event_date", { ascending: true }),
          supabase.from("driving_trips").select("*").order("scheduled_time", { ascending: true }),
          supabase.from("profiles").select("id,full_name,role"),
          supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(20),
        ]);
        setFunds(fundsRes.data || []);
        setTasks(tasksRes.data || []);
        setMaintenanceItems(maintenanceRes.data || []);
        setFamilySchedule(scheduleRes.data || []);
        setDrivingTrips(tripsRes.data || []);
        setStaffProfiles(profilesRes.data || []);
        setTransactions(txRes.data || []);
      }
    } catch (err) {
      console.error("Thư ký loadSummary error:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  /* ── Full transactions: loaded only when Transactions tab is first opened ── */
  const loadFullTransactions = useCallback(async (limit = 200) => {
    try {
      const token = await getToken();
      const txApiRes = await fetch(`/api/transactions?limit=${limit}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (txApiRes.ok) {
        const txJson = await txApiRes.json();
        setTransactions(txJson.data || []);
      } else {
        const txFallback = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(limit);
        setTransactions(txFallback.data || []);
      }
      setTxFullLoaded(true);
    } catch (err) {
      console.error("Thư ký loadFullTransactions error:", err);
    }
  }, [getToken]);

  const loadCashLedger = useCallback(async (silent = false) => {
    try {
      if (!silent) setCashLedgerLoading(true);
      const token = await getToken();
      const res = await fetch("/api/cash-ledger?limit=200", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Không tải được sổ quỹ");
      const json = await res.json();
      setCashLedgerEntries(json.data || []);
      setCashLedgerLoaded(true);
    } catch (err) {
      console.error("Thư ký loadCashLedger error:", err);
    } finally {
      setCashLedgerLoading(false);
    }
  }, [getToken]);

  /* Convenience reload used after mutations (task create, audit action, tx submit) */
  const reloadAll = useCallback(async (silent = false) => {
    const jobs = [loadSummary(silent)];
    if (txFullLoaded) jobs.push(loadFullTransactions());
    if (cashLedgerLoaded) jobs.push(loadCashLedger(true));
    await Promise.all(jobs);
  }, [txFullLoaded, cashLedgerLoaded, loadSummary, loadFullTransactions, loadCashLedger]);

  useEffect(() => {
    if (!profile?.id) return;
    loadSummary();
    loadCashLedger(true);
  }, [profile?.id, loadSummary, loadCashLedger]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get("tab");
    const urlTask = params.get("task");
    if (urlTab && TABS.some((item) => item.id === urlTab)) setTab(urlTab);
    if (urlTask) {
      setPendingNotifTaskId(urlTask);
      setTab("tasks");
    }
  }, []);

  /* Auto-hide balance when leaving home tab (privacy) */
  useEffect(() => {
    if (tab !== "home") setBalanceRevealed(false);
  }, [tab]);

  /* Lazy-load full transactions on first visit to Transactions tab */
  useEffect(() => {
    if (tab !== "transactions" || txFullLoaded) return;
    loadFullTransactions();
  }, [tab, txFullLoaded, loadFullTransactions]);

  useEffect(() => {
    if (tab !== "cash-ledger" || cashLedgerLoaded) return;
    loadCashLedger();
  }, [tab, cashLedgerLoaded, loadCashLedger]);

  useEffect(() => {
    if (!pendingNotifTxId || !transactions.length) return;
    const match = transactions.find((tx) => String(tx.id) === String(pendingNotifTxId));
    if (match) {
      setSelectedTransaction(match);
      setActivePanel("transaction-detail");
      setPendingNotifTxId(null);
    }
  }, [pendingNotifTxId, transactions]);

  useEffect(() => {
    if (!pendingNotifTaskId || !tasks.length) return;
    const match = tasks.find((task) => String(task.id) === String(pendingNotifTaskId));
    if (match) {
      setSelectedTask(match);
      setActivePanel("task-detail");
      setPendingNotifTaskId(null);
    }
  }, [pendingNotifTaskId, tasks]);

  async function notifyTaskEvent(taskId, eventType, status) {
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      await fetch("/api/tasks/notify-event", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task_id: taskId, event_type: eventType, status }),
      });
    } catch (error) {
      console.warn("Thư ký notifyTaskEvent failed:", error);
    }
  }

  const getSwipeHandlers = (task) => {
    let startX = 0;
    return {
      onTouchStart: (e) => {
        startX = e.changedTouches[0]?.clientX || 0;
      },
      onTouchEnd: (e) => {
        const endX = e.changedTouches[0]?.clientX || 0;
        const deltaX = endX - startX;
        if (task.created_by !== profile?.id) return;
        if (deltaX < -50) setRevealedTaskId(task.id);
        if (deltaX > 35) setRevealedTaskId(null);
      },
    };
  };

  async function handleDeleteTask(task) {
    if (!profile?.id || task.created_by !== profile.id) return;
    const ok = typeof window === "undefined" ? true : window.confirm("Xóa công việc này?");
    if (!ok) {
      setRevealedTaskId(null);
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch("/api/items/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ kind: "tasks", id: task.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Xóa công việc không thành công");

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (selectedTask?.id === task.id) {
        setSelectedTask(null);
        setActivePanel("");
      }
    } catch (err) {
      alert(err.message || "Xóa công việc không thành công");
    } finally {
      setRevealedTaskId(null);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTask.title.trim() || !profile?.id || taskSubmitting) return;
    setTaskSubmitting(true);
    try {
      const { data, error } = await supabase.from("tasks").insert({
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        created_by: profile.id,
        status: "pending",
      }).select("id").single();
      if (error) {
        console.error(error);
        return;
      }
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
      setShowTaskForm(false);
      await notifyTaskEvent(data?.id, "created", "pending");
      reloadAll();
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function toggleTaskStatus(task) {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "done" : "pending";
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", task.id);
    if (!error) {
      await notifyTaskEvent(task.id, "status_changed", next);
      reloadAll();
    }
  }

  async function handleCreateCashLedgerEntry(e) {
    e.preventDefault();
    if (cashLedgerSubmitting) return;
    const amount = Number(cashLedgerForm.amount || 0);
    if (!amount || amount <= 0) {
      alert("Số tiền phải lớn hơn 0");
      return;
    }
    if (cashLedgerForm.entry_kind === "fund_transfer_out" && !cashLedgerForm.recipient_user_id) {
      alert("Vui lòng chọn người nhận quỹ");
      return;
    }
    try {
      setCashLedgerSubmitting(true);
      const token = await getToken();
      const res = await fetch("/api/cash-ledger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(cashLedgerForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Không tạo được bút toán sổ quỹ");

      setShowCashLedgerForm(false);
      setCashLedgerForm({
        type: "expense",
        entry_kind: "ops",
        amount: "",
        transaction_date: new Date().toISOString().slice(0, 10),
        recipient_user_id: "",
        recipient_name: "",
        bank_name: "",
        bank_account: "",
        transaction_code: "",
        slip_image_url: "",
        notes: "",
        description: "",
      });
      await loadCashLedger(true);
    } catch (err) {
      alert(err.message || "Không tạo được bút toán sổ quỹ");
    } finally {
      setCashLedgerSubmitting(false);
    }
  }

  const isOpsTransaction = useCallback((tx) => {
    const createdBy = String(tx?.created_by || "");
    return !createdBy.startsWith(OPS_EXCLUDED_USER_PREFIX);
  }, []);

  const totalBalance = useMemo(() => {
    return (cashLedgerEntries || []).reduce((sum, entry) => {
      const status = String(entry?.status || "").toLowerCase();
      if (status === "rejected") return sum;
      const amount = Math.abs(Number(entry?.amount || 0));
      const type = String(entry?.type || "").toLowerCase();
      return type === "income" ? sum + amount : sum - amount;
    }, 0);
  }, [cashLedgerEntries]);

  const pendingTx = useMemo(() => transactions.filter((t) => t.status === "pending" && isOpsTransaction(t)), [transactions, isOpsTransaction]);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current - 2; y <= current + 1; y++) years.push(y);
    return years;
  }, []);
  const today = useMemo(() => getTodayKey(), []);
  const todayTasks = useMemo(() => tasks.filter((t) => (t.due_date || "").startsWith(today)), [tasks, today]);
  const overdueTasks = useMemo(() => tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date.slice(0, 10) < today), [tasks, today]);
  const recentTransactions = useMemo(() => transactions.filter((tx) => isOpsTransaction(tx)).slice(0, 8), [transactions, isOpsTransaction]);
  const getTxDateParts = (tx) => {
    const key = getTransactionDateKey(tx);
    if (!key) return null;
    const [y, m, d] = key.split("-").map((v) => Number(v));
    if (!y || !m || !d) return null;
    return { year: y, month: m - 1, day: d };
  };

  // Step 1: Month filter
  const txMonthFiltered = useMemo(() => transactions.filter((tx) => {
    if (!isOpsTransaction(tx)) return false;
    const parts = getTxDateParts(tx);
    if (!parts) return false;
    return parts.month === selectedMonth && parts.year === selectedYear;
  }), [transactions, selectedMonth, selectedYear, isOpsTransaction]);

  // Step 2: Day filter
  const txDayFiltered = useMemo(() => {
    if (selectedDay === null) return txMonthFiltered;
    return txMonthFiltered.filter((tx) => {
      const parts = getTxDateParts(tx);
      return parts?.day === selectedDay;
    });
  }, [txMonthFiltered, selectedDay]);

  // Step 3: Search filter
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

  // Step 4: Apply activeFilter (income/expense/pending)
  const txFiltered = useMemo(() => {
    if (!txActiveFilter) return txSearchFiltered;
    return txSearchFiltered.filter((tx) => matchesTransactionFilter(tx, txActiveFilter));
  }, [txSearchFiltered, txActiveFilter]);

  // Group transactions by date for display (stable even if same date appears non-contiguously)
  const txGroupedByDate = useMemo(() => {
    const order = [];
    const bucket = new Map();
    for (const tx of txFiltered) {
      const dateKey = fmtDate(tx.transaction_date || tx.created_at);
      if (!bucket.has(dateKey)) {
        bucket.set(dateKey, []);
        order.push(dateKey);
      }
      bucket.get(dateKey).push(tx);
    }
    return order.map((date) => ({ date, transactions: bucket.get(date) || [] }));
  }, [txFiltered]);


  /* Reset page when filters change */
  useEffect(() => { setTxPage(0); }, [txSearch, selectedMonth, selectedYear, selectedDay, txActiveFilter]);

  const txTotalPages = Math.max(1, Math.ceil(txFiltered.length / TX_PER_PAGE));
  const txPageItems = useMemo(() => txFiltered.slice(txPage * TX_PER_PAGE, (txPage + 1) * TX_PER_PAGE), [txFiltered, txPage]);

  // Summary stats — computed from txFiltered (reflects day + search + activeFilter)
  const txIncomeTotal = useMemo(() => txFiltered.reduce((sum, tx) => {
    const signed = getSignedAmount(tx);
    return signed > 0 ? sum + signed : sum;
  }, 0), [txFiltered]);
  const txExpenseTotal = useMemo(() => txFiltered.reduce((sum, tx) => {
    const signed = getSignedAmount(tx);
    return signed < 0 ? sum + Math.abs(signed) : sum;
  }, 0), [txFiltered]);
  const txPendingCount = useMemo(() => txFiltered.filter((tx) => tx.status === "pending").length, [txFiltered]);

  const cashLedgerFiltered = useMemo(() => {
    const q = cashLedgerSearch.trim().toLowerCase();
    return cashLedgerEntries.filter((entry) => {
      if (cashLedgerTypeFilter !== "all" && entry.type !== cashLedgerTypeFilter) return false;
      if (cashLedgerKindFilter !== "all" && entry.entry_kind !== cashLedgerKindFilter) return false;
      if (!q) return true;
      return [
        entry.description,
        entry.notes,
        entry.recipient_name,
        entry.transaction_code,
        entry.bank_name,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [cashLedgerEntries, cashLedgerSearch, cashLedgerTypeFilter, cashLedgerKindFilter]);

  const cashLedgerIncome = useMemo(() => cashLedgerFiltered.reduce((sum, x) => x.type === "income" ? sum + Number(x.amount || 0) : sum, 0), [cashLedgerFiltered]);
  const cashLedgerExpense = useMemo(() => cashLedgerFiltered.reduce((sum, x) => x.type === "expense" ? sum + Number(x.amount || 0) : sum, 0), [cashLedgerFiltered]);

  useEffect(() => {
    if (!transactions.length) return;
    const latest = getTxDateParts(transactions[0]);
    const hasCurrentSelection = transactions.some((tx) => {
      const d = getTxDateParts(tx);
      return d && d.month === selectedMonth && d.year === selectedYear;
    });
    if (!hasCurrentSelection && latest) {
      setSelectedMonth(latest.month);
      setSelectedYear(latest.year);
    }
  }, [transactions, selectedMonth, selectedYear]);

  const isTodayTransaction = (t) => {
    const createdKey = getLocalDateKey(t.created_at);
    const transactionKey = getLocalDateKey(t.transaction_date);
    return createdKey === today || transactionKey === today;
  };
  const incomeToday = useMemo(() => serverSummary?.todaySummary?.income ?? transactions.filter((t) => t.type === "income" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [serverSummary, transactions, today]);
  const expenseToday = useMemo(() => serverSummary?.todaySummary?.expense ?? transactions.filter((t) => t.type === "expense" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [serverSummary, transactions, today]);
  const workItems = useMemo(() => {
    if (agendaItems.length) {
      return agendaItems.map((x) => ({
        source: x.source,
        id: x.id,
        rawId: x.raw_id,
        title: x.title,
        description: x.description,
        due_date: x.date,
        status: x.status,
        priority: x.priority,
        item: x.payload || x,
      }));
    }
    const taskRows = (tasks || []).map((t) => ({ source: "task", id: `task_${t.id}`, rawId: t.id, title: t.title, description: t.description, due_date: t.due_date, status: t.status, priority: t.priority, item: t }));
    const maintenanceRows = (maintenanceItems || []).map((m) => ({ source: "maintenance", id: `maintenance_${m.id}`, rawId: m.id, title: m.title || "Chăm sóc nhà", description: m.description, due_date: m.created_at, status: m.status, priority: "medium", item: m }));
    const scheduleRows = (familySchedule || []).map((s) => ({ source: "schedule", id: `schedule_${s.id}`, rawId: s.id, title: s.title || "Lịch gia đình", description: s.notes || s.description, due_date: s.event_date, status: "scheduled", priority: "medium", item: s }));
    const tripRows = (drivingTrips || []).map((t) => ({ source: "trip", id: `trip_${t.id}`, rawId: t.id, title: t.title || "Lịch trình lái xe", description: [t.pickup_location, t.dropoff_location].filter(Boolean).join(" → ") || t.notes, due_date: t.scheduled_time, status: t.status || "scheduled", priority: "medium", item: t }));
    return [...taskRows, ...maintenanceRows, ...scheduleRows, ...tripRows]
      .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
  }, [agendaItems, tasks, maintenanceItems, familySchedule, drivingTrips]);

  const upcomingItems = useMemo(() => workItems.filter((t) => t.due_date), [workItems]);
  const staffById = useMemo(() => Object.fromEntries((staffProfiles || []).map((p) => [p.id, p])), [staffProfiles]);
  const transferRecipients = useMemo(() => (staffProfiles || []).filter((p) => ["driver", "housekeeper"].includes(p.role)), [staffProfiles]);
  const ROLE_VI = { secretary: "Thư ký", driver: "Lái xe", housekeeper: "Quản gia" };

  return (
    <StaffShell role="secretary">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Thư ký"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Secretary Studio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Thư ký"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NotificationCenter
                userId={profile?.id}
                onOpenNotification={(notif) => {
                  const txId = notif?.payload?.transaction_id;
                  const taskId = notif?.payload?.task_id;
                  if (txId) {
                    setTab("transactions");
                    const match = transactions.find((tx) => String(tx.id) === String(txId));
                    if (match) {
                      setSelectedTransaction(match);
                      setActivePanel("transaction-detail");
                    } else {
                      setPendingNotifTxId(txId);
                      loadFullTransactions(200);
                    }
                    return;
                  }
                  if (taskId) {
                    const previousTab = tab;
                    setNotifReturnTab(previousTab);
                    setTab("tasks");
                    const matchTask = tasks.find((task) => String(task.id) === String(taskId));
                    if (matchTask) {
                      setSelectedTask(matchTask);
                      setActivePanel("task-detail");
                    } else {
                      setPendingNotifTaskId(taskId);
                      loadSummary();
                    }
                    return;
                  }
                  if (notif?.link && typeof window !== "undefined") window.location.href = notif.link;
                }}
              />
              <button onClick={() => setActivePanel("help")} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                <MIcon name="help" size={22} color={T.textMuted} />
              </button>
              <button onClick={signOut} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                <MIcon name="logout" size={22} color={T.textMuted} />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: T.textMuted }}>Đang tải...</div>
          ) : (
            <>
              {tab === "home" && (
                <div>
                  {/* Tổng quan bàn làm việc card — tap to reveal balance */}
                  <button
                    type="button"
                    onClick={() => setBalanceRevealed((v) => !v)}
                    style={{ ...cardStyle, padding: 0, marginBottom: 14, background: "linear-gradient(135deg,#20341d 0%, #2b4b24 58%, #3d6b30 100%)", color: "white", overflow: "hidden", position: "relative", width: "100%", textAlign: "left", cursor: "pointer", border: "none" }}
                  >
                    {/* Water ripple animation CSS */}
                    <style>{`
                      @keyframes zenRipple1 {
                        0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.6; }
                        100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
                      }
                      @keyframes zenRipple2 {
                        0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.5; }
                        100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
                      }
                      @keyframes zenRipple3 {
                        0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.4; }
                        100% { transform: translate(-50%,-50%) scale(2.0); opacity: 0; }
                      }
                      @keyframes zenDrop {
                        0% { transform: translateY(-18px) scale(1); opacity: 0.8; }
                        40% { transform: translateY(0px) scale(1); opacity: 0.9; }
                        50% { transform: translateY(0px) scale(1.3, 0.6); opacity: 0.3; }
                        60% { transform: translateY(0px) scale(0); opacity: 0; }
                        100% { transform: translateY(0px) scale(0); opacity: 0; }
                      }
                      @keyframes zenFloat {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-4px); }
                      }
                      @keyframes zenFadeIn {
                        0% { opacity: 0; transform: translateY(8px); }
                        100% { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>

                    <div style={{ position: "absolute", right: -28, top: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />

                    {!balanceRevealed ? (
                      /* ── ZEN STATE: water ripple animation ── */
                      <div style={{ position: "relative", zIndex: 1, padding: 18, minHeight: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tổng quan bàn làm việc</div>
                            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Bàn làm việc</div>
                          </div>
                          <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Thư ký</div>
                        </div>

                        {/* Water drop + ripple animation */}
                        <div style={{ position: "relative", height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {/* Drop */}
                          <div style={{
                            width: 8, height: 12,
                            background: "rgba(134,239,172,0.7)",
                            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                            position: "absolute",
                            animation: "zenDrop 3.5s ease-in-out infinite",
                          }} />
                          {/* Ripple circles */}
                          {[
                            { delay: "0.0s", dur: "3.5s", anim: "zenRipple1" },
                            { delay: "0.3s", dur: "3.5s", anim: "zenRipple2" },
                            { delay: "0.6s", dur: "3.5s", anim: "zenRipple3" },
                          ].map((r, i) => (
                            <div key={i} style={{
                              position: "absolute",
                              width: 40, height: 40,
                              borderRadius: "50%",
                              border: "1.5px solid rgba(134,239,172,0.35)",
                              left: "50%", top: "55%",
                              animation: `${r.anim} ${r.dur} ease-out ${r.delay} infinite`,
                            }} />
                          ))}
                        </div>

                        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.55, fontWeight: 600, animation: "zenFloat 3s ease-in-out infinite" }}>
                          Nhấn để tiết lộ
                        </div>
                      </div>
                    ) : (
                      /* ── REVEALED STATE: balance + stats ── */
                      <div style={{ position: "relative", zIndex: 1, padding: 18, animation: "zenFadeIn 0.4s ease-out" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tổng quan bàn làm việc</div>
                            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Bàn làm việc</div>
                          </div>
                          <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Thư ký</div>
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Số dư theo dõi</div>
                        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{fmtVND(totalBalance)}</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 999, background: "#86efac" }} />
                          Số dư sổ quỹ
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>Chờ duyệt</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{pendingTx.length}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>Hôm nay</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{todayTasks.length}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>Quá hạn</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{overdueTasks.length}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </button>

                  {/* In/Chi hôm nay cards — also hidden until revealed */}
                  {balanceRevealed ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, animation: "zenFadeIn 0.5s ease-out 0.1s both" }}>
                      <div style={{ ...subtleCard, padding: 14 }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Thu hôm nay</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.success, marginTop: 6 }}>{fmtVND(incomeToday)}</div>
                      </div>
                      <div style={{ ...subtleCard, padding: 14 }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Chi hôm nay</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.danger, marginTop: 6 }}>{fmtVND(expenseToday)}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div style={{ ...subtleCard, padding: 14 }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Thu hôm nay</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.textMuted, marginTop: 6, opacity: 0.3 }}>• • •</div>
                      </div>
                      <div style={{ ...subtleCard, padding: 14 }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Chi hôm nay</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.textMuted, marginTop: 6, opacity: 0.3 }}>• • •</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <QuickAction icon="upload_file" label="Tải hóa đơn" sub="Quét hóa đơn và ghi giao dịch" onClick={() => setShowTxForm(true)} primary />
                    <QuickAction icon="task_alt" label="Việc mới" sub="Tạo công việc nhanh chóng" onClick={() => setShowTaskForm(true)} />
                  </div>

                  <div style={{ ...subtleCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Tài sản tĩnh</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 156, background: "#7c6852" }}>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: "linear-gradient(180deg, rgba(16,20,16,0.02) 0%, rgba(16,20,16,0.40) 60%, rgba(16,20,16,0.74) 100%), url('/art-blocks/art-note-bronze-study.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "center 38%",
                            transform: "scale(1.04)",
                          }}
                        />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 36%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>Ghi chú nghệ thuật</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Nghiên cứu đồng</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 156, background: "#1e3224" }}>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: "linear-gradient(180deg, rgba(12,22,14,0.04) 0%, rgba(12,22,14,0.42) 60%, rgba(12,22,14,0.80) 100%), url('/art-blocks/collection-tea-vessel.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "center 42%",
                            transform: "scale(1.05)",
                          }}
                        />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>Bộ sưu tập</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Bình trà</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...subtleCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Công việc hôm nay</div>
                      <button onClick={() => setTab("tasks")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    {todayTasks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <MIcon name="event_available" size={28} color={T.textMuted} />
                        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Chưa có công việc nào.</div>
                      </div>
                    ) : todayTasks.slice(0, 3).map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: task.priority === "urgent" ? T.danger : task.priority === "high" ? T.amber : T.primary, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{task.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description || "Không có ghi chú"}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Luồng gần đây</div>
                      <button onClick={() => setTab("transactions")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    {recentTransactions.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <MIcon name="receipt_long" size={28} color={T.textMuted} />
                        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Chưa có giao dịch nào.</div>
                      </div>
                    ) : recentTransactions.slice(0, 5).map((tx) => {
                      const signedAmount = getSignedAmount(tx);
                      const isPositive = signedAmount >= 0;
                      return (
                      <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, overflow: "hidden" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 12, background: isPositive ? "#eafaf2" : "#fff1f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MIcon name={isPositive ? "south_west" : "north_east"} size={18} color={isPositive ? T.success : T.danger} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description || tx.recipient_name || "Giao dịch"}</div>
                            {(() => { const cat = getCategoryMeta(tx); if (!cat) return null; return (
                              <div style={{ marginTop: 5 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}33`, fontSize: 10, fontWeight: 700 }}>
                                  <span style={{ width: 5, height: 5, borderRadius: 999, background: cat.color }} />{cat.label}
                                </span>
                              </div>
                            ); })()}
                            <div style={{ fontSize: 12, color: T.textMuted }}>{fmtRelative(tx.created_at)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isPositive ? T.success : T.danger, flexShrink: 0, whiteSpace: "nowrap" }}>{isPositive ? "+" : "-"}{fmtVND(Math.abs(signedAmount))}</div>
                      </div>
                    );})}
                  </div>
                </div>
              )}

              {tab === "transactions" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Giao dịch</div>
                    <button onClick={() => setShowTxForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      + Tải hóa đơn
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDate(value);
                          if (!value) {
                            setSelectedDay(null);
                            return;
                          }
                          const [y, m, d] = value.split("-").map(Number);
                          if (y && m && d) {
                            setSelectedYear(y);
                            setSelectedMonth(m - 1);
                            setSelectedDay(d);
                          }
                        }}
                        style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${selectedDate ? T.primary : T.border}`, background: selectedDate ? `${T.primary}08` : T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, boxSizing: "border-box", WebkitAppearance: "none", appearance: "none" }}
                      />
                    </div>
                    {selectedDate && (
                      <button
                        onClick={() => { setSelectedDate(""); setSelectedDay(null); }}
                        style={{ height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}
                      >
                        Xóa ngày
                      </button>
                    )}
                    <select value={selectedMonth} onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedDay(null); setSelectedDate(""); }} style={{ flex: 1, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}>
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedDay(null); setSelectedDate(""); }} style={{ width: 90, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>

                  <div style={{ position: "relative", marginBottom: 14 }}>
                    <MIcon name="search" size={18} color={T.textMuted} style={{ position: "absolute", left: 14, top: 12 }} />
                    <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Tìm kiếm giao dịch..." style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, paddingLeft: 40, paddingRight: 14, fontSize: 14, color: T.text, boxSizing: "border-box" }} />
                  </div>

                  {/* Summary strip — clickable filters */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { key: "income", label: "Thu nhập", value: fmtVND(txIncomeTotal), color: T.success },
                      { key: "expense", label: "Chi tiêu", value: fmtVND(txExpenseTotal), color: T.danger },
                      { key: "pending", label: "Chờ duyệt", value: txPendingCount, color: T.amber },
                    ].map((item) => {
                      const isActive = txActiveFilter === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setTxActiveFilter(isActive ? null : item.key)}
                          style={{
                            ...cardStyle,
                            padding: 12,
                            textAlign: "center",
                            cursor: "pointer",
                            border: isActive ? `2px solid ${item.color}` : `1px solid ${T.border}`,
                            background: isActive ? `${item.color}10` : T.card,
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: item.color, letterSpacing: "0.06em" }}>{item.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: item.color, marginTop: 4 }}>{item.value}</div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Active filter indicator */}
                  {txActiveFilter && (
                    <div style={{ marginBottom: 10 }}>
                      <button
                        onClick={() => setTxActiveFilter(null)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 10px", borderRadius: 8,
                          background: `${txActiveFilter === "income" ? T.success : txActiveFilter === "expense" ? T.danger : T.amber}15`,
                          color: txActiveFilter === "income" ? T.success : txActiveFilter === "expense" ? T.danger : T.amber,
                          fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                        }}
                      >
                        <MIcon name="filter_list" size={14} color={txActiveFilter === "income" ? T.success : txActiveFilter === "expense" ? T.danger : T.amber} />
                        {txActiveFilter === "income" ? "Thu nhập" : txActiveFilter === "expense" ? "Chi tiêu" : "Chờ duyệt"}
                        <MIcon name="close" size={12} color={txActiveFilter === "income" ? T.success : txActiveFilter === "expense" ? T.danger : T.amber} />
                      </button>
                    </div>
                  )}

                  {txFiltered.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center" }}>
                      <MIcon name="search_off" size={32} color={T.textMuted} />
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>Chưa có giao dịch nào.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 8 }}>
                        {txGroupedByDate.map((group) => {
                          const dayIncome = group.transactions.reduce((s, t) => { const v = getSignedAmount(t); return v > 0 ? s + v : s; }, 0);
                          const dayExpense = group.transactions.reduce((s, t) => { const v = getSignedAmount(t); return v < 0 ? s + Math.abs(v) : s; }, 0);
                          // Only show transactions in current page range
                          const groupTxInPage = group.transactions.filter((tx) => txPageItems.includes(tx));
                          if (groupTxInPage.length === 0) return null;
                          return (
                            <div key={group.date}>
                              {/* Date header */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 6px" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  {group.date}
                                </div>
                                <div style={{ display: "flex", gap: 8, fontSize: 10, fontWeight: 700 }}>
                                  {dayIncome > 0 && <span style={{ color: T.success }}>+{fmtVND(dayIncome)}</span>}
                                  {dayExpense > 0 && <span style={{ color: T.danger }}>−{fmtVND(dayExpense)}</span>}
                                </div>
                              </div>
                              {/* Transactions for this date */}
                              <div style={{ display: "grid", gap: 8 }}>
                                {groupTxInPage.map((tx) => {
                                  const signedAmount = getSignedAmount(tx);
                                  const isIncome = signedAmount > 0;
                                  const txType = String(tx?.type || "").trim().toLowerCase();
                                  const statusColor = tx.status === "approved" ? T.success : tx.status === "pending" ? T.amber : T.danger;
                                  const STATUS_VI = { approved: "Đã duyệt", pending: "Chờ duyệt", rejected: "Từ chối" };
                                  return (
                                    <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("transaction-detail"); }} style={{ ...cardStyle, padding: 12, width: "calc(100% - 4px)", margin: "0 auto", textAlign: "left", cursor: "pointer", display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) auto", alignItems: "center", columnGap: 10, border: `1px solid ${T.border}`, boxSizing: "border-box", maxWidth: "100%" }}>
                                      <div style={{ width: 42, height: 42, borderRadius: 12, background: isIncome ? "#ecfdf3" : (txType === "adjustment" && signedAmount === 0) ? "#f5f5f5" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <MIcon name={isIncome ? "trending_up" : "trending_down"} size={20} color={isIncome ? T.success : T.danger} />
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {tx.description || tx.recipient_name || (txType === "income" ? "Thu nhập" : txType === "adjustment" ? "Điều chỉnh" : "Chi tiêu")}
                                        </div>
                                        {(() => { const cat = getCategoryMeta(tx); if (!cat) return null; return (
                                          <div style={{ marginTop: 6 }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 999, background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}33`, fontSize: 10, fontWeight: 700 }}>
                                              <span style={{ width: 5, height: 5, borderRadius: 999, background: cat.color }} />{cat.label}
                                            </span>
                                          </div>
                                        ); })()}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
                                          <div style={{ fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                            {tx.profiles?.full_name || "—"}
                                          </div>
                                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: `${statusColor}15`, color: statusColor, fontSize: 10, fontWeight: 700, textTransform: "uppercase", flexShrink: 0, whiteSpace: "nowrap" }}>
                                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                                            {STATUS_VI[tx.status] || tx.status}
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{ textAlign: "right", minWidth: 90, paddingLeft: 4 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: signedAmount >= 0 ? T.success : T.danger, whiteSpace: "nowrap" }}>
                                          {signedAmount >= 0 ? "+" : "−"}{fmtVND(Math.abs(signedAmount))}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination controls */}
                      {txTotalPages > 1 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
                          <button
                            onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                            disabled={txPage === 0}
                            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, cursor: txPage === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: txPage === 0 ? 0.35 : 1 }}
                          >
                            <MIcon name="chevron_left" size={18} color={T.text} />
                          </button>

                          {Array.from({ length: txTotalPages }, (_, i) => {
                            /* Show max 5 page buttons: first, last, current ±1 */
                            if (txTotalPages <= 5 || i === 0 || i === txTotalPages - 1 || Math.abs(i - txPage) <= 1) {
                              return (
                                <button
                                  key={i}
                                  onClick={() => setTxPage(i)}
                                  style={{
                                    minWidth: 36, height: 36, borderRadius: 10, border: "none",
                                    background: i === txPage ? T.primary : T.card,
                                    color: i === txPage ? "white" : T.text,
                                    fontSize: 13, fontWeight: 800, cursor: "pointer",
                                    boxShadow: i === txPage ? "none" : `inset 0 0 0 1px ${T.border}`,
                                  }}
                                >
                                  {i + 1}
                                </button>
                              );
                            }
                            /* Render "..." ellipsis only once between gaps */
                            if (i === 1 && txPage > 2) return <span key={i} style={{ fontSize: 13, color: T.textMuted, padding: "0 2px" }}>...</span>;
                            if (i === txTotalPages - 2 && txPage < txTotalPages - 3) return <span key={i} style={{ fontSize: 13, color: T.textMuted, padding: "0 2px" }}>...</span>;
                            return null;
                          })}

                          <button
                            onClick={() => setTxPage((p) => Math.min(txTotalPages - 1, p + 1))}
                            disabled={txPage >= txTotalPages - 1}
                            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, cursor: txPage >= txTotalPages - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: txPage >= txTotalPages - 1 ? 0.35 : 1 }}
                          >
                            <MIcon name="chevron_right" size={18} color={T.text} />
                          </button>
                        </div>
                      )}

                      {/* Page info */}
                      <div style={{ textAlign: "center", fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                        {txFiltered.length} giao dịch · Trang {txPage + 1} / {txTotalPages}
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "tasks" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Công việc</div>
                    <button onClick={() => setShowTaskForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      + Tạo
                    </button>
                  </div>
                  {workItems.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center" }}>
                      <MIcon name="task_alt" size={32} color={T.textMuted} />
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>Chưa có công việc nào.</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {workItems.map((task) => {
                        const canDelete = task.source === "task" && task.item.created_by === profile?.id;
                        const swipe = task.source === "task" ? getSwipeHandlers(task.item) : {};
                        const status = task.status;
                        const sourceLabel = task.source === "maintenance" ? "Chăm sóc nhà" : task.source === "schedule" ? "Việc gia đình" : task.source === "trip" ? "Việc lái xe" : "Task";
                        const sourceIcon = task.source === "maintenance" ? "home_repair_service" : task.source === "schedule" ? "event" : task.source === "trip" ? "two_wheeler" : "task_alt";
                        const ownerId = task.item?.assigned_to || task.item?.created_by || task.item?.reported_by || null;
                        const ownerRole = ROLE_VI[staffById[ownerId]?.role] || "";
                        return (
                          <div key={task.id} style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
                            {canDelete && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.item); }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 88, border: "none", background: T.danger, color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", borderRadius: 18 }}>
                                Xóa
                              </button>
                            )}
                            <button
                              {...swipe}
                              key={task.id}
                              onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }}
                              style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}`, position: "relative", transform: canDelete && revealedTaskId === task.item.id ? "translateX(-88px)" : "translateX(0)", transition: "transform 180ms ease" }}>
                              <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                                  {task.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description}</div>}
                                  {task.due_date && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Hạn: {fmtDate(task.due_date)}</div>}
                                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#eef8e8", color: T.primary, fontSize: 10, fontWeight: 700 }}>
                                      <MIcon name={sourceIcon} size={12} color={T.primary} />{sourceLabel}
                                    </span>
                                    {ownerRole && (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 999, background: "#eef4ff", color: T.blue, fontSize: 10, fontWeight: 700 }}>
                                        <MIcon name={staffById[ownerId]?.role === "driver" ? "two_wheeler" : staffById[ownerId]?.role === "housekeeper" ? "home_repair_service" : "badge"} size={12} color={T.blue} />{ownerRole}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: status === "done" || status === "completed" ? T.success : status === "in_progress" ? T.amber : T.textMuted,
                                  background: status === "done" || status === "completed" ? "#e9fff5" : status === "in_progress" ? "#fff7e6" : "#f2f4f1",
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  whiteSpace: "nowrap",
                                }}>{status}</div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "cash-ledger" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Sổ quỹ</div>
                    <button onClick={() => setShowCashLedgerForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      + Bút toán
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ ...subtleCard, padding: 12 }}>
                      <div style={{ fontSize: 11, color: T.textMuted }}>Tổng thu</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.success }}>{fmtVND(cashLedgerIncome)}</div>
                    </div>
                    <div style={{ ...subtleCard, padding: 12 }}>
                      <div style={{ fontSize: 11, color: T.textMuted }}>Tổng chi</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.danger }}>{fmtVND(cashLedgerExpense)}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input value={cashLedgerSearch} onChange={(e) => setCashLedgerSearch(e.target.value)} placeholder="Tìm trong sổ quỹ..." style={{ ...inputStyle, height: 42 }} />
                    <select value={cashLedgerTypeFilter} onChange={(e) => setCashLedgerTypeFilter(e.target.value)} style={{ ...inputStyle, height: 42, width: 120 }}>
                      <option value="all">Tất cả</option>
                      <option value="income">Thu</option>
                      <option value="expense">Chi</option>
                    </select>
                    <select value={cashLedgerKindFilter} onChange={(e) => setCashLedgerKindFilter(e.target.value)} style={{ ...inputStyle, height: 42, width: 170 }}>
                      <option value="all">Mọi loại</option>
                      <option value="ops">Vận hành</option>
                      <option value="fund_transfer_out">Chuyển quỹ đi</option>
                      <option value="fund_transfer_in_auto">Thu tự động</option>
                    </select>
                  </div>

                  {cashLedgerLoading ? (
                    <div style={{ fontSize: 13, color: T.textMuted }}>Đang tải sổ quỹ...</div>
                  ) : cashLedgerFiltered.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center" }}>
                      <MIcon name="account_balance_wallet" size={32} color={T.textMuted} />
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>Chưa có bút toán sổ quỹ.</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {cashLedgerFiltered.map((entry) => {
                        const isIncome = entry.type === "income";
                        const kindLabel = entry.entry_kind === "fund_transfer_out" ? "Chuyển quỹ đi" : entry.entry_kind === "fund_transfer_in_auto" ? "Thu tự động" : "Vận hành";
                        return (
                          <div key={entry.id} style={{ ...cardStyle, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{entry.description || entry.notes || "Bút toán sổ quỹ"}</div>
                                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{fmtDate(entry.transaction_date)} • {kindLabel}</div>
                                {entry.recipient_name && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Người nhận: {entry.recipient_name}</div>}
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: isIncome ? T.success : T.danger, whiteSpace: "nowrap" }}>
                                {isIncome ? "+" : "−"}{fmtVND(Math.abs(Number(entry.amount || 0)))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} onSuccess={() => { setShowTxForm(false); reloadAll(); }} />}

        {activePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 220, display: "flex", alignItems: "flex-end" }} onClick={() => setActivePanel("")}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "24px 24px 0 0", padding: 18, maxHeight: "78vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
                  {activePanel === "help" && "Hướng dẫn thư ký"}
                  {activePanel === "transaction-detail" && "Chi tiết giao dịch"}
                  {activePanel === "task-detail" && "Chi tiết công việc"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Hành động nhanh</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Tải hóa đơn nhanh chóng\n• Tạo công việc nhanh chóng\n• Mở bất kỳ thẻ nào để xem chi tiết</div></div>
                  <button onClick={() => setShowTxForm(true)} style={panelBtn}>Tải hóa đơn</button>
                </div>
              )}

              {activePanel === "transaction-detail" && selectedTransaction && (
                <TransactionDetail
                  tx={selectedTransaction}
                  profile={profile}
                  onClose={() => setActivePanel("")}
                  onAction={() => {
                    setActivePanel("");
                    setSelectedTransaction(null);
                    reloadAll(true);
                  }}
                />
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "Không có hạn"}</div></div>
                  <div style={{ ...subtleCard, padding: 14, fontSize: 13, color: T.text }}>Trạng thái: <strong>{selectedTask.status}</strong><br/>Ưu tiên: {selectedTask.priority || "trung bình"}<br/>{selectedTask.description || "Không có ghi chú"}</div>
                  {(!selectedTask.source || selectedTask.source === "task") && <button onClick={() => { toggleTaskStatus(selectedTask.item || selectedTask); setActivePanel(""); }} style={panelBtn}>Cập nhật trạng thái</button>}
                  {notifReturnTab && <button onClick={() => { setActivePanel(""); setTab(notifReturnTab); setNotifReturnTab(null); }} style={{ ...panelBtn, background: "white", border: `1px solid ${T.border}`, color: T.text }}>Quay lại tab trước</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {showCashLedgerForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 205, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "24px 24px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Bút toán sổ quỹ</div>
                <button onClick={() => setShowCashLedgerForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateCashLedgerEntry}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <select value={cashLedgerForm.type} onChange={(e) => setCashLedgerForm((p) => ({ ...p, type: e.target.value }))} style={inputStyle}>
                    <option value="expense">Chi</option>
                    <option value="income">Thu</option>
                  </select>
                  <select value={cashLedgerForm.entry_kind} onChange={(e) => {
                    const kind = e.target.value;
                    setCashLedgerForm((p) => ({ ...p, entry_kind: kind, type: kind === "fund_transfer_out" ? "expense" : p.type }));
                  }} style={inputStyle}>
                    <option value="ops">Vận hành</option>
                    <option value="fund_transfer_out">Chuyển quỹ đi</option>
                  </select>
                </div>
                <input type="number" min="0" step="0.01" placeholder="Số tiền" value={cashLedgerForm.amount} onChange={(e) => setCashLedgerForm((p) => ({ ...p, amount: e.target.value }))} style={{ ...inputStyle, marginTop: 10 }} required />
                <input type="date" value={cashLedgerForm.transaction_date} onChange={(e) => setCashLedgerForm((p) => ({ ...p, transaction_date: e.target.value }))} style={{ ...dateInputStyle, marginTop: 10 }} required />
                <input placeholder="Nội dung" value={cashLedgerForm.description} onChange={(e) => setCashLedgerForm((p) => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, marginTop: 10 }} />
                {cashLedgerForm.entry_kind === "fund_transfer_out" ? (
                  <select
                    value={cashLedgerForm.recipient_user_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const selected = transferRecipients.find((x) => String(x.id) === String(id));
                      setCashLedgerForm((p) => ({ ...p, recipient_user_id: id, recipient_name: selected?.full_name || "" }));
                    }}
                    style={{ ...inputStyle, marginTop: 10 }}
                    required
                  >
                    <option value="">Chọn người nhận quỹ</option>
                    {transferRecipients.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name} ({ROLE_VI[p.role] || p.role})</option>
                    ))}
                  </select>
                ) : (
                  <input placeholder="Người nhận (nếu có)" value={cashLedgerForm.recipient_name} onChange={(e) => setCashLedgerForm((p) => ({ ...p, recipient_name: e.target.value, recipient_user_id: "" }))} style={{ ...inputStyle, marginTop: 10 }} />
                )}
                <input placeholder="Mã giao dịch (nếu có)" value={cashLedgerForm.transaction_code} onChange={(e) => setCashLedgerForm((p) => ({ ...p, transaction_code: e.target.value }))} style={{ ...inputStyle, marginTop: 10 }} />
                <input placeholder="Link ảnh biên lai (nếu có)" value={cashLedgerForm.slip_image_url} onChange={(e) => setCashLedgerForm((p) => ({ ...p, slip_image_url: e.target.value }))} style={{ ...inputStyle, marginTop: 10 }} />
                <textarea placeholder="Ghi chú" value={cashLedgerForm.notes} onChange={(e) => setCashLedgerForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 88, resize: "none", paddingTop: 12, marginTop: 10 }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowCashLedgerForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Hủy</button>
                  <button type="submit" disabled={cashLedgerSubmitting} style={{ height: 46, borderRadius: 12, border: "none", background: cashLedgerSubmitting ? "#93e06e" : T.primary, color: "white", cursor: cashLedgerSubmitting ? "default" : "pointer", fontWeight: 800 }}>{cashLedgerSubmitting ? "Đang lưu..." : "Lưu"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showTaskForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "24px 24px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Việc mới</div>
                <button onClick={() => setShowTaskForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <label htmlFor="task-title" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Tiêu đề công việc</label>
                <input id="task-title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Tiêu đề công việc" required style={inputStyle} />
                <label htmlFor="task-notes" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginTop: 10, marginBottom: 6 }}>Ghi chú</label>
                <textarea id="task-notes" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Ghi chú" style={{ ...inputStyle, minHeight: 90, resize: "none" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <label htmlFor="task-priority" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Ưu tiên</label>
                    <select id="task-priority" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                      <option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="task-due" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Hạn hoàn thành</label>
                    <input id="task-due" type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={dateInputStyle} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowTaskForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Hủy</button>
                  <button type="submit" disabled={taskSubmitting} style={{ height: 46, borderRadius: 12, border: "none", background: taskSubmitting ? "#93e06e" : T.primary, color: "white", cursor: taskSubmitting ? "default" : "pointer", fontWeight: 800 }}>{taskSubmitting ? "Đang tạo..." : "Tạo"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          padding: "10px 12px 18px",
          zIndex: 120,
        }}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id)} style={{ flex: 1, border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, color: active ? T.primary : T.textMuted }}>
                <MIcon name={item.icon} size={22} color={active ? T.primary : T.textMuted} />
                <span style={{ fontSize: 10, fontWeight: 800 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </StaffShell>
  );
}

const inputStyle = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: `1px solid ${T.border}`,
  background: "white",
  padding: "0 14px",
  fontSize: 14,
  lineHeight: "46px",
  boxSizing: "border-box",
};

const dateInputStyle = {
  ...inputStyle,
  display: "block",
  WebkitAppearance: "none",
  appearance: "none",
  paddingRight: 14,
};

const panelBtn = {
  height: 46,
  borderRadius: 12,
  border: "none",
  background: T.primary,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

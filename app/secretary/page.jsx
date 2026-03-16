"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import NotificationCenter from "../../components/shared/NotificationCenter";
import TransactionDetail from "../../components/shared/TransactionDetail";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtRelative, fmtVND } from "../../lib/format";
import TransactionForm from "../../components/TransactionForm";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
  { id: "home", label: "Home", icon: "home" },
  { id: "transactions", label: "Transactions", icon: "receipt_long" },
  { id: "tasks", label: "Tasks", icon: "task_alt" },
  { id: "calendar", label: "Schedule", icon: "calendar_month" },
];

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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  const [txFullLoaded, setTxFullLoaded] = useState(false);
  const [txPage, setTxPage] = useState(0);
  const TX_PER_PAGE = 5;

  const [serverSummary, setServerSummary] = useState(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [revealedTaskId, setRevealedTaskId] = useState(null);

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
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetch("/api/dashboard/secretary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setFunds(json.funds || []);
        setTasks(json.tasks || []);
        setTransactions(json.recentTx || []);
        setServerSummary({ todaySummary: json.todaySummary, pendingCount: json.pendingCount });
      } else {
        /* Fallback: direct Supabase queries */
        const [fundsRes, tasksRes, txRes] = await Promise.all([
          supabase.from("funds").select("*").order("id"),
          supabase.from("tasks").select("*").order("due_date", { ascending: true }),
          supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(20),
        ]);
        setFunds(fundsRes.data || []);
        setTasks(tasksRes.data || []);
        setTransactions(txRes.data || []);
      }
    } catch (err) {
      console.error("Secretary loadSummary error:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  /* ── Full transactions: loaded only when Transactions tab is first opened ── */
  const loadFullTransactions = useCallback(async (limit = 30) => {
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
      console.error("Secretary loadFullTransactions error:", err);
    }
  }, [getToken]);

  /* Convenience reload used after mutations (task create, audit action, tx submit) */
  const reloadAll = useCallback(async () => {
    if (txFullLoaded) {
      await Promise.all([loadSummary(), loadFullTransactions()]);
    } else {
      await loadSummary();
    }
  }, [txFullLoaded, loadSummary, loadFullTransactions]);

  useEffect(() => {
    if (!profile?.id) return;
    loadSummary();
  }, [profile?.id, loadSummary]);

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

  /* Lazy-load full transactions on first visit to Transactions tab */
  useEffect(() => {
    if (tab !== "transactions" || txFullLoaded) return;
    loadFullTransactions();
  }, [tab, txFullLoaded, loadFullTransactions]);

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
      console.warn("Secretary notifyTaskEvent failed:", error);
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
    const ok = typeof window === "undefined" ? true : window.confirm("Delete this task?");
    if (!ok) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id).eq("created_by", profile.id);
    if (error) {
      alert(error.message || "Failed to delete task");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setRevealedTaskId(null);
    if (selectedTask?.id === task.id) {
      setSelectedTask(null);
      setActivePanel("");
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

  const fundsBalance = useMemo(() => funds.reduce((s, f) => s + Number(f.current_balance || 0), 0), [funds]);
  const fundedEntries = useMemo(() => funds.filter((f) => Number(f.current_balance || 0) !== 0).length, [funds]);
  const ledgerBalance = useMemo(() => transactions.reduce((sum, tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.type === "income") return sum + amount;
    if (tx.type === "expense") return sum - amount;
    return sum;
  }, 0), [transactions]);
  const usingLedgerFallback = useMemo(() => fundedEntries === 0 && transactions.length > 0, [fundedEntries, transactions.length]);
  const totalBalance = useMemo(() => (usingLedgerFallback ? ledgerBalance : fundsBalance), [usingLedgerFallback, fundsBalance, ledgerBalance]);
  const pendingTx = useMemo(() => transactions.filter((t) => t.status === "pending"), [transactions]);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current - 2; y <= current + 1; y++) years.push(y);
    return years;
  }, []);
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
  const todayTasks = useMemo(() => tasks.filter((t) => (t.due_date || "").startsWith(today)), [tasks, today]);
  const overdueTasks = useMemo(() => tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date.slice(0, 10) < today), [tasks, today]);
  const recentTransactions = useMemo(() => transactions.slice(0, 8), [transactions]);
  const getTxFilterDate = (tx) => {
    const candidate = tx.transaction_date || tx.created_at;
    const d = new Date(candidate || Date.now());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };
  const txMonthFiltered = useMemo(() => transactions.filter((tx) => {
    const base = getTxFilterDate(tx);
    return base.getMonth() === selectedMonth && base.getFullYear() === selectedYear;
  }), [transactions, selectedMonth, selectedYear]);
  const txFiltered = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    if (!q) return txMonthFiltered;
    return txMonthFiltered.filter((tx) => [
      tx.description,
      tx.recipient_name,
      tx.bank_name,
      tx.transaction_code,
      tx.profiles?.full_name,
      tx.status,
      tx.type,
    ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [txMonthFiltered, txSearch]);

  /* Reset page when filters change */
  useEffect(() => { setTxPage(0); }, [txSearch, selectedMonth, selectedYear]);

  const txTotalPages = Math.max(1, Math.ceil(txFiltered.length / TX_PER_PAGE));
  const txPageItems = useMemo(() => txFiltered.slice(txPage * TX_PER_PAGE, (txPage + 1) * TX_PER_PAGE), [txFiltered, txPage]);

  const txIncomeTotal = useMemo(() => txMonthFiltered.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [txMonthFiltered]);
  const txExpenseTotal = useMemo(() => txMonthFiltered.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [txMonthFiltered]);
  const txPendingCount = useMemo(() => txMonthFiltered.filter((tx) => tx.status === "pending").length, [txMonthFiltered]);

  useEffect(() => {
    if (!transactions.length) return;
    const latest = getTxFilterDate(transactions[0]);
    const hasCurrentSelection = transactions.some((tx) => {
      const d = getTxFilterDate(tx);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    if (!hasCurrentSelection) {
      setSelectedMonth(latest.getMonth());
      setSelectedYear(latest.getFullYear());
    }
  }, [transactions]);

  const isTodayTransaction = (t) => {
    const createdKey = getLocalDateKey(t.created_at);
    const transactionKey = getLocalDateKey(t.transaction_date);
    return createdKey === today || transactionKey === today;
  };
  const incomeToday = useMemo(() => serverSummary?.todaySummary?.income ?? transactions.filter((t) => t.type === "income" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [serverSummary, transactions, today]);
  const expenseToday = useMemo(() => serverSummary?.todaySummary?.expense ?? transactions.filter((t) => t.type === "expense" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [serverSummary, transactions, today]);
  const upcomingItems = useMemo(() => tasks.filter((t) => t.due_date).slice().sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")), [tasks]);

  return (
    <StaffShell role="secretary">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Secretary"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Secretary Studio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Secretary"}</div>
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
            <div style={{ fontSize: 13, color: T.textMuted }}>Loading...</div>
          ) : (
            <>
              {tab === "home" && (
                <div>
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#20341d 0%, #2b4b24 58%, #3d6b30 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -28, top: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Desk overview</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Desk calm</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Secretary</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Tracked balance</div>
                      <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{fmtVND(totalBalance)}</div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: usingLedgerFallback ? "#fbbf24" : "#86efac" }} />
                        {usingLedgerFallback ? "Ledger fallback" : "Synced from funds"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Pending</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{pendingTx.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Today</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{todayTasks.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Overdue</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{overdueTasks.length}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div style={{ ...subtleCard, padding: 14 }}>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>In today</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.success, marginTop: 6 }}>{fmtVND(incomeToday)}</div>
                    </div>
                    <div style={{ ...subtleCard, padding: 14 }}>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Out today</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.danger, marginTop: 6 }}>{fmtVND(expenseToday)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <QuickAction icon="upload_file" label="Upload slip" sub="Scan receipt and log transaction" onClick={() => setShowTxForm(true)} primary />
                    <QuickAction icon="task_alt" label="New task" sub="Create a task in seconds" onClick={() => setShowTaskForm(true)} />
                  </div>

                  <div style={{ ...subtleCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Quiet assets</div>
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
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>Art note</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Bronze study</div>
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
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>Collection</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Tea vessel</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...subtleCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Today focus</div>
                      <button onClick={() => setTab("tasks")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {todayTasks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <MIcon name="event_available" size={28} color={T.textMuted} />
                        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>No tasks due today.</div>
                      </div>
                    ) : todayTasks.slice(0, 3).map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: task.priority === "urgent" ? T.danger : task.priority === "high" ? T.amber : T.primary, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{task.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description || "No notes"}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Recent flow</div>
                      <button onClick={() => setTab("transactions")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {recentTransactions.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <MIcon name="receipt_long" size={28} color={T.textMuted} />
                        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>No transactions yet.</div>
                      </div>
                    ) : recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 12, background: tx.type === "income" ? "#eafaf2" : "#fff1f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MIcon name={tx.type === "income" ? "south_west" : "north_east"} size={18} color={tx.type === "income" ? T.success : T.danger} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description || tx.recipient_name || "Transactions"}</div>
                            <div style={{ fontSize: 12, color: T.textMuted }}>{fmtRelative(tx.created_at)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: tx.type === "income" ? T.success : T.danger }}>{tx.type === "income" ? "+" : "-"}{fmtVND(Math.abs(Number(tx.amount || 0)))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "transactions" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Transactions</div>
                    <button onClick={() => setShowTxForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      + Upload slip
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ flex: 1, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}>
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: 90, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>

                  <div style={{ position: "relative", marginBottom: 14 }}>
                    <MIcon name="search" size={18} color={T.textMuted} style={{ position: "absolute", left: 14, top: 12 }} />
                    <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search transactions..." style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, paddingLeft: 40, paddingRight: 14, fontSize: 14, color: T.text, boxSizing: "border-box" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.success, letterSpacing: "0.06em" }}>Income</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.success, marginTop: 4 }}>{fmtVND(txIncomeTotal)}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.danger, letterSpacing: "0.06em" }}>Expense</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.danger, marginTop: 4 }}>{fmtVND(txExpenseTotal)}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.amber, letterSpacing: "0.06em" }}>Pending</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.amber, marginTop: 4 }}>{txPendingCount}</div>
                    </div>
                  </div>

                  {txFiltered.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center" }}>
                      <MIcon name="search_off" size={32} color={T.textMuted} />
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>No transactions found.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gap: 8 }}>
                        {txPageItems.map((tx) => {
                          const isIncome = tx.type === "income";
                          const statusColor = tx.status === "approved" ? T.success : tx.status === "pending" ? T.amber : T.danger;
                          return (
                            <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("transaction-detail"); }} style={{ ...cardStyle, padding: 14, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${T.border}` }}>
                              <div style={{ width: 42, height: 42, borderRadius: 12, background: isIncome ? "#ecfdf3" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <MIcon name={isIncome ? "trending_up" : "trending_down"} size={20} color={isIncome ? T.success : T.danger} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 12, alignItems: "start" }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {tx.description || tx.recipient_name || (isIncome ? "Income" : "Expense")}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, minWidth: 0, flexWrap: "wrap" }}>
                                    <div style={{ fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {tx.profiles?.full_name || "—"} · {fmtDate(tx.transaction_date || tx.created_at)}
                                    </div>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: `${statusColor}15`, color: statusColor, fontSize: 10, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                                      {tx.status}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: isIncome ? T.success : T.danger, whiteSpace: "nowrap", textAlign: "right", alignSelf: "center" }}>
                                  {isIncome ? "+" : "−"}{fmtVND(Math.abs(Number(tx.amount || 0)))}
                                </div>
                              </div>
                            </button>
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
                        {txFiltered.length} transactions · Page {txPage + 1} of {txTotalPages}
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "tasks" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Tasks</div>
                    <button onClick={() => setShowTaskForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      + Create
                    </button>
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center" }}>
                      <MIcon name="task_alt" size={32} color={T.textMuted} />
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>No tasks yet.</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tasks.map((task) => {
                        const canDelete = task.created_by === profile?.id;
                        const swipe = getSwipeHandlers(task);
                        return (
                          <div key={task.id} style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
                            {canDelete && (
                              <button onClick={() => handleDeleteTask(task)} style={{ position: "absolute", inset: 0, marginLeft: "auto", width: 88, border: "none", background: T.danger, color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                                Delete
                              </button>
                            )}
                            <button
                              {...swipe}
                              key={task.id}
                              onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }}
                              style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}`, position: "relative", transform: canDelete && revealedTaskId === task.id ? "translateX(-88px)" : "translateX(0)", transition: "transform 180ms ease" }}>
                              <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                                  {task.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description}</div>}
                                  {task.due_date && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Due: {fmtDate(task.due_date)}</div>}
                                </div>
                                <div style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: task.status === "done" ? T.success : task.status === "in_progress" ? T.amber : T.textMuted,
                                  background: task.status === "done" ? "#e9fff5" : task.status === "in_progress" ? "#fff7e6" : "#f2f4f1",
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  whiteSpace: "nowrap",
                                }}>{task.status}</div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "calendar" && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>Upcoming</div>
                  {upcomingItems.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center" }}>
                      <MIcon name="calendar_month" size={32} color={T.textMuted} />
                      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8 }}>No upcoming items.</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {upcomingItems.map((item) => (
                        <button key={item.id} onClick={() => { setSelectedTask(item); setActivePanel("task-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{fmtDate(item.due_date)}</div>
                        </button>
                      ))}
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
                  {activePanel === "help" && "Secretary Guide"}
                  {activePanel === "transaction-detail" && "Transaction details"}
                  {activePanel === "task-detail" && "Task details"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Quick actions</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Upload a slip fast\n• Create a task quickly\n• Open any card to view details</div></div>
                  <button onClick={() => setShowTxForm(true)} style={panelBtn}>Upload slip</button>
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
                    reloadAll();
                  }}
                />
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "No deadline"}</div></div>
                  <div style={{ ...subtleCard, padding: 14, fontSize: 13, color: T.text }}>Status: <strong>{selectedTask.status}</strong><br/>Priority: {selectedTask.priority || "medium"}<br/>{selectedTask.description || "No notes"}</div>
                  <button onClick={() => { toggleTaskStatus(selectedTask); setActivePanel(""); }} style={panelBtn}>Update status</button>
                  {notifReturnTab && <button onClick={() => { setActivePanel(""); setTab(notifReturnTab); setNotifReturnTab(null); }} style={{ ...panelBtn, background: "white", border: `1px solid ${T.border}`, color: T.text }}>Back to previous tab</button>}
                </div>
              )}
            </div>
          </div>
        )}

        {showTaskForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "24px 24px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>New task</div>
                <button onClick={() => setShowTaskForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <label htmlFor="task-title" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Task title</label>
                <input id="task-title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" required style={inputStyle} />
                <label htmlFor="task-notes" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginTop: 10, marginBottom: 6 }}>Notes</label>
                <textarea id="task-notes" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Notes" style={{ ...inputStyle, minHeight: 90, resize: "none" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <label htmlFor="task-priority" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Priority</label>
                    <select id="task-priority" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="task-due" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Due date</label>
                    <input id="task-due" type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={dateInputStyle} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowTaskForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                  <button type="submit" disabled={taskSubmitting} style={{ height: 46, borderRadius: 12, border: "none", background: taskSubmitting ? "#93e06e" : T.primary, color: "white", cursor: taskSubmitting ? "default" : "pointer", fontWeight: 800 }}>{taskSubmitting ? "Creating..." : "Create"}</button>
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

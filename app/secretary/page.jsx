"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtRelative, fmtVND } from "../../lib/format";
import TransactionForm from "../../components/TransactionForm";

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

export default function SecretaryPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  useEffect(() => {
    if (!profile?.id) return;
    loadData();
  }, [profile?.id]);

  async function loadData() {
    try {
      setLoading(true);
      const [fundsRes, txRes, tasksRes] = await Promise.all([
        supabase.from("funds").select("*").order("id"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
      ]);
      setFunds(fundsRes.data || []);
      setTransactions(txRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (err) {
      console.error("Secretary loadData error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTask.title.trim() || !profile?.id) return;
    const { error } = await supabase.from("tasks").insert({
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      due_date: newTask.due_date || null,
      created_by: profile.id,
      status: "pending",
    });
    if (error) {
      console.error(error);
      return;
    }
    setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
    setShowTaskForm(false);
    loadData();
  }

  async function toggleTaskStatus(task) {
    const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "done" : "pending";
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", task.id);
    if (!error) loadData();
  }

  const fundsBalance = useMemo(() => funds.reduce((s, f) => s + Number(f.current_balance || 0), 0), [funds]);
  const ledgerBalance = useMemo(() => transactions.reduce((sum, tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.type === "income") return sum + amount;
    if (tx.type === "expense") return sum - amount;
    return sum;
  }, 0), [transactions]);
  const totalBalance = useMemo(() => (fundsBalance !== 0 ? fundsBalance : ledgerBalance), [fundsBalance, ledgerBalance]);
  const pendingTx = useMemo(() => transactions.filter((t) => t.status === "pending"), [transactions]);
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
  const isTodayTransaction = (t) => {
    const createdKey = getLocalDateKey(t.created_at);
    const transactionKey = getLocalDateKey(t.transaction_date);
    return createdKey === today || transactionKey === today;
  };
  const incomeToday = useMemo(() => transactions.filter((t) => t.type === "income" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [transactions, today]);
  const expenseToday = useMemo(() => transactions.filter((t) => t.type === "expense" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [transactions, today]);
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
                      <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 16 }}>{fmtVND(totalBalance)}</div>
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
                            backgroundImage: "linear-gradient(180deg, rgba(16,20,16,0.04) 0%, rgba(16,20,16,0.48) 72%, rgba(16,20,16,0.72) 100%), url('/art-blocks/art-note-bronze-study.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            transform: "scale(1.02)",
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
                            backgroundImage: "linear-gradient(180deg, rgba(12,22,14,0.08) 0%, rgba(12,22,14,0.52) 74%, rgba(12,22,14,0.78) 100%), url('/art-blocks/collection-tea-vessel.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            transform: "scale(1.02)",
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
                      <div style={{ fontSize: 13, color: T.textMuted }}>No tasks due today.</div>
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
                      <div style={{ fontSize: 13, color: T.textMuted }}>No transactions yet.</div>
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
                  <button onClick={() => window.location.href = "/transactions"} style={{ ...cardStyle, width: "100%", padding: 14, marginBottom: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${T.primary}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><MIcon name="receipt_long" size={20} color={T.primary} /></div>
                      <div><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Audit Ledger</div><div style={{ fontSize: 12, color: T.textMuted }}>Review all transactions</div></div>
                    </div>
                    <MIcon name="chevron_right" size={20} color={T.textMuted} />
                  </button>
                  {transactions.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>
                      No transactions yet. Tap <strong>Upload slip</strong> to log the first one.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {transactions.map((tx) => (
                        <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("transaction-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{tx.description || tx.recipient_name || "Transactions"}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(tx.transaction_date || tx.created_at)}{tx.bank_name ? ` • ${tx.bank_name}` : ""}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Status: {tx.status || "pending"}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: tx.type === "income" ? T.success : T.danger }}>{tx.type === "income" ? "+" : "-"}{fmtVND(Math.abs(Number(tx.amount || 0)))}</div>
                          </div>
                        </button>
                      ))}
                    </div>
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
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>No tasks yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tasks.map((task) => (
                        <button key={task.id} onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
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
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "calendar" && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>Upcoming</div>
                  {upcomingItems.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>No upcoming items.</div>
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

        {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} onSuccess={() => { setShowTxForm(false); loadData(); }} />}

        {activePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 220, display: "flex", alignItems: "flex-end" }} onClick={() => setActivePanel("")}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "78vh", overflowY: "auto" }}>
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
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTransaction.description || selectedTransaction.recipient_name || "Transactions"}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedTransaction.transaction_date || selectedTransaction.created_at)}</div>
                  </div>
                  <div style={{ ...subtleCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Amount: <strong>{fmtVND(Math.abs(Number(selectedTransaction.amount || 0)))}</strong></div>
                    <div>Type: {selectedTransaction.type || "expense"}</div>
                    <div>Status: {selectedTransaction.status || "pending"}</div>
                    {selectedTransaction.bank_name && <div>Bank: {selectedTransaction.bank_name}</div>}
                  </div>
                  <button onClick={() => { setActivePanel(""); setTab("transactions"); }} style={panelBtn}>Back to Transactions</button>
                </div>
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "No deadline"}</div></div>
                  <div style={{ ...subtleCard, padding: 14, fontSize: 13, color: T.text }}>Status: <strong>{selectedTask.status}</strong><br/>Priority: {selectedTask.priority || "medium"}<br/>{selectedTask.description || "No notes"}</div>
                  <button onClick={() => { toggleTaskStatus(selectedTask); setActivePanel(""); }} style={panelBtn}>Update status</button>
                </div>
              )}
            </div>
          </div>
        )}

        {showTaskForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>New task</div>
                <button onClick={() => setShowTaskForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" required style={inputStyle} />
                <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Notes" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowTaskForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Create</button>
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
  boxSizing: "border-box",
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

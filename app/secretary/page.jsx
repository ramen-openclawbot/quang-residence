"use client";

import { useState, useEffect } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { supabase } from "../../lib/supabase";
import { T, card, flexBetween, flexCenter, sectionLabel, cardCompact } from "../../lib/tokens";
import { fmtVND, fmtDate, fmtRelative } from "../../lib/format";
import { getIcon } from "../../components/shared/Icons";
import StatusBadge from "../../components/shared/StatusBadge";
import Skeleton from "../../components/shared/Skeleton";
import TransactionForm from "../../components/TransactionForm";
import { useAuth } from "../../lib/auth";

const TABS = [
  { id: "funds", label: "Funds", icon: "savings" },
  { id: "tasks", label: "Tasks", icon: "task_alt" },
  { id: "transactions", label: "Transactions", icon: "receipt_long" },
  { id: "schedule", label: "Schedule", icon: "calendar_today" },
];

export default function SecretaryPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("funds");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    assigned_to: "",
  });

  // Load all data on mount
  useEffect(() => {
    if (!profile?.id) return;
    loadData();
  }, [profile?.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load funds
      const { data: fundsData } = await supabase
        .from("funds")
        .select("*")
        .order("created_at", { ascending: false });
      setFunds(fundsData || []);

      // Load transactions (last 50)
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(txData || []);

      // Load tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });
      setTasks(tasksData || []);

      // Load categories
      const { data: catsData } = await supabase
        .from("categories")
        .select("*");
      setCategories(catsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || !profile?.id) return;

    try {
      const { error } = await supabase.from("tasks").insert({
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        assigned_to: newTask.assigned_to || null,
        created_by: profile.id,
        status: "pending",
      });

      if (error) throw error;

      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assigned_to: "",
      });
      setShowTaskForm(false);
      loadData();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const statusCycle = { pending: "in_progress", in_progress: "done", done: "pending" };
    const nextStatus = statusCycle[currentStatus] || "pending";

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: nextStatus })
        .eq("id", taskId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleTransactionCreated = () => {
    setShowTxForm(false);
    loadData();
  };

  // Filter transactions by type
  const [txFilter, setTxFilter] = useState("all");
  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === "income") return tx.amount > 0;
    if (txFilter === "expense") return tx.amount < 0;
    return true;
  });

  // Get today's tasks
  const today = new Date().toISOString().split("T")[0];
  const todayTasks = tasks.filter((t) => t.due_date && t.due_date.startsWith(today));

  // Get upcoming calendar items
  const upcomingItems = [
    ...tasks.map((t) => ({
      date: t.due_date,
      title: t.title,
      type: "task",
      obj: t,
    })),
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <StaffShell role="secretary">
      <div style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ paddingTop: 16, paddingBottom: 24, paddingLeft: 16, paddingRight: 16, borderBottom: `1px solid ${T.border}` }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text1, margin: 0 }}>Secretary</h1>
        </div>

        {/* Content Container */}
        <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 24 }}>
          {loading && tab === "funds" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={120} />
              ))}
            </div>
          )}

          {/* FUNDS TAB */}
          {tab === "funds" && !loading && (
            <div>
            {/* Fund cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {funds.map((fund) => {
                const usage = fund.budget_monthly ? (fund.current_balance / fund.budget_monthly) * 100 : 0;
                const isOverBudget = fund.current_balance > (fund.budget_monthly || 0);
                return (
                  <div key={fund.id} style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 13, color: T.text2, marginBottom: 8 }}>
                      {fund.name}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                      {fmtVND(fund.current_balance)}
                    </div>
                    <div style={{ fontSize: 12, color: T.text3, marginBottom: 8 }}>
                      Budget: {fmtVND(fund.budget_monthly || 0)}
                    </div>
                    <div style={{
                      height: 6,
                      backgroundColor: T.bg2,
                      borderRadius: 4,
                      overflow: "hidden",
                    }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(usage, 100)}%`,
                          backgroundColor: isOverBudget ? T.danger : T.primary,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent transactions */}
            <div style={{ ...sectionLabel, marginBottom: 12 }}>RECENT TRANSACTIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transactions.slice(0, 10).map((tx) => {
                const cat = categories.find((c) => c.id === tx.category_id);
                const Icon = getIcon(cat?.icon_name || "wallet");
                return (
                  <div key={tx.id} style={{ ...card, padding: 12, ...flexBetween }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Icon size={20} color={cat?.color || T.text2} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {tx.description}
                        </div>
                        <div style={{ fontSize: 12, color: T.text3 }}>
                          {fmtRelative(tx.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: tx.amount > 0 ? T.success : T.danger,
                      }}>
                        {tx.amount > 0 ? "+" : ""}{fmtVND(tx.amount)}
                      </div>
                      <StatusBadge status={tx.status || "pending"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

          {/* TASKS TAB */}
          {tab === "tasks" && !loading && (
            <div>
              {/* Today's tasks */}
              <div style={{ ...sectionLabel, marginBottom: 12 }}>TODAY'S TASKS</div>
              {todayTasks.length === 0 ? (
                <div style={{ padding: 16, color: T.text3, textAlign: "center" }}>
                  No tasks today
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {todayTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTaskStatus(task.id, task.status)}
                      style={{
                        ...card,
                        padding: 12,
                        cursor: "pointer",
                        ...flexBetween,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: 12, color: T.text3, marginTop: 4 }}>
                          {task.description}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <StatusBadge status={task.status || "pending"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All tasks */}
              <div style={{ ...sectionLabel, marginBottom: 12 }}>ALL TASKS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTaskStatus(task.id, task.status)}
                    style={{
                      ...card,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ ...flexBetween, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {task.title}
                      </div>
                      <StatusBadge status={task.status || "pending"} />
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 12, color: T.text3, marginBottom: 8 }}>
                        {task.description}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: T.text3, display: "flex", gap: 16 }}>
                      {task.due_date && <span>Due: {fmtDate(task.due_date)}</span>}
                      {task.assigned_to && <span>Assigned to: {task.assigned_to}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Task form */}
              {!showTaskForm ? (
                <button
                  onClick={() => setShowTaskForm(true)}
                  style={{
                    position: "fixed",
                    bottom: 100,
                    right: 24,
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: T.primary,
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                >
                  <MIcon>add</MIcon>
                </button>
              ) : (
                <div style={{ ...cardCompact, padding: 16, marginBottom: 24 }}>
                  <form onSubmit={handleCreateTask}>
                    <input
                      type="text"
                      placeholder="Title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 12,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: "inherit",
                      }}
                      required
                    />
                    <textarea
                      placeholder="Description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 12,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: "inherit",
                        minHeight: 60,
                        resize: "none",
                      }}
                    />
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 12,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 12,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: "inherit",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Assigned to"
                      value={newTask.assigned_to}
                      onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        marginBottom: 12,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: "inherit",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          backgroundColor: T.primary,
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTaskForm(false)}
                        style={{
                          flex: 1,
                          padding: "10px 16px",
                          backgroundColor: T.bg2,
                          color: T.text1,
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TRANSACTIONS TAB */}
          {tab === "transactions" && !loading && (
            <div>
              {/* Filter row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["all", "income", "expense"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTxFilter(filter)}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: txFilter === filter ? T.primary : T.bg2,
                      color: txFilter === filter ? "white" : T.text1,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {filter === "all" && "All"}
                    {filter === "income" && "Income"}
                    {filter === "expense" && "Expense"}
                  </button>
                ))}
              </div>

              {/* Transaction list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {filteredTransactions.length === 0 ? (
                  <div style={{ padding: 16, color: T.text3, textAlign: "center" }}>
                    No transactions
                  </div>
                ) : (
                  filteredTransactions.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.category_id);
                    const Icon = getIcon(cat?.icon_name || "wallet");
                    return (
                      <div key={tx.id} style={{ ...card, padding: 12 }}>
                        <div style={{ ...flexBetween, marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Icon size={20} color={cat?.color || T.text2} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>
                                {tx.description}
                              </div>
                              <div style={{ fontSize: 12, color: T.text3 }}>
                                {tx.recipient_name && <span>{tx.recipient_name}</span>}
                                {tx.bank_name && <span> · {tx.bank_name}</span>}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: tx.amount > 0 ? T.success : T.danger,
                          }}>
                            {tx.amount > 0 ? "+" : ""}{fmtVND(tx.amount)}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: 12, color: T.text3 }}>
                            {fmtDate(tx.transaction_date || tx.created_at)}
                          </div>
                          <StatusBadge status={tx.status || "pending"} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Floating + button */}
              {!showTxForm && (
                <button
                  onClick={() => setShowTxForm(true)}
                  style={{
                    position: "fixed",
                    bottom: 100,
                    right: 24,
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: T.primary,
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                >
                  <MIcon>add</MIcon>
                </button>
              )}

              {/* Transaction Form Modal */}
              {showTxForm && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "flex-end",
                  zIndex: 1000,
                }}>
                  <div style={{
                    width: "100%",
                    backgroundColor: "white",
                    borderRadius: "16px 16px 0 0",
                    padding: 16,
                    maxHeight: "90vh",
                    overflowY: "auto",
                  }}>
                    <div style={{ ...flexBetween, marginBottom: 16 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>Add Transaction</div>
                      <button
                        onClick={() => setShowTxForm(false)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 24,
                          cursor: "pointer",
                          color: T.text2,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <TransactionForm onSuccess={handleTransactionCreated} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCHEDULE TAB */}
          {tab === "schedule" && !loading && (
            <div>
              {/* Calendar header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>
                  {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>

                {/* Upcoming items */}
                <div style={{ ...sectionLabel, marginBottom: 12 }}>UPCOMING EVENTS</div>
                {upcomingItems.length === 0 ? (
                  <div style={{ padding: 16, color: T.text3, textAlign: "center" }}>
                    No events
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {upcomingItems.map((item, idx) => (
                      <div key={idx} style={{ ...card, padding: 12 }}>
                        <div style={{ ...flexBetween }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: 12, color: T.text3, marginTop: 4 }}>
                              {item.date && fmtDate(item.date)}
                            </div>
                          </div>
                          <div style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            backgroundColor: T.primary,
                            color: "white",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {item.type === "task" && "Task"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 430,
          marginLeft: "auto",
          marginRight: "auto",
          display: "flex",
          gap: 0,
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 16,
          paddingRight: 16,
          backgroundColor: T.bg1,
          borderTop: `1px solid ${T.border}`,
          backdropFilter: "blur(10px)",
          backgroundColor: `rgba(${T.bg1}, 0.95)`,
          zIndex: 100,
        }}>
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "12px 8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: tab === id ? T.primary : T.text2,
                transition: "color 0.2s",
              }}
            >
              <MIcon style={{ fontSize: 24 }}>{icon}</MIcon>
              <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}

"use client";

import { useState, useEffect } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { supabase } from "../../lib/supabase";
import { fmtVND, fmtDate, fmtRelative } from "../../lib/format";
import StatusBadge from "../../components/shared/StatusBadge";
import Skeleton from "../../components/shared/Skeleton";
import TransactionForm from "../../components/TransactionForm";
import { useAuth } from "../../lib/auth";

const DESIGN_TOKENS = {
  primary: "#56c91d",
  bg: "#f6f8f6",
  text: "#1a2e1a",
  textMuted: "#94a3b8",
  textSec: "#4a5544",
  border: "#e2e8e2",
  card: "#ffffff",
  font: "'Manrope', sans-serif",
  success: "#10b981",
  danger: "#ef4444",
};

const CARD_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #56c91d0d",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const SECTION_LABEL_STYLE = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#94a3b8",
};

const TABS = [
  { id: "funds", label: "Funds", icon: "account_balance" },
  { id: "tasks", label: "Tasks", icon: "task_alt" },
  { id: "transactions", label: "Transactions", icon: "receipt_long" },
  { id: "calendar", label: "Calendar", icon: "calendar_month" },
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
      <div style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 100, backgroundColor: DESIGN_TOKENS.bg, minHeight: "100vh", fontFamily: DESIGN_TOKENS.font }}>
        {/* Header */}
        <div style={{
          paddingTop: 20,
          paddingBottom: 20,
          paddingLeft: 20,
          paddingRight: 20,
          borderBottom: `1px solid ${DESIGN_TOKENS.border}`,
          backgroundColor: DESIGN_TOKENS.card,
        }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: DESIGN_TOKENS.text,
            margin: 0,
            fontFamily: DESIGN_TOKENS.font,
          }}>Secretary</h1>
        </div>

        {/* Content Container */}
        <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 24, paddingBottom: 24 }}>
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={140} />
              ))}
            </div>
          )}

          {/* FUNDS TAB */}
          {tab === "funds" && !loading && (
            <div>
              {/* Fund cards grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                {funds.map((fund) => {
                  const usage = fund.budget_monthly ? (fund.current_balance / fund.budget_monthly) * 100 : 0;
                  const isOverBudget = fund.current_balance > (fund.budget_monthly || 0);
                  return (
                    <div key={fund.id} style={{ ...CARD_STYLE, padding: 16 }}>
                      <div style={{
                        fontSize: 13,
                        color: DESIGN_TOKENS.textMuted,
                        marginBottom: 12,
                        fontWeight: 500,
                      }}>
                        {fund.name}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        marginBottom: 12,
                        color: DESIGN_TOKENS.text,
                      }}>
                        {fmtVND(fund.current_balance)}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: DESIGN_TOKENS.textSec,
                        marginBottom: 12,
                      }}>
                        Budget: {fmtVND(fund.budget_monthly || 0)}
                      </div>
                      <div style={{
                        height: 6,
                        backgroundColor: "#e5e7eb",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(usage, 100)}%`,
                            backgroundColor: isOverBudget ? DESIGN_TOKENS.danger : DESIGN_TOKENS.primary,
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent transactions */}
              <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 16 }}>Recent Transactions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {transactions.slice(0, 8).map((tx) => (
                  <div key={tx.id} style={{
                    ...CARD_STYLE,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                    }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: DESIGN_TOKENS.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <MIcon style={{ fontSize: 20, color: DESIGN_TOKENS.primary }}>receipt</MIcon>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: DESIGN_TOKENS.text,
                        }}>
                          {tx.description}
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: DESIGN_TOKENS.textMuted,
                          marginTop: 2,
                        }}>
                          {fmtRelative(tx.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: tx.amount > 0 ? DESIGN_TOKENS.success : DESIGN_TOKENS.danger,
                    }}>
                      {tx.amount > 0 ? "+" : ""}{fmtVND(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TASKS TAB */}
          {tab === "tasks" && !loading && (
            <div>
              {/* Today's tasks */}
              <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 16 }}>Today's Tasks</div>
              {todayTasks.length === 0 ? (
                <div style={{
                  padding: 32,
                  color: DESIGN_TOKENS.textMuted,
                  textAlign: "center",
                  marginBottom: 32,
                }}>
                  <MIcon style={{ fontSize: 32, display: "block", marginBottom: 8, opacity: 0.5 }}>inbox</MIcon>
                  No tasks today
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                  {todayTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTaskStatus(task.id, task.status)}
                      style={{
                        ...CARD_STYLE,
                        padding: 16,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: DESIGN_TOKENS.text,
                        }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div style={{
                            fontSize: 13,
                            color: DESIGN_TOKENS.textMuted,
                            marginTop: 4,
                          }}>
                            {task.description}
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: "6px 10px",
                        backgroundColor: task.status === "done" ? "#d1fae5" : "#fef3c7",
                        color: task.status === "done" ? "#065f46" : "#92400e",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}>
                        {task.status === "pending" ? "Pending" : task.status === "in_progress" ? "In Progress" : "Done"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All tasks */}
              <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 16 }}>All Tasks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 80 }}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTaskStatus(task.id, task.status)}
                    style={{
                      ...CARD_STYLE,
                      padding: 16,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                      gap: 12,
                    }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: DESIGN_TOKENS.text,
                      }}>
                        {task.title}
                      </div>
                      <div style={{
                        padding: "6px 10px",
                        backgroundColor: task.status === "done" ? "#d1fae5" : "#fef3c7",
                        color: task.status === "done" ? "#065f46" : "#92400e",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}>
                        {task.status === "pending" ? "Pending" : task.status === "in_progress" ? "In Progress" : "Done"}
                      </div>
                    </div>
                    {task.description && (
                      <div style={{
                        fontSize: 13,
                        color: DESIGN_TOKENS.textMuted,
                        marginBottom: 8,
                      }}>
                        {task.description}
                      </div>
                    )}
                    <div style={{
                      fontSize: 12,
                      color: DESIGN_TOKENS.textSec,
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                    }}>
                      {task.due_date && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <MIcon style={{ fontSize: 14 }}>event</MIcon>
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                      {task.assigned_to && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <MIcon style={{ fontSize: 14 }}>person</MIcon>
                          {task.assigned_to}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Floating action button */}
              {!showTaskForm && (
                <button
                  onClick={() => setShowTaskForm(true)}
                  style={{
                    position: "fixed",
                    bottom: 90,
                    right: 20,
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: DESIGN_TOKENS.primary,
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    boxShadow: "0 8px 24px rgba(86, 201, 29, 0.3)",
                  }}
                >
                  <MIcon style={{ fontSize: 28 }}>add</MIcon>
                </button>
              )}

              {/* Task form modal */}
              {showTaskForm && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "flex-end",
                  zIndex: 1000,
                }}>
                  <div style={{
                    width: "100%",
                    maxWidth: 430,
                    margin: "0 auto",
                    backgroundColor: DESIGN_TOKENS.card,
                    borderRadius: "16px 16px 0 0",
                    padding: 20,
                    maxHeight: "90vh",
                    overflowY: "auto",
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                    }}>
                      <h2 style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: DESIGN_TOKENS.text,
                        margin: 0,
                      }}>Create Task</h2>
                      <button
                        onClick={() => setShowTaskForm(false)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 24,
                          cursor: "pointer",
                          color: DESIGN_TOKENS.textMuted,
                          padding: 0,
                        }}
                      >
                        <MIcon>close</MIcon>
                      </button>
                    </div>
                    <form onSubmit={handleCreateTask}>
                      <input
                        type="text"
                        placeholder="Task title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          marginBottom: 16,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: DESIGN_TOKENS.font,
                          boxSizing: "border-box",
                        }}
                        required
                      />
                      <textarea
                        placeholder="Description (optional)"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          marginBottom: 16,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: DESIGN_TOKENS.font,
                          minHeight: 80,
                          resize: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          marginBottom: 16,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: DESIGN_TOKENS.font,
                          boxSizing: "border-box",
                        }}
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                      </select>
                      <input
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          marginBottom: 16,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: DESIGN_TOKENS.font,
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Assigned to (optional)"
                        value={newTask.assigned_to}
                        onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          marginBottom: 20,
                          border: `1px solid ${DESIGN_TOKENS.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontFamily: DESIGN_TOKENS.font,
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          type="submit"
                          style={{
                            flex: 1,
                            padding: "12px 16px",
                            backgroundColor: DESIGN_TOKENS.primary,
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: 14,
                            fontFamily: DESIGN_TOKENS.font,
                          }}
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTaskForm(false)}
                          style={{
                            flex: 1,
                            padding: "12px 16px",
                            backgroundColor: DESIGN_TOKENS.bg,
                            color: DESIGN_TOKENS.text,
                            border: `1px solid ${DESIGN_TOKENS.border}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: 14,
                            fontFamily: DESIGN_TOKENS.font,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRANSACTIONS TAB */}
          {tab === "transactions" && !loading && (
            <div>
              {/* Filter buttons */}
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                {["all", "income", "expense"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTxFilter(filter)}
                    style={{
                      padding: "8px 14px",
                      backgroundColor: txFilter === filter ? DESIGN_TOKENS.primary : DESIGN_TOKENS.bg,
                      color: txFilter === filter ? "white" : DESIGN_TOKENS.text,
                      border: txFilter === filter ? "none" : `1px solid ${DESIGN_TOKENS.border}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      transition: "all 0.2s",
                    }}
                  >
                    {filter === "all" && "All"}
                    {filter === "income" && "Income"}
                    {filter === "expense" && "Expense"}
                  </button>
                ))}
              </div>

              {/* Transaction list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 80 }}>
                {filteredTransactions.length === 0 ? (
                  <div style={{
                    padding: 32,
                    color: DESIGN_TOKENS.textMuted,
                    textAlign: "center",
                  }}>
                    <MIcon style={{ fontSize: 32, display: "block", marginBottom: 8, opacity: 0.5 }}>receipt_long</MIcon>
                    No transactions
                  </div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div key={tx.id} style={{ ...CARD_STYLE, padding: 16 }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flex: 1,
                        }}>
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            backgroundColor: DESIGN_TOKENS.bg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            <MIcon style={{ fontSize: 20, color: DESIGN_TOKENS.primary }}>attach_money</MIcon>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: DESIGN_TOKENS.text,
                            }}>
                              {tx.description}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: DESIGN_TOKENS.textMuted,
                              marginTop: 2,
                            }}>
                              {tx.recipient_name && <span>{tx.recipient_name}</span>}
                              {tx.bank_name && <span> • {tx.bank_name}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: tx.amount > 0 ? DESIGN_TOKENS.success : DESIGN_TOKENS.danger,
                        }}>
                          {tx.amount > 0 ? "+" : ""}{fmtVND(tx.amount)}
                        </div>
                      </div>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 12,
                        borderTop: `1px solid ${DESIGN_TOKENS.border}`,
                      }}>
                        <div style={{
                          fontSize: 12,
                          color: DESIGN_TOKENS.textSec,
                        }}>
                          {fmtDate(tx.transaction_date || tx.created_at)}
                        </div>
                        <div style={{
                          padding: "4px 10px",
                          backgroundColor: tx.status === "completed" ? "#d1fae5" : "#fee2e2",
                          color: tx.status === "completed" ? "#065f46" : "#7f1d1d",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {tx.status === "completed" ? "Completed" : "Pending"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Floating action button */}
              {!showTxForm && (
                <button
                  onClick={() => setShowTxForm(true)}
                  style={{
                    position: "fixed",
                    bottom: 90,
                    right: 20,
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: DESIGN_TOKENS.primary,
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    boxShadow: "0 8px 24px rgba(86, 201, 29, 0.3)",
                  }}
                >
                  <MIcon style={{ fontSize: 28 }}>add</MIcon>
                </button>
              )}

              {/* Transaction form modal */}
              {showTxForm && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "flex-end",
                  zIndex: 1000,
                }}>
                  <div style={{
                    width: "100%",
                    maxWidth: 430,
                    margin: "0 auto",
                    backgroundColor: DESIGN_TOKENS.card,
                    borderRadius: "16px 16px 0 0",
                    padding: 20,
                    maxHeight: "90vh",
                    overflowY: "auto",
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                    }}>
                      <h2 style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: DESIGN_TOKENS.text,
                        margin: 0,
                      }}>Add Transaction</h2>
                      <button
                        onClick={() => setShowTxForm(false)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 24,
                          cursor: "pointer",
                          color: DESIGN_TOKENS.textMuted,
                          padding: 0,
                        }}
                      >
                        <MIcon>close</MIcon>
                      </button>
                    </div>
                    <TransactionForm onSuccess={handleTransactionCreated} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CALENDAR TAB */}
          {tab === "calendar" && !loading && (
            <div>
              {/* Month header */}
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 24,
                textAlign: "center",
                color: DESIGN_TOKENS.text,
              }}>
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>

              {/* Upcoming events */}
              <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 16 }}>Upcoming Events</div>
              {upcomingItems.length === 0 ? (
                <div style={{
                  padding: 32,
                  color: DESIGN_TOKENS.textMuted,
                  textAlign: "center",
                }}>
                  <MIcon style={{ fontSize: 32, display: "block", marginBottom: 8, opacity: 0.5 }}>calendar_month</MIcon>
                  No upcoming events
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 80 }}>
                  {upcomingItems.map((item, idx) => (
                    <div key={idx} style={{ ...CARD_STYLE, padding: 16 }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: DESIGN_TOKENS.text,
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: 13,
                            color: DESIGN_TOKENS.textMuted,
                            marginTop: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}>
                            <MIcon style={{ fontSize: 14 }}>event</MIcon>
                            {item.date && fmtDate(item.date)}
                          </div>
                        </div>
                        <div style={{
                          padding: "6px 12px",
                          backgroundColor: DESIGN_TOKENS.primary + "15",
                          color: DESIGN_TOKENS.primary,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}>
                          {item.type === "task" ? "Task" : "Event"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom navigation */}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          display: "flex",
          gap: 0,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
          backgroundColor: DESIGN_TOKENS.card,
          borderTop: `1px solid ${DESIGN_TOKENS.border}`,
          backdropFilter: "blur(10px)",
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
                gap: 6,
                padding: "8px 4px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: tab === id ? DESIGN_TOKENS.primary : DESIGN_TOKENS.textMuted,
                transition: "color 0.2s",
              }}
            >
              <MIcon style={{
                fontSize: 24,
                color: "inherit",
              }}>
                {icon}
              </MIcon>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: "inherit",
              }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </StaffShell>
  );
}

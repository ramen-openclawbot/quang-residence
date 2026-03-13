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
  { id: "transactions", label: "Giao dịch", icon: "receipt_long" },
  { id: "tasks", label: "Việc", icon: "task_alt" },
  { id: "calendar", label: "Lịch", icon: "calendar_month" },
];

const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(16,24,16,0.04)",
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

  const totalBalance = useMemo(() => funds.reduce((s, f) => s + Number(f.current_balance || 0), 0), [funds]);
  const pendingTx = useMemo(() => transactions.filter((t) => t.status === "pending"), [transactions]);
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = useMemo(() => tasks.filter((t) => (t.due_date || "").startsWith(today)), [tasks, today]);
  const overdueTasks = useMemo(() => tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date.slice(0, 10) < today), [tasks, today]);
  const recentTransactions = useMemo(() => transactions.slice(0, 8), [transactions]);
  const upcomingItems = useMemo(() => tasks.filter((t) => t.due_date).slice().sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")), [tasks]);

  return (
    <StaffShell role="secretary">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Secretary"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Secretary Dashboard</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Thư ký"}</div>
              </div>
            </div>
            <button onClick={signOut} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
              <MIcon name="logout" size={22} color={T.textMuted} />
            </button>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: T.textMuted }}>Đang tải dữ liệu...</div>
          ) : (
            <>
              {tab === "home" && (
                <div>
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 16, background: "linear-gradient(135deg,#1f331b,#294a21)", color: "white" }}>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Tổng quan hôm nay</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>{fmtVND(totalBalance)}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>Chờ duyệt</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{pendingTx.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>Việc hôm nay</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{todayTasks.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>Quá hạn</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{overdueTasks.length}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <QuickAction icon="upload_file" label="Upload bank slip" sub="Quét biên lai & tạo giao dịch" onClick={() => setShowTxForm(true)} primary />
                    <QuickAction icon="task_alt" label="Tạo công việc" sub="Giao việc nhanh trong ngày" onClick={() => setShowTaskForm(true)} />
                  </div>

                  <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Các quỹ</div>
                      <button onClick={() => setTab("transactions")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Xem giao dịch</button>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {funds.slice(0, 4).map((fund) => (
                        <div key={fund.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{fund.name}</div>
                            <div style={{ fontSize: 12, color: T.textMuted }}>Budget: {fmtVND(fund.budget_monthly || 0)}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{fmtVND(fund.current_balance || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Giao dịch gần đây</div>
                      <button onClick={() => setTab("transactions")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở tab</button>
                    </div>
                    {recentTransactions.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Chưa có giao dịch nào.</div>
                    ) : recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description || tx.recipient_name || "Giao dịch"}</div>
                          <div style={{ fontSize: 12, color: T.textMuted }}>{fmtRelative(tx.created_at)}</div>
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
                  {transactions.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>
                      Chưa có giao dịch. Bấm <strong>Upload slip</strong> để tạo giao dịch đầu tiên.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {transactions.map((tx) => (
                        <div key={tx.id} style={{ ...cardStyle, padding: 16 }}>
                          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{tx.description || tx.recipient_name || "Giao dịch"}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(tx.transaction_date || tx.created_at)}{tx.bank_name ? ` • ${tx.bank_name}` : ""}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Trạng thái: {tx.status || "pending"}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: tx.type === "income" ? T.success : T.danger }}>{tx.type === "income" ? "+" : "-"}{fmtVND(Math.abs(Number(tx.amount || 0)))}</div>
                          </div>
                        </div>
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
                      + Tạo việc
                    </button>
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>Chưa có task nào.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tasks.map((task) => (
                        <button key={task.id} onClick={() => toggleTaskStatus(task)} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                              {task.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description}</div>}
                              {task.due_date && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Hạn: {fmtDate(task.due_date)}</div>}
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
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>Chưa có lịch / task sắp tới.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {upcomingItems.map((item) => (
                        <div key={item.id} style={{ ...cardStyle, padding: 16 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{fmtDate(item.due_date)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} onSuccess={() => { setShowTxForm(false); loadData(); }} />}

        {showTaskForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Tạo công việc</div>
                <button onClick={() => setShowTaskForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Tiêu đề công việc" required style={inputStyle} />
                <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Mô tả thêm" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
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
                  <button type="button" onClick={() => setShowTaskForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Huỷ</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Tạo việc</button>
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

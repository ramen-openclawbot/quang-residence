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
  blue: "#3b82f6",
};

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "trips", label: "Trips", icon: "directions_car" },
  { id: "expenses", label: "Expenses", icon: "receipt_long" },
  { id: "tasks", label: "Tasks", icon: "task_alt" },
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

function Avatar({ name }) {
  const letter = (name || "D").trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: "linear-gradient(135deg,#60a5fa,#2563eb)",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      fontWeight: 800,
      boxShadow: "0 8px 20px rgba(37,99,235,0.25)",
      flexShrink: 0,
    }}>{letter}</div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...softCard, padding: 14 }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || T.text, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ActionCard({ icon, label, sub, onClick, primary }) {
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

function statusTone(status) {
  if (status === "completed" || status === "done") return { bg: "#e9fff5", color: T.success };
  if (status === "in_progress") return { bg: "#fff7e6", color: T.amber };
  if (status === "cancelled") return { bg: "#fff1f1", color: T.danger };
  return { bg: "#eef4ff", color: T.blue };
}

function taskProgress(status) {
  if (status === "done" || status === "completed") return 100;
  if (status === "in_progress") return 60;
  return 0;
}

export default function DriverPage() {
  const { profile, signOut, getToken } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [trips, setTrips] = useState([]);
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
    fetchData();
  }, [profile?.id]);

  async function fetchData() {
    setLoading(true);
    try {
      const token = await getToken();
      let loaded = false;
      if (token) {
        const res = await fetch("/api/dashboard/driver", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setTrips(json.trips || []);
          setTransactions(json.transactions || []);
          setTasks(json.tasks || []);
          loaded = true;
        }
      }

      if (!loaded) {
        const [tripsRes, txRes, tasksRes] = await Promise.all([
          supabase.from("driving_trips").select("*").eq("assigned_to", profile.id).order("scheduled_time", { ascending: true }),
          supabase.from("transactions").select("*").eq("created_by", profile.id).order("created_at", { ascending: false }).limit(80),
          supabase.from("tasks").select("*").or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`).order("due_date", { ascending: true }),
        ]);
        setTrips(tripsRes.data || []);
        setTransactions(txRes.data || []);
        setTasks(tasksRes.data || []);
      }
    } catch (error) {
      console.error("Driver fetchData error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTripStatus(trip, newStatus) {
    const data = { status: newStatus };
    if (newStatus === "in_progress") data.actual_start = new Date().toISOString();
    if (newStatus === "completed") data.actual_end = new Date().toISOString();
    const { error } = await supabase.from("driving_trips").update(data).eq("id", trip.id);
    if (!error) fetchData();
  }

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
      console.warn("Driver notifyTaskEvent failed:", error);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTask.title.trim() || !profile?.id || taskSubmitting) return;
    setTaskSubmitting(true);
    try {
      const { data, error } = await supabase.from("tasks").insert({
        title: newTask.title.trim(),
        description: newTask.description || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        status: "pending",
        task_type: "driving",
        assigned_to: profile.id,
        created_by: profile.id,
      }).select("id").single();
      if (error) {
        console.error("Driver create task error:", error);
        return;
      }

      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
      setShowTaskForm(false);
      await notifyTaskEvent(data?.id, "created", "pending");
      fetchData();
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function updateTaskStatus(task, nextStatus = null) {
    const next = nextStatus || (task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "done" : "pending");
    const patch = {
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
    if (!error) {
      await notifyTaskEvent(task.id, "status_changed", next);
      fetchData();
    }
  }

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
  const todayTrips = useMemo(() => trips.filter((t) => getLocalDateKey(t.scheduled_time) === today), [trips, today]);
  const upcomingTrips = useMemo(() => trips.filter((t) => getLocalDateKey(t.scheduled_time) !== today), [trips, today]);
  const activeTrip = useMemo(() => trips.find((t) => t.status === "in_progress") || null, [trips]);
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const isCurrentDayTransaction = (t) => getLocalDateKey(t.transaction_date) === today || getLocalDateKey(t.created_at) === today;
  const getSignedAmount = (tx) => {
    const amount = Math.abs(Number(tx.amount || 0));
    const type = String(tx.type || "").toLowerCase();
    if (type === "income") return amount;
    if (type === "expense") return -amount;
    return -amount;
  };
  const todayExpense = useMemo(() => transactions.filter((t) => isCurrentDayTransaction(t)).reduce((s, t) => s + Math.abs(Math.min(0, getSignedAmount(t))), 0), [transactions, today]);
  const monthExpense = useMemo(() => {
    const monthKey = today.slice(0, 7);
    return transactions.filter((t) => [getLocalDateKey(t.transaction_date), getLocalDateKey(t.created_at)].some((key) => key.startsWith(monthKey))).reduce((s, t) => s + Math.abs(Math.min(0, getSignedAmount(t))), 0);
  }, [transactions, today]);

  return (
    <StaffShell role="driver">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Driver"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Driver Studio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Driver"}</div>
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
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#15293e 0%, #1f3d5d 56%, #27587c 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -22, top: -22, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>On the road</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Road rhythm</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Driver</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Trips, tasks, and a clear road ahead.</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Today</div><div style={{ fontSize: 18, fontWeight: 800 }}>{todayTrips.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Open tasks</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openTasks.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Live</div><div style={{ fontSize: 18, fontWeight: 800 }}>{activeTrip ? 1 : 0}</div></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <StatCard label="Out today" value={fmtVND(todayExpense)} color={T.danger} />
                    <StatCard label="This month" value={fmtVND(monthExpense)} color={T.text} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <ActionCard icon="upload_file" label="Log expense" sub="Receipt, fuel, parking" onClick={() => setShowTxForm(true)} primary />
                    <ActionCard icon="directions_car" label="Trips" sub="Open today’s route" onClick={() => setTab("trips")} />
                  </div>

                  {activeTrip && (
                    <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Live now</div>
                        <div style={{ padding: "6px 10px", borderRadius: 999, background: "#fff7e6", color: T.amber, fontSize: 11, fontWeight: 800 }}>in_progress</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{activeTrip.title}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{activeTrip.pickup_location || "—"} → {activeTrip.dropoff_location || "—"}</div>
                      <button onClick={() => updateTripStatus(activeTrip, "completed")} style={{ marginTop: 12, height: 42, borderRadius: 12, border: "none", background: T.primary, color: "white", fontWeight: 800, padding: "0 14px", cursor: "pointer" }}>
Complete trip
                      </button>
                    </div>
                  )}

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Today’s route</div>
                      <button onClick={() => setTab("trips")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {todayTrips.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>No trips today.</div>
                    ) : todayTrips.slice(0, 3).map((trip) => {
                      const tone = statusTone(trip.status);
                      return (
                        <button key={trip.id} onClick={() => { setSelectedTrip(trip); setActivePanel("trip-detail"); }} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{trip.title}</div>
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{trip.pickup_location || "—"} → {trip.dropoff_location || "—"}</div>
                          </div>
                          <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{trip.status}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Road objects</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 148, background: "#273039" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(10,14,18,0.06) 0%, rgba(10,14,18,0.46) 60%, rgba(10,14,18,0.82) 100%), url('/art-blocks/driver-rim-study.jpg')", backgroundSize: "cover", backgroundPosition: "center 34%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.20), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Collection</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Rim study</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 148, background: "#5f4736" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(22,16,12,0.04) 0%, rgba(22,16,12,0.42) 58%, rgba(22,16,12,0.78) 100%), url('/art-blocks/driver-leather-map.jpg')", backgroundSize: "cover", backgroundPosition: "center 40%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Travel piece</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Leather map</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Open tasks</div>
                      <button onClick={() => setTab("tasks")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {openTasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>No open tasks.</div>
                    ) : openTasks.slice(0, 4).map((task) => {
                      const tone = statusTone(task.status);
                      return (
                        <button key={task.id} onClick={() => updateTaskStatus(task)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.due_date ? `Due: ${fmtDate(task.due_date)}` : "No deadline"}</div>
                            </div>
                            <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{task.status}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "trips" && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>Trips</div>
                  {[{ title: "Hôm nay", items: todayTrips }, { title: "Sắp tới", items: upcomingTrips }].map((group) => (
                    <div key={group.title} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{group.title === "Hôm nay" ? "Today" : group.title === "Sắp tới" ? "Upcoming" : group.title}</div>
                      {group.items.length === 0 ? (
                        <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>No trips.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                          {group.items.map((trip) => {
                            const tone = statusTone(trip.status);
                            return (
                              <button key={trip.id} onClick={() => { setSelectedTrip(trip); setActivePanel("trip-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{trip.title}</div>
                                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{trip.pickup_location || "—"} → {trip.dropoff_location || "—"}</div>
                                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(trip.scheduled_time)}</div>
                                  </div>
                                  <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{trip.status}</div>
                                </div>
                                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                                  {trip.status === "scheduled" && <button onClick={() => updateTripStatus(trip, "in_progress")} style={primaryBtn}>Start</button>}
                                  {trip.status === "pending" && <button onClick={() => updateTripStatus(trip, "in_progress")} style={primaryBtn}>Start</button>}
                                  {trip.status === "in_progress" && <button onClick={() => updateTripStatus(trip, "completed")} style={primaryBtn}>Complete</button>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === "expenses" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Expenses</div>
                    <button onClick={() => setShowTxForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ New</button>
                  </div>
                  {transactions.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>No expenses logged yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {transactions.map((tx) => (
                        <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("expense-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{tx.description || tx.recipient_name || "Expense"}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{fmtRelative(tx.created_at)}</div>
                              {tx.bank_name && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{tx.bank_name}</div>}
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
                    <button onClick={() => setShowTaskForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Create</button>
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>No tasks yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tasks.map((task) => {
                        const tone = statusTone(task.status);
                        const progress = taskProgress(task.status);
                        return (
                          <button key={task.id} onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                                {task.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description}</div>}
                                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{task.due_date ? `Due: ${fmtDate(task.due_date)}` : "No deadline"}</div>
                                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>Progress {progress}%</div>
                              </div>
                              <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{task.status}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} onSuccess={() => { setShowTxForm(false); fetchData(); }} />}

        {activePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 220, display: "flex", alignItems: "flex-end" }} onClick={() => setActivePanel("")}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "78vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
                  {activePanel === "help" && "Driver Guide"}
                  {activePanel === "trip-detail" && "Trip details"}
                  {activePanel === "expense-detail" && "Expense details"}
                  {activePanel === "task-detail" && "Task details"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Quick actions</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Log expense from Home\n• Open any trip for details\n• Update task status in one tap</div></div>
                  <button onClick={() => setShowTxForm(true)} style={primaryBtn}>Log expense</button>
                </div>
              )}

              {activePanel === "trip-detail" && selectedTrip && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTrip.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedTrip.scheduled_time)}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Pickup: {selectedTrip.pickup_location || "—"}</div>
                    <div>Dropoff: {selectedTrip.dropoff_location || "—"}</div>
                    <div>Status: <strong>{selectedTrip.status}</strong></div>
                    {selectedTrip.notes && <div>Notes: {selectedTrip.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {(selectedTrip.status === "scheduled" || selectedTrip.status === "pending") && <button onClick={() => { updateTripStatus(selectedTrip, "in_progress"); setActivePanel(""); }} style={primaryBtn}>Start</button>}
                    {selectedTrip.status === "in_progress" && <button onClick={() => { updateTripStatus(selectedTrip, "completed"); setActivePanel(""); }} style={primaryBtn}>Complete</button>}
                  </div>
                </div>
              )}

              {activePanel === "expense-detail" && selectedTransaction && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTransaction.description || selectedTransaction.recipient_name || "Expense"}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedTransaction.transaction_date || selectedTransaction.created_at)}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Amount: <strong>{fmtVND(Math.abs(Number(selectedTransaction.amount || 0)))}</strong></div>
                    <div>Type: {selectedTransaction.type || "expense"}</div>
                    <div>Status: {selectedTransaction.status || "pending"}</div>
                    {selectedTransaction.bank_name && <div>Bank: {selectedTransaction.bank_name}</div>}
                  </div>
                  <button onClick={() => { setActivePanel(""); setTab("expenses"); }} style={primaryBtn}>Back to Expenses</button>
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
                    <div>Progress: <strong>{taskProgress(selectedTask.status)}%</strong></div>
                    <div>{selectedTask.description || "No notes"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {selectedTask.status !== "pending" && <button onClick={() => { updateTaskStatus(selectedTask, "pending"); setActivePanel(""); }} style={primaryBtn}>Mark pending</button>}
                    {selectedTask.status !== "in_progress" && <button onClick={() => { updateTaskStatus(selectedTask, "in_progress"); setActivePanel(""); }} style={primaryBtn}>Mark in progress</button>}
                    {selectedTask.status !== "done" && <button onClick={() => { updateTaskStatus(selectedTask, "done"); setActivePanel(""); }} style={primaryBtn}>Mark done</button>}
                  </div>
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
                <label htmlFor="driver-task-title" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Task title</label>
                <input id="driver-task-title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" required style={inputStyle} />
                <label htmlFor="driver-task-notes" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginTop: 10, marginBottom: 6 }}>Notes</label>
                <textarea id="driver-task-notes" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Notes" style={{ ...inputStyle, minHeight: 90, resize: "none", paddingTop: 12, paddingBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <label htmlFor="driver-task-priority" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Priority</label>
                    <select id="driver-task-priority" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="driver-task-due" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Due date</label>
                    <input id="driver-task-due" type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={dateInputStyle} />
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

const primaryBtn = {
  height: 40,
  borderRadius: 12,
  border: "none",
  background: T.primary,
  color: "white",
  fontWeight: 800,
  padding: "0 14px",
  cursor: "pointer",
};

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

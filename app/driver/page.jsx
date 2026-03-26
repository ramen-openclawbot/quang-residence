"use client";

import { useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtRelative, fmtVND } from "../../lib/format";
import { getSignedAmount, getLocalDateKey, getTodayKey } from "../../lib/transaction";
import TransactionForm from "../../components/TransactionForm";
import TransactionDetail from "../../components/shared/TransactionDetail";

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
  { id: "home", label: "Tổng quan", icon: "home" },
  { id: "trips", label: "Chuyến đi", icon: "directions_car" },
  { id: "expenses", label: "Chi tiêu", icon: "receipt_long" },
  { id: "tasks", label: "Công việc", icon: "task_alt" },
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

function getCategoryMeta(tx) {
  const c = tx?.categories;
  if (c) return { label: c.name_vi || c.name || "Chưa phân loại", color: c.color || "#94a3b8" };
  const m = tx?.ocr_raw_data?.category_meta;
  if (m) return { label: m.label_vi || m.code || "Chưa phân loại", color: "#94a3b8" };
  return { label: "Chưa phân loại", color: "#94a3b8" };
}

export default function DriverPage() {
  const { profile, signOut, getToken } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [revealedTaskId, setRevealedTaskId] = useState(null);
  const [activePanel, setActivePanel] = useState("");
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [trips, setTrips] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ current_balance: 0, today_expense: 0, month_expense: 0 });
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
      if (!token) throw new Error("Missing session token");
      const [res, agendaRes] = await Promise.all([
        fetch("/api/dashboard/driver", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/agenda/feed?limit=300", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!res.ok) throw new Error("Driver dashboard API failed");
      const json = await res.json();
      setTrips(json.trips || []);
      setTransactions(json.transactions || []);
      setSummary(json.summary || { current_balance: 0, today_expense: 0, month_expense: 0 });
      if (agendaRes.ok) {
        const agenda = await agendaRes.json();
        const taskItems = (agenda.items || []).filter((x) => x.source === "task").map((x) => x.payload || x);
        setTasks(taskItems);
      } else {
        setTasks(json.tasks || []);
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
      if (!res.ok) throw new Error(data.error || "Failed to delete task");

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (selectedTask?.id === task.id) {
        setSelectedTask(null);
        setActivePanel("");
      }
    } catch (err) {
      alert(err.message || "Failed to delete task");
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

  const today = useMemo(() => getTodayKey(), []);
  const todayTrips = useMemo(() => trips.filter((t) => getLocalDateKey(t.scheduled_time) === today), [trips, today]);
  const upcomingTrips = useMemo(() => trips.filter((t) => getLocalDateKey(t.scheduled_time) !== today), [trips, today]);
  const activeTrip = useMemo(() => trips.find((t) => t.status === "in_progress") || null, [trips]);
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const isCurrentDayTransaction = (t) => getLocalDateKey(t.transaction_date) === today || getLocalDateKey(t.created_at) === today;
  const todayExpense = summary?.today_expense ?? 0;
  const monthExpense = summary?.month_expense ?? 0;
  const currentBalance = summary?.current_balance ?? 0;

  return (
    <StaffShell role="driver">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Tài xế"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tài xế</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Tài xế"}</div>
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
            <div style={{ fontSize: 13, color: T.textMuted }}>Đang tải...</div>
          ) : (
            <>
              {tab === "home" && (
                <div>
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#15293e 0%, #1f3d5d 56%, #27587c 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -22, top: -22, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trên đường</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Nhịp đường</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Tài xế</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Chuyến đi, công việc và con đường phía trước.</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Số dư hiện có</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVND(currentBalance)}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Việc đang mở</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openTasks.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Trực tiếp</div><div style={{ fontSize: 18, fontWeight: 800 }}>{activeTrip ? 1 : 0}</div></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <StatCard label="Chi hôm nay" value={fmtVND(todayExpense)} color={T.danger} />
                    <StatCard label="Số dư hiện có" value={fmtVND(currentBalance)} color={currentBalance >= 0 ? T.text : T.danger} sub={`Chi tháng này ${fmtVND(monthExpense)}`} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <ActionCard icon="upload_file" label="Ghi chi phí" sub="Hóa đơn, xăng, đỗ xe" onClick={() => setShowTxForm(true)} primary />
                    <ActionCard icon="directions_car" label="Chuyến đi" sub="Mở lộ trình hôm nay" onClick={() => setTab("trips")} />
                  </div>

                  {activeTrip && (
                    <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Đang chạy</div>
                        <div style={{ padding: "6px 10px", borderRadius: 999, background: "#fff7e6", color: T.amber, fontSize: 11, fontWeight: 800 }}>in_progress</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{activeTrip.title}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{activeTrip.pickup_location || "—"} → {activeTrip.dropoff_location || "—"}</div>
                      <button onClick={() => updateTripStatus(activeTrip, "completed")} style={{ marginTop: 12, height: 42, borderRadius: 12, border: "none", background: T.primary, color: "white", fontWeight: 800, padding: "0 14px", cursor: "pointer" }}>
Hoàn thành
                      </button>
                    </div>
                  )}

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Lộ trình hôm nay</div>
                      <button onClick={() => setTab("trips")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    {todayTrips.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Hôm nay không có chuyến.</div>
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
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Bộ sưu tập</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 148, background: "#273039" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(10,14,18,0.06) 0%, rgba(10,14,18,0.46) 60%, rgba(10,14,18,0.82) 100%), url('/art-blocks/driver-rim-study.jpg')", backgroundSize: "cover", backgroundPosition: "center 34%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.20), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Bộ sưu tập</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Nghiên cứu mâm</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 148, background: "#5f4736" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(22,16,12,0.04) 0%, rgba(22,16,12,0.42) 58%, rgba(22,16,12,0.78) 100%), url('/art-blocks/driver-leather-map.jpg')", backgroundSize: "cover", backgroundPosition: "center 40%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Phụ kiện du lịch</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Bản đồ da</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Việc đang mở</div>
                      <button onClick={() => setTab("tasks")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    {openTasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Chưa có việc nào.</div>
                    ) : openTasks.slice(0, 4).map((task) => {
                      const tone = statusTone(task.status);
                      return (
                        <button key={task.id} onClick={() => updateTaskStatus(task)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.due_date ? `Hạn: ${fmtDate(task.due_date)}` : "Không có hạn"}</div>
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>Chuyến đi</div>
                  {[{ title: "Hôm nay", items: todayTrips }, { title: "Sắp tới", items: upcomingTrips }].map((group) => (
                    <div key={group.title} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{group.title === "Hôm nay" ? "Hôm nay" : group.title === "Sắp tới" ? "Sắp tới" : group.title}</div>
                      {group.items.length === 0 ? (
                        <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>Chưa có chuyến nào.</div>
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
                                  {trip.status === "scheduled" && <button onClick={() => updateTripStatus(trip, "in_progress")} style={primaryBtn}>Bắt đầu</button>}
                                  {trip.status === "pending" && <button onClick={() => updateTripStatus(trip, "in_progress")} style={primaryBtn}>Bắt đầu</button>}
                                  {trip.status === "in_progress" && <button onClick={() => updateTripStatus(trip, "completed")} style={primaryBtn}>Hoàn thành</button>}
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
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Chi tiêu</div>
                    <button onClick={() => setShowTxForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Mới</button>
                  </div>
                  {transactions.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>Chưa có chi phí nào.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {transactions.map((tx) => {
                        const signedAmount = getSignedAmount(tx);
                        const isPositive = signedAmount >= 0;
                        return (
                        <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("expense-detail"); }} style={{ ...cardStyle, width: "calc(100% - 4px)", margin: "0 auto", padding: 14, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}`, boxSizing: "border-box", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 10, alignItems: "start" }}>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description || tx.recipient_name || "Chi phí"}</div>
                            {(() => { const cat = getCategoryMeta(tx); return (
                              <div style={{ marginTop: 6 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 999, background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}33`, fontSize: 10, fontWeight: 700 }}>
                                  <span style={{ width: 5, height: 5, borderRadius: 999, background: cat.color }} />{cat.label}
                                </span>
                              </div>
                            ); })()}
                            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{fmtRelative(tx.created_at)}</div>
                            {tx.bank_name && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.bank_name}</div>}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isPositive ? T.success : T.danger, whiteSpace: "nowrap", minWidth: 92, textAlign: "right" }}>{isPositive ? "+" : "-"}{fmtVND(Math.abs(signedAmount))}</div>
                        </button>
                      );})}
                    </div>
                  )}
                </div>
              )}

              {tab === "tasks" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Công việc</div>
                    <button onClick={() => setShowTaskForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Tạo</button>
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>Chưa có công việc nào.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tasks.map((task) => {
                        const tone = statusTone(task.status);
                        const progress = taskProgress(task.status);
                        const canDelete = task.created_by === profile?.id;
                        const swipe = getSwipeHandlers(task);
                        return (
                          <div key={task.id} style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
                            {canDelete && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task); }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 88, border: "none", background: T.danger, color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", borderRadius: 18 }}>
                                Xóa
                              </button>
                            )}
                            <button {...swipe} onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}`, position: "relative", transform: canDelete && revealedTaskId === task.id ? "translateX(-88px)" : "translateX(0)", transition: "transform 180ms ease" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                                  {task.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description}</div>}
                                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{task.due_date ? `Hạn: ${fmtDate(task.due_date)}` : "Không có hạn"}</div>
                                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>Tiến độ {progress}%</div>
                                </div>
                                <div style={{ padding: "6px 10px", borderRadius: 999, background: tone.bg, color: tone.color, fontSize: 11, fontWeight: 800 }}>{task.status}</div>
                              </div>
                            </button>
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

        {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} onSuccess={() => { setShowTxForm(false); fetchData(); }} />}

        {activePanel === "expense-detail" && selectedTransaction && (
          <TransactionDetail
            tx={selectedTransaction}
            profile={profile || { role: "driver" }}
            onClose={() => setActivePanel("")}
            onAction={() => {}}
          />
        )}

        {activePanel && activePanel !== "expense-detail" && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 220, display: "flex", alignItems: "flex-end" }} onClick={() => setActivePanel("")}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "78vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
                  {activePanel === "help" && "Hướng dẫn"}
                  {activePanel === "trip-detail" && "Chi tiết chuyến đi"}
                  {activePanel === "expense-detail" && "Chi tiết chi phí"}
                  {activePanel === "task-detail" && "Chi tiết công việc"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Thao tác nhanh</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Ghi chi phí từ Tổng quan\n• Mở bất kỳ chuyến nào để xem chi tiết\n• Cập nhật trạng thái công việc chỉ với một lần chạm</div></div>
                  <button onClick={() => setShowTxForm(true)} style={primaryBtn}>Ghi chi phí</button>
                </div>
              )}

              {activePanel === "trip-detail" && selectedTrip && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTrip.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedTrip.scheduled_time)}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Điểm đón: {selectedTrip.pickup_location || "—"}</div>
                    <div>Điểm trả: {selectedTrip.dropoff_location || "—"}</div>
                    <div>Trạng thái: <strong>{selectedTrip.status}</strong></div>
                    {selectedTrip.notes && <div>Ghi chú: {selectedTrip.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {(selectedTrip.status === "scheduled" || selectedTrip.status === "pending") && <button onClick={() => { updateTripStatus(selectedTrip, "in_progress"); setActivePanel(""); }} style={primaryBtn}>Bắt đầu</button>}
                    {selectedTrip.status === "in_progress" && <button onClick={() => { updateTripStatus(selectedTrip, "completed"); setActivePanel(""); }} style={primaryBtn}>Hoàn thành</button>}
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
                    <div>Số tiền: <strong>{fmtVND(Math.abs(Number(selectedTransaction.amount || 0)))}</strong></div>
                    <div>Loại: {selectedTransaction.type || "expense"}</div>
                    <div>Trạng thái: {selectedTransaction.status || "pending"}</div>
                    {selectedTransaction.bank_name && <div>Ngân hàng: {selectedTransaction.bank_name}</div>}
                  </div>
                  <button onClick={() => { setActivePanel(""); setTab("expenses"); }} style={primaryBtn}>Quay lại Chi tiêu</button>
                </div>
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "No deadline"}</div>
                  </div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                    <div>Trạng thái: <strong>{selectedTask.status}</strong></div>
                    <div>Tiến độ: <strong>{taskProgress(selectedTask.status)}%</strong></div>
                    <div>{selectedTask.description || "Không có ghi chú"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {selectedTask.status !== "pending" && <button onClick={() => { updateTaskStatus(selectedTask, "pending"); setActivePanel(""); }} style={primaryBtn}>Đánh dấu đang chờ</button>}
                    {selectedTask.status !== "in_progress" && <button onClick={() => { updateTaskStatus(selectedTask, "in_progress"); setActivePanel(""); }} style={primaryBtn}>Đánh dấu đang thực hiện</button>}
                    {selectedTask.status !== "done" && <button onClick={() => { updateTaskStatus(selectedTask, "done"); setActivePanel(""); }} style={primaryBtn}>Đánh dấu hoàn thành</button>}
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
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Việc mới</div>
                <button onClick={() => setShowTaskForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <label htmlFor="driver-task-title" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Tiêu đề</label>
                <input id="driver-task-title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Tiêu đề" required style={inputStyle} />
                <label htmlFor="driver-task-notes" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginTop: 10, marginBottom: 6 }}>Ghi chú</label>
                <textarea id="driver-task-notes" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Ghi chú" style={{ ...inputStyle, minHeight: 90, resize: "none", paddingTop: 12, paddingBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <label htmlFor="driver-task-priority" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Ưu tiên</label>
                    <select id="driver-task-priority" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                      <option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="driver-task-due" style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>Hạn hoàn thành</label>
                    <input id="driver-task-due" type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} style={dateInputStyle} />
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

const timeInputStyle = {
  ...inputStyle,
  lineHeight: "normal",
  paddingRight: 10,
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

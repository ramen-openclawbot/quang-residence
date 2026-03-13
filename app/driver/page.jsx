"use client";

import { useState, useEffect } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { supabase } from "../../lib/supabase";
import { fmtVND, fmtDate, fmtRelative } from "../../lib/format";
import StatusBadge from "../../components/shared/StatusBadge";
import Skeleton from "../../components/shared/Skeleton";
import TransactionForm from "../../components/TransactionForm";
import { useAuth } from "../../lib/auth";

const DESIGN = {
  primary: "#56c91d",
  bg: "#f6f8f6",
  text: "#1a2e1a",
  textMuted: "#94a3b8",
  textSec: "#4a5544",
  border: "#e2e8e2",
  card: "#ffffff",
  font: "'Manrope', sans-serif",
};

const cardStyle = {
  backgroundColor: "#fff",
  border: "1px solid #56c91d0d",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const sectionLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#94a3b8",
  marginBottom: "0.75rem",
};

const TABS = [
  { id: "trips", label: "Trips", icon: "directions_car" },
  { id: "kitchen", label: "Kitchen", icon: "restaurant" },
  { id: "tasks", label: "Tasks", icon: "task_alt" },
];

export default function DriverPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("trips");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [trips, setTrips] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, txRes, tasksRes] = await Promise.all([
        supabase
          .from("driving_trips")
          .select("*")
          .eq("assigned_to", profile.id)
          .order("scheduled_time", { ascending: true }),
        supabase
          .from("transactions")
          .select("*")
          .eq("created_by", profile.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", profile.id)
          .order("due_date", { ascending: true }),
      ]);

      if (tripsRes.data) setTrips(tripsRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTripStatus = async (tripId, newStatus, updateData = {}) => {
    try {
      const data = { ...updateData, status: newStatus };
      if (newStatus === "in_progress") {
        data.actual_start = new Date().toISOString();
      } else if (newStatus === "completed") {
        data.actual_end = new Date().toISOString();
      }

      const { error } = await supabase
        .from("driving_trips")
        .update(data)
        .eq("id", tripId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error updating trip:", error);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const getStatusFlow = (currentStatus) => {
    const flow = {
      pending: "in_progress",
      in_progress: "done",
      done: "pending",
    };
    return flow[currentStatus] || "pending";
  };

  const getTodayTrips = () => {
    const today = new Date().toDateString();
    return trips.filter(
      (t) => new Date(t.scheduled_time).toDateString() === today
    );
  };

  const getFutureTrips = () => {
    const today = new Date().toDateString();
    return trips.filter(
      (t) => new Date(t.scheduled_time).toDateString() !== today
    );
  };

  const getUncompletedTasksCount = () => {
    return tasks.filter((t) => t.status !== "done").length;
  };

  const getTodayTransactions = () => {
    const today = new Date().toDateString();
    return transactions.filter(
      (t) => new Date(t.created_at).toDateString() === today
    );
  };

  const getMonthTransactions = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions.filter((t) => new Date(t.created_at) >= startOfMonth);
  };

  const renderTripsTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingBottom: "6rem" }}>
      <div>
        <h3 style={sectionLabelStyle}>Today</h3>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2].map((i) => (
              <Skeleton key={i} height="6rem" />
            ))}
          </div>
        ) : getTodayTrips().length === 0 ? (
          <p style={{ color: DESIGN.textMuted, fontSize: "0.875rem", margin: 0 }}>
            No trips scheduled for today
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {getTodayTrips().map((trip) => (
              <div key={trip.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", fontWeight: 600, color: DESIGN.text }}>
                      {trip.title}
                    </h4>
                    <div style={{ fontSize: "0.875rem", color: DESIGN.textMuted }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <MIcon symbol="location_on" size={14} />
                        {trip.pickup_location} → {trip.dropoff_location}
                      </div>
                      <div>
                        {fmtRelative(trip.scheduled_time)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
                  {trip.status === "pending" && (
                    <button
                      onClick={() => updateTripStatus(trip.id, "in_progress")}
                      style={{
                        padding: "0.5rem 1rem",
                        background: DESIGN.primary,
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.target.style.opacity = "1")}
                    >
                      Start
                    </button>
                  )}
                  {trip.status === "in_progress" && (
                    <button
                      onClick={() => updateTripStatus(trip.id, "completed")}
                      style={{
                        padding: "0.5rem 1rem",
                        background: DESIGN.primary,
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.target.style.opacity = "1")}
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={sectionLabelStyle}>Upcoming</h3>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2].map((i) => (
              <Skeleton key={i} height="6rem" />
            ))}
          </div>
        ) : getFutureTrips().length === 0 ? (
          <p style={{ color: DESIGN.textMuted, fontSize: "0.875rem", margin: 0 }}>
            No upcoming trips
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {getFutureTrips().map((trip) => (
              <div key={trip.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", fontWeight: 600, color: DESIGN.text }}>
                      {trip.title}
                    </h4>
                    <div style={{ fontSize: "0.875rem", color: DESIGN.textMuted }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <MIcon symbol="location_on" size={14} />
                        {trip.pickup_location} → {trip.dropoff_location}
                      </div>
                      <div>
                        {fmtDate(trip.scheduled_time)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderKitchenTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingBottom: "6rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={cardStyle}>
          <div style={{ fontSize: "0.8rem", color: DESIGN.textMuted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
            Today Spending
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: DESIGN.primary, marginTop: "0.75rem" }}>
            {fmtVND(
              getTodayTransactions().reduce((sum, tx) => sum + (tx.amount || 0), 0)
            )}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: "0.8rem", color: DESIGN.textMuted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
            This Month
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: DESIGN.primary, marginTop: "0.75rem" }}>
            {fmtVND(
              getMonthTransactions().reduce((sum, tx) => sum + (tx.amount || 0), 0)
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="4rem" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p style={{ color: DESIGN.textMuted, fontSize: "0.875rem", margin: 0 }}>
          No transactions yet
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {transactions.map((tx) => (
            <div key={tx.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", fontWeight: 600, color: DESIGN.text }}>
                    {tx.description}
                  </h4>
                  <div style={{ fontSize: "0.75rem", color: DESIGN.textMuted }}>
                    {fmtRelative(tx.created_at)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: DESIGN.primary }}>
                  {fmtVND(tx.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowTxForm(!showTxForm)}
        style={{
          position: "fixed",
          bottom: "5.5rem",
          right: "2rem",
          width: "3.5rem",
          height: "3.5rem",
          borderRadius: "50%",
          background: DESIGN.primary,
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          zIndex: 40,
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <MIcon symbol="add" size={24} />
      </button>

      {showTxForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
          onClick={() => setShowTxForm(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "90%", maxWidth: "28rem" }}>
            <TransactionForm
              defaultFundId="kitchen"
              onSuccess={() => {
                setShowTxForm(false);
                fetchData();
              }}
              onCancel={() => setShowTxForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderTasksTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingBottom: "6rem" }}>
      {getUncompletedTasksCount() > 0 && (
        <div style={{
          padding: "1rem",
          background: "#f0f4e6",
          border: `1px solid ${DESIGN.primary}20`,
          borderRadius: "8px",
          fontSize: "0.875rem",
          color: DESIGN.text,
          fontWeight: 600,
        }}>
          Incomplete: <strong>{getUncompletedTasksCount()}</strong> task{getUncompletedTasksCount() !== 1 ? "s" : ""}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="5rem" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p style={{ color: DESIGN.textMuted, fontSize: "0.875rem", margin: 0 }}>
          No tasks assigned
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => updateTaskStatus(task.id, getStatusFlow(task.status))}
              style={{
                ...cardStyle,
                cursor: "pointer",
                opacity: task.status === "done" ? 0.6 : 1,
                textDecoration: task.status === "done" ? "line-through" : "none",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = task.status === "done" ? "0.5" : "0.95")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = task.status === "done" ? "0.6" : "1")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 600, color: DESIGN.text }}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: DESIGN.textMuted }}>
                      {task.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.75rem" }}>
                    {task.priority && <StatusBadge status={task.priority} />}
                    <span style={{ color: DESIGN.textMuted }}>
                      Due: {fmtDate(task.due_date)}
                    </span>
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTab = () => {
    switch (tab) {
      case "trips":
        return renderTripsTab();
      case "kitchen":
        return renderKitchenTab();
      case "tasks":
        return renderTasksTab();
      default:
        return null;
    }
  };

  return (
    <StaffShell role="driver">
      <div style={{ paddingBottom: "4rem" }}>
        <div style={{ padding: "1.5rem 1rem", background: DESIGN.bg, borderBottom: `1px solid ${DESIGN.border}` }}>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: DESIGN.text, fontFamily: DESIGN.font }}>
            Driver
          </h1>
        </div>

        <div style={{ maxWidth: "430px", margin: "0 auto", padding: "1.5rem" }}>
          {renderTab()}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: "430px",
          margin: "0 auto",
          background: `linear-gradient(to bottom, rgba(246, 248, 246, 0.95), rgba(246, 248, 246, 0.98))`,
          backdropFilter: "blur(10px)",
          borderTop: `1px solid ${DESIGN.border}`,
          display: "flex",
          height: "4rem",
          zIndex: 30,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.25rem",
              color: tab === t.id ? DESIGN.primary : DESIGN.textMuted,
              fontSize: "0.75rem",
              fontWeight: 600,
              transition: "color 0.2s ease",
              fontFamily: DESIGN.font,
            }}
          >
            <MIcon symbol={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </StaffShell>
  );
}

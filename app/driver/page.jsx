"use client";

import { useState, useEffect } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import { supabase } from "../../lib/supabase";
import { T, card, flexBetween, flexCenter, sectionLabel } from "../../lib/tokens";
import { fmtVND, fmtDate, fmtRelative } from "../../lib/format";
import StatusBadge from "../../components/shared/StatusBadge";
import Skeleton from "../../components/shared/Skeleton";
import TransactionForm from "../../components/TransactionForm";
import { useAuth } from "../../lib/auth";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "6rem" }}>
      {/* Today */}
      <div>
        <h3 style={sectionLabel}>Today</h3>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2].map((i) => (
              <Skeleton key={i} height="6rem" />
            ))}
          </div>
        ) : getTodayTrips().length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: "0.875rem" }}>
            No trips scheduled for today
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {getTodayTrips().map((trip) => (
              <div key={trip.id} style={card}>
                <div style={flexBetween}>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: T.fsBody, color: T.text }}>
                      {trip.title}
                    </h4>
                    <div style={{ fontSize: "0.875rem", color: T.textMuted }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MIcon symbol="location_on" size={14} />
                        {trip.pickup_location} → {trip.dropoff_location}
                      </div>
                      <div style={{ marginTop: "0.25rem" }}>
                        {fmtRelative(trip.scheduled_time)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  {trip.status === "pending" && (
                    <button
                      onClick={() => updateTripStatus(trip.id, "in_progress")}
                      style={{
                        padding: "0.5rem 1rem",
                        background: T.primary,
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Start
                    </button>
                  )}
                  {trip.status === "in_progress" && (
                    <button
                      onClick={() => updateTripStatus(trip.id, "completed")}
                      style={{
                        padding: "0.5rem 1rem",
                        background: T.primary,
                        color: "white",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
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

      {/* Upcoming */}
      <div>
        <h3 style={sectionLabel}>Upcoming</h3>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2].map((i) => (
              <Skeleton key={i} height="6rem" />
            ))}
          </div>
        ) : getFutureTrips().length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: "0.875rem" }}>
            No upcoming trips
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {getFutureTrips().map((trip) => (
              <div key={trip.id} style={card}>
                <div style={flexBetween}>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: T.fsBody, color: T.text }}>
                      {trip.title}
                    </h4>
                    <div style={{ fontSize: "0.875rem", color: T.textMuted }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MIcon symbol="location_on" size={14} />
                        {trip.pickup_location} → {trip.dropoff_location}
                      </div>
                      <div style={{ marginTop: "0.25rem" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "6rem" }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontSize: "0.875rem", color: T.textMuted }}>
            Today's Spending
          </div>
          <div
            style={{
              fontSize: T.fsHeading,
              fontWeight: 600,
              color: T.primary,
              marginTop: "0.5rem",
            }}
          >
            {fmtVND(
              getTodayTransactions().reduce((sum, tx) => sum + (tx.amount || 0), 0)
            )}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: "0.875rem", color: T.textMuted }}>
            This Month
          </div>
          <div
            style={{
              fontSize: T.fsHeading,
              fontWeight: 600,
              color: T.primary,
              marginTop: "0.5rem",
            }}
          >
            {fmtVND(
              getMonthTransactions().reduce((sum, tx) => sum + (tx.amount || 0), 0)
            )}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="4rem" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p style={{ color: T.textMuted, fontSize: "0.875rem" }}>
          No transactions yet
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {transactions.map((tx) => (
            <div key={tx.id} style={card}>
              <div style={flexBetween}>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: T.fsBody, color: T.text }}>
                    {tx.description}
                  </h4>
                  <div style={{ fontSize: "0.75rem", color: T.textMuted }}>
                    {fmtRelative(tx.created_at)}
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: T.primary }}>
                  {fmtVND(tx.amount)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => setShowTxForm(!showTxForm)}
        style={{
          position: "fixed",
          bottom: "5.5rem",
          right: "2rem",
          width: "3.5rem",
          height: "3.5rem",
          borderRadius: "50%",
          background: T.primary,
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          zIndex: 40,
        }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "6rem" }}>
      {/* Unfinished count badge */}
      {getUncompletedTasksCount() > 0 && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef3c7",
            border: `1px solid #fcd34d`,
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            color: T.text,
          }}
        >
          Incomplete: <strong>{getUncompletedTasksCount()}</strong> task{getUncompletedTasksCount() !== 1 ? "s" : ""}
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="5rem" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p style={{ color: T.textMuted, fontSize: "0.875rem" }}>
          No tasks assigned
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => updateTaskStatus(task.id, getStatusFlow(task.status))}
              style={{
                ...card,
                cursor: "pointer",
                opacity: task.status === "done" ? 0.6 : 1,
                textDecoration: task.status === "done" ? "line-through" : "none",
              }}
            >
              <div style={flexBetween}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", fontSize: T.fsBody, color: T.text }}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p
                      style={{
                        margin: "0 0 0.5rem 0",
                        fontSize: "0.875rem",
                        color: T.textMuted,
                      }}
                    >
                      {task.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                      fontSize: "0.75rem",
                    }}
                  >
                    {task.priority && <StatusBadge status={task.priority} />}
                    <span style={{ color: T.textMuted }}>
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
      {/* Header */}
      <div style={{ padding: "1.5rem 1rem", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: T.text }}>
          Driver Dashboard
        </h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "430px", margin: "0 auto", padding: "1rem", flex: 1 }}>
        {renderTab()}
      </div>

      {/* Bottom Navigation */}
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
          borderTop: `1px solid ${T.border}`,
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
              color: tab === t.id ? T.primary : T.textMuted,
              fontSize: "0.75rem",
              transition: "color 0.2s ease",
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

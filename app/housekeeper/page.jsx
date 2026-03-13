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
  { id: "expenses", label: "Expenses", icon: "receipt_long" },
  { id: "house", label: "Home Care", icon: "home_repair_service" },
  { id: "family", label: "Family", icon: "family_restroom" },
  { id: "schedule", label: "Schedule", icon: "calendar_today" },
];

const MAINTENANCE_STATUSES = ["reported", "scheduled", "in_progress", "completed"];

export default function HousekeeperPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("expenses");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [familySchedule, setFamilySchedule] = useState([]);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    title: "",
    description: "",
    location_in_house: "",
  });
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [familyFormData, setFamilyFormData] = useState({
    title: "",
    schedule_type: "school",
    family_member: "Member",
    event_date: "",
    event_time: "",
    notes: "",
  });

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("created_by", profile.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      setTransactions(txData || []);

      // Fetch home maintenance items
      const { data: maintenanceData } = await supabase
        .from("home_maintenance")
        .select("*")
        .order("created_at", { ascending: false });

      setMaintenanceItems(maintenanceData || []);

      // Fetch family schedule
      const { data: scheduleData } = await supabase
        .from("family_schedule")
        .select("*")
        .order("event_date", { ascending: true });

      setFamilySchedule(scheduleData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault();
    if (!maintenanceFormData.title || !maintenanceFormData.location_in_house) {
      alert("Please fill in title and location");
      return;
    }

    try {
      const { error } = await supabase.from("home_maintenance").insert([
        {
          title: maintenanceFormData.title,
          description: maintenanceFormData.description,
          location_in_house: maintenanceFormData.location_in_house,
          reported_by: profile.id,
          status: "reported",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setMaintenanceFormData({ title: "", description: "", location_in_house: "" });
      setShowMaintenanceForm(false);
      fetchData();
    } catch (error) {
      console.error("Error creating maintenance report:", error);
      alert("Error creating maintenance report");
    }
  };

  const handleMaintenanceStatusChange = async (itemId, currentStatus) => {
    const currentIndex = MAINTENANCE_STATUSES.indexOf(currentStatus);
    const nextStatus = MAINTENANCE_STATUSES[(currentIndex + 1) % MAINTENANCE_STATUSES.length];

    try {
      const { error } = await supabase
        .from("home_maintenance")
        .update({ status: nextStatus })
        .eq("id", itemId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error updating maintenance status:", error);
    }
  };

  const handleFamilyScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!familyFormData.title || !familyFormData.event_date) {
      alert("Please fill in title and date");
      return;
    }

    try {
      const { error } = await supabase.from("family_schedule").insert([
        {
          title: familyFormData.title,
          schedule_type: familyFormData.schedule_type,
          family_member: familyFormData.family_member,
          event_date: familyFormData.event_date,
          event_time: familyFormData.event_time || null,
          notes: familyFormData.notes || null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setFamilyFormData({
        title: "",
        schedule_type: "school",
        family_member: "Member",
        event_date: "",
        event_time: "",
        notes: "",
      });
      setShowFamilyForm(false);
      fetchData();
    } catch (error) {
      console.error("Error creating family schedule:", error);
      alert("Error creating schedule");
    }
  };

  const getTodayExpenses = () => {
    const today = new Date().toDateString();
    return transactions
      .filter((tx) => new Date(tx.created_at).toDateString() === today)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  };

  const getMonthExpenses = () => {
    return transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  };

  const getWeeklyEvents = () => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = [];

    transactions
      .filter((tx) => {
        const txDate = new Date(tx.created_at);
        return txDate >= today && txDate <= nextWeek;
      })
      .forEach((tx) => {
        events.push({
          date: tx.created_at,
          type: "expense",
          title: tx.description || "Chi tiêu",
          amount: fmtVND(tx.amount),
        });
      });

    maintenanceItems
      .filter((item) => {
        const itemDate = item.created_at ? new Date(item.created_at) : null;
        return itemDate && itemDate >= today && itemDate <= nextWeek;
      })
      .forEach((item) => {
        events.push({
          date: item.created_at,
          type: "maintenance",
          title: item.title,
          status: item.status,
        });
      });

    familySchedule
      .filter((sched) => {
        const schedDate = new Date(sched.event_date);
        return schedDate >= today && schedDate <= nextWeek;
      })
      .forEach((sched) => {
        events.push({
          date: sched.event_date,
          type: "family",
          title: sched.title,
          member: sched.family_member,
        });
      });

    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const groupEventsByDate = (events) => {
    const grouped = {};
    events.forEach((event) => {
      const dateKey = fmtDate(new Date(event.date));
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  if (!profile) {
    return (
      <StaffShell role="housekeeper" title="Housekeeper">
        <div style={{ padding: 24 }}>Loading...</div>
      </StaffShell>
    );
  }

  const renderExpensesTab = () => (
    <div>
      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div
          style={{
            ...card,
            flex: 1,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: T.textMuted }}>Today</div>
          <div style={{ fontSize: 18, fontWeight: "bold", marginTop: 4 }}>
            {fmtVND(getTodayExpenses())}
          </div>
        </div>
        <div
          style={{
            ...card,
            flex: 1,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: T.textMuted }}>This Month</div>
          <div style={{ fontSize: 18, fontWeight: "bold", marginTop: 4 }}>
            {fmtVND(getMonthExpenses())}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div style={{ marginBottom: 80 }}>
        <h3 style={sectionLabel}>Recent Transactions</h3>
        {loading ? (
          <Skeleton count={5} />
        ) : transactions.length === 0 ? (
          <div style={{ padding: 16, color: T.textMuted }}>
            No transactions yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {transactions.map((tx) => (
              <div key={tx.id} style={{ ...card, padding: 16, ...flexBetween }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ ...flexCenter, width: 40, height: 40, borderRadius: "50%", backgroundColor: T.bg }}>
                    <MIcon name="receipt_long" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{tx.description || "Expense"}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      {fmtRelative(new Date(tx.created_at))}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: "#ef4444" }}>-{fmtVND(tx.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Button & Form */}
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
          color: "white",
          border: "none",
          ...flexCenter,
          cursor: "pointer",
          fontSize: 18,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 40,
        }}
      >
        <MIcon name="add" />
      </button>

      {showTxForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            ...flexCenter,
            zIndex: 50,
          }}
          onClick={() => setShowTxForm(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Add Transaction</h2>
            <TransactionForm
              defaultFundId="chi-gia-dinh"
              onSuccess={() => {
                setShowTxForm(false);
                fetchData();
              }}
            />
            <button
              onClick={() => setShowTxForm(false)}
              style={{
                marginTop: 16,
                width: "100%",
                padding: 16,
                backgroundColor: T.bg,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderHouseTab = () => (
    <div>
      <h3 style={sectionLabel}>Maintenance Reports</h3>

      {/* Maintenance Form */}
      {!showMaintenanceForm ? (
        <button
          onClick={() => setShowMaintenanceForm(true)}
          style={{
            width: "100%",
            padding: 16,
            marginBottom: 24,
            backgroundColor: T.primary,
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MIcon name="add" /> New Report
        </button>
      ) : (
        <form
          onSubmit={handleMaintenanceSubmit}
          style={{
            ...card,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <input
            type="text"
            placeholder="Title"
            value={maintenanceFormData.title}
            onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, title: e.target.value })}
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <textarea
            placeholder="Description"
            value={maintenanceFormData.description}
            onChange={(e) =>
              setMaintenanceFormData({ ...maintenanceFormData, description: e.target.value })
            }
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
              minHeight: 80,
              fontFamily: "inherit",
            }}
          />
          <input
            type="text"
            placeholder="Location in house"
            value={maintenanceFormData.location_in_house}
            onChange={(e) =>
              setMaintenanceFormData({ ...maintenanceFormData, location_in_house: e.target.value })
            }
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 16,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: 16,
                backgroundColor: T.primary,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setShowMaintenanceForm(false)}
              style={{
                flex: 1,
                padding: 16,
                backgroundColor: T.bg,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Maintenance List */}
      {loading ? (
        <Skeleton count={5} />
      ) : maintenanceItems.length === 0 ? (
        <div style={{ padding: 16, color: T.textMuted, marginBottom: 80 }}>
          No reports yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 80 }}>
          {maintenanceItems.map((item) => (
            <div
              key={item.id}
              style={{
                ...card,
                padding: 16,
              }}
            >
              <div style={{ ...flexBetween, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                  <div
                    style={{
                      ...flexCenter,
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: T.bg,
                    }}
                  >
                    <MIcon name="home_repair_service" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      {item.location_in_house}
                    </div>
                  </div>
                </div>
              </div>
              {item.description && (
                <div
                  style={{
                    fontSize: 12,
                    color: T.textMuted,
                    marginBottom: 8,
                  }}
                >
                  {item.description}
                </div>
              )}
              <div style={{ ...flexBetween }}>
                <button
                  onClick={() => handleMaintenanceStatusChange(item.id, item.status)}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <StatusBadge status={item.status} />
                </button>
                {item.estimated_cost && (
                  <div style={{ fontWeight: 600 }}>{fmtVND(item.estimated_cost)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFamilyTab = () => (
    <div>
      {/* Add Schedule Form */}
      {!showFamilyForm ? (
        <button
          onClick={() => setShowFamilyForm(true)}
          style={{
            width: "100%",
            padding: 16,
            marginBottom: 24,
            backgroundColor: T.primary,
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MIcon name="add" /> Add Event
        </button>
      ) : (
        <form
          onSubmit={handleFamilyScheduleSubmit}
          style={{
            ...card,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <input
            type="text"
            placeholder="Title"
            value={familyFormData.title}
            onChange={(e) => setFamilyFormData({ ...familyFormData, title: e.target.value })}
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <select
            value={familyFormData.schedule_type}
            onChange={(e) => setFamilyFormData({ ...familyFormData, schedule_type: e.target.value })}
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <option value="school">School</option>
            <option value="health">Health</option>
            <option value="activity">Activity</option>
          </select>
          <select
            value={familyFormData.family_member}
            onChange={(e) =>
              setFamilyFormData({ ...familyFormData, family_member: e.target.value })
            }
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <option value="Member">Member</option>
            <option value="Parent">Parent</option>
          </select>
          <input
            type="date"
            value={familyFormData.event_date}
            onChange={(e) => setFamilyFormData({ ...familyFormData, event_date: e.target.value })}
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <input
            type="time"
            value={familyFormData.event_time}
            onChange={(e) => setFamilyFormData({ ...familyFormData, event_time: e.target.value })}
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 8,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <textarea
            placeholder="Notes"
            value={familyFormData.notes}
            onChange={(e) => setFamilyFormData({ ...familyFormData, notes: e.target.value })}
            style={{
              width: "100%",
              padding: 8,
              marginBottom: 16,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 14,
              minHeight: 60,
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: 16,
                backgroundColor: T.primary,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowFamilyForm(false)}
              style={{
                flex: 1,
                padding: 16,
                backgroundColor: T.bg,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Schedule Items by Type */}
      {loading ? (
        <Skeleton count={5} />
      ) : familySchedule.length === 0 ? (
        <div style={{ padding: 16, color: T.textMuted, marginBottom: 80 }}>
          No events yet
        </div>
      ) : (
        <div style={{ marginBottom: 80 }}>
          {["school", "health", "activity"].map((type) => {
            const typeLabel = type === "school" ? "School" : type === "health" ? "Health" : "Activities";
            const items = familySchedule.filter((item) => item.schedule_type === type);

            if (items.length === 0) return null;

            return (
              <div key={type} style={{ marginBottom: 24 }}>
                <h4 style={sectionLabel}>{typeLabel}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((item) => (
                    <div key={item.id} style={{ ...card, padding: 16 }}>
                      <div style={{ ...flexBetween, marginBottom: 4 }}>
                        <div style={{ fontWeight: 500 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {item.family_member}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>
                        {fmtDate(new Date(item.event_date))}
                        {item.event_time && ` - ${item.event_time}`}
                      </div>
                      {item.notes && (
                        <div
                          style={{
                            fontSize: 12,
                            color: T.textMuted,
                            marginTop: 4,
                          }}
                        >
                          {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderScheduleTab = () => {
    const events = getWeeklyEvents();
    const groupedEvents = groupEventsByDate(events);

    return (
      <div>
        <h3 style={sectionLabel}>Next Week Schedule</h3>
        {loading ? (
          <Skeleton count={5} />
        ) : events.length === 0 ? (
          <div style={{ padding: 16, color: T.textMuted, marginBottom: 80 }}>
            No events next week
          </div>
        ) : (
          <div style={{ marginBottom: 80 }}>
            {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
              <div key={dateKey} style={{ marginBottom: 24 }}>
                <h4 style={{ ...sectionLabel, marginBottom: 16 }}>{dateKey}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayEvents.map((event, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...card,
                        padding: 16,
                        borderLeft: `4px solid ${
                          event.type === "expense"
                            ? "#ef4444"
                            : event.type === "maintenance"
                            ? "#f59e0b"
                            : T.primary
                        }`,
                      }}
                    >
                      <div style={{ ...flexBetween, marginBottom: 4 }}>
                        <div style={{ fontWeight: 500 }}>{event.title}</div>
                        {event.amount && (
                          <div style={{ fontWeight: 600, color: "#ef4444" }}>
                            {event.amount}
                          </div>
                        )}
                      </div>
                      {event.status && (
                        <StatusBadge status={event.status} />
                      )}
                      {event.member && (
                        <div style={{ fontSize: 12, color: T.textMuted }}>
                          {event.member}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <StaffShell role="housekeeper" title="Housekeeper">
      <div style={{ padding: 24, paddingBottom: 120 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.text, margin: 0 }}>
            Housekeeper Dashboard
          </h1>
          <p style={{ color: T.textMuted, fontSize: 14, marginTop: 4 }}>
            Manage expenses, home care, family events, and schedules
          </p>
        </div>

        {/* Tab Content */}
        {tab === "expenses" && renderExpensesTab()}
        {tab === "house" && renderHouseTab()}
        {tab === "family" && renderFamilyTab()}
        {tab === "schedule" && renderScheduleTab()}
      </div>

      {/* Bottom Navigation Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 430,
          margin: "0 auto",
          backgroundColor: T.bg,
          backdropFilter: "blur(10px)",
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-around",
          padding: "12px 0",
          zIndex: 30,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "8px 16px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              color: tab === t.id ? T.primary : T.textMuted,
              fontSize: 12,
              fontWeight: tab === t.id ? 600 : 400,
              flex: 1,
            }}
          >
            <MIcon
              name={t.icon}
              style={{
                fontSize: 24,
                color: "inherit",
              }}
            />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </StaffShell>
  );
}

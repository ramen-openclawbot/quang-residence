"use client";

import { useState, useEffect } from "react";
import StaffShell from "../../components/shared/StaffShell";
import { supabase } from "../../lib/supabase";
import { T, card, flexBetween, flexCenter, sectionLabel, cardCompact } from "../../lib/tokens";
import { fmtVND, fmtShort, fmtDate, fmtRelative } from "../../lib/format";
import {
  HomeIcon,
  WalletIcon,
  LeafIcon,
  CalendarIcon,
  BellIcon,
  CameraIcon,
  LightIcon,
  ShieldIcon,
  TrendUpIcon,
  getIcon,
  PlusIcon,
  DropIcon,
  CheckCircle,
  PlayIcon,
  WindIcon,
  SunIcon,
  MoonIcon,
} from "../../components/shared/Icons";
import StatusBadge from "../../components/shared/StatusBadge";
import Skeleton from "../../components/shared/Skeleton";

const TABS = [
  { id: "home", label: "ZenHome", Ic: HomeIcon },
  { id: "wealth", label: "Tài chính", Ic: WalletIcon },
  { id: "ambiance", label: "Nhà", Ic: LeafIcon },
  { id: "agenda", label: "Công việc", Ic: CalendarIcon },
];

export default function OwnerPage() {
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [funds, setFunds] = useState([]);
  const [homeSettings, setHomeSettings] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch transactions (last 30, ordered by date desc)
      const { data: txnData } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .limit(30);
      setTransactions(txnData || []);

      // Fetch tasks
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      setTasks(taskData || []);

      // Fetch funds
      const { data: fundData } = await supabase.from("funds").select("*");
      setFunds(fundData || []);

      // Fetch home settings
      const { data: settingsData } = await supabase.from("home_settings").select("*");
      if (settingsData) {
        const settingsMap = {};
        settingsData.forEach((setting) => {
          let value = setting.setting_value;
          if (typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if not valid JSON
            }
          }
          settingsMap[setting.setting_key] = value;
        });
        setHomeSettings(settingsMap);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleTransactionApproval = async (transactionId, newStatus) => {
    try {
      await supabase
        .from("transactions")
        .update({ status: newStatus })
        .eq("id", transactionId);
      await fetchData();
    } catch (error) {
      console.error("Error updating transaction:", error);
    }
  };

  const handleSettingUpdate = async (key, value) => {
    try {
      const existingData = await supabase
        .from("home_settings")
        .select("id")
        .eq("setting_key", key)
        .single();

      if (existingData.data) {
        await supabase
          .from("home_settings")
          .update({ setting_value: typeof value === "string" ? value : JSON.stringify(value) })
          .eq("id", existingData.data.id);
      } else {
        await supabase.from("home_settings").insert({
          setting_key: key,
          setting_value: typeof value === "string" ? value : JSON.stringify(value),
        });
      }

      setHomeSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    } catch (error) {
      console.error("Error updating setting:", error);
    }
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return now.toISOString().substring(0, 7); // YYYY-MM
  };

  const getTotalExpenseThisMonth = () => {
    const currentMonth = getCurrentMonth();
    return transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.transaction_date &&
          t.transaction_date.startsWith(currentMonth)
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  const getTopFunds = () => {
    return [...funds]
      .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0))
      .slice(0, 2);
  };

  const getRecentTransactions = (limit = 5) => {
    return transactions.slice(0, limit);
  };

  const getPendingApprovalsCount = () => {
    return transactions.filter((t) => t.status === "pending").length;
  };

  const getTasksCounts = () => {
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  };

  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + 1); // Monday

    for (let i = 0; i < 6; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const filteredTasks = () => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  };

  return (
    <StaffShell role="owner">
      <div style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 60 }}>
        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: 8,
            borderBottom: `1px solid ${T.border}`,
            padding: "0 16px",
            marginBottom: 24,
            overflowX: "auto",
          }}
        >
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 12px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: isActive ? `2px solid ${T.primary}` : "none",
                  color: isActive ? T.primary : T.textSecondary,
                  cursor: "pointer",
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                <t.Ic size={18} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* HOME TAB */}
        {tab === "home" && (
          <div style={{ padding: "0 16px" }}>
            {/* Header */}
            <div style={{ ...flexBetween, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 14, color: T.textSecondary }}>Welcome back</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>Mr. Quang</div>
              </div>
              <div style={{ ...flexCenter, gap: 12 }}>
                <div
                  style={{
                    ...flexCenter,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#10b981",
                    color: "white",
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Q
                </div>
                <BellIcon size={20} color={T.text} />
              </div>
            </div>

            {/* Wealth Summary Card */}
            <div
              style={{
                ...card,
                marginBottom: 24,
                padding: 16,
                backgroundColor: T.surface,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...sectionLabel, marginBottom: 8 }}>Chi tiêu tháng này</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: T.text }}>
                  {loading ? <Skeleton width={120} height={28} /> : fmtVND(getTotalExpenseThisMonth())}
                </div>
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skeleton height={40} />
                  <Skeleton height={40} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {getTopFunds().map((fund) => (
                    <div key={fund.id}>
                      <div style={{ ...flexBetween, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: T.textSecondary }}>{fund.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                          {fmtVND(fund.current_balance)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          backgroundColor: T.border,
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            backgroundColor: T.primary,
                            width: `${Math.min(
                              100,
                              ((fund.current_balance || 0) / (fund.budget_monthly || 1)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...flexBetween, marginBottom: 12 }}>
                <div style={sectionLabel}>Giao dịch gần đây</div>
                <button
                  onClick={() => setTab("wealth")}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.primary,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Xem tất cả
                </button>
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={50} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {getRecentTransactions(5).map((tx) => {
                    const IconComponent = getIcon(tx.category);
                    const isExpense = tx.type === "expense";
                    return (
                      <div
                        key={tx.id}
                        style={{
                          ...flexBetween,
                          padding: 12,
                          backgroundColor: T.surface,
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div
                            style={{
                              ...flexCenter,
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: T.border,
                            }}
                          >
                            <IconComponent size={18} color={T.text} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                              {tx.description}
                            </div>
                            <div style={{ fontSize: 12, color: T.textSecondary }}>
                              {fmtRelative(tx.transaction_date)}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: isExpense ? T.error : T.success,
                          }}
                        >
                          {isExpense ? "-" : "+"} {fmtShort(tx.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Overview Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  ...card,
                  padding: 12,
                  backgroundColor: T.surface,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>
                  {loading ? <Skeleton width={40} height={24} /> : getPendingApprovalsCount()}
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
                  Chờ phê duyệt
                </div>
              </div>
              <div
                style={{
                  ...card,
                  padding: 12,
                  backgroundColor: T.surface,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>
                  {loading ? <Skeleton width={40} height={24} /> : getTasksCounts().all}
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
                  Công việc
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WEALTH TAB */}
        {tab === "wealth" && (
          <div style={{ padding: "0 16px" }}>
            {/* Header */}
            <div style={{ ...flexBetween, marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>Tài chính</div>
            </div>

            {/* Funds Summary */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Quỹ</div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1, 2].map((i) => (
                    <Skeleton key={i} height={80} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {funds.map((fund) => (
                    <div key={fund.id} style={{ ...card, padding: 16, backgroundColor: T.surface }}>
                      <div style={{ ...flexBetween, marginBottom: 8 }}>
                        <span style={{ fontWeight: 500, color: T.text }}>{fund.name}</span>
                        <span style={{ fontWeight: 600, color: T.primary }}>
                          {fmtVND(fund.current_balance)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
                        Ngân sách: {fmtVND(fund.budget_monthly)}
                      </div>
                      <div
                        style={{
                          height: 6,
                          backgroundColor: T.border,
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            backgroundColor: T.primary,
                            width: `${Math.min(
                              100,
                              ((fund.current_balance || 0) / (fund.budget_monthly || 1)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transactions List */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Giao dịch</div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={60} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {transactions.map((tx) => {
                    const IconComponent = getIcon(tx.category);
                    const isExpense = tx.type === "expense";
                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          if (tx.status === "pending") {
                            const newStatus = tx.status === "pending" ? "approved" : "rejected";
                            handleTransactionApproval(tx.id, newStatus);
                          }
                        }}
                        style={{
                          ...card,
                          padding: 12,
                          backgroundColor: T.surface,
                          cursor: tx.status === "pending" ? "pointer" : "default",
                        }}
                      >
                        <div style={{ ...flexBetween }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                            <div
                              style={{
                                ...flexCenter,
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                backgroundColor: T.border,
                              }}
                            >
                              <IconComponent size={18} color={T.text} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                                {tx.description}
                              </div>
                              <div style={{ fontSize: 12, color: T.textSecondary }}>
                                {tx.recipient || tx.category} • {fmtDate(tx.transaction_date)}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: isExpense ? T.error : T.success,
                              }}
                            >
                              {isExpense ? "-" : "+"} {fmtVND(tx.amount)}
                            </div>
                            <StatusBadge status={tx.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AMBIANCE TAB */}
        {tab === "ambiance" && (
          <div style={{ padding: "0 16px" }}>
            {/* Header */}
            <div style={{ ...flexBetween, marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>Nhà</div>
            </div>

            {/* Security Cameras */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Camera an ninh</div>
              {loading ? (
                <Skeleton height={100} />
              ) : (
                <div
                  style={{
                    ...card,
                    padding: 16,
                    backgroundColor: T.surface,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <CameraIcon size={20} color={T.primary} />
                    <div>
                      <div style={{ fontWeight: 500, color: T.text }}>Front Door</div>
                      <div style={{ fontSize: 12, color: T.textSecondary }}>Online</div>
                    </div>
                  </div>
                  <button
                    style={{
                      width: "100%",
                      padding: 8,
                      backgroundColor: T.primary,
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <PlayIcon size={16} style={{ marginRight: 6 }} /> Xem live
                  </button>
                </div>
              )}
            </div>

            {/* Lighting Presets */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Ánh sáng</div>
              {loading ? (
                <Skeleton height={120} />
              ) : (
                <div
                  style={{
                    ...card,
                    padding: 16,
                    backgroundColor: T.surface,
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {[
                      { id: "warm", label: "따뜻함", icon: SunIcon },
                      { id: "natural", label: "Tự nhiên", icon: LightIcon },
                      { id: "dim", label: "Tối", icon: MoonIcon },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSettingUpdate("lighting_preset", preset.id)}
                        style={{
                          padding: 12,
                          backgroundColor:
                            homeSettings.lighting_preset === preset.id ? T.primary : T.border,
                          color:
                            homeSettings.lighting_preset === preset.id ? "white" : T.text,
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 500,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <preset.icon size={18} />
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Brightness Slider */}
                  <div>
                    <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
                      Độ sáng: {homeSettings.brightness || 50}%
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={homeSettings.brightness || 50}
                      onChange={(e) => handleSettingUpdate("brightness", parseInt(e.target.value))}
                      style={{ width: "100%", cursor: "pointer" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Climate */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Khí hậu</div>
              {loading ? (
                <Skeleton height={100} />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      ...card,
                      padding: 16,
                      backgroundColor: T.surface,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ ...flexCenter, marginBottom: 8 }}>
                      <SunIcon size={24} color={T.primary} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>
                      {homeSettings.temperature || 22}°C
                    </div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Nhiệt độ</div>
                  </div>
                  <div
                    style={{
                      ...card,
                      padding: 16,
                      backgroundColor: T.surface,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ ...flexCenter, marginBottom: 8 }}>
                      <DropIcon size={24} color={T.primary} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>
                      {homeSettings.humidity || 60}%
                    </div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Độ ẩm</div>
                  </div>
                </div>
              )}
            </div>

            {/* Smart Devices */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: 12 }}>Thiết bị thông minh</div>
              {loading ? (
                <Skeleton height={150} />
              ) : (
                <div
                  style={{
                    ...card,
                    padding: 16,
                    backgroundColor: T.surface,
                  }}
                >
                  {[
                    { id: "air_conditioner", label: "Máy lạnh" },
                    { id: "ceiling_fan", label: "Quạt trần" },
                    { id: "water_heater", label: "Bình nước nóng" },
                  ].map((device) => (
                    <div
                      key={device.id}
                      style={{
                        ...flexBetween,
                        padding: 10,
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      <span style={{ color: T.text, fontSize: 13 }}>{device.label}</span>
                      <input
                        type="checkbox"
                        checked={homeSettings[device.id] === true}
                        onChange={(e) => handleSettingUpdate(device.id, e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AGENDA TAB */}
        {tab === "agenda" && (
          <div style={{ padding: "0 16px" }}>
            {/* Header */}
            <div style={{ ...flexBetween, marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>Công việc</div>
            </div>

            {/* Week Days Strip */}
            {!loading && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 24,
                  overflowX: "auto",
                }}
              >
                {getWeekDays().map((day, idx) => {
                  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  const isCurrentDay = isToday(day);
                  return (
                    <button
                      key={idx}
                      style={{
                        minWidth: 50,
                        padding: 10,
                        backgroundColor: isCurrentDay ? T.primary : T.surface,
                        color: isCurrentDay ? "white" : T.text,
                        border: `1px solid ${isCurrentDay ? T.primary : T.border}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      <div>{dayNames[idx]}</div>
                      <div>{day.getDate()}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status Filter */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 16,
                borderBottom: `1px solid ${T.border}`,
                paddingBottom: 12,
              }}
            >
              {["all", "pending", "in_progress", "done"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: statusFilter === s ? T.primary : "transparent",
                    color: statusFilter === s ? "white" : T.textSecondary,
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {s === "all" ? "Tất cả" : s === "pending" ? "Chờ" : s === "in_progress" ? "Đang" : "Xong"}
                </button>
              ))}
            </div>

            {/* Tasks List */}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={70} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredTasks().map((task) => (
                  <div
                    key={task.id}
                    style={{
                      ...card,
                      padding: 12,
                      backgroundColor: T.surface,
                    }}
                  >
                    <div style={{ ...flexBetween, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>
                        {task.title}
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>
                      {task.assigned_to && `Giao cho: ${task.assigned_to}`}
                      {task.due_date && ` • ${fmtDate(task.due_date)}`}
                    </div>
                  </div>
                ))}
                {filteredTasks().length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: T.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    Không có công việc nào
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </StaffShell>
  );
}

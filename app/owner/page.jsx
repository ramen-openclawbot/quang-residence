"use client";

import { useState, useEffect } from "react";
import StaffShell from "../../components/shared/StaffShell";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { T, card, flexBetween, flexCenter, sectionLabel, cardCompact } from "../../lib/tokens";
import { fmtVND, fmtShort, fmtDate, fmtRelative } from "../../lib/format";
import {
  HomeIcon,
  WalletIcon,
  LeafIcon,
  CalendarIcon,
  CameraIcon,
  LightIcon,
  TrendUpIcon,
  getIcon,
  PlusIcon,
  DropIcon,
  CheckCircle,
  PlayIcon,
  SunIcon,
  MoonIcon,
  ShieldIcon,
} from "../../components/shared/Icons";
import StatusBadge from "../../components/shared/StatusBadge";
import Skeleton from "../../components/shared/Skeleton";
import NotificationCenter from "../../components/shared/NotificationCenter";

// Users icon inline
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const TABS = [
  { id: "home", label: "ZenHome", Ic: HomeIcon },
  { id: "wealth", label: "Tài chính", Ic: WalletIcon },
  { id: "ambiance", label: "Nhà", Ic: LeafIcon },
  { id: "agenda", label: "Công việc", Ic: CalendarIcon },
  { id: "manage", label: "Quản lý", Ic: UsersIcon },
];

const ROLE_LABELS = {
  secretary: "Thư ký (Thuỷ)",
  housekeeper: "Giúp việc (Trang)",
  driver: "Tài xế (Trường)",
};

export default function OwnerPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [funds, setFunds] = useState([]);
  const [homeSettings, setHomeSettings] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [staffList, setStaffList] = useState([]);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("secretary");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);

  // Approve modal
  const [approveModal, setApproveModal] = useState(null); // { tx, action }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txnRes, taskRes, fundRes, settingsRes, staffRes] = await Promise.all([
        supabase.from("transactions").select("*, funds(name), categories(name_vi), profiles!created_by(full_name)").order("transaction_date", { ascending: false }).limit(50),
        supabase.from("tasks").select("*, profiles!assigned_to(full_name)").order("created_at", { ascending: false }),
        supabase.from("funds").select("*").order("id"),
        supabase.from("home_settings").select("*"),
        supabase.from("profiles").select("id, full_name, role, created_at").neq("role", "owner").order("created_at"),
      ]);

      setTransactions(txnRes.data || []);
      setTasks(taskRes.data || []);
      setFunds(fundRes.data || []);
      setStaffList(staffRes.data || []);

      if (settingsRes.data) {
        const map = {};
        settingsRes.data.forEach((s) => {
          let v = s.setting_value;
          try { v = JSON.parse(v); } catch {}
          map[s.setting_key] = v;
        });
        setHomeSettings(map);
      }
    } catch (err) {
      console.error("fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (txId, newStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("transactions").update({ status: newStatus, approved_by: user?.id }).eq("id", txId);
    setTransactions((prev) => prev.map((t) => t.id === txId ? { ...t, status: newStatus } : t));
    setApproveModal(null);
  };

  const handleSettingUpdate = async (key, value) => {
    const { data: existing } = await supabase.from("home_settings").select("id").eq("setting_key", key).single();
    const strVal = typeof value === "string" ? value : JSON.stringify(value);
    if (existing) {
      await supabase.from("home_settings").update({ setting_value: strVal }).eq("id", existing.id);
    } else {
      await supabase.from("home_settings").insert({ setting_key: key, setting_value: strVal });
    }
    setHomeSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleInviteStaff = async () => {
    if (!inviteEmail || !inviteName) {
      setInviteMsg({ type: "error", text: "Vui lòng điền đầy đủ thông tin." });
      return;
    }
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg({ type: "success", text: `Đã tạo tài khoản ${inviteEmail}. Mật khẩu tạm: ${data.temporary_password}` });
        setInviteEmail(""); setInviteName("");
        fetchData();
      } else {
        setInviteMsg({ type: "error", text: data.error || "Lỗi gửi lời mời" });
      }
    } catch {
      setInviteMsg({ type: "error", text: "Lỗi kết nối server" });
    } finally {
      setInviting(false);
    }
  };

  // Helpers
  const currentMonth = new Date().toISOString().substring(0, 7);
  const totalExpense = transactions.filter((t) => t.type === "expense" && t.transaction_date?.startsWith(currentMonth)).reduce((s, t) => s + (t.amount || 0), 0);
  const pendingTxns = transactions.filter((t) => t.status === "pending");
  const filteredTasks = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

  const getWeekDays = () => {
    const today = new Date();
    const dow = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - dow + 1);
    return Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  };

  return (
    <StaffShell role="owner">
      <div style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 80 }}>

        {/* Tab Nav */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.bg}`, overflowX: "auto" }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "12px 14px", background: "transparent", border: "none",
                borderBottom: active ? `2px solid ${T.primary}` : "2px solid transparent",
                color: active ? T.primary : T.textMuted, cursor: "pointer",
                fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
              }}>
                <t.Ic size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ─── HOME TAB ─── */}
        {tab === "home" && (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ ...flexBetween, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, color: T.textMuted }}>Chào mừng trở lại</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Mr. Quang</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NotificationCenter userId={profile?.id} />
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>Q</div>
              </div>
            </div>

            {/* Expense summary card */}
            <div style={{ ...card, marginBottom: 16, background: "linear-gradient(135deg, #56c91d 0%, #3ea814 100%)", color: "#fff" }}>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Chi tiêu tháng này</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>
                {loading ? <Skeleton width={140} height={28} radius={6} /> : fmtVND(totalExpense)}
              </div>
              {pendingTxns.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>
                  ⏳ {pendingTxns.length} giao dịch chờ duyệt
                </div>
              )}
            </div>

            {/* Funds */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>Quỹ tiền</div>
              {loading ? <Skeleton height={80} /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {funds.slice(0, 3).map((f) => {
                    const pct = Math.min(100, ((f.current_balance || 0) / (f.budget_monthly || 1)) * 100);
                    return (
                      <div key={f.id} style={{ ...cardCompact }}>
                        <div style={{ ...flexBetween, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: T.text }}>{f.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>{fmtShort(f.current_balance)}</span>
                        </div>
                        <div style={{ height: 5, background: T.bg, borderRadius: 3 }}>
                          <div style={{ height: "100%", background: T.primary, borderRadius: 3, width: `${pct}%`, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent txns */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...flexBetween, marginBottom: 10 }}>
                <div style={sectionLabel}>Giao dịch gần đây</div>
                <button onClick={() => setTab("wealth")} style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 12 }}>Xem tất cả</button>
              </div>
              {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3].map(i => <Skeleton key={i} height={48} />)}</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} style={{ ...flexBetween, padding: "10px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${T.bg}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{tx.description || tx.recipient_name || "—"}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{tx.profiles?.full_name} • {fmtRelative(tx.transaction_date)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === "expense" ? T.danger : T.green }}>{tx.type === "expense" ? "−" : "+"}{fmtShort(tx.amount)}</div>
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── WEALTH TAB ─── */}
        {tab === "wealth" && (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Tài chính</div>

            {/* Pending approvals */}
            {pendingTxns.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...sectionLabel, marginBottom: 10 }}>⏳ Chờ phê duyệt ({pendingTxns.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendingTxns.map((tx) => (
                    <div key={tx.id} style={{ ...card, padding: 12 }}>
                      <div style={{ ...flexBetween, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{tx.description || tx.recipient_name || "Giao dịch"}</div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{tx.profiles?.full_name} • {tx.funds?.name}</div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.danger }}>−{fmtVND(tx.amount)}</div>
                      </div>
                      {tx.slip_image_url && (
                        <div style={{ marginBottom: 8 }}>
                          <img src={tx.slip_image_url} alt="bank slip" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 6, cursor: "pointer" }} onClick={() => window.open(tx.slip_image_url, "_blank")} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleApproval(tx.id, "approved")} style={{ flex: 1, padding: "8px 0", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>✓ Duyệt</button>
                        <button onClick={() => handleApproval(tx.id, "rejected")} style={{ flex: 1, padding: "8px 0", background: T.bg, color: T.danger, border: `1px solid ${T.danger}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>✕ Từ chối</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Funds */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>Quỹ tiền</div>
              {loading ? <Skeleton height={100} /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {funds.map((f) => {
                    const pct = Math.min(100, ((f.current_balance || 0) / (f.budget_monthly || 1)) * 100);
                    return (
                      <div key={f.id} style={{ ...card, padding: 14 }}>
                        <div style={{ ...flexBetween, marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: T.text }}>{f.name}</span>
                          <span style={{ fontWeight: 700, color: T.primary, fontSize: 15 }}>{fmtVND(f.current_balance)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Ngân sách: {fmtVND(f.budget_monthly)}</div>
                        <div style={{ height: 6, background: T.bg, borderRadius: 3 }}>
                          <div style={{ height: "100%", background: pct > 80 ? T.danger : T.primary, borderRadius: 3, width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* All transactions */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>Tất cả giao dịch</div>
              {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3,4].map(i => <Skeleton key={i} height={56} />)}</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {transactions.map((tx) => (
                    <div key={tx.id} style={{ ...flexBetween, padding: "10px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${T.bg}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{tx.description || tx.recipient_name || "—"}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{tx.profiles?.full_name} • {tx.funds?.name} • {fmtDate(tx.transaction_date)}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === "expense" ? T.danger : T.green }}>{tx.type === "expense" ? "−" : "+"}{fmtShort(tx.amount)}</div>
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── AMBIANCE TAB ─── */}
        {tab === "ambiance" && (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Nhà</div>

            {/* Lighting */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>💡 Ánh sáng</div>
              <div style={{ ...card, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[{ id: "warm", label: "Ấm", emoji: "🌅" }, { id: "natural", label: "Tự nhiên", emoji: "☀️" }, { id: "dim", label: "Tối", emoji: "🌙" }].map((p) => (
                    <button key={p.id} onClick={() => handleSettingUpdate("lighting_preset", p.id)} style={{
                      padding: "10px 4px", background: homeSettings.lighting_preset === p.id ? T.primary : T.bg,
                      color: homeSettings.lighting_preset === p.id ? "#fff" : T.text,
                      border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{p.emoji}</div>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>Độ sáng: {homeSettings.brightness || 50}%</div>
                <input type="range" min="0" max="100" value={homeSettings.brightness || 50} onChange={(e) => handleSettingUpdate("brightness", parseInt(e.target.value))} style={{ width: "100%", accentColor: T.primary }} />
              </div>
            </div>

            {/* Climate */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>🌡️ Khí hậu</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ key: "temperature", label: "Nhiệt độ", unit: "°C", icon: "🌡️" }, { key: "humidity", label: "Độ ẩm", unit: "%", icon: "💧" }].map((item) => (
                  <div key={item.key} style={{ ...card, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{homeSettings[item.key] || (item.key === "temperature" ? 22 : 60)}{item.unit}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart devices */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>🏠 Thiết bị</div>
              <div style={{ ...card, padding: 4 }}>
                {[{ id: "air_conditioner", label: "Máy lạnh" }, { id: "ceiling_fan", label: "Quạt trần" }, { id: "water_heater", label: "Bình nước nóng" }].map((d) => (
                  <div key={d.id} style={{ ...flexBetween, padding: "12px 14px", borderBottom: `1px solid ${T.bg}` }}>
                    <span style={{ fontSize: 14, color: T.text }}>{d.label}</span>
                    <label style={{ position: "relative", display: "inline-block", width: 44, height: 24 }}>
                      <input type="checkbox" checked={homeSettings[d.id] === true} onChange={(e) => handleSettingUpdate(d.id, e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{
                        position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                        background: homeSettings[d.id] ? T.primary : "#ccc",
                        borderRadius: 12, transition: "0.3s",
                      }}>
                        <span style={{
                          position: "absolute", height: 18, width: 18, left: homeSettings[d.id] ? 22 : 3, bottom: 3,
                          background: "#fff", borderRadius: "50%", transition: "0.3s",
                        }} />
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── AGENDA TAB ─── */}
        {tab === "agenda" && (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Công việc</div>

            {/* Week strip */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {getWeekDays().map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{
                    minWidth: 46, padding: "8px 6px", borderRadius: 8, textAlign: "center",
                    background: isToday ? T.primary : T.bg, color: isToday ? "#fff" : T.text,
                  }}>
                    <div style={{ fontSize: 10, marginBottom: 2 }}>
                      {["T2","T3","T4","T5","T6","T7"][i]}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{day.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: `1px solid ${T.bg}`, paddingBottom: 12 }}>
              {["all", "pending", "in_progress", "done"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding: "5px 10px", background: statusFilter === s ? T.primary : T.bg,
                  color: statusFilter === s ? "#fff" : T.textMuted,
                  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
                }}>
                  {s === "all" ? "Tất cả" : s === "pending" ? "Chờ" : s === "in_progress" ? "Đang làm" : "Xong"}
                </button>
              ))}
            </div>

            {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3].map(i => <Skeleton key={i} height={64} />)}</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredTasks.map((task) => (
                  <div key={task.id} style={{ ...card, padding: 12 }}>
                    <div style={{ ...flexBetween, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{task.title}</div>
                      <StatusBadge status={task.status} />
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      {task.profiles?.full_name && `👤 ${task.profiles.full_name}`}
                      {task.due_date && ` • 📅 ${fmtDate(task.due_date)}`}
                    </div>
                  </div>
                ))}
                {filteredTasks.length === 0 && (
                  <div style={{ textAlign: "center", padding: 32, color: T.textMuted, fontSize: 13 }}>Không có công việc nào</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── MANAGE TAB ─── */}
        {tab === "manage" && (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16 }}>Quản lý nhân viên</div>

            {/* Current staff */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>Nhân viên hiện tại</div>
              {loading ? <Skeleton height={80} /> : (
                <div style={{ ...card, padding: 4 }}>
                  {staffList.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Chưa có nhân viên nào</div>
                  ) : staffList.map((staff) => (
                    <div key={staff.id} style={{ ...flexBetween, padding: "12px 14px", borderBottom: `1px solid ${T.bg}` }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{staff.full_name || "—"}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{staff.email}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, background: T.primary + "22", color: T.primary, fontWeight: 600 }}>
                        {ROLE_LABELS[staff.role] || staff.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invite form */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>Mời nhân viên mới</div>
              <div style={{ ...card, padding: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Họ tên</label>
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nguyễn Thị Thuỷ" style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.bg}`,
                    fontSize: 14, boxSizing: "border-box", outline: "none",
                  }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Email</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="thuy@email.com" style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.bg}`,
                    fontSize: 14, boxSizing: "border-box", outline: "none",
                  }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: T.textMuted, display: "block", marginBottom: 4 }}>Vai trò</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <button key={role} onClick={() => setInviteRole(role)} style={{
                        flex: 1, padding: "8px 4px", background: inviteRole === role ? T.primary : T.bg,
                        color: inviteRole === role ? "#fff" : T.text, border: "none", borderRadius: 8,
                        cursor: "pointer", fontSize: 11, fontWeight: 500, textAlign: "center",
                      }}>
                        {label.split(" ")[0]}
                        <div style={{ fontSize: 10, opacity: 0.8 }}>({label.split("(")[1]?.replace(")", "")})</div>
                      </button>
                    ))}
                  </div>
                </div>

                {inviteMsg && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: inviteMsg.type === "success" ? "#f0fce8" : "#fef2f2", color: inviteMsg.type === "success" ? T.primary : T.danger }}>
                    {inviteMsg.text}
                  </div>
                )}

                <button onClick={handleInviteStaff} disabled={inviting} style={{
                  width: "100%", padding: "12px 0", background: T.primary, color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
                  cursor: inviting ? "not-allowed" : "pointer", opacity: inviting ? 0.7 : 1,
                }}>
                  {inviting ? "Đang gửi..." : "Gửi lời mời Magic Link"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffShell>
  );
}

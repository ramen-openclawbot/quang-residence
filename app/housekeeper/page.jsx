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
  pink: "#ec4899",
};

const TABS = [
  { id: "home", label: "Tổng quan", icon: "home" },
  { id: "expenses", label: "Chi tiêu", icon: "receipt_long" },
  { id: "care", label: "Chăm sóc nhà", icon: "home_repair_service" },
  { id: "family", label: "Gia đình", icon: "family_restroom" },
];

const MAINTENANCE_STATUSES = ["reported", "scheduled", "in_progress", "completed"];

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
  const letter = (name || "H").trim().charAt(0).toUpperCase();
  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: "linear-gradient(135deg,#f59e0b,#ec4899)",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      fontWeight: 800,
      boxShadow: "0 8px 20px rgba(236,72,153,0.22)",
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

function tone(status) {
  if (status === "completed") return { bg: "#e9fff5", color: T.success };
  if (status === "in_progress") return { bg: "#fff7e6", color: T.amber };
  if (status === "scheduled") return { bg: "#eef4ff", color: "#3b82f6" };
  return { bg: "#fff1f1", color: T.pink };
}

function getCategoryMeta(tx) {
  const c = tx?.categories;
  if (c) return { label: c.name_vi || c.name || "Chưa phân loại", color: c.color || "#94a3b8" };
  const m = tx?.ocr_raw_data?.category_meta;
  if (m) return { label: m.label_vi || m.code || "Chưa phân loại", color: "#94a3b8" };
  return { label: "Chưa phân loại", color: "#94a3b8" };
}

export default function HousekeeperPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [selectedFamilyItem, setSelectedFamilyItem] = useState(null);
  const [revealedItemKey, setRevealedItemKey] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [familySchedule, setFamilySchedule] = useState([]);

  const [maintenanceFormData, setMaintenanceFormData] = useState({
    title: "",
    description: "",
    location_in_house: "",
  });

  const [familyFormData, setFamilyFormData] = useState({
    title: "",
    schedule_type: "school",
    family_member: "Member",
    event_date: "",
    event_time: "",
    notes: "",
  });

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  useEffect(() => {
    if (!profile?.id) return;
    fetchData();
  }, [profile?.id]);

  const getSwipeHandlers = (itemKey, canDelete) => {
    let startX = 0;
    return {
      onTouchStart: (e) => {
        startX = e.changedTouches[0]?.clientX || 0;
      },
      onTouchEnd: (e) => {
        if (!canDelete) return;
        const endX = e.changedTouches[0]?.clientX || 0;
        const deltaX = endX - startX;
        if (deltaX < -50) setRevealedItemKey(itemKey);
        if (deltaX > 35) setRevealedItemKey(null);
      },
    };
  };

  async function deleteOwnedItem(kind, id) {
    const token = await getToken();
    const res = await fetch("/api/items/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ kind, id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete item");
  }

  async function fetchData() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const token = await getToken();
      let agendaLoaded = false;
      if (token) {
        const agendaRes = await fetch("/api/agenda/feed?limit=300", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (agendaRes.ok) {
          const agenda = await agendaRes.json();
          const items = agenda.items || [];
          const maintenance = items
            .filter((x) => x.source === "maintenance")
            .map((x) => x.payload || x)
            .filter((m) => m.created_by === profile.id || m.reported_by === profile.id);
          const schedule = items
            .filter((x) => x.source === "schedule")
            .map((x) => x.payload || x)
            .filter((s) => s.created_by === profile.id);
          setMaintenanceItems(maintenance);
          setFamilySchedule(schedule);
          agendaLoaded = true;
        }
      }

      const txData = await supabase
        .from("transactions")
        .select("*, categories!category_id(id, code, name_vi, name, color)")
        .eq("created_by", profile.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(30);
      setTransactions(txData.data || []);

      if (!agendaLoaded) {
        const [maintenanceData, scheduleData] = await Promise.all([
          supabase.from("home_maintenance").select("*").or(`created_by.eq.${profile.id},reported_by.eq.${profile.id}`).order("created_at", { ascending: false }),
          supabase.from("family_schedule").select("*").eq("created_by", profile.id).order("event_date", { ascending: true }),
        ]);
        setMaintenanceItems(maintenanceData.data || []);
        setFamilySchedule(scheduleData.data || []);
      }
    } catch (error) {
      console.error("Housekeeper fetchData error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMaintenanceSubmit(e) {
    e.preventDefault();
    if (!maintenanceFormData.title || !maintenanceFormData.location_in_house) return;

    const { error } = await supabase.from("home_maintenance").insert([{ 
      title: maintenanceFormData.title,
      description: maintenanceFormData.description || null,
      location_in_house: maintenanceFormData.location_in_house,
      reported_by: profile.id,
      created_by: profile.id,
      status: "reported",
      created_at: new Date().toISOString(),
    }]);

    if (error) {
      console.error(error);
      return;
    }

    setMaintenanceFormData({ title: "", description: "", location_in_house: "" });
    setShowMaintenanceForm(false);
    fetchData();
  }

  async function handleMaintenanceStatusChange(item) {
    const currentIndex = MAINTENANCE_STATUSES.indexOf(item.status);
    const nextStatus = MAINTENANCE_STATUSES[(currentIndex + 1) % MAINTENANCE_STATUSES.length];
    const { error } = await supabase.from("home_maintenance").update({ status: nextStatus }).eq("id", item.id);
    if (!error) fetchData();
  }

  async function handleFamilyScheduleSubmit(e) {
    e.preventDefault();
    if (!familyFormData.title || !familyFormData.event_date) return;

    const { error } = await supabase.from("family_schedule").insert([{
      title: familyFormData.title,
      schedule_type: familyFormData.schedule_type,
      family_member: familyFormData.family_member,
      event_date: familyFormData.event_date,
      event_time: familyFormData.event_time || null,
      notes: familyFormData.notes || null,
      created_at: new Date().toISOString(),
    }]);

    if (error) {
      console.error(error);
      return;
    }

    setFamilyFormData({ title: "", schedule_type: "school", family_member: "Member", event_date: "", event_time: "", notes: "" });
    setShowFamilyForm(false);
    fetchData();
  }

  const today = useMemo(() => getTodayKey(), []);
  const isCurrentDayTransaction = (tx) => getLocalDateKey(tx.transaction_date) === today || getLocalDateKey(tx.created_at) === today;
  const todayExpense = useMemo(() => transactions.filter((tx) => isCurrentDayTransaction(tx)).reduce((sum, tx) => sum + Math.abs(Math.min(0, getSignedAmount(tx))), 0), [transactions, today]);
  const monthExpense = useMemo(() => {
    const monthKey = today.slice(0, 7);
    return transactions.filter((tx) => [getLocalDateKey(tx.transaction_date), getLocalDateKey(tx.created_at)].some((key) => key.startsWith(monthKey))).reduce((sum, tx) => sum + Math.abs(Math.min(0, getSignedAmount(tx))), 0);
  }, [transactions, today]);
  const openMaintenance = useMemo(() => maintenanceItems.filter((m) => m.status !== "completed"), [maintenanceItems]);
  const upcomingFamily = useMemo(() => familySchedule.filter((s) => s.event_date && s.event_date >= today), [familySchedule, today]);

  return (
    <StaffShell role="housekeeper">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Housekeeper"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Quản gia</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Quản gia"}</div>
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
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#5a2d14 0%, #8a4a1f 52%, #b45309 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -22, top: -22, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Vận hành nhà</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Nhịp sống gia đình</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Quản gia</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Chi tiêu, chăm sóc và nhịp sống gia đình.</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Chi hôm nay</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVND(todayExpense)}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Việc đang mở</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openMaintenance.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Sắp tới</div><div style={{ fontSize: 18, fontWeight: 800 }}>{upcomingFamily.length}</div></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <StatCard label="Chi hôm nay" value={fmtVND(todayExpense)} color={T.danger} />
                    <StatCard label="Tháng này" value={fmtVND(monthExpense)} color={T.text} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <ActionCard icon="upload_file" label="Ghi chi phí" sub="Hóa đơn, chợ, vật tư" onClick={() => setShowTxForm(true)} primary />
                    <ActionCard icon="home_repair_service" label="Báo cáo sự cố" sub="Theo dõi việc chăm sóc nhà" onClick={() => setShowMaintenanceForm(true)} />
                  </div>

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Bộ sưu tập</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 148, background: "#8d7250" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(20,18,14,0.04) 0%, rgba(20,18,14,0.40) 58%, rgba(20,18,14,0.72) 100()), url('/art-blocks/house-clay-bowl.jpg')", backgroundSize: "cover", backgroundPosition: "center 36%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.34), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Vật phẩm</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Bát gốm</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 148, background: "#223126" }}>
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(180deg, rgba(10,18,12,0.04) 0%, rgba(10,18,12,0.42) 58%, rgba(10,18,12,0.78) 100()), url('/art-blocks/house-stone-tray.jpg')", backgroundSize: "cover", backgroundPosition: "center 34%", transform: "scale(1.05)" }} />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.82 }}>Ghi chú nhà</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Khay đá</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Việc đang mở</div>
                      <button onClick={() => setTab("care")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mở</button>
                    </div>
                    {openMaintenance.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Chưa có việc chăm sóc nhà nào.</div>
                    ) : openMaintenance.slice(0, 4).map((item) => {
                      const s = tone(item.status);
                      return (
                        <button key={item.id} onClick={() => { setSelectedMaintenance(item); setActivePanel("maintenance-detail"); }} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.location_in_house || "Khu vực không xác định"}</div>
                            </div>
                            <div style={{ padding: "6px 10px", borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>{item.status}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Nhịp sống gia đình sắp tới</div>
                      <button onClick={() => setTab("family")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {upcomingFamily.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>Chưa có sự kiện nào.</div>
                    ) : upcomingFamily.slice(0, 4).map((item) => (
                      <button key={item.id} onClick={() => { setSelectedFamilyItem(item); setActivePanel("family-detail"); }} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(item.event_date)}{item.event_time ? ` • ${item.event_time}` : ""}</div>
                        </div>
                        <div style={{ fontSize: 12, color: T.textMuted }}>{item.family_member}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === "expenses" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Chi tiêu</div>
                    <button onClick={() => setShowTxForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Mới</button>
                  </div>
                  {transactions.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>Chưa có giao dịch nào.</div>
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

              {tab === "care" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Chăm sóc nhà</div>
                    <button onClick={() => setShowMaintenanceForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Mới</button>
                  </div>
                  {maintenanceItems.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>Chưa có mục chăm sóc nhà nào.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {maintenanceItems.map((item) => {
                        const s = tone(item.status);
                        const canDelete = item.reported_by === profile?.id;
                        const itemKey = `maintenance-${item.id}`;
                        const swipe = getSwipeHandlers(itemKey, canDelete);
                        return (
                          <div key={item.id} style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
                            {canDelete && (
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                const ok = window.confirm("Xóa mục này?");
                                if (!ok) {
                                  setRevealedItemKey(null);
                                  return;
                                }
                                try {
                                  await deleteOwnedItem("maintenance", item.id);
                                  setMaintenanceItems((prev) => prev.filter((m) => m.id !== item.id));
                                } catch (err) { alert(err.message); }
                                finally { setRevealedItemKey(null); }
                              }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 88, border: "none", background: T.danger, color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", borderRadius: 18 }}>Xóa</button>
                            )}
                            <button {...swipe} onClick={() => { setSelectedMaintenance(item); setActivePanel("maintenance-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}`, position: "relative", transform: canDelete && revealedItemKey === itemKey ? "translateX(-88px)" : "translateX(0)", transition: "transform 180ms ease" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.location_in_house}</div>
                                  {item.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{item.description}</div>}
                                </div>
                                <div style={{ padding: "6px 10px", borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>{item.status}</div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "family" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Gia đình</div>
                    <button onClick={() => setShowFamilyForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Mới</button>
                  </div>
                  {familySchedule.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>Chưa có sự kiện nào.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {familySchedule.map((item) => {
                        const canDelete = item.created_by === profile?.id;
                        const itemKey = `family-${item.id}`;
                        const swipe = getSwipeHandlers(itemKey, canDelete);
                        return (
                          <div key={item.id} style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
                            {canDelete && (
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                const ok = window.confirm("Xóa sự kiện này?");
                                if (!ok) {
                                  setRevealedItemKey(null);
                                  return;
                                }
                                try {
                                  await deleteOwnedItem("family", item.id);
                                  setFamilySchedule((prev) => prev.filter((f) => f.id !== item.id));
                                } catch (err) { alert(err.message); }
                                finally { setRevealedItemKey(null); }
                              }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 88, border: "none", background: T.danger, color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer", borderRadius: 18 }}>Xóa</button>
                            )}
                            <button {...swipe} onClick={() => { setSelectedFamilyItem(item); setActivePanel("family-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}`, position: "relative", transform: canDelete && revealedItemKey === itemKey ? "translateX(-88px)" : "translateX(0)", transition: "transform 180ms ease" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(item.event_date)}{item.event_time ? ` • ${item.event_time}` : ""}</div>
                                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.schedule_type} • {item.family_member}</div>
                                  {item.notes && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{item.notes}</div>}
                                </div>
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
            profile={profile || { role: "housekeeper" }}
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
                  {activePanel === "expense-detail" && "Chi tiết chi phí"}
                  {activePanel === "maintenance-detail" && "Chi tiết chăm sóc nhà"}
                  {activePanel === "family-detail" && "Chi tiết sự kiện gia đình"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Thao tác nhanh</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Ghi chi phí từ Tổng quan\n• Báo cáo và theo dõi việc chăm sóc\n• Mở sự kiện gia đình để xem chi tiết</div></div>
                  <button onClick={() => setShowMaintenanceForm(true)} style={panelBtn}>Báo cáo sự cố</button>
                </div>
              )}

              {activePanel === "expense-detail" && selectedTransaction && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTransaction.description || "Chi phí"}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedTransaction.transaction_date || selectedTransaction.created_at)}</div></div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}><div>Số tiền: <strong>{fmtVND(Math.abs(Number(selectedTransaction.amount || 0)))}</strong></div><div>Loại: {selectedTransaction.type || "chi phí"}</div><div>Trạng thái: {selectedTransaction.status || "chờ xử lý"}</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("expenses"); }} style={panelBtn}>Quay lại Chi tiêu</button>
                </div>
              )}

              {activePanel === "maintenance-detail" && selectedMaintenance && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedMaintenance.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedMaintenance.location_in_house || "Khu vực không xác định"}</div></div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}><div>Trạng thái: <strong>{selectedMaintenance.status}</strong></div><div>{selectedMaintenance.description || "Không có ghi chú"}</div></div>
                  <button onClick={() => { handleMaintenanceStatusChange(selectedMaintenance); setActivePanel(""); }} style={panelBtn}>Cập nhật trạng thái</button>
                </div>
              )}

              {activePanel === "family-detail" && selectedFamilyItem && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedFamilyItem.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedFamilyItem.event_date)}{selectedFamilyItem.event_time ? ` • ${selectedFamilyItem.event_time}` : ""}</div></div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}><div>Loại: {selectedFamilyItem.schedule_type}</div><div>Thành viên: {selectedFamilyItem.family_member}</div><div>{selectedFamilyItem.notes || "Không có ghi chú bổ sung"}</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("family"); }} style={panelBtn}>Quay lại Gia đình</button>
                </div>
              )}
            </div>
          </div>
        )}

        {showMaintenanceForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Báo cáo sự cố</div>
                <button onClick={() => setShowMaintenanceForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>
              <form onSubmit={handleMaintenanceSubmit}>
                <input value={maintenanceFormData.title} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, title: e.target.value })} placeholder="Tiêu đề sự cố" required style={inputStyle} />
                <input value={maintenanceFormData.location_in_house} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, location_in_house: e.target.value })} placeholder="Khu vực" required style={{ ...inputStyle, marginTop: 10 }} />
                <textarea value={maintenanceFormData.description} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, description: e.target.value })} placeholder="Ghi chú" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowMaintenanceForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Hủy</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Tạo</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showFamilyForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Thêm sự kiện gia đình</div>
                <button onClick={() => setShowFamilyForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>
              <form onSubmit={handleFamilyScheduleSubmit}>
                <input value={familyFormData.title} onChange={(e) => setFamilyFormData({ ...familyFormData, title: e.target.value })} placeholder="Tiêu đề sự kiện" required style={inputStyle} />
                <select value={familyFormData.schedule_type} onChange={(e) => setFamilyFormData({ ...familyFormData, schedule_type: e.target.value })} style={{ ...inputStyle, marginTop: 10 }}>
                  <option value="school">School</option>
                  <option value="health">Health</option>
                  <option value="activity">Activity</option>
                  <option value="other">Other</option>
                </select>
                <input value={familyFormData.family_member} onChange={(e) => setFamilyFormData({ ...familyFormData, family_member: e.target.value })} placeholder="Thành viên gia đình" style={{ ...inputStyle, marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <input type="date" value={familyFormData.event_date} onChange={(e) => setFamilyFormData({ ...familyFormData, event_date: e.target.value })} required style={dateInputStyle} />
                  <input type="time" value={familyFormData.event_time} onChange={(e) => setFamilyFormData({ ...familyFormData, event_time: e.target.value })} style={inputStyle} />
                </div>
                <textarea value={familyFormData.notes} onChange={(e) => setFamilyFormData({ ...familyFormData, notes: e.target.value })} placeholder="Ghi chú" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowFamilyForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Hủy</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Lưu</button>
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
  minHeight: 46,
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

const panelBtn = {
  height: 46,
  borderRadius: 12,
  border: "none",
  background: T.primary,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

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
  pink: "#ec4899",
};

const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "expenses", label: "Expenses", icon: "receipt_long" },
  { id: "care", label: "Home Care", icon: "home_repair_service" },
  { id: "family", label: "Family", icon: "family_restroom" },
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

  useEffect(() => {
    if (!profile?.id) return;
    fetchData();
  }, [profile?.id]);

  async function fetchData() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [txData, maintenanceData, scheduleData] = await Promise.all([
        supabase.from("transactions").select("*").eq("created_by", profile.id).gte("created_at", thirtyDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(30),
        supabase.from("home_maintenance").select("*").order("created_at", { ascending: false }),
        supabase.from("family_schedule").select("*").order("event_date", { ascending: true }),
      ]);

      setTransactions(txData.data || []);
      setMaintenanceItems(maintenanceData.data || []);
      setFamilySchedule(scheduleData.data || []);
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

  const today = new Date().toISOString().slice(0, 10);
  const todayExpense = useMemo(() => transactions.filter((tx) => (tx.transaction_date || tx.created_at || "").slice(0, 10) === today).reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [transactions, today]);
  const monthExpense = useMemo(() => transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [transactions]);
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
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Housekeeper Console</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Housekeeper"}</div>
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
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#5a2d14 0%, #8a4a1f 52%, #b45309 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -22, top: -22, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Home operations</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Home Care & gia đình</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Housekeeper</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Theo dõi chi tiêu, việc nhà và lịch gia đình</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Out today</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmtVND(todayExpense)}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Tasks nhà mở</div><div style={{ fontSize: 18, fontWeight: 800 }}>{openMaintenance.length}</div></div>
                        <div><div style={{ fontSize: 11, opacity: 0.7 }}>Schedule sắp tới</div><div style={{ fontSize: 18, fontWeight: 800 }}>{upcomingFamily.length}</div></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <StatCard label="Out today" value={fmtVND(todayExpense)} color={T.danger} />
                    <StatCard label="Chi tháng này" value={fmtVND(monthExpense)} color={T.text} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <ActionCard icon="upload_file" label="Ghi chi tiêu" sub="Upload bill / hóa đơn" onClick={() => setShowTxForm(true)} primary />
                    <ActionCard icon="home_repair_service" label="Report issue" sub="Thêm vấn đề cần xử lý" onClick={() => setShowMaintenanceForm(true)} />
                  </div>

                  <div style={{ ...softCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Tasks nhà cần chú ý</div>
                      <button onClick={() => setTab("care")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {openMaintenance.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>No open home care items.</div>
                    ) : openMaintenance.slice(0, 4).map((item) => {
                      const s = tone(item.status);
                      return (
                        <button key={item.id} onClick={() => { setSelectedMaintenance(item); setActivePanel("maintenance-detail"); }} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.location_in_house || "Không rõ vị trí"}</div>
                            </div>
                            <div style={{ padding: "6px 10px", borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>{item.status}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Schedule gia đình sắp tới</div>
                      <button onClick={() => setTab("family")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {upcomingFamily.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>No upcoming events.</div>
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
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Expenses</div>
                    <button onClick={() => setShowTxForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Ghi chi</button>
                  </div>
                  {transactions.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>No transactions yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {transactions.map((tx) => (
                        <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("expense-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{tx.description || "Expense"}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{fmtRelative(tx.created_at)}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.danger }}>-{fmtVND(Math.abs(Number(tx.amount || 0)))}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "care" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Home care</div>
                    <button onClick={() => setShowMaintenanceForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Báo việc</button>
                  </div>
                  {maintenanceItems.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>No home care items yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {maintenanceItems.map((item) => {
                        const s = tone(item.status);
                        return (
                          <button key={item.id} onClick={() => { setSelectedMaintenance(item); setActivePanel("maintenance-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.location_in_house}</div>
                                {item.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{item.description}</div>}
                              </div>
                              <div style={{ padding: "6px 10px", borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>{item.status}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "family" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Family / lịch</div>
                    <button onClick={() => setShowFamilyForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>+ Thêm lịch</button>
                  </div>
                  {familySchedule.length === 0 ? (
                    <div style={{ ...softCard, padding: 18, color: T.textMuted, fontSize: 13 }}>No events yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {familySchedule.map((item) => (
                        <button key={item.id} onClick={() => { setSelectedFamilyItem(item); setActivePanel("family-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(item.event_date)}{item.event_time ? ` • ${item.event_time}` : ""}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{item.schedule_type} • {item.family_member}</div>
                              {item.notes && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{item.notes}</div>}
                            </div>
                          </div>
                        </button>
                      ))}
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
                  {activePanel === "help" && "Housekeeper Guide"}
                  {activePanel === "expense-detail" && "Expense details"}
                  {activePanel === "maintenance-detail" && "Home care details"}
                  {activePanel === "family-detail" && "Family event details"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Quick actions</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Ghi chi tiêu ngay từ Home\n• Report issue và theo dõi tiến độ\n• Mở lịch gia đình để xem chi tiết từng sự kiện</div></div>
                  <button onClick={() => setShowMaintenanceForm(true)} style={panelBtn}>Report issue ngay</button>
                </div>
              )}

              {activePanel === "expense-detail" && selectedTransaction && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTransaction.description || "Expense"}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedTransaction.transaction_date || selectedTransaction.created_at)}</div></div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}><div>Amount: <strong>{fmtVND(Math.abs(Number(selectedTransaction.amount || 0)))}</strong></div><div>Type: {selectedTransaction.type || "expense"}</div><div>Status: {selectedTransaction.status || "pending"}</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("expenses"); }} style={panelBtn}>Về Expenses</button>
                </div>
              )}

              {activePanel === "maintenance-detail" && selectedMaintenance && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedMaintenance.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedMaintenance.location_in_house || "Không rõ vị trí"}</div></div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}><div>Status: <strong>{selectedMaintenance.status}</strong></div><div>{selectedMaintenance.description || "No notes thêm"}</div></div>
                  <button onClick={() => { handleMaintenanceStatusChange(selectedMaintenance); setActivePanel(""); }} style={panelBtn}>Chuyển trạng thái</button>
                </div>
              )}

              {activePanel === "family-detail" && selectedFamilyItem && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...softCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedFamilyItem.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{fmtDate(selectedFamilyItem.event_date)}{selectedFamilyItem.event_time ? ` • ${selectedFamilyItem.event_time}` : ""}</div></div>
                  <div style={{ ...softCard, padding: 14, fontSize: 13, color: T.text, lineHeight: 1.7 }}><div>Type: {selectedFamilyItem.schedule_type}</div><div>Member: {selectedFamilyItem.family_member}</div><div>{selectedFamilyItem.notes || "No extra notes"}</div></div>
                  <button onClick={() => { setActivePanel(""); setTab("family"); }} style={panelBtn}>Về Family</button>
                </div>
              )}
            </div>
          </div>
        )}

        {showMaintenanceForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Report issue</div>
                <button onClick={() => setShowMaintenanceForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>
              <form onSubmit={handleMaintenanceSubmit}>
                <input value={maintenanceFormData.title} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, title: e.target.value })} placeholder="Tiêu đề" required style={inputStyle} />
                <input value={maintenanceFormData.location_in_house} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, location_in_house: e.target.value })} placeholder="Vị trí trong nhà" required style={{ ...inputStyle, marginTop: 10 }} />
                <textarea value={maintenanceFormData.description} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, description: e.target.value })} placeholder="Mô tả thêm" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowMaintenanceForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Tạo báo cáo</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showFamilyForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Add family event</div>
                <button onClick={() => setShowFamilyForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MIcon name="close" size={22} color={T.textMuted} /></button>
              </div>
              <form onSubmit={handleFamilyScheduleSubmit}>
                <input value={familyFormData.title} onChange={(e) => setFamilyFormData({ ...familyFormData, title: e.target.value })} placeholder="Tiêu đề" required style={inputStyle} />
                <select value={familyFormData.schedule_type} onChange={(e) => setFamilyFormData({ ...familyFormData, schedule_type: e.target.value })} style={{ ...inputStyle, marginTop: 10 }}>
                  <option value="school">School</option>
                  <option value="health">Health</option>
                  <option value="activity">Activity</option>
                  <option value="other">Other</option>
                </select>
                <input value={familyFormData.family_member} onChange={(e) => setFamilyFormData({ ...familyFormData, family_member: e.target.value })} placeholder="Thành viên" style={{ ...inputStyle, marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <input type="date" value={familyFormData.event_date} onChange={(e) => setFamilyFormData({ ...familyFormData, event_date: e.target.value })} required style={inputStyle} />
                  <input type="time" value={familyFormData.event_time} onChange={(e) => setFamilyFormData({ ...familyFormData, event_time: e.target.value })} style={inputStyle} />
                </div>
                <textarea value={familyFormData.notes} onChange={(e) => setFamilyFormData({ ...familyFormData, notes: e.target.value })} placeholder="Ghi chú" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={() => setShowFamilyForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Lưu lịch</button>
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
  borderRadius: 12,
  border: `1px solid ${T.border}`,
  background: "white",
  padding: "0 14px",
  fontSize: 14,
  boxSizing: "border-box",
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StaffShell, { MIcon } from "../../components/shared/StaffShell";
import NotificationCenter from "../../components/shared/NotificationCenter";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtRelative, fmtVND } from "../../lib/format";
import TransactionForm from "../../components/TransactionForm";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
  { id: "transactions", label: "Transactions", icon: "receipt_long" },
  { id: "tasks", label: "Tasks", icon: "task_alt" },
  { id: "calendar", label: "Schedule", icon: "calendar_month" },
];

const cardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(16,24,16,0.04)",
};

const subtleCard = {
  ...cardStyle,
  background: "linear-gradient(180deg,#ffffff 0%, #fbfdf9 100%)",
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

function ImageLightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const [touchStart, setTouchStart] = useState(null);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (diff > 60) prev();
    else if (diff < -60) next();
    setTouchStart(null);
  };

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div onClick={onClose} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}>
        <MIcon name="close" size={28} color="white" />
      </button>
      <img src={images[idx]} alt={`Image ${idx + 1}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8 }} />
      <div style={{ color: "white", marginTop: 12, fontSize: 14, fontWeight: 600 }}>{idx + 1} / {images.length}</div>
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MIcon name="chevron_left" size={28} color="white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MIcon name="chevron_right" size={28} color="white" />
          </button>
        </>
      )}
    </div>
  );
}

function SecretaryTransactionDetail({ tx, profile, onClose, onAction }) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const supportingUrls = tx.ocr_raw_data?.supporting_proof_urls || [];
  const proofLinks = tx.ocr_raw_data?.proof_links || [];
  const proofNote = tx.ocr_raw_data?.proof_note || "";
  const allImages = [tx.slip_image_url, ...supportingUrls].filter(Boolean);

  const canReview = tx.status === "pending" && (profile.role === "owner" || (profile.role === "secretary" && tx.created_by !== profile.id));
  const statusColor = tx.status === "approved" ? T.success : tx.status === "rejected" ? T.danger : T.amber;
  const statusLabel = tx.status === "approved" ? "Approved" : tx.status === "rejected" ? "Rejected" : "Pending review";

  const doAction = async (action) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ transaction_id: tx.id, action, reject_reason: rejectReason }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Action failed");
      onAction(action, tx.id);
    } catch (err) {
      alert(err.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const InfoRow = ({ label, value, mono }) => value ? (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: T.text, fontWeight: 500, fontFamily: mono ? "monospace" : "inherit" }}>{value}</div>
    </div>
  ) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(8,15,8,0.32)", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      {lightbox && <ImageLightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <div style={{ width: "100%", maxWidth: 430, background: T.bg, borderRadius: "24px 24px 0 0", maxHeight: "94vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 14px", background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", color: T.text, fontSize: 15, fontWeight: 600 }}>
            <MIcon name="arrow_back" size={20} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Transaction detail</span>
          <div style={{ width: 48 }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "grid", gap: 14 }}>
          <div style={{ ...cardStyle, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: tx.type === "income" ? T.success : T.danger }}>{tx.type === "income" ? "Income" : "Expense"}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: T.text, marginTop: 6 }}>{fmtVND(tx.amount)}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 12px", borderRadius: 999, background: `${statusColor}15`, color: statusColor, fontSize: 12, fontWeight: 700 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />{statusLabel}
            </div>
          </div>
          <div style={{ ...cardStyle, padding: 18 }}>
            <InfoRow label="Description" value={tx.description} />
            <InfoRow label="Recipient" value={tx.recipient_name} />
            <InfoRow label="Bank" value={tx.bank_name} />
            <InfoRow label="Account number" value={tx.bank_account} mono />
            <InfoRow label="Transaction code" value={tx.transaction_code} mono />
            <InfoRow label="Date" value={fmtDate(tx.transaction_date)} />
            <InfoRow label="Submitted" value={`${fmtDate(tx.created_at)} ${fmtRelative(tx.created_at)}`} />
            <InfoRow label="Submitted by" value={tx.profiles?.full_name || "—"} />
            <InfoRow label="Notes" value={tx.notes} />
          </div>
          {allImages.length > 0 && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 12 }}>Attachments</div>
              <div style={{ display: "grid", gridTemplateColumns: allImages.length === 1 ? "1fr" : "1fr 1fr", gap: 10 }}>
                {allImages.map((url, i) => (
                  <div key={i} onClick={() => setLightbox({ images: allImages, index: i })} style={{ cursor: "pointer", position: "relative" }}>
                    <img src={url} alt={i === 0 ? "Bank slip" : `Proof ${i}`} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 14, border: `1px solid ${T.border}` }} />
                    <div style={{ position: "absolute", bottom: 8, left: 8, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 10, fontWeight: 700 }}>{i === 0 ? "Slip" : `Proof ${i}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {proofLinks.length > 0 && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 10 }}>Proof links</div>
              {proofLinks.map((link, i) => <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 13, color: T.primary, marginBottom: 6, wordBreak: "break-all" }}>{link}</a>)}
            </div>
          )}
          {proofNote && <div style={{ ...cardStyle, padding: 18 }}><div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 6 }}>Proof note</div><div style={{ fontSize: 14, color: T.text, lineHeight: 1.5 }}>{proofNote}</div></div>}
          {canReview && (
            <div style={{ ...cardStyle, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, marginBottom: 14 }}>Audit</div>
              {!showRejectInput ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => doAction("approve")} disabled={loading} style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: loading ? 0.6 : 1 }}>{loading ? "..." : "Approve"}</button>
                  <button onClick={() => setShowRejectInput(true)} disabled={loading} style={{ height: 46, borderRadius: 12, border: `1.5px solid ${T.danger}`, background: "white", color: T.danger, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Reject</button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this transaction rejected? This note will be sent to the submitter." style={{ width: "100%", minHeight: 80, borderRadius: 12, border: `1px solid ${T.border}`, padding: 14, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={() => setShowRejectInput(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", color: T.text, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Cancel</button>
                    <button onClick={() => doAction("reject")} disabled={loading || !rejectReason.trim()} style={{ height: 46, borderRadius: 12, border: "none", background: T.danger, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: loading || !rejectReason.trim() ? 0.5 : 1 }}>{loading ? "..." : "Confirm reject"}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SecretaryPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [activePanel, setActivePanel] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [pendingNotifTxId, setPendingNotifTxId] = useState(null);
  const [txSearch, setTxSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [funds, setFunds] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  const loadData = useCallback(async (txLimit = 40) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const [fundsRes, tasksRes, txApiRes] = await Promise.all([
        supabase.from("funds").select("*").order("id"),
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        fetch(`/api/transactions?limit=${txLimit}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        }),
      ]);

      let txRows = [];
      if (txApiRes.ok) {
        const txJson = await txApiRes.json();
        txRows = txJson.data || [];
      } else {
        const txFallback = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(120);
        txRows = txFallback.data || [];
      }

      setFunds(fundsRes.data || []);
      setTransactions(txRows);
      setTasks(tasksRes.data || []);
    } catch (err) {
      console.error("Secretary loadData error:", err);
      try {
        const txFallback = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(120);
        setTransactions(txFallback.data || []);
      } catch (_) {
        setTransactions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    loadData(40);
  }, [profile?.id, loadData]);

  useEffect(() => {
    if (tab !== "transactions") return;
    if (transactions.length >= 100) return;
    loadData(200);
  }, [tab]);

  useEffect(() => {
    if (!pendingNotifTxId || !transactions.length) return;
    const match = transactions.find((tx) => String(tx.id) === String(pendingNotifTxId));
    if (match) {
      setSelectedTransaction(match);
      setActivePanel("transaction-detail");
      setPendingNotifTxId(null);
    }
  }, [pendingNotifTxId, transactions]);

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

  const fundsBalance = useMemo(() => funds.reduce((s, f) => s + Number(f.current_balance || 0), 0), [funds]);
  const fundedEntries = useMemo(() => funds.filter((f) => Number(f.current_balance || 0) !== 0).length, [funds]);
  const ledgerBalance = useMemo(() => transactions.reduce((sum, tx) => {
    const amount = Number(tx.amount || 0);
    if (tx.type === "income") return sum + amount;
    if (tx.type === "expense") return sum - amount;
    return sum;
  }, 0), [transactions]);
  const usingLedgerFallback = useMemo(() => fundedEntries === 0 && transactions.length > 0, [fundedEntries, transactions.length]);
  const totalBalance = useMemo(() => (usingLedgerFallback ? ledgerBalance : fundsBalance), [usingLedgerFallback, fundsBalance, ledgerBalance]);
  const pendingTx = useMemo(() => transactions.filter((t) => t.status === "pending"), [transactions]);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current - 2; y <= current + 1; y++) years.push(y);
    return years;
  }, []);
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
  const todayTasks = useMemo(() => tasks.filter((t) => (t.due_date || "").startsWith(today)), [tasks, today]);
  const overdueTasks = useMemo(() => tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date.slice(0, 10) < today), [tasks, today]);
  const recentTransactions = useMemo(() => transactions.slice(0, 8), [transactions]);
  const getTxFilterDate = (tx) => {
    const candidate = tx.transaction_date || tx.created_at;
    const d = new Date(candidate || Date.now());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };
  const txMonthFiltered = useMemo(() => transactions.filter((tx) => {
    const base = getTxFilterDate(tx);
    return base.getMonth() === selectedMonth && base.getFullYear() === selectedYear;
  }), [transactions, selectedMonth, selectedYear]);
  const txFiltered = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    if (!q) return txMonthFiltered;
    return txMonthFiltered.filter((tx) => [
      tx.description,
      tx.recipient_name,
      tx.bank_name,
      tx.transaction_code,
      tx.profiles?.full_name,
      tx.status,
      tx.type,
    ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [txMonthFiltered, txSearch]);
  const txIncomeTotal = useMemo(() => txMonthFiltered.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [txMonthFiltered]);
  const txExpenseTotal = useMemo(() => txMonthFiltered.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount || 0), 0), [txMonthFiltered]);
  const txPendingCount = useMemo(() => txMonthFiltered.filter((tx) => tx.status === "pending").length, [txMonthFiltered]);

  useEffect(() => {
    if (!transactions.length) return;
    const latest = getTxFilterDate(transactions[0]);
    const hasCurrentSelection = transactions.some((tx) => {
      const d = getTxFilterDate(tx);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    if (!hasCurrentSelection) {
      setSelectedMonth(latest.getMonth());
      setSelectedYear(latest.getFullYear());
    }
  }, [transactions]);

  const isTodayTransaction = (t) => {
    const createdKey = getLocalDateKey(t.created_at);
    const transactionKey = getLocalDateKey(t.transaction_date);
    return createdKey === today || transactionKey === today;
  };
  const incomeToday = useMemo(() => transactions.filter((t) => t.type === "income" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [transactions, today]);
  const expenseToday = useMemo(() => transactions.filter((t) => t.type === "expense" && isTodayTransaction(t)).reduce((s, t) => s + Number(t.amount || 0), 0), [transactions, today]);
  const upcomingItems = useMemo(() => tasks.filter((t) => t.due_date).slice().sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")), [tasks]);

  return (
    <StaffShell role="secretary">
      <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 100 }}>
        <div style={{ padding: "22px 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={profile?.full_name || "Secretary"} />
              <div>
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Secretary Studio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{profile?.full_name || "Secretary"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NotificationCenter
                userId={profile?.id}
                onOpenNotification={(notif) => {
                  const txId = notif?.payload?.transaction_id;
                  if (txId) {
                    setTab("transactions");
                    const match = transactions.find((tx) => String(tx.id) === String(txId));
                    if (match) {
                      setSelectedTransaction(match);
                      setActivePanel("transaction-detail");
                    } else {
                      setPendingNotifTxId(txId);
                      loadData(200);
                    }
                    return;
                  }
                  if (notif?.link && typeof window !== "undefined") window.location.href = notif.link;
                }}
              />
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
                  <div style={{ ...cardStyle, padding: 18, marginBottom: 14, background: "linear-gradient(135deg,#20341d 0%, #2b4b24 58%, #3d6b30 100%)", color: "white", overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", right: -28, top: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Desk overview</div>
                          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>Desk calm</div>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 700 }}>Secretary</div>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.82, marginBottom: 8 }}>Tracked balance</div>
                      <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 10 }}>{fmtVND(totalBalance)}</div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: usingLedgerFallback ? "#fbbf24" : "#86efac" }} />
                        {usingLedgerFallback ? "Ledger fallback" : "Synced from funds"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Pending</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{pendingTx.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Today</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{todayTasks.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>Overdue</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{overdueTasks.length}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div style={{ ...subtleCard, padding: 14 }}>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>In today</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.success, marginTop: 6 }}>{fmtVND(incomeToday)}</div>
                    </div>
                    <div style={{ ...subtleCard, padding: 14 }}>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Out today</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: T.danger, marginTop: 6 }}>{fmtVND(expenseToday)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                    <QuickAction icon="upload_file" label="Upload slip" sub="Scan receipt and log transaction" onClick={() => setShowTxForm(true)} primary />
                    <QuickAction icon="task_alt" label="New task" sub="Create a task in seconds" onClick={() => setShowTaskForm(true)} />
                  </div>

                  <div style={{ ...subtleCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 12 }}>Quiet assets</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 156, background: "#7c6852" }}>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: "linear-gradient(180deg, rgba(16,20,16,0.02) 0%, rgba(16,20,16,0.40) 60%, rgba(16,20,16,0.74) 100%), url('/art-blocks/art-note-bronze-study.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "center 38%",
                            transform: "scale(1.04)",
                          }}
                        />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 36%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>Art note</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Bronze study</div>
                        </div>
                      </div>
                      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 156, background: "#1e3224" }}>
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: "linear-gradient(180deg, rgba(12,22,14,0.04) 0%, rgba(12,22,14,0.42) 60%, rgba(12,22,14,0.80) 100%), url('/art-blocks/collection-tea-vessel.jpg')",
                            backgroundSize: "cover",
                            backgroundPosition: "center 42%",
                            transform: "scale(1.05)",
                          }}
                        />
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 35%)" }} />
                        <div style={{ position: "absolute", left: 14, bottom: 14, right: 14, color: "white" }}>
                          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.84 }}>Collection</div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Tea vessel</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...subtleCard, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Today focus</div>
                      <button onClick={() => setTab("tasks")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {todayTasks.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>No tasks due today.</div>
                    ) : todayTasks.slice(0, 3).map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ width: 10, height: 10, borderRadius: 999, background: task.priority === "urgent" ? T.danger : task.priority === "high" ? T.amber : T.primary, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{task.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description || "No notes"}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Recent flow</div>
                      <button onClick={() => setTab("transactions")} style={{ border: "none", background: "transparent", color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Open</button>
                    </div>
                    {recentTransactions.length === 0 ? (
                      <div style={{ fontSize: 13, color: T.textMuted }}>No transactions yet.</div>
                    ) : recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 12, background: tx.type === "income" ? "#eafaf2" : "#fff1f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MIcon name={tx.type === "income" ? "south_west" : "north_east"} size={18} color={tx.type === "income" ? T.success : T.danger} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description || tx.recipient_name || "Transactions"}</div>
                            <div style={{ fontSize: 12, color: T.textMuted }}>{fmtRelative(tx.created_at)}</div>
                          </div>
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

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ flex: 1, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}>
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: 90, height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, padding: "0 12px", fontSize: 14, fontWeight: 600, color: T.text, appearance: "none", WebkitAppearance: "none" }}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>

                  <div style={{ position: "relative", marginBottom: 14 }}>
                    <MIcon name="search" size={18} color={T.textMuted} style={{ position: "absolute", left: 14, top: 12 }} />
                    <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search transactions..." style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, paddingLeft: 40, paddingRight: 14, fontSize: 14, color: T.text, boxSizing: "border-box" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.success, letterSpacing: "0.06em" }}>Income</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.success, marginTop: 4 }}>{fmtVND(txIncomeTotal)}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.danger, letterSpacing: "0.06em" }}>Expense</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.danger, marginTop: 4 }}>{fmtVND(txExpenseTotal)}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: T.amber, letterSpacing: "0.06em" }}>Pending</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.amber, marginTop: 4 }}>{txPendingCount}</div>
                    </div>
                  </div>

                  {txFiltered.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>
                      No transactions found.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {txFiltered.map((tx) => {
                        const isIncome = tx.type === "income";
                        const statusColor = tx.status === "approved" ? T.success : tx.status === "pending" ? T.amber : T.danger;
                        return (
                          <button key={tx.id} onClick={() => { setSelectedTransaction(tx); setActivePanel("transaction-detail"); }} style={{ ...cardStyle, padding: 14, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${T.border}` }}>
                            <div style={{ width: 42, height: 42, borderRadius: 12, background: isIncome ? "#ecfdf3" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <MIcon name={isIncome ? "trending_up" : "trending_down"} size={20} color={isIncome ? T.success : T.danger} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 12, alignItems: "start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {tx.description || tx.recipient_name || (isIncome ? "Income" : "Expense")}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, minWidth: 0, flexWrap: "wrap" }}>
                                  <div style={{ fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {tx.profiles?.full_name || "—"} · {fmtDate(tx.transaction_date || tx.created_at)}
                                  </div>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: `${statusColor}15`, color: statusColor, fontSize: 10, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                                    {tx.status}
                                  </div>
                                </div>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: isIncome ? T.success : T.danger, whiteSpace: "nowrap", textAlign: "right", alignSelf: "center" }}>
                                {isIncome ? "+" : "−"}{fmtVND(Math.abs(Number(tx.amount || 0)))}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "tasks" && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Tasks</div>
                    <button onClick={() => setShowTaskForm(true)} style={{ border: "none", background: T.primary, color: "white", borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      + Create
                    </button>
                  </div>
                  {tasks.length === 0 ? (
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>No tasks yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {tasks.map((task) => (
                        <button key={task.id} onClick={() => { setSelectedTask(task); setActivePanel("task-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{task.title}</div>
                              {task.description && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{task.description}</div>}
                              {task.due_date && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Due: {fmtDate(task.due_date)}</div>}
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
                    <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: T.textMuted }}>No upcoming items.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {upcomingItems.map((item) => (
                        <button key={item.id} onClick={() => { setSelectedTask(item); setActivePanel("task-detail"); }} style={{ ...cardStyle, width: "100%", padding: 16, textAlign: "left", cursor: "pointer", border: `1px solid ${T.border}` }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>{fmtDate(item.due_date)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} onSuccess={() => { setShowTxForm(false); loadData(); }} />}

        {activePanel && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 220, display: "flex", alignItems: "flex-end" }} onClick={() => setActivePanel("")}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18, maxHeight: "78vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
                  {activePanel === "help" && "Secretary Guide"}
                  {activePanel === "transaction-detail" && "Transaction details"}
                  {activePanel === "task-detail" && "Task details"}
                </div>
                <button onClick={() => setActivePanel("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>

              {activePanel === "help" && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Quick actions</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>• Upload a slip fast\n• Create a task quickly\n• Open any card to view details</div></div>
                  <button onClick={() => setShowTxForm(true)} style={panelBtn}>Upload slip</button>
                </div>
              )}

              {activePanel === "transaction-detail" && selectedTransaction && (
                <SecretaryTransactionDetail
                  tx={selectedTransaction}
                  profile={profile}
                  onClose={() => setActivePanel("")}
                  onAction={() => {
                    setActivePanel("");
                    setSelectedTransaction(null);
                    loadData();
                  }}
                />
              )}

              {activePanel === "task-detail" && selectedTask && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subtleCard, padding: 14 }}><div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{selectedTask.title}</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{selectedTask.due_date ? fmtDate(selectedTask.due_date) : "No deadline"}</div></div>
                  <div style={{ ...subtleCard, padding: 14, fontSize: 13, color: T.text }}>Status: <strong>{selectedTask.status}</strong><br/>Priority: {selectedTask.priority || "medium"}<br/>{selectedTask.description || "No notes"}</div>
                  <button onClick={() => { toggleTaskStatus(selectedTask); setActivePanel(""); }} style={panelBtn}>Update status</button>
                </div>
              )}
            </div>
          </div>
        )}

        {showTaskForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,15,0.38)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: T.card, borderRadius: "22px 22px 0 0", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>New task</div>
                <button onClick={() => setShowTaskForm(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                  <MIcon name="close" size={22} color={T.textMuted} />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" required style={inputStyle} />
                <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Notes" style={{ ...inputStyle, minHeight: 90, resize: "none", marginTop: 10 }} />
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
                  <button type="button" onClick={() => setShowTaskForm(false)} style={{ height: 46, borderRadius: 12, border: `1px solid ${T.border}`, background: "white", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
                  <button type="submit" style={{ height: 46, borderRadius: 12, border: "none", background: T.primary, color: "white", cursor: "pointer", fontWeight: 800 }}>Create</button>
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

const panelBtn = {
  height: 46,
  borderRadius: 12,
  border: "none",
  background: T.primary,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

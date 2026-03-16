"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { T } from "../../lib/tokens";

function NotifItem({ notif, onRead, onOpen }) {
  const typeIcon = { report: "bar_chart", pending_approval: "schedule", warning: "warning", reminder: "notifications", info: "info" };
  const typeColor = { report: "#3b82f6", pending_approval: "#f59e0b", warning: "#ef4444", reminder: T.primary, info: "#64748b" };

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleClick = async () => {
    if (!notif.read_at) await onRead(notif.id);
    onOpen?.(notif);
  };

  return (
    <div onClick={handleClick} style={{
      padding: "14px 16px", borderBottom: `1px solid ${T.border}`,
      background: notif.read_at ? "#fff" : "#f8fdf5",
      cursor: notif.read_at ? "default" : "pointer", transition: "background 0.2s",
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: `${typeColor[notif.type] || "#64748b"}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: typeColor[notif.type] || "#64748b" }}>
          {typeIcon[notif.type] || "notifications"}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <p style={{ fontSize: 14, fontWeight: notif.read_at ? 400 : 600, color: T.text, lineHeight: 1.3 }}>{notif.title}</p>
          <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{timeAgo(notif.created_at)}</span>
        </div>
        {notif.body && (
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {notif.body}
          </p>
        )}
      </div>
    </div>
  );
}

export default function NotificationCenter({ userId, onOpenNotification }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef(null);
  const unread = notifs.filter((n) => !n.read_at).length;

  const fetchNotifs = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
    setNotifs(data || []);
    setLoading(false);
  };

  // Fetch once on mount — Realtime subscription handles subsequent updates (no polling)
  useEffect(() => { fetchNotifs(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notifs-${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (p) => setNotifs((prev) => [p.new, ...prev])).subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const markRead = async (id) => {
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    setNotifs((p) => p.map((n) => n.id === id ? { ...n, read_at: now } : n));
  };

  const openNotification = (notif) => {
    if (onOpenNotification) {
      onOpenNotification(notif);
      setOpen(false);
      return;
    }

    const txId = notif?.payload?.transaction_id;
    const target = txId ? `/transactions?tx=${txId}` : (notif?.link || null);
    if (target && typeof window !== "undefined") {
      window.location.href = target;
      setOpen(false);
    }
  };

  const markAllRead = async () => {
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    setNotifs((p) => p.map((n) => ({ ...n, read_at: n.read_at || now })));
  };

  const deleteAllNotifs = async () => {
    const ok = typeof window === "undefined" ? true : window.confirm("Delete all notifications for this account?");
    if (!ok) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Failed to delete notifications");
      setNotifs([]);
      setOpen(false);
    } catch (err) {
      alert(err.message || "Failed to delete notifications");
    }
  };

  // Group by date
  const groupByDate = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups = {};
    notifs.forEach((n) => {
      const d = new Date(n.created_at).toDateString();
      const label = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });
    return groups;
  };

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      <button onClick={() => { setOpen((o) => !o); if (!open) fetchNotifs(); }} style={{
        width: 40, height: 40, borderRadius: "50%", background: "none", border: "none",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: T.text }}>notifications</span>
        {unread > 0 && <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: T.primary, border: "2px solid #fff" }} />}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: -8, top: "calc(100% + 8px)",
          width: 340, maxHeight: 480, background: "#fff", borderRadius: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)", border: `1px solid ${T.border}`,
          zIndex: 1000, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "16px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Notifications</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {unread > 0 && <button onClick={markAllRead} style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Mark all read</button>}
              <button onClick={deleteAllNotifs} style={{ width: 28, height: 28, borderRadius: "50%", background: `${T.primary}10`, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: T.primary }}>settings</span>
              </button>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && notifs.length === 0 && <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Loading...</div>}
            {!loading && notifs.length === 0 && <div style={{ padding: 32, textAlign: "center", color: T.textMuted, fontSize: 13 }}>No notifications</div>}
            {Object.entries(groupByDate()).map(([label, items]) => (
              <div key={label}>
                <div style={{ padding: "10px 16px 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted }}>{label}</div>
                {items.map((n) => <NotifItem key={n.id} notif={n} onRead={markRead} onOpen={openNotification} />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

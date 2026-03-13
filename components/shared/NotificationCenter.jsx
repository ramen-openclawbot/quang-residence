"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { T } from "../../lib/tokens";

function BellIcon({ hasUnread }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hasUnread && (
        <span style={{
          position: "absolute", top: -4, right: -4,
          width: 10, height: 10, borderRadius: "50%",
          background: T.danger, border: "2px solid #fff",
        }} />
      )}
    </div>
  );
}

function NotifItem({ notif, onRead }) {
  const typeIcon = {
    report: "📊",
    pending_approval: "⏳",
    warning: "⚠️",
    reminder: "🔔",
    info: "ℹ️",
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    return `${Math.floor(hrs / 24)} ngày trước`;
  };

  return (
    <div
      onClick={() => !notif.read_at && onRead(notif.id)}
      style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${T.bg}`,
        background: notif.read_at ? "#fff" : "#f0fce8",
        cursor: notif.read_at ? "default" : "pointer",
        transition: "background 0.2s",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>
          {typeIcon[notif.type] || "🔔"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: notif.read_at ? 400 : 600,
            color: T.text, lineHeight: 1.4,
          }}>
            {notif.title}
          </div>
          {notif.body && (
            <div style={{
              fontSize: 12, color: T.textMuted, marginTop: 3,
              whiteSpace: "pre-line", lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}>
              {notif.body}
            </div>
          )}
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
            {timeAgo(notif.created_at)}
          </div>
        </div>
        {!notif.read_at && (
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: T.primary, flexShrink: 0, marginTop: 5,
          }} />
        )}
      </div>
    </div>
  );
}

export default function NotificationCenter({ userId }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropRef = useRef(null);

  const unreadCount = notifs.filter((n) => !n.read_at).length;

  const fetchNotifs = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifs();
    // Poll every 60s for new notifications
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs((prev) => [payload.new, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const markRead = async (id) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setNotifs((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setNotifs((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifs(); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: T.text, padding: 6, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span style={{
            marginLeft: 4, fontSize: 11, fontWeight: 700,
            color: T.danger,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, maxHeight: 480,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          border: `1px solid ${T.bg}`,
          zIndex: 1000,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${T.bg}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              Thông báo {unreadCount > 0 && `(${unreadCount} chưa đọc)`}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 12, color: T.primary, background: "none",
                  border: "none", cursor: "pointer", fontWeight: 600,
                }}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && notifs.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                Đang tải...
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                Không có thông báo
              </div>
            )}
            {notifs.map((n) => (
              <NotifItem key={n.id} notif={n} onRead={markRead} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

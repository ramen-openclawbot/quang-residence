"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { T } from "../../lib/tokens";
import { MIcon } from "../shared/StaffShell";

// ─── Keyframes ───────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes cPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes cSlideUp{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes cFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes cDot{0%,80%,100%{opacity:.25}40%{opacity:1}}
`;

// ─── Context helpers ─────────────────────────────────────────────
const CTX_MAP = {
  "/secretary": { label: "Secretary desk", hint: "Upload bank slip to create a transaction." },
  "/driver": { label: "Driver log", hint: "Send a receipt photo to log an expense." },
  "/housekeeper": { label: "Home operations", hint: "Send a receipt photo to log an expense." },
  "/transactions": { label: "Transaction ledger", hint: "Upload bank slip to add a new entry." },
  "/owner": { label: "Owner console", hint: "Ask me anything about your household." },
};
function getCtx(path) { return CTX_MAP[path] || { label: "ZenHome", hint: "How can I help?" }; }

// ─── Tiny ID generator ──────────────────────────────────────────
let _seq = 0;
function uid() { return `m${++_seq}_${Date.now()}`; }

// ─── Image compression (mirrors TransactionForm) ────────────────
async function compressImage(file) {
  if (!file?.type?.startsWith("image/")) return file;
  const MAX = 1200, Q = 0.75;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    let { width: w, height: h } = img;
    const largest = Math.max(w, h);
    if (largest > MAX) {
      const s = MAX / largest;
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", Q));
    return blob ? new File([blob], "slip.jpg", { type: "image/jpeg" }) : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fileToBase64(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = fail;
    r.readAsDataURL(file);
  });
}

// ─── Upload to Supabase Storage ─────────────────────────────────
async function uploadFile(file, profileId, prefix = "slip") {
  const path = `${profileId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage.from("bank-slips").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("bank-slips").getPublicUrl(path);
  return data.publicUrl;
}

// ─── Format amount ──────────────────────────────────────────────
function fmtVND(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "d";
}

// ═════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function ChatInbox() {
  const { profile, getToken } = useAuth();
  const pathname = usePathname();
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  // ─── ALL useState hooks MUST be above any conditional return ──
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [funds, setFunds] = useState([]);
  const [badge, setBadge] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingOcr, setPendingOcr] = useState(null);
  const [creatingTx, setCreatingTx] = useState(false);
  const [createdTxId, setCreatedTxId] = useState(null);
  const [askingSupport, setAskingSupport] = useState(false);
  const [slipUrl, setSlipUrl] = useState(null);
  const [dupeWarning, setDupeWarning] = useState(null);
  const [fabRight, setFabRight] = useState(20);
  const [boxWidth, setBoxWidth] = useState(380);
  const [boxHeight, setBoxHeight] = useState(540);

  // ─── ALL useEffect hooks MUST be above any conditional return ──

  // Load funds once
  useEffect(() => {
    let mounted = true;
    supabase
      .from("funds")
      .select("id, name, fund_type")
      .order("id")
      .then(({ data }) => {
        if (mounted && data) setFunds(data);
      });
    return () => { mounted = false; };
  }, []);

  // FAB position + chat box sizing (recalculate on resize)
  useEffect(() => {
    function calc() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setFabRight(vw > 430 ? Math.max(20, (vw - 430) / 2 + 20) : 20);
      setBoxWidth(Math.min(380, vw - 24));
      setBoxHeight(Math.min(540, vh - 120));
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Auto-scroll messages to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, processing, pendingOcr, askingSupport, dupeWarning]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0 && profile) {
      const ctx = getCtx(pathname);
      const name = profile.full_name?.split(" ").pop() || "";
      setMessages([{
        id: uid(), role: "agent",
        content: `Hi ${name}! ${ctx.hint}`,
        ts: Date.now(),
      }]);
    }
  }, [open, profile, pathname, messages.length]);

  // Clear badge when chat opens
  useEffect(() => {
    if (open) setBadge(false);
  }, [open]);

  // ─── NOW safe to do conditional return ────────────────────────
  // Don't render on login page or before auth is ready
  if (!profile || pathname === "/login") return null;

  // ─── Message helpers ──────────────────────────────────────────
  function addUser(content, extra) {
    setMessages((p) => [...p, { id: uid(), role: "user", content, ts: Date.now(), ...extra }]);
  }
  function addAgent(content, extra) {
    setMessages((p) => [...p, { id: uid(), role: "agent", content, ts: Date.now(), ...extra }]);
    if (!open) setBadge(true);
  }

  // ─── SEND TEXT ────────────────────────────────────────────────
  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addUser(text);

    setTimeout(() => {
      if (/bank\s?slip|receipt|ho[aá]\s?[dđ][oơ]n|chuy[eể]n\s?kho[aả]n|upload|ảnh/i.test(text)) {
        addAgent("Tap the camera icon below to upload your bank slip, and I'll scan it for you.");
      } else {
        addAgent("I can help you create transactions from bank slips. Tap the camera icon to get started!");
      }
    }, 600);
  }

  // ─── IMAGE UPLOAD + OCR ───────────────────────────────────────
  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    const previewUrl = URL.createObjectURL(file);
    addUser("Bank slip", { imageUrl: previewUrl });
    setProcessing(true);

    try {
      const compressed = await compressImage(file);
      const url = await uploadFile(compressed, profile.id, "chat-slip");
      setSlipUrl(url);

      const token = await getToken();
      if (!token) {
        addAgent("Session expired. Please log in again.");
        setProcessing(false);
        return;
      }

      const base64 = await fileToBase64(compressed);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: base64, imageMimeType: "image/jpeg" }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        addAgent("Could not read this image. Please try a clearer photo.");
        setProcessing(false);
        return;
      }

      const ocr = data.data || {};
      setPendingOcr({
        amount: ocr.amount ? String(ocr.amount) : "",
        type: "expense",
        description: ocr.description || "",
        recipient_name: ocr.recipient_name || "",
        bank_name: ocr.bank_name || "",
        bank_account: ocr.bank_account || "",
        transaction_code: ocr.transaction_code || "",
        transaction_date: ocr.transaction_date || new Date().toISOString().slice(0, 10),
        fund_id: "",
      });
      addAgent("Scan successful! Review the details below:");
    } catch (err) {
      console.error("Chat OCR error:", err);
      addAgent("Something went wrong during scanning. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  // ─── CONFIRM TRANSACTION ──────────────────────────────────────
  async function handleConfirmTx(data) {
    if (!data.amount || Number(data.amount) <= 0) {
      addAgent("Please enter a valid amount.");
      return;
    }

    // Duplicate check (only run once, skip if already warned)
    if (!dupeWarning) {
      try {
        const amt = Number(data.amount);
        const dt = data.transaction_date || new Date().toISOString().slice(0, 10);
        const dayBefore = new Date(dt);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayAfter = new Date(dt);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const { data: dupes } = await supabase
          .from("transactions")
          .select("id, amount, transaction_date, description")
          .eq("created_by", profile.id)
          .eq("amount", amt)
          .gte("transaction_date", dayBefore.toISOString())
          .lte("transaction_date", dayAfter.toISOString())
          .neq("status", "rejected")
          .limit(3);

        if (dupes && dupes.length > 0) {
          setDupeWarning({ dupes, data });
          return;
        }
      } catch {
        // Ignore dupe check errors — proceed with creation
      }
    }

    setDupeWarning(null);
    setCreatingTx(true);

    try {
      const token = await getToken();
      if (!token) {
        addAgent("Session expired. Please log in again.");
        setCreatingTx(false);
        return;
      }

      const payload = {
        type: data.type || "expense",
        amount: Number(data.amount),
        fund_id: data.fund_id ? Number(data.fund_id) : null,
        description: data.description || null,
        recipient_name: data.recipient_name || null,
        bank_name: data.bank_name || null,
        bank_account: data.bank_account || null,
        transaction_code: data.transaction_code || null,
        transaction_date: data.transaction_date
          ? new Date(data.transaction_date).toISOString()
          : null,
        created_by: profile.id,
        slip_image_url: slipUrl,
        status: "pending",
        source: "app",
        ocr_raw_data: data,
      };

      const { data: inserted, error } = await supabase
        .from("transactions")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Notify reviewer (fire-and-forget)
      try {
        await fetch("/api/transactions/notify-submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            transaction_id: inserted.id,
            amount: payload.amount,
            type: payload.type,
            description: payload.description,
          }),
        });
      } catch {
        // Ignore notification errors
      }

      setCreatedTxId(inserted.id);
      setPendingOcr(null);
      addAgent(
        `Transaction created (${fmtVND(data.amount)}) and sent for approval! Would you like to attach supporting documents?`
      );
      setAskingSupport(true);
    } catch (err) {
      console.error("Create tx error:", err);
      addAgent("Failed to create transaction: " + (err.message || "Unknown error"));
    } finally {
      setCreatingTx(false);
    }
  }

  // ─── SUPPORT IMAGE ────────────────────────────────────────────
  async function handleSupportUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !createdTxId) return;
    if (fileRef.current) fileRef.current.value = "";

    addUser("Supporting document", { imageUrl: URL.createObjectURL(file) });
    try {
      const compressed = await compressImage(file);
      const url = await uploadFile(compressed, profile.id, "support");

      const { data: tx } = await supabase
        .from("transactions")
        .select("ocr_raw_data")
        .eq("id", createdTxId)
        .single();
      const existing = tx?.ocr_raw_data || {};
      const supportUrls = [...(existing.supporting_proof_urls || []), url];
      await supabase
        .from("transactions")
        .update({ ocr_raw_data: { ...existing, supporting_proof_urls: supportUrls } })
        .eq("id", createdTxId);

      addAgent("Document attached! Upload more or tap 'Done' when finished.");
    } catch {
      addAgent("Failed to upload document. Please try again.");
    }
  }

  function handleSkipSupport() {
    setAskingSupport(false);
    setCreatedTxId(null);
    setSlipUrl(null);
    addAgent("All done! Send another bank slip anytime.");
  }

  function handleDupeConfirm() {
    if (dupeWarning?.data) handleConfirmTx(dupeWarning.data);
  }

  function handleDupeDismiss() {
    setDupeWarning(null);
    setPendingOcr(null);
    addAgent("Transaction cancelled. Upload a new slip to try again.");
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  const ctx = getCtx(pathname);

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Floating Action Button ───────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        style={{
          position: "fixed",
          bottom: 24,
          right: fabRight,
          zIndex: 10000,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: "none",
          cursor: "pointer",
          background: `linear-gradient(135deg, ${T.primary}, #3da214)`,
          boxShadow: open
            ? "0 4px 12px rgba(86,201,29,0.3)"
            : "0 4px 20px rgba(86,201,29,0.4), 0 0 0 6px rgba(86,201,29,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          animation: !open && !badge ? "cPulse 3s ease-in-out infinite" : "none",
        }}
      >
        <MIcon name={open ? "close" : "chat_bubble"} size={26} color="#fff" filled={!open} />
        {badge && !open && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: 9,
              background: T.danger,
              border: "2px solid #fff",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "cPulse 1s ease-in-out infinite",
            }}
          >
            !
          </span>
        )}
      </button>

      {/* ── Chat Box ─────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "fixed",
            zIndex: 10001,
            bottom: 90,
            right: fabRight,
            width: boxWidth,
            height: boxHeight,
            borderRadius: 20,
            background: T.card,
            boxShadow: "0 16px 56px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "cSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            fontFamily: T.font,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: `linear-gradient(135deg, ${T.primary}, #3da214)`,
              padding: "14px 16px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
                ZenHome Chat
              </div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>{ctx.label}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "none",
                borderRadius: 10,
                padding: 6,
                cursor: "pointer",
                display: "flex",
              }}
            >
              <MIcon name="close" size={18} color="#fff" />
            </button>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="no-scrollbar"
            style={{ flex: 1, overflowY: "auto", padding: "14px 12px", background: "#f8faf8" }}
          >
            {messages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: 10, animation: "cFadeIn 0.25s ease-out" }}>
                {msg.role === "agent" ? <AgentBubble msg={msg} /> : <UserBubble msg={msg} />}
              </div>
            ))}

            {/* Scanning indicator */}
            {processing && (
              <div style={{ marginBottom: 10, animation: "cFadeIn 0.25s ease-out" }}>
                <div style={{ ...bubbleBase, ...agentBubbleS }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MIcon name="document_scanner" size={16} color={T.primary} />
                    <span style={{ fontSize: 13, color: T.primary, fontWeight: 600 }}>
                      Scanning
                    </span>
                    <span style={{ display: "flex", gap: 3 }}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: T.primary,
                            animation: `cDot 1.2s ${i * 0.2}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* OCR Result Card */}
            {pendingOcr && !dupeWarning && (
              <div style={{ marginBottom: 10, animation: "cFadeIn 0.3s ease-out" }}>
                <OCRCard
                  data={pendingOcr}
                  funds={funds}
                  onConfirm={handleConfirmTx}
                  onCancel={() => {
                    setPendingOcr(null);
                    addAgent("Cancelled. Upload a new slip anytime.");
                  }}
                  loading={creatingTx}
                />
              </div>
            )}

            {/* Duplicate warning */}
            {dupeWarning && (
              <div style={{ marginBottom: 10, animation: "cFadeIn 0.3s ease-out" }}>
                <DupeAlert
                  dupes={dupeWarning.dupes}
                  onConfirm={handleDupeConfirm}
                  onCancel={handleDupeDismiss}
                />
              </div>
            )}

            {/* Support image prompt */}
            {askingSupport && (
              <div
                style={{
                  marginBottom: 10,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-start",
                  animation: "cFadeIn 0.3s ease-out",
                }}
              >
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ ...actionBtnS, background: T.primary, color: "#fff" }}
                >
                  <MIcon name="add_a_photo" size={16} color="#fff" /> Upload
                </button>
                <button
                  onClick={handleSkipSupport}
                  style={{ ...actionBtnS, background: "#f1f5f1", color: T.textSec }}
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: `1px solid ${T.border}`,
              background: T.card,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Upload image"
              disabled={processing || creatingTx}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                background: `${T.primary}10`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              <MIcon name="photo_camera" size={20} color={T.primary} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              disabled={processing || creatingTx}
              style={{
                flex: 1,
                height: 38,
                padding: "0 14px",
                fontSize: 13,
                fontFamily: T.font,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                outline: "none",
                background: "#f8faf8",
                color: T.text,
                transition: "border-color 0.2s",
              }}
            />
            <button
              onClick={handleSend}
              aria-label="Send"
              disabled={!input.trim() || processing || creatingTx}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                background: input.trim() ? T.primary : `${T.primary}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <MIcon name="send" size={18} color={input.trim() ? "#fff" : `${T.primary}60`} />
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={askingSupport ? handleSupportUpload : handleImageSelect}
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═════════════════════════════════════════════════════════════════

const bubbleBase = {
  maxWidth: "85%",
  padding: "10px 14px",
  borderRadius: 16,
  fontSize: 13,
  lineHeight: 1.5,
  wordBreak: "break-word",
  fontFamily: T.font,
};
const agentBubbleS = {
  background: "#fff",
  color: T.text,
  borderBottomLeftRadius: 4,
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};
const userBubbleS = {
  background: T.primary,
  color: "#fff",
  borderBottomRightRadius: 4,
  marginLeft: "auto",
};
const actionBtnS = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: T.font,
  transition: "all 0.2s",
};

// ═════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════

function AgentBubble({ msg }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${T.primary}, #3da214)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <MIcon name="smart_toy" size={16} color="#fff" />
      </div>
      <div style={{ ...bubbleBase, ...agentBubbleS }}>{msg.content}</div>
    </div>
  );
}

function UserBubble({ msg }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      {msg.imageUrl && (
        <img
          src={msg.imageUrl}
          alt="Upload"
          style={{
            maxWidth: "70%",
            borderRadius: 14,
            marginBottom: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        />
      )}
      {msg.content && <div style={{ ...bubbleBase, ...userBubbleS }}>{msg.content}</div>}
    </div>
  );
}

function OCRCard({ data, funds, onConfirm, onCancel, loading }) {
  const [form, setForm] = useState({ ...data });
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const fld = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: T.font,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    outline: "none",
    background: "#fff",
    color: T.text,
  };
  const lbl = {
    fontSize: 11,
    fontWeight: 600,
    color: T.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 16,
        border: `1px solid ${T.primary}30`,
        boxShadow: `0 2px 12px ${T.primary}10`,
      }}
    >
      {/* Type toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["expense", "income"].map((t) => (
          <button
            key={t}
            onClick={() => upd("type", t)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: T.font,
              background:
                form.type === t ? (t === "expense" ? "#fef2f2" : "#ecfdf3") : "#f1f5f1",
              color:
                form.type === t ? (t === "expense" ? "#dc2626" : "#16a34a") : T.textMuted,
              transition: "all 0.2s",
            }}
          >
            {t === "expense" ? "Out" : "In"}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={lbl}>Amount *</div>
        <input
          type="number"
          value={form.amount}
          onChange={(e) => upd("amount", e.target.value)}
          placeholder="0"
          style={{ ...fld, fontSize: 18, fontWeight: 700 }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={lbl}>Description</div>
        <input
          value={form.description}
          onChange={(e) => upd("description", e.target.value)}
          placeholder="What is this for?"
          style={fld}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Recipient</div>
          <input
            value={form.recipient_name}
            onChange={(e) => upd("recipient_name", e.target.value)}
            placeholder="Name"
            style={fld}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Bank</div>
          <input
            value={form.bank_name}
            onChange={(e) => upd("bank_name", e.target.value)}
            placeholder="Bank"
            style={fld}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Account</div>
          <input
            value={form.bank_account}
            onChange={(e) => upd("bank_account", e.target.value)}
            placeholder="Number"
            style={fld}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Tx Code</div>
          <input
            value={form.transaction_code}
            onChange={(e) => upd("transaction_code", e.target.value)}
            placeholder="Code"
            style={fld}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Date</div>
          <input
            type="date"
            value={form.transaction_date}
            onChange={(e) => upd("transaction_date", e.target.value)}
            style={fld}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={lbl}>Fund</div>
          <select
            value={form.fund_id}
            onChange={(e) => upd("fund_id", e.target.value)}
            style={{ ...fld, appearance: "auto" }}
          >
            <option value="">Select fund</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            ...actionBtnS,
            flex: 1,
            justifyContent: "center",
            background: "#f1f5f1",
            color: T.textSec,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(form)}
          disabled={loading}
          style={{
            ...actionBtnS,
            flex: 2,
            justifyContent: "center",
            background: loading ? `${T.primary}80` : T.primary,
            color: "#fff",
          }}
        >
          {loading ? "Creating..." : "Submit for review"}
        </button>
      </div>
    </div>
  );
}

function DupeAlert({ dupes, onConfirm, onCancel }) {
  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #f59e0b40",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <MIcon name="warning" size={18} color="#f59e0b" filled />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
          Possible duplicate
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#92400e", marginBottom: 10, lineHeight: 1.5 }}>
        Found {dupes.length} similar transaction(s) with the same amount near this date.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            ...actionBtnS,
            flex: 1,
            justifyContent: "center",
            background: "#fef3c7",
            color: "#92400e",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            ...actionBtnS,
            flex: 1,
            justifyContent: "center",
            background: "#f59e0b",
            color: "#fff",
          }}
        >
          Create anyway
        </button>
      </div>
    </div>
  );
}

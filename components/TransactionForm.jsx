"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { T, card, flexBetween, flexCenter } from "../lib/tokens";
import { fmtVND } from "../lib/format";
import { UploadIcon, ChevronLeft, PlusIcon, CameraIcon } from "./shared/Icons";
import { getIcon } from "./shared/Icons";

export default function TransactionForm({ onClose, onSuccess, defaultFundId, defaultType = "expense" }) {
  const { profile } = useAuth();
  const fileRef = useRef(null);

  const [type, setType] = useState(defaultType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [fundId, setFundId] = useState(defaultFundId || "");
  const [categoryId, setCategoryId] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankName, setBankName] = useState("");
  const [transactionCode, setTransactionCode] = useState("");
  const [notes, setNotes] = useState("");
  const [slipImage, setSlipImage] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Data lists
  const [funds, setFunds] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from("funds").select("*").order("id"),
      supabase.from("categories").select("*").order("sort_order"),
    ]).then(([f, c]) => {
      if (f.data) setFunds(f.data);
      if (c.data) setCategories(c.data);
    });
  }, []);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipImage(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!amount || !fundId) {
      setError("Vui lòng nhập số tiền và chọn quỹ");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let slipUrl = null;

      // Upload slip image if provided
      if (slipImage) {
        const fileName = `${Date.now()}_${slipImage.name}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("bank-slips")
          .upload(`${profile.id}/${fileName}`, slipImage);

        if (uploadErr) {
          console.error("Upload error:", uploadErr);
        } else {
          const { data: urlData } = supabase.storage
            .from("bank-slips")
            .getPublicUrl(`${profile.id}/${fileName}`);
          slipUrl = urlData?.publicUrl;
        }
      }

      // Insert transaction
      const { error: insertErr } = await supabase.from("transactions").insert({
        type,
        amount: Number(amount),
        currency: "VND",
        fund_id: Number(fundId),
        category_id: categoryId ? Number(categoryId) : null,
        description,
        recipient_name: recipientName,
        bank_name: bankName,
        transaction_code: transactionCode,
        transaction_date: transactionDate + "T00:00:00",
        slip_image_url: slipUrl,
        status: "pending",
        created_by: profile.id,
        notes,
      });

      if (insertErr) throw insertErr;

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", fontSize: 15,
    border: `1px solid ${T.border}`, borderRadius: 10,
    outline: "none", backgroundColor: T.bg,
    fontFamily: T.font, color: T.text, boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.1em",
    color: T.textLabel, marginBottom: 6,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backgroundColor: T.bg, fontFamily: T.font,
      maxWidth: 430, margin: "0 auto",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ ...flexBetween, padding: "28px 24px 16px", position: "sticky", top: 0, backgroundColor: T.bg, zIndex: 10 }}>
        <button onClick={onClose} style={{ ...flexCenter, gap: 8, border: "none", backgroundColor: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 15, fontWeight: 600, color: T.text }}>
          <ChevronLeft size={20} color={T.text} /> Quay lại
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Giao dịch mới</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ padding: "0 24px 120px" }}>
        {/* Type Toggle */}
        <div style={{ display: "flex", height: 44, backgroundColor: T.primaryBg, borderRadius: 12, padding: 4, border: `1px solid ${T.primaryBg2}`, marginBottom: 24 }}>
          {[{ id: "expense", label: "Chi" }, { id: "income", label: "Thu" }].map((t) => (
            <button key={t.id} onClick={() => setType(t.id)} style={{
              flex: 1, borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600, fontFamily: T.font,
              backgroundColor: type === t.id ? (t.id === "expense" ? T.danger : T.green) : "transparent",
              color: type === t.id ? T.white : T.textSec,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Upload Bank Slip */}
        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Ảnh bank slip (chứng từ)</div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: "none" }} />
          {slipPreview ? (
            <div style={{ position: "relative" }}>
              <img src={slipPreview} alt="Bank slip" style={{ width: "100%", borderRadius: 12, border: `1px solid ${T.border}` }} />
              <button onClick={() => { setSlipImage(null); setSlipPreview(null); }} style={{
                position: "absolute", top: 8, right: 8, width: 28, height: 28,
                borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", border: "none",
                color: "white", fontSize: 16, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{
              ...card, width: "100%", padding: 24, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              border: `2px dashed ${T.border}`, backgroundColor: T.bg,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: T.primaryBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CameraIcon size={24} color={T.primary} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec }}>Chụp hoặc tải ảnh bank slip</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>Hệ thống sẽ tự động đọc thông tin</span>
            </button>
          )}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Số tiền (VND) *</div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1,970,000" style={{ ...inputStyle, fontSize: 20, fontWeight: 700 }} />
          {amount && <div style={{ fontSize: 12, color: T.primary, marginTop: 4, fontWeight: 600 }}>{fmtVND(amount)}</div>}
        </div>

        {/* Fund */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Quỹ *</div>
          <select value={fundId} onChange={(e) => setFundId(e.target.value)} style={inputStyle}>
            <option value="">-- Chọn quỹ --</option>
            {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Category */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Danh mục</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {categories.slice(0, 12).map((cat) => {
              const Ic = getIcon(cat.icon_name);
              const active = categoryId === String(cat.id);
              return (
                <button key={cat.id} onClick={() => setCategoryId(active ? "" : String(cat.id))} style={{
                  padding: "10px 8px", borderRadius: 10,
                  border: active ? "none" : `1px solid ${T.border}`,
                  backgroundColor: active ? T.primary : T.card,
                  color: active ? T.white : T.textSec,
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4, fontFamily: T.font,
                }}>
                  <Ic size={18} color={active ? "white" : cat.color} />
                  <span style={{ fontSize: 9, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{cat.name_vi}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Nội dung chuyển khoản</div>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="VD: 1 thung man" style={inputStyle} />
        </div>

        {/* Recipient */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Người nhận</div>
          <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="VD: CONG TY TNHH TRAI CAY DAI PHUC" style={inputStyle} />
        </div>

        {/* Date */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Ngày giao dịch</div>
          <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} style={inputStyle} />
        </div>

        {/* Bank info row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={labelStyle}>Ngân hàng</div>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Techcombank" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Mã giao dịch</div>
            <input type="text" value={transactionCode} onChange={(e) => setTransactionCode(e.target.value)} placeholder="FT260709..." style={inputStyle} />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Ghi chú</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú thêm..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", backgroundColor: T.dangerBg, borderRadius: 8, fontSize: 13, color: T.danger, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={saving} style={{
          width: "100%", padding: "16px 0",
          backgroundColor: saving ? T.textMuted : (type === "expense" ? T.danger : T.green),
          color: T.white, border: "none", borderRadius: 12,
          fontSize: 16, fontWeight: 700, cursor: saving ? "wait" : "pointer",
          fontFamily: T.font,
          boxShadow: `0 4px 12px ${type === "expense" ? T.danger : T.green}33`,
        }}>
          {saving ? "Đang lưu..." : (type === "expense" ? "Lưu khoản chi" : "Lưu khoản thu")}
        </button>
      </div>
    </div>
  );
}

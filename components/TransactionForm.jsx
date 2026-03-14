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
  const supportingFileRef = useRef(null);
  const supportingFileRef = useRef(null);

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
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
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

  // Convert file to base64
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSupportingSelect = async (e) => {
    const remaining = Math.max(0, 10 - supportingImages.length);
    const files = Array.from(e.target.files || []).slice(0, remaining);
    if (!files.length) return;

    const compressed = [];
    for (const f of files) compressed.push(await compressImageIfNeeded(f));

    setSupportingImages((prev) => [...prev, ...compressed].slice(0, 10));
    setSupportingPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))].slice(0, 10));
  };

  const removeSupportingImage = (index) => {
    setSupportingImages((prev) => prev.filter((_, i) => i !== index));
    setSupportingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const compressImageIfNeeded = async (file) => {
    const MAX_BYTES = 1024 * 1024; // 1MB
    const MAX_DIMENSION = 1600;
    const JPEG_QUALITY = 0.82;

    if (!file || file.size <= MAX_BYTES || !file.type.startsWith("image/")) {
      return file;
    }

    const imageUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = imageUrl;
      });

      let { width, height } = img;
      const largest = Math.max(width, height);
      if (largest > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / largest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      if (!blob) return file;

      const baseName = file.name.replace(/\.[^.]+$/, "");
      const compressed = new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      return compressed.size < file.size ? compressed : file;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  // Category name → id mapping
  const CATEGORY_MAP = {
    food: "Thực phẩm",
    utilities: "Tiện ích",
    household: "Vật dụng",
    delivery: "Đồ ăn gọi",
    transport: "Đi lại",
    entertainment: "Giải trí",
    salary: "Lương",
    pr: "PR",
    maintenance: "Sửa chữa",
    travel: "Du lịch",
    kitchen: "Chi bếp",
    subscription: "Đăng ký",
    other: "Khác",
  };

  const handleImageSelect = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    const file = await compressImageIfNeeded(rawFile);
    setSlipImage(file);
    setSlipPreview(URL.createObjectURL(file));

    // Auto-trigger OCR
    setScanning(true);
    setError("");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          imageMimeType: file.type || "image/jpeg",
        }),
      });

      const result = await res.json();

      if (result.success && result.data) {
        const d = result.data;
        setOcrResult(d);

        // Auto-fill fields
        if (d.amount) setAmount(String(d.amount));
        if (d.recipient_name) setRecipientName(d.recipient_name);
        if (d.description) setDescription(d.description);
        if (d.bank_name) setBankName(d.bank_name);
        if (d.transaction_code) setTransactionCode(d.transaction_code);
        if (d.transaction_date) {
          // Try to parse ISO date
          const parsed = d.transaction_date.match(/\d{4}-\d{2}-\d{2}/);
          if (parsed) setTransactionDate(parsed[0]);
        }

        // Auto-select category from OCR suggestion
        if (d.suggested_category && categories.length > 0) {
          const catName = CATEGORY_MAP[d.suggested_category];
          if (catName) {
            const match = categories.find(
              (c) => c.name_vi.includes(catName) || c.name.toLowerCase().includes(d.suggested_category)
            );
            if (match) setCategoryId(String(match.id));
          }
        }
      } else {
        console.warn("OCR returned no data:", result);
      }
    } catch (err) {
      console.error("OCR error:", err);
      // Non-blocking — user can still fill manually
    } finally {
      setScanning(false);
    }
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
    <>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backgroundColor: T.bg, fontFamily: T.font,
      maxWidth: 430, margin: "0 auto",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ ...flexBetween, padding: "28px 24px 16px", position: "sticky", top: 0, backgroundColor: T.bg, zIndex: 10 }}>
        <button onClick={onClose} style={{ ...flexCenter, gap: 8, border: "none", backgroundColor: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 15, fontWeight: 600, color: T.text }}>
          <ChevronLeft size={20} color={T.text} /> Back
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>New transaction</span>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ padding: "0 24px 120px" }}>
        {/* Type Toggle */}
        <div style={{ display: "flex", height: 44, backgroundColor: T.primaryBg, borderRadius: 12, padding: 4, border: `1px solid ${T.primaryBg2}`, marginBottom: 24 }}>
          {[{ id: "expense", label: "Out" }, { id: "income", label: "In" }].map((t) => (
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
          <div style={labelStyle}>Receipt image</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
          {slipPreview ? (
            <div style={{ position: "relative" }}>
              <img src={slipPreview} alt="Bank slip" style={{ width: "100%", borderRadius: 12, border: `1px solid ${T.border}` }} />
              {scanning && (
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 12,
                  backgroundColor: "rgba(0,0,0,0.6)", display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
                }}>
                  <div style={{
                    width: 40, height: 40, border: "3px solid rgba(255,255,255,0.3)",
                    borderTopColor: T.primary, borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <span style={{ color: "white", fontSize: 13, fontWeight: 600 }}>Preparing image...</span>
                </div>
              )}
              {ocrResult && !scanning && (
                <div style={{
                  position: "absolute", bottom: 8, left: 8, right: 8,
                  backgroundColor: "rgba(86,201,29,0.9)", borderRadius: 8,
                  padding: "6px 12px", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 14 }}>✓</span>
                  <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>Đã quét thành công — kiểm tra thông tin bên dưới</span>
                </div>
              )}
              <button onClick={() => { setSlipImage(null); setSlipPreview(null); setOcrResult(null); }} style={{
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
    </>
  );
}

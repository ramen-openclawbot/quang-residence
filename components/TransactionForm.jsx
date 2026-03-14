"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

const T = {
  bg: "#f6f8f6",
  card: "#ffffff",
  text: "#1a2e1a",
  textMuted: "#7c8b7a",
  border: "#e6ede4",
  primary: "#56c91d",
  success: "#16a34a",
  successSoft: "#ecfdf3",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  shadow: "0 8px 30px rgba(16,24,16,0.04)",
  font: "Inter, system-ui, sans-serif",
};

export default function TransactionForm({ onClose, onSuccess }) {
  const { profile } = useAuth();
  const fileRef = useRef(null);
  const supportingFileRef = useRef(null);

  const [type, setType] = useState("expense");
  const [form, setForm] = useState({
    amount: "",
    description: "",
    recipient_name: "",
    bank_name: "",
    bank_account: "",
    transaction_code: "",
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: "",
    fund_id: "",
  });

  const [funds, setFunds] = useState([]);
  const [slipImage, setSlipImage] = useState(null);
  const [supportingImages, setSupportingImages] = useState([]);
  const [supportingPreviews, setSupportingPreviews] = useState([]);
  const [proofLinksText, setProofLinksText] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [ocrData, setOcrData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let mounted = true;
    async function loadFunds() {
      const { data, error } = await supabase.from("funds").select("id, name, fund_type").order("id");
      if (error) {
        console.error("Load funds error:", error);
        return;
      }
      if (!mounted) return;
      setFunds(data || []);
    }
    loadFunds();
    return () => {
      mounted = false;
    };
  }, []);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const compressImageIfNeeded = async (file) => {
    const MAX_BYTES = 1024 * 1024;
    const MAX_DIMENSION = 1600;
    const JPEG_QUALITY = 0.82;

    if (!file || file.size <= MAX_BYTES || !file.type.startsWith("image/")) return file;

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

  const parseReceipt = async (file) => {
    try {
      setScanning(true);
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, imageMimeType: file.type || "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");

      const parsed = data.data || data.parsed || {};
      setOcrData(parsed);
      setForm((prev) => ({
        ...prev,
        amount: parsed.amount ? String(parsed.amount) : prev.amount,
        recipient_name: parsed.recipient_name || prev.recipient_name,
        bank_name: parsed.bank_name || prev.bank_name,
        bank_account: parsed.bank_account || prev.bank_account,
        transaction_code: parsed.transaction_code || prev.transaction_code,
        transaction_date: parsed.transaction_date || prev.transaction_date,
      }));
    } catch (err) {
      console.error("OCR parse failed:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleImageSelect = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    const file = await compressImageIfNeeded(rawFile);
    setSlipImage(file);
    await parseReceipt(file);
  };

  const handleSupportingSelect = async (e) => {
    const remaining = Math.max(0, 10 - supportingImages.length);
    const files = Array.from(e.target.files || []).slice(0, remaining);
    if (!files.length) return;
    const compressed = [];
    for (const file of files) compressed.push(await compressImageIfNeeded(file));
    setSupportingImages((prev) => [...prev, ...compressed].slice(0, 10));
    setSupportingPreviews((prev) => [...prev, ...compressed.map((f) => URL.createObjectURL(f))].slice(0, 10));
  };

  const removeSupportingImage = (index) => {
    setSupportingImages((prev) => prev.filter((_, i) => i !== index));
    setSupportingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearSlipImage = () => {
    setSlipImage(null);
    setOcrData(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadFileToStorage = async (file, prefix = "proof") => {
    if (!file || !profile?.id) return null;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${profile.id}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("bank-slips").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("bank-slips").getPublicUrl(path);
    return data.publicUrl;
  };

  const onSubmit = async () => {
    setSaving(true);
    try {
      const slipUrl = await uploadFileToStorage(slipImage, "slip");
      const supportingProofUrls = [];
      for (const img of supportingImages) {
        const url = await uploadFileToStorage(img, "support");
        if (url) supportingProofUrls.push(url);
      }
      const proofLinks = proofLinksText
        .split(/\n|,/) 
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);

      const payload = {
        type,
        amount: Number(form.amount || 0),
        fund_id: form.fund_id ? Number(form.fund_id) : null,
        description: form.description || null,
        recipient_name: form.recipient_name || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
        transaction_code: form.transaction_code || null,
        transaction_date: form.transaction_date ? new Date(form.transaction_date).toISOString() : null,
        notes: form.notes || null,
        created_by: profile.id,
        slip_image_url: slipUrl,
        status: "pending",
        source: "app",
        ocr_raw_data: {
          ...(ocrData || {}),
          supporting_proof_urls: supportingProofUrls,
          proof_links: proofLinks,
          proof_note: proofNote || null,
        },
      };

      const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("id").single();
      if (error) throw error;

      // Notify reviewers after submit
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && inserted?.id) {
          const notifyRes = await fetch("/api/transactions/notify-submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ transaction_id: inserted.id, amount: payload.amount, type: payload.type, description: payload.description }),
          });
          if (!notifyRes.ok) {
            const notifyErr = await notifyRes.text();
            console.warn("notify-submit failed:", notifyErr);
          }
        }
      } catch (notifyError) {
        console.warn("notify-submit error:", notifyError);
      }

      setForm({
        amount: "",
        description: "",
        recipient_name: "",
        bank_name: "",
        bank_account: "",
        transaction_code: "",
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: "",
        fund_id: "",
      });
      setSlipImage(null);
      setSupportingImages([]);
      setSupportingPreviews([]);
      setProofLinksText("");
      setProofNote("");
      setOcrData(null);
      onSuccess?.();
    } catch (err) {
      console.error("Create transaction failed:", err);
      alert(err.message || "Failed to create transaction");
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = [
    {
      id: "expense",
      label: "Out",
      tone: T.danger,
      soft: T.dangerSoft,
      border: "rgba(220, 38, 38, 0.18)",
    },
    {
      id: "income",
      label: "In",
      tone: T.success,
      soft: T.successSoft,
      border: "rgba(22, 163, 74, 0.18)",
    },
  ];

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={topBarStyle}>
          <button onClick={onClose} style={backBtnStyle}>
            <ChevronLeft size={20} color={T.text} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>New transaction</span>
          <div style={{ width: 48 }} />
        </div>

        <div style={bodyStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {typeOptions.map((item) => {
              const active = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  style={{
                    ...segBtnStyle,
                    background: active ? item.tone : item.soft,
                    border: `1px solid ${active ? item.tone : item.border}`,
                    color: active ? "white" : item.tone,
                    boxShadow: active ? `0 8px 20px ${item.id === "expense" ? "rgba(220,38,38,0.22)" : "rgba(22,163,74,0.22)"}` : "none",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={labelStyle}>Bank slip</div>
                <div style={helperTextStyle}>Giữ kiểu compact như form cũ: chọn slip, không hiển thị full ảnh trên mobile.</div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
            {!slipImage ? (
              <button type="button" onClick={() => fileRef.current?.click()} style={uploadBoxStyle}>
                <UploadCloud size={20} color={T.primary} />
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Upload bank slip</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>UNC / transfer receipt</div>
              </button>
            ) : (
              <div style={compactUploadCardStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={compactUploadIconStyle}>
                    <CheckCircle2 size={20} color={T.primary} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{slipImage.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                      Bank slip uploaded. Kéo xuống để upload proof.
                    </div>
                    {ocrData && (
                      <div style={infoPillStyle}>OCR auto-filled available</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={secondaryActionBtnStyle}>Change</button>
                  <button type="button" onClick={clearSlipImage} style={ghostDangerBtnStyle}>Remove</button>
                </div>
              </div>
            )}
            {scanning && (
              <div style={{ marginTop: 10, ...rowStyle, gap: 8 }}>
                <Loader2 size={16} color={T.primary} className="spin" />
                <span style={{ color: T.textMuted, fontSize: 13 }}>Preparing image...</span>
              </div>
            )}
          </div>

          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={labelStyle}>Supporting proof</div>
                <div style={helperTextStyle}>Sau khi upload bank slip, user chỉ cần kéo xuống đây để thêm proof.</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Up to 10 extra images: invoice, received item, chat proof, or related evidence.</div>
            <input ref={supportingFileRef} type="file" accept="image/*" multiple onChange={handleSupportingSelect} style={{ display: "none" }} />
            <button type="button" onClick={() => supportingFileRef.current?.click()} style={uploadBoxStyle}>
              <ImagePlus size={20} color={T.primary} />
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Add supporting images</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{supportingImages.length}/10 selected</div>
            </button>
            {supportingPreviews.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                {supportingPreviews.map((src, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <img src={src} alt={`Proof ${index + 1}`} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` }} />
                    <button type="button" onClick={() => removeSupportingImage(index)} style={removeProofBtnStyle}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Amount</div>
            <input value={form.amount} onChange={(e) => updateField("amount", e.target.value)} inputMode="numeric" placeholder="0" style={inputStyle} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Fund</div>
            <select value={form.fund_id} onChange={(e) => updateField("fund_id", e.target.value)} style={selectStyle}>
              <option value="">Select fund</option>
              {funds.map((fund) => (
                <option key={fund.id} value={fund.id}>{fund.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
              Approved transactions will update this fund balance.
            </div>
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Description</div>
            <input value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="What is this for?" style={inputStyle} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Recipient</div>
            <input value={form.recipient_name} onChange={(e) => updateField("recipient_name", e.target.value)} placeholder="Recipient name" style={inputStyle} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Bank</div>
            <input value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} placeholder="Bank name" style={inputStyle} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Account number</div>
            <input value={form.bank_account} onChange={(e) => updateField("bank_account", e.target.value)} placeholder="Bank account" style={inputStyle} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Transaction code</div>
            <input value={form.transaction_code} onChange={(e) => updateField("transaction_code", e.target.value)} placeholder="Reference code" style={inputStyle} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Date</div>
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => updateField("transaction_date", e.target.value)}
              style={dateInputStyle}
            />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Drive / proof links</div>
            <textarea value={proofLinksText} onChange={(e) => setProofLinksText(e.target.value)} placeholder="Paste Google Drive or other proof links, one per line" style={{ ...inputStyle, minHeight: 88, resize: "vertical", paddingTop: 12, paddingBottom: 12 }} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Proof note</div>
            <textarea value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="Explain why the transfer is valid and what the supporting proof shows" style={{ ...inputStyle, minHeight: 88, resize: "vertical", paddingTop: 12, paddingBottom: 12 }} />
          </div>

          <div style={sectionCardStyle}>
            <div style={labelStyle}>Extra note</div>
            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Internal note" style={{ ...inputStyle, minHeight: 88, resize: "vertical", paddingTop: 12, paddingBottom: 12 }} />
          </div>
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={onSubmit} disabled={saving || !form.amount} style={{ ...submitBtnStyle, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const rowStyle = { display: "flex", alignItems: "center" };

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(8, 15, 8, 0.32)",
  zIndex: 200,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  fontFamily: T.font,
};

const sheetStyle = {
  width: "100%",
  maxWidth: 430,
  background: T.bg,
  borderRadius: "24px 24px 0 0",
  maxHeight: "92vh",
  overflow: "hidden",
  boxShadow: T.shadow,
};

const topBarStyle = {
  ...rowStyle,
  justifyContent: "space-between",
  padding: "16px 18px 14px",
  background: T.card,
  borderBottom: `1px solid ${T.border}`,
};

const backBtnStyle = {
  ...rowStyle,
  gap: 8,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: T.text,
  fontSize: 15,
  fontWeight: 600,
  fontFamily: T.font,
};

const bodyStyle = {
  padding: 18,
  display: "grid",
  gap: 14,
  overflowY: "auto",
  maxHeight: "calc(92vh - 132px)",
};

const sectionCardStyle = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  padding: 16,
  boxShadow: T.shadow,
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 10,
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: T.textMuted,
  marginBottom: 6,
};

const helperTextStyle = {
  fontSize: 12,
  color: T.textMuted,
  lineHeight: 1.45,
};

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
  color: T.text,
  boxSizing: "border-box",
  fontFamily: T.font,
};

const dateInputStyle = {
  ...inputStyle,
  display: "block",
  WebkitAppearance: "none",
  appearance: "none",
  paddingRight: 14,
};

const selectStyle = {
  ...inputStyle,
  appearance: "none",
  WebkitAppearance: "none",
  lineHeight: "normal",
};

const segBtnStyle = {
  height: 46,
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 800,
  fontFamily: T.font,
};

const uploadBoxStyle = {
  width: "100%",
  minHeight: 100,
  border: `1px dashed ${T.primary}`,
  borderRadius: 16,
  background: "#f9fff6",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontFamily: T.font,
};

const compactUploadCardStyle = {
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  background: "#fbfdf9",
  padding: 14,
};

const compactUploadIconStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "#eef8e8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const infoPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef8e8",
  color: T.primary,
  fontSize: 11,
  fontWeight: 700,
  marginTop: 8,
};

const secondaryActionBtnStyle = {
  height: 36,
  padding: "0 14px",
  borderRadius: 12,
  border: `1px solid ${T.border}`,
  background: T.card,
  color: T.text,
  cursor: "pointer",
  fontWeight: 700,
  fontFamily: T.font,
};

const ghostDangerBtnStyle = {
  ...secondaryActionBtnStyle,
  color: T.danger,
  border: `1px solid rgba(220, 38, 38, 0.18)`,
  background: T.dangerSoft,
};

const removeProofBtnStyle = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "none",
  background: "rgba(0,0,0,0.65)",
  color: "white",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const footerStyle = {
  padding: 14,
  background: T.card,
  borderTop: `1px solid ${T.border}`,
};

const submitBtnStyle = {
  width: "100%",
  height: 48,
  border: "none",
  borderRadius: 14,
  background: T.primary,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
  fontFamily: T.font,
};

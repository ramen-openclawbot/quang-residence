"use client";

import { useEffect, useRef, useState } from "react";
import { MIcon } from "./shared/StaffShell";
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
  font: "'Manrope', 'Inter', -apple-system, sans-serif",
};

export default function TransactionForm({ onClose, onSuccess }) {
  const { profile, getToken } = useAuth();
  const fileRef = useRef(null);

  // Form state
  const [type, setType] = useState("expense");
  const [adjustmentDirection, setAdjustmentDirection] = useState("increase");
  const [step, setStep] = useState("upload"); // "upload" | "scanning" | "review"
  const [funds, setFunds] = useState([]);

  // Step 1: Upload
  const [slipFiles, setSlipFiles] = useState([]);
  const [slipPreviews, setSlipPreviews] = useState([]);

  // Step 2: Scanning
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, phase: "compressing" });
  const [compressedFiles, setCompressedFiles] = useState([]);

  // Step 3: Review
  const [scanResults, setScanResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState("");

  // Load funds
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

  // ==================== HELPERS ====================
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const compressImageIfNeeded = async (file, options = {}) => {
    const { forceJpeg = false } = options;
    const MAX_BYTES = 1024 * 1024;
    const MAX_DIMENSION = 1600;
    const JPEG_QUALITY = 0.82;

    if (!file || !file.type.startsWith("image/")) return file;

    const mime = (file.type || "").toLowerCase();
    const shouldConvertForOCR = forceJpeg || !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime);
    const shouldProcess = shouldConvertForOCR || file.size > MAX_BYTES;
    if (!shouldProcess) return file;

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
      const normalized = new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      if (shouldConvertForOCR) return normalized;
      return normalized.size < file.size ? normalized : file;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const uploadFileToStorage = async (file, prefix = "slip") => {
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

  // ==================== STEP 1: FILE SELECTION ====================
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Max 5 slips
    const remaining = Math.max(0, 5 - slipFiles.length);
    const toAdd = files.slice(0, remaining);
    if (!toAdd.length) return;

    // Compress each file
    const compressed = [];
    for (const file of toAdd) {
      const c = await compressImageIfNeeded(file, { forceJpeg: true });
      compressed.push(c);
    }

    // Create previews
    const newPreviews = compressed.map((f) => URL.createObjectURL(f));
    setSlipFiles((prev) => [...prev, ...compressed]);
    setSlipPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeSlipFile = (index) => {
    setSlipFiles((prev) => prev.filter((_, i) => i !== index));
    setSlipPreviews((prev) => {
      // Revoke the removed URL only
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ==================== STEP 2: SCANNING ====================
  const handleScanSlips = async () => {
    if (slipFiles.length === 0) return;
    setStep("scanning");
    setScanProgress({ current: 0, total: slipFiles.length, phase: "compressing" });

    try {
      // Step 1: Compress all files
      setScanProgress((p) => ({ ...p, phase: "compressing" }));
      const compressed = [];
      for (let i = 0; i < slipFiles.length; i++) {
        const file = slipFiles[i];
        const c = await compressImageIfNeeded(file, { forceJpeg: true });
        compressed.push(c);
      }
      setCompressedFiles(compressed);

      // Step 2: Scan all in parallel
      setScanProgress((p) => ({ ...p, phase: "scanning" }));
      const token = await getToken();
      const scanPromises = compressed.map((file, idx) =>
        scanImage(file, token, idx)
      );

      const results = await Promise.allSettled(scanPromises);

      // Step 3: Collect results
      const collected = [];
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          const { ocrData, templateMatched, bankIdentifier } = result.value;
          collected.push({
            file: compressed[idx],
            preview: slipPreviews[idx],
            ocrData: ocrData || null,
            ocrError: null,
            form: {
              amount: ocrData?.amount ? String(ocrData.amount) : "",
              description: ocrData?.description || "",
              recipient_name: ocrData?.recipient_name || "",
              bank_name: ocrData?.bank_name || "",
              bank_account: ocrData?.bank_account || "",
              transaction_code: ocrData?.transaction_code || "",
              transaction_date: ocrData?.transaction_date || new Date().toISOString().slice(0, 10),
              notes: "",
              fund_id: selectedFundId || "",
            },
            supportingImages: [],
            supportingPreviews: [],
            templateMatched: templateMatched || false,
            bankIdentifier: bankIdentifier || "",
          });
        } else {
          // OCR failed
          collected.push({
            file: compressed[idx],
            preview: slipPreviews[idx],
            ocrData: null,
            ocrError: result.reason?.message || "Failed to scan",
            form: {
              amount: "",
              description: "",
              recipient_name: "",
              bank_name: "",
              bank_account: "",
              transaction_code: "",
              transaction_date: new Date().toISOString().slice(0, 10),
              notes: "",
              fund_id: selectedFundId || "",
            },
            supportingImages: [],
            supportingPreviews: [],
            templateMatched: false,
            bankIdentifier: "",
          });
        }
      });

      setScanResults(collected);
      setStep("review");
    } catch (err) {
      console.error("Scan failed:", err);
      alert("Scanning failed: " + (err.message || "Unknown error"));
      setStep("upload");
    }
  };

  const scanImage = async (file, token, index) => {
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageBase64, imageMimeType: file.type || "image/jpeg" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");

      const parsed = data.data || {};
      return {
        ocrData: parsed,
        templateMatched: data.templateMatched || false,
        bankIdentifier: data.bankIdentifier || "",
      };
    } catch (err) {
      throw err;
    } finally {
      setScanProgress((p) => ({ ...p, current: p.current + 1 }));
    }
  };

  // ==================== STEP 3: REVIEW ====================
  const updateResultForm = (index, key, value) => {
    setScanResults((prev) => {
      const updated = [...prev];
      updated[index].form[key] = value;
      return updated;
    });
  };

  const handleSupportingSelect = async (resultIndex, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = Math.max(0, 10 - scanResults[resultIndex].supportingImages.length);
    const toAdd = files.slice(0, remaining);
    if (!toAdd.length) return;

    const compressed = [];
    for (const file of toAdd) {
      const c = await compressImageIfNeeded(file);
      compressed.push(c);
    }

    const newPreviews = compressed.map((f) => URL.createObjectURL(f));

    setScanResults((prev) => {
      const updated = [...prev];
      updated[resultIndex].supportingImages = [...updated[resultIndex].supportingImages, ...compressed].slice(0, 10);
      updated[resultIndex].supportingPreviews = [...updated[resultIndex].supportingPreviews, ...newPreviews].slice(0, 10);
      return updated;
    });
  };

  const removeSupportingImage = (resultIndex, imageIndex) => {
    setScanResults((prev) => {
      const updated = [...prev];
      updated[resultIndex].supportingImages = updated[resultIndex].supportingImages.filter((_, i) => i !== imageIndex);
      updated[resultIndex].supportingPreviews = updated[resultIndex].supportingPreviews.filter((_, i) => i !== imageIndex);
      return updated;
    });
  };

  const removeResult = (index) => {
    setScanResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (scanResults.length === 0 || !scanResults.some((r) => r.form.amount)) {
      alert("Please fill in at least one amount");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const createdTransactions = [];

      for (const result of scanResults) {
        if (!result.form.amount) continue; // Skip empty ones

        // Upload supporting images
        const supportingProofUrls = [];
        for (const img of result.supportingImages) {
          const url = await uploadFileToStorage(img, "support");
          if (url) supportingProofUrls.push(url);
        }

        // Upload main slip image
        const slipUrl = await uploadFileToStorage(result.file, "slip");

        const payload = {
          type,
          amount: Number(result.form.amount || 0),
          fund_id: result.form.fund_id ? Number(result.form.fund_id) : null,
          description: result.form.description || null,
          recipient_name: result.form.recipient_name || null,
          bank_name: result.form.bank_name || null,
          bank_account: result.form.bank_account || null,
          transaction_code: result.form.transaction_code || null,
          transaction_date: result.form.transaction_date ? new Date(result.form.transaction_date).toISOString() : null,
          notes: result.form.notes || null,
          created_by: profile.id,
          slip_image_url: slipUrl,
          status: "pending",
          source: "app",
          ocr_raw_data: {
            ...(result.ocrData || {}),
            supporting_proof_urls: supportingProofUrls,
            template_matched: result.templateMatched,
            bank_identifier: result.bankIdentifier,
          },
        };

        const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("id").single();
        if (error) throw error;
        createdTransactions.push(inserted);

        // Notify reviewers
        try {
          if (token && inserted?.id) {
            await fetch("/api/transactions/notify-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                transaction_id: inserted.id,
                amount: payload.amount,
                type: payload.type,
                description: payload.description,
              }),
            });
          }
        } catch (notifyError) {
          console.warn("notify-submit error:", notifyError);
        }
      }

      // Reset state
      setSlipFiles([]);
      setSlipPreviews([]);
      setScanResults([]);
      setCompressedFiles([]);
      setSelectedFundId("");
      setStep("upload");
      onSuccess?.();
    } catch (err) {
      console.error("Submit failed:", err);
      alert(err.message || "Failed to create transactions");
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== TYPE OPTIONS ====================
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
    {
      id: "adjustment",
      label: "Adjust",
      tone: "#2563eb",
      soft: "#eff6ff",
      border: "rgba(37, 99, 235, 0.18)",
    },
  ];

  // ==================== RENDER ====================
  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={topBarStyle}>
          <button onClick={onClose} style={backBtnStyle}>
            <MIcon name="chevron_left" size={20} color={T.text} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
            {step === "upload" && "New transaction"}
            {step === "scanning" && "Scanning slips..."}
            {step === "review" && "Review & submit"}
          </span>
          <div style={{ width: 48 }} />
        </div>

        <div style={bodyStyle}>
          {/* Type toggle - always visible */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {typeOptions.map((item) => {
              const active = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  disabled={step !== "upload"}
                  style={{
                    ...segBtnStyle,
                    background: active ? item.tone : item.soft,
                    border: `1px solid ${active ? item.tone : item.border}`,
                    color: active ? "white" : item.tone,
                    boxShadow: active ? `0 8px 20px ${item.id === "expense" ? "rgba(220,38,38,0.22)" : "rgba(22,163,74,0.22)"}` : "none",
                    opacity: step !== "upload" ? 0.6 : 1,
                    cursor: step !== "upload" ? "not-allowed" : "pointer",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <>
              <div style={sectionCardStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <div style={labelStyle}>Bank slips</div>
                    <div style={helperTextStyle}>Select 1-5 images at once</div>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
                {slipFiles.length === 0 ? (
                  <button type="button" onClick={() => fileRef.current?.click()} style={uploadBoxStyle}>
                    <MIcon name="cloud_upload" size={24} color={T.primary} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Scan slips</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>UNC / transfer receipt</div>
                  </button>
                ) : (
                  <>
                    {/* Thumbnails scroll strip */}
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, marginBottom: 12 }}>
                      {slipPreviews.map((src, idx) => (
                        <div key={idx} style={{ position: "relative", flexShrink: 0 }}>
                          <img src={src} alt={`Slip ${idx + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` }} />
                          <button
                            type="button"
                            onClick={() => removeSlipFile(idx)}
                            style={{
                              position: "absolute",
                              top: -8,
                              right: -8,
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              border: "none",
                              background: T.danger,
                              color: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {slipFiles.length < 5 && (
                      <button type="button" onClick={() => fileRef.current?.click()} style={{ ...uploadBoxStyle, minHeight: 60, gap: 4 }}>
                        <MIcon name="add" size={20} color={T.primary} />
                        <div style={{ fontSize: 12, color: T.primary, fontWeight: 700 }}>Add more ({slipFiles.length}/5)</div>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Fund selector for all transactions */}
              <div style={sectionCardStyle}>
                <div style={labelStyle}>Fund (applies to all)</div>
                <select value={selectedFundId} onChange={(e) => setSelectedFundId(e.target.value)} style={selectStyle}>
                  <option value="">Select fund</option>
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>{fund.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                  Approved transactions will update this fund balance.
                </div>
              </div>

              {/* Scan button */}
              <button
                type="button"
                onClick={handleScanSlips}
                disabled={slipFiles.length === 0}
                style={{
                  ...submitBtnStyle,
                  opacity: slipFiles.length === 0 ? 0.5 : 1,
                  cursor: slipFiles.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {slipFiles.length === 0 ? "Select slips to scan" : `Scan ${slipFiles.length} slip${slipFiles.length > 1 ? "s" : ""}`}
              </button>
            </>
          )}

          {/* STEP 2: SCANNING */}
          {step === "scanning" && (
            <div style={scanningOverlayStyle}>
              <style>{`
                @keyframes scanPulse {
                  0%, 100% { opacity: 0.4; transform: scaleX(1); }
                  50% { opacity: 1; transform: scaleX(1.02); }
                }
                @keyframes scanLine {
                  0% { top: 0%; }
                  100% { top: 100%; }
                }
                @keyframes checkPop {
                  0% { transform: scale(0); opacity: 0; }
                  60% { transform: scale(1.2); }
                  100% { transform: scale(1); opacity: 1; }
                }
              `}</style>
              <div style={{ textAlign: "center" }}>
                {/* Animated scan container */}
                <div style={{ width: 120, height: 150, margin: "0 auto 24px", position: "relative", borderRadius: 12, border: `2px solid ${T.primary}`, overflow: "hidden", background: "#f9fff6" }}>
                  <div style={{ position: "absolute", width: "100%", height: 3, background: T.primary, top: "50%", animation: "scanLine 2s ease-in-out infinite" }} />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        width: "80%",
                        left: "10%",
                        height: 12,
                        background: T.primary,
                        opacity: 0.1,
                        top: `${(i + 1) * 35}%`,
                        borderRadius: 2,
                      }}
                    />
                  ))}
                </div>

                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  Scanning slips...
                </div>
                <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 16 }}>
                  {scanProgress.phase === "compressing" ? "Preparing images..." : `Scanning ${scanProgress.current}/${scanProgress.total}...`}
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 6, background: T.border, borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%`,
                      background: T.primary,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div style={{ fontSize: 12, color: T.textMuted }}>
                  {Math.round((scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0))}%
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === "review" && (
            <>
              {scanResults.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: T.textMuted }}>
                  <MIcon name="info" size={24} color={T.textMuted} style={{ marginBottom: 12 }} />
                  <div>No slips scanned</div>
                </div>
              ) : (
                scanResults.map((result, resultIdx) => (
                  <div key={resultIdx} style={sectionCardStyle}>
                    {/* Slip thumbnail */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      <img src={result.preview} alt={`Slip ${resultIdx + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                          Slip {resultIdx + 1}
                        </div>
                        {result.templateMatched && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.primary, background: "#eef8e8", padding: "4px 8px", borderRadius: 4, marginBottom: 4 }}>
                            <span>⚡</span> {result.bankIdentifier || "Template matched"}
                          </div>
                        )}
                        {result.ocrError && (
                          <div style={{ fontSize: 12, color: T.danger, lineHeight: 1.4 }}>
                            {result.ocrError}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeResult(resultIdx)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "none",
                          background: T.dangerSoft,
                          color: T.danger,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Form fields */}
                    <div style={{ display: "grid", gap: 10 }}>
                      {/* Amount */}
                      <div>
                        <div style={labelStyle}>Amount *</div>
                        <input
                          type="number"
                          value={result.form.amount}
                          onChange={(e) => updateResultForm(resultIdx, "amount", e.target.value)}
                          placeholder="0"
                          style={inputStyle}
                          required
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <div style={labelStyle}>Description</div>
                        <input
                          type="text"
                          value={result.form.description}
                          onChange={(e) => updateResultForm(resultIdx, "description", e.target.value)}
                          placeholder="What is this for?"
                          style={inputStyle}
                        />
                      </div>

                      {/* Recipient */}
                      <div>
                        <div style={labelStyle}>Recipient</div>
                        <input
                          type="text"
                          value={result.form.recipient_name}
                          onChange={(e) => updateResultForm(resultIdx, "recipient_name", e.target.value)}
                          placeholder="Recipient name"
                          style={inputStyle}
                        />
                      </div>

                      {/* Bank */}
                      <div>
                        <div style={labelStyle}>Bank</div>
                        <input
                          type="text"
                          value={result.form.bank_name}
                          onChange={(e) => updateResultForm(resultIdx, "bank_name", e.target.value)}
                          placeholder="Bank name"
                          style={inputStyle}
                        />
                      </div>

                      {/* Account */}
                      <div>
                        <div style={labelStyle}>Account number</div>
                        <input
                          type="text"
                          value={result.form.bank_account}
                          onChange={(e) => updateResultForm(resultIdx, "bank_account", e.target.value)}
                          placeholder="Bank account"
                          style={inputStyle}
                        />
                      </div>

                      {/* Transaction code */}
                      <div>
                        <div style={labelStyle}>Transaction code</div>
                        <input
                          type="text"
                          value={result.form.transaction_code}
                          onChange={(e) => updateResultForm(resultIdx, "transaction_code", e.target.value)}
                          placeholder="Reference code"
                          style={inputStyle}
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <div style={labelStyle}>Date</div>
                        <input
                          type="date"
                          value={result.form.transaction_date}
                          onChange={(e) => updateResultForm(resultIdx, "transaction_date", e.target.value)}
                          style={dateInputStyle}
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <div style={labelStyle}>Notes</div>
                        <textarea
                          value={result.form.notes}
                          onChange={(e) => updateResultForm(resultIdx, "notes", e.target.value)}
                          placeholder="Internal note"
                          style={{ ...inputStyle, minHeight: 70, resize: "vertical", paddingTop: 10, paddingBottom: 10, lineHeight: "normal" }}
                        />
                      </div>

                      {/* Supporting images */}
                      <div>
                        <div style={labelStyle}>Supporting images ({result.supportingImages.length}/10)</div>
                        <input
                          type="file"
                          id={`supporting-${resultIdx}`}
                          accept="image/*"
                          multiple
                          onChange={(e) => handleSupportingSelect(resultIdx, e)}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`supporting-${resultIdx}`).click()}
                          style={{ ...uploadBoxStyle, minHeight: 80, gap: 4 }}
                        >
                          <MIcon name="add_photo_alternate" size={20} color={T.primary} />
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Add supporting images</div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{result.supportingImages.length}/10 selected</div>
                        </button>

                        {result.supportingPreviews.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                            {result.supportingPreviews.map((src, imgIdx) => (
                              <div key={imgIdx} style={{ position: "relative" }}>
                                <img src={src} alt={`Support ${imgIdx + 1}`} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` }} />
                                <button
                                  type="button"
                                  onClick={() => removeSupportingImage(resultIdx, imgIdx)}
                                  style={removeProofBtnStyle}
                                >
                                  <MIcon name="close" size={14} color="white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Submit button */}
              {scanResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !scanResults.some((r) => r.form.amount)}
                  style={{
                    ...submitBtnStyle,
                    opacity: submitting || !scanResults.some((r) => r.form.amount) ? 0.5 : 1,
                    cursor: submitting || !scanResults.some((r) => r.form.amount) ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Creating..." : `Create ${scanResults.filter((r) => r.form.amount).length} transaction${scanResults.filter((r) => r.form.amount).length !== 1 ? "s" : ""}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== STYLES ====================
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
  position: "relative",
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

const scanningOverlayStyle = {
  position: "absolute",
  inset: 0,
  background: T.card,
  borderRadius: "24px 24px 0 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
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

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
  font: "'Be Vietnam Pro', 'Inter', -apple-system, sans-serif",
};

function normalizeTextKey(v = "") {
  return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function getCategoryIconName(category) {
  const code = String(category?.code || "").toUpperCase();
  if (code === "TIEN_CHO" || code === "CHI_BEP") return "shopping_basket";
  if (code === "DO_AN_GOI") return "ramen_dining";
  if (code === "DIEN_NUOC_GAS_NET" || code === "DANG_KY_DICH_VU") return "bolt";
  if (code === "DI_LAI") return "two_wheeler";
  if (code === "SUA_CHUA_BAO_TRI") return "build";
  if (code === "GIAI_TRI_QUA_TANG") return "celebration";
  if (code === "LUONG_NHAN_SU") return "badge";
  if (code === "DU_LICH") return "flight";
  return "label";
}

function suggestCategory({ description = "", recipient_name = "", bank_name = "" }, categories = [], learnedMap = {}) {
  const hay = `${description} ${recipient_name} ${bank_name}`.toLowerCase();
  if (!hay.trim() || !categories.length) return { id: "", source: "none", confidence: 0 };

  const descKey = normalizeTextKey(description);
  const recKey = normalizeTextKey(recipient_name);
  const learnedKey = `${descKey}|${recKey}`;

  const personalNameLike = /^[a-z\s]{8,}$/i.test((description || "").trim()) && !/\d/.test(description || "");
  const recipientPersonalLike = /^[a-z\s]{6,}$/i.test((recipient_name || "").trim()) && !/\d/.test(recipient_name || "");
  const looksPersonalTransfer = personalNameLike || recipientPersonalLike;

  const codeByKeyword = [
    { code: "TIEN_CHO", keys: ["cho", "rau", "thit", "ca", "trai cay", "coopmart", "winmart", "bach hoa"] },
    { code: "DO_AN_GOI", keys: ["grabfood", "shopeefood", "befood", "do an", "tra sua"] },
    { code: "DIEN_NUOC_GAS_NET", keys: ["dien", "nuoc", "internet", "wifi", "gas"] },
    { code: "DI_LAI", keys: ["xang", "taxi", "grab", "be", "xanh sm", "cau duong", "gui xe"] },
    { code: "CHI_BEP", keys: ["nguyen lieu", "gia vi", "bep"] },
  ];

  for (const rule of codeByKeyword) {
    if (rule.keys.some((k) => hay.includes(k))) {
      const hit = categories.find((c) => String(c.code || "").toUpperCase() === rule.code);
      if (hit) return { id: String(hit.id), source: "keyword", confidence: 0.9 };
    }
  }

  const fallbackOther = categories.find((c) => {
    const code = String(c.code || "").toUpperCase();
    const vi = String(c.name_vi || "").toLowerCase();
    const en = String(c.name || "").toLowerCase();
    return code === "KHAC" || vi === "khác" || vi === "khac" || en === "other";
  });

  if (looksPersonalTransfer && fallbackOther) return { id: String(fallbackOther.id), source: "personal_guard", confidence: 0.88 };
  if (learnedMap[learnedKey]) return { id: String(learnedMap[learnedKey]), source: "learned", confidence: 0.78 };
  if (fallbackOther) return { id: String(fallbackOther.id), source: "fallback_other", confidence: 0.6 };
  return { id: "", source: "none", confidence: 0 };
}

export default function TransactionForm({ onClose, onSuccess }) {
  const { profile, getToken } = useAuth();
  const fileRef = useRef(null);

  // Form state
  const [type, setType] = useState("expense");
  const [adjustmentDirection, setAdjustmentDirection] = useState("increase");
  const [step, setStep] = useState("upload"); // "upload" | "scanning" | "review"
  // Step 1: Upload
  const [slipFiles, setSlipFiles] = useState([]);
  const [slipPreviews, setSlipPreviews] = useState([]);

  // Step 2: Scanning
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, phase: "compressing" });
  const [compressedFiles, setCompressedFiles] = useState([]);

  // Step 3: Review
  const [scanResults, setScanResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [learnedCategoryMap, setLearnedCategoryMap] = useState({});
  const [categoryPicker, setCategoryPicker] = useState({ open: false, resultIdx: null, q: "" });
  const [recentCategoryIds, setRecentCategoryIds] = useState([]);
  const [retryingIdx, setRetryingIdx] = useState(null);
  const [pendingQueue, setPendingQueue] = useState([]);

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

      // Phase 3: on-device OCR pre-enhancement (light contrast + sharpen)
      const imageData = ctx.getImageData(0, 0, width, height);
      const d = imageData.data;
      const contrast = 1.12;
      const bias = -8;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.max(0, Math.min(255, contrast * d[i] + bias));
        d[i + 1] = Math.max(0, Math.min(255, contrast * d[i + 1] + bias));
        d[i + 2] = Math.max(0, Math.min(255, contrast * d[i + 2] + bias));
      }
      ctx.putImageData(imageData, 0, 0);

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

  useEffect(() => {
    let canceled = false;
    (async () => {
      const [{ data: cats }, { data: txs }] = await Promise.all([
        supabase
          .from("categories")
          .select("id, code, name, name_vi, color, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("transactions")
          .select("description, recipient_name, category_id, created_at")
          .not("category_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (!canceled) {
        setExpenseCategories(cats || []);
        const m = {};
        for (const t of txs || []) {
          const k = `${normalizeTextKey(t.description)}|${normalizeTextKey(t.recipient_name)}`;
          if (!m[k] && k !== "|") m[k] = t.category_id;
        }
        setLearnedCategoryMap(m);
      }
    })();
    try {
      const raw = localStorage.getItem("zenhome_recent_categories");
      setRecentCategoryIds(raw ? JSON.parse(raw) : []);
    } catch {
      setRecentCategoryIds([]);
    }
    try {
      const q = localStorage.getItem("zenhome_pending_slip_queue");
      setPendingQueue(q ? JSON.parse(q) : []);
    } catch {
      setPendingQueue([]);
    }
    return () => { canceled = true; };
  }, []);

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

      // Step 2: Scan sequentially with retry (more stable for 3-5 slips)
      setScanProgress((p) => ({ ...p, phase: "scanning" }));
      const token = await getToken();
      if (!token) {
        alert("Session expired. Please log in again.");
        setScanProgress((p) => ({ ...(p || {}), phase: "scanning", current: 0, total: slipFiles.length }));
        return;
      }

      const collected = [];
      for (let idx = 0; idx < compressed.length; idx++) {
        const file = compressed[idx];
        try {
          const { ocrData, templateMatched, bankIdentifier } = await scanImage(file, token, idx);
          const suggestion = suggestCategory({
            description: ocrData?.description || "",
            recipient_name: ocrData?.recipient_name || "",
            bank_name: ocrData?.bank_name || "",
          }, expenseCategories, learnedCategoryMap);

          collected.push({
            file: compressed[idx],
            preview: slipPreviews[idx],
            ocrData: ocrData || null,
            ocrError: null,
            form: {
              amount: ocrData?.amount ? String(ocrData.amount) : "",
              category_id: suggestion.id || "",
              description: ocrData?.description || "",
              recipient_name: ocrData?.recipient_name || "",
              bank_name: ocrData?.bank_name || "",
              bank_account: ocrData?.bank_account || "",
              transaction_code: ocrData?.transaction_code || "",
              transaction_date: ocrData?.transaction_date || "",
              notes: "",
              fund_id: "",
            },
            supportingImages: [],
            supportingPreviews: [],
            templateMatched: templateMatched || false,
            bankIdentifier: bankIdentifier || "",
          });
        } catch (err) {
          collected.push({
            file: compressed[idx],
            preview: slipPreviews[idx],
            ocrData: null,
            ocrError: err?.message || "Load failed",
            form: {
              amount: "",
              category_id: "",
              description: "",
              recipient_name: "",
              bank_name: "",
              bank_account: "",
              transaction_code: "",
              transaction_date: "",
              notes: "",
              fund_id: "",
            },
            supportingImages: [],
            supportingPreviews: [],
            templateMatched: false,
            bankIdentifier: "",
          });
        }
      }

      setScanResults(collected);
      setStep("review");
    } catch (err) {
      console.error("Scan failed:", err);
      alert("Scanning failed: " + (err.message || "Unknown error"));
      setStep("upload");
    }
  };

  const scanImage = async (file, token, index, opts = {}) => {
    const { trackProgress = true } = opts;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let lastErr = null;

    try {
      const imageBase64 = await fileToBase64(file);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/api/ocr", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ imageBase64, imageMimeType: file.type || "image/jpeg" }),
          });

          const data = await res.json();
          if (!res.ok) {
            const msg = data.error || data.raw || `OCR failed (${res.status})`;
            if ((res.status === 429 || res.status >= 500) && attempt === 0) {
              await wait(600);
              continue;
            }
            throw new Error(msg);
          }

          const parsed = data.data || {};
          return {
            ocrData: parsed,
            templateMatched: data.templateMatched || false,
            bankIdentifier: data.bankIdentifier || "",
          };
        } catch (err) {
          lastErr = err;
          if (attempt === 0) {
            await wait(500);
            continue;
          }
        }
      }
      throw lastErr || new Error("Load failed");
    } finally {
      if (trackProgress) {
        setScanProgress((p) => ({ ...p, current: p.current + 1 }));
      }
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

  const openCategoryPicker = (resultIdx) => {
    setCategoryPicker({ open: true, resultIdx, q: "" });
  };

  const closeCategoryPicker = () => {
    setCategoryPicker((p) => ({ ...p, open: false, q: "" }));
  };

  const pickCategoryForResult = (resultIdx, categoryId) => {
    updateResultForm(resultIdx, "category_id", String(categoryId));
    const next = [String(categoryId), ...recentCategoryIds.filter((x) => String(x) !== String(categoryId))].slice(0, 6);
    setRecentCategoryIds(next);
    try { localStorage.setItem("zenhome_recent_categories", JSON.stringify(next)); } catch {}
    closeCategoryPicker();
  };

  const handleRetryScan = async (resultIdx) => {
    try {
      setRetryingIdx(resultIdx);
      const token = await getToken();
      if (!token) {
        alert("Session expired. Please log in again.");
        return;
      }
      const target = scanResults[resultIdx];
      const { ocrData, templateMatched, bankIdentifier } = await scanImage(target.file, token, resultIdx, { trackProgress: false });
      const suggestion = suggestCategory({
        description: ocrData?.description || "",
        recipient_name: ocrData?.recipient_name || "",
        bank_name: ocrData?.bank_name || "",
      }, expenseCategories, learnedCategoryMap);

      setScanResults((prev) => {
        const updated = [...prev];
        updated[resultIdx] = {
          ...updated[resultIdx],
          ocrData: ocrData || null,
          ocrError: null,
          templateMatched: templateMatched || false,
          bankIdentifier: bankIdentifier || "",
          form: {
            ...updated[resultIdx].form,
            amount: ocrData?.amount ? String(ocrData.amount) : "",
            category_id: suggestion.id || "",
            suggestion_source: suggestion.source,
            suggestion_confidence: suggestion.confidence,
            description: ocrData?.description || "",
            recipient_name: ocrData?.recipient_name || "",
            bank_name: ocrData?.bank_name || "",
            bank_account: ocrData?.bank_account || "",
            transaction_code: ocrData?.transaction_code || "",
            transaction_date: ocrData?.transaction_date || "",
          },
        };
        return updated;
      });
    } catch (err) {
      setScanResults((prev) => {
        const updated = [...prev];
        updated[resultIdx] = { ...updated[resultIdx], ocrError: err?.message || "Load failed" };
        return updated;
      });
    } finally {
      setRetryingIdx(null);
    }
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

  useEffect(() => {
    try {
      localStorage.setItem("zenhome_pending_slip_queue", JSON.stringify(pendingQueue));
    } catch {}
  }, [pendingQueue]);

  const handleSubmit = async () => {
    if (scanResults.length === 0 || !scanResults.some((r) => r.form.amount)) {
      alert("Please fill in at least one amount");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        alert("Session expired. Please log in again.");
        setSubmitting(false);
        return;
      }
      const createdTransactions = [];

      for (const result of scanResults) {
        if (!result.form.amount) continue; // Skip empty ones
        if (!result.form.transaction_date) {
          alert("OCR chưa đọc được Ngày giao dịch từ bank slip. Vui lòng chụp/upload lại slip rõ hơn.");
          setSubmitting(false);
          return;
        }
        if (type === "expense" && !result.form.category_id) {
          alert("Vui lòng chọn phân loại chi tiêu cho tất cả giao dịch trước khi gửi.");
          setSubmitting(false);
          return;
        }

        try {
          // Upload supporting images
          const supportingProofUrls = [];
          for (const img of result.supportingImages) {
            const url = await uploadFileToStorage(img, "support");
            if (url) supportingProofUrls.push(url);
          }

          // Upload main slip image
          const slipUrl = await uploadFileToStorage(result.file, "slip");

          const selectedCategory = expenseCategories.find((c) => String(c.id) === String(result.form.category_id));

          const payload = {
            type,
            amount: Number(result.form.amount || 0),
            fund_id: null,
            category_id: (type === "expense" && result.form.category_id) ? Number(result.form.category_id) : null,
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
              category_meta: selectedCategory
                ? {
                    id: selectedCategory.id,
                    code: selectedCategory.code || null,
                    label_vi: selectedCategory.name_vi || selectedCategory.name || null,
                    source: "user_selected",
                  }
                : null,
            },
          };

          const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("id").single();
          if (error) throw error;
          createdTransactions.push(inserted);

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
        } catch (itemErr) {
          console.warn("Queue failed slip for retry:", itemErr);
          setPendingQueue((prev) => ([
            ...prev,
            {
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              at: new Date().toISOString(),
              reason: itemErr?.message || "submit_failed",
              description: result.form.description || result.form.recipient_name || "Slip",
              amount: Number(result.form.amount || 0),
            },
          ]));
        }
      }

      // Reset state
      setSlipFiles([]);
      setSlipPreviews([]);
      setScanResults([]);
      setCompressedFiles([]);
      setStep("upload");
      onSuccess?.();
    } catch (err) {
      console.error("Submit failed:", err);
      alert(err.message || "Failed to create transactions");
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== ADJUSTMENT FORM STATE ====================
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjustLinkedTx, setAdjustLinkedTx] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const hasMissingExpenseCategory =
    type === "expense" && scanResults.some((r) => r.form.amount && !r.form.category_id);
  const hasMissingTransactionDate = scanResults.some((r) => r.form.amount && !r.form.transaction_date);

  const handleAdjustSubmit = async () => {
    if (!adjustAmount || Number(adjustAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!adjustReason.trim()) {
      alert("Please provide a reason for this adjustment");
      return;
    }
    setAdjustSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        alert("Session expired. Please log in again.");
        setAdjustSubmitting(false);
        return;
      }
      const payload = {
        type: "adjustment",
        amount: Number(adjustAmount),
        fund_id: null,
        description: adjustReason.trim(),
        adjustment_direction: adjustmentDirection,
        reason: adjustReason.trim(),
        linked_transaction_id: adjustLinkedTx ? Number(adjustLinkedTx) : null,
        transaction_date: adjustDate ? new Date(adjustDate).toISOString() : new Date().toISOString(),
        created_by: profile.id,
        status: "pending",
        source: "app",
        notes: `Manual adjustment (${adjustmentDirection}) — requires review`,
      };

      const { data: inserted, error } = await supabase.from("transactions").insert(payload).select("id").single();
      if (error) throw error;

      // Notify reviewers
      try {
        if (token && inserted?.id) {
          await fetch("/api/transactions/notify-submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              transaction_id: inserted.id,
              amount: payload.amount,
              type: "adjustment",
              description: `${adjustmentDirection === "increase" ? "+" : "-"} ${payload.description}`,
            }),
          });
        }
      } catch (notifyErr) {
        console.warn("notify-submit error:", notifyErr);
      }

      // Reset
      setAdjustAmount("");
      setAdjustReason("");
      setAdjustDate(new Date().toISOString().slice(0, 10));
      setAdjustLinkedTx("");
      setAdjustmentDirection("increase");
      onSuccess?.();
    } catch (err) {
      console.error("Adjustment submit failed:", err);
      alert(err.message || "Failed to create adjustment");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // ==================== TYPE OPTIONS ====================
  const mainTypeOptions = [
    {
      id: "expense",
      label: "Chi",
      icon: "arrow_upward",
      tone: T.danger,
      soft: T.dangerSoft,
      border: "rgba(220, 38, 38, 0.18)",
    },
    {
      id: "income",
      label: "Thu",
      icon: "arrow_downward",
      tone: T.success,
      soft: T.successSoft,
      border: "rgba(22, 163, 74, 0.18)",
    },
  ];

  const adjustOption = {
    id: "adjustment",
    label: "Điều chỉnh Thủ công",
    icon: "tune",
    tone: "#2563eb",
    soft: "#eff6ff",
    border: "rgba(37, 99, 235, 0.18)",
  };

  // ==================== RENDER ====================
  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={topBarStyle}>
          <button onClick={onClose} style={backBtnStyle}>
            <MIcon name="chevron_left" size={20} color={T.text} /> Quay lại
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
            {type === "adjustment" && "Điều chỉnh Thủ công"}
            {type !== "adjustment" && step === "upload" && "Giao dịch mới"}
            {type !== "adjustment" && step === "scanning" && "Đang quét hóa đơn..."}
            {type !== "adjustment" && step === "review" && "Xem xét & Gửi"}
          </span>
          <div style={{ width: 48 }} />
        </div>

        <div style={bodyStyle}>
          {/* Type toggle - always visible */}
          {type !== "adjustment" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {/* Primary: In / Out row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {mainTypeOptions.map((item) => {
                  const active = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setType(item.id); setStep("upload"); }}
                      disabled={step !== "upload"}
                      style={{
                        ...segBtnStyle,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        background: active ? item.tone : item.soft,
                        border: `1px solid ${active ? item.tone : item.border}`,
                        color: active ? "white" : item.tone,
                        boxShadow: active ? `0 6px 18px ${item.id === "expense" ? "rgba(220,38,38,0.18)" : "rgba(22,163,74,0.18)"}` : "none",
                        opacity: step !== "upload" ? 0.6 : 1,
                        cursor: step !== "upload" ? "not-allowed" : "pointer",
                      }}
                    >
                      <MIcon name={item.icon} size={16} color={active ? "white" : item.tone} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {/* Secondary: Manual Adjust link */}
              {step === "upload" && (
                <button
                  type="button"
                  onClick={() => setType("adjustment")}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 0 2px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: adjustOption.tone,
                    fontFamily: T.font,
                  }}
                >
                  <MIcon name="tune" size={16} color={adjustOption.tone} />
                  Điều chỉnh Thủ công
                </button>
              )}
            </div>
          ) : (
            /* Adjustment mode header — back to normal + active indicator */
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => { setType("expense"); setStep("upload"); }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.textMuted,
                  fontFamily: T.font,
                  padding: 0,
                }}
              >
                <MIcon name="chevron_left" size={16} color={T.textMuted} />
                Quay lại
              </button>
              <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                height: 46,
                borderRadius: 14,
                background: adjustOption.tone,
                color: "white",
                fontWeight: 800,
                fontSize: 14,
                fontFamily: T.font,
              }}>
                <MIcon name="tune" size={16} color="white" />
                Điều chỉnh Thủ công
              </div>
            </div>
          )}

          {/* ========== ADJUSTMENT MODE ========== */}
          {type === "adjustment" && (
            <div style={{ display: "grid", gap: 14 }}>
              {/* Direction toggle */}
              <div style={sectionCardStyle}>
                <div style={labelStyle}>Hướng</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { id: "increase", label: "Tăng", icon: "add_circle", tone: T.success, soft: T.successSoft, border: "rgba(22, 163, 74, 0.18)" },
                    { id: "decrease", label: "Giảm", icon: "remove_circle", tone: T.danger, soft: T.dangerSoft, border: "rgba(220, 38, 38, 0.18)" },
                  ].map((dir) => {
                    const active = adjustmentDirection === dir.id;
                    return (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => setAdjustmentDirection(dir.id)}
                        style={{
                          ...segBtnStyle,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          background: active ? dir.tone : dir.soft,
                          border: `1px solid ${active ? dir.tone : dir.border}`,
                          color: active ? "white" : dir.tone,
                          boxShadow: active ? `0 6px 18px ${dir.id === "increase" ? "rgba(22,163,74,0.16)" : "rgba(220,38,38,0.16)"}` : "none",
                        }}
                      >
                        <MIcon name={dir.icon} size={16} color={active ? "white" : dir.tone} />
                        {dir.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div style={sectionCardStyle}>
                <div style={labelStyle}>Số tiền *</div>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, fontSize: 20, fontWeight: 700, letterSpacing: "0.02em" }}
                  required
                />
              </div>

              {/* Reason */}
              <div style={sectionCardStyle}>
                <div style={labelStyle}>Lý do *</div>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Tại sao cần điều chỉnh này?"
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical", paddingTop: 12, paddingBottom: 12, lineHeight: 1.5, height: "auto" }}
                  required
                  maxLength={500}
                />
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, textAlign: "right" }}>
                  {adjustReason.length}/500
                </div>
              </div>

              {/* Date */}
              <div style={sectionCardStyle}>
                <div style={labelStyle}>Ngày</div>
                <input
                  type="date"
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                  style={dateInputStyle}
                />
              </div>

              {/* Linked transaction (optional) */}
              <div style={sectionCardStyle}>
                <div style={labelStyle}>ID giao dịch liên kết</div>
                <input
                  type="number"
                  value={adjustLinkedTx}
                  onChange={(e) => setAdjustLinkedTx(e.target.value)}
                  placeholder="Tùy chọn — tham chiếu giao dịch hiện có"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                  Liên kết đến giao dịch gốc nếu điều này sửa lỗi.
                </div>
              </div>

              {/* Notice */}
              <div style={{
                background: "#eff6ff",
                border: "1px solid rgba(37, 99, 235, 0.15)",
                borderRadius: 14,
                padding: "12px 14px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}>
                <MIcon name="info" size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
                  Điều chỉnh này sẽ được gửi để duyệt. Chủ sở hữu hoặc thư ký phải phê duyệt trước khi có hiệu lực.
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleAdjustSubmit}
                disabled={adjustSubmitting || !adjustAmount || !adjustReason.trim()}
                style={{
                  ...submitBtnStyle,
                  background: adjustOption.tone,
                  opacity: adjustSubmitting || !adjustAmount || !adjustReason.trim() ? 0.5 : 1,
                  cursor: adjustSubmitting || !adjustAmount || !adjustReason.trim() ? "not-allowed" : "pointer",
                }}
              >
                {adjustSubmitting ? "Đang gửi..." : "Gửi để duyệt"}
              </button>
            </div>
          )}

          {/* STEP 1: UPLOAD (only for expense/income) */}
          {type !== "adjustment" && step === "upload" && (
            <>
              <div style={sectionCardStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <div style={labelStyle}>Hóa đơn ngân hàng</div>
                    <div style={helperTextStyle}>Chọn 1-5 hình ảnh cùng lúc</div>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: "none" }} />
                {slipFiles.length === 0 ? (
                  <button type="button" onClick={() => fileRef.current?.click()} style={uploadBoxStyle}>
                    <MIcon name="cloud_upload" size={24} color={T.primary} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Quét hóa đơn</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>UNC / biên lai chuyển khoản</div>
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
                        <div style={{ fontSize: 12, color: T.primary, fontWeight: 700 }}>Thêm ({slipFiles.length}/5)</div>
                      </button>
                    )}
                  </>
                )}
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
                {slipFiles.length === 0 ? "Chọn hóa đơn để quét" : `Quét ${slipFiles.length} hóa đơn${slipFiles.length > 1 ? "" : ""}`}
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
                  Đang quét hóa đơn...
                </div>
                <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 16 }}>
                  {scanProgress.phase === "compressing" ? "Chuẩn bị hình ảnh..." : `Đang quét ${scanProgress.current}/${scanProgress.total}...`}
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
                  <div>Không có hóa đơn nào được quét</div>
                </div>
              ) : (
                scanResults.map((result, resultIdx) => (
                  <div key={resultIdx} style={sectionCardStyle}>
                    {/* Slip thumbnail */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      <img src={result.preview} alt={`Slip ${resultIdx + 1}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                          Hóa đơn {resultIdx + 1}
                        </div>
                        {result.templateMatched && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.primary, background: "#eef8e8", padding: "4px 8px", borderRadius: 4, marginBottom: 4 }}>
                            <span>⚡</span> {result.bankIdentifier || "Template matched"}
                          </div>
                        )}
                        {result.ocrError && (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 12, color: T.danger, lineHeight: 1.4 }}>
                              {result.ocrError}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRetryScan(resultIdx)}
                              disabled={retryingIdx === resultIdx}
                              style={{ height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 12, fontWeight: 700, cursor: retryingIdx === resultIdx ? "default" : "pointer", opacity: retryingIdx === resultIdx ? 0.6 : 1 }}
                            >
                              {retryingIdx === resultIdx ? "Đang quét lại..." : "Quét lại slip này"}
                            </button>
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
                        <div style={labelStyle}>Số tiền *</div>
                        <input
                          type="number"
                          value={result.form.amount}
                          onChange={(e) => updateResultForm(resultIdx, "amount", e.target.value)}
                          placeholder="0"
                          style={inputStyle}
                          required
                        />
                      </div>

                      {type === "expense" && (
                        <div>
                          <div style={labelStyle}>Phân loại chi tiêu *</div>
                          <button
                            type="button"
                            onClick={() => openCategoryPicker(resultIdx)}
                            style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                          >
                            <span style={{ color: result.form.category_id ? T.text : T.textMuted }}>
                              {expenseCategories.find((c) => String(c.id) === String(result.form.category_id))?.name_vi || "Chọn phân loại"}
                            </span>
                            <MIcon name="expand_more" size={18} color={T.textMuted} />
                          </button>
                          {result.form.category_id && (
                            <div style={{ marginTop: 8 }}>
                              {(() => {
                                const selected = expenseCategories.find((c) => String(c.id) === String(result.form.category_id));
                                if (!selected) return null;
                                return (
                                  <>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: `${selected.color || T.primary}22`, color: selected.color || T.primary, fontSize: 11, fontWeight: 700, border: `1px solid ${(selected.color || T.primary)}33` }}>
                                      <span style={{ width: 6, height: 6, borderRadius: 999, background: selected.color || T.primary }} />
                                      {selected.name_vi || selected.name}
                                    </span>
                                    {result.form.suggestion_source && result.form.suggestion_source !== "none" && (
                                      <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted }}>
                                        Gợi ý: {result.form.suggestion_source} · tin cậy {Math.round(Number(result.form.suggestion_confidence || 0) * 100)}%
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      <div>
                        <div style={labelStyle}>Mô tả</div>
                        <input
                          type="text"
                          value={result.form.description}
                          onChange={(e) => updateResultForm(resultIdx, "description", e.target.value)}
                          placeholder="Cái này dùng để làm gì?"
                          style={inputStyle}
                        />
                      </div>

                      {/* Recipient */}
                      <div>
                        <div style={labelStyle}>Người nhận</div>
                        <input
                          type="text"
                          value={result.form.recipient_name}
                          onChange={(e) => updateResultForm(resultIdx, "recipient_name", e.target.value)}
                          placeholder="Tên người nhận"
                          style={inputStyle}
                        />
                      </div>

                      {/* Bank */}
                      <div>
                        <div style={labelStyle}>Ngân hàng</div>
                        <input
                          type="text"
                          value={result.form.bank_name}
                          onChange={(e) => updateResultForm(resultIdx, "bank_name", e.target.value)}
                          placeholder="Tên ngân hàng"
                          style={inputStyle}
                        />
                      </div>

                      {/* Account */}
                      <div>
                        <div style={labelStyle}>Số tài khoản</div>
                        <input
                          type="text"
                          value={result.form.bank_account}
                          onChange={(e) => updateResultForm(resultIdx, "bank_account", e.target.value)}
                          placeholder="Số tài khoản ngân hàng"
                          style={inputStyle}
                        />
                      </div>

                      {/* Transaction code */}
                      <div>
                        <div style={labelStyle}>Mã giao dịch</div>
                        <input
                          type="text"
                          value={result.form.transaction_code}
                          onChange={(e) => updateResultForm(resultIdx, "transaction_code", e.target.value)}
                          placeholder="Mã tham chiếu"
                          style={inputStyle}
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <div style={labelStyle}>Ngày giao dịch *</div>
                        <input
                          type="date"
                          value={result.form.transaction_date}
                          style={{ ...dateInputStyle, background: "#f3f6f3", color: result.form.transaction_date ? T.text : T.textMuted }}
                          disabled
                        />
                        <div style={{ marginTop: 4, fontSize: 11, color: T.textMuted }}>
                          Tự động lấy từ ngày chuyển khoản trên bank slip (không cho chỉnh tay).
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <div style={labelStyle}>Ghi chú</div>
                        <textarea
                          value={result.form.notes}
                          onChange={(e) => updateResultForm(resultIdx, "notes", e.target.value)}
                          placeholder="Ghi chú nội bộ"
                          style={{ ...inputStyle, minHeight: 70, resize: "vertical", paddingTop: 10, paddingBottom: 10, lineHeight: "normal" }}
                        />
                      </div>

                      {/* Supporting images */}
                      <div>
                        <div style={labelStyle}>Hình ảnh hỗ trợ ({result.supportingImages.length}/10)</div>
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
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Thêm hình ảnh hỗ trợ</div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{result.supportingImages.length}/10 đã chọn</div>
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

              {categoryPicker.open && categoryPicker.resultIdx !== null && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", backdropFilter: "blur(2px)" }}
                  onClick={closeCategoryPicker}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: "100%", maxHeight: "76vh", background: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, overflowY: "auto", boxShadow: "0 -12px 40px rgba(0,0,0,0.14)" }}
                  >
                    <div style={{ width: 42, height: 4, borderRadius: 999, background: "#dfe7dd", margin: "2px auto 12px" }} />
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 10 }}>Chọn phân loại</div>
                    <input
                      value={categoryPicker.q}
                      onChange={(e) => setCategoryPicker((p) => ({ ...p, q: e.target.value }))}
                      placeholder="Tìm phân loại..."
                      style={{ ...inputStyle, marginBottom: 10 }}
                    />

                    {(() => {
                      const result = scanResults[categoryPicker.resultIdx];
                      const suggested = expenseCategories.find((c) => String(c.id) === String(result?.form?.category_id));
                      const recentCats = recentCategoryIds.map((id) => expenseCategories.find((c) => String(c.id) === String(id))).filter(Boolean);
                      const filtered = expenseCategories.filter((c) => (c.name_vi || c.name || "").toLowerCase().includes((categoryPicker.q || "").toLowerCase()));

                      return (
                        <>
                          {!categoryPicker.q && suggested && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>Gợi ý từ OCR</div>
                              <button type="button" onClick={() => pickCategoryForResult(categoryPicker.resultIdx, suggested.id)} style={{ ...inputStyle, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span>{suggested.name_vi || suggested.name}</span><span style={{ fontSize: 10, color: T.primary }}>Đề xuất</span>
                              </button>
                            </div>
                          )}

                          {!categoryPicker.q && recentCats.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>Dùng gần đây</div>
                              <div style={{ display: "grid", gap: 6 }}>
                                {recentCats.map((c) => (
                                  <button key={c.id} type="button" onClick={() => pickCategoryForResult(categoryPicker.resultIdx, c.id)} style={{ ...inputStyle, textAlign: "left" }}>
                                    {c.name_vi || c.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>Tất cả phân loại</div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {filtered.map((c) => (
                              <button key={c.id} type="button" onClick={() => pickCategoryForResult(categoryPicker.resultIdx, c.id)} style={{ ...inputStyle, textAlign: "left", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 999, background: `${c.color || T.primary}22`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                  <MIcon name={getCategoryIconName(c)} size={13} color={c.color || T.primary} />
                                </span>
                                <span>{c.name_vi || c.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Submit button */}
              {pendingQueue.length > 0 && (
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span>Hàng chờ retry: {pendingQueue.length} slip lỗi upload/submit</span>
                  <button type="button" onClick={() => setPendingQueue([])} style={{ border: `1px solid ${T.border}`, background: "#fff", borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
                    Xóa hàng chờ
                  </button>
                </div>
              )}
              {scanResults.length > 0 && hasMissingTransactionDate && (
                <div style={{ fontSize: 12, color: T.danger, marginBottom: 8 }}>
                  Có slip chưa đọc được Ngày giao dịch. Vui lòng thay ảnh rõ hơn.
                </div>
              )}
              {scanResults.length > 0 && hasMissingExpenseCategory && (
                <div style={{ fontSize: 12, color: T.danger, marginBottom: 8 }}>
                  Vui lòng chọn phân loại chi tiêu cho tất cả giao dịch trước khi gửi.
                </div>
              )}
              {scanResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !scanResults.some((r) => r.form.amount) || hasMissingExpenseCategory || hasMissingTransactionDate}
                  style={{
                    ...submitBtnStyle,
                    opacity: submitting || !scanResults.some((r) => r.form.amount) || hasMissingExpenseCategory || hasMissingTransactionDate ? 0.5 : 1,
                    cursor: submitting || !scanResults.some((r) => r.form.amount) || hasMissingExpenseCategory || hasMissingTransactionDate ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Đang tạo..." : `Tạo ${scanResults.filter((r) => r.form.amount).length} giao dịch${scanResults.filter((r) => r.form.amount).length !== 1 ? "" : ""}`}
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

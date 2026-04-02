"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  "/secretary": { label: "Bàn thư ký", hint: "Tải hóa đơn ngân hàng để tạo giao dịch." },
  "/driver": { label: "Nhật ký tài xế", hint: "Gửi ảnh hóa đơn để ghi chi phí." },
  "/housekeeper": { label: "Vận hành nhà", hint: "Gửi ảnh hóa đơn để ghi chi phí." },
  "/transactions": { label: "Sổ giao dịch", hint: "Tải hóa đơn ngân hàng để thêm mục mới." },
  "/owner": { label: "Bảng điều khiển chủ nhà", hint: "Hỏi tôi bất cứ điều gì về gia đình bạn." },
};
function getCtx(path, mode = "default") {
  if (path === "/secretary" && mode === "cash-ledger") {
    return { label: "Bàn thư ký • Sổ quỹ", hint: "Tải phiếu chuyển tiền để tạo chuyển quỹ cho nhân sự." };
  }
  return CTX_MAP[path] || { label: "ZenHome", hint: "How can I help?" };
}

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

    // Phase 3: on-device OCR pre-enhancement (light contrast + sharpen)
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    const contrast = 1.12;
    const bias = -8;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, contrast * d[i] + bias));
      d[i + 1] = Math.max(0, Math.min(255, contrast * d[i + 1] + bias));
      d[i + 2] = Math.max(0, Math.min(255, contrast * d[i + 2] + bias));
    }
    ctx.putImageData(imageData, 0, 0);

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

function normalizeTextKey(v = "") {
  return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isSelectableExpenseCategory(category, allCategories = []) {
  if (!category) return false;
  const code = String(category.code || "").toUpperCase();
  if (code.startsWith("P_") || code.startsWith("C_")) return false;
  return !allCategories.some((item) => String(item.parent_id || "") === String(category.id));
}

function getCategoryDisplayLabel(category, options = {}) {
  const { withParents = false } = options;
  if (!category) return "Chưa phân loại";
  const parts = [];
  const byId = options.allCategoriesById || null;
  let current = category;
  let guard = 0;
  while (current && guard < 6) {
    parts.unshift(current.name_vi || current.name || "");
    current = byId && current.parent_id ? byId.get(String(current.parent_id)) : null;
    guard += 1;
  }
  const clean = parts.filter(Boolean);
  if (!clean.length) return "Chưa phân loại";
  return withParents ? clean.join(" / ") : clean[clean.length - 1];
}

function buildExpenseCategoryGroups(categories = []) {
  const byParent = new Map();
  for (const category of categories) {
    const key = category.parent_id == null ? "ROOT" : String(category.parent_id);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(category);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0));
  }
  return (byParent.get("ROOT") || []).map((parent) => ({
    parent,
    children: (byParent.get(String(parent.id)) || []).map((child) => ({
      category: child,
      leaves: (byParent.get(String(child.id)) || []).filter((leaf) => isSelectableExpenseCategory(leaf, categories)),
    })),
  }));
}

function suggestCategory({ description = "", recipient_name = "", bank_name = "" }, categories = [], learnedMap = {}) {
  const hay = `${description} ${recipient_name} ${bank_name}`.toLowerCase();
  if (!hay.trim() || !categories.length) return { id: "", source: "none", confidence: 0 };

  const selectableCategories = categories.filter((c) => isSelectableExpenseCategory(c, categories));
  const byCode = new Map(selectableCategories.map((c) => [String(c.code || "").toUpperCase(), c]));

  const descKey = normalizeTextKey(description);
  const recKey = normalizeTextKey(recipient_name);
  const hayKey = normalizeTextKey(hay);
  const learnedKey = `${descKey}|${recKey}`;

  const personalNameLike = /^[a-z\s]{8,}$/i.test((description || "").trim()) && !/\d/.test(description || "");
  const recipientPersonalLike = /^[a-z\s]{6,}$/i.test((recipient_name || "").trim()) && !/\d/.test(recipient_name || "");
  const looksPersonalTransfer = personalNameLike || recipientPersonalLike;

  const directRules = [
    { code: "TIEN_CHO", keys: ["cho", "rau", "thit", "ca", "trai cay", "coopmart", "winmart", "bach hoa", "sieu thi", "market"] },
    { code: "DO_AN_GOI", keys: ["grabfood", "shopeefood", "befood", "do an", "tra sua", "highlands", "phuc long"] },
    { code: "DIEN_NUOC_GAS_NET", keys: ["dien", "nuoc", "internet", "wifi", "gas", "cap quang", "viettel", "fpt", "vnpt"] },
    { code: "DI_LAI", keys: ["xang", "taxi", "grab", "be", "xanh sm", "cau duong", "gui xe", "tram thu phi", "parking"] },
    { code: "CHI_BEP", keys: ["nguyen lieu", "gia vi", "bep", "thuc an", "do kho"] },
    { code: "DANG_KY_DICH_VU", keys: ["subscription", "icloud", "youtube", "netflix", "spotify", "chatgpt", "gemini", "claude"] },
    { code: "SUA_CHUA_BAO_TRI", keys: ["sua chua", "bao tri", "thay", "lap dat", "ky thuat", "dien lanh"] },
    { code: "DU_LICH", keys: ["khach san", "ve may bay", "booking", "travel", "resort", "villa"] },
    { code: "PR_DOI_NGOAI", keys: ["doi ngoai", "gap mat", "tiep khach", "qua doi tac", "pr"] },
    { code: "GIAI_TRI_QUA_TANG", keys: ["qua tang", "sinh nhat", "giai tri", "xem phim", "qua"] },
    { code: "LUONG_NHAN_SU", keys: ["luong", "thuong", "nhan vien", "salary", "payroll"] },
  ];

  for (const rule of directRules) {
    if (rule.keys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
      const hit = byCode.get(rule.code);
      if (hit) return { id: String(hit.id), source: "keyword", confidence: 0.9 };
    }
  }

  const familyRules = [
    { targets: ["THUOC_ONG", "KHAM_CHUA_ONG", "MUA_SAM_ONG"], people: ["ong", "ba noi", "ba ngoai", "grandpa", "grandfather"] },
    { targets: ["THUOC_ANH_QUANG", "KHAM_CHUA_ANH_QUANG", "MUA_SAM_ANH_QUANG"], people: ["anh quang", "quang", "mr quang"] },
    { targets: ["THUOC_JENNIE", "KHAM_CHUA_JENNIE", "MUA_SAM_JENNIE", "GIAO_DUC_JENNIE"], people: ["jennie", "be jennie"] },
    { targets: ["THUOC_CHIPTUN", "KHAM_CHUA_CHIPTUN", "MUA_SAM_CHIPTUN", "GIAO_DUC_CHIPTUN", "HOC_PHI_TRUONG_HOC_CHIPTUN"], people: ["chiptun", "chip tun", "be chip", "chip"] },
    { targets: ["GIAO_DUC_KHANH_LINH_NHAN_VIEN"], people: ["khanh linh", "nhan vien", "staff"] },
  ];

  const healthKeys = ["thuoc", "pharmacy", "nha thuoc", "drug", "medicine", "vitamin", "kham", "benh vien", "clinic", "xet nghiem", "bac si", "hospital"];
  const medicineKeys = ["thuoc", "pharmacy", "nha thuoc", "drug", "medicine", "vitamin", "toa thuoc"];
  const hospitalKeys = ["kham", "benh vien", "clinic", "xet nghiem", "bac si", "hospital", "vien phi"];
  const shoppingKeys = ["mua sam", "shopping", "quan ao", "giay", "my pham", "phu kien", "tui", "ao", "vay"];
  const educationKeys = ["hoc", "hoc phi", "truong", "lop", "giao vien", "course", "khoa hoc", "tuition", "school"];

  for (const familyRule of familyRules) {
    const matchedPerson = familyRule.people.some((k) => hayKey.includes(normalizeTextKey(k)));
    if (!matchedPerson) continue;

    if (medicineKeys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
      const hit = familyRule.targets.map((code) => byCode.get(code)).find((c) => c && String(c.code).startsWith("THUOC_"));
      if (hit) return { id: String(hit.id), source: "family_health", confidence: 0.93 };
    }
    if (hospitalKeys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
      const hit = familyRule.targets.map((code) => byCode.get(code)).find((c) => c && String(c.code).startsWith("KHAM_CHUA_"));
      if (hit) return { id: String(hit.id), source: "family_health", confidence: 0.93 };
    }
    if (shoppingKeys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
      const hit = familyRule.targets.map((code) => byCode.get(code)).find((c) => c && String(c.code).startsWith("MUA_SAM_"));
      if (hit) return { id: String(hit.id), source: "family_personal", confidence: 0.9 };
    }
    if (educationKeys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
      const hit = familyRule.targets.map((code) => byCode.get(code)).find((c) => c && (String(c.code).startsWith("GIAO_DUC_") || String(c.code).startsWith("HOC_PHI_")));
      if (hit) return { id: String(hit.id), source: "family_education", confidence: 0.92 };
    }
    if (healthKeys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
      const hit = familyRule.targets.map((code) => byCode.get(code)).find((c) => c && (String(c.code).startsWith("THUOC_") || String(c.code).startsWith("KHAM_CHUA_")));
      if (hit) return { id: String(hit.id), source: "family_health", confidence: 0.88 };
    }
  }

  if (educationKeys.some((k) => hayKey.includes(normalizeTextKey(k)))) {
    const schoolFee = byCode.get("HOC_PHI_TRUONG_HOC_CHIPTUN");
    const genericEdu = byCode.get("GIAO_DUC_CHIPTUN") || byCode.get("GIAO_DUC_JENNIE") || byCode.get("GIAO_DUC_KHANH_LINH_NHAN_VIEN");
    if (schoolFee && hayKey.includes("hoc phi")) return { id: String(schoolFee.id), source: "education_keyword", confidence: 0.9 };
    if (genericEdu) return { id: String(genericEdu.id), source: "education_keyword", confidence: 0.78 };
  }

  const fallbackOther = selectableCategories.find((c) => {
    const code = String(c.code || "").toUpperCase();
    const vi = String(c.name_vi || "").toLowerCase();
    const en = String(c.name || "").toLowerCase();
    return code === "KHAC" || vi === "khác" || vi === "khac" || en === "other";
  });

  if (learnedMap[learnedKey]) return { id: String(learnedMap[learnedKey]), source: "learned", confidence: 0.78 };
  if (looksPersonalTransfer && fallbackOther) return { id: String(fallbackOther.id), source: "personal_guard", confidence: 0.88 };
  if (fallbackOther) return { id: String(fallbackOther.id), source: "fallback_other", confidence: 0.6 };
  return { id: "", source: "none", confidence: 0 };
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

function parseCategoryQuery(text = "") {
  const t = text.toLowerCase();
  const m = t.match(/chi\s+(.+?)\s+(?:het\s+)?bao\s+nhieu/);
  return m?.[1]?.trim() || "";
}

function parseMonthKey(text = "") {
  const now = new Date();
  const monthMatch = text.match(/th[aá]ng\s*(\d{1,2})/i);
  const month = monthMatch ? Number(monthMatch[1]) : now.getMonth() + 1;
  if (!month || month < 1 || month > 12) return null;

  const yearMatch = text.match(/(?:n[aă]m|\/)\s*(20\d{2})/i);
  const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
  return `${year}-${String(month).padStart(2, "0")}`;
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
  const submittingRef = useRef(false); // Prevents double-submit

  // ─── ALL useState hooks MUST be above any conditional return ──
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [badge, setBadge] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingOcr, setPendingOcr] = useState(null);
  const [creatingTx, setCreatingTx] = useState(false);
  const [createdTxId, setCreatedTxId] = useState(null);
  const [askingSupport, setAskingSupport] = useState(false);
  const [slipUrl, setSlipUrl] = useState(null);
  const [dupeWarning, setDupeWarning] = useState(null);
  const [supportCount, setSupportCount] = useState(0);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [learnedCategoryMap, setLearnedCategoryMap] = useState({});
  const [secretaryTab, setSecretaryTab] = useState(() => {
    if (typeof window === "undefined") return "home";
    return new URLSearchParams(window.location.search).get("tab") || "home";
  });
  const [transferRecipients, setTransferRecipients] = useState([]);
  const [fabRight, setFabRight] = useState(20);
  const [boxWidth, setBoxWidth] = useState(380);
  const [boxHeight, setBoxHeight] = useState(540);

  // ─── ALL useEffect hooks MUST be above any conditional return ──

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

  useEffect(() => {
    function syncSecretaryTabFromUrl() {
      if (typeof window === "undefined") return;
      const tab = new URLSearchParams(window.location.search).get("tab") || "home";
      setSecretaryTab(tab);
    }
    syncSecretaryTabFromUrl();
    window.addEventListener("popstate", syncSecretaryTabFromUrl);
    window.addEventListener("zenhome:secretary-tab", syncSecretaryTabFromUrl);
    return () => {
      window.removeEventListener("popstate", syncSecretaryTabFromUrl);
      window.removeEventListener("zenhome:secretary-tab", syncSecretaryTabFromUrl);
    };
  }, []);

  const chatMode = pathname === "/secretary" && secretaryTab === "cash-ledger" ? "cash-ledger" : "default";

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0 && profile) {
      const ctx = getCtx(pathname, chatMode);
      const name = profile.full_name?.split(" ").pop() || "";
      setMessages([{
        id: uid(), role: "agent",
        content: `Hi ${name}! ${ctx.hint}`,
        ts: Date.now(),
      }]);
    }
  }, [open, profile, pathname, chatMode, messages.length]);

  // Clear badge when chat opens
  useEffect(() => {
    if (open) setBadge(false);
  }, [open]);

  // Load expense categories for required classification step
  useEffect(() => {
    if (!profile?.id) return;
    let canceled = false;
    (async () => {
      const [{ data: cats }, { data: txs }, { data: staff }] = await Promise.all([
        supabase
          .from("categories")
          .select("id, code, name, name_vi, color, sort_order, parent_id")
          .order("sort_order", { ascending: true }),
        supabase
          .from("transactions")
          .select("description, recipient_name, category_id, created_at")
          .not("category_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("role", ["driver", "housekeeper"]),
      ]);
      if (!canceled) {
        setExpenseCategories(cats || []);
        setTransferRecipients(staff || []);
        const m = {};
        for (const t of txs || []) {
          const k = `${normalizeTextKey(t.description)}|${normalizeTextKey(t.recipient_name)}`;
          if (!m[k] && k !== "|") m[k] = t.category_id;
        }
        setLearnedCategoryMap(m);
      }
    })();
    return () => { canceled = true; };
  }, [profile?.id]);

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
  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    addUser(text);

    const askingSpend = /(chi|chi tieu).*(bao nhieu|hết bao nhiêu|bao nhiêu)/i.test(text.toLowerCase()) && /th[aá]ng\s*\d{1,2}/i.test(text);
    if (askingSpend) {
      try {
        const token = await getToken();
        if (!token) {
          addAgent("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
          return;
        }

        const month = parseMonthKey(text);
        const q = parseCategoryQuery(text);
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        if (q) params.set("q", q);

        const res = await fetch(`/api/reports/spending-by-category?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          addAgent("Em chưa lấy được báo cáo lúc này. Anh thử lại giúp em nhé.");
          return;
        }

        if (json.category) {
          addAgent(`Tháng ${json.period.month}/${json.period.year}, mục "${json.category.name_vi}" đã chi ${fmtVND(json.total)} (${json.transactionCount} giao dịch).`);
        } else {
          const top = (json.byCategory || []).slice(0, 3).map((x) => `${x.name_vi}: ${fmtVND(x.total)}`).join(" • ");
          addAgent(`Tổng chi tháng ${json.period.month}/${json.period.year}: ${fmtVND(json.total)} (${json.transactionCount} giao dịch). Top: ${top || "chưa có dữ liệu"}.`);
        }
        return;
      } catch {
        addAgent("Em chưa lấy được báo cáo lúc này. Anh thử lại giúp em nhé.");
        return;
      }
    }

    setTimeout(() => {
      if (/bank\s?slip|receipt|ho[aá]\s?[dđ][oơ]n|chuy[eể]n\s?kho[aả]n|upload|ảnh/i.test(text)) {
        addAgent("Nhấn biểu tượng camera bên dưới để tải hóa đơn ngân hàng, tôi sẽ quét giúp bạn.");
      } else {
        addAgent("Tôi có thể giúp bạn tạo giao dịch từ hóa đơn ngân hàng. Nhấn biểu tượng camera để bắt đầu!");
      }
    }, 600);
  }

  // ─── IMAGE UPLOAD + OCR ───────────────────────────────────────
  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    const previewUrl = URL.createObjectURL(file);
    addUser("Hóa đơn ngân hàng", { imageUrl: previewUrl });
    setProcessing(true);

    try {
      const compressed = await compressImage(file);

      // Storage upload should not block OCR scan; if it fails, keep going and retry upload on submit.
      try {
        const url = await uploadFile(compressed, profile.id, "chat-slip");
        setSlipUrl(url);
      } catch (uploadErr) {
        console.warn("Chat slip pre-upload failed, continue OCR:", uploadErr);
        setSlipUrl(null);
      }

      const token = await getToken();
      if (!token) {
        addAgent("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
        setProcessing(false);
        return;
      }

      const base64 = await fileToBase64(compressed);

      let data = null;
      let lastMsg = "Không thể đọc ảnh này. Vui lòng thử ảnh rõ hơn.";
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: base64, imageMimeType: "image/jpeg" }),
        });

        let json = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }

        if (res.ok && json?.success) {
          data = json;
          break;
        }

        lastMsg = json?.error || json?.raw || `OCR failed (${res.status})`;
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
      }

      if (!data) {
        addAgent(`Không thể đọc ảnh này (${lastMsg}). Vui lòng thử ảnh rõ hơn.`);
        return;
      }

      const ocr = data.data || {};
      const suggestion = suggestCategory({
        description: ocr.description || "",
        recipient_name: ocr.recipient_name || "",
        bank_name: ocr.bank_name || "",
      }, expenseCategories, learnedCategoryMap);

      const defaultRecipient = chatMode === "cash-ledger" ? (transferRecipients[0] || null) : null;
      setPendingOcr({
        amount: ocr.amount ? String(ocr.amount) : "",
        type: "expense",
        entry_kind: chatMode === "cash-ledger" ? "fund_transfer_out" : "ops",
        category_id: chatMode === "cash-ledger" ? "" : (suggestion.id || ""),
        description: ocr.description || "",
        recipient_user_id: chatMode === "cash-ledger" ? (defaultRecipient?.id || "") : "",
        recipient_name: chatMode === "cash-ledger" ? (defaultRecipient?.full_name || "") : (ocr.recipient_name || ""),
        bank_name: ocr.bank_name || "",
        bank_account: ocr.bank_account || "",
        transaction_code: ocr.transaction_code || "",
        transaction_date: ocr.transaction_date || "",
        suggestion_source: suggestion.source,
        suggestion_confidence: suggestion.confidence,
      });
      addAgent("Quét thành công! Xem chi tiết bên dưới:");
    } catch (err) {
      console.error("Chat OCR error:", err);
      const msg = err?.message || "Lỗi không xác định";
      addAgent(`Đã xảy ra lỗi khi quét (${msg}). Vui lòng thử lại.`);
    } finally {
      setProcessing(false);
    }
  }

  // ─── CONFIRM TRANSACTION ──────────────────────────────────────
  async function handleConfirmTx(data) {
    // Synchronous guard — prevents double-submit even on rapid clicks
    if (submittingRef.current) return;
    if (!data.amount || Number(data.amount) <= 0) {
      addAgent("Vui lòng nhập số tiền hợp lệ.");
      return;
    }
    if (chatMode === "cash-ledger") {
      if (data.type === "expense" && !data.recipient_user_id) {
        addAgent("Vui lòng chọn người nhận quỹ trước khi tạo chuyển quỹ.");
        return;
      }
    } else if (data.type === "expense" && !data.category_id) {
      addAgent("Vui lòng chọn phân loại chi tiêu trước khi tạo giao dịch.");
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
    submittingRef.current = true;

    try {
      const token = await getToken();
      if (!token) {
        addAgent("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
        setCreatingTx(false);
        submittingRef.current = false;
        return;
      }

      if (chatMode === "cash-ledger") {
        const isTransfer = data.type === "expense";
        const res = await fetch("/api/cash-ledger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: isTransfer ? "expense" : "income",
            entry_kind: isTransfer ? "fund_transfer_out" : "ops",
            amount: Number(data.amount),
            description: data.description || null,
            recipient_user_id: isTransfer ? (data.recipient_user_id || null) : null,
            recipient_name: data.recipient_name || null,
            bank_name: data.bank_name || null,
            bank_account: data.bank_account || null,
            transaction_code: data.transaction_code || null,
            transaction_date: data.transaction_date ? new Date(data.transaction_date).toISOString() : null,
            slip_image_url: slipUrl,
            notes: data.notes || null,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || (isTransfer ? "Không tạo được chuyển quỹ" : "Không tạo được thu sổ quỹ"));

        setPendingOcr(null);
        setSupportCount(0);
        addAgent(
          isTransfer
            ? `Đã tạo chuyển quỹ (${fmtVND(data.amount)}) cho ${data.recipient_name || "nhân sự"}. Thu vận hành sẽ được tạo tự động cho người nhận.`
            : `Đã ghi nhận thu sổ quỹ (${fmtVND(data.amount)}) thành công.`
        );
        setAskingSupport(false);
      } else {
        const selectedCategory = expenseCategories.find((c) => String(c.id) === String(data.category_id));
        const payload = {
          type: data.type || "expense",
          amount: Number(data.amount),
          fund_id: null,
          category_id: (data.type === "expense" && data.category_id) ? Number(data.category_id) : null,
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
          ocr_raw_data: {
            ...data,
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

        const { data: inserted, error } = await supabase
          .from("transactions")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

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
        } catch {}

        setCreatedTxId(inserted.id);
        setPendingOcr(null);
        setSupportCount(0);
        addAgent(
          `Đã tạo giao dịch (${fmtVND(data.amount)}) và gửi để duyệt! Bạn có muốn đính kèm tài liệu bổ sung? (tối đa 10 ảnh)`
        );
        setAskingSupport(true);
      }
    } catch (err) {
      console.error("Create tx error:", err);
      addAgent("Tạo giao dịch thất bại: " + (err.message || "Lỗi không xác định"));
    } finally {
      setCreatingTx(false);
      submittingRef.current = false;
    }
  }

  // ─── SUPPORT IMAGE ────────────────────────────────────────────
  async function handleSupportUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !createdTxId) return;
    if (fileRef.current) fileRef.current.value = "";

    try {
      const { data: tx } = await supabase
        .from("transactions")
        .select("ocr_raw_data")
        .eq("id", createdTxId)
        .single();

      const existing = tx?.ocr_raw_data || {};
      const existingUrls = Array.isArray(existing.supporting_proof_urls) ? existing.supporting_proof_urls : [];
      const remaining = Math.max(0, 10 - existingUrls.length);

      if (remaining === 0) {
        setSupportCount(10);
        addAgent("Bạn đã đạt giới hạn 10 ảnh chứng minh cho giao dịch này.");
        return;
      }

      const toUpload = files.slice(0, remaining);
      if (files.length > remaining) {
        addAgent(`Chỉ có thể tải thêm ${remaining} ảnh (tối đa 10 ảnh).`);
      }

      const newUrls = [];
      for (const file of toUpload) {
        addUser("Supporting document", { imageUrl: URL.createObjectURL(file) });
        const compressed = await compressImage(file);
        const url = await uploadFile(compressed, profile.id, "support");
        newUrls.push(url);
      }

      const supportUrls = [...existingUrls, ...newUrls].slice(0, 10);
      await supabase
        .from("transactions")
        .update({ ocr_raw_data: { ...existing, supporting_proof_urls: supportUrls } })
        .eq("id", createdTxId);

      setSupportCount(supportUrls.length);
      if (supportUrls.length >= 10) {
        addAgent("Đã đính kèm đủ 10/10 ảnh chứng minh. Nhấn 'Xong' để hoàn tất.");
      } else {
        addAgent(`Đã đính kèm ${supportUrls.length}/10 ảnh. Bạn có thể tải thêm hoặc nhấn 'Xong'.`);
      }
    } catch {
      addAgent("Tải tài liệu thất bại. Vui lòng thử lại.");
    }
  }

  function handleSkipSupport() {
    setAskingSupport(false);
    setCreatedTxId(null);
    setSlipUrl(null);
    setSupportCount(0);
    addAgent("Hoàn tất! Gửi hóa đơn ngân hàng khác bất cứ lúc nào.");
  }

  function handleDupeConfirm() {
    if (dupeWarning?.data) handleConfirmTx(dupeWarning.data);
  }

  function handleDupeDismiss() {
    setDupeWarning(null);
    setPendingOcr(null);
    addAgent("Đã hủy giao dịch. Tải hóa đơn mới để thử lại.");
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  const ctx = getCtx(pathname, chatMode);

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Floating Action Button ───────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        style={{
          position: "fixed",
          bottom: 92,
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
            bottom: 160,
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
                      Đang quét
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
                  categories={expenseCategories}
                  mode={chatMode}
                  transferRecipients={transferRecipients}
                  onConfirm={handleConfirmTx}
                  onCancel={() => {
                    setPendingOcr(null);
                    addAgent("Đã hủy. Tải hóa đơn mới bất cứ lúc nào.");
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
                  alignItems: "center",
                  flexWrap: "wrap",
                  animation: "cFadeIn 0.3s ease-out",
                }}
              >
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={supportCount >= 10}
                  style={{ ...actionBtnS, background: supportCount >= 10 ? `${T.primary}66` : T.primary, color: "#fff", cursor: supportCount >= 10 ? "default" : "pointer" }}
                >
                  <MIcon name="add_a_photo" size={16} color="#fff" /> Tải lên ({supportCount}/10)
                </button>
                <button
                  onClick={handleSkipSupport}
                  style={{ ...actionBtnS, background: "#f1f5f1", color: T.textSec }}
                >
                  Xong
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
              placeholder="Nhập tin nhắn..."
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
        multiple={askingSupport}
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

function OCRCard({ data, categories = [], mode = "default", transferRecipients = [], onConfirm, onCancel, loading }) {
  const [form, setForm] = useState({ ...data });
  const [showPicker, setShowPicker] = useState(false);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState([]);
  const [parentId, setParentId] = useState(null);
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const categoryMissing = mode !== "cash-ledger" && form.type === "expense" && !form.category_id;
  const recipientMissing = mode === "cash-ledger" && !form.recipient_user_id;
  const dateMissing = !form.transaction_date;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("zenhome_recent_categories");
      setRecent(raw ? JSON.parse(raw) : []);
    } catch {
      setRecent([]);
    }
  }, []);

  const selectCategory = (id) => {
    upd("category_id", String(id));
    setShowPicker(false);
    setQ("");
    setParentId(null);
    const next = [String(id), ...recent.filter((x) => String(x) !== String(id))].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem("zenhome_recent_categories", JSON.stringify(next)); } catch {}
  };

  const categoriesById = new Map(categories.map((c) => [String(c.id), c]));
  const selectableCategories = categories.filter((c) => isSelectableExpenseCategory(c, categories));
  const expenseCategoryGroups = buildExpenseCategoryGroups(categories);
  const selectedGroup = expenseCategoryGroups.find((group) => String(group.parent.id) === String(parentId || "")) || null;
  const selectedCat = categories.find((c) => String(c.id) === String(form.category_id));
  const suggested = selectableCategories.find((c) => String(c.id) === String(data.category_id));
  const filtered = selectableCategories.filter((c) => getCategoryDisplayLabel(c, { withParents: true, allCategoriesById: categoriesById }).toLowerCase().includes(q.toLowerCase()));
  const recentCats = recent.map((id) => selectableCategories.find((c) => String(c.id) === String(id))).filter(Boolean);
  const groupLeaves = selectedGroup
    ? selectedGroup.children.flatMap((childGroup) => {
        const child = childGroup.category;
        const leaves = childGroup.leaves || [];
        if (leaves.length > 0) {
          return leaves.map((leaf) => ({ ...leaf, __sectionLabel: child.name_vi || child.name || "" }));
        }
        if (isSelectableExpenseCategory(child, categories)) return [{ ...child, __sectionLabel: null }];
        return [];
      })
    : [];

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
    <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: `1px solid ${T.primary}30`, boxShadow: `0 2px 12px ${T.primary}10` }}>
      {mode === "cash-ledger" ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { id: "expense", label: "Chuyển quỹ", bg: "#fef2f2", active: "#dc2626" },
            { id: "income", label: "Thu sổ quỹ", bg: "#ecfdf3", active: "#16a34a" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setForm((p) => ({
                ...p,
                type: item.id,
                entry_kind: item.id === "expense" ? "fund_transfer_out" : "ops",
                recipient_user_id: item.id === "expense" ? p.recipient_user_id : "",
                recipient_name: item.id === "expense" ? p.recipient_name : "",
              }))}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: T.font,
                background: form.type === item.id ? item.active : "#f1f5f1",
                color: form.type === item.id ? "#fff" : T.textMuted,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["expense", "income"].map((t) => (
            <button key={t} onClick={() => upd("type", t)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: T.font, background: form.type === t ? (t === "expense" ? "#fef2f2" : "#ecfdf3") : "#f1f5f1", color: form.type === t ? (t === "expense" ? "#dc2626" : "#16a34a") : T.textMuted }}>
              {t === "expense" ? "Chi" : "Thu"}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={lbl}>Số tiền *</div>
        <input type="number" value={form.amount} onChange={(e) => upd("amount", e.target.value)} placeholder="0" style={{ ...fld, fontSize: 18, fontWeight: 700 }} />
      </div>

      {mode !== "cash-ledger" && form.type === "expense" && (
        <div style={{ marginBottom: 10 }}>
          <div style={lbl}>Phân loại chi tiêu *</div>
          <button type="button" onClick={() => setShowPicker(true)} style={{ ...fld, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span style={{ color: selectedCat ? T.text : T.textMuted }}>{selectedCat ? getCategoryDisplayLabel(selectedCat, { withParents: true, allCategoriesById: categoriesById }) : "Chọn phân loại"}</span>
            <MIcon name="expand_more" size={18} color={T.textMuted} />
          </button>
          {selectedCat && (
            <div style={{ marginTop: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: `${selectedCat.color || T.primary}22`, color: selectedCat.color || T.primary, fontSize: 11, fontWeight: 700, border: `1px solid ${(selectedCat.color || T.primary)}33` }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: selectedCat.color || T.primary }} />
                {getCategoryDisplayLabel(selectedCat, { allCategoriesById: categoriesById })}
              </span>
              {form.suggestion_source && (
                <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted }}>
                  Gợi ý: {form.suggestion_source} · tin cậy {Math.round(Number(form.suggestion_confidence || 0) * 100)}%
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 10 }}><div style={lbl}>Mô tả</div><input value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder={mode === "cash-ledger" ? (form.type === "income" ? "Nội dung thu sổ quỹ" : "Nội dung chuyển quỹ") : "Mục đích?"} style={fld} /></div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>{mode === "cash-ledger" ? (form.type === "income" ? "Nguồn thu / người nộp" : "Người nhận quỹ *") : "Người nhận"}</div>
          {mode === "cash-ledger" && form.type === "expense" ? (
            <select
              value={form.recipient_user_id || ""}
              onChange={(e) => {
                const id = e.target.value;
                const selected = transferRecipients.find((x) => String(x.id) === String(id));
                setForm((p) => ({ ...p, recipient_user_id: id, recipient_name: selected?.full_name || "" }));
              }}
              style={{ ...fld, height: 42 }}
            >
              <option value="">Chọn người nhận quỹ</option>
              {transferRecipients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.role === "driver" ? "Lái xe" : "Quản gia"})</option>
              ))}
            </select>
          ) : (
            <input value={form.recipient_name} onChange={(e) => upd("recipient_name", e.target.value)} placeholder={mode === "cash-ledger" ? "Tên / nguồn thu" : "Tên"} style={fld} />
          )}
        </div>
        <div style={{ flex: 1 }}><div style={lbl}>Ngân hàng</div><input value={form.bank_name} onChange={(e) => upd("bank_name", e.target.value)} placeholder="Ngân hàng" style={fld} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><div style={lbl}>Tài khoản</div><input value={form.bank_account} onChange={(e) => upd("bank_account", e.target.value)} placeholder="Số" style={fld} /></div>
        <div style={{ flex: 1 }}><div style={lbl}>Mã GD</div><input value={form.transaction_code} onChange={(e) => upd("transaction_code", e.target.value)} placeholder="Mã" style={fld} /></div>
      </div>
      <div style={{ marginBottom: 14 }}><div style={lbl}>Ngày giao dịch *</div><input type="date" value={form.transaction_date} style={{ ...fld, background: "#f3f6f3", color: form.transaction_date ? T.text : T.textMuted }} disabled /><div style={{ marginTop: 4, fontSize: 10, color: T.textMuted }}>Tự động lấy từ ngày chuyển khoản trên bank slip (không cho chỉnh tay).</div></div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} disabled={loading} style={{ ...actionBtnS, flex: 1, justifyContent: "center", background: "#f1f5f1", color: T.textSec }}>Hủy</button>
        <button onClick={() => onConfirm(form)} disabled={loading || categoryMissing || recipientMissing || dateMissing} style={{ ...actionBtnS, flex: 2, justifyContent: "center", background: (loading || categoryMissing || recipientMissing || dateMissing) ? `${T.primary}80` : T.primary, color: "#fff" }}>{loading ? "Đang tạo..." : (mode === "cash-ledger" ? (form.type === "income" ? "Ghi nhận thu quỹ" : "Tạo chuyển quỹ") : "Gửi để duyệt")}</button>
      </div>

      {showPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", backdropFilter: "blur(2px)" }} onClick={() => setShowPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "76vh", background: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, overflowY: "auto", boxShadow: "0 -12px 40px rgba(0,0,0,0.14)" }}>
            <div style={{ width: 42, height: 4, borderRadius: 999, background: "#dfe7dd", margin: "2px auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 10 }}>Chọn phân loại</div>
            <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value) setParentId(null); }} placeholder="Tìm phân loại..." style={{ ...fld, marginBottom: 10, height: 40, borderRadius: 12, background: "#f8faf8" }} />

            {!q && suggested && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>Gợi ý từ OCR</div>
                <button type="button" onClick={() => selectCategory(suggested.id)} style={{ ...fld, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: `${suggested.color || T.primary}22`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon name={getCategoryIconName(suggested)} size={13} color={suggested.color || T.primary} />
                    </span>
                    <span>{suggested.name_vi || suggested.name}</span>
                  </span>
                  <span style={{ fontSize: 10, color: T.primary }}>Đề xuất</span>
                </button>
              </div>
            )}

            {!q && recentCats.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>Dùng gần đây</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {recentCats.map((c) => <button key={c.id} type="button" onClick={() => selectCategory(c.id)} style={{ ...fld, textAlign: "left", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 22, height: 22, borderRadius: 999, background: `${c.color || T.primary}22`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><MIcon name={getCategoryIconName(c)} size={13} color={c.color || T.primary} /></span><span>{c.name_vi || c.name}</span></button>)}
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>Tất cả phân loại</div>
            {!q ? (
              !selectedGroup ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {expenseCategoryGroups.map((group) => (
                    <button key={group.parent.id} type="button" onClick={() => setParentId(group.parent.id)} style={{ ...fld, textAlign: "left", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 999, background: `${group.parent.color || T.primary}22`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <MIcon name={getCategoryIconName(group.parent)} size={14} color={group.parent.color || T.primary} />
                        </span>
                        <span style={{ fontWeight: 700, color: T.text }}>{group.parent.name_vi || group.parent.name}</span>
                      </span>
                      <MIcon name="chevron_right" size={18} color={T.textMuted} />
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <button type="button" onClick={() => setParentId(null)} style={{ border: "none", background: "transparent", padding: 0, textAlign: "left", fontSize: 11, fontWeight: 700, color: T.primary, cursor: "pointer" }}>
                    ← Quay lại nhóm cha
                  </button>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
                    {selectedGroup.parent.name_vi || selectedGroup.parent.name}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {groupLeaves.map((c, idx) => {
                      const showSection = c.__sectionLabel && (idx === 0 || groupLeaves[idx - 1].__sectionLabel !== c.__sectionLabel);
                      return (
                        <div key={c.id}>
                          {showSection && <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>{c.__sectionLabel}</div>}
                          <button key={c.id} type="button" onClick={() => selectCategory(c.id)} style={{ ...fld, textAlign: "left", borderColor: String(form.category_id) === String(c.id) ? T.primary : T.border, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 22, height: 22, borderRadius: 999, background: `${c.color || T.primary}22`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              <MIcon name={getCategoryIconName(c)} size={13} color={c.color || T.primary} />
                            </span>
                            <span>{getCategoryDisplayLabel(c, { allCategoriesById: categoriesById })}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {filtered.map((c) => (
                  <button key={c.id} type="button" onClick={() => selectCategory(c.id)} style={{ ...fld, textAlign: "left", borderColor: String(form.category_id) === String(c.id) ? T.primary : T.border, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 999, background: `${c.color || T.primary}22`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon name={getCategoryIconName(c)} size={13} color={c.color || T.primary} />
                    </span>
                    <span>{getCategoryDisplayLabel(c, { withParents: true, allCategoriesById: categoriesById })}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
          Có thể trùng lặp
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#92400e", marginBottom: 10, lineHeight: 1.5 }}>
        Tìm thấy {dupes.length} giao dịch tương tự với cùng số tiền gần ngày này.
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
          Hủy
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
          Vẫn tạo
        </button>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin } from "../../../lib/api-auth";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OCR_PHASE2_FALLBACK_ENABLED = String(process.env.OCR_PHASE2_FALLBACK_ENABLED || "true") === "true";
const OCR_CANARY_PERCENT = Math.max(0, Math.min(100, Number(process.env.OCR_CANARY_PERCENT || 100)));

const SYSTEM_PROMPT = `You are a Vietnamese bank transfer slip OCR system.
Analyze the image of a bank transfer confirmation/receipt and extract structured data.

Extract these fields:
- amount: number (just the number, no currency symbol, no commas)
- currency: string (usually "VND")
- recipient_name: string (the person or company receiving money)
- bank_name: string (the bank processing the transfer, e.g. Techcombank, MB Bank, Vietcombank)
- bank_account: string (account number if visible)
- description: string (the transfer note/message, "Lời nhắn" or "Nội dung")
- transaction_date: string (MUST be YYYY-MM-DD if any date exists on slip; check fields like "Transfer date", "Ngày giao dịch", "Ngày chuyển khoản")
- transaction_code: string (mã giao dịch)
- suggested_category: string (one of: food, utilities, household, delivery, transport, entertainment, salary, pr, maintenance, travel, kitchen, subscription, other)

If a field is not visible or unclear, set it to null.
For suggested_category, infer from the description/recipient:
- Food-related (trái cây, thịt, rau, thực phẩm, market) → "food"
- Electricity, water, gas, internet → "utilities"
- Home items, furniture → "household"
- Food delivery (GrabFood, ShopeeFood) → "delivery"
- Fuel, parking, toll → "transport"
- Restaurant, entertainment, gifts → "entertainment"
- Salary, wages → "salary"
- Kitchen ingredients, cooking supplies → "kitchen"
- Other → "other"

Return ONLY valid JSON, no markdown, no explanation.`;

const TEMPLATE_PROMPT = (bankName) => `You are a Vietnamese bank transfer slip OCR specialist.
This is a ${bankName} bank transfer slip.

Extract ONLY these fields (return JSON):
- amount: number (digits only, no commas or symbols)
- recipient_name: string
- bank_account: string
- description: string (Lời nhắn or Nội dung field)
- transaction_date: string (MUST be YYYY-MM-DD if any date exists on slip; check labels like "Transfer date", "Ngày giao dịch", "Ngày chuyển khoản")
- transaction_code: string (mã giao dịch)

Return ONLY valid JSON, no markdown.`;

/**
 * Normalize a bank name to a consistent identifier
 * e.g. "Techcombank" → "techcombank", "MB Bank" → "mbbank"
 */
function normalizeBankIdentifier(bankName) {
  if (!bankName) return null;
  return bankName
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTransactionDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Already ISO-like
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (dmy) {
    const d = String(Number(dmy[1])).padStart(2, "0");
    const m = String(Number(dmy[2])).padStart(2, "0");
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (y >= 2000 && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // English month format: "15 Mar 2026 at 10:35 PM"
  const monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
  };
  const en = raw.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (en) {
    const d = String(Number(en[1])).padStart(2, "0");
    const mKey = en[2].toLowerCase().slice(0, 4).replace(/\.$/, "").slice(0, 3);
    const m = monthMap[mKey];
    const y = en[3];
    if (m) return `${y}-${m}-${d}`;
  }

  // Last fallback: Date parser
  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, "0");
    const d = String(fallback.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function normalizeTransactionCode(value) {
  if (!value) return null;
  return String(value).trim().replace(/\s+/g, "");
}

function hasCoreFields(parsed) {
  return !!(parsed?.amount && parsed?.transaction_date && parsed?.transaction_code);
}

function hashPercent(input = "") {
  const s = String(input || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

function isUserInCanary(userId) {
  if (OCR_CANARY_PERCENT >= 100) return true;
  if (OCR_CANARY_PERCENT <= 0) return false;
  return hashPercent(userId || "anonymous") < OCR_CANARY_PERCENT;
}

async function runOcrExtraction({ imageBase64, imageMimeType, systemPrompt, shortPromptMode = false }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: shortPromptMode
                ? "Extract data from this bank slip:"
                : "Extract all information from this Vietnamese bank transfer slip:",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: shortPromptMode ? 300 : 500,
      temperature: 0,
    }),
  });

  const raw = await response.text();
  let parsedJson = null;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    // keep raw text in upstream handling
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: parsedJson?.error?.message || raw || "OCR processing failed",
      raw,
    };
  }

  const content = parsedJson?.choices?.[0]?.message?.content || "";
  let extracted = null;
  try {
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    extracted = JSON.parse(clean);
  } catch {
    return { ok: false, status: 422, error: "Could not parse OCR result", raw: content };
  }

  return { ok: true, extracted, raw: content };
}

/**
 * Fetch or create an OCR template for a given bank
 */
async function getOrCreateTemplate(bankName, userId) {
  if (!bankName) return null;

  const bankIdentifier = normalizeBankIdentifier(bankName);
  if (!bankIdentifier) return null;

  try {
    // Try to find existing template
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from("ocr_templates")
      .select("*")
      .eq("bank_identifier", bankIdentifier)
      .maybeSingle();

    if (selectErr) {
      console.error("Error fetching template:", selectErr);
      return null;
    }

    if (existing) {
      return existing;
    }

    // No template exists, will be created after successful extraction
    return null;
  } catch (err) {
    console.error("Error in getOrCreateTemplate:", err);
    return null;
  }
}

/**
 * Save a new template after successful extraction
 */
async function saveTemplate(bankName, userId, extractedData) {
  const bankIdentifier = normalizeBankIdentifier(bankName);
  if (!bankIdentifier) return;

  try {
    // Check if template already exists
    const { data: existing } = await supabaseAdmin
      .from("ocr_templates")
      .select("id, extraction_count")
      .eq("bank_identifier", bankIdentifier)
      .maybeSingle();

    if (existing) {
      // Update existing template
      await supabaseAdmin
        .from("ocr_templates")
        .update({
          extraction_count: (existing.extraction_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Insert new template
      await supabaseAdmin.from("ocr_templates").insert({
        bank_name: bankName,
        bank_identifier: bankIdentifier,
        sample_extraction: extractedData,
        extraction_count: 1,
        last_used_at: new Date().toISOString(),
        created_by: userId,
      });
    }
  } catch (err) {
    console.error("Error saving template:", err);
  }
}

async function logOcrRun(payload) {
  try {
    await supabaseAdmin.from("ocr_runs").insert(payload);
  } catch (err) {
    console.warn("ocr_runs insert failed:", err?.message || err);
  }
}

export async function POST(request) {
  const startedAt = Date.now();
  if (!OPENAI_API_KEY) {
    await logOcrRun({
      success: false,
      error_type: "config_missing",
      error_message: "OpenAI API key not configured",
      latency_ms: Date.now() - startedAt,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    // AUTH CHECK
    const auth = await resolveUser(request, { requireProfile: false });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user } = auth;
    const userInCanary = isUserInCanary(user?.id);
    const phase2FallbackEnabled = OCR_PHASE2_FALLBACK_ENABLED && userInCanary;

    const { imageBase64, imageMimeType, templateHint } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Determine which prompt to use — first do a full scan to identify the bank
    let systemPrompt = SYSTEM_PROMPT;
    let template = null;

    if (templateHint) {
      // If a template hint is provided, try to use optimized prompt
      template = await getOrCreateTemplate(templateHint, user.id);
      if (template) {
        systemPrompt = TEMPLATE_PROMPT(templateHint);
      }
    }

    const firstPass = await runOcrExtraction({
      imageBase64,
      imageMimeType,
      systemPrompt,
      shortPromptMode: !!templateHint,
    });

    if (!firstPass.ok) {
      console.error("OpenAI error:", firstPass.error);
      await logOcrRun({
        user_id: user?.id || null,
        role: auth?.profile?.role || null,
        success: false,
        bank_identifier: templateHint ? normalizeBankIdentifier(templateHint) : null,
        template_used: !!templateHint,
        phase2_fallback_enabled: phase2FallbackEnabled,
        canary_percent: OCR_CANARY_PERCENT,
        error_type: firstPass.status === 422 ? "parse_error" : "upstream_ocr_error",
        error_message: String(firstPass.error || "OCR processing failed").slice(0, 500),
        latency_ms: Date.now() - startedAt,
        created_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: firstPass.status === 422 ? "Could not parse OCR result" : "OCR processing failed", raw: firstPass.raw },
        { status: firstPass.status >= 400 ? firstPass.status : 500 }
      );
    }

    let parsed = firstPass.extracted || {};
    parsed.transaction_date = normalizeTransactionDate(parsed.transaction_date);
    parsed.transaction_code = normalizeTransactionCode(parsed.transaction_code);

    // Phase 2: fallback from template mode to full mode when core fields are missing
    let fallbackUsed = false;
    if (phase2FallbackEnabled && !!templateHint && !hasCoreFields(parsed)) {
      const secondPass = await runOcrExtraction({
        imageBase64,
        imageMimeType,
        systemPrompt: SYSTEM_PROMPT,
        shortPromptMode: false,
      });
      if (secondPass.ok) {
        const merged = secondPass.extracted || {};
        merged.transaction_date = normalizeTransactionDate(merged.transaction_date);
        merged.transaction_code = normalizeTransactionCode(merged.transaction_code);
        if (hasCoreFields(merged)) {
          parsed = merged;
          fallbackUsed = true;
        }
      }
    }

    // After successful extraction, save or update template if bank was identified
    const bankName = parsed.bank_name;
    if (bankName && !template) {
      await saveTemplate(bankName, user.id, parsed);
    }

    const bankIdentifier = bankName ? normalizeBankIdentifier(bankName) : null;
    const templateMatched = !!template;

    await logOcrRun({
      user_id: user?.id || null,
      role: auth?.profile?.role || null,
      success: true,
      bank_identifier: bankIdentifier,
      template_used: templateMatched && !fallbackUsed,
      phase2_fallback_enabled: phase2FallbackEnabled,
      canary_percent: OCR_CANARY_PERCENT,
      amount_found: !!parsed?.amount,
      date_found: !!parsed?.transaction_date,
      code_found: !!parsed?.transaction_code,
      latency_ms: Date.now() - startedAt,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: parsed,
      templateMatched,
      bankIdentifier,
      fallbackUsed,
    });
  } catch (err) {
    console.error("OCR route error:", err);
    await logOcrRun({
      success: false,
      phase2_fallback_enabled: OCR_PHASE2_FALLBACK_ENABLED,
      canary_percent: OCR_CANARY_PERCENT,
      error_type: "route_error",
      error_message: String(err?.message || err).slice(0, 500),
      latency_ms: Date.now() - startedAt,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}

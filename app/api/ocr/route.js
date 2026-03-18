import { NextResponse } from "next/server";
import { resolveUser, supabaseAdmin } from "../../../lib/api-auth";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

export async function POST(request) {
  if (!OPENAI_API_KEY) {
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: templateHint
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
        max_tokens: templateHint ? 300 : 500,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", err);
      return NextResponse.json(
        { error: "OCR processing failed" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON response, handling possible markdown wrapping
    let parsed;
    try {
      const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse OCR result:", content);
      return NextResponse.json(
        { error: "Could not parse OCR result", raw: content },
        { status: 422 }
      );
    }

    // Normalize transaction date aggressively (critical for downstream logic)
    parsed.transaction_date = normalizeTransactionDate(parsed.transaction_date);

    // After successful extraction, save or update template if bank was identified
    const bankName = parsed.bank_name;
    if (bankName && !template) {
      await saveTemplate(bankName, user.id, parsed);
    }

    const bankIdentifier = bankName ? normalizeBankIdentifier(bankName) : null;
    const templateMatched = !!template;

    return NextResponse.json({
      success: true,
      data: parsed,
      templateMatched,
      bankIdentifier,
    });
  } catch (err) {
    console.error("OCR route error:", err);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}

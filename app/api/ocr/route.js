import { NextResponse } from "next/server";

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
- transaction_date: string (ISO format YYYY-MM-DD if possible, or original text)
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

export async function POST(request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { imageBase64, imageMimeType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
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
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all information from this Vietnamese bank transfer slip:",
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
        max_tokens: 500,
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

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("OCR route error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

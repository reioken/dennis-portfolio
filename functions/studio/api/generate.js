const SYSTEM = `You are FloorDirekt's senior merchandising + creative lead for shop product images
(overlay cards on real product photos). Write German overlay copy.

Return ONLY valid JSON. No markdown fences.

Schema:
{
  "texts": {
    "kicker": "short German kicker (product line / use case)",
    "headline": "short German headline (benefit-led, overlay-safe)",
    "subline": "short German subline (proof / detail)"
  },
  "pills": ["benefit chip 1", "benefit chip 2"],
  "glossary": ["BrandOrModelToken", "..."]
}

Rules:
- German only for texts + pills
- headline REQUIRED; max ~6 words; no exclamation spam
- subline optional but preferred; max ~12 words
- kicker short uppercase-friendly label
- pills: exactly 2 crisp benefit chips when possible (max 3 words each)
- glossary: proper nouns / model names that must NOT be translated later
- Prefer FloorDirekt voice: practical, clean, trustworthy German retail
- If a product photo is attached, ground advantages in what is visible
- Do not invent fake test scores or prices`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = String(env.OPENAI_API_KEY || "").trim();
  if (!key) {
    return json({ error: "OPENAI_API_KEY fehlt (Cloudflare Secret)." }, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültiges JSON." }, 400);
  }

  const brand = String(body.brand || "FLOORDIREKT").trim();
  const productName = String(body.productName || "").trim();
  const imageDataUrl = String(body.imageDataUrl || "").trim();

  const userParts = [
    {
      type: "text",
      text: [
        `Brand: ${brand}`,
        productName ? `Product: ${productName}` : "Product: (unknown — infer from photo)",
        "Write overlay copy for this shop image series.",
      ].join("\n"),
    },
  ];

  if (imageDataUrl.startsWith("data:image/")) {
    userParts.push({
      type: "image_url",
      image_url: { url: imageDataUrl, detail: "low" },
    });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userParts },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return json(
      { error: "OpenAI-Fehler", detail: raw.slice(0, 500) },
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  let parsed;
  try {
    const payload = JSON.parse(raw);
    const content = payload.choices?.[0]?.message?.content || "{}";
    parsed = JSON.parse(content);
  } catch {
    return json({ error: "Antwort war kein gültiges JSON.", detail: raw.slice(0, 400) }, 502);
  }

  const texts = parsed.texts || {};
  return json({
    texts: {
      kicker: String(texts.kicker || "").trim(),
      headline: String(texts.headline || productName || "Premium Qualität").trim(),
      subline: String(texts.subline || "").trim(),
    },
    pills: Array.isArray(parsed.pills)
      ? parsed.pills.map((p) => String(p || "").trim()).filter(Boolean).slice(0, 3)
      : [],
    glossary: Array.isArray(parsed.glossary)
      ? parsed.glossary.map((g) => String(g || "").trim()).filter(Boolean)
      : [],
  });
}

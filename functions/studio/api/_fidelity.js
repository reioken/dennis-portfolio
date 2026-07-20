/**
 * Produkttreue-Pruefung fuers Browser-Studio.
 *
 * Portierung von fd_pipeline/ai_image_qa.py. Beide Wege — Desktop-App und
 * Studio — muessen dasselbe Urteil faellen, sonst haengt die Bildqualitaet
 * davon ab, wo jemand gerade arbeitet.
 *
 * Bewusst uebernommen aus der Python-Fassung:
 *   - detail "high": "low" liefert nur eine 512er Miniatur, in der
 *     Florhoehe und Webmuster verschwinden — genau die Merkmale, an denen
 *     Teppiche und Matten auseinanderlaufen.
 *   - temperature 0: dasselbe Bildpaar soll dasselbe Urteil ergeben.
 *   - Fail open: faellt die Pruefung aus, blockiert sie den Nutzer nicht,
 *     markiert das Ergebnis aber als skipped. Ein ungeprueftes Bild muss
 *     von einem geprueften unterscheidbar bleiben.
 */

export const QA_FIDELITY_THRESHOLD = 75;
export const QA_IMAGE_MAX_SIDE = 1024;
export const QA_IMAGE_QUALITY = 0.88;
export const DEFAULT_QA_MODEL = "gpt-4.1-mini";

const QA_SYSTEM = `You compare a REFERENCE product photo with a GENERATED shop/lifestyle photo.
Judge whether it is the SAME physical product (shape, color, pattern, materials).

Return ONLY JSON:
{
  "same_product": true/false,
  "score": 0-100,
  "color_match": true/false,
  "pattern_match": true/false,
  "issues": ["short English issue", "..."],
  "reason": "one short English sentence"
}

Rules:
- score 100 = identical product identity; 0 = totally different
- background/lighting/scene changes are OK and must NOT lower the score
- lower score only for product shape/color/pattern/material drift
- be strict on patterned mats, rugs, and flooring textures`;

/** Ergebnis, das den Nutzer durchlaesst, den Zustand aber offenlegt. */
function skipped(reason) {
  return {
    score: 100,
    pass: true,
    skipped: true,
    same_product: true,
    color_match: true,
    pattern_match: true,
    issues: [],
    reason,
    threshold: QA_FIDELITY_THRESHOLD,
  };
}

/**
 * Verkleinert eine data-URL auf QA_IMAGE_MAX_SIDE.
 * Kleinere Bilder bleiben unangetastet — Hochskalieren erfindet Details.
 */
async function shrinkForQa(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, QA_IMAGE_MAX_SIDE / (longest || 1));
  if (scale >= 1) {
    bitmap.close?.();
    return dataUrl;
  }
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const out = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: QA_IMAGE_QUALITY,
  });
  const buf = new Uint8Array(await out.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Leere QA-Antwort");
  try {
    return JSON.parse(raw);
  } catch {
    /* weiter unten */
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* weiter unten */
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("QA-Antwort war kein JSON");
}

/**
 * Vergleicht Referenz und Ergebnis.
 *
 * @param {string} referenceDataUrl Ausgangsfoto des Produkts
 * @param {string} generatedDataUrl KI-Ergebnis
 * @param {{apiKey: string, model?: string, threshold?: number}} options
 * @returns {Promise<object>} score, pass, skipped, issues, reason
 */
export async function assessProductFidelity(
  referenceDataUrl,
  generatedDataUrl,
  { apiKey, model, threshold = QA_FIDELITY_THRESHOLD, timeoutMs = 60000 } = {},
) {
  if (!apiKey) return skipped("QA übersprungen (kein OpenAI-Key).");
  if (!referenceDataUrl || !generatedDataUrl) {
    return {
      score: 0,
      pass: false,
      skipped: false,
      same_product: false,
      issues: ["Referenz oder Ergebnis fehlt"],
      reason: "Für den Vergleich fehlt ein Bild.",
      threshold,
    };
  }

  try {
    const [ref, gen] = await Promise.all([
      shrinkForQa(referenceDataUrl),
      shrinkForQa(generatedDataUrl),
    ]);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model || DEFAULT_QA_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: QA_SYSTEM },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Image A = REFERENCE product. Image B = GENERATED result. " +
                    "Score product identity only (ignore background).",
                },
                { type: "image_url", image_url: { url: ref, detail: "high" } },
                { type: "image_url", image_url: { url: gen, detail: "high" } },
              ],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return skipped(`QA übersprungen (API ${response.status}).`);

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const same = Boolean(parsed.same_product);
    const issues = (parsed.issues || [])
      .map((x) => String(x).trim())
      .filter(Boolean);

    return {
      score,
      pass: same && score >= threshold,
      skipped: false,
      same_product: same,
      color_match: parsed.color_match !== false,
      pattern_match: parsed.pattern_match !== false,
      issues,
      reason: String(parsed.reason || "").trim(),
      threshold,
    };
  } catch (err) {
    return skipped(`QA übersprungen (${err?.message || err}).`);
  }
}

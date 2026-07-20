const DEEPL_TARGETS = {
  en: "EN-GB",
  fr: "FR",
  it: "IT",
  es: "ES",
  pl: "PL",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeGlossary(glossary) {
  const out = [];
  const seen = new Set();
  for (const item of glossary || []) {
    const term = String(item || "").trim();
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push(term);
  }
  return out;
}

function protectGlossary(text, glossary) {
  let protectedText = String(text || "");
  const mapping = [];
  glossary.forEach((term, index) => {
    const token = `__FDG${index}__`;
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    // Avoid re.test() + /g lastIndex bug — only replace when a match exists.
    const next = protectedText.replace(re, token);
    if (next !== protectedText) {
      protectedText = next;
      mapping.push({ token, term });
    }
  });
  return { protectedText, mapping };
}

function restoreGlossary(text, mapping) {
  let out = String(text || "");
  for (const item of mapping || []) {
    const token = item.token;
    const term = item.term;
    if (!token) continue;
    const core = token.replace(/^__|__$/g, "");
    const re = new RegExp(`__\\s*${core}\\s*__`, "gi");
    out = out.replace(re, term);
  }
  return out;
}

function deeplEndpoint(apiKey) {
  return apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

async function translateBatch(apiKey, texts, targetLang) {
  const endpoint = deeplEndpoint(apiKey);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: texts,
      source_lang: "DE",
      target_lang: targetLang,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${raw.slice(0, 300)}`);
  }
  const data = JSON.parse(raw);
  return (data.translations || []).map((t) => String(t.text || ""));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = String(env.DEEPL_API_KEY || "").trim();
  if (!key) {
    return json({ error: "DEEPL_API_KEY fehlt (Cloudflare Secret)." }, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültiges JSON." }, 400);
  }

  const texts = body.texts || {};
  const pills = Array.isArray(body.pills) ? body.pills.map((p) => String(p || "")) : [];
  const glossary = normalizeGlossary(body.glossary);
  const targets = Array.isArray(body.targets) && body.targets.length
    ? body.targets.map((t) => String(t).toLowerCase())
    : ["en", "fr", "it", "es", "pl"];

  const de = {
    texts: {
      kicker: String(texts.kicker || "").trim(),
      headline: String(texts.headline || "").trim(),
      subline: String(texts.subline || "").trim(),
    },
    pills: pills.map((p) => String(p || "").trim()).filter(Boolean),
  };

  const sourceFields = [
    de.texts.kicker,
    de.texts.headline,
    de.texts.subline,
    ...de.pills,
  ];
  const protectedPack = sourceFields.map((t) => protectGlossary(t, glossary));
  const protectedTexts = protectedPack.map((p) => p.protectedText);

  const out = { de };

  for (const lang of targets) {
    const deeplLang = DEEPL_TARGETS[lang];
    if (!deeplLang) continue;
    try {
      const translated = await translateBatch(key, protectedTexts, deeplLang);
      const restored = translated.map((t, i) =>
        restoreGlossary(t, protectedPack[i].mapping),
      );
      out[lang] = {
        texts: {
          kicker: restored[0] || "",
          headline: restored[1] || de.texts.headline,
          subline: restored[2] || "",
        },
        pills: restored.slice(3).filter(Boolean),
      };
    } catch (err) {
      return json(
        { error: `Übersetzung ${lang} fehlgeschlagen`, detail: String(err.message || err) },
        502,
      );
    }
  }

  return json(out);
}

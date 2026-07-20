/** Product image edit via OpenAI Images API (gpt-image) — shop fidelity. */

const PRODUCT_LOCK = `PRODUCT IDENTITY LOCK — USE THE INPUT PRODUCT AS THE SOURCE OF TRUTH
The product shown in IMAGE 1 is the exact product that must appear in the final image. Preserve it literally: same silhouette, dimensions, proportions, edge shape, thickness, color distribution, pattern placement, weave/texture, material finish, seams, labels, logos, visible defects, and all distinctive details.

Reference priority:
1) IMAGE 1 defines the product identity and must be copied most literally.
2) Additional images of the same product are supporting evidence for angle, texture, underside, edge, or brand mark only.

Edit only the environment. Change the background, room styling, camera composition, shadows, and lighting to match the requested scene. Do not modify the product itself.

Negative constraints: no product redesign, no alternate SKU, no new pattern, no color shift, no changed proportions, no simplified texture, no invented labels, no fake text, no watermark.

If any scene instruction conflicts with product fidelity, product fidelity wins. Generate a photorealistic ecommerce image where the product is unchanged and only the scene changes.`;

const SCENES = {
  studio_white:
    "Scene: premium e-commerce studio shot on a clean seamless light/white background with soft professional lighting and a subtle natural shadow. Photorealistic, sharp, high-end catalog quality.",
  lifestyle_room:
    "Scene: photorealistic lifestyle placement in a modern European home interior. Natural daylight, believable placement, shallow depth of field on the background only. Premium catalog look.",
  lifestyle_real_home:
    "Place the unchanged product in a realistic modern home interior that matches a high-conversion furniture and home decor listing. The room should feel lived-in but uncluttered: natural daylight, real surfaces, subtle props that never cover the product.",
  detail_closeup:
    "Scene: premium close-up / macro-style framing showing surface quality, sharp focus on texture, soft studio light.",
  brand_hero_scrollstop:
    "Create a premium editorial ecommerce hero image with strong visual hierarchy and a quiet but distinctive set design. Use a warm off-white to deep neutral gradient environment, directional softbox lighting, and a scroll-stopping composition.",
  benefit_style_transform:
    "Create an aspirational room transformation image where the unchanged product is the visual anchor of the space. Use balanced composition, elevated interior styling, layered textures, and a camera angle that sells lifestyle.",
  benefit_comfort_texture:
    "Scene: lifestyle close framing that emphasizes comfort and material texture of the unchanged product, soft daylight, inviting home atmosphere.",
  scale_context:
    "Scene: show the unchanged product in clear scale context within a believable room, with furniture or architecture that communicates size without covering the product.",
};

export const SCENE_ORDER = [
  "studio_white",
  "lifestyle_room",
  "lifestyle_real_home",
  "brand_hero_scrollstop",
  "detail_closeup",
  "benefit_style_transform",
  "benefit_comfort_texture",
  "scale_context",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildPrompt({ presetId, productName, refCount, seed, stricter }) {
  const scene = SCENES[presetId] || SCENES.studio_white;
  const parts = [
    PRODUCT_LOCK,
    "FIDELITY=STRICT: Preserve every product detail exactly. Zero creative reinterpretation of the product.",
  ];
  if (refCount > 1) {
    parts.push(
      `You are given ${refCount} reference images of the SAME product (image 1 = hero; others = detail/angle). Match all of them.`,
    );
  }
  if (productName) {
    parts.push(`Product name (do not render as text in the image): ${productName}`);
  }
  parts.push(scene);
  if (stricter) {
    parts.push(
      "RETRY: Previous output drifted from the product. Copy the product from the reference images even more literally.",
    );
  }
  // Soft consistency token (OpenAI has no seed) — keeps series tone aligned
  if (seed != null) {
    parts.push(`Series consistency token: ${seed}. Keep lighting temperature and grade coherent with sibling shots.`);
  }
  return parts.join("\n\n");
}

async function dataUrlToFile(dataUrl, name) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Ungültige Bild-Referenz");
  const mime = m[1] || "image/png";
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  return new File([bin], `${name}.${ext}`, { type: mime });
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

  const refs = Array.isArray(body.refs) ? body.refs.filter((r) => String(r || "").startsWith("data:image/")) : [];
  if (!refs.length) {
    return json({ error: "Mindestens ein Referenzbild (data URL) nötig." }, 400);
  }
  // Cap payload size / refs
  const useRefs = refs.slice(0, 4);
  const presetId = String(body.presetId || "studio_white").trim();
  const productName = String(body.productName || "").trim();
  const seed = Number.isFinite(Number(body.seed)) ? Number(body.seed) : null;
  const stricter = !!body.stricter;
  const quality = body.quality === "high" ? "high" : "medium";
  const size = body.size === "2048x2048" ? "2048x2048" : "1024x1024";
  const model = String(body.model || env.OPENAI_IMAGE_MODEL || "gpt-image-2").trim();

  const prompt = buildPrompt({
    presetId,
    productName,
    refCount: useRefs.length,
    seed,
    stricter,
  });

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("quality", quality);
  form.append("size", size);
  form.append("n", "1");

  try {
    for (let i = 0; i < useRefs.length; i++) {
      const file = await dataUrlToFile(useRefs[i], `ref${i + 1}`);
      form.append("image[]", file);
    }
  } catch (err) {
    return json({ error: String(err.message || err) }, 400);
  }

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  const raw = await res.text();
  if (!res.ok) {
    return json(
      { error: "Image-Gen fehlgeschlagen", detail: raw.slice(0, 600) },
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "Ungültige OpenAI-Antwort", detail: raw.slice(0, 300) }, 502);
  }

  const item = parsed?.data?.[0] || {};
  let imageDataUrl = null;
  if (item.b64_json) {
    imageDataUrl = `data:image/png;base64,${item.b64_json}`;
  } else if (item.url) {
    try {
      const imgRes = await fetch(item.url);
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const mime = imgRes.headers.get("content-type") || "image/png";
      imageDataUrl = `data:${mime};base64,${btoa(binary)}`;
    } catch {
      return json({ error: "Bild-URL konnte nicht geladen werden." }, 502);
    }
  }

  if (!imageDataUrl) {
    return json({ error: "Keine Bilddaten in der Antwort." }, 502);
  }

  return json({
    imageDataUrl,
    presetId,
    model,
    quality,
    size,
    seed,
  });
}

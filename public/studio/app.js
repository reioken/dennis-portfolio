const API = {
  generate: "/studio/api/generate",
  translate: "/studio/api/translate",
  image: "/studio/api/image",
  logout: "/studio/api/logout",
};

const SCENE_ORDER = [
  "studio_white",
  "lifestyle_room",
  "lifestyle_real_home",
  "brand_hero_scrollstop",
  "detail_closeup",
  "benefit_style_transform",
  "benefit_comfort_texture",
  "scale_context",
];

const BRANDS = {
  FLOORDIREKT: {
    logos: { color: "/studio/assets/logos/floordirekt.png", light: null, dark: null },
    logoMaxWidth: 260, logoMaxHeight: 72, radius: 46, blur: 42, tint: 12,
    kickerSize: 31, headlineSize: 94, subtitleSize: 58,
    kickerTracking: 0.175, headlineTracking: -0.08, subtitleTracking: 0.05,
  },
  KARAT: {
    logos: {
      color: "/studio/assets/logos/karat.png",
      light: "/studio/assets/logos/karat-light.png",
      dark: "/studio/assets/logos/karat-dark.png",
    },
    logoMaxWidth: 260, logoMaxHeight: 72, radius: 28, blur: 36, tint: 8,
    kickerSize: 28, headlineSize: 90, subtitleSize: 54,
    kickerTracking: 0.12, headlineTracking: -0.04, subtitleTracking: 0.04,
  },
  MAMMUT: {
    logos: { color: "/studio/assets/logos/mammut.png", light: null, dark: null },
    logoMaxWidth: 220, logoMaxHeight: 90, radius: 40, blur: 40, tint: 10,
    kickerSize: 30, headlineSize: 92, subtitleSize: 56,
    kickerTracking: 0.14, headlineTracking: -0.06, subtitleTracking: 0.04,
  },
  OFFICE_MARSHAL: {
    logos: { color: "/studio/assets/logos/office-marshal.png", light: null, dark: null },
    logoMaxWidth: 290, logoMaxHeight: 54, radius: 36, blur: 38, tint: 10,
    kickerSize: 28, headlineSize: 88, subtitleSize: 52,
    kickerTracking: 0.16, headlineTracking: -0.05, subtitleTracking: 0.04,
  },
};

const LANGS = ["de", "en", "fr", "it", "es", "pl"];

const state = {
  refs: [],
  images: [],
  copyByLang: {},
  glossary: [],
  activeLang: "de",
  activeImageId: null,
  busy: false,
  logoCache: {},
  previewTimer: null,
  seriesSeed: null,
  lightboxOpen: false,
  bakingPreviews: false,
};

const $ = (id) => document.getElementById(id);
const status = (msg) => { $("status").textContent = msg || ""; };

function hasCopy() {
  return !!state.copyByLang.de?.texts?.headline;
}

function syncActionButtons() {
  const on = state.busy;
  const hasImages = state.images.length > 0;
  const ready = hasImages && hasCopy();
  $("btnRun").disabled = on || !hasImages;
  $("btnRegenText").disabled = on || !hasImages;
  $("btnGenImages").disabled = on || !state.refs.length;
  $("btnPng").disabled = on || !ready;
  $("btnZip").disabled = on || !ready;
  $("btnClear").disabled = on || !hasImages;
}

function setBusy(on) {
  state.busy = on;
  syncActionButtons();
}

function setStep(n) {
  const total = 3;
  $("sideCount").textContent = `${n} / ${total}`;
  $("sideFill").style.width = `${(n / total) * 100}%`;
  document.querySelectorAll(".step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("is-active", s === n);
    el.classList.toggle("is-done", s < n);
    const badge = el.querySelector(".badge");
    const hint = el.querySelector(".hint");
    if (s < n) { badge.textContent = "✓"; hint.textContent = ""; }
    else if (s === n) { badge.textContent = String(s); hint.textContent = "JETZT"; }
    else { badge.textContent = String(s); hint.textContent = ""; }
  });
  const labels = { 1: "Serie", 2: "Text", 3: "Export" };
  $("topStepHint").textContent = labels[n] || "Bereit";
}

function schedulePreview(delay = 0) {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => {
    renderGallery();
    if (state.lightboxOpen) applyToIframe($("lightboxStage")).catch(console.error);
  }, delay);
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function fetchLogoDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Logo fehlt: ${url}`);
  return fileToDataUrl(await res.blob());
}

async function recolorLogo(dataUrl, mode) {
  if (mode !== "light" && mode !== "dark") return dataUrl;
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const fill = mode === "light" ? 255 : 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    d[i] = d[i + 1] = d[i + 2] = fill;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL("image/png");
}

async function suggestLogoColor(dataUrl) {
  const img = await loadImage(dataUrl);
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.fillStyle = "#888";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const zw = Math.round(size * 0.22);
  const zh = Math.round(size * 0.14);
  const data = ctx.getImageData(8, 8, zw, zh).data;
  let sum = 0; let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n += 1;
  }
  return (n ? sum / n : 128) < 140 ? "light" : "dark";
}

async function resolveLogoDataUrl(brandKey, logoColor, imageDataUrl) {
  const brand = BRANDS[brandKey] || BRANDS.FLOORDIREKT;
  let mode = logoColor || "auto";
  if (mode === "auto") mode = imageDataUrl ? await suggestLogoColor(imageDataUrl) : "color";
  if (!["color", "light", "dark"].includes(mode)) mode = "color";
  const srcPath = brand.logos[mode] || brand.logos.color;
  const cacheKey = `${brandKey}|${mode}|${srcPath || "recolor"}`;
  if (state.logoCache[cacheKey]) return { dataUrl: state.logoCache[cacheKey], resolvedMode: mode };
  let dataUrl;
  if (brand.logos[mode]) dataUrl = await fetchLogoDataUrl(brand.logos[mode]);
  else {
    const base = await fetchLogoDataUrl(brand.logos.color);
    dataUrl = mode === "color" ? base : await recolorLogo(base, mode);
  }
  state.logoCache[cacheKey] = dataUrl;
  return { dataUrl, resolvedMode: mode };
}

async function seriesSeed(slug) {
  const data = new TextEncoder().encode(String(slug || "product"));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new DataView(hash).getUint32(0) % 2147483647;
}

function activeImage() {
  return state.images.find((i) => i.id === state.activeImageId) || state.images[0] || null;
}

function activeCopy() {
  const pack = state.copyByLang[state.activeLang] || state.copyByLang.de;
  if (!pack) return { texts: { kicker: "", headline: "", subline: "" }, pills: [] };
  return {
    texts: {
      kicker: String(pack.texts?.kicker || ""),
      headline: String(pack.texts?.headline || ""),
      subline: String(pack.texts?.subline || ""),
    },
    pills: Array.isArray(pack.pills) ? pack.pills : [],
  };
}

async function parseJsonResponse(res) {
  const raw = await res.text();
  try { return JSON.parse(raw); }
  catch {
    throw new Error(raw.trim().slice(0, 160) || `HTTP ${res.status}`);
  }
}

function resolvePillPixels(pills) {
  const size = FDPlacement?.SIZE || 2048;
  const presets = ["top-right", "top-center", "middle-right", "top-left"];
  return (pills || []).slice(0, 2).map((text, i) => {
    const rect = FDPlacement.resolveCardRect(presets[i] || "top-right", size, 360, 96);
    return { text: String(text || "").trim(), left: rect.left, top: rect.top, color: null };
  }).filter((p) => p.text);
}

function syncTextFieldsFromState() {
  const c = activeCopy().texts;
  $("kicker").value = c.kicker || "";
  $("headline").value = c.headline || "";
  $("subline").value = c.subline || "";
}

function writeTextFieldsToState() {
  if (!state.copyByLang[state.activeLang]) {
    state.copyByLang[state.activeLang] = { texts: { kicker: "", headline: "", subline: "" }, pills: [] };
  }
  state.copyByLang[state.activeLang].texts = {
    kicker: $("kicker").value.trim(),
    headline: $("headline").value.trim(),
    subline: $("subline").value.trim(),
  };
}

function syncLogoColorTabs() {
  const mode = activeImage()?.logoColor || "auto";
  document.querySelectorAll(".logo-color-tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.logo === mode);
  });
}

function updateDropCount() {
  const n = state.images.length;
  $("dropCount").textContent = n === 1 ? "1 Bild" : `${n} Bilder`;
}

function syncRefsFromSeries() {
  // KI-Gen refs = erste Uploads / Serie (max 4)
  state.refs = state.images
    .filter((i) => i.source === "upload" || i.source === "ai")
    .slice(0, 4)
    .map((i) => i.dataUrl);
  if (!state.refs.length && state.images.length) {
    state.refs = state.images.slice(0, 4).map((i) => i.dataUrl);
  }
}

async function buildConfig(img) {
  const brandKey = $("brand").value;
  const b = BRANDS[brandKey];
  const copy = activeCopy();
  const layout = img?.layout;
  const palette = layout?.palette || {
    tintColor: "#888888", borderColor: "#ffffff", borderOpacity: 0.55,
    edgeShadeColor: "#111111", hazeOpacity: 0.08, kickerColor: "#c01010",
    headlineColor: "#141418", subtitleColor: "rgba(20,20,24,0.72)",
  };
  const card = layout?.card || { left: 64, top: 2048 - 64 - 420, maxWidth: 920, padding: 52 };
  let logoDataUrl = img?.logoDataUrl || null;
  if (img) {
    const resolved = await resolveLogoDataUrl(brandKey, img.logoColor || "auto", img.dataUrl);
    logoDataUrl = resolved.dataUrl;
    img.logoDataUrl = logoDataUrl;
    img.resolvedLogoMode = resolved.resolvedMode;
  }
  return {
    size: 2048, template: "legacy", lang: state.activeLang, overlayStyle: "scandi",
    showMainCard: true, imageDataUrl: img?.dataUrl || null,
    brand: {
      radius: b.radius, blur: b.blur, tint: b.tint,
      kickerSize: b.kickerSize, headlineSize: b.headlineSize, subtitleSize: b.subtitleSize,
      kickerTracking: b.kickerTracking, headlineTracking: b.headlineTracking,
      subtitleTracking: b.subtitleTracking, headlineCh: 0, headlineLineHeight: 1.05, headlineStep: "",
    },
    palette, card,
    logo: {
      enabled: !!logoDataUrl, dataUrl: logoDataUrl,
      maxWidth: b.logoMaxWidth, maxHeight: b.logoMaxHeight,
      sizePercent: 100, offset: 64, left: 96, top: 86,
    },
    texts: {
      kicker: copy.texts.kicker || "",
      headline: copy.texts.headline || "",
      subline: copy.texts.subline || "",
    },
    badge: { text: "", headline: "", subline: "" },
    pills: resolvePillPixels(copy.pills), pillFontSize: 48,
    series: { logoOffset: 64, badgeMaxWidth: 1200, badgeForm: "pill" },
  };
}

async function applyToIframe(iframe) {
  const win = iframe?.contentWindow;
  if (!win || typeof win.__FD_APPLY__ !== "function") return false;
  const img = activeImage();
  if (!img) return false;
  win.__FD_APPLY__(await buildConfig(img));
  return true;
}

async function prepareImagePreview(img, brand) {
  if (!img.layout) img.layout = await FDPlacement.chooseLayout(img.dataUrl, brand);
  const resolved = await resolveLogoDataUrl(brand, img.logoColor || "auto", img.dataUrl);
  img.logoDataUrl = resolved.dataUrl;
  img.resolvedLogoMode = resolved.resolvedMode;
}

function renderGallery() {
  const root = $("gallery");
  const empty = $("galleryEmpty");
  root.innerHTML = "";
  if (!state.images.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  state.images.forEach((img, idx) => {
    const card = document.createElement("article");
    card.className = "gallery-card" + (img.id === state.activeImageId ? " is-active" : "");
    card.dataset.id = img.id;

    const media = document.createElement("button");
    media.type = "button";
    media.className = "gallery-media";
    media.title = "Großansicht mit Overlay";
    const pic = document.createElement("img");
    pic.src = img.previewDataUrl || img.dataUrl;
    pic.alt = img.name || `Bild ${idx + 1}`;
    media.appendChild(pic);
    if (img.generating) {
      const spin = document.createElement("div");
      spin.className = "gallery-busy";
      spin.textContent = "Generiert…";
      media.appendChild(spin);
    }
    media.addEventListener("click", () => openLightbox(img.id));

    const bar = document.createElement("div");
    bar.className = "gallery-bar";
    const label = document.createElement("span");
    label.className = "gallery-label";
    const kind = img.source === "ai" ? "KI" : "Serie";
    label.textContent = img.presetId
      ? `${kind} · ${img.presetId.replace(/_/g, " ")}`
      : `${kind} · ${img.name || `#${idx + 1}`}`;
    bar.appendChild(label);

    if (img.source === "ai") {
      const regen = document.createElement("button");
      regen.type = "button";
      regen.className = "gallery-regen";
      regen.title = "Bild neu generieren";
      regen.setAttribute("aria-label", "Bild neu generieren");
      regen.textContent = "↻";
      regen.disabled = !!img.generating || state.busy || !state.refs.length;
      regen.addEventListener("click", (e) => {
        e.stopPropagation();
        regenerateImage(img.id, true);
      });
      bar.appendChild(regen);
    }

    card.append(media, bar);
    card.addEventListener("click", (e) => {
      if (e.target.closest(".gallery-regen")) return;
      state.activeImageId = img.id;
      syncLogoColorTabs();
      renderGallery();
      syncLightboxRegen();
    });
    root.appendChild(card);
  });
}

async function shrinkRef(dataUrl, maxSide = 1280) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.88);
}

async function callImageApi({ presetId, stricter, quality }) {
  const refs = [];
  for (const r of state.refs.slice(0, 4)) {
    refs.push(await shrinkRef(r));
  }
  const res = await fetch(API.image, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refs,
      presetId,
      productName: $("productName").value.trim(),
      seed: state.seriesSeed,
      stricter: !!stricter,
      quality: quality || "medium",
      size: "1024x1024",
    }),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || data.detail || "Image-Gen fehlgeschlagen");
  return data;
}

async function generateSeriesImages() {
  if (state.busy) return;
  syncRefsFromSeries();
  if (!state.refs.length) {
    status("Bitte zuerst Fotos hochladen (als Referenz).");
    return;
  }
  setBusy(true);
  setStep(1);
  try {
    const product = $("productName").value.trim() || "product";
    state.seriesSeed = await seriesSeed(`${product}|${$("brand").value}`);
    const count = Math.max(1, Math.min(8, Number($("genCount").value) || 4));
    status(`KI-Serie (${count}) · Seed ${state.seriesSeed}…`);
    state.images = [];
    state.activeImageId = null;
    state.copyByLang = {};
    syncTextFieldsFromState();
    renderGallery();

    for (let i = 0; i < count; i++) {
      const presetId = SCENE_ORDER[i % SCENE_ORDER.length];
      status(`Bild ${i + 1}/${count}: ${presetId}…`);
      const placeholder = {
        id: `pending_${i}`,
        name: presetId,
        dataUrl: state.refs[0],
        layout: null,
        logoColor: "auto",
        generating: true,
        presetId,
        source: "ai",
      };
      state.images.push(placeholder);
      if (!state.activeImageId) state.activeImageId = placeholder.id;
      renderGallery();

      const data = await callImageApi({ presetId, stricter: false, quality: "medium" });
      const idx = state.images.findIndex((x) => x.id === placeholder.id);
      const brand = $("brand").value;
      const img = {
        id: `${Date.now()}_${i}`,
        name: presetId,
        dataUrl: data.imageDataUrl,
        layout: null,
        logoColor: "auto",
        logoDataUrl: null,
        generating: false,
        presetId,
        previewDataUrl: null,
        source: "ai",
      };
      await prepareImagePreview(img, brand);
      if (idx >= 0) state.images[idx] = img;
      else state.images.push(img);
      state.activeImageId = img.id;
      updateDropCount();
      renderGallery();
      syncLogoColorTabs();
    }
    status(`KI-Serie fertig (${state.images.length}). Starte Text…`);
    setBusy(false);
    await runSeries({ skipIfBusy: false });
  } catch (err) {
    console.error(err);
    status(String(err.message || err));
    state.images = state.images.filter((i) => !i.generating);
    renderGallery();
    setBusy(false);
  }
}

async function regenerateImage(id, stricter) {
  const img = state.images.find((i) => i.id === id);
  if (!img || img.source !== "ai") return;
  syncRefsFromSeries();
  if (!state.refs.length || state.busy) return;
  setBusy(true);
  img.generating = true;
  state.activeImageId = id;
  renderGallery();
  try {
    if (!state.seriesSeed) {
      state.seriesSeed = await seriesSeed(`${$("productName").value.trim() || "product"}|${$("brand").value}`);
    }
    const presetId = img.presetId || SCENE_ORDER[0];
    status(`Neu generieren: ${presetId}…`);
    const data = await callImageApi({ presetId, stricter: !!stricter, quality: "high" });
    img.dataUrl = data.imageDataUrl;
    img.layout = null;
    img.logoDataUrl = null;
    img.previewDataUrl = null;
    img.generating = false;
    await prepareImagePreview(img, $("brand").value);
    if (hasCopy()) await bakeOnePreview(img);
    renderGallery();
    if (state.lightboxOpen) await applyToIframe($("lightboxStage"));
    status("Bild neu generiert.");
  } catch (err) {
    console.error(err);
    img.generating = false;
    renderGallery();
    status(String(err.message || err));
  } finally {
    setBusy(false);
  }
}

function naturalSortName(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

async function addSeriesFiles(fileList, { replace = false } = {}) {
  const files = Array.from(fileList || [])
    .filter((f) => f.type.startsWith("image/"))
    .sort((a, b) => naturalSortName(a.name, b.name));
  if (!files.length) {
    status("Keine Bilder erkannt.");
    return;
  }

  if (replace || !state.images.length) {
    state.images = [];
    state.activeImageId = null;
    state.copyByLang = {};
    syncTextFieldsFromState();
  }

  const brand = $("brand").value;
  const startLen = state.images.length;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dataUrl = await fileToDataUrl(file);
    const img = {
      id: `up_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: file.name || `Bild ${startLen + i + 1}`,
      dataUrl,
      layout: null,
      logoColor: "auto",
      logoDataUrl: null,
      presetId: null,
      generating: false,
      previewDataUrl: null,
      source: "upload",
    };
    await prepareImagePreview(img, brand);
    state.images.push(img);
  }

  if (!state.activeImageId) state.activeImageId = state.images[0].id;
  syncRefsFromSeries();
  updateDropCount();
  syncLogoColorTabs();
  setStep(1);
  syncActionButtons();
  renderGallery();

  const added = files.length;
  status(`${added} Bild(er) · Serie: ${state.images.length}`);

  if ($("autoRun")?.checked) {
    await runSeries();
  } else {
    status(`${state.images.length} Bilder geladen — «Serie fertig machen» tippen.`);
  }
}

async function runSeries(opts = {}) {
  if (state.busy && opts.skipIfBusy !== false) return;
  if (!state.images.length) {
    status("Bitte zuerst eine Serie hochladen.");
    return;
  }
  setBusy(true);
  writeTextFieldsToState();
  const brand = $("brand").value;
  const productName = $("productName").value.trim();
  try {
    setStep(2);
    status("Placement & Kontrast…");
    for (let i = 0; i < state.images.length; i++) {
      const img = state.images[i];
      img.layout = null;
      img.previewDataUrl = null;
      status(`Placement ${i + 1}/${state.images.length}…`);
      await prepareImagePreview(img, brand);
    }
    renderGallery();

    status("KI schreibt Texte…");
    const vision = await FDPlacement.shrinkForVision(state.images[0].dataUrl);
    const genRes = await fetch(API.generate, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand, productName, imageDataUrl: vision }),
    });
    const gen = await parseJsonResponse(genRes);
    if (!genRes.ok) throw new Error(gen.error || gen.detail || "Text fehlgeschlagen");

    state.glossary = gen.glossary || [];
    state.copyByLang = {
      de: {
        texts: gen.texts || { kicker: "", headline: "", subline: "" },
        pills: gen.pills || [],
      },
    };
    state.activeLang = "de";
    syncTextFieldsFromState();
    document.querySelectorAll(".lang-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.lang === "de"));
    schedulePreview(0);

    status("KI übersetzt (EN/FR/IT/ES/PL)…");
    const trRes = await fetch(API.translate, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: gen.texts,
        pills: gen.pills,
        glossary: state.glossary,
        targets: ["en", "fr", "it", "es", "pl"],
      }),
    });
    const tr = await parseJsonResponse(trRes);
    if (!trRes.ok) throw new Error(tr.error || tr.detail || "Übersetzung fehlgeschlagen");
    LANGS.forEach((lang) => { if (tr[lang]) state.copyByLang[lang] = tr[lang]; });

    setStep(3);
    status("Overlay-Vorschau wird gebaut…");
    await bakeAllPreviews();
    status(`Fertig: ${state.images.length} Bilder · ${Object.keys(state.copyByLang).length} Sprachen — PNG/ZIP unten.`);
    if (state.lightboxOpen) await applyToIframe($("lightboxStage"));
  } catch (err) {
    console.error(err);
    status(String(err.message || err));
    setStep(hasCopy() ? 2 : 1);
  } finally {
    setBusy(false);
  }
}

async function regenTextOnly() {
  if (state.busy || !state.images.length) return;
  setBusy(true);
  const brand = $("brand").value;
  const productName = $("productName").value.trim();
  try {
    setStep(2);
    status("KI schreibt neue Texte…");
    const vision = await FDPlacement.shrinkForVision(state.images[0].dataUrl);
    const genRes = await fetch(API.generate, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand, productName, imageDataUrl: vision }),
    });
    const gen = await parseJsonResponse(genRes);
    if (!genRes.ok) throw new Error(gen.error || gen.detail || "Text fehlgeschlagen");

    state.glossary = gen.glossary || [];
    state.copyByLang = {
      de: {
        texts: gen.texts || { kicker: "", headline: "", subline: "" },
        pills: gen.pills || [],
      },
    };
    state.activeLang = "de";
    syncTextFieldsFromState();
    document.querySelectorAll(".lang-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.lang === "de"));

    status("Übersetzungen…");
    const trRes = await fetch(API.translate, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: gen.texts,
        pills: gen.pills,
        glossary: state.glossary,
        targets: ["en", "fr", "it", "es", "pl"],
      }),
    });
    const tr = await parseJsonResponse(trRes);
    if (!trRes.ok) throw new Error(tr.error || tr.detail || "Übersetzung fehlgeschlagen");
    LANGS.forEach((lang) => { if (tr[lang]) state.copyByLang[lang] = tr[lang]; });

    setStep(3);
    status("Overlay-Vorschau…");
    await bakeAllPreviews();
    status("Neue Texte fertig.");
    if (state.lightboxOpen) await applyToIframe($("lightboxStage"));
  } catch (err) {
    console.error(err);
    status(String(err.message || err));
  } finally {
    setBusy(false);
  }
}

function waitMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function capturePngDataUrl() {
  const iframe = $("stage");
  if (!(await applyToIframe(iframe))) {
    await waitMs(400);
    if (!(await applyToIframe(iframe))) throw new Error("Overlay nicht bereit — Seite neu laden?");
  }
  await waitMs(260);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const doc = iframe.contentDocument;
  if (!doc?.body) throw new Error("Keine Vorschau");
  return htmlToImage.toPng(doc.body, { width: 2048, height: 2048, pixelRatio: 1, cacheBust: true });
}

async function bakeOnePreview(img) {
  const prev = state.activeImageId;
  state.activeImageId = img.id;
  try {
    img.previewDataUrl = await capturePngDataUrl();
  } catch (e) {
    console.warn("preview bake failed", e);
  } finally {
    state.activeImageId = prev;
  }
}

async function bakeAllPreviews() {
  if (!hasCopy() || !state.images.length) return;
  state.bakingPreviews = true;
  const prev = state.activeImageId;
  try {
    for (let i = 0; i < state.images.length; i++) {
      status(`Vorschau ${i + 1}/${state.images.length}…`);
      await bakeOnePreview(state.images[i]);
      renderGallery();
    }
  } finally {
    state.activeImageId = prev;
    state.bakingPreviews = false;
    renderGallery();
  }
}

async function downloadPng() {
  if (!state.images.length || !hasCopy()) return;
  setBusy(true);
  try {
    status("PNG…");
    const dataUrl = await capturePngDataUrl();
    const img = activeImage();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${(img?.name || "studio").replace(/\.[^.]+$/, "")}_${state.activeLang}.png`;
    a.click();
    status("PNG gespeichert.");
  } catch (e) {
    console.error(e);
    status(String(e.message || "PNG fehlgeschlagen."));
  } finally {
    setBusy(false);
  }
}

async function downloadZipLang() {
  if (!state.images.length || !hasCopy() || typeof JSZip === "undefined") return;
  setBusy(true);
  const prevId = state.activeImageId;
  try {
    const zip = new JSZip();
    for (let i = 0; i < state.images.length; i++) {
      state.activeImageId = state.images[i].id;
      status(`PNG ${i + 1}/${state.images.length}…`);
      const dataUrl = await capturePngDataUrl();
      const base = (state.images[i].name || `img_${i + 1}`).replace(/\.[^.]+$/, "");
      zip.file(`${String(i + 1).padStart(2, "0")}_${base}_${state.activeLang}.png`, dataUrl.split(",")[1], { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `floordirekt-studio_${state.activeLang}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    status("ZIP gespeichert.");
  } catch (e) {
    console.error(e);
    status(String(e.message || "ZIP fehlgeschlagen."));
  } finally {
    state.activeImageId = prevId;
    renderGallery();
    setBusy(false);
  }
}

function clearSeries() {
  if (state.busy) return;
  state.images = [];
  state.refs = [];
  state.copyByLang = {};
  state.activeImageId = null;
  state.seriesSeed = null;
  syncTextFieldsFromState();
  updateDropCount();
  setStep(1);
  syncActionButtons();
  renderGallery();
  status("Serie geleert — neue Bilder hochladen.");
}

function syncLightboxRegen() {
  const img = activeImage();
  const btn = $("lightboxRegen");
  if (!btn) return;
  const show = img?.source === "ai";
  btn.hidden = !show;
}

function openLightbox(id) {
  state.activeImageId = id;
  state.lightboxOpen = true;
  $("lightbox").hidden = false;
  document.body.classList.add("lightbox-open");
  syncLogoColorTabs();
  renderGallery();
  updateLightboxLabel();
  syncLightboxRegen();
  applyToIframe($("lightboxStage")).catch(console.error);
}

function closeLightbox() {
  state.lightboxOpen = false;
  $("lightbox").hidden = true;
  document.body.classList.remove("lightbox-open");
}

function lightboxStep(delta) {
  if (!state.images.length) return;
  const idx = Math.max(0, state.images.findIndex((i) => i.id === state.activeImageId));
  const next = (idx + delta + state.images.length) % state.images.length;
  state.activeImageId = state.images[next].id;
  syncLogoColorTabs();
  renderGallery();
  updateLightboxLabel();
  syncLightboxRegen();
  applyToIframe($("lightboxStage")).catch(console.error);
}

function updateLightboxLabel() {
  const img = activeImage();
  const idx = state.images.findIndex((i) => i.id === img?.id);
  $("lightboxLabel").textContent = img
    ? `${idx + 1}/${state.images.length} · ${img.presetId || img.name || "Bild"}`
    : "";
}

/* Wire UI */
const dropzone = $("dropzone");
const imageInput = $("imageInput");
dropzone.addEventListener("click", () => imageInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("is-drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag"));
dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.classList.remove("is-drag");
  // Neue Auswahl = neue Serie (alte ersetzen)
  await addSeriesFiles(e.dataTransfer.files, { replace: true });
});
imageInput.addEventListener("change", async () => {
  await addSeriesFiles(imageInput.files, { replace: true });
  imageInput.value = "";
});

$("brand").addEventListener("change", async () => {
  state.logoCache = {};
  const brand = $("brand").value;
  for (const img of state.images) {
    img.logoDataUrl = null;
    img.layout = null;
    img.previewDataUrl = null;
    await prepareImagePreview(img, brand);
  }
  schedulePreview(0);
  if (hasCopy()) bakeAllPreviews().catch(console.error);
});

document.querySelectorAll(".logo-color-tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    const img = activeImage();
    if (!img) { status("Zuerst ein Bild wählen."); return; }
    img.logoColor = tab.dataset.logo;
    img.logoDataUrl = null;
    img.previewDataUrl = null;
    document.querySelectorAll(".logo-color-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
    await prepareImagePreview(img, $("brand").value);
    if (hasCopy()) await bakeOnePreview(img);
    schedulePreview(0);
    if (state.lightboxOpen) applyToIframe($("lightboxStage")).catch(console.error);
  });
});

$("btnGenImages").addEventListener("click", generateSeriesImages);
$("btnRun").addEventListener("click", () => runSeries());
$("btnRegenText").addEventListener("click", regenTextOnly);
$("btnPng").addEventListener("click", downloadPng);
$("btnZip").addEventListener("click", downloadZipLang);
$("btnClear").addEventListener("click", clearSeries);
$("btnLogout").addEventListener("click", async () => {
  await fetch(API.logout, { credentials: "same-origin" });
  location.href = "/studio/login/";
});

$("lightboxClose").addEventListener("click", closeLightbox);
$("lightboxPrev").addEventListener("click", () => lightboxStep(-1));
$("lightboxNext").addEventListener("click", () => lightboxStep(1));
$("lightboxRegen").addEventListener("click", () => {
  const img = activeImage();
  if (img?.source === "ai") regenerateImage(img.id, true);
});
$("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (!state.lightboxOpen) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lightboxStep(-1);
  if (e.key === "ArrowRight") lightboxStep(1);
});

["kicker", "headline", "subline"].forEach((id) => {
  const el = $(id);
  const sync = () => {
    writeTextFieldsToState();
    const img = activeImage();
    if (img) img.previewDataUrl = null;
    schedulePreview(0);
    if (hasCopy() && img) {
      clearTimeout(el._fdBakeT);
      el._fdBakeT = setTimeout(() => bakeOnePreview(img).then(() => renderGallery()), 400);
    }
  };
  el.addEventListener("change", sync);
  el.addEventListener("input", () => {
    clearTimeout(el._fdPreviewT);
    el._fdPreviewT = setTimeout(sync, 160);
  });
});

document.querySelectorAll(".lang-tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    writeTextFieldsToState();
    state.activeLang = tab.dataset.lang;
    document.querySelectorAll(".lang-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
    syncTextFieldsFromState();
    state.images.forEach((img) => { img.previewDataUrl = null; });
    schedulePreview(0);
    if (state.lightboxOpen) applyToIframe($("lightboxStage")).catch(console.error);
    if (hasCopy()) await bakeAllPreviews();
  });
});

$("lightboxStage").addEventListener("load", () => {
  if (state.lightboxOpen) applyToIframe($("lightboxStage")).catch(console.error);
});

setStep(1);
setBusy(false);
syncActionButtons();
renderGallery();

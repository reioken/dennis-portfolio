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
  MASTER_OF_BOARDS: {
    logos: { color: "/studio/assets/logos/master-of-boards.png", light: null, dark: null },
    logoMaxWidth: 280, logoMaxHeight: 62, radius: 34, blur: 38, tint: 10,
    kickerSize: 28, headlineSize: 90, subtitleSize: 54,
    kickerTracking: 0.15, headlineTracking: -0.05, subtitleTracking: 0.04,
  },
  // Logo liegt noch nicht vor. Ohne Datei rendert das Overlay ohne Logo,
  // statt einen kaputten Bildpfad zu ziehen.
  CASA_PURA: {
    logos: { color: null, light: null, dark: null },
    logoMaxWidth: 270, logoMaxHeight: 66, radius: 38, blur: 40, tint: 10,
    kickerSize: 28, headlineSize: 90, subtitleSize: 54,
    kickerTracking: 0.15, headlineTracking: -0.05, subtitleTracking: 0.04,
  },
};

const LANGS = ["de", "en", "fr", "it", "es", "pl"];
const LANG_FOLDERS = {
  de: "deutsch",
  en: "english",
  fr: "francais",
  it: "italiano",
  es: "espanol",
  pl: "polski",
};

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
const status = (msg) => {
  const el = $("status");
  if (el) el.textContent = msg || "";
};

function hasCopy() {
  const t = state.copyByLang.de?.texts || {};
  return !!(t.headline || t.kicker || t.subline);
}

function syncActionButtons() {
  const on = state.busy;
  const hasImages = state.images.length > 0;
  const hasRefs = state.refs.length > 0 || hasImages;
  const ready = hasImages && hasCopy();
  [
    ["btnRun", on || !hasImages],
    ["btnRegenText", on || !hasImages],
    ["btnGenImages", on || !hasRefs],
    ["btnPng", on || !ready],
    ["btnPack", on || !ready],
    ["btnPackSide", on || !ready],
    ["btnZip", on || !ready],
    ["btnClear", on || !hasImages],
  ].forEach(([id, disabled]) => {
    const el = $(id);
    if (el) el.disabled = disabled;
  });
}

function setBusy(on) {
  state.busy = on;
  syncActionButtons();
}

function setStep(n) {
  const total = 3;
  const sideCount = $("sideCount");
  const sideFill = $("sideFill");
  if (sideCount) sideCount.textContent = `${n} / ${total}`;
  if (sideFill) sideFill.style.width = `${(n / total) * 100}%`;
  document.querySelectorAll(".simple-step, .step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("is-active", s === n);
    el.classList.toggle("is-done", s < n);
  });
  const labels = {
    1: "1 · Fotos laden",
    2: "2 · Aktion läuft",
    3: "3 · Export bereit",
  };
  const hint = $("topStepHint");
  if (hint) hint.textContent = labels[n] || "Bereit";
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
  // Marke ohne hinterlegtes Logo (aktuell Casa Pura): ohne Logo weiterrendern,
  // statt fetch(null) laufen zu lassen und den Export abzubrechen.
  if (!brand.logos || !brand.logos.color) {
    return { dataUrl: null, resolvedMode: "none" };
  }
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

async function buildConfig(img, opts = {}) {
  const showLogo = opts.showLogo !== false;
  const lang = opts.lang || state.activeLang;
  const brandKey = $("brand").value;
  const b = BRANDS[brandKey];
  const pack = state.copyByLang[lang] || state.copyByLang.de || {
    texts: { kicker: "", headline: "", subline: "" },
    pills: [],
  };
  const texts = {
    kicker: String(pack.texts?.kicker || ""),
    headline: String(pack.texts?.headline || ""),
    subline: String(pack.texts?.subline || ""),
  };
  const pills = Array.isArray(pack.pills) ? pack.pills : [];
  const layout = img?.layout;
  const palette = layout?.palette || {
    tintColor: "#888888", borderColor: "#ffffff", borderOpacity: 0.55,
    edgeShadeColor: "#111111", hazeOpacity: 0.08, kickerColor: "#c01010",
    headlineColor: "#141418", subtitleColor: "rgba(20,20,24,0.72)",
  };
  const card = layout?.card || { left: 64, top: 2048 - 64 - 420, maxWidth: 920, padding: 52 };
  let logoDataUrl = img?.logoDataUrl || null;
  if (img && showLogo) {
    const resolved = await resolveLogoDataUrl(brandKey, img.logoColor || "auto", img.dataUrl);
    logoDataUrl = resolved.dataUrl;
    img.logoDataUrl = logoDataUrl;
    img.resolvedLogoMode = resolved.resolvedMode;
  }
  return {
    size: 2048, template: "legacy", lang, overlayStyle: "scandi",
    showMainCard: true, imageDataUrl: img?.dataUrl || null,
    brand: {
      radius: b.radius, blur: b.blur, tint: b.tint,
      kickerSize: b.kickerSize, headlineSize: b.headlineSize, subtitleSize: b.subtitleSize,
      kickerTracking: b.kickerTracking, headlineTracking: b.headlineTracking,
      subtitleTracking: b.subtitleTracking, headlineCh: 0, headlineLineHeight: 1.05, headlineStep: "",
    },
    palette, card,
    logo: {
      enabled: showLogo && !!logoDataUrl, dataUrl: showLogo ? logoDataUrl : null,
      maxWidth: b.logoMaxWidth, maxHeight: b.logoMaxHeight,
      sizePercent: 100, offset: 64, left: 96, top: 86,
    },
    texts,
    badge: { text: "", headline: "", subline: "" },
    pills: resolvePillPixels(pills), pillFontSize: 48,
    series: { logoOffset: 64, badgeMaxWidth: 1200, badgeForm: "pill" },
  };
}

async function applyToIframe(iframe, opts = {}) {
  const win = iframe?.contentWindow;
  if (!win || typeof win.__FD_APPLY__ !== "function") return false;
  const img = opts.img || activeImage();
  if (!img) return false;
  win.__FD_APPLY__(await buildConfig(img, opts));
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
  // Keep uploaded photos as refs even while replacing gallery with KI output
  if (!state.refs.length) syncRefsFromSeries();
  if (!state.refs.length) {
    status("Zuerst Fotos hochladen — die werden als Referenz für neue KI-Bilder genutzt.");
    return;
  }
  const refBackup = state.refs.slice(0, 4);
  setBusy(true);
  setStep(1);
  try {
    const product = $("productName").value.trim() || "product";
    state.seriesSeed = await seriesSeed(`${product}|${$("brand").value}`);
    const count = Math.max(1, Math.min(8, Number($("genCount").value) || 4));
    status(`KI-Bilder ${count}× erzeugen…`);
    state.images = [];
    state.activeImageId = null;
    state.copyByLang = {};
    state.refs = refBackup;
    syncTextFieldsFromState();
    updateDropCount();
    renderGallery();

    for (let i = 0; i < count; i++) {
      const presetId = SCENE_ORDER[i % SCENE_ORDER.length];
      status(`KI-Bild ${i + 1}/${count}…`);
      const placeholder = {
        id: `pending_${i}`,
        name: presetId,
        dataUrl: refBackup[0],
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
      state.refs = refBackup;
      updateDropCount();
      renderGallery();
      syncLogoColorTabs();
    }
    status(`KI-Bilder fertig (${state.images.length}) — jetzt Text + Overlay…`);
    setBusy(false);
    await runSeries({ skipIfBusy: false });
  } catch (err) {
    console.error(err);
    const msg = String(err.message || err);
    status(/timeout|524|502|503|Image-Gen/i.test(msg)
      ? `KI-Bilder fehlgeschlagen (Timeout/API). Weniger Anzahl oder «Text auf eigene Bilder» nutzen. ${msg.slice(0, 80)}`
      : msg);
    state.refs = refBackup;
    state.images = state.images.filter((i) => !i.generating);
    updateDropCount();
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

  status(`${state.images.length} Bilder geladen → jetzt Aktion wählen (rot oder gelb).`);
}

async function runSeries(opts = {}) {
  if (state.busy && opts.skipIfBusy !== false) return;
  if (!state.images.length) {
    status("Zuerst Fotos laden, dann den roten Button tippen.");
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
    status(`Fertig: ${state.images.length} Bilder · ${Object.keys(state.copyByLang).length} Sprachen — jetzt Pack laden.`);
    if (state.lightboxOpen) await applyToIframe($("lightboxStage"));
  } catch (err) {
    console.error(err);
    const msg = String(err.message || err);
    status(/timeout|524|502|503/i.test(msg)
      ? "Server-Timeout — weniger Bilder oder nochmal versuchen."
      : msg);
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

async function waitForOverlay(iframe, tries = 50) {
  for (let i = 0; i < tries; i++) {
    const win = iframe?.contentWindow;
    if (win && typeof win.__FD_APPLY__ === "function") return true;
    await waitMs(100);
  }
  return false;
}

async function capturePngDataUrl(opts = {}) {
  const iframe = $("stage");
  if (!(await waitForOverlay(iframe))) {
    throw new Error("Overlay nicht bereit — Seite neu laden?");
  }
  let applied = await applyToIframe(iframe, opts);
  if (!applied) {
    await waitMs(350);
    applied = await applyToIframe(iframe, opts);
  }
  if (!applied) throw new Error("Overlay konnte Bild nicht setzen.");
  await waitMs(280);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const doc = iframe.contentDocument;
  if (!doc?.body) throw new Error("Keine Vorschau");
  if (typeof htmlToImage?.toPng !== "function") throw new Error("PNG-Export fehlt — Seite neu laden.");
  return htmlToImage.toPng(doc.body, { width: 2048, height: 2048, pixelRatio: 1, cacheBust: true });
}

function slugify(value, fallback = "produkt") {
  const s = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return s || fallback;
}

function packMeta() {
  const productName = $("productName").value.trim() || "produkt";
  const slug = slugify(productName, "produkt");
  const variante = slugify($("variante")?.value || "serie", "serie");
  const farbe = slugify($("farbe")?.value || "standard", "standard");
  const psdMode = document.querySelector('input[name="psdMode"]:checked')?.value || "einzeln";
  return { productName, slug, variante, farbe, psdMode };
}

function slotName(img, index) {
  const raw = String(img?.name || "").replace(/\.[^.]+$/, "");
  const cleaned = slugify(raw, "");
  if (cleaned && !cleaned.startsWith("pending") && cleaned !== "studio" && cleaned.length < 48) {
    return cleaned;
  }
  if (index === 0) return "main";
  if (index < 4) return `main-${String(index + 1).padStart(2, "0")}`;
  return String(index + 1).padStart(2, "0");
}

async function dataUrlToCanvas(dataUrl) {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

function writePsdBuffer(psd) {
  if (!window.agPsd?.writePsd) throw new Error("PSD-Engine fehlt (ag-psd).");
  const out = window.agPsd.writePsd(psd);
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

async function makeSinglePsd(dataUrl, layerName) {
  const canvas = await dataUrlToCanvas(dataUrl);
  return writePsdBuffer({
    width: canvas.width,
    height: canvas.height,
    children: [{ name: layerName || "Artwork", canvas }],
  });
}

async function makeArtworksPsd(items) {
  // items: [{ name, dataUrl }]
  const gap = 48;
  const size = 2048;
  const canvases = [];
  for (const item of items) {
    canvases.push({ name: item.name, canvas: await dataUrlToCanvas(item.dataUrl) });
  }
  const width = canvases.length * size + Math.max(0, canvases.length - 1) * gap;
  const height = size;
  const children = canvases.map((c, i) => ({
    name: c.name,
    canvas: c.canvas,
    left: i * (size + gap),
    top: 0,
  }));
  return writePsdBuffer({ width, height, children });
}

async function bakeOnePreview(img) {
  const prev = state.activeImageId;
  state.activeImageId = img.id;
  try {
    img.previewDataUrl = await capturePngDataUrl({ img, lang: state.activeLang, showLogo: true });
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

function clearFieldErrors() {
  ["productName", "farbe", "variante"].forEach((id) => $(id)?.classList.remove("is-invalid"));
}

function requirePackFields() {
  clearFieldErrors();
  const nameEl = $("productName");
  const farbeEl = $("farbe");
  if (!nameEl?.value.trim()) {
    nameEl?.classList.add("is-invalid");
    nameEl?.focus();
    status("Produktname fehlt (z. B. Gartenstuhl Mayfield).");
    return false;
  }
  if (!farbeEl?.value.trim()) {
    farbeEl?.classList.add("is-invalid");
    farbeEl?.focus();
    status("Farbe fehlt (z. B. gelb).");
    return false;
  }
  return true;
}

async function downloadPack() {
  if (state.busy) return;
  if (!state.images.length) {
    status("Zuerst Fotos laden und Text erzeugen.");
    return;
  }
  if (!hasCopy()) {
    status("Zuerst «Text auf eigene Bilder» oder KI laufen lassen.");
    return;
  }
  if (typeof JSZip === "undefined") {
    status("ZIP-Engine fehlt — Seite neu laden.");
    return;
  }
  if (!requirePackFields()) return;

  const psdReady = !!window.agPsd?.writePsd;
  if (!psdReady) {
    status("Hinweis: PSD-Engine fehlt — Pack kommt nur mit PNGs.");
  }

  writeTextFieldsToState();
  setBusy(true);
  setStep(3);
  const prevId = state.activeImageId;
  const prevLang = state.activeLang;
  const meta = packMeta();
  let psdErrors = 0;
  try {
    if (!(await waitForOverlay($("stage")))) {
      throw new Error("Overlay nicht bereit — Seite neu laden?");
    }
    const zip = new JSZip();
    const root = `${meta.slug}/${meta.variante}/${meta.farbe}`;
    zip.file(
      `${meta.slug}/README.txt`,
      [
        `Floordirekt Studio Pack`,
        `Produkt: ${meta.productName}`,
        `Slug: ${meta.slug}`,
        `Variante: ${meta.variante}`,
        `Farbe: ${meta.farbe}`,
        `PSD: ${psdReady ? meta.psdMode : "übersprungen (Engine fehlte)"}`,
        ``,
        `Struktur:`,
        `  ${meta.slug}/${meta.variante}/${meta.farbe}/{sprache}/`,
        `    ${meta.slug}-${meta.farbe}-{slot}.png`,
        `    no-logo/${meta.slug}-${meta.farbe}-no-logo-{slot}.png`,
        `    PSD einzeln oder *-artworks.psd`,
        ``,
        `Sprachen: deutsch, english, francais, italiano, espanol, polski`,
      ].join("\n"),
    );

    const langs = LANGS.filter((l) => state.copyByLang[l]);
    if (!langs.length) throw new Error("Keine Texte vorhanden.");

    for (let li = 0; li < langs.length; li++) {
      const lang = langs[li];
      const langFolder = LANG_FOLDERS[lang] || lang;
      const baseDir = `${root}/${langFolder}`;
      const artworkItems = [];
      state.activeLang = lang;

      for (let i = 0; i < state.images.length; i++) {
        const img = state.images[i];
        const slot = slotName(img, i);
        state.activeImageId = img.id;
        status(`Pack ${langFolder} (${li + 1}/${langs.length}): Bild ${i + 1}/${state.images.length}…`);
        const withLogo = await capturePngDataUrl({ img, lang, showLogo: true });
        const noLogo = await capturePngDataUrl({ img, lang, showLogo: false });

        zip.file(`${baseDir}/${meta.slug}-${meta.farbe}-${slot}.png`, withLogo.split(",")[1], { base64: true });
        zip.file(`${baseDir}/no-logo/${meta.slug}-${meta.farbe}-no-logo-${slot}.png`, noLogo.split(",")[1], { base64: true });

        if (psdReady && meta.psdMode === "einzeln") {
          try {
            const psd = await makeSinglePsd(withLogo, slot);
            zip.file(`${baseDir}/${meta.slug}-${meta.farbe}-${slot}.psd`, psd);
          } catch (err) {
            console.warn("psd single failed", err);
            psdErrors += 1;
          }
        } else if (psdReady) {
          artworkItems.push({ name: slot, dataUrl: withLogo });
        }
      }

      if (psdReady && meta.psdMode === "artworks" && artworkItems.length) {
        try {
          status(`Pack ${langFolder}: Artworks-PSD…`);
          const psd = await makeArtworksPsd(artworkItems);
          zip.file(`${baseDir}/${meta.slug}-${meta.farbe}-${langFolder}-artworks.psd`, psd);
        } catch (err) {
          console.warn("psd artworks failed", err);
          psdErrors += 1;
        }
      }
    }

    status("ZIP wird gebaut…");
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${meta.slug}-${meta.variante}-${meta.farbe}-pack.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    status(
      psdErrors
        ? `Pack fertig (PNG ok, ${psdErrors} PSD-Fehler): ${meta.slug}/${meta.variante}/${meta.farbe}/`
        : `Pack fertig: ${meta.slug}/${meta.variante}/${meta.farbe}/…`,
    );
    setStep(3);
  } catch (e) {
    console.error(e);
    status(String(e.message || "Pack fehlgeschlagen."));
  } finally {
    state.activeImageId = prevId;
    state.activeLang = prevLang;
    syncTextFieldsFromState();
    document.querySelectorAll(".lang-tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.lang === state.activeLang);
    });
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
["btnPack", "btnPackSide", "btnZip"].forEach((id) => {
  $(id)?.addEventListener("click", downloadPack);
});
$("btnClear").addEventListener("click", clearSeries);
["productName", "farbe"].forEach((id) => {
  $(id)?.addEventListener("input", () => $(id)?.classList.remove("is-invalid"));
});
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
    if (state.busy) return;
    writeTextFieldsToState();
    state.activeLang = tab.dataset.lang;
    document.querySelectorAll(".lang-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
    syncTextFieldsFromState();
    state.images.forEach((img) => { img.previewDataUrl = null; });
    schedulePreview(0);
    if (state.lightboxOpen) applyToIframe($("lightboxStage")).catch(console.error);
    if (hasCopy()) {
      setBusy(true);
      try {
        status(`Vorschau ${state.activeLang.toUpperCase()}…`);
        await bakeAllPreviews();
        status(`Sprache ${state.activeLang.toUpperCase()} aktiv.`);
      } finally {
        setBusy(false);
      }
    }
  });
});

$("lightboxStage").addEventListener("load", () => {
  if (state.lightboxOpen) applyToIframe($("lightboxStage")).catch(console.error);
});
$("stage")?.addEventListener("load", () => {
  // Overlay renderer bereit für Export/Pack
});

setStep(1);
setBusy(false);
syncActionButtons();
renderGallery();
status(
  window.agPsd?.writePsd
    ? "1 Fotos · 2 Aktion · 3 Pack laden"
    : "1 Fotos · 2 Aktion · 3 Pack (PSD-Engine lädt ggf. noch…)",
);
// Falls ag-psd verzögert da ist
setTimeout(() => syncActionButtons(), 0);

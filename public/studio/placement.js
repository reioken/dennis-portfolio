/** Smart card placement + glass palette (port of placement.py / contrast.py). */
(function (global) {
  const SIZE = 2048;
  const CARD_W = 920;
  const CARD_H = 420;
  const LOGO_ZONE = { left: 0, top: 0, width: 400, height: 240 };

  const POSITION_PRESETS = {
    "top-left": { x: 64, y: 248, anchor: "top-left" },
    "top-center": { x: 0.5, y: 248, anchor: "top-center" },
    "top-right": { x: -64, y: 248, anchor: "top-right" },
    "middle-left": { x: 64, y: 0.5, anchor: "middle-left" },
    "middle-right": { x: -64, y: 0.5, anchor: "middle-right" },
    "bottom-left": { x: 64, y: -64, anchor: "bottom-left" },
    "bottom-center": { x: 0.5, y: -64, anchor: "bottom-center" },
    "bottom-right": { x: -64, y: -64, anchor: "bottom-right" },
  };

  const BRAND_PALETTE = {
    FLOORDIREKT: {
      mode: "auto",
      tintHex: "#888888",
      edgeHex: null,
      shadeHex: "#111111",
      hazeDark: 2,
      hazeLight: 3,
      edgeDark: 62,
      edgeLight: 72,
      headlineLight: "#FBFAF7",
      headlineDark: "#1C201E",
      subtitleLight: "#F1EFE8",
      subtitleDark: "#343A36",
      kickerLight: "#FFFFFF",
      kickerDark: "#29302C",
    },
    KARAT: {
      mode: "dark",
      tintHex: "#806A45",
      edgeHex: "#E8D3A5",
      shadeHex: "#2B2218",
      hazeDark: 4,
      hazeLight: 4,
      edgeDark: 78,
      edgeLight: 78,
      headlineLight: "#FFF8E8",
      headlineDark: "#2A2118",
      subtitleLight: "#E9DFC9",
      subtitleDark: "#4A3B28",
      kickerLight: "#D9B96F",
      kickerDark: "#9B722D",
    },
    MAMMUT: {
      mode: "dark",
      tintHex: "#3D4240",
      edgeHex: "#C6CCC8",
      shadeHex: "#111514",
      hazeDark: 2,
      hazeLight: 2,
      edgeDark: 82,
      edgeLight: 82,
      headlineLight: "#F4F6F4",
      headlineDark: "#171B19",
      subtitleLight: "#CDD2CF",
      subtitleDark: "#343A37",
      kickerLight: "#E33A3F",
      kickerDark: "#C8161D",
    },
    OFFICE_MARSHAL: {
      mode: "auto",
      tintHex: "#526273",
      edgeHex: "#E1E8EF",
      shadeHex: "#202A33",
      hazeDark: 3,
      hazeLight: 4,
      edgeDark: 70,
      edgeLight: 76,
      headlineLight: "#F8FAFC",
      headlineDark: "#17212A",
      subtitleLight: "#DDE4EA",
      subtitleDark: "#394852",
      kickerLight: "#E15A5F",
      kickerDark: "#B9232B",
    },
  };

  function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function isBackgroundPixel(r, g, b) {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const brightness = (r + g + b) / 3;
    const sat = (mx - mn) / (mx + 1e-6);
    if (brightness > 235 && sat < 0.12) return true;
    if (brightness > 210 && sat < 0.06) return true;
    if (r > 245 && g > 245 && b > 245) return true;
    return false;
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function drawSquareCanvas(img, size) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, size, size);
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return { canvas, ctx };
  }

  function resolveCardRect(positionKey, size, cardWidth, cardHeight) {
    const preset = POSITION_PRESETS[positionKey] || POSITION_PRESETS["bottom-left"];
    const { x, y, anchor } = preset;
    let left;
    let top;
    if (anchor === "top-center") {
      left = Math.round((size - cardWidth) / 2);
      top = y < 0 ? size + y : y;
    } else if (anchor === "bottom-center") {
      left = Math.round((size - cardWidth) / 2);
      top = size + y - cardHeight;
    } else if (anchor === "middle-left") {
      left = x;
      top = Math.round((size - cardHeight) / 2);
    } else if (anchor === "middle-right") {
      left = size + x - cardWidth;
      top = Math.round((size - cardHeight) / 2);
    } else if (anchor === "top-right") {
      left = size + x - cardWidth;
      top = y;
    } else if (anchor === "bottom-right") {
      left = size + x - cardWidth;
      top = size + y - cardHeight;
    } else if (anchor === "top-left") {
      left = x;
      top = y;
    } else {
      left = x;
      top = size + y - cardHeight;
    }
    left = Math.max(0, Math.min(size - cardWidth, Math.round(left)));
    top = Math.max(0, Math.min(size - cardHeight, Math.round(top)));
    return { left, top, width: cardWidth, height: cardHeight };
  }

  function overlapArea(a, b) {
    const ax2 = a.left + a.width;
    const ay2 = a.top + a.height;
    const bx2 = b.left + b.width;
    const by2 = b.top + b.height;
    const ix1 = Math.max(a.left, b.left);
    const iy1 = Math.max(a.top, b.top);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    if (ix2 <= ix1 || iy2 <= iy1) return 0;
    return (ix2 - ix1) * (iy2 - iy1);
  }

  function overlapRatio(a, b) {
    return overlapArea(a, b) / Math.max(1, a.width * a.height);
  }

  function buildSubjectMask(ctx, size, grid = 48) {
    const cell = Math.max(1, Math.floor(size / grid));
    const cols = Math.max(1, Math.ceil(size / cell));
    const rows = cols;
    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(ctx.canvas, 0, 0, cols, rows);
    const data = sctx.getImageData(0, 0, cols, rows).data;
    const occupancy = Array.from({ length: rows }, () => Array(cols).fill(0));
    let subjectCells = 0;
    let minX = cols;
    let minY = rows;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (isBackgroundPixel(r, g, b)) continue;
        occupancy[y][x] = 1;
        subjectCells += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    let bbox;
    if (subjectCells === 0 || maxX < 0) {
      bbox = { left: size / 4, top: size / 4, width: size / 2, height: size / 2 };
    } else {
      const left = minX * cell;
      const top = minY * cell;
      const right = Math.min(size, (maxX + 1) * cell);
      const bottom = Math.min(size, (maxY + 1) * cell);
      bbox = { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    }
    return { size, cell, cols, rows, occupancy, bbox };
  }

  function maskOverlapRatio(mask, rect) {
    const { cell, cols, rows, occupancy } = mask;
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    const x0 = Math.max(0, Math.floor(rect.left / cell));
    const y0 = Math.max(0, Math.floor(rect.top / cell));
    const x1 = Math.min(cols - 1, Math.floor((right - 1) / cell));
    const y1 = Math.min(rows - 1, Math.floor((bottom - 1) / cell));
    if (x1 < x0 || y1 < y0) return 0;
    let total = 0;
    let hit = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        total += 1;
        if (occupancy[y][x]) hit += 1;
      }
    }
    return hit / Math.max(1, total);
  }

  function sampleLuminance(ctx, rect) {
    const sw = Math.max(1, Math.floor(rect.width / 8));
    const sh = Math.max(1, Math.floor(rect.height / 8));
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.drawImage(
      ctx.canvas,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      0,
      0,
      sw,
      sh,
    );
    const data = tctx.getImageData(0, 0, sw, sh).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += luminance(data[i], data[i + 1], data[i + 2]);
      n += 1;
    }
    return n ? sum / n : 128;
  }

  function readabilityScore(lum, preferDarkGlass) {
    if (preferDarkGlass === true) return (lum - 128) / 128;
    if (preferDarkGlass === false) return (128 - lum) / 128;
    return Math.abs(lum - 128) / 128;
  }

  function scoreRect(ctx, mask, rect, preferDarkGlass) {
    const subjectHit = maskOverlapRatio(mask, rect);
    const bboxHit = overlapRatio(rect, mask.bbox);
    const logoHit = overlapRatio(rect, LOGO_ZONE);
    const lum = sampleLuminance(ctx, rect);
    const read = readabilityScore(lum, preferDarkGlass);
    let score = 0;
    score -= subjectHit * 12;
    score -= bboxHit * 4;
    score -= logoHit * 10;
    score += read * 2.5;
    return { score, lum };
  }

  function resolvePalette(brandKey, sampledLum) {
    const brand = BRAND_PALETTE[brandKey] || BRAND_PALETTE.FLOORDIREKT;
    let isDarkGlass;
    if (brand.mode === "dark") isDarkGlass = true;
    else if (brand.mode === "light") isDarkGlass = false;
    else isDarkGlass = sampledLum < 150;

    return {
      isDarkGlass,
      tintColor: brand.tintHex || "#888888",
      borderColor: brand.edgeHex || (isDarkGlass ? "#F2F2F0" : "#FFFFFF"),
      edgeShadeColor: brand.shadeHex || "#111111",
      hazeOpacity: (isDarkGlass ? brand.hazeDark : brand.hazeLight) / 100,
      borderOpacity: (isDarkGlass ? brand.edgeDark : brand.edgeLight) / 100,
      headlineColor: isDarkGlass ? brand.headlineLight : brand.headlineDark,
      subtitleColor: isDarkGlass ? brand.subtitleLight : brand.subtitleDark,
      kickerColor: isDarkGlass ? brand.kickerLight : brand.kickerDark,
    };
  }

  async function chooseLayout(dataUrl, brandKey = "FLOORDIREKT") {
    const img = await loadImage(dataUrl);
    const { canvas, ctx } = drawSquareCanvas(img, SIZE);
    const mask = buildSubjectMask(ctx, SIZE);
    const brand = BRAND_PALETTE[brandKey] || BRAND_PALETTE.FLOORDIREKT;
    let preferDark = null;
    if (brand.mode === "dark") preferDark = true;
    else if (brand.mode === "light") preferDark = false;

    let bestKey = "bottom-left";
    let bestScore = -Infinity;
    let bestLum = 128;
    let bestRect = resolveCardRect(bestKey, SIZE, CARD_W, CARD_H);

    for (const key of Object.keys(POSITION_PRESETS)) {
      const rect = resolveCardRect(key, SIZE, CARD_W, CARD_H);
      const { score, lum } = scoreRect(ctx, mask, rect, preferDark);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
        bestLum = lum;
        bestRect = rect;
      }
    }

    const palette = resolvePalette(brandKey, bestLum);
    return {
      position: bestKey,
      card: {
        left: bestRect.left,
        top: bestRect.top,
        maxWidth: CARD_W,
        padding: 52,
      },
      palette,
      score: bestScore,
    };
  }

  /** Shrink data URL for vision API (JPEG ~512). */
  async function shrinkForVision(dataUrl, maxSide = 512, quality = 0.72) {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  }

  global.FDPlacement = {
    SIZE,
    chooseLayout,
    shrinkForVision,
    resolveCardRect,
    POSITION_PRESETS,
  };
})(typeof window !== "undefined" ? window : globalThis);

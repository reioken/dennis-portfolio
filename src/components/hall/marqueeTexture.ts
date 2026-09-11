import * as THREE from 'three';

/** Print at the actual panel ratio. Letterforms are fitted uniformly, never squeezed. */
export function textTexture(text: string, color: string, opts: { aspect?: number; w?: number; h?: number; upper?: boolean; logo?: string; bg?: string; glow?: boolean } = {}) {
  const c = document.createElement('canvas');
  c.width = opts.w ?? 1536;
  c.height = opts.h ?? Math.round(c.width / Math.max(1, opts.aspect ?? 4));
  const ctx = c.getContext('2d')!, w = c.width, h = c.height;
  ctx.fillStyle = opts.bg ?? '#080b10'; ctx.fillRect(0, 0, w, h);
  const rim = Math.max(2, h * .012), pad = h * .3;
  ctx.strokeStyle = '#424953'; ctx.lineWidth = rim;
  ctx.strokeRect(rim * 2, rim * 2, w - rim * 4, h - rim * 4);
  // A single low-lit inset edge, below crisp backlit lettering.
  ctx.strokeStyle = color; ctx.globalAlpha = .28; ctx.lineWidth = rim;
  ctx.beginPath(); ctx.moveTo(pad, h - rim * 5); ctx.lineTo(w - pad, h - rim * 5); ctx.stroke(); ctx.globalAlpha = 1;
  const label = (opts.upper === false ? text : text.toUpperCase()).split(' – ')[0];
  let size = h * .48;
  const setFont = () => { ctx.font = `600 ${size}px "Outfit Variable", Outfit, sans-serif`; ctx.letterSpacing = `${size * .065}px`; };
  setFont();
  while (ctx.measureText(label).width > w - pad * 2 && size > 12) { size -= 1; setFont(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(label);
  const y = h / 2 + ((metrics.actualBoundingBoxAscent || size * .72) - (metrics.actualBoundingBoxDescent || 0)) / 2;
  ctx.shadowColor = color; ctx.shadowBlur = size * .075;
  ctx.fillStyle = '#e9e9e3'; ctx.fillText(label, w / 2, y); ctx.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

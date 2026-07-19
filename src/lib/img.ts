/** AVIF-Kaskade: .webp/.jpg → .avif (Geschwister werden von scripts/build-avif.mjs erzeugt). */
export function toAvif(src: string): string | undefined {
  if (!/\.(webp|jpe?g)$/i.test(src)) return undefined;
  return src.replace(/\.(webp|jpe?g)$/i, '.avif');
}

/** Ganze srcset-Strings umschreiben ("a.webp 1x, b.webp 2x" → AVIF-Varianten). */
export function toAvifSrcSet(srcSet: string): string | undefined {
  if (!/\.(webp|jpe?g)/i.test(srcSet)) return undefined;
  return srcSet.replace(/\.(webp|jpe?g)(?=\s|,|$)/gi, '.avif');
}

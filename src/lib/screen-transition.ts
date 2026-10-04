/** Bounds of the actual pixels inside an object-fit: contain image. */
export function screenImageRect(image: HTMLImageElement): DOMRect {
  const box = image.getBoundingClientRect();
  const css = getComputedStyle(image);
  const left = parseFloat(css.paddingLeft) || 0, right = parseFloat(css.paddingRight) || 0;
  const top = parseFloat(css.paddingTop) || 0, bottom = parseFloat(css.paddingBottom) || 0;
  const width = Math.max(0, box.width - left - right), height = Math.max(0, box.height - top - bottom);
  const scale = Math.min(width / (image.naturalWidth || width), height / (image.naturalHeight || height));
  const w = (image.naturalWidth || width) * scale, h = (image.naturalHeight || height) * scale;
  return new DOMRect(box.x + left + (width - w) / 2, box.y + top + (height - h) / 2, w, h);
}

/** A short-lived image in the same top layer as its viewer; no canvas or extra asset. */
export function travelScreen(image: HTMLImageElement, from: DOMRect, to: DOMRect, host: HTMLElement, reduce = false) {
  if (reduce || !from.width || !from.height || !to.width || !to.height) return { cancel() {}, finished: Promise.resolve() };
  const ghost = document.createElement('img');
  ghost.src = image.currentSrc || image.src;
  ghost.alt = '';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.className = 'screen-travel';
  Object.assign(ghost.style, {
    position: 'fixed', left: '0', top: '0', width: `${to.width}px`, height: `${to.height}px`,
    maxWidth: 'none', maxHeight: 'none', margin: '0', padding: '0', objectFit: 'contain',
    zIndex: '120', pointerEvents: 'none', transformOrigin: '0 0', borderRadius: '0',
  });
  const visibility = image.style.visibility;
  image.style.visibility = 'hidden';
  host.append(ghost);
  const animation = ghost.animate([
    { transform: `translate(${from.x}px,${from.y}px) scale(${from.width / to.width},${from.height / to.height})` },
    { transform: `translate(${to.x}px,${to.y}px) scale(1)` },
  ], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
  let cleaned = false;
  const clean = () => { if (cleaned) return; cleaned = true; ghost.remove(); image.style.visibility = visibility; };
  return { cancel() { animation.cancel(); clean(); }, finished: animation.finished.catch(() => {}).then(clean) };
}

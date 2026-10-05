/**
 * Keyboard focus never parks under the fixed header or a sticky bar (the exhibition's station selector, About's
 * section row): after the browser has scrolled a focused element into view, it is moved just below whatever covers
 * its top edge (WCAG 2.4.11). Only focus is affected; anchor targets keep their own scroll margins.
 */
function stickyAncestor(node: Element | null): HTMLElement | null {
  for (let el = node as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    const position = getComputedStyle(el).position;
    if (position === 'fixed' || position === 'sticky') return el;
  }
  return null;
}

function scroller(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/** html.is-zoomed while the page is pinch-zoomed: zoomed screenshots then pan sideways with one finger (CSS). */
export function trackPinchZoom() {
  const vv = window.visualViewport;
  if (!vv) return;
  const sync = () => document.documentElement.classList.toggle('is-zoomed', vv.scale > 1.01);
  vv.addEventListener('resize', sync);
  // a client navigation rewrites <html>'s attributes: set it again on the new page
  document.addEventListener('astro:after-swap', sync);
  sync();
}

export function keepFocusClear() {
  document.addEventListener('focusin', (event) => {
    const el = event.target as HTMLElement | null;
    if (!el || el === document.body || !el.getBoundingClientRect || el.closest('dialog[open], [aria-modal="true"]')) return;
    requestAnimationFrame(() => {
      // Bars can stack (the header, then the exhibition's selector below it): clear them one after the other.
      for (let pass = 0; pass < 3; pass++) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
        const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 24)));
        const y = Math.min(innerHeight - 1, Math.max(0, r.top + 2));
        const top = document.elementFromPoint(x, y);
        if (!top || el.contains(top)) return;
        const bar = stickyAncestor(top);
        if (!bar || bar.contains(el)) return;
        const shift = bar.getBoundingClientRect().bottom - r.top + 12;
        if (shift <= 0) return;
        (scroller(el) ?? window).scrollBy({ top: -shift, behavior: 'instant' });
      }
    });
  });
}

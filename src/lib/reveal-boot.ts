/**
 * Scroll-Reveal für [data-reveal] — verbirgt nur, wenn es auch wieder zeigen kann.
 * Läuft bei jedem astro:page-load (ClientRouter), nicht nur einmal pro Sitzung.
 */
let activeObserver: IntersectionObserver | undefined;
let pendingReveals: number[] = [];

export function revealBoot() {
  activeObserver?.disconnect();
  activeObserver = undefined;
  pendingReveals.forEach(window.clearTimeout);
  pendingReveals = [];
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  if (!els.length) return;
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    // Großzügiger Vorlauf: Inhalte werden deutlich vor dem Viewport enthüllt,
    // damit schnelles Scrollen/Crawler nie leere Sektionen sehen
    { rootMargin: '0px 0px 35% 0px' },
  );
  activeObserver = io;
  const vh = window.innerHeight;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) {
      // Already on screen: play the entrance right away, no observer round-trip
      pendingReveals.push(window.setTimeout(() => el.classList.add('is-in'), 20));
    } else {
      io.observe(el);
    }
  }
}

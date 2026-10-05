// Shared helper for the mobile exhibition suites. The page keeps one live model, prepared by the exhibit in view
// (MobileArcade.astro warmVisible -> mobile-arcade-viewer.ts prepare), so every model request must belong to that exhibit.
import { MACHINES } from './_stations.mjs';

/** Owner of a /models/ request: the claw exhibit loads the claw, Dennis's figure and the plush prizes, the phone its
 *  booth, a project its own cabinet (`mach-<slug>-v4`, `cab-<slug>-v2`). Anything else comes back as its file name. */
export function modelOwner(url) {
  const file = new URL(url).pathname.replace(/^.*?\/models\//, '');
  if (/^(claw-|dennis\.|plush\/)/.test(file)) return 'kasse';
  if (/^phone-booth-/.test(file)) return 'telefon';
  return MACHINES.find(slug => new RegExp(`^(mach|cab)-${slug}(-v\\d+)?\\.glb`).test(file)) ?? file;
}

/** Distinct owners of the model requests among `urls`. */
export const modelOwners = urls => [...new Set(urls.filter(url => /\/models\//.test(url)).map(modelOwner))];

/** The exhibit the page prepares: the cabinet with the most visible height in the band warmVisible measures (80 px
 *  below the top, 60 px above the bottom); null when no cabinet shows. */
export const exhibitInView = page => page.evaluate(() => {
  const [best] = [...document.querySelectorAll('[data-exhibit]')].map(el => {
    const r = el.querySelector('.mobile-arcade__machine').getBoundingClientRect();
    return { slug: el.dataset.exhibit, visible: Math.max(0, Math.min(r.bottom, innerHeight - 60) - Math.max(r.top, 80)) };
  }).sort((a, b) => b.visible - a.visible);
  return best?.visible ? best.slug : null;
});

/** Exhibits holding the live model: data-live is set once the prepared model is parked in its exhibit. */
export const liveExhibits = page => page.evaluate(() => [...document.querySelectorAll('[data-live]')].map(el => el.dataset.exhibit));

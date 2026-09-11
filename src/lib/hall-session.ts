/** Keep the actual hydrated island (and its WebGL context) through utility/product pages.
 * Astro only persists nodes present in both documents, so supply a parking slot.
 * Nothing is constructed on a direct visit to a legal/product page.
 */
const hallSelector = '[data-astro-transition-persist="hall"]';

document.addEventListener('astro:before-swap', event => {
  const swap = event as Event & { newDocument: Document; viewTransition?: ViewTransition };
  const next = swap.newDocument;
  const hall = document.querySelector<HTMLElement>(hallSelector);
  if (!next) return;
  const returning = Boolean(next.querySelector(hallSelector));
  if ((hall || returning) && swap.viewTransition) {
    void swap.viewTransition.ready.catch(() => {});
    swap.viewTransition.skipTransition();
  }
  if (!hall) {
    if (returning && (window as Window & { __glOk?: boolean }).__glOk !== false) next.documentElement.classList.add('gl-pending');
    return;
  }
  if (!returning) {
    const slot = next.createElement('div');
    slot.setAttribute('data-astro-transition-persist', 'hall');
    next.body.appendChild(slot);
    hall.dataset.hallParked = 'true';
    hall.style.setProperty('display', 'none', 'important');
    hall.inert = true;
    hall.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog => dialog.close());
    next.documentElement.classList.remove('gl-pending', 'hall-nav', 'hall-routing', 'hall-leaving', 'is-screen', 'is-screen-info');
  } else {
    delete hall.dataset.hallParked;
    hall.style.removeProperty('display');
    hall.inert = false;
    if (hall.querySelector('.hall.is-3d, .hall[data-startup-fallback]')) {
      next.documentElement.classList.remove('gl-pending');
      next.querySelector('.hall-startup')?.remove();
    }
  }
});

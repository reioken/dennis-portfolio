/**
 * Nach einem Client-Seitenwechsel landet der Fokus sonst in der persistenten Halle (hinter dem
 * Panel). Auf Projektseiten geht er auf den Titel, damit Tab als Nächstes „← Halle" trifft.
 */
export function focusAfterNav() {
  const mode = document.body.dataset.mode;
  const active = document.activeElement as HTMLElement | null;
  const stray = !active || active === document.body || Boolean(active.closest('.hall'));
  if (mode === 'case' && stray) {
    const title = document.querySelector<HTMLElement>('#case-title, #about-title, #contact-title, main h1');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
}

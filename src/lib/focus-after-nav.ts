/**
 * Nach einem Client-Seitenwechsel landet der Fokus sonst in der persistenten Halle (hinter dem
 * Panel). Auf Projektseiten geht er auf den Titel, damit Tab als Nächstes „← Halle" trifft.
 * Zurück in der Halle (Projekt, Über mich oder Kontakt geschlossen) geht er auf die Öffnen-Taste
 * der Konsole: Sie hat das Panel geöffnet und öffnet es wieder; sonst stünde er auf dem Body.
 */
let previousMode: string | undefined;

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
  } else if (mode === 'hall' && previousMode === 'case' && (!active || active === document.body)) {
    const open = document.querySelector<HTMLElement>('.hall-dock__open');
    if (open && open.getClientRects().length) open.focus({ preventScroll: true });
  }
  previousMode = mode;
}

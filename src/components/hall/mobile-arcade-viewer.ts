import type { HallMachine } from './Hall';
import type { HallScene, Frame } from './hallScene';
import { controlTargets } from '../work/control-targets.mjs';

type Shot = { src: string; alt: string; altEn?: string };
type Gallery = { machine: HallMachine; groups: { labelDe: string; labelEn: string; images: Shot[] }[] };
let active: (() => void) | undefined;
const galleryPositions = new Map<string, { group: number; index: number }>();
type Prepared = { slug: string; exhibit: HTMLElement; stage: HTMLDivElement; scene?: HallScene; promise: Promise<HallScene>; taken: boolean; disposed: boolean };
let prepared: Prepared | undefined;
const readGallery = (exhibit: HTMLElement) => JSON.parse(exhibit.querySelector('[data-mobile-gallery]')!.textContent!) as Gallery;
function releasePrepared() {
  if (!prepared) return;
  prepared.disposed = true;
  prepared.scene?.dispose();
  prepared.stage.remove();
  prepared = undefined;
}
function park(entry: Prepared, fade = false) {
  const anchor = entry.exhibit.querySelector('.mobile-arcade__machine');
  if (!anchor || !entry.exhibit.isConnected || entry.disposed) return;
  entry.taken = false;
  entry.scene?.stop();
  entry.stage.dataset.hallParked = '';
  entry.stage.className = 'mobile-viewer__stage mobile-arcade__live';
  entry.stage.removeAttribute('style');
  anchor.append(entry.stage);
  entry.scene?.renderExhibitPoster();
  if (fade && !matchMedia('(prefers-reduced-motion: reduce)').matches) entry.stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
}
function prepare(exhibit: HTMLElement): Prepared {
  const { machine, groups } = readGallery(exhibit);
  if (prepared?.slug === machine.slug && !prepared.disposed) return prepared;
  releasePrepared();
  const stage = document.createElement('div');
  stage.className = 'mobile-viewer__stage mobile-viewer__parked';
  stage.dataset.hallParked = '';
  stage.setAttribute('aria-hidden', 'true');
  document.body.append(stage);
  const entry: Prepared = { slug: machine.slug, exhibit, stage, taken: false, disposed: false, promise: undefined! };
  prepared = entry;
  entry.promise = import('./hallScene').then(async ({ HallScene }) => {
    if (entry.disposed) throw new Error('Cabinet preparation cancelled');
    const scene = new HallScene(stage, [machine], 0, { onPick: () => {}, onOpen: () => {} }, {
      reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, lite: true, pose: 'zoom', exhibit: true,
    });
    entry.scene = scene;
    scene.showScreen(groups[0].images[0].src);
    await scene.ready(30000);
    if (!entry.taken) park(entry, true);
    return scene;
  });
  // Background failures are retried on entry and must never reject unhandled.
  void entry.promise.catch(() => {
    if (prepared === entry && !entry.taken) releasePrepared();
  });
  return entry;
}

/** Keep only the visible exhibit prepared, and park its animation loop. */
export function warmMobileArcade(exhibit: HTMLElement) {
  if (active || document.hidden || innerWidth >= 900 || !exhibit.isConnected) return;
  prepare(exhibit);
}
document.addEventListener('astro:before-preparation', () => { active?.(); releasePrepared(); });
window.addEventListener('resize', () => {
  if (innerWidth >= 900) { active?.(); releasePrepared(); }
  else if (prepared && !prepared.taken && prepared.stage.dataset.startupPhase === 'ready') prepared.scene?.renderExhibitPoster();
});
window.addEventListener('pagehide', () => { active?.(); releasePrepared(); });

/** Reuse the visible cabinet, or prepare it on demand. The list stays underneath. */
export async function openMobileArcade(exhibit: HTMLElement, href: string) {
  active?.();
  const { machine, groups } = readGallery(exhibit);
  const en = document.documentElement.lang === 'en';
  const t = (de: string, english: string) => en ? english : de;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const priorFocus = document.activeElement as HTMLElement | null;
  const sourceImage = exhibit.querySelector('img')!;
  const origin = sourceImage.getBoundingClientRect();
  const visibleTop = Math.max(origin.top, exhibit.querySelector('.mobile-arcade__heading')!.getBoundingClientRect().bottom);
  const visibleBottom = Math.min(origin.bottom, exhibit.querySelector('.mobile-arcade__caption')!.getBoundingClientRect().top);
  let clipOrigin = '';
  const abort = new AbortController();
  const signal = abort.signal;
  let scene: HallScene | undefined, closed = false, closing = false, ready = false, gi = 0, index = 0;
  const saved = galleryPositions.get(machine.slug);
  if (saved && groups[saved.group]?.images[saved.index]) { gi = saved.group; index = saved.index; }
  let resident: Prepared | undefined;
  let reveal: Animation | undefined;
  const dialog = document.createElement('dialog');
  dialog.className = 'mobile-viewer';
  dialog.setAttribute('aria-label', en ? machine.titleEn ?? machine.title : machine.title);
  dialog.innerHTML = `<div class="mobile-viewer__stage"></div>
    <img class="mobile-viewer__poster" alt="">
    <header class="mobile-viewer__header"><button type="button" data-close></button><span></span></header>
    <p class="mobile-viewer__loading" role="status"></p>
    <div class="mobile-viewer__hotspots"></div>
    <button type="button" class="mobile-viewer__screen" tabindex="-1"><img alt=""></button>
    <footer class="mobile-viewer__footer">
      <div class="mobile-viewer__toolbar">
      <select aria-label="Screenshots"></select>
      <div class="mobile-viewer__controls"><button type="button" data-prev>←</button><span aria-live="polite"></span><button type="button" data-next>→</button></div>
      </div>
      <p class="mobile-viewer__hint"></p>
      <div class="mobile-viewer__links"><button type="button" data-full></button><a></a></div>
    </footer>
    <div class="mobile-viewer__full" hidden><img alt=""><button type="button" data-full-close></button>
      <div class="mobile-viewer__controls mobile-viewer__full-controls"><button type="button" data-full-prev>←</button><span aria-live="polite"></span><button type="button" data-full-next>→</button></div>
    </div>`;
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  let stage = q('.mobile-viewer__stage');
  const poster = q<HTMLImageElement>('.mobile-viewer__poster');
  poster.src = exhibit.querySelector('img')!.currentSrc;
  const status = q('.mobile-viewer__loading');
  status.textContent = t('Automat wird geladen …', 'Loading cabinet …');
  q('[data-close]').textContent = '←';
  q('[data-close]').setAttribute('aria-label', t('Zurück', 'Back'));
  q('.mobile-viewer__header span').textContent = en ? machine.titleEn ?? machine.title : machine.title;
  q('[data-prev]').setAttribute('aria-label', t('Vorheriger Screenshot', 'Previous screenshot'));
  q('[data-next]').setAttribute('aria-label', t('Nächster Screenshot', 'Next screenshot'));
  q('[data-full]').textContent = t('Vergrößern ↗', 'Enlarge ↗');
  q('.mobile-viewer__screen').setAttribute('aria-label', t('Screenshot vergrößern', 'Enlarge screenshot'));
  q('.mobile-viewer__hint').textContent = t('Wischen oder die Tasten am Automaten nutzen', 'Swipe or use the cabinet buttons');
  q<HTMLAnchorElement>('.mobile-viewer__links a').href = href;
  q('.mobile-viewer__links a').textContent = t('Zum Projekt →', 'Project details →');
  const select = q<HTMLSelectElement>('select');
  groups.forEach((group, i) => select.add(new Option(en ? group.labelEn : group.labelDe, String(i))));
  select.value = String(gi);
  select.hidden = groups.length < 2;
  const full = q('.mobile-viewer__full');
  const fullImage = q<HTMLImageElement>('.mobile-viewer__full img');
  const screenImage = q<HTMLImageElement>('.mobile-viewer__screen img');
  q('[data-full-close]').textContent = t('Schließen ✕', 'Close ✕');
  q('[data-full-prev]').setAttribute('aria-label', t('Vorheriger Screenshot', 'Previous screenshot'));
  q('[data-full-next]').setAttribute('aria-label', t('Nächster Screenshot', 'Next screenshot'));
  let imageRequest = 0;
  let imageMotion: Animation | undefined;
  const preloads = new Map<string, HTMLImageElement>();
  const preload = (src: string) => {
    let img = preloads.get(src);
    if (!img) { img = new Image(); img.decoding = 'async'; img.src = src; preloads.set(src, img); }
    return img;
  };
  const sync = () => {
    const images = groups[gi].images;
    const shot = images[index];
    galleryPositions.set(machine.slug, { group: gi, index });
    const request = ++imageRequest;
    const alt = en ? shot.altEn ?? shot.alt : shot.alt;
    full.setAttribute('aria-busy', 'true');
    q('.mobile-viewer__screen').setAttribute('aria-busy', 'true');
    void preload(shot.src).decode().then(() => {
      if (closed || request !== imageRequest) return;
      const changed = screenImage.getAttribute('src') && screenImage.getAttribute('src') !== shot.src;
      screenImage.src = fullImage.src = shot.src;
      screenImage.alt = fullImage.alt = alt;
      full.removeAttribute('aria-busy');
      q('.mobile-viewer__screen').removeAttribute('aria-busy');
      if (ready || dialog.dataset.state === 'fallback') status.textContent = '';
      imageMotion?.cancel();
      if (changed && !reduce) imageMotion = (full.hidden ? screenImage : fullImage).animate([{ opacity: .55 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
      // One image ahead, after the selected shot is decoded. Keep this bounded.
      const next = images[(index + 1) % images.length].src;
      preload(next);
      for (const src of preloads.keys()) if (src !== shot.src && src !== next) preloads.delete(src);
    }).catch(() => {
      if (closed || request !== imageRequest) return;
      full.removeAttribute('aria-busy');
      q('.mobile-viewer__screen').removeAttribute('aria-busy');
      status.textContent = t('Screenshot konnte nicht geladen werden.', 'Screenshot could not be loaded.');
    });
    for (const counter of dialog.querySelectorAll('.mobile-viewer__controls span')) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
    q<HTMLButtonElement>('[data-prev]').disabled = images.length < 2;
    q<HTMLButtonElement>('[data-next]').disabled = images.length < 2;
    q<HTMLButtonElement>('[data-full-prev]').disabled = images.length < 2;
    q<HTMLButtonElement>('[data-full-next]').disabled = images.length < 2;
    dialog.dataset.image = String(index);
    if (scene) scene.showScreen(shot.src);
    if (dialog.dataset.state === 'fallback') poster.src = shot.src;
  };
  const step = (dir: number) => { index = (index + dir + groups[gi].images.length) % groups[gi].images.length; sync(); };
  const inertBackground = (value: boolean) => {
    for (const el of dialog.children) if (el !== full) (el as HTMLElement).inert = value;
  };
  const enlarge = () => { full.hidden = false; inertBackground(true); q('[data-full-close]').focus(); };
  const shrink = () => { full.hidden = true; inertBackground(false); q('[data-full]').focus(); };
  const dispose = () => {
    if (closed) return;
    closed = true;
    reveal?.cancel();
    imageMotion?.cancel();
    preloads.clear();
    abort.abort();
    if (resident && ready && prepared === resident) {
      park(resident);
    } else if (resident && prepared === resident) releasePrepared();
    dialog.close();
    dialog.remove();
    document.documentElement.classList.remove('mobile-viewer-open');
    if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
    active = undefined;
  };
  const frame = (): Frame => {
    const h = stage.clientHeight;
    const top = q('.mobile-viewer__header').getBoundingClientRect().bottom + 12;
    const bottom = q('.mobile-viewer__footer').getBoundingClientRect().top - 16;
    return { cx: .5, cy: (top + bottom) / 2 / h, fw: .94, fh: Math.max(.3, (bottom - top) / h), tight: false };
  };
  const move = (pose: 'zoom' | 'screen', target?: DOMRect) => new Promise<void>(resolve => {
    // setPose retargets on the next animation frame, so its previous tween's
    // settled() value is not evidence that this new camera move has finished.
    const done = () => { clearTimeout(timeout); document.removeEventListener('hall:settled', arrived); resolve(); };
    const arrived = (event: Event) => { if ((event as CustomEvent).detail.pose === pose) done(); };
    const timeout = window.setTimeout(done, 1600);
    document.addEventListener('hall:settled', arrived, { signal });
    signal.addEventListener('abort', done, { once: true });
    if (target) scene?.leaveExhibitTo(target);
    else scene?.setPose(pose, frame());
  });
  const close = async () => {
    if (closing) return;
    if (!full.hidden) { shrink(); return; }
    closing = true;
    const canReturn = scene && resident && (ready || dialog.dataset.state === 'entering');
    const currentClip = getComputedStyle(stage).clipPath;
    reveal?.cancel();
    dialog.dataset.state = 'closing';
    if (canReturn && !reduce) {
      const target = sourceImage.getBoundingClientRect();
      const top = Math.max(target.top, exhibit.querySelector('.mobile-arcade__heading')!.getBoundingClientRect().bottom);
      const bottom = Math.min(target.bottom, exhibit.querySelector('.mobile-arcade__caption')!.getBoundingClientRect().top);
      const clip = `inset(${Math.max(0, top)}px ${Math.max(0, dialog.clientWidth - target.right)}px ${Math.max(0, dialog.clientHeight - bottom)}px ${Math.max(0, target.left)}px)`;
      stage.style.setProperty('--return-top', `${target.top}px`);
      stage.style.setProperty('--return-left', `${target.left}px`);
      stage.style.setProperty('--return-width', `${target.width}px`);
      stage.style.setProperty('--return-height', `${target.height}px`);
      reveal = stage.animate([{ clipPath: currentClip === 'none' ? 'inset(0px)' : currentClip }, { clipPath: clip }], {
        duration: 720, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards',
      });
      await Promise.all([move('zoom', target), reveal.finished.catch(() => {})]);
      if (closed) return;
      ready = true;
    }
    dispose();
  };
  active = dispose;
  q('[data-close]').addEventListener('click', close, { signal });
  q('[data-prev]').addEventListener('click', () => step(-1), { signal });
  q('[data-next]').addEventListener('click', () => step(1), { signal });
  q('[data-full-prev]').addEventListener('click', () => step(-1), { signal });
  q('[data-full-next]').addEventListener('click', () => step(1), { signal });
  q('[data-full]').addEventListener('click', enlarge, { signal });
  q('.mobile-viewer__screen').addEventListener('click', enlarge, { signal });
  q('[data-full-close]').addEventListener('click', shrink, { signal });
  select.addEventListener('change', () => { gi = Number(select.value); index = 0; sync(); }, { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); void close(); }, { signal });
  dialog.addEventListener('keydown', event => {
    if (event.target instanceof HTMLSelectElement) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
  }, { signal });
  let touchX = 0, touchY = 0, swipe = false, suppressClickUntil = 0;
  dialog.addEventListener('touchstart', event => {
    // Leave multi-touch (including native pinch zoom), selects and buttons alone.
    swipe = event.touches.length === 1 && !(event.target as Element).closest('select, a, button:not(.mobile-viewer__screen)');
    if (swipe) { touchX = event.touches[0].clientX; touchY = event.touches[0].clientY; }
  }, { passive: true, signal });
  dialog.addEventListener('touchmove', event => { if (event.touches.length > 1) swipe = false; }, { passive: true, signal });
  dialog.addEventListener('touchcancel', () => { swipe = false; }, { signal });
  dialog.addEventListener('touchend', event => {
    if (!swipe || (!ready && dialog.dataset.state !== 'fallback')) return;
    swipe = false;
    const dx = event.changedTouches[0].clientX - touchX, dy = event.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      event.preventDefault(); suppressClickUntil = performance.now() + 350; step(dx < 0 ? 1 : -1);
    }
  }, { passive: false, signal });
  dialog.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && (event.target as Element).closest('.mobile-viewer__screen')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, { capture: true, signal });
  document.addEventListener('astro:before-preparation', dispose, { signal });
  window.addEventListener('resize', () => { if (innerWidth >= 900) dispose(); else scene?.setFrame(frame()); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) scene?.stop(); else scene?.start(); }, { signal });
  document.addEventListener('hall:screenrect', event => {
    const r = (event as CustomEvent).detail;
    if (r.pose !== 'screen') return;
    Object.assign(q('.mobile-viewer__screen').style, { left: `${r.x + 1}px`, top: `${r.y + 1}px`, width: `${r.w - 2}px`, height: `${r.h - 2}px` });
  }, { signal });
  document.addEventListener('hall:ctlrects', event => {
    const { pose, rects } = (event as CustomEvent).detail;
    if (pose !== 'screen') return;
    const layer = q('.mobile-viewer__hotspots');
    for (const [name, r] of Object.entries(controlTargets(rects))) {
      if (!/^(btn_\d+|[tk]btn_[01]|sel_\d+|joy|trackball)$/.test(name)) continue;
      let button = layer.querySelector<HTMLButtonElement>(`[data-control="${name}"]`);
      if (!button) {
        button = document.createElement('button'); button.type = 'button'; button.dataset.control = name;
        const action = /^btn_\d+$/.test(name) ? Number(name.slice(4)) % 3 : /[tk]btn_0/.test(name) ? 0 : 2;
        button.setAttribute('aria-label', action === 0 ? t('Vorheriger Screenshot', 'Previous screenshot') : action === 1 ? t('Vergrößern', 'Enlarge') : t('Nächster Screenshot', 'Next screenshot'));
        if (name.startsWith('sel_')) button.setAttribute('aria-label', `${t('Screenshot', 'Screenshot')} ${Number(name.slice(4)) + 1}`);
        button.addEventListener('click', event => {
          scene?.ctl(name, 'press');
          window.setTimeout(() => { if (!closed) scene?.ctl(name, 'release'); }, 140);
          if (name.startsWith('sel_')) { index = Number(name.slice(4)) % groups[gi].images.length; sync(); }
          else if (name === 'joy' || name === 'trackball') {
            const rect = button!.getBoundingClientRect();
            const dir = event.clientX && event.clientX < rect.x + rect.width / 2 ? -1 : 1;
            scene?.joyDir(dir); step(dir);
          } else action === 1 ? enlarge() : step(action === 0 ? -1 : 1);
        }, { signal });
        layer.append(button);
      }
      Object.assign(button.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    }
  }, { signal });
  document.body.append(dialog);
  dialog.showModal();
  document.documentElement.classList.add('mobile-viewer-open');
  clipOrigin = `inset(${Math.max(0, visibleTop)}px ${Math.max(0, dialog.clientWidth - origin.right)}px ${Math.max(0, dialog.clientHeight - visibleBottom)}px ${Math.max(0, origin.left)}px)`;
  dialog.dataset.state = 'loading';
  sync();
  try {
    resident = prepare(exhibit);
    const alreadyVisible = resident.stage.classList.contains('mobile-arcade__live');
    resident.taken = true;
    resident.stage.getAnimations().forEach(animation => animation.cancel());
    stage.replaceWith(resident.stage);
    stage = resident.stage;
    stage.className = 'mobile-viewer__stage';
    stage.style.visibility = 'hidden';
    stage.style.clipPath = clipOrigin;
    delete stage.dataset.hallParked;
    scene = await resident.promise;
    if (closed) return;
    scene.showScreen(groups[gi].images[index].src);
    scene.enterExhibitFrom(origin);
    stage.style.visibility = 'visible';
    dialog.dataset.state = 'entering';
    status.textContent = '';
    reveal = stage.animate([
      { clipPath: clipOrigin, opacity: alreadyVisible ? 1 : 0 },
      { clipPath: clipOrigin, opacity: 1, offset: .12 },
      { clipPath: 'inset(0px)', opacity: 1 },
    ], { duration: reduce ? 0 : 720, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    const entryReveal = reveal;
    const movement = move('screen');
    scene.start();
    await Promise.all([movement, entryReveal.finished.catch(() => {})]);
    if (closed || closing) return;
    stage.style.clipPath = 'none';
    entryReveal.cancel();
    ready = true;
    dialog.dataset.state = 'ready';
    status.textContent = '';
  } catch {
    if (closed) return;
    if (resident && prepared === resident) releasePrepared();
    scene = undefined;
    dialog.dataset.state = 'fallback';
    status.textContent = t('Screenshots', 'Screenshots');
    q('.mobile-viewer__hint').textContent = t('Mit den Pfeilen durch die Screenshots blättern', 'Use the arrows to browse screenshots');
    sync();
  }
}

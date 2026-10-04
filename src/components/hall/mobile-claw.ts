import type { HallScene } from './hallScene';
import type { HallItem } from './Hall';

/** A single visible claw; the profile never waits for WebGL. */
export function mountMobileClaw(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.mobile-claw__stage')!;
  const button = root.querySelector<HTMLButtonElement>('.mobile-claw__pause')!;
  const zoomButton = root.querySelector<HTMLButtonElement>('.mobile-claw__zoom')!;
  const hint = root.querySelector<HTMLElement>('.mobile-claw__hint')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  let scene: HallScene | undefined, disposed = false, visible = false, paused = false, zoomed = false, moving = false;
  let pending: Promise<void> | undefined;
  let settleTimer = 0;
  const frame = { cx: .5, cy: .5, fw: 1, fh: 1 };
  const setHint = (de: string, en: string) => {
    hint.querySelector('[data-lang="de"]')!.textContent = de;
    hint.querySelector('[data-lang="en"]')!.textContent = en;
  };
  const sync = () => {
    if (disposed || !scene) return;
    if (visible && !document.hidden && (moving || (!paused && !motion.matches))) scene.start();
    else scene.stop();
  };
  const applyZoom = () => {
    if (!scene || disposed) return;
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    zoomButton.querySelector('[data-lang="de"]')!.textContent = zoomed ? 'Ganzen Greifautomaten ansehen' : 'Greifautomaten näher ansehen';
    zoomButton.querySelector('[data-lang="en"]')!.textContent = zoomed ? 'View the whole claw machine' : 'Take a closer look at the claw machine';
    setHint(zoomed ? 'Antippen · zurück zum Automaten' : 'Antippen · näher ansehen', zoomed ? 'Tap · back to the cabinet' : 'Tap · take a closer look');
    scene.setPose(zoomed ? 'screen' : 'zoom', frame);
    // A requested camera change still draws when decorative motion is paused.
    moving = true;
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => { moving = false; sync(); }, motion.matches ? 60 : 850);
    sync();
  };
  const load = async () => {
    if (disposed) return;
    if (pending) return pending;
    if (scene) return;
    pending = (async () => {
      try {
        const { HallScene } = await import('./hallScene');
        if (disposed) return;
        const item = JSON.parse(root.querySelector('[data-claw-item]')!.textContent!) as HallItem;
        scene = new HallScene(stage, [item], 0, { onPick: () => {}, onOpen: () => {} }, {
          reduce: motion.matches, lite: true, exhibit: true, pose: 'zoom', frame,
        });
        await scene.ready(30000);
        if (disposed) return;
        scene.renderExhibitPoster();
        root.classList.add('is-ready');
        button.hidden = motion.matches;
        root.removeAttribute('aria-busy');
        if (zoomed) applyZoom();
        else setHint('Antippen · näher ansehen', 'Tap · take a closer look');
        sync();
      } catch {
        scene?.dispose(); scene = undefined;
        zoomed = false;
        root.removeAttribute('aria-busy');
        setHint('3D neu laden · antippen', 'Tap · reload 3D');
      }
    })();
    await pending;
    pending = undefined;
  };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) void load();
    sync();
  }, { threshold: .05 });
  observer.observe(root);
  zoomButton.addEventListener('click', async () => {
    zoomed = !zoomed;
    if (!root.classList.contains('is-ready')) {
      root.setAttribute('aria-busy', 'true');
      setHint('3D wird vorbereitet…', 'Preparing 3D…');
      await load();
    } else applyZoom();
  }, { signal: abort.signal });
  button.addEventListener('click', () => {
    paused = !paused;
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('[data-lang="de"]')!.textContent = paused ? 'Animation abspielen' : 'Animation pausieren';
    button.querySelector('[data-lang="en"]')!.textContent = paused ? 'Play animation' : 'Pause animation';
    sync();
  }, { signal: abort.signal });
  document.addEventListener('visibilitychange', sync, { signal: abort.signal });
  motion.addEventListener('change', () => { scene?.setReduce(motion.matches); button.hidden = motion.matches || !scene; sync(); }, { signal: abort.signal });
  return () => { disposed = true; clearTimeout(settleTimer); observer.disconnect(); abort.abort(); scene?.dispose(); stage.replaceChildren(); root.classList.remove('is-ready'); button.hidden = true; };
}

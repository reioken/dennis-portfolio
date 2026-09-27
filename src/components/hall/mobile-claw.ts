import type { HallScene } from './hallScene';
import type { HallItem } from './Hall';

/** A single visible claw; the profile never waits for WebGL. */
export function mountMobileClaw(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('.mobile-claw__stage')!;
  const button = root.querySelector<HTMLButtonElement>('button')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  let scene: HallScene | undefined, disposed = false, loading = false, visible = false, paused = false;
  const sync = () => {
    if (disposed || !scene) return;
    if (visible && !document.hidden && !paused && !motion.matches) scene.start();
    else scene.stop();
  };
  const load = async () => {
    if (loading || disposed) return;
    loading = true;
    try {
      const { HallScene } = await import('./hallScene');
      if (disposed) return;
      const item = JSON.parse(root.querySelector('[data-claw-item]')!.textContent!) as HallItem;
      scene = new HallScene(stage, [item], 0, { onPick: () => {}, onOpen: () => {} }, {
        reduce: motion.matches, lite: true, exhibit: true, pose: 'zoom', frame: { cx: .5, cy: .5, fw: 1, fh: 1 },
      });
      await scene.ready(30000);
      if (disposed) return;
      scene.renderExhibitPoster();
      root.classList.add('is-ready');
      button.hidden = motion.matches;
      sync();
    } catch {
      scene?.dispose(); scene = undefined;
      // The original cabinet render remains a complete, usable illustration.
    }
  };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) void load();
    sync();
  }, { threshold: .05 });
  observer.observe(root);
  button.addEventListener('click', () => {
    paused = !paused;
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('[data-lang="de"]')!.textContent = paused ? 'Animation abspielen' : 'Animation pausieren';
    button.querySelector('[data-lang="en"]')!.textContent = paused ? 'Play animation' : 'Pause animation';
    sync();
  }, { signal: abort.signal });
  document.addEventListener('visibilitychange', sync, { signal: abort.signal });
  motion.addEventListener('change', () => { button.hidden = motion.matches; sync(); }, { signal: abort.signal });
  return () => { disposed = true; observer.disconnect(); abort.abort(); scene?.dispose(); stage.replaceChildren(); root.classList.remove('is-ready'); button.hidden = true; };
}

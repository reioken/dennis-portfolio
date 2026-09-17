/**
 * setTimeout that only counts time while the document is visible.
 *
 * The hall's startup budget has to survive a tab opened in the background: Chrome throttles a hidden tab's
 * timers to one per second, and the GPU warm-up yields through dozens of them (texture uploads, compile
 * batches, composer passes). A wall-clock budget therefore expired before the visitor ever looked at the tab,
 * and they got the CSS fallback — a black void beside the About panel — instead of the hall (2026-09-16).
 *
 * @param {number} ms visible milliseconds before `fn` runs
 * @param {() => void} fn
 * @param {{ document?: { hidden: boolean; addEventListener: Function; removeEventListener: Function }, now?: () => number, setTimeout?: Function, clearTimeout?: Function }} [env] test seam
 * @returns {() => void} cancel
 */
export function visibleTimeout(ms, fn, env = {}) {
  const doc = env.document ?? globalThis.document;
  const now = env.now ?? (() => performance.now());
  const set = env.setTimeout ?? ((cb, t) => globalThis.setTimeout(cb, t));
  const clear = env.clearTimeout ?? ((id) => globalThis.clearTimeout(id));
  let remaining = ms;
  let armedAt = 0;
  let timer;
  let done = false;
  const onVis = () => (doc.hidden ? disarm() : arm());
  function arm() {
    if (done || doc.hidden || timer !== undefined) return;
    armedAt = now();
    timer = set(() => {
      timer = undefined;
      done = true;
      doc.removeEventListener('visibilitychange', onVis);
      fn();
    }, remaining);
  }
  function disarm() {
    if (timer === undefined) return;
    clear(timer);
    timer = undefined;
    remaining = Math.max(0, remaining - (now() - armedAt));
  }
  doc.addEventListener('visibilitychange', onVis);
  arm();
  return () => {
    done = true;
    disarm();
    doc.removeEventListener('visibilitychange', onVis);
  };
}

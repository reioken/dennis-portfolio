import { useEffect, useRef } from 'react';
import type { HallItem } from './Hall';
import { HallScene, type Frame, type Pose } from './hallScene';
import { visibleTimeout } from './visibleTimeout.mjs';
import { albumPlayer } from '../../lib/albumPlayer';

/** Rebuilds up to three lost WebGL contexts per page visit; the next loss leaves the CSS backdrop. */
const MAX_REBUILDS = 3;

type Props = {
  items: HallItem[];
  focus: number;
  attract: boolean;
  reduce: boolean;
  lite: boolean;
  /** Pose und freier Bereich beim Aufbau — beim Direktaufruf einer Projektseite steht die Kamera sofort richtig */
  pose: Pose;
  frame: Frame;
  /** The hall's current station, pose and free area: where a rebuild after a lost context starts. */
  view: () => { pose: Pose; frame: Frame; focus: number };
  onScene: (scene: HallScene | null) => void;
  onPick: (i: number) => void;
  onOpen: (i: number) => void;
  onScreenClick: () => void;
  onBackdrop: () => void;
  onReady: () => void;
  onFail: () => void;
};

/** WebGL-Bühne der Spielhalle. Wird nur im Browser nachgeladen; Hall.tsx hält den Zustand. */
export default function Stage3D({ items, focus, attract, reduce, lite, pose, frame, view, onScene, onPick, onOpen, onScreenClick, onBackdrop, onReady, onFail }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scene = useRef<HallScene | null>(null);
  const cbs = useRef({ onPick, onOpen, onScreenClick, onBackdrop, onReady, onFail, onScene, view });
  cbs.current = { onPick, onOpen, onScreenClick, onBackdrop, onReady, onFail, onScene, view };
  const live = useRef({ attract, reduce });
  live.current = { attract, reduce };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let watchdog: (() => void) | undefined;
    let active = true;
    let canvas: HTMLCanvasElement | null = null;
    let rebuilds = 0;
    let retry = 0;
    let recoveryView: ReturnType<HallScene['viewState']> | null = null;
    const parked = () => document.hidden || Boolean(el.closest('[data-hall-parked]'));
    const build = (recover: boolean) => {
      const routed = cbs.current.view();
      // A corner view belongs to the scene. Preserve it while still on the same hall route;
      // a navigation/resize during recovery uses the page's latest focus and frame.
      const corner = recoveryView && routed.pose === 'hall' && recoveryView.focus === routed.focus
        && (recoveryView.pose === 'bedroom' || recoveryView.pose === 'player');
      const at = recover ? corner ? { ...routed, pose: recoveryView!.pose } : routed : { pose, frame, focus };
      const sc = new HallScene(
        el,
        items,
        at.focus,
        {
          onPick: (i) => cbs.current.onPick(i),
          onOpen: (i) => cbs.current.onOpen(i),
          onScreenClick: () => cbs.current.onScreenClick(),
          onBackdrop: () => cbs.current.onBackdrop(),
        },
        { reduce: live.current.reduce, lite, pose: at.pose, frame: at.frame, recover },
      );
      scene.current = sc;
      canvas = el.querySelector('canvas');
      // Capture phase: ahead of three's own handler, which would ask the browser to restore this context.
      canvas?.addEventListener('webglcontextlost', lost, { capture: true });
      cbs.current.onScene(sc);
      if (recover && live.current.attract) sc.setAttract(true);
      // Bühne erst zeigen, wenn die Modelle rund um den Start da sind — kein Aufblitzen der Platzhalter
      // Both budgets count visible time only (background tab: throttled timers, see visibleTimeout).
      watchdog = visibleTimeout(31000, () => {
        if (active && scene.current === sc) { active = false; cbs.current.onFail(); }
      });
      sc.ready(30000).then(() => {
        watchdog?.();
        if (!active || scene.current !== sc) return;
        cbs.current.onReady();
        if (recover && parked()) sc.stop();
      }).catch(() => {
        watchdog?.();
        if (active && scene.current === sc) { active = false; cbs.current.onFail(); }
      });
    };
    const rebuild = (delay: number) => {
      retry = window.setTimeout(() => {
        if (!active) return;
        try {
          build(true);
        } catch (err) {
          // The GPU is not back yet: try again a little later, then leave the CSS backdrop.
          if (delay < 8000) rebuild(delay * 2);
          else {
            console.warn('[hall] WebGL kommt nicht zurück, CSS-Kulisse bleibt', err);
            active = false;
            cbs.current.onFail();
          }
        }
      }, delay);
    };
    // A lost context (a GPU process reset, a driver timeout while another program loads the GPU, memory pressure) used
    // to hand over to the CSS backdrop for good: a dark room behind the navigation for the rest of the visit
    // (2026-10-06). The browser brings the GPU back within about a second; the hall then builds itself again from the
    // cached models, at its current station and pose, without the ignition.
    const lost = (e: Event) => {
      // This canvas is given up, so its context is not restored (that only wasted a context and logged a burst of
      // deletes into the wrong context); the rebuild draws on a new canvas.
      e.stopImmediatePropagation();
      const sc = scene.current;
      if (!active || !sc) return;
      recoveryView = sc.viewState();
      watchdog?.();
      canvas?.removeEventListener('webglcontextlost', lost, { capture: true });
      canvas = null;
      cbs.current.onScene(null);
      scene.current = null;
      sc.dispose();
      if (++rebuilds > MAX_REBUILDS) {
        console.warn('[hall] WebGL-Kontext wiederholt verloren — CSS-Kulisse übernimmt');
        active = false;
        cbs.current.onFail();
        return;
      }
      console.warn('[hall] WebGL-Kontext verloren — die Halle baut sich neu auf');
      rebuild(1000);
    };
    try {
      build(false);
    } catch (err) {
      console.warn('[hall] WebGL nicht verfügbar, CSS-Kulisse bleibt', err);
      cbs.current.onFail();
      return;
    }
    const vis = () => (parked() ? scene.current?.stop() : scene.current?.start());
    document.addEventListener('visibilitychange', vis);
    return () => {
      active = false;
      window.clearTimeout(retry);
      // The hall itself goes away: its CD player's music would be out of reach (a rebuild above keeps it playing).
      albumPlayer.pause();
      watchdog?.();
      document.removeEventListener('visibilitychange', vis);
      canvas?.removeEventListener('webglcontextlost', lost, { capture: true });
      cbs.current.onScene(null);
      scene.current?.dispose();
      scene.current = null;
    };
    // items/pose/frame ändern sich nach dem Mount nicht; die Bühne lebt über Seitenwechsel hinweg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scene.current?.setFocus(focus);
  }, [focus]);
  useEffect(() => {
    scene.current?.setAttract(attract);
  }, [attract]);
  useEffect(() => {
    scene.current?.setReduce(reduce);
  }, [reduce]);

  return <div ref={ref} className="hall__stage" />;
}

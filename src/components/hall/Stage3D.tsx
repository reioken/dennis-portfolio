import { useEffect, useRef } from 'react';
import type { HallItem } from './Hall';
import { HallScene, type Frame, type Pose } from './hallScene';
import { visibleTimeout } from './visibleTimeout.mjs';

type Props = {
  items: HallItem[];
  focus: number;
  attract: boolean;
  reduce: boolean;
  lite: boolean;
  /** Pose und freier Bereich beim Aufbau — beim Direktaufruf einer Projektseite steht die Kamera sofort richtig */
  pose: Pose;
  frame: Frame;
  onScene: (scene: HallScene | null) => void;
  onPick: (i: number) => void;
  onOpen: (i: number) => void;
  onScreenClick: () => void;
  onBackdrop: () => void;
  onReady: () => void;
  onFail: () => void;
};

/** WebGL-Bühne der Spielhalle. Wird nur im Browser nachgeladen; Hall.tsx hält den Zustand. */
export default function Stage3D({ items, focus, attract, reduce, lite, pose, frame, onScene, onPick, onOpen, onScreenClick, onBackdrop, onReady, onFail }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scene = useRef<HallScene | null>(null);
  const cbs = useRef({ onPick, onOpen, onScreenClick, onBackdrop, onReady, onFail, onScene });
  cbs.current = { onPick, onOpen, onScreenClick, onBackdrop, onReady, onFail, onScene };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let watchdog: (() => void) | undefined;
    let active = true;
    try {
      scene.current = new HallScene(
        el,
        items,
        focus,
        {
          onPick: (i) => cbs.current.onPick(i),
          onOpen: (i) => cbs.current.onOpen(i),
          onScreenClick: () => cbs.current.onScreenClick(),
          onBackdrop: () => cbs.current.onBackdrop(),
        },
        { reduce, lite, pose, frame },
      );
      cbs.current.onScene(scene.current);
      // Bühne erst zeigen, wenn die Modelle rund um den Start da sind — kein Aufblitzen der Platzhalter
      const sc = scene.current;
      // Both budgets count visible time only (background tab: throttled timers, see visibleTimeout).
      watchdog = visibleTimeout(31000, () => {
        if (active && scene.current === sc) { active = false; cbs.current.onFail(); }
      });
      sc.ready(30000).then(() => {
        watchdog?.();
        if (active && scene.current === sc) cbs.current.onReady();
      }).catch(() => { watchdog?.(); if (active) cbs.current.onFail(); });
    } catch (err) {
      console.warn('[hall] WebGL nicht verfügbar, CSS-Kulisse bleibt', err);
      cbs.current.onFail();
      return;
    }
    const vis = () => (document.hidden || el.closest('[data-hall-parked]') ? scene.current?.stop() : scene.current?.start());
    document.addEventListener('visibilitychange', vis);
    // Kontext verloren (zu viele Kontexte, GPU-Reset): zurück zur CSS-Kulisse statt schwarzer Fläche
    const canvas = el.querySelector('canvas');
    const lost = (e: Event) => {
      e.preventDefault();
      console.warn('[hall] WebGL-Kontext verloren — CSS-Kulisse übernimmt');
      cbs.current.onFail();
    };
    canvas?.addEventListener('webglcontextlost', lost);
    return () => {
      active = false;
      watchdog?.();
      document.removeEventListener('visibilitychange', vis);
      canvas?.removeEventListener('webglcontextlost', lost);
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

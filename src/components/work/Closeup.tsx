import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { navigate } from 'astro:transitions/client';
import { copy, type Lang } from '../../lib/i18n';
import { toAvif } from '../../lib/img';
import { altFor, type GalleryShot } from './GalleryLightbox';
import type { CaptureGroup } from './CaseCaptures';
import './closeup.css';
import Icon from '../icons/Icon';
import { controlTargets } from './control-targets.mjs';

/**
 * Das Close-up: die Kamera steht vor Bildschirm und Bedienfeld des Automaten (Pose `screen`),
 * die Capture liegt als scharfes DOM-Bild auf dem projizierten Bildschirm-Rechteck
 * (`hall:screenrect`, derselbe Mechanismus wie das Spiel-iframe). Geblättert wird mit den
 * Bedienelementen des Automaten (unsichtbare Trefferflächen über `hall:ctlrects`), mit
 * ←/→, Gamepad, Mausrad und Wischen; das OSD im Bildschirm ist der garantierte Weg.
 * Dritte Stufe: Vollbild (Fullscreen API; ohne sie die Lightbox der Seite).
 */
export type CloseupProps = {
  open: boolean;
  title: string;
  brand: string;
  lang: Lang;
  reduce: boolean;
  groups: CaptureGroup[];
  gi: number;
  images: GalleryShot[];
  index: number;
  /** Hochkant-Captures (Kiosk) */
  phone: boolean;
  arcadeHref?: string;
  onIndex: (i: number) => void;
  onGroup: (i: number) => void;
  onExit: () => void;
  /** Vollbild nicht möglich (iOS, kein Fullscreen-API) → Lightbox der Seite */
  onFullscreenFallback: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };
type CtlRects = Record<string, Rect>;
type PadEvent = CustomEvent<{ btn?: string }>;

const WHEEL_LOCK_MS = 320;
const nn = (i: number) => String(i + 1).padStart(2, '0');

function validRect(value: Partial<Rect> | undefined): value is Rect {
  return Boolean(value && [value.x, value.y, value.w, value.h].every((n) => Number.isFinite(n)) && value.w! > 0 && value.h! > 0);
}

function Bi({ de, en }: { de: string; en?: string }) {
  if (!en || en === de) return <>{de}</>;
  return (
    <>
      <span data-lang="de">{de}</span>
      <span data-lang="en">{en}</span>
    </>
  );
}

function ctl(name: string, action: 'lit' | 'dim' | 'hover' | 'press' | 'release' | 'idle', dir?: -1 | 1) {
  document.dispatchEvent(new CustomEvent('hall:ctl', { detail: { name, action, dir } }));
}

/** Rolle eines Bedienelements im Close-up: was es blättert oder öffnet */
type Role = 'prev' | 'next' | 'both' | 'fullscreen' | 'play' | 'pick';
function roleOf(name: string, hasPlay: boolean): Role | null {
  if (name === 'joy' || name === 'trackball') return 'both';
  if (name === 'btn') return 'fullscreen';
  // Both rows read naturally from left to right: previous / fullscreen / next.
  if (/^btn_\d+$/.test(name)) return (['prev', 'fullscreen', 'next'] as const)[Number(name.slice(4)) % 3];
  if (/^start_\d+$/.test(name)) return hasPlay ? 'play' : 'fullscreen';
  if (name === 'tbtn_0' || name === 'kbtn_0') return 'prev';
  if (name === 'tbtn_1' || name === 'kbtn_1') return 'next';
  if (/^sel_\d+$/.test(name)) return 'pick';
  return null;
}

export default function Closeup({ open, title, brand, lang, reduce, groups, gi, images, index, phone, arcadeHref, onIndex, onGroup, onExit, onFullscreenFallback }: CloseupProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [ctlRects, setCtlRects] = useState<CtlRects>({});
  const [fs, setFs] = useState(false);
  const [scan, setScan] = useState(false);
  const [info, setInfo] = useState(false);
  const [ui, setUi] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [prevShot, setPrevShot] = useState<GalleryShot | null>(null);
  /** Große Variante erst zeigen, wenn sie abseits des Hauptthreads dekodiert ist — sonst hängt der Klick */
  const [hiReady, setHiReady] = useState<string | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const uiTimer = useRef<number | undefined>(undefined);
  const wheelAt = useRef(0);
  const wheelAcc = useRef(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const lastShot = useRef<GalleryShot | null>(null);
  const initializedControls = useRef(new Set<string>());
  const focusedOnOpen = useRef(false);
  const P = copy.de.panel;
  const PE = copy.en.panel;
  const total = images.length;
  const shot = images[Math.min(index, Math.max(total - 1, 0))];
  const hasPlay = Boolean(arcadeHref);
  const en = lang === 'en';

  /* Projected bounds stay live during the camera move; arrival never gates input. */
  useEffect(() => {
    if (!open) {
      setRect(null);
      setCtlRects({});
      initializedControls.current.clear();
      focusedOnOpen.current = false;
      setInfo(false);
      document.documentElement.classList.remove('is-screen-info');
      return;
    }
    const onRect = (e: Event) => {
      const d = (e as CustomEvent<Partial<Rect> & { pose?: string }>).detail;
      if ((d?.pose && d.pose !== 'screen') || !validRect(d)) return;
      setRect({ x: d.x, y: d.y, w: d.w, h: d.h });
    };
    const onCtl = (e: Event) => {
      const d = (e as CustomEvent<{ pose?: string; rects?: CtlRects }>).detail;
      if (d?.pose === 'screen' && d.rects) {
        setCtlRects(Object.fromEntries(Object.entries(d.rects).filter(([, bounds]) => validRect(bounds))));
      }
    };
    document.addEventListener('hall:screenrect', onRect);
    document.addEventListener('hall:ctlrects', onCtl);
    // The opening event can precede this island's commit. Ask for the current
    // projection after subscribing, including when reduced motion snaps the camera.
    const nudge = requestAnimationFrame(() => document.dispatchEvent(new CustomEvent('hall:reframe')));
    return () => {
      document.removeEventListener('hall:screenrect', onRect);
      document.removeEventListener('hall:ctlrects', onCtl);
      cancelAnimationFrame(nudge);
    };
  }, [open]);

  /* Initialize each physical control once; live bounds must not cancel a press or hover. */
  useEffect(() => {
    if (!open) return;
    for (const name of Object.keys(ctlRects)) {
      if (initializedControls.current.has(name)) continue;
      initializedControls.current.add(name);
      ctl(name, roleOf(name, hasPlay) ? 'lit' : 'dim');
    }
  }, [open, ctlRects, hasPlay]);
  const projected = Boolean(rect);
  useEffect(() => {
    if (!open || focusedOnOpen.current || (!projected && !window.matchMedia('(max-width: 899px)').matches)) return;
    focusedOnOpen.current = true;
    const el = screenRef.current;
    const active = document.activeElement as HTMLElement | null;
    if (el && (!active || active === document.body || active.closest('.captures'))) el.focus({ preventScroll: true });
  }, [open, projected]);

  /* ---------- Capture-Wechsel: alte Aufnahme kurz stehen lassen (Crossfade) ---------- */
  useEffect(() => {
    if (!shot) return;
    if (lastShot.current && lastShot.current.src !== shot.src) {
      setPrevShot(reduce ? null : lastShot.current);
      const t = window.setTimeout(() => setPrevShot(null), reduce ? 0 : 200);
      lastShot.current = shot;
      return () => window.clearTimeout(t);
    }
    lastShot.current = shot;
  }, [shot, images, reduce]);

  /* ---------- Große Variante nachladen und vorab dekodieren ---------- */
  useEffect(() => {
    if (!open || !shot?.srcHi) return;
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = shot.srcHi;
    const done = () => {
      if (alive) setHiReady(shot.src);
    };
    if (typeof img.decode === 'function') img.decode().then(done).catch(() => {});
    else img.onload = done;
    return () => {
      alive = false;
    };
  }, [open, shot]);

  /* ---------- OSD zeigen, nach 2 s ruhen ---------- */
  const wake = useCallback(() => {
    setUi(true);
    window.clearTimeout(uiTimer.current);
    uiTimer.current = window.setTimeout(() => setUi(false), 2200);
  }, []);
  useEffect(() => {
    if (!open) return;
    wake();
    const onMove = () => wake();
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('focusin', onMove);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('focusin', onMove);
      window.clearTimeout(uiTimer.current);
    };
  }, [open, wake]);

  /* ---------- Aktionen ---------- */
  const step = useCallback(
    (dir: -1 | 1, by?: string) => {
      if (total < 2) return;
      onIndex((index + dir + total) % total);
      const name = by ?? (ctlRects.joy ? 'joy' : ctlRects.trackball ? 'trackball' : dir < 0 ? (ctlRects.tbtn_0 ? 'tbtn_0' : 'kbtn_0') : ctlRects.tbtn_1 ? 'tbtn_1' : 'kbtn_1');
      ctl(name, 'press', dir);
      wake();
    },
    [index, total, onIndex, ctlRects, wake],
  );
  const stepGroup = useCallback(
    (dir: -1 | 1) => {
      if (groups.length < 2) return;
      onGroup((gi + dir + groups.length) % groups.length);
      wake();
    },
    [gi, groups.length, onGroup, wake],
  );
  const enterFullscreen = useCallback(() => {
    const el = screenRef.current;
    ctl(ctlRects.btn_0 ? 'btn_0' : 'btn', 'press');
    if (!el || typeof el.requestFullscreen !== 'function') {
      onFullscreenFallback();
      return;
    }
    el.requestFullscreen().then(() => { if (document.fullscreenElement !== el) onFullscreenFallback(); }, () => onFullscreenFallback());
  }, [ctlRects, onFullscreenFallback]);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  }, [enterFullscreen]);
  const play = useCallback(() => {
    if (!arcadeHref) return;
    ctl('start_0', 'press');
    const isEn = document.documentElement.dataset.lang === 'en';
    navigate(isEn && !/^\/en(\/|$)/.test(arcadeHref) ? `/en${arcadeHref}` : arcadeHref);
  }, [arcadeHref]);
  const toggleInfo = useCallback((on?: boolean) => {
    setInfo((v) => {
      const next = on ?? !v;
      document.documentElement.classList.toggle('is-screen-info', next);
      // Beim Schließen zurück zum Bildschirm — sonst wiederholt Enter den zuletzt geklickten Knopf
      if (!next) requestAnimationFrame(() => screenRef.current?.focus({ preventScroll: true }));
      return next;
    });
  }, []);
  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.documentElement.classList.remove('is-screen-info');
    onExit();
  }, [onExit]);

  /* Der Schließen-Knopf oben in der Karte (CaseOverlay) gehört zum Info-Zustand */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.hall-panel__close')) {
        toggleInfo(false);
        return;
      }
      // Nach einem Klick auf Leiste oder OSD gehört die Tastatur wieder dem Bildschirm (Enter = Vollbild, ← → blättern)
      if (t?.closest?.('.closeup__rail button, .closeup__count button, .closeup__fs, .closeup__chips button')) {
        requestAnimationFrame(() => screenRef.current?.focus({ preventScroll: true }));
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, toggleInfo]);

  /* ---------- Vollbild-Zustand ---------- */
  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement) && document.fullscreenElement === screenRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  /* ---------- Tastatur (document: vor der Halle, die auf window hört) ---------- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.site-nav') || (info && e.key !== 'Escape')) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      // Space and Enter must retain native activation on focused controls.
      if ((e.key === ' ' || e.key === 'Enter') && t?.closest('button, a, summary, [role="button"]')) return;
      const take = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      switch (e.key) {
        case 'ArrowRight':
          take();
          step(1);
          return;
        case 'ArrowLeft':
          take();
          step(-1);
          return;
        case 'ArrowUp':
          take();
          stepGroup(-1);
          return;
        case 'ArrowDown':
          take();
          stepGroup(1);
          return;
        case 'Home':
          take();
          onIndex(0);
          return;
        case 'End':
          take();
          onIndex(total - 1);
          return;
        case 'Enter':
        case 'f':
        case 'F':
          if (t && (t.tagName === 'A' || t.tagName === 'BUTTON') && e.key === 'Enter') return;
          take();
          toggleFullscreen();
          return;
        case 's':
        case 'S':
          take();
          setScan((s) => !s);
          return;
        case ' ':
        case 'x':
        case 'X':
          if (!arcadeHref) return;
          take();
          play();
          return;
        case 'Escape':
          // Im Vollbild verlässt Esc erst das Vollbild (macht der Browser), dann das Close-up
          if (document.fullscreenElement) return;
          take();
          if (info) toggleInfo(false);
          else exit();
          return;
        default:
          return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, step, stepGroup, onIndex, total, toggleFullscreen, arcadeHref, play, info, toggleInfo, exit]);

  /* ---------- Gamepad (die Halle reicht die Tasten weiter) ---------- */
  useEffect(() => {
    if (!open) return;
    const onPad = (e: Event) => {
      const b = (e as PadEvent).detail?.btn;
      if (b === 'left') step(-1);
      else if (b === 'right') step(1);
      else if (b === 'up' || b === 'lb') stepGroup(-1);
      else if (b === 'down' || b === 'rb') stepGroup(1);
      else if (b === 'a') toggleFullscreen();
      else if (b === 'b') exit();
      else if (b === 'x') play();
      else if (b === 'y') setScan((s) => !s);
    };
    const onBackdrop = () => {
      if (info) toggleInfo(false);
      else exit();
    };
    document.addEventListener('hall:pad', onPad);
    document.addEventListener('hall:backdrop', onBackdrop);
    return () => {
      document.removeEventListener('hall:pad', onPad);
      document.removeEventListener('hall:backdrop', onBackdrop);
    };
  }, [open, step, stepGroup, toggleFullscreen, exit, play, info, toggleInfo]);

  /* ---------- Mausrad über der Bühne: 40 px, 320 ms Sperre ---------- */
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (info) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.hall-panel, .closeup__cap, .closeup__rail, .site-nav') || e.ctrlKey || window.matchMedia('(max-width: 899px)').matches) return;
      e.preventDefault();
      const now = performance.now();
      wheelAcc.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (now - wheelAt.current < WHEEL_LOCK_MS) return;
      if (Math.abs(wheelAcc.current) > 40) {
        step(wheelAcc.current > 0 ? 1 : -1);
        wheelAt.current = now;
        wheelAcc.current = 0;
      }
    };
    document.addEventListener('wheel', onWheel, { passive: false });
    return () => document.removeEventListener('wheel', onWheel);
  }, [open, step, info]);

  /* ---------- Wischen auf dem Bildschirm ---------- */
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button, a, .closeup__cap')) return;
    swiped.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    swiped.current = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y);
    if (swiped.current) step(dx < 0 ? 1 : -1);
  };
  /** Klick auf den Bildschirm (nicht auf OSD-Knöpfe, nicht nach einem Wisch) → Vollbild */
  const onScreenClick = (e: React.MouseEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a, .closeup__cap') || e.detail === 0) return;
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    toggleFullscreen();
  };

  /* ---------- Aufräumen beim Verlassen ---------- */
  useEffect(
    () => () => {
      document.documentElement.classList.remove('is-screen-info');
      if (document.fullscreenElement && document.fullscreenElement === screenRef.current) document.exitFullscreen().catch(() => {});
    },
    [],
  );

  if (!open || typeof document === 'undefined') return null;

  const group = groups[gi];
  const screenStyle: CSSProperties | undefined = rect
    ? { left: Math.round(rect.x + 1), top: Math.round(rect.y + 1), width: Math.max(0, Math.round(rect.w - 2)), height: Math.max(0, Math.round(rect.h - 2)) }
    : undefined;
  const counter = `${nn(index)} / ${nn(total - 1)}`;
  const slideLabel = en ? `${index + 1} of ${total}` : `${index + 1} von ${total}`;
  const fsLabel = en ? PE.fullscreen : P.fullscreen;
  const prevLabel = en ? 'Previous capture' : 'Vorherige Capture';
  const nextLabel = en ? 'Next capture' : 'Nächste Capture';
  const cabinetLabel = en ? 'Back to project' : 'Zurück zum Projekt';

  /* Unsichtbare Trefferflächen über den Bedienelementen: Maus, Touch, Tastatur, Screenreader in einem;
     dazu eine kleine Beschriftung über jedem Teil, was es tut */
  const proxies: React.ReactNode[] = [];
  const tagEls: React.ReactNode[] = [];
  const targetRects = controlTargets(Object.fromEntries(Object.entries(ctlRects).filter(([name]) => roleOf(name, hasPlay))));
  for (const [name, r] of Object.entries(targetRects)) {
    const role = roleOf(name, hasPlay);
    if (!role) continue;
    const box = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x, top: y, width: w, height: h });
    const common = {
      className: 'closeup__proxy',
      'data-control': name,
      // Retain the press target when its projected bounds move under the pointer.
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (e.button === 0) e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerEnter: () => {
        ctl(name, 'hover');
        setHovered(name);
      },
      onPointerLeave: () => {
        ctl(name, 'lit');
        setHovered(null);
      },
      onFocus: () => {
        ctl(name, 'hover');
        setHovered(name);
      },
      onBlur: () => {
        ctl(name, 'lit');
        setHovered(null);
      },
    };
    const tagText = role === 'both'
      ? <><Icon name="chevron-left" size={14} /><Icon name="chevron-right" size={14} /></>
      : role === 'prev' || role === 'next'
        ? <Icon name={role === 'prev' ? 'chevron-left' : 'chevron-right'} size={14} />
        : role === 'fullscreen'
          ? <><Icon name="expand" size={14} />{hovered === name ? fsLabel : null}</>
          : role === 'play' ? <><span className="closeup__coin" />{en ? PE.play : P.play}</> : String(Number(name.slice(4)) + 1);
    tagEls.push(
      <span key={`tag-${name}`} className={`closeup__tag mono${hovered === name || role === 'both' || /^btn_[345]$/.test(name) || /^(tbtn|kbtn)_/.test(name) ? ' is-on' : ''}`} style={{ left: Math.round(r.x + r.w / 2), top: Math.round(role === 'both' ? ctlRects[name].y - 10 : ctlRects[name].y + ctlRects[name].h + 30) }} aria-hidden>
        {tagText}
      </span>,
    );
    if (role === 'both') {
      proxies.push(
        <button key={`${name}-l`} type="button" {...common} style={box(r.x, r.y, r.w / 2, r.h)} aria-label={`${name === 'joy' ? 'Joystick' : 'Trackball'}: ${prevLabel}`} onClick={() => step(-1, name)} />,
        <button key={`${name}-r`} type="button" {...common} style={box(r.x + r.w / 2, r.y, r.w / 2, r.h)} aria-label={`${name === 'joy' ? 'Joystick' : 'Trackball'}: ${nextLabel}`} onClick={() => step(1, name)} />,
      );
    } else if (role === 'prev' || role === 'next') {
      proxies.push(<button key={name} type="button" {...common} style={box(r.x, r.y, r.w, r.h)} aria-label={role === 'prev' ? prevLabel : nextLabel} onClick={() => step(role === 'prev' ? -1 : 1, name)} />);
    } else if (role === 'fullscreen') {
      proxies.push(<button key={name} type="button" {...common} style={box(r.x, r.y, r.w, r.h)} aria-label={fsLabel} onClick={toggleFullscreen} />);
    } else if (role === 'play') {
      proxies.push(<button key={name} type="button" {...common} style={box(r.x, r.y, r.w, r.h)} aria-label={en ? PE.play : P.play} onClick={play} />);
    } else if (role === 'pick') {
      const i = Number(name.slice(4));
      if (i < total) proxies.push(<button key={name} type="button" {...common} style={box(r.x, r.y, r.w, r.h)} aria-label={`Capture ${i + 1}`} onClick={() => { onIndex(i); ctl(name, 'press'); }} />);
    }
  }

  return createPortal(
    <div className={`closeup${projected ? ' is-projected' : ''}${ui ? ' is-ui' : ''}${fs ? ' is-fs' : ''}${phone ? ' closeup--phone' : ''}`} style={{ ['--brand' as string]: brand } as CSSProperties}>
      <div className="closeup__scrim" hidden={!info} onClick={() => toggleInfo(false)} aria-hidden />

      <section
        ref={screenRef}
        className="closeup__screen"
        style={screenStyle}
        tabIndex={-1}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${en ? PE.captures : P.captures}: ${title}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragStart.current = null; swiped.current = false; }}
        onClick={onScreenClick}
      >
        {prevShot ? (
          <figure className="closeup__shot is-out" aria-hidden>
            <img src={prevShot.srcHi || prevShot.src} alt="" decoding="async" draggable={false} />
          </figure>
        ) : null}
        {shot ? (
          <figure key={shot.src} className="closeup__shot is-current" role="group" aria-roledescription="slide" aria-label={slideLabel}>
            <picture>
              {toAvif(hiReady === shot.src && shot.srcHi ? shot.srcHi : shot.src) && <source type="image/avif" srcSet={toAvif(hiReady === shot.src && shot.srcHi ? shot.srcHi : shot.src)} />}
              <img src={hiReady === shot.src && shot.srcHi ? shot.srcHi : shot.src} alt={altFor(shot, lang)} decoding="async" draggable={false} />
            </picture>
          </figure>
        ) : null}
        <div className={`closeup__crt${scan ? ' is-scan' : ''}`} aria-hidden />

        {groups.length > 1 ? (
          <div className="closeup__chips" role="group" aria-label={en ? PE.surfaces : P.surfaces}>
            {groups.map((g, i) => (
              <button key={g.id} type="button" className={`closeup__chip mono${i === gi ? ' is-on' : ''}`} aria-pressed={i === gi} onClick={() => onGroup(i)}>
                <Bi de={g.labelDe} en={g.labelEn} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="closeup__count mono">
          <button type="button" className="closeup__arrow" onClick={() => step(-1)} aria-label={prevLabel} disabled={total < 2}>
            <Icon name="chevron-left" size={18} />
          </button>
          <span aria-live="polite" aria-atomic="true">
            {counter}
          </span>
          <button type="button" className="closeup__arrow" onClick={() => step(1)} aria-label={nextLabel} disabled={total < 2}>
            <Icon name="chevron-right" size={18} />
          </button>
        </div>

        <p className="closeup__cap mono" aria-live="polite">
          <span className="closeup__cap-in">
            {shot ? (
              <>
                <b>{nn(index)} —</b> <Bi de={shot.alt} en={shot.altEn} />
              </>
            ) : group?.blurbDe ? (
              <Bi de={group.blurbDe} en={group.blurbEn} />
            ) : null}
          </span>
        </p>

        <button type="button" className="closeup__fs mono" onClick={toggleFullscreen} aria-pressed={fs}>
          <Icon name="expand" size={17} /> <Bi de={fs ? 'Vollbild schließen' : P.fullscreen} en={fs ? 'Exit fullscreen' : PE.fullscreen} />
        </button>
      </section>

      {proxies}
      {tagEls}

      {/* Kompakte Leiste rechts (Desktop): Titel, Zähler, Blättern, Vollbild, Spielen, Info, zurück */}
      <aside className="closeup__rail" role="group" aria-label={title}>
        <p className="closeup__rail-title">{title}</p>
        <p className="closeup__rail-count mono">
          <Bi de={P.captures} en={PE.captures} /> · {counter}
        </p>
        <div className="closeup__rail-nav">
          <button type="button" className="closeup__rail-arrow" onClick={() => step(-1)} aria-label={prevLabel} disabled={total < 2}>
            <Icon name="chevron-left" size={18} />
          </button>
          <button type="button" className="closeup__rail-arrow" onClick={() => step(1)} aria-label={nextLabel} disabled={total < 2}>
            <Icon name="chevron-right" size={18} />
          </button>
          <button type="button" className="closeup__rail-btn closeup__rail-btn--grow mono" onClick={toggleFullscreen} aria-pressed={fs}>
            <Icon name="expand" size={17} /> <Bi de={P.fullscreen} en={PE.fullscreen} />
          </button>
        </div>
        {arcadeHref ? (
          <a className="closeup__rail-btn closeup__rail-btn--play mono" href={arcadeHref} onClick={(e) => { e.preventDefault(); play(); }}>
            <span className="closeup__coin" aria-hidden />
            <Bi de={P.play} en={PE.play} />
          </a>
        ) : null}
        <button type="button" className="closeup__rail-btn mono" onClick={() => setScan((value) => !value)} aria-pressed={scan}><Bi de="CRT-Effekt" en="CRT effect" /></button>
        <button type="button" className="closeup__rail-btn mono" onClick={() => toggleInfo()} aria-expanded={info}>
          <Icon name="info" size={17} /> <Bi de={P.info} en={PE.info} />
        </button>
        <button type="button" className="closeup__rail-btn closeup__rail-btn--up mono" onClick={exit}>
          <Icon name="arrow-up" size={17} /> <Bi de="Zurück zum Projekt" en="Back to project" />
        </button>
      </aside>

      {/* Leiste unten (Phone) */}
      <div className="closeup__bar">
        <button type="button" className="closeup__bar-btn mono" onClick={exit}>
          <Icon name="arrow-up" size={17} />
          {cabinetLabel}
        </button>
        <p className="closeup__bar-title">{title}</p>
        <span className="closeup__bar-count mono">{counter}</span>
      </div>

      <p className="closeup__hint mono" aria-hidden>
        <Bi de={P.closeupHint} en={PE.closeupHint} />
      </p>
    </div>,
    document.body,
  );
}

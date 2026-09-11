import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { copy } from '../../lib/i18n';
import './arcade-stage.css';

/**
 * Die Bühne der Spielhalle: setzt den Web-Build genau auf das projizierte
 * Bildschirm-Rechteck des 3D-Automaten (`hall:screenrect`) und besitzt alles
 * darauf und darum herum — Poster, Münze, Ladebildschirm, iframe, CRT-Overlay,
 * HUD-Leiste, Info-Tab/-Panel und den Zoom-Hinweis.
 *
 * Kommt innerhalb von 1500 ms kein Rechteck (kein WebGL), fällt sie auf die
 * klassische zentrierte Spalte zurück; ein später eintreffendes Rechteck schaltet
 * jederzeit zurück auf das Rechteck-Layout. Das iframe lebt in beiden Layouts im
 * selben Teilbaum und wird nie umgehängt.
 *
 * Ist das Rechteck schmaler als 420 px (Phone-Pose), gilt der Kompakt-Modus:
 * kleinerer Spielen-Knopf, Phone-Hinweis unter dem Bildschirm, umbrechende
 * HUD-Leiste, runder ⓘ-Knopf unten rechts statt des vertikalen Info-Tabs.
 */
export type ArcadeStageProps = {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  /** URL des Godot-Exports, z. B. /arcade/echo-frequency/index.html */
  src: string;
  /** Seitenverhältnis des Builds, z. B. '16 / 9' */
  aspect?: string;
  /** Download-Größe, z. B. '48 MB' */
  size?: string;
  brand?: string;
  wip?: boolean;
  poster?: string;
  posterAlt?: string;
  posterAltEn?: string;
  /** `WASD bewegen · Maus umsehen · …` */
  controlsDe: string;
  controlsEn: string;
  /** /work/<slug>/ — Ziel von „Beenden“ und „Zum Projekt“ */
  caseHref: string;
  /** Halle */
  homeHref: string;
  engine?: string;
  version?: string;
};

type Phase = 'idle' | 'coin' | 'loading' | 'running' | 'fail';
type PlayState = 'idle' | 'loading' | 'running' | 'fail';
type Layout = 'pending' | 'rect' | 'classic';
type Rect = { x: number; y: number; w: number; h: number };

const COIN_MS = 320;

const FADE_MS = 220;
const LOAD_TIMEOUT_MS = 45_000;
const RECT_NUDGE_MS = 900;
const RECT_TIMEOUT_MS = 1500;
const HUD_IDLE_MS = 2000;
const CONFIRM_MS = 4000;
/** Unterhalb dieser Rechteck-Breite: Kompakt-Modus (Phone-Pose der Halle) */
const COMPACT_MAX_W = 420;
/** Abstand HUD-Leiste / Phone-Hinweis unter dem Bildschirm */
const BELOW_GAP = 10;
/** Nur noch für Vollbild-in-der-Geste und den Phone-Hinweis — kein Layout-Schalter mehr */
const PHONE_MQ = '(max-width: 900px)';
const REDUCE_MQ = '(prefers-reduced-motion: reduce)';
const SEGMENTS = [0, 1, 2, 3, 4, 5, 6, 7];
/** Verbinder innerhalb einer Taste: `WASD / Pfeile`, `Strg oder C`, `Shift + X` */
const KEY_CONNECTORS = new Set(['/', '+', 'oder', 'or']);

const P = copy.de.panel;
const PE = copy.en.panel;
const A = copy.de.arcade;
const AE = copy.en.arcade;

function Bi({ de, en }: { de: string; en?: string }) {
  if (!en || en === de) return <>{de}</>;
  return (
    <>
      <span data-lang="de">{de}</span>
      <span data-lang="en">{en}</span>
    </>
  );
}

function parseAspect(aspect?: string): number {
  if (!aspect) return 16 / 9;
  const parts = aspect.replace(/\s+/g, '').split(/[/:]/).map(Number);
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  const n = Number(aspect);
  return n > 0 ? n : 16 / 9;
}

function controlItems(s: string): string[] {
  return s
    .split(/\s·\s/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** `WASD / Pfeile bewegen` → { key: 'WASD / Pfeile', action: 'bewegen' } */
function splitControl(item: string): { key: string; action: string } {
  const t = item.split(/\s+/);
  let i = 1;
  while (i + 1 < t.length && KEY_CONNECTORS.has(t[i].toLowerCase())) i += 2;
  return { key: t.slice(0, i).join(' '), action: t.slice(i).join(' ') };
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCE_MQ).matches || document.documentElement.classList.contains('fx-off');
}

function emitPlay(state: PlayState) {
  document.dispatchEvent(new CustomEvent('hall:play', { detail: { state } }));
}

/** „Lädt …“ → „Lädt“ (die Auslassungspunkte blinken separat) */
function stripEllipsis(s: string): string {
  return s.replace(/\s*…\s*$/, '');
}

function ControlsBlock({ de, en }: { de: string; en: string }) {
  const D = controlItems(de).map(splitControl);
  const E = controlItems(en).map(splitControl);
  const list = (items: { key: string; action: string }[]) =>
    items.map((c, i) => (
      <li key={i}>
        <b>{c.key}</b>
        {c.action ? <span>{c.action}</span> : null}
      </li>
    ));
  return (
    <div className="arcade-stage__block">
      <p className="arcade-stage__label mono">
        <Bi de={P.controls} en={PE.controls} />
      </p>
      <ul className="arcade-stage__keys mono" data-lang="de">
        {list(D)}
      </ul>
      <ul className="arcade-stage__keys mono" data-lang="en">
        {list(E)}
      </ul>
    </div>
  );
}

export default function ArcadeStage({
  id,
  slug,
  title,
  titleEn,
  src,
  aspect = '16 / 9',
  size,
  brand = '#ac8bfd',
  wip = false,
  poster,
  posterAlt,
  posterAltEn,
  controlsDe,
  controlsEn,
  caseHref,
  homeHref,
  engine,
  version,
}: ArcadeStageProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [frameKey, setFrameKey] = useState(0);
  const [bootFade, setBootFade] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [phone, setPhone] = useState(false);
  const [rectTimedOut, setRectTimedOut] = useState(false);
  const [fs, setFs] = useState(false);
  const [scan, setScan] = useState(true);
  const [hud, setHud] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [info, setInfo] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const infoRef = useRef<HTMLElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const hudTimer = useRef<number | undefined>(undefined);
  const confirmTimer = useRef<number | undefined>(undefined);
  const lastPlay = useRef<PlayState | null>(null);

  const ratio = parseAspect(aspect);
  // Ein Rechteck gewinnt immer (auch spät, auch auf dem Phone); classic nur ohne Rechteck nach dem Timeout.
  const layout: Layout = rect ? 'rect' : rectTimedOut ? 'classic' : 'pending';
  const playState: PlayState = phase === 'coin' ? 'idle' : phase;
  const live = phase === 'loading' || phase === 'running' || phase === 'fail';

  /** Timer, der beim Unmount sicher aufgeräumt wird. */
  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== t);
      fn();
    }, ms);
    timers.current.push(t);
    return t;
  }, []);

  const focusFrame = useCallback(() => {
    frameRef.current?.focus();
  }, []);

  const showHud = useCallback(() => {
    setHud(true);
    window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHud(false), HUD_IDLE_MS);
  }, []);

  const enterFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el || typeof el.requestFullscreen !== 'function') return;
    el.requestFullscreen().catch(() => {
      /* Vollbild verweigert — bleibt eingebettet */
    });
  }, []);

  /* ---- Bildschirm-Rechteck der Halle ---------------------------------- */

  useEffect(() => {
    const onRect = (e: Event) => {
      const d = (e as CustomEvent<Partial<Rect>>).detail;
      if (!d || !(Number(d.w) > 0) || !(Number(d.h) > 0)) return;
      setRect({ x: Number(d.x) || 0, y: Number(d.y) || 0, w: Number(d.w), h: Number(d.h) });
    };
    document.addEventListener('hall:screenrect', onRect);
    return () => document.removeEventListener('hall:screenrect', onRect);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ);
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (rect) return;
    // Falls die Halle vor der Hydration projiziert hat: ein Resize lässt sie erneut senden.
    const nudge = window.setTimeout(() => document.dispatchEvent(new CustomEvent('hall:reframe')), RECT_NUDGE_MS);
    const fallback = window.setTimeout(() => setRectTimedOut(true), RECT_TIMEOUT_MS);
    return () => {
      window.clearTimeout(nudge);
      window.clearTimeout(fallback);
    };
  }, [rect]);

  /* ---- Build-Seitenverhältnis in der Shell einpassen (Letter-/Pillarbox) */

  useEffect(() => {
    const shell = shellRef.current;
    const game = gameRef.current;
    if (!shell || !game) return;
    const fit = () => {
      const W = shell.clientWidth;
      const H = shell.clientHeight;
      if (!W || !H) return;
      let w = W;
      let h = W / ratio;
      if (h > H) {
        h = H;
        w = H * ratio;
      }
      w = Math.round(w);
      h = Math.round(h);
      game.style.width = `${w}px`;
      game.style.height = `${h}px`;
      game.style.left = `${Math.round((W - w) / 2)}px`;
      game.style.top = `${Math.round((H - h) / 2)}px`;
      if (H < 300) shell.dataset.small = '';
      else delete shell.dataset.small;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [ratio]);

  /* ---- Zustände ------------------------------------------------------- */

  useEffect(() => {
    if (lastPlay.current === playState) return;
    lastPlay.current = playState;
    emitPlay(playState);
  }, [playState]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const t = window.setTimeout(() => setPhase('fail'), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, frameKey]);

  useEffect(() => {
    if (phase !== 'running') return;
    setBootFade(true);
    focusFrame();
    showHud();
    const t = window.setTimeout(() => setBootFade(false), reducedMotion() ? 0 : FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase, focusFrame, showHud]);

  useEffect(() => {
    if (!live) return;
    const onMove = () => showHud();
    const onFocusIn = () => showHud();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [live, showHud]);

  useEffect(() => {
    const onFs = () => {
      const active = Boolean(document.fullscreenElement);
      setFs(active);
      if (!active) focusFrame();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [focusFrame]);

  useEffect(() => {
    if (confirm) stayRef.current?.focus();
  }, [confirm]);

  useEffect(() => {
    if (!info) return;
    infoRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setInfo(false);
      focusFrame();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [info, focusFrame]);

  /* ---- Aufräumen: Timer, Vollbild, Halle zurücksetzen ------------------ */

  useEffect(() => {
    const bye = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      window.clearTimeout(hudTimer.current);
      window.clearTimeout(confirmTimer.current);
      if (document.fullscreenElement && document.fullscreenElement === shellRef.current) {
        document.exitFullscreen().catch(() => {});
      }
      emitPlay('idle');
    };
    document.addEventListener('astro:before-swap', bye, { once: true });
    return () => {
      document.removeEventListener('astro:before-swap', bye);
      bye();
    };
  }, []);

  /* ---- Handler -------------------------------------------------------- */

  const start = () => {
    if (phase !== 'idle') return;
    // Phone: die Vollbild-Anfrage muss in der Geste passieren, nicht erst nach dem Laden.
    if (phone) enterFullscreen();
    setPhase('coin');
    later(() => setPhase('loading'), reducedMotion() ? 0 : COIN_MS);
  };

  // Readiness comes from the engine bootstrap, never the iframe load event.
  useEffect(() => {
    const origin = new URL(src, window.location.href).origin;
    const onReady = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== origin) return;
      if (event.data?.type === 'portfolio:game-ready' && event.data?.id === id) setPhase((current) => current === 'loading' ? 'running' : current);
      if (event.data?.type === 'portfolio:game-error' && event.data?.id === id) setPhase((current) => current === 'loading' || current === 'running' ? 'fail' : current);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [src, id, frameKey]);

  const onError = () => setPhase('fail');

  const retry = () => {
    setFrameKey((k) => k + 1);
    setPhase('loading');
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else enterFullscreen();
    } catch {
      /* Vollbild verweigert — bleibt eingebettet */
    }
    focusFrame();
  };

  const onQuitClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (phase !== 'running') return; // lädt / fehlgeschlagen: direkt raus
    e.preventDefault();
    setConfirm(true);
    showHud();
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirm(false), CONFIRM_MS);
  };

  const stay = () => {
    window.clearTimeout(confirmTimer.current);
    setConfirm(false);
    focusFrame();
  };

  const openInfo = () => setInfo(true);
  const closeInfo = () => {
    setInfo(false);
    focusFrame();
  };

  /* ---- Ableitungen ---------------------------------------------------- */

  const rootStyle = { ['--brand' as string]: brand, ['--aspect' as string]: aspect };
  const placed: Rect | null = layout === 'rect' ? rect : null;
  const compact = placed !== null && placed.w < COMPACT_MAX_W;
  const idle = phase === 'idle' || phase === 'coin';
  const shellStyle = placed
    ? {
        left: Math.round(placed.x + 1),
        top: Math.round(placed.y + 1),
        width: Math.max(0, Math.round(placed.w - 2)),
        height: Math.max(0, Math.round(placed.h - 2)),
      }
    : undefined;
  const belowTop = placed ? Math.round(placed.y + placed.h + BELOW_GAP) : 0;
  // Kompakt: die Leiste spannt sich über den Viewport (CSS: left/right 12 px), damit sie umbrechen kann.
  const hudStyle = placed
    ? compact
      ? { top: belowTop }
      : { left: Math.round(placed.x), top: belowTop, width: Math.round(placed.w) }
    : undefined;
  const noteStyle = placed ? { top: belowTop } : undefined;

  const teaserDe = controlItems(controlsDe).slice(0, 3).join(' · ');
  const teaserEn = controlItems(controlsEn).slice(0, 3).join(' · ');
  const meta = [engine, version].filter(Boolean).join(' · ');

  const infoBlocks = (
    <>
      <ControlsBlock de={controlsDe} en={controlsEn} />
      {wip ? (
        <div className="arcade-stage__block">
          <p className="arcade-stage__wip mono">
            <Bi de={A.wip} en={AE.wip} />
          </p>
        </div>
      ) : null}
    </>
  );
  const infoLinks = (
    <div className="arcade-stage__links">
      <a className="arcade-stage__btn" href={caseHref}>
        <Bi de={A.case} en={AE.case} />
      </a>
      <a className="arcade-stage__btn" href={homeHref}>
        ← <Bi de={P.back} en={PE.back} />
      </a>
    </div>
  );

  return (
    <div
      className={`arcade-stage${fs ? ' is-fs' : ''}`}
      style={rootStyle}
      data-game={id}
      data-slug={slug}
      data-layout={layout}
      data-phase={phase}
      data-compact={compact ? '' : undefined}
    >
      {/* Kopf — nur im klassischen Layout sichtbar */}
      <div className="arcade-stage__head">
        <div>
          <a className="arcade-stage__back" href={homeHref}>
            <i aria-hidden>←</i> <Bi de={P.back} en={PE.back} />
          </a>
          {meta ? (
            <p className="arcade-stage__eyebrow mono">
              {engine ? <span>{engine}</span> : null}
              {engine && version ? ' · ' : null}
              {version ? <b>{version}</b> : null}
            </p>
          ) : null}
          {layout === 'classic' ? (
            <h2 className="arcade-stage__title">
              <Bi de={title} en={titleEn} />
            </h2>
          ) : null}
        </div>
      </div>

      {/* Scrim vor der Shell im DOM: gleiche z-Ebene, die Shell malt darüber */}
      <div className="arcade-stage__scrim" hidden={!info} onClick={closeInfo} aria-hidden />

      {/* Der Bildschirm */}
      <div ref={shellRef} className="arcade-stage__shell" style={shellStyle}>
        <div ref={gameRef} className="arcade-stage__game">
          {live ? (
            <iframe
              key={frameKey}
              ref={frameRef}
              className="arcade-stage__frame"
              src={src}
              title={title}
              allow="fullscreen; gamepad; autoplay"
              allowFullScreen
              tabIndex={0}
              onLoad={() => frameRef.current?.contentWindow?.postMessage({ type: 'portfolio:game-status', id }, new URL(src, window.location.href).origin)}
              onError={onError}
            />
          ) : null}
        </div>

        {idle ? (
          <div className="arcade-stage__idle">
            {poster ? <img className="arcade-stage__poster" src={poster} alt={posterAlt ?? ''} data-alt-en={posterAltEn} decoding="async" /> : null}
            <div className="arcade-stage__scan" aria-hidden />
            <div className="arcade-stage__idle-inner">
              <button type="button" className="arcade-stage__play" onClick={start} disabled={phase === 'coin'}>
                <span className="arcade-stage__coin" aria-hidden />
                <Bi de={P.play} en={PE.play} />
              </button>
              {size && !compact ? (
                <p className="arcade-stage__size mono">
                  <Bi de={A.size} en={AE.size} /> · {size}
                </p>
              ) : null}
              {phone && !compact ? (
                <p className="arcade-stage__phone-note mono">
                  <Bi de={P.phoneNote} en={PE.phoneNote} />
                </p>
              ) : null}
            </div>
            <p className={`arcade-stage__badge mono${phase === 'coin' ? ' is-ok' : ''}`} aria-live="polite">
              {phase === 'coin' ? <Bi de={P.coinOk} en={PE.coinOk} /> : <Bi de={P.coin} en={PE.coin} />}
            </p>
          </div>
        ) : null}

        {phase === 'loading' || bootFade ? (
          <div className={`arcade-stage__load${bootFade ? ' is-out' : ''}`} role="status">
            <div className="arcade-stage__load-stack">
              <span className="arcade-stage__mark" aria-hidden />
              <p className="arcade-stage__ok mono">
                <Bi de={P.coinOk} en={PE.coinOk} />
              </p>
              <p className="arcade-stage__loading mono">
                <Bi de={stripEllipsis(P.loading)} en={stripEllipsis(PE.loading)} />
                <i className="arcade-stage__dots" aria-hidden>
                  {' '}
                  …
                </i>
              </p>
              <div className="arcade-stage__bar" aria-hidden>
                {SEGMENTS.map((i) => (
                  <span key={i} className="arcade-stage__seg" style={{ ['--i' as string]: i }} />
                ))}
              </div>
              <p className="arcade-stage__sub mono">
                <Bi de="Web-Build · lädt" en="Web build · loading" />
              </p>
            </div>
            {teaserDe ? (
              <p className="arcade-stage__teaser mono">
                <Bi de={teaserDe} en={teaserEn || teaserDe} />
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === 'fail' ? (
          <div className="arcade-stage__fail" role="alert">
            <p className="mono">
              <Bi de={P.loadFail} en={PE.loadFail} />
            </p>
            <button type="button" className="arcade-stage__retry mono" onClick={retry}>
              <Bi de={P.retry} en={PE.retry} />
            </button>
          </div>
        ) : null}

        {live ? <div className={`arcade-stage__crt${scan ? ' is-scan' : ''}`} aria-hidden /> : null}
      </div>

      {/* Kompakt + Phone: der Hinweis passt nicht mehr in den Bildschirm — er steht darunter */}
      {phone && compact && idle ? (
        <p className="arcade-stage__phone-note is-below mono" style={noteStyle}>
          <Bi de={P.phoneNote} en={PE.phoneNote} />
        </p>
      ) : null}

      {/* HUD-Leiste, 10 px unter dem Bildschirm */}
      <div className={`arcade-stage__hud${hud || confirm ? ' is-on' : ''}`} style={hudStyle} hidden={!live}>
        <div className="arcade-stage__hud-in">
          <button
            type="button"
            className="arcade-stage__hud-btn mono"
            onClick={toggleFullscreen}
            disabled={phase !== 'running'}
            aria-pressed={fs}
          >
            <span aria-hidden>⛶</span> <Bi de={P.fullscreen} en={PE.fullscreen} />
          </button>
          <span className="arcade-stage__hud-sep" aria-hidden />
          <button type="button" className="arcade-stage__hud-btn mono" onClick={() => setScan((s) => !s)} aria-pressed={scan}>
            <Bi de={P.scanlines} en={PE.scanlines} />
            <span className={`arcade-stage__led${scan ? ' is-on' : ''}`} aria-hidden />
          </button>
          <span className="arcade-stage__hud-sep" aria-hidden />
          {confirm ? (
            <span className="arcade-stage__confirm mono" role="group">
              <span className="arcade-stage__confirm-q">
                <Bi de={P.leaveGame} en={PE.leaveGame} />
              </span>
              <a className="arcade-stage__hud-btn is-quit mono" href={caseHref}>
                <Bi de={P.yesQuit} en={PE.yesQuit} />
              </a>
              <button ref={stayRef} type="button" className="arcade-stage__hud-btn mono" onClick={stay}>
                <Bi de={P.stay} en={PE.stay} />
              </button>
            </span>
          ) : (
            <a className="arcade-stage__hud-btn mono" href={caseHref} onClick={onQuitClick}>
              <span aria-hidden>■</span> <Bi de={P.quit} en={PE.quit} />
            </a>
          )}
        </div>
      </div>

      {/* Info-Tab am rechten Rand + Info-Panel (rect-Layout) */}
      {layout !== 'classic' ? (
        <>
          <div className="arcade-stage__tab">
            <button
              ref={infoBtnRef}
              type="button"
              className="arcade-stage__tab-btn"
              onClick={openInfo}
              aria-expanded={info}
              aria-controls="arcade-stage-info"
            >
              <span aria-hidden>ⓘ</span>
              <span className="arcade-stage__vert mono">
                <Bi de={P.info} en={PE.info} />
              </span>
            </button>
            <p className="arcade-stage__tab-label mono" aria-hidden>
              <b>
                <Bi de={title} en={titleEn} />
              </b>
              {version ? ` · ${version}` : null}
            </p>
            <span className="arcade-stage__tab-dot" aria-hidden />
          </div>

          <aside id="arcade-stage-info" ref={infoRef} className="arcade-stage__info" hidden={!info} aria-labelledby="arcade-stage-info-title">
            <div className="arcade-stage__info-head">
              <a className="arcade-stage__back" href={homeHref}>
                <i aria-hidden>←</i> <Bi de={P.back} en={PE.back} />
              </a>
              <button type="button" className="arcade-stage__x" onClick={closeInfo} data-autofocus>
                <span aria-hidden>✕</span>
                <span className="arcade-stage__sr">
                  <Bi de={P.close} en={PE.close} />
                </span>
              </button>
            </div>
            <div className="arcade-stage__info-body">
              {meta ? (
                <p className="arcade-stage__eyebrow mono">
                  {engine ? <span>{engine}</span> : null}
                  {engine && version ? ' · ' : null}
                  {version ? <b>{version}</b> : null}
                </p>
              ) : null}
              <h2 id="arcade-stage-info-title" className="arcade-stage__title">
                <Bi de={title} en={titleEn} />
              </h2>
              {infoBlocks}
              <div className="arcade-stage__block">{infoLinks}</div>
            </div>
            <div className="arcade-stage__info-foot">
              <button type="button" className="arcade-stage__btn arcade-stage__btn--primary" onClick={closeInfo}>
                <Bi de="Zurück zum Spiel" en="Back to the game" />
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* classic: Steuerung, WIP-Hinweis, Links unter der HUD-Leiste */}
      {layout === 'classic' ? (
        <div className="arcade-stage__below">
          <div>{infoBlocks}</div>
          {infoLinks}
        </div>
      ) : null}

      <p className="arcade-stage__hint mono">
        <Bi de={P.playHint} en={PE.playHint} />
      </p>
    </div>
  );
}

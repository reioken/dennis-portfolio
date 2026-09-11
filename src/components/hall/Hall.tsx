import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { navigate } from 'astro:transitions/client';
import { warmHallRoute, usePreparedHallRoute } from '../../lib/hall-route-cache';
import { copy } from '../../lib/i18n';
import LiveMark from '../launcher/LiveMark';
import Icon from '../icons/Icon';
import type { CtlAction, Frame, HallScene, Pose } from './hallScene';
import './hall.css';
import './hall-loading.css';

/** WebGL-Bühne nur im Browser laden — three.js bleibt aus dem Hauptbundle */
const Stage3D = lazy(() => import('./Stage3D'));

export type MachineKind = 'cabinet' | 'kiosk' | 'terminal' | 'jukebox';

export type HallMachine = {
  kind: MachineKind;
  slug: string;
  href: string;
  arcadeHref?: string;
  /** Ordner-ID des Web-Builds (public/arcade/<id>/) — verknüpft /arcade/<id>/ mit dem Automaten */
  arcadeId?: string;
  /** Steuerung als „A · B · C"-Liste — landet als Karte unter dem Bildschirm des Automaten */
  controls?: { de: string; en: string };
  title: string;
  titleEn?: string;
  summary: string;
  summaryEn?: string;
  brand: { primary: string; secondary?: string };
  /** Bis zu vier echte Captures, laufen als Loop auf dem Bildschirm */
  screens: string[];
  screenFormat: 'wide' | 'phone';
  logo?: string;
  /** Logo/Mark als transparente Textur fürs Leuchtschild */
  marquee?: string;
  logoLive?: string;
  version?: string;
  engine?: string;
  status: string;
  character?: string;
  /** GLB einer Figur, steht neben dem Automaten (statt des Sprites) */
  characterModel?: string;
  /** Idle-Animation als Sprite-Sheet (Frames im Raster), läuft auf dem Sprite neben dem Automaten */
  characterSheet?: { url: string; cols: number; rows: number; frames: number; fps: number };
  characterName?: string;
  /** Requisiten neben dem Automaten (GLB), z. B. das Taxi vor Cab No. 9 */
  props?: HallProp[];
};

export type HallProp = {
  url: string;
  /** Ziel-Länge (größte Ausdehnung) in Metern */
  size: number;
  x: number;
  z: number;
  rotY?: number;
  /** Meshes, deren Emission verstärkt wird (z. B. Dachleuchte) */
  glow?: string[];
};

export type HallSpecial = {
  kind: 'kasse' | 'phone';
  slug: string;
  href: string;
  portrait?: string;
  /** 3D-Figur (GLB) hinter der Theke — ersetzt das Porträt, sobald vorhanden */
  figure?: string;
};

export type HallItem = HallMachine | HallSpecial;

/**
 * Seitenmodus der Halle. `hall` = Startseite (Reihe, Schild, Leiste). `case` = eine Projektseite:
 * die Kamera steht vor dem Automaten, rechts (oder unten) sitzt das Panel mit dem Inhalt.
 * `arcade` = die Kamera steht vor dem Bildschirm, der Web-Build läuft als iframe darauf.
 */
export type HallMode = 'hall' | 'case' | 'arcade';

type Props = {
  items: HallItem[];
  /** Station, vor der die Halle beim Laden steht (Slug aus items) */
  initialSlug?: string;
  mode?: HallMode;
  /** Link zur Halle (mit Basis-Pfad) */
  homeHref?: string;
  /** Seitentitel (H1, nur für Screenreader und Audit) — kommt aus den Site-Daten, keine eigene Copy */
  heading?: string;
};

const IDLE_MS = 28_000;
const ATTRACT_STEP_MS = 4_500;
const PAD_REPEAT_MS = 240;
const SPACING = 360;
const DEPTH = 130;
const ANGLE = 26;
const VISIBLE = 5;

function Bi({ de, en }: { de: string; en?: string }) {
  if (!en || en === de) return <>{de}</>;
  return (
    <>
      <span data-lang="de">{de}</span>
      <span data-lang="en">{en}</span>
    </>
  );
}

export const isMachine = (it: HallItem): it is HallMachine => it.kind !== 'kasse' && it.kind !== 'phone';

/** Position eines Automaten relativ zum Fokus — Reihe, die in die Halle zurückweicht */
function placement(d: number) {
  const a = Math.abs(d);
  const x = d * SPACING;
  const z = d === 0 ? 0 : -(110 + a * DEPTH);
  const ry = d === 0 ? 0 : d < 0 ? ANGLE + a * 4 : -(ANGLE + a * 4);
  return { transform: `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) rotateY(${ry}deg)` };
}

/* ---------- Route → Zustand ---------- */

export type RouteState = {
  mode: HallMode;
  /** Station, die zur Route gehört (-1 = keine) */
  index: number;
  /** Zielseite trägt keine Halle (Über mich, Kontakt, Archiv …) — die Insel wird gleich abgebaut */
  exit: boolean;
};

function normPath(s: string) {
  const t = s.replace(/^\/en(?=\/|$)/, '') || '/';
  return t.endsWith('/') ? t : `${t}/`;
}

/** Welche Station und welcher Modus zu einer URL gehören (mit oder ohne /en/-Präfix) */
export function routeState(pathname: string, items: HallItem[]): RouteState {
  const path = normPath(pathname);
  const w = path.match(/^\/work\/([^/]+)\/$/);
  if (w) {
    const i = items.findIndex((it) => it.slug === w[1]);
    return i >= 0 ? { mode: 'case', index: i, exit: false } : { mode: 'hall', index: -1, exit: true };
  }
  const a = path.match(/^\/arcade\/([^/]+)\/$/);
  if (a) {
    const i = items.findIndex((it) => isMachine(it) && it.arcadeId === a[1]);
    if (i >= 0) return { mode: 'arcade', index: i, exit: false };
  }
  const s = items.findIndex((it) => !isMachine(it) && normPath(it.href) === path);
  // About and contact both keep their machine in the persistent hall.
  if (s >= 0) return { mode: 'case', index: s, exit: false };
  return { mode: 'hall', index: -1, exit: path !== '/' };
}

/** Höhe der Navigation in Pixeln (--nav-h kann in rem stehen) */
function navHeight() {
  // am <body> lesen: dort greifen die Overrides für Close-up und Spiel (tokens.css)
  const raw = getComputedStyle(document.body).getPropertyValue('--nav-h').trim();
  const v = parseFloat(raw);
  if (!Number.isFinite(v) || v <= 0) return 40;
  return raw.endsWith('rem') ? v * parseFloat(getComputedStyle(document.documentElement).fontSize) : v;
}

/** Lücke zwischen Automat und Panel je Breakpoint (hall-panel.css: --gap) */
function panelGap(W: number) {
  return W >= 1440 ? 64 : W >= 1180 ? 56 : 48;
}

/**
 * Freier Bereich des Viewports, in dem der Automat stehen soll: links vom Panel (Desktop) oder
 * über dem Sheet (Phone). Desktop: „Schild am Exponat“ — der Automat steht rechtsbündig an der
 * Kante `ax` (Panel-Linke minus Lücke), Automat und Panel lesen sich als eine Gruppe. Vor dem
 * Seitenwechsel gibt es das Panel noch nicht — dann wird die Lage aus denselben Breakpoints
 * vorhergesagt, nach dem Wechsel exakt gemessen.
 */
export function measureFrame(kind: 'hall' | 'case' | 'arcade' | 'center' | 'screen', about = false, predict = false): Frame {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const nh = navHeight();
  // Zusammengeklapptes Fenster: neutraler Frame statt NaN
  if (!W || !H) return { cx: .5, cy: .5, fw: 1, fh: 1 };
  if (kind === 'hall') {
    const dock = document.querySelector<HTMLElement>('.hall-dock');
    const bottom = dock?.getBoundingClientRect().top || H - (W < 900 ? 158 : 112);
    return { cx: .5, cy: (nh + bottom) / 2 / H, fw: 1, fh: Math.max(.3, (bottom - nh) / H) };
  }
  if (kind === 'screen') {
    // Close-up: Desktop wie die Spielhalle (Leiste rechts), Phone: Hero wächst auf 62 svh, darunter die Leiste
    if (W >= 900) {
      const usable = Math.max(240, H - nh - 92);
      return { cx: 0.5, cy: (nh + usable / 2) / H, fw: 0.96, fh: usable / H };
    }
    const t0 = nh + 44;
    const b0 = Math.max(t0 + 120, H * 0.62);
    return { cx: 0.5, cy: (t0 + (b0 - t0) / 2) / H, fw: 1, fh: (b0 - t0) / H, tight: true };
  }
  if (kind === 'center') return { cx: 0.5, cy: (nh + (H - nh) / 2) / H, fw: 1, fh: (H - nh) / H };
  if (kind === 'arcade') {
    const tab = W >= 900 ? 64 : 0;
    return { cx: (W - tab) / 2 / W, cy: (nh + (H - nh) / 2) / H, fw: (W - tab) / W, fh: (H - nh) / H };
  }
  let left = W;
  let top = H;
  const panel = predict ? null : document.querySelector<HTMLElement>('.hall-panel');
  if (panel) {
    const r = panel.getBoundingClientRect();
    if (r.width < W * 0.9) left = r.left;
    else top = r.top;
  } else if (W >= 900) {
    // Vorhersage der Panel-Linken (hall-panel.css), damit der erste Frame nicht springt:
    // Über mich folgt --panel-left, Projekte der A1-Geometrie (Karte links der Mitte, Breite wächst mit dem Schirm)
    if (about) {
      left = W >= 1180 ? Math.min(760, Math.max(440, W * 0.36)) : W - 24 - 452;
    } else if (W >= 1440) {
      const pw = Math.min(780, Math.max(520, W * 0.38));
      left = W / 2 - 60 - (pw - 520) / 2;
    } else if (W >= 1180) {
      const pw = Math.min(560, Math.max(480, W * 0.38));
      left = W / 2 - 40 - (pw - 480) / 2;
    } else left = W - 24 - 452;
  } else {
    top = H * 0.44;
  }
  if (left < W) {
    const ax = Math.max(0.3, (left - panelGap(W)) / W);
    // Über mich: der Automat steht links am Rand (gleicher Abstand wie rechts vom Panel), das Panel folgt seiner Kante
    if (about) {
      const margin = W >= 1440 ? 40 : 32;
      return { cx: ax / 2, cy: (nh + (H - nh) / 2) / H, fw: ax, fh: (H - nh) / H, al: margin / W };
    }
    return { cx: ax / 2, cy: (nh + (H - nh) / 2) / H, fw: ax, fh: (H - nh) / H, ax };
  }
  // Sheet: über dem Hero liegen die Chrome-Pills (8 + 32 px) — der Automat beginnt darunter
  const t0 = nh + 44;
  return { cx: 0.5, cy: (t0 + (top - t0) / 2) / H, fw: 1, fh: Math.max(0.2, (top - t0) / H) };
}

const poseFor = (mode: HallMode): Pose => (mode === 'case' ? 'zoom' : mode === 'arcade' ? 'play' : 'hall');

/** Links zur Klickzeit an die Sprache anpassen — die persistente Insel behält ihre Start-Props */
function langHref(href: string) {
  const en = document.documentElement.dataset.lang === 'en';
  // A persistent island may have been hydrated on an English route. Normalize
  // those original props before applying the currently selected language.
  const base = href.replace(/^\/en(?=\/|$)/, '') || '/';
  return en ? `/en${base}` : base;
}

const modifiedClick = (event: React.MouseEvent) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

type PrepEvent = Event & { to: URL; from?: URL; loader: () => Promise<void>; navigationType?: string; signal: AbortSignal; formData?: FormData; newDocument: Document };

export default function Hall({ items, initialSlug, mode: initialMode = 'hall', homeHref = '/', heading = '' }: Props) {
  // SSR-sicher: die Systemeinstellung erst nach dem Mount übernehmen — sonst weicht das erste Client-Markup
  // (Live-Marken im Cast) vom Server-HTML ab und React baut den ganzen Baum neu auf
  const reduceMq = useReducedMotion();
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(Boolean(reduceMq)), [reduceMq]);
  const [lang, setLang] = useState<'de' | 'en' | null>(null);
  useEffect(() => {
    const read = () => setLang(document.documentElement.dataset.lang === 'en' ? 'en' : 'de');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => observer.disconnect();
  }, []);
  // Preserve the server link on first render, then keep native new-tab/copy-link
  // actions in sync with language switches too.
  const pageHref = (href: string) => lang === null ? href : `${lang === 'en' ? '/en' : ''}${href.replace(/^\/en(?=\/|$)/, '') || '/'}`;
  const n = items.length;
  const [focus, setFocus] = useState(() => {
    const i = items.findIndex((it) => it.slug === initialSlug);
    return i >= 0 ? i : 0;
  });
  const [mode, setMode] = useState<HallMode>(initialMode);
  /** Close-up (Pose `screen`): die Seite (CaseCaptures) besitzt den Zustand und meldet ihn per hall:closeup */
  const [closeup, setCloseup] = useState(false);
  const closeupRef = useRef(false);
  closeupRef.current = closeup;
  const [attract, setAttract] = useState(false);
  const [pad, setPad] = useState(false);
  const directoryRef = useRef<HTMLDialogElement>(null);
  /** 'css' beim SSR und ohne WebGL; 'load' sobald der Browser kann; 'on' wenn die Bühne steht */
  const [gl, setGl] = useState<'css' | 'load' | 'on'>('css');
  const glRef = useRef(gl);
  glRef.current = gl;
  const [lite, setLite] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HallScene | null>(null);
  const frameRef = useRef<Frame>({ cx: 0.5, cy: 0.5, fw: 1, fh: 1 });
  const idleTimer = useRef<number | null>(null);
  const attractTimer = useRef<number | null>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const H = copy.de.hall;
  const HE = copy.en.hall;
  const L = copy.de.launcher;
  const LE = copy.en.launcher;

  const current = items[focus];
  const inHall = mode === 'hall';

  /* Die Leiste oben zeigt die Station: bei jedem Fokus- oder Moduswechsel melden */
  useEffect(() => {
    const it = items[focus];
    if (!it) return;
    const title = isMachine(it) ? it.title : it.kind === 'kasse' ? copy.de.hall.kasseSub : copy.de.hall.phoneSub;
    const titleEn = isMachine(it) ? (it.titleEn ?? it.title) : it.kind === 'kasse' ? copy.en.hall.kasseSub : copy.en.hall.phoneSub;
    document.dispatchEvent(new CustomEvent('hall:focus', { detail: { index: focus, total: items.length, title, titleEn, version: isMachine(it) ? it.version : undefined, mode } }));
  }, [focus, mode, items]);

  const go = useCallback((href: string) => {
    const target = langHref(href);
    const route = routeState(new URL(target, location.href).pathname, items);
    performance.mark('hall:click');
    if (route.index >= 0 && route.mode === 'case') {
      setFocus(route.index);
      focusRef.current = route.index;
    }
    void navigate(target);
  }, [items]);
  const move = useCallback((delta: number) => setFocus((f) => Math.min(Math.max(f + delta, 0), n - 1)), [n]);
  /** Im Zoom: zum Nachbarn gehen heißt dessen Seite öffnen */
  const walk = useCallback(
    (delta: number) => {
      const t = items[Math.min(Math.max(focusRef.current + delta, 0), n - 1)];
      if (t && t !== items[focusRef.current]) go(t.href);
    },
    [items, n, go],
  );
  const random = useCallback(() => {
    if (n < 2) return;
    if (modeRef.current !== 'hall') {
      let r = focusRef.current;
      while (r === focusRef.current) r = Math.floor(Math.random() * n);
      const t = items[r];
      if (t) go(t.href);
      return;
    }
    setFocus((f) => {
      let r = f;
      while (r === f) r = Math.floor(Math.random() * n);
      return r;
    });
  }, [n, items, go]);
  const open = useCallback(() => {
    const t = items[focusRef.current];
    if (t) go(t.href);
  }, [items, go]);
  const back = useCallback(() => {
    if (modeRef.current === 'arcade') {
      const t = items[focusRef.current];
      go(t ? t.href : homeHref);
    } else go(homeHref);
  }, [items, go, homeHref]);

  /* ---------- Attract (nur in der Halle) ---------- */
  const stopAttract = useCallback(() => {
    setAttract(false);
    if (attractTimer.current) {
      window.clearInterval(attractTimer.current);
      attractTimer.current = null;
    }
  }, []);
  const armIdle = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
    // A chosen station stays selected. Touring starts only through its control.
  }, []);
  useEffect(() => {
    if (!attract) return;
    attractTimer.current = window.setInterval(() => {
      setFocus((f) => (f + 1) % n);
    }, ATTRACT_STEP_MS);
    return () => {
      if (attractTimer.current) window.clearInterval(attractTimer.current);
      attractTimer.current = null;
    };
  }, [attract, n]);
  useEffect(() => {
    const wake = () => {
      if (attract) stopAttract();
      armIdle();
    };
    const o: AddEventListenerOptions = { passive: true };
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const) window.addEventListener(ev, wake, o);
    const vis = () => (document.hidden ? stopAttract() : armIdle());
    document.addEventListener('visibilitychange', vis);
    armIdle();
    return () => {
      for (const ev of ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const) window.removeEventListener(ev, wake);
      document.removeEventListener('visibilitychange', vis);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [attract, armIdle, stopAttract]);
  useEffect(() => {
    if (mode !== 'hall') stopAttract();
    else armIdle();
  }, [mode, stopAttract, armIdle]);

  /* ---------- WebGL erkennen (einmal pro Sitzung), dann die 3D-Bühne nachladen ---------- */
  useEffect(() => {
    try {
      const w = window as Window & { __glOk?: boolean };
      let ok = w.__glOk;
      if (ok === undefined) {
        const c = document.createElement('canvas');
        const g = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
        ok = w.__glOk = Boolean(g);
        // Probe-Kontext sofort freigeben — Chrome hält nur ~16 Kontexte pro Seite
        g?.getExtension('WEBGL_lose_context')?.loseContext();
      }
      if (!ok) {
        document.documentElement.classList.remove('gl-pending');
        return;
      }
      const small = window.matchMedia('(max-width: 760px)').matches;
      const weak = (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ? (navigator.hardwareConcurrency ?? 8) <= 4 : false;
      setLite(small || weak);
      frameRef.current = measureFrame(initialMode, items[focusRef.current]?.kind === 'kasse');
      setGl('load');
    } catch {
      document.documentElement.classList.remove('gl-pending');
    }
    // nur beim Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Bühne steht oder scheitert → Kulissen-Sperre lösen. Der Startwert 'css' (SSR) zählt nicht:
     erst nach der WebGL-Probe darf die CSS-Kulisse erscheinen — sonst blitzt die alte Reihe auf. */
  const prevGl = useRef<'css' | 'load' | 'on'>('css');
  useEffect(() => {
    const was = prevGl.current;
    prevGl.current = gl;
    if (gl === 'on' || (gl === 'css' && was !== 'css')) document.documentElement.classList.remove('gl-pending');
  }, [gl]);

  /* ---------- Router: Route → Zustand, Zoom vor dem Seitenwechsel ---------- */
  useEffect(() => {
    // Nach jedem Wechsel (push, replace, zurück, vor): Modus und Station aus der URL
    let navigationStarted = 0;
    let inputAt = 0;
    const input = () => { inputAt = performance.now(); };
    document.addEventListener('click', input, true);
    document.addEventListener('keydown', input, true);
    let hallNavigation = false;
    const apply = () => {
      const r = routeState(location.pathname, items);
      performance.mark('hall:panel-ready');
      const started = navigationStarted;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (rootRef.current && started === navigationStarted) {
          rootRef.current.dataset.panelPaintMs = String(Math.round(performance.now() - started));
        }
      }));
      if (rootRef.current && navigationStarted) rootRef.current.dataset.navigationMs = String(Math.round(performance.now() - navigationStarted));
      if (r.exit) {
        stopAttract();
        setCloseup(false);
        sceneRef.current?.stop();
        return;
      }
      // Route arrivals use one brief panel animation alongside the live camera.
      document.documentElement.classList.add('hall-nav');
      document.documentElement.classList.remove('is-screen', 'is-screen-info', 'hall-leaving');
      delete document.body.dataset.screen;
      setCloseup(false);
      setMode(r.mode);
      if (r.index >= 0) setFocus(r.index);
      // Refs sofort nachziehen: astro:page-load (loaded) kommt vor dem React-Commit und misst sonst mit dem alten Modus
      modeRef.current = r.mode;
      if (r.index >= 0) focusRef.current = r.index;
      const sc = sceneRef.current;
      if (sc) {
        if (r.index >= 0) sc.setFocus(r.index);
        sc.setPose(poseFor(r.mode), measureFrame(r.mode, r.index >= 0 && items[r.index].kind === 'kasse'));
        sc.start();
        document.documentElement.classList.remove('gl-pending');
      }
    };
    // Start the camera as the next page loads; navigation is never held for the animation.
    const prep = (e: Event) => {
      const ev = e as PrepEvent;
      if (!ev.to) return;
      const now = performance.now();
      navigationStarted = inputAt && now - inputAt < 1000 ? inputAt : now;
      const r = routeState(ev.to.pathname, items);
      hallNavigation = !r.exit;
      if (hallNavigation) {
        const cached = usePreparedHallRoute(ev);
        if (rootRef.current) rootRef.current.dataset.navigationCache = cached ? 'hit' : 'miss';
      }
      document.documentElement.classList.toggle('hall-routing', hallNavigation);
      // Closing starts with the input, including Back/Escape and the top navigation.
      document.documentElement.classList.toggle('hall-leaving', r.exit || r.mode === 'hall');
      if (r.mode === 'hall' && !r.exit) {
        setMode('hall');
        modeRef.current = 'hall';
      }
      const sc = sceneRef.current;
      if (!sc) return;
      if (r.index >= 0) {
        setFocus(r.index);
        focusRef.current = r.index;
        sc.setFocus(r.index);
      }
      const pose: Pose = r.mode === 'case' || (r.exit && r.index >= 0) ? 'zoom' : r.mode === 'arcade' ? 'play' : 'hall';
      const frame = r.exit ? measureFrame(r.index >= 0 ? 'center' : 'hall', false, true) : measureFrame(r.mode, r.index >= 0 && items[r.index].kind === 'kasse', true);
      document.documentElement.classList.remove('is-screen', 'is-screen-info');
      setCloseup(false);
      stopAttract();
      sc.start();
      sc.setPose(pose, frame);
      // Sofortige Rückmeldung: die Karte weicht schon, während die Kamera losfährt
      if (r.exit) document.documentElement.classList.add('hall-leaving');
      // Navigation and camera movement run together; never delay a ready page for animation.
    };
    // Seite ist da: Panel exakt vermessen (vorher war die Breite nur vorhergesagt)
    const loaded = () => {
      document.documentElement.classList.remove('hall-routing');
      if (routeState(location.pathname, items).exit) return;
      const sc = sceneRef.current;
      if (!sc || closeupRef.current) return;
      frameRef.current = measureFrame(modeRef.current, items[focusRef.current]?.kind === 'kasse');
      sc.setFrame(frameRef.current);
    };
    // Während des DOM-Tauschs nicht rendern: ein teurer WebGL-Frame darf den Übergang nicht ausbremsen
    // (die Kamerafahrt ist zeitbasiert und holt die Pause auf)
    const pause = (event: Event) => {
      // The persistent WebGL stage already animates. Native snapshots freeze that
      // stage and add a second transition; swap the DOM without capturing it.
      if (hallNavigation) {
        const swap = event as Event & { viewTransition?: ViewTransition; newDocument: Document };
        // Skipping deliberately rejects ready with AbortError. Consume that
        // expected rejection before skipping so it is not an unhandled error.
        if (swap.viewTransition) {
          void swap.viewTransition.ready.catch(() => {});
          swap.viewTransition.skipTransition();
        }
        swap.newDocument.documentElement.classList.add('hall-routing');
      }
      sceneRef.current?.stop();
    };
    document.addEventListener('astro:after-swap', apply);
    document.addEventListener('astro:before-preparation', prep);
    document.addEventListener('astro:before-swap', pause);
    document.addEventListener('astro:page-load', loaded);
    return () => {
      document.removeEventListener('click', input, true);
      document.removeEventListener('keydown', input, true);
      document.removeEventListener('astro:after-swap', apply);
      document.removeEventListener('astro:before-preparation', prep);
      document.removeEventListener('astro:before-swap', pause);
      document.removeEventListener('astro:page-load', loaded);
    };
  }, [items, reduce, stopAttract]);

  /* Fenstergröße: freien Bereich neu messen */
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const sc = sceneRef.current;
        if (!sc) return;
        frameRef.current = measureFrame(closeupRef.current ? 'screen' : modeRef.current, items[focusRef.current]?.kind === 'kasse');
        sc.setFrame(frameRef.current);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* Seiteninhalt spricht mit der Bühne: Capture auf den Bildschirm, Spiel läuft (Bildschirm schwarz) */
  useEffect(() => {
    const onScreen = (e: Event) => {
      const d = (e as CustomEvent<{ src?: string | null }>).detail;
      sceneRef.current?.showScreen(d?.src ?? null);
    };
    const onPlay = (e: Event) => {
      const d = (e as CustomEvent<{ state?: string }>).detail;
      sceneRef.current?.setBlackout(d?.state === 'running');
      // Leiste oben wird beim Spielen leise (GlassNav beobachtet data-playing)
      if (d?.state === 'running') document.body.dataset.playing = '1';
      else delete document.body.dataset.playing;
    };
    // Close-up an/aus: Kamera an den Bildschirm samt Bedienfeld, Panel weicht der Leiste (CSS über html.is-screen)
    const onCloseup = (e: Event) => {
      const d = (e as CustomEvent<{ on?: boolean }>).detail;
      const on = Boolean(d?.on) && modeRef.current === 'case';
      if (on === closeupRef.current) return;
      closeupRef.current = on;
      setCloseup(on);
      document.documentElement.classList.toggle('is-screen', on);
      // Leiste wird niedriger (--nav-h) — vor dem Messen des Frames setzen
      if (on) document.body.dataset.screen = '1';
      else delete document.body.dataset.screen;
      if (!on) document.documentElement.classList.remove('is-screen-info');
      const sc = sceneRef.current;
      if (!sc) return;
      frameRef.current = measureFrame(on ? 'screen' : 'case');
      sc.setPose(on ? 'screen' : 'zoom', frameRef.current);
      sc.start();
    };
    const onCtl = (e: Event) => {
      const d = (e as CustomEvent<{ name?: string; action?: CtlAction; dir?: -1 | 1 }>).detail;
      if (!d?.name) return;
      if (d.dir) sceneRef.current?.joyDir(d.dir);
      if (d.action) sceneRef.current?.ctl(d.name, d.action);
    };
    // Seite bittet um eine neue Projektion (Rechteck kam nicht an): Frame neu messen, ohne Renderer-Resize
    const onReframe = () => {
      const sc = sceneRef.current;
      if (!sc) return;
      frameRef.current = measureFrame(closeupRef.current ? 'screen' : modeRef.current, items[focusRef.current]?.kind === 'kasse');
      sc.setFrame(frameRef.current);
    };
    document.addEventListener('hall:screen', onScreen);
    document.addEventListener('hall:play', onPlay);
    document.addEventListener('hall:closeup', onCloseup);
    document.addEventListener('hall:ctl', onCtl);
    document.addEventListener('hall:reframe', onReframe);
    return () => {
      document.removeEventListener('hall:screen', onScreen);
      document.removeEventListener('hall:play', onPlay);
      document.removeEventListener('hall:closeup', onCloseup);
      document.removeEventListener('hall:ctl', onCtl);
      document.removeEventListener('hall:reframe', onReframe);
    };
  }, []);

  /* Warm only likely destinations, after scene assets have priority on the connection. */
  useEffect(() => {
    if (gl !== 'on' || !current) return;
    const timer = window.setTimeout(() => {
      if (mode !== 'hall') warmHallRoute(langHref(homeHref));
      for (const item of items.slice(Math.max(0, focus - 1), focus + 2)) {
        warmHallRoute(langHref(item.href));
      }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [gl, mode, current, focus, items, homeHref, lang]);

  /* ---------- Tastatur ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rootRef.current?.closest('[data-hall-parked]')) return;
      if (directoryRef.current?.open) return;
      if (document.documentElement.classList.contains('is-reading')) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.site-nav')) return;
      // Eingabefelder behalten ihre Tasten — die Sheet-Raste (Checkbox) nicht, sonst ist nach dem Tippen Esc tot
      const isCheck = t?.tagName === 'INPUT' && /^(checkbox|radio)$/.test((t as HTMLInputElement).type);
      if (t && !isCheck && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const m = modeRef.current;
      // Im Close-up gehören alle Tasten der Seite (CaseCaptures hört auf document und blockt vorher)
      if (m === 'case' && closeupRef.current) return;
      if (m !== 'hall') {
        // Innerhalb der Captures-Leiste gehören die Pfeile der Leiste
        const inStrip = Boolean(t?.closest?.('.captures'));
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            back();
            return;
          case 'ArrowRight':
          case 'ArrowLeft':
            if (m !== 'case' || inStrip) return;
            e.preventDefault();
            walk(e.key === 'ArrowRight' ? 1 : -1);
            return;
          case 'Home':
          case 'End': {
            if (m !== 'case') return;
            e.preventDefault();
            const target = items[e.key === 'Home' ? 0 : n - 1];
            if (target) go(target.href);
            return;
          }
          case 'r':
          case 'R':
            if (m !== 'case') return;
            e.preventDefault();
            random();
            return;
          default:
            return;
        }
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'd':
          e.preventDefault();
          move(1);
          break;
        case 'ArrowLeft':
        case 'a':
          e.preventDefault();
          move(-1);
          break;
        case 'Home':
          e.preventDefault();
          setFocus(0);
          break;
        case 'End':
          e.preventDefault();
          setFocus(n - 1);
          break;
        case 'Enter':
          if (t && (t.tagName === 'A' || t.tagName === 'BUTTON')) return;
          e.preventDefault();
          open();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          random();
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, n, open, random, walk, back, go, items]);

  /* ---------- Mausrad + Wischen ---------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let acc = 0;
    let last = 0;
    let scroller: HTMLElement | null = null;
    let scrollerAt = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || directoryRef.current?.open || document.documentElement.classList.contains('is-reading')) return;
      if (modeRef.current !== 'hall') {
        // Im Close-up blättert das Rad die Captures (CaseCaptures hört auf document)
        if (closeupRef.current) return;
        // Über der Bühne scrollt das Rad das Panel — die Halle geht nicht weiter
        const now = performance.now();
        if (!scroller || !scroller.isConnected || now - scrollerAt > 2000) {
          scrollerAt = now;
          const panel = document.querySelector<HTMLElement>('.hall-panel');
          scroller = panel ? Array.from(panel.querySelectorAll<HTMLElement>('*')).find((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY)) ?? null : null;
        }
        if (scroller) {
          e.preventDefault();
          scroller.scrollBy({ top: e.deltaY, behavior: 'auto' });
        }
        return;
      }
      if (root.classList.contains('is-compact') && !(glRef.current !== 'css' || document.documentElement.classList.contains('gl-pending'))) return;
      e.preventDefault();
      const now = performance.now();
      if (now - last < 320) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? root.clientHeight : 1;
      acc += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      if (Math.abs(acc) > 40) {
        move(acc > 0 ? 1 : -1);
        last = now;
        acc = 0;
      }
    };
    let sx = 0;
    let sy = 0;
    let pointerId: number | null = null;
    let suppressClickUntil = 0;
    const onDown = (e: PointerEvent) => {
      // A new deliberate tap/click must work immediately after the swipe.
      if (e.isPrimary) suppressClickUntil = 0;
      if (e.pointerType === 'mouse' || !e.isPrimary || directoryRef.current?.open) return;
      if ((e.target as HTMLElement).closest('.hall-dock, dialog, input, textarea, select')) return;
      sx = e.clientX;
      sy = e.clientY;
      pointerId = e.pointerId;
    };
    const onUp = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      // Kompakt ohne WebGL scrollt die CSS-Reihe nativ; mit 3D-Bühne wischt man durch die Halle
      if (root.classList.contains('is-compact') && !root.classList.contains('is-3d')) return;
      if (closeupRef.current || directoryRef.current?.open) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        // A touch swipe may still synthesize a click on the canvas. Do not
        // open whichever machine happens to be under the release position.
        suppressClickUntil = performance.now() + 500;
        if (modeRef.current === 'case') walk(dx < 0 ? 1 : -1);
        else if (modeRef.current === 'hall') move(dx < 0 ? 1 : -1);
      }
    };
    const onCancel = () => { pointerId = null; };
    const onClickCapture = (e: MouseEvent) => {
      if (e.detail !== 0 && performance.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickUntil = 0;
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown, { passive: true });
    root.addEventListener('pointerup', onUp, { passive: true });
    root.addEventListener('pointercancel', onCancel, { passive: true });
    root.addEventListener('click', onClickCapture, true);
    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onCancel);
      root.removeEventListener('click', onClickCapture, true);
    };
  }, [move, walk]);

  /* ---------- Gamepad ---------- */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    let raf = 0;
    let lastMove = 0;
    let prev: boolean[] = [];
    const poll = (t: number) => {
      if (rootRef.current?.closest('[data-hall-parked]')) {
        prev = [];
        raf = requestAnimationFrame(poll);
        return;
      }
      const gp = Array.from(navigator.getGamepads?.() ?? []).find((g) => g && g.connected);
      if (!gp) {
        raf = requestAnimationFrame(poll);
        return;
      }
      const m = modeRef.current;
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      const left = gp.buttons[14]?.pressed || ax < -0.5;
      const right = gp.buttons[15]?.pressed || ax > 0.5;
      const up = gp.buttons[12]?.pressed || ay < -0.5;
      const down = gp.buttons[13]?.pressed || ay > 0.5;
      const pressed = gp.buttons.map((b) => b.pressed);
      const rising = (i: number) => pressed[i] && !prev[i];
      if (directoryRef.current?.open || document.documentElement.classList.contains('is-reading')) {
        prev = pressed;
        raf = requestAnimationFrame(poll);
        return;
      }
      if (m === 'case' && closeupRef.current) {
        // Close-up: das Pad blättert die Captures — die Seite bekommt die Tasten (hall:pad)
        const pad = (btn: string) => document.dispatchEvent(new CustomEvent('hall:pad', { detail: { btn } }));
        if ((left || right || up || down) && t - lastMove > PAD_REPEAT_MS) {
          lastMove = t;
          pad(left ? 'left' : right ? 'right' : up ? 'up' : 'down');
        }
        if (rising(0)) pad('a');
        if (rising(1)) pad('b');
        if (rising(2)) pad('x');
        if (rising(3)) pad('y');
        if (rising(4)) pad('lb');
        if (rising(5)) pad('rb');
        prev = pressed;
        raf = requestAnimationFrame(poll);
        return;
      }
      if ((left || right) && t - lastMove > PAD_REPEAT_MS && m !== 'arcade') {
        lastMove = t;
        if (m === 'hall') move(left ? -1 : 1);
        else walk(left ? -1 : 1);
        stopAttract();
        armIdle();
      }
      if (rising(0)) {
        if (m === 'hall') open();
        else if (m === 'case') {
          const cur = items[focusRef.current];
          if (cur && isMachine(cur) && cur.arcadeHref) go(cur.arcadeHref);
        }
      }
      if (rising(1) && m !== 'hall') back();
      if (rising(3) && m === 'hall') {
        random();
        stopAttract();
        armIdle();
      }
      prev = pressed;
      raf = requestAnimationFrame(poll);
    };
    const onConnect = () => {
      setPad(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(poll);
    };
    const onDisconnect = () => {
      if (!Array.from(navigator.getGamepads?.() ?? []).some((g) => g && g.connected)) {
        setPad(false);
        cancelAnimationFrame(raf);
      }
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    if (Array.from(navigator.getGamepads?.() ?? []).some((g) => g && g.connected)) onConnect();
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      cancelAnimationFrame(raf);
    };
  }, [move, open, random, stopAttract, armIdle, walk, back, go, items]);

  /* ---------- Kompakt (schmale Screens): Fokus folgt dem Scrollen ---------- */
  useEffect(() => {
    const root = rootRef.current;
    const row = rowRef.current;
    if (!root || !row) return;
    const mq = window.matchMedia('(max-width: 760px)');
    const apply = () => root.classList.toggle('is-compact', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    let raf = 0;
    const onScroll = () => {
      if (!mq.matches || modeRef.current !== 'hall' || (glRef.current !== 'css' || document.documentElement.classList.contains('gl-pending'))) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if ((glRef.current !== 'css' || document.documentElement.classList.contains('gl-pending'))) return;
        const mid = row.scrollLeft + row.clientWidth / 2;
        let best = 0;
        let bestD = Infinity;
        row.querySelectorAll<HTMLElement>('.machine').forEach((el, i) => {
          const c = el.offsetLeft + el.offsetWidth / 2;
          const d = Math.abs(c - mid);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        setFocus(best);
      });
    };
    row.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mq.removeEventListener('change', apply);
      row.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* Kompakt: fokussierten Automaten in die Mitte scrollen (Tastatur/Gamepad) */
  useEffect(() => {
    const root = rootRef.current;
    const row = rowRef.current;
    if (!root || !row || gl !== 'css' || document.documentElement.classList.contains('gl-pending') || !root.classList.contains('is-compact') || mode !== 'hall') return;
    const el = row.querySelectorAll<HTMLElement>('.machine')[focus];
    if (!el) return;
    const left = el.offsetLeft - row.clientWidth / 2 + el.offsetWidth / 2;
    if (Math.abs(row.scrollLeft - left) > 4) row.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  }, [focus, reduce, mode, gl]);

  if (!current) return null;
  const brand = isMachine(current) ? current.brand.primary : '#c8daf4';
  const brand2 = isMachine(current) ? (current.brand.secondary ?? brand) : '#ac8bfd';
  const status = isMachine(current) ? ((L.status as Record<string, string>)[current.status] ?? current.status) : '';
  const statusEn = isMachine(current) ? ((LE.status as Record<string, string>)[current.status] ?? current.status) : '';

  return (
    <section
      ref={rootRef}
      className={`hall is-${mode}${closeup ? ' is-screen' : ''}${attract ? ' is-attract' : ''}${pad ? ' has-pad' : ''}${gl === 'on' ? ' is-3d' : ''}`}
      style={{ ['--brand' as string]: brand, ['--brand-2' as string]: brand2 }}
      aria-label={lang === 'en' ? 'Portfolio hall' : 'Portfolio-Halle'}
      aria-hidden={inHall ? undefined : true}
      data-focus={current.slug}
      data-mode={mode}
    >
      {gl !== 'css' ? (
        <Suspense fallback={null}>
          <Stage3D
            items={items}
            focus={focus}
            attract={attract}
            reduce={reduce}
            lite={lite}
            pose={poseFor(initialMode)}
            frame={frameRef.current}
            onScene={(s) => {
              sceneRef.current = s;
            }}
            onPick={(i) => {
              if (modeRef.current === 'hall') setFocus(i);
              else if (modeRef.current === 'case') {
                const t = items[i];
                if (t) go(t.href);
              }
            }}
            onOpen={(i) => {
              if (modeRef.current !== 'hall') return;
              const t = items[i];
              if (t) go(t.href);
            }}
            onScreenClick={() => document.dispatchEvent(new CustomEvent('hall:screenclick'))}
            onBackdrop={() => {
              // Klick ins Leere: aus dem Close-up zurück zum Automaten, aus dem Zoom zurück in die Halle
              if (closeupRef.current) document.dispatchEvent(new CustomEvent('hall:backdrop'));
              else if (modeRef.current === 'case') go(homeHref);
            }}
            onReady={() => setGl('on')}
            onFail={() => { rootRef.current?.setAttribute('data-startup-fallback', 'true'); setGl('css'); }}
          />
        </Suspense>
      ) : null}
      <div className="hall__wall" aria-hidden />
      <div className="hall__lamps" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <div className="hall__floor" aria-hidden />

      {inHall && heading ? <h1 className="sr-only">{heading}</h1> : null}

      {/* Die CSS-Reihe ist nur die Kulisse ohne WebGL — steht die Bühne, wird sie gar nicht erst gerendert
          (sonst laufen 16 Automaten mit Bildern und Marken bei jedem Fokuswechsel durch React) */}
      {gl === 'on' ? null : (
        <div className="hall__row" ref={rowRef} role="list" inert={!inHall}>
          {items.map((it, i) => {
            const d = i - focus;
            const far = Math.abs(d) > VISIBLE;
            const near = Math.abs(d) <= 2;
            const cls = `machine machine--${it.kind}${d === 0 ? ' is-focus' : ''}${near ? ' is-near' : ''}${far ? ' is-far' : ''}`;
            const style = { ...placement(d), ['--d' as string]: Math.abs(d), ['--item-brand' as string]: isMachine(it) ? it.brand.primary : '#c8daf4' } as React.CSSProperties;
            const onClick = (e: React.MouseEvent) => {
              if (modifiedClick(e)) return;
              if (d !== 0) {
                e.preventDefault();
                setFocus(i);
              }
            };
            if (!isMachine(it)) {
              return (
                <a key={it.slug} href={pageHref(it.href)} className={cls} style={style} role="listitem" aria-current={d === 0 ? 'true' : undefined} onClick={onClick} tabIndex={d === 0 ? 0 : -1}>
                  {it.kind === 'kasse' ? (
                    <>
                      <span className="m-sign">
                        <Bi de={H.kasse} en={HE.kasse} />
                      </span>
                      <span className="m-kasse">
                        {it.portrait ? <img className="m-kasse__me" src={it.portrait} alt="" width={360} height={480} loading="lazy" decoding="async" /> : null}
                        <span className="m-kasse__desk" />
                        <span className="m-kasse__bell" />
                      </span>
                      <span className="m-plate">
                        <span className="m-plate__title">
                          <Bi de={H.kasseSub} en={HE.kasseSub} />
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="m-sign">
                        <Bi de={H.phone} en={HE.phone} />
                      </span>
                      <span className="m-phone">
                        <span className="m-phone__box">
                          <span className="m-phone__hook" />
                          <span className="m-phone__handset" />
                          <span className="m-phone__keys">
                            {Array.from({ length: 12 }).map((_, k) => (
                              <i key={k} />
                            ))}
                          </span>
                        </span>
                        <span className="m-phone__cord" />
                      </span>
                      <span className="m-plate">
                        <span className="m-plate__title">
                          <Bi de={H.phoneSub} en={HE.phoneSub} />
                        </span>
                      </span>
                    </>
                  )}
                  <span className="m-glow" aria-hidden />
                </a>
              );
            }
            const shots = it.screens.slice(0, 4);
            return (
              <a
                key={it.slug}
                href={pageHref(it.href)}
                className={cls}
                style={style}
                role="listitem"
                aria-current={d === 0 ? 'true' : undefined}
                aria-label={it.title}
                onClick={onClick}
                tabIndex={d === 0 ? 0 : -1}
              >
                <span className="m-marquee">
                  {it.logoLive || it.logo ? (
                    <span className="m-marquee__mark">
                      <LiveMark logoLive={it.logoLive} logo={it.logo} title={`${it.title} logo`} active={d === 0 && !reduce && inHall} ambient={d === 0} reduce={reduce} />
                    </span>
                  ) : null}
                  <span className="m-marquee__name">{it.title}</span>
                </span>
  
                <span className={`m-screen is-${it.screenFormat}`}>
                  <span className="m-screen__glass">
                    {shots.map((src, k) => (
                      <img
                        key={`${k}-${src}`}
                        className="m-shot"
                        style={{ ['--k' as string]: k }}
                        src={src}
                        alt=""
                        loading={k === 0 && near ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    ))}
                    <span className="m-screen__scan" />
                  </span>
                  {it.arcadeHref ? (
                    <span className="m-coin">
                      <Bi de={H.coin} en={HE.coin} />
                    </span>
                  ) : null}
                </span>
  
                {it.kind === 'cabinet' ? (
                  <span className="m-panel m-panel--cabinet">
                    <span className="m-stick" />
                    <span className="m-btn" />
                    <span className="m-btn m-btn--2" />
                  </span>
                ) : it.kind === 'terminal' ? (
                  <span className="m-panel m-panel--terminal">
                    <span className="m-keys">
                      {Array.from({ length: 18 }).map((_, k) => (
                        <i key={k} />
                      ))}
                    </span>
                  </span>
                ) : it.kind === 'kiosk' ? (
                  <span className="m-panel m-panel--kiosk">
                    <span className="m-slot" />
                    <span className="m-btn" />
                  </span>
                ) : (
                  <span className="m-panel m-panel--jukebox">
                    {Array.from({ length: 7 }).map((_, k) => (
                      <i key={k} style={{ ['--k' as string]: k }} />
                    ))}
                  </span>
                )}
  
                <span className="m-vents" aria-hidden />
                <span className="m-door" aria-hidden />
                <span className="m-plate">
                  <span className="m-plate__title">
                    <Bi de={it.title} en={it.titleEn} />
                  </span>
                  <span className="m-plate__meta mono">{it.version ?? it.engine ?? ''}</span>
                </span>
  
                {it.character ? (
                  <span className="m-cast" title={it.characterName}>
                    <img src={it.character} alt="" width={96} height={96} loading="lazy" decoding="async" />
                  </span>
                ) : it.logoLive === 'berry-laugh' ? (
                  <span className="m-cast m-cast--berry" title="Berry-Bot">
                    <LiveMark logoLive="berry-laugh" title="Berry-Bot" active={(d === 0 || attract) && inHall} reduce={reduce} />
                  </span>
                ) : null}
  
                <span className="m-reflect" aria-hidden>
                  {shots[0] ? <img src={shots[0]} alt="" loading="lazy" decoding="async" /> : null}
                </span>
                <span className="m-glow" aria-hidden />
              </a>
            );
          })}
        </div>
        )}

      <nav className="hall-dock" aria-label={lang === 'en' ? 'Arcade navigation' : 'Hallen-Navigation'}>
        <div className="hall-dock__rail" role="group" aria-label={lang === 'en' ? 'Jump to a machine' : 'Direkt zu einem Automaten'} style={{gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`}}>
          <span className="hall-dock__spectrum" aria-hidden="true" />
          {items.map((it, i) => {
            const title = isMachine(it) ? (lang === 'en' ? it.titleEn ?? it.title : it.title) : it.kind === 'kasse' ? (lang === 'en' ? 'About me' : 'Über mich') : (lang === 'en' ? 'Contact' : 'Kontakt');
            return <button type="button" key={it.slug} className={`hall-dock__stop${i === focus ? ' is-current' : ''}`} tabIndex={inHall && i === focus ? 0 : -1}
              aria-label={`${String(i + 1).padStart(2, '0')} · ${title}`} aria-current={i === focus ? 'location' : undefined}
              onClick={() => { stopAttract(); setFocus(i); }}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault(); event.stopPropagation();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, i + (event.key === 'ArrowRight' ? 1 : -1)));
                stopAttract(); setFocus(next);
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
              }}>
              <span className="hall-dock__tick" aria-hidden="true" />
              <span className="hall-dock__stop-label" aria-hidden="true"><small>{String(i + 1).padStart(2, '0')}</small>{title}</span>
            </button>;
          })}
        </div>
        <span className="hall-dock__count">{String(focus + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        <div className="hall-dock__center">
        <button type="button" className="hall-dock__arrow hall-dock__arrow--prev" onClick={() => move(-1)} disabled={focus === 0} aria-label={lang === 'en' ? 'Previous machine' : 'Vorheriger Automat'} tabIndex={inHall ? 0 : -1}><Icon name="chevron-left" size={20} /></button>
        <div className="hall-dock__identity" aria-live="polite">
          <h2 className="hall-dock__title">{isMachine(current) ? <Bi de={current.title} en={current.titleEn} /> : current.kind === 'kasse' ? <Bi de={H.kasseSub} en={HE.kasseSub} /> : <Bi de={H.phoneSub} en={HE.phoneSub} />}</h2>
        </div>
        <a className="hall-dock__open" href={pageHref(current.href)} tabIndex={inHall ? 0 : -1} onClick={(e) => { if (modifiedClick(e)) return; e.preventDefault(); go(current.href); }}>
          {isMachine(current) ? <Bi de="Projekt ansehen" en="Explore project" /> : <Bi de={H.open} en={HE.open} />} <Icon name="arrow-up-right" size={18} />
        </a>
        <button type="button" className="hall-dock__arrow hall-dock__arrow--next" onClick={() => move(1)} disabled={focus === n - 1} aria-label={lang === 'en' ? 'Next machine' : 'Nächster Automat'} tabIndex={inHall ? 0 : -1}><Icon name="chevron-right" size={20} /></button>
        </div>
        <button className="hall-dock__directory" type="button" tabIndex={inHall ? 0 : -1} aria-haspopup="dialog" onClick={() => directoryRef.current?.showModal()}><Icon name="grid" size={17} /><Bi de="Alle Projekte" en="All projects" /></button>
      </nav>
      <dialog ref={directoryRef} className="hall-directory" aria-labelledby="hall-directory-title" onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close();
      }}>
        <div className="hall-directory__head">
          <h2 id="hall-directory-title"><Bi de="Alle Projekte" en="All projects" /></h2>
          <button className="hall-directory__close" type="button" onClick={() => directoryRef.current?.close()} aria-label={lang === 'en' ? 'Close project list' : 'Projektliste schließen'}><Icon name="close" size={18} /></button>
        </div>
        <ol>{items.map((it, i) => <li key={it.slug}>
          <a className="hall-directory__item" href={pageHref(it.href)} aria-current={i === focus ? 'true' : undefined} onClick={(e) => { if (modifiedClick(e)) return; e.preventDefault(); directoryRef.current?.close(); go(it.href); }}>
            <small>{String(i + 1).padStart(2, '0')}</small>
            <span>{isMachine(it) ? <Bi de={it.title} en={it.titleEn} /> : it.kind === 'kasse' ? <Bi de={H.kasseSub} en={HE.kasseSub} /> : <Bi de={H.phoneSub} en={HE.phoneSub} />}</span><Icon name="arrow-up-right" size={18} />
          </a>
        </li>)}</ol>
      </dialog>
      <p className="hall__hint mono" aria-hidden>
        {pad ? (
          <>
            <span className="hall__pad">◉</span> <Bi de={H.padConnected} en={HE.padConnected} /> · <Bi de={H.padHint} en={HE.padHint} />
          </>
        ) : (
          <>
            <span className="hall__hint-desk">
              <Bi de={H.hint} en={HE.hint} />
            </span>
            <span className="hall__hint-touch">
              <Bi de={H.swipe} en={HE.swipe} />
            </span>
          </>
        )}
      </p>
      <p className="hall__attract mono" role="status">
        {attract ? <Bi de={H.attract} en={HE.attract} /> : null}
      </p>
      <div className="hall__arrows" aria-hidden>
        <button type="button" className="hall__arrow" onClick={() => move(-1)} disabled={focus === 0} tabIndex={-1}>
          ‹
        </button>
        <button type="button" className="hall__arrow" onClick={() => move(1)} disabled={focus === n - 1} tabIndex={-1}>
          ›
        </button>
      </div>
    </section>
  );
}

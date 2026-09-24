import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { copy, type Lang } from '../../lib/i18n';
import { toAvif } from '../../lib/img';
import GalleryLightbox, { altFor, asLoaded, readLang, thumbSrc, type GalleryShot } from './GalleryLightbox';
import Closeup from './Closeup';
import Icon from '../icons/Icon';
import { CABINET_HOLD_MS } from '../hall/presentation.mjs';

export type CaptureGroup = {
  id: string;
  labelDe: string;
  labelEn: string;
  blurbDe?: string;
  blurbEn?: string;
  variant: 'phone' | 'desktop';
  images: GalleryShot[];
};

type Props = {
  title: string;
  /** Markenfarbe des Automaten — Ring, Index-Badge, Fokus */
  brand: string;
  /** Eine Gruppe pro Surface; bei nur einer Gruppe entfällt die Chip-Zeile */
  groups: CaptureGroup[];
  /** /arcade/<id>/ — im Close-up startet der Start-Knopf das Spiel */
  arcadeHref?: string;
};

const HOVER_MS = 120;

function Bi({ de, en }: { de: string; en?: string }) {
  if (!en || en === de) return <>{de}</>;
  return (
    <>
      <span data-lang="de">{de}</span>
      <span data-lang="en">{en}</span>
    </>
  );
}

const nn = (i: number) => String(i + 1).padStart(2, '0');

/**
 * Der Automatenbildschirm ist die Galerie: eine Capture zeigen, `null` = Loop wieder frei.
 * The texture wants the full capture; hand over the format the panel's <picture> elements load (AVIF where
 * supported), so the screen and the close-up share one download instead of fetching the WebP twin too.
 */
function showOnCabinet(src: string | null) {
  document.dispatchEvent(new CustomEvent('hall:screen', { detail: { src: src ? asLoaded(src) : null } }));
}

/** `@sm` + full-size candidates for one capture ("a@sm.webp 720w, a.webp 1600w"), or undefined without an @sm */
function widthSet(shot: GalleryShot, avif: boolean): string | undefined {
  if (!shot.srcSm || !shot.smWidth || !shot.width || shot.width <= shot.smWidth) return undefined;
  const conv = (u: string) => (avif ? toAvif(u) ?? u : u);
  return `${conv(shot.srcSm)} ${shot.smWidth}w, ${conv(shot.src)} ${shot.width}w`;
}

/**
 * Rendered width of a phone-carousel slide (hall-panel.css, < 900 px): height min(52vw, 46svh) for 16:10
 * captures, min(118vw, 60svh) for portrait ones, width capped at 84vw. At 900 px and up the carousel is hidden and
 * only the first slide loads (eager); it then asks for the strip-thumb size and shares the thumb's @sm file.
 */
function heroSizes(shot: GalleryShot, phone: boolean): string {
  const ratio = shot.width && shot.height ? shot.width / shot.height : phone ? 9 / 16 : 16 / 10;
  const vw = Math.min(84, Math.ceil((phone ? 118 : 52) * ratio));
  return `(max-width: 899px) ${vw}vw, 136px`;
}

/** Close-up an/aus — die Halle fährt die Kamera (Pose `screen`) und weicht mit dem Panel */
function tellCloseup(on: boolean, i?: number) {
  document.dispatchEvent(new CustomEvent('hall:closeup', { detail: { on, i } }));
}

function inField(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
}

/**
 * Captures-Streifen im Case-Panel der Spielhalle. Auswahl läuft auf den 3D-Bildschirm
 * des fokussierten Automaten (`hall:screen`). Ein Klick auf einen Thumb, auf den Bildschirm
 * (`hall:screenclick`) oder auf „Groß ansehen" öffnet das Close-up: die Kamera fährt an
 * Bildschirm und Bedienfeld, die Knöpfe blättern (Closeup.tsx). Die Lightbox bleibt als
 * Vollbild-Ersatz, wo es kein Fullscreen-API gibt.
 */
export default function CaseCaptures({ title, brand, groups, arcadeHref }: Props) {
  const reduceMq = Boolean(useReducedMotion());
  const [fxOff, setFxOff] = useState(false);
  const reduce = reduceMq || fxOff;
  const [lang, setLang] = useState<Lang>('de');
  const [gi, setGi] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  /** null = noch nichts gewählt (Caption zeigt den Surface-Blurb), Bildschirm zeigt trotzdem #1 */
  const [sel, setSel] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [closeup, setCloseup] = useState(false);
  const [mounted, setMounted] = useState(false);
  /**
   * Phones and portrait tablets (< 900 px) read project pages natively (2026-09-17): no 3D cabinet behind a
   * half-height sheet. The captures become a large swipeable carousel at the top of the page, a tap opens the
   * lightbox, and nothing here drives the cabinet screen or the close-up.
   */
  const [native, setNative] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  /** The carousel reports its own scroll position as the selection; do not scroll it back in response. */
  const fromHeroScroll = useRef(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const hovering = useRef(false);
  const closeupRef = useRef(false);
  closeupRef.current = closeup;
  /** Ob die Auswahl vom Nutzer kam — nur dann den Streifen nachscrollen */
  const userPick = useRef(false);

  const group = groups[Math.min(gi, groups.length - 1)];
  const images = group?.images ?? [];
  const shown = Math.min(sel ?? 0, Math.max(images.length - 1, 0));
  const current = images[shown];
  const phone = group?.variant === 'phone';
  const P = copy.de.panel;
  const PE = copy.en.panel;

  /* ---------- Sprache + Effekte lesen (wie GlassNav) ---------- */
  useEffect(() => {
    setMounted(true);
    const sync = () => {
      setLang(readLang());
      setFxOff(document.documentElement.classList.contains('fx-off'));
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang', 'class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const apply = () => setNative(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  /* ---------- Bildschirm folgt der Auswahl; beim Verlassen wieder frei ---------- */
  const src = current?.src ?? null;
  useEffect(() => {
    if (src) showOnCabinet(src);
  }, [src]);
  useEffect(
    () => () => {
      showOnCabinet(null);
      if (closeupRef.current) tellCloseup(false);
    },
    [],
  );

  // Only the selected cabinet in the info view rotates. Interaction takes ownership.
  useEffect(() => {
    if (native || reduce || autoplayPaused || closeup || open || images.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && document.querySelector('.hall.is-3d[data-mode="case"]')) {
        setSel(previous => ((previous ?? 0) + 1) % images.length);
      }
    }, CABINET_HOLD_MS);
    return () => window.clearInterval(timer);
  }, [native, reduce, autoplayPaused, closeup, open, images.length, gi]);

  /* ---------- Aktive Thumb im Streifen halten (nur horizontal, das Panel scrollt nicht mit) ---------- */
  useEffect(() => {
    if (!userPick.current) return;
    userPick.current = false;
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>(`[data-i="${shown}"]`);
    if (!strip || !el) return;
    const left = el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2;
    strip.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  }, [shown, gi, reduce]);

  /* ---------- Native carousel: its scroll position is the selection; outside picks scroll it ---------- */
  useEffect(() => {
    if (!native) return;
    const hero = heroRef.current;
    if (!hero) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const mid = hero.scrollLeft + hero.clientWidth / 2;
        let best = 0;
        let bestD = Infinity;
        hero.querySelectorAll<HTMLElement>('[data-slide]').forEach((el, i) => {
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (d < bestD) { bestD = d; best = i; }
        });
        setSel((previous) => {
          if ((previous ?? 0) === best) return previous;
          fromHeroScroll.current = true;
          return best;
        });
      });
    };
    hero.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      hero.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(raf);
    };
  }, [native, gi, images.length]);
  useEffect(() => {
    if (!native) return;
    if (fromHeroScroll.current) {
      fromHeroScroll.current = false;
      return;
    }
    const hero = heroRef.current;
    const el = hero?.querySelector<HTMLElement>(`[data-slide="${shown}"]`);
    if (!hero || !el) return;
    hero.scrollTo({ left: el.offsetLeft - (hero.clientWidth - el.offsetWidth) / 2, behavior: 'auto' });
  }, [native, shown, gi]);

  const thumbAt = useCallback((i: number) => stripRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? null, []);

  const pick = useCallback(
    (i: number, focus = false) => {
      setAutoplayPaused(true);
      userPick.current = true;
      setSel(i);
      if (focus) window.requestAnimationFrame(() => thumbAt(i)?.focus());
    },
    [thumbAt],
  );

  /* ---------- Close-up ---------- */
  const enterCloseup = useCallback(
    (i?: number) => {
      if (!images.length) return;
      if (i !== undefined) pick(i);
      setAutoplayPaused(true);
      if (native) {
        // No cabinet on a phone page: the lightbox is the large view.
        setOpen(true);
        return;
      }
      setCloseup(true);
      tellCloseup(true, i ?? shown);
    },
    [images.length, pick, shown, native],
  );
  const exitCloseup = useCallback(() => {
    setCloseup(false);
    tellCloseup(false);
    if (src) showOnCabinet(src);
    window.setTimeout(() => thumbAt(shown)?.focus({ preventScroll: true }), 180);
  }, [src, thumbAt, shown]);

  /* ---------- Lightbox: nur noch Vollbild-Ersatz ohne Fullscreen-API ---------- */
  const openLightbox = useCallback(() => {
    if (!images.length) return;
    setOpen(true);
  }, [images.length]);
  const closeLightbox = useCallback(() => {
    setOpen(false);
    if (!closeupRef.current) thumbAt(shown)?.focus();
    if (src) showOnCabinet(src);
  }, [thumbAt, shown, src]);

  /* ---------- Klick auf den 3D-Bildschirm → Close-up ---------- */
  useEffect(() => {
    const onScreen = () => {
      if (!closeupRef.current) enterCloseup();
    };
    document.addEventListener('hall:screenclick', onScreen);
    return () => document.removeEventListener('hall:screenclick', onScreen);
  }, [enterCloseup]);

  /* ---------- 1–9 überall: Capture n der aktiven Gruppe ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || open) return;
      if (inField(e.target)) return;
      if (e.key.length !== 1 || e.key < '1' || e.key > '9') return;
      const n = Number(e.key) - 1;
      if (n >= images.length) return;
      e.preventDefault();
      pick(n);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [images.length, pick, open]);

  /* ---------- Hover: nach 120 ms auf dem Automaten zeigen, beim Verlassen zurück ---------- */
  const clearHover = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const onEnter = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    if (e.pointerType !== 'mouse' || i === shown) return;
    clearHover();
    const hovered = images[i]?.src;
    if (!hovered) return;
    hoverTimer.current = window.setTimeout(() => {
      setAutoplayPaused(true);
      hovering.current = true;
      showOnCabinet(hovered);
    }, HOVER_MS);
  };
  const onLeave = () => {
    clearHover();
    if (hovering.current) {
      hovering.current = false;
      if (src) showOnCabinet(src);
    }
  };
  useEffect(() => clearHover, []);

  /* ---------- Roving Tabindex: ein Tab-Stopp, ←/→ wählen, Enter/Klick öffnet ---------- */
  const onStripKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // Im Close-up gehören die Pfeile dem Close-up (Joystick kippt, Capture wechselt)
    if (closeupRef.current) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(shown + 1, images.length - 1);
    else if (e.key === 'ArrowLeft') next = Math.max(shown - 1, 0);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = images.length - 1;
    if (next === null) return;
    // Die Halle hört auf window: ←/→ hier sind Capture-Wechsel, kein Spaziergang zum Nachbarn
    e.preventDefault();
    e.stopPropagation();
    pick(next, true);
  };

  const switchGroup = (i: number) => {
    if (i === gi) return;
    clearHover();
    hovering.current = false;
    setAutoplayPaused(true);
    setGi(i);
    setSel(null);
    stripRef.current?.scrollTo({ left: 0 });
  };

  if (!group || !images.length) return null;

  const showBlurb = sel === null && Boolean(group.blurbDe);
  const surfacesLabel = lang === 'en' ? PE.surfaces : P.surfaces;
  const titleAttr = lang === 'en' ? PE.showOnCabinet : P.showOnCabinet;

  return (
    <div className={`captures captures--native${phone ? ' captures--phone' : ''}`} style={{ ['--brand' as string]: brand } as CSSProperties}>
      {groups.length > 1 ? (
        <div className="captures__chips" role="group" aria-label={surfacesLabel}>
          {groups.map((g, i) => (
            <button
              key={g.id}
              type="button"
              className={`captures__chip${i === gi ? ' is-on' : ''}`}
              aria-pressed={i === gi}
              onClick={() => switchGroup(i)}
            >
              <span className="captures__chip-num mono" aria-hidden>
                {nn(i)}
              </span>
              <Bi de={g.labelDe} en={g.labelEn} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="captures__head">
        <p className="captures__label mono">
          <Bi de={P.captures} en={PE.captures} /> · {String(images.length).padStart(2, '0')}
        </p>
        <button type="button" className="captures__large mono" onClick={() => enterCloseup()}>
          <Icon name="expand" size={16} />
          <Bi de={P.viewLarge} en={PE.viewLarge} />
        </button>
      </div>

      {/* CSS selects the phone carousel before hydration; both layouts keep the same image sources. */}
      <div className="captures__hero" ref={heroRef} role="group" aria-label={lang === 'en' ? PE.captures : P.captures}>
        {images.map((shot, i) => (
          <button
            key={`${group.id}-hero-${shot.src}-${i}`}
            type="button"
            data-slide={i}
            className="captures__slide"
            style={{ aspectRatio: `${shot.width ?? (phone ? 9 : 16)} / ${shot.height ?? (phone ? 16 : 10)}` }}
            aria-label={`Capture ${i + 1} ${lang === 'en' ? 'of' : 'von'} ${images.length}: ${altFor(shot, lang)}`}
            onClick={() => enterCloseup(i)}
          >
            <picture>
              {toAvif(shot.src) && (
                <source type="image/avif" srcSet={widthSet(shot, true) ?? toAvif(shot.src)} sizes={widthSet(shot, true) ? heroSizes(shot, phone) : undefined} />
              )}
              <img
                src={shot.src}
                srcSet={widthSet(shot, false)}
                sizes={widthSet(shot, false) ? heroSizes(shot, phone) : undefined}
                alt=""
                width={shot.width}
                height={shot.height}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                decoding="async"
                draggable={false}
              />
            </picture>
          </button>
        ))}
      </div>

      {images.length > 6 && <button type="button" className="captures__more" aria-expanded={expanded || shown >= 6} onClick={() => { if (expanded || shown >= 6) { setExpanded(false); setSel(0); } else setExpanded(true); }}><Bi de={expanded || shown >= 6 ? 'Weniger Screenshots' : `Alle ${images.length} Screenshots`} en={expanded || shown >= 6 ? 'Fewer screenshots' : `All ${images.length} screenshots`} /></button>}
      <div className="captures__strip" ref={stripRef} onKeyDown={onStripKey}>
        {images.slice(0, expanded || shown >= 6 ? undefined : 6).map((shot, i) => {
          const on = i === shown;
          return (
            <button
              key={`${group.id}-${shot.src}-${i}`}
              type="button"
              data-i={i}
              className={`captures__thumb${on ? ' is-on' : ''}`}
              style={{ ['--i' as string]: i } as CSSProperties}
              tabIndex={on ? 0 : -1}
              aria-pressed={on}
              aria-label={`Capture ${i + 1} ${lang === 'en' ? 'of' : 'von'} ${images.length}: ${altFor(shot, lang)}`}
              title={titleAttr}
              onClick={() => enterCloseup(i)}
              onPointerEnter={(e) => onEnter(e, i)}
              onPointerLeave={onLeave}
            >
              <picture>
                {toAvif(thumbSrc(shot)) && <source type="image/avif" srcSet={toAvif(thumbSrc(shot))} />}
                <img
                  src={thumbSrc(shot)}
                  alt=""
                  width={phone ? 44 : 112}
                  height={phone ? 78 : 63}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </picture>
              <span className="captures__idx mono" aria-hidden>
                {nn(i)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="captures__caption mono" aria-live={autoplayPaused ? 'polite' : 'off'}>
        {showBlurb ? (
          <Bi de={group.blurbDe ?? ''} en={group.blurbEn} />
        ) : current ? (
          <>
            <b>{nn(shown)} —</b> <Bi de={current.alt} en={current.altEn} />
          </>
        ) : null}
      </p>

      {mounted ? (
        <Closeup
          open={closeup}
          title={title}
          brand={brand}
          lang={lang}
          reduce={reduce}
          groups={groups}
          gi={gi}
          images={images}
          index={shown}
          phone={phone}
          arcadeHref={arcadeHref}
          onIndex={(i) => pick(i)}
          onGroup={switchGroup}
          onExit={exitCloseup}
          onFullscreenFallback={openLightbox}
        />
      ) : null}

      {mounted
        ? createPortal(
            <GalleryLightbox
              images={images}
              index={open ? shown : null}
              title={title}
              lang={lang}
              reduce={reduce}
              phone={phone}
              onClose={closeLightbox}
              onChange={(i) => {
                if (i === null) closeLightbox();
                else pick(i);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

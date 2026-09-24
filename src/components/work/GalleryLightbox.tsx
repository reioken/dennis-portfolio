import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Icon from '../icons/Icon';
import { copy, type Lang } from '../../lib/i18n';
import { toAvif } from '../../lib/img';
import './gallery-lightbox.css';

export type GalleryShot = {
  src: string;
  srcHi?: string;
  alt: string;
  /** Englischer Alt-Text; fehlt er, bleibt der deutsche stehen */
  altEn?: string;
  /** Intrinsic capture size reserves the mobile carousel before image decode. */
  width?: number;
  height?: number;
  /** 720 px `@sm` variant (scripts/build-thumbs.mjs) and its width: strip thumbs and the phone carousel's srcset */
  srcSm?: string;
  smWidth?: number;
};

export function readLang(): Lang {
  return document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
}

let avifPicked: boolean | undefined;
/** Whether this browser chose the AVIF <source> of the case captures (read once from a rendered <picture>). */
function avifChosen(): boolean {
  if (avifPicked !== undefined) return avifPicked;
  const cur = document.querySelector<HTMLImageElement>('.captures picture img, .gallery-view picture img')?.currentSrc;
  if (!cur) return false;
  avifPicked = /\.avif(?:[?#]|$)/i.test(cur);
  return avifPicked;
}

/**
 * The URL a `<picture>` built from `src` actually loads here: the AVIF sibling where the browser picks AVIF.
 * Anything that fetches a capture outside a <picture> (the cabinet screen texture, the close-up preload) goes
 * through this so it hits the cache instead of downloading the WebP twin (2026-09-25).
 */
export function asLoaded(src: string): string {
  return avifChosen() ? (toAvif(src) ?? src) : src;
}

/** Small file for thumbnails: the @sm sibling when it is actually smaller than the capture, else the capture. */
export function thumbSrc(shot: GalleryShot): string {
  return shot.srcSm && shot.smWidth && shot.width && shot.width > shot.smWidth ? shot.srcSm : shot.src;
}

/** Alt-Text in der aktiven Sprache (Attribute können keine data-lang-Spans tragen) */
export function altFor(shot: GalleryShot, lang: Lang) {
  return lang === 'en' ? (shot.altEn ?? shot.alt) : shot.alt;
}

export type LightboxProps = {
  images: GalleryShot[];
  index: number | null;
  title: string;
  lang: Lang;
  reduce: boolean;
  phone?: boolean;
  onClose: () => void;
  onChange: (i: number | null) => void;
};

/**
 * Vollbild-Galerie mit Fokusfalle. Wird von CaseMedia (klassische Case-Seite) und
 * CaseCaptures (Spielhallen-Panel) geteilt. Tasten werden in der Capture-Phase auf
 * `document` gelesen: Esc und ←/→ gehören dem Dialog allein und erreichen die Halle
 * (die auf `window` hört) nicht — sonst würde Esc zugleich die Halle verlassen.
 */
export default function GalleryLightbox({
  images,
  index,
  title,
  lang,
  reduce,
  phone = false,
  onClose,
  onChange,
}: LightboxProps) {
  const active = index !== null ? images[index] : null;
  const total = images.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpen = Boolean(active);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (index === null || total < 2) return;
      onChange((index + dir + total) % total);
    },
    [index, onChange, total],
  );

  useEffect(() => {
    if (index === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        go(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (e.key === 'Tab') {
        // Keep focus cycling inside the dialog
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement as HTMLElement | null;
        if (!current || !root.contains(current)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && current === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey, true);
    };
  }, [index, onClose, go]);

  // Move focus into the dialog when it opens
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeBtnRef.current?.focus({ preventScroll: true });
      wasOpen.current = true;
    }
    if (!isOpen && wasOpen.current) {
      wasOpen.current = false;
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    }
  }, [isOpen]);

  // Keep active filmstrip thumb in view
  useEffect(() => {
    if (index === null || !filmRef.current) return;
    const thumb = filmRef.current.querySelector<HTMLElement>(`[data-film="${index}"]`);
    thumb?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  }, [index, reduce]);

  const src = useMemo(() => {
    if (!active) return '';
    return active.srcHi || active.src;
  }, [active]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  return (
    <AnimatePresence>
      {active && index !== null ? (
        <motion.div
          ref={dialogRef}
          className={`gallery-view${phone ? ' gallery-view--phone' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — ${copy[lang].work.gallery}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
        >
          <div className="gallery-view__veil" aria-hidden />

          <div className="gallery-view__chrome" onClick={(e) => e.stopPropagation()}>
            <p className="gallery-view__meta">
              <span className="gallery-view__title">{title}</span>
              <span className="gallery-view__count" aria-live="polite" aria-atomic="true">
                {index + 1} / {total}
              </span>
            </p>
            <button
              ref={closeBtnRef}
              type="button"
              className="gallery-view__icon-btn"
              onClick={onClose}
              aria-label={lang === 'en' ? 'Close gallery' : 'Galerie schließen'}
            >
              <Icon name="close" size={18} weight="bold" />
            </button>
          </div>

          {total > 1 ? (
            <>
              <button
                type="button"
                className="gallery-view__nav gallery-view__nav--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label={lang === 'en' ? 'Previous image' : 'Vorheriges Bild'}
              >
                <Icon name="chevron-left" size={20} />
              </button>
              <button
                type="button"
                className="gallery-view__nav gallery-view__nav--next"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label={lang === 'en' ? 'Next image' : 'Nächstes Bild'}
              >
                <Icon name="chevron-right" size={20} />
              </button>
            </>
          ) : null}

          <div
            ref={stageRef}
            className="gallery-view__stage"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragStart.current = null; }}
          >
            <AnimatePresence initial={false}>
              <motion.figure
                key={src}
                className="gallery-view__figure"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.14 }}
              >
                <picture>
                  {toAvif(src) && <source type="image/avif" srcSet={toAvif(src)} />}
                  <img
                    src={src}
                    alt={altFor(active, lang)}
                    {...(active.altEn ? { 'data-alt-en': active.altEn } : {})}
                    className="gallery-view__image"
                    decoding="async"
                    draggable={false}
                  />
                </picture>
              </motion.figure>
            </AnimatePresence>
          </div>

          {total > 1 ? (
            <div
              className="gallery-view__film"
              ref={filmRef}
              onClick={(e) => e.stopPropagation()}
              role="group"
              aria-label={lang === 'en' ? 'Gallery thumbnails' : 'Galerie-Vorschaubilder'}
            >
              {images.map((shot, i) => (
                <button
                  key={`film-${shot.src}-${i}`}
                  type="button"
                  data-film={i}
                  aria-pressed={i === index}
                  aria-label={`${i + 1} ${lang === 'en' ? 'of' : 'von'} ${total}: ${altFor(shot, lang)}`}
                  className={`gallery-view__film-item${i === index ? ' gallery-view__film-item--active' : ''}${phone ? ' gallery-view__film-item--phone' : ''}`}
                  onClick={() => onChange(i)}
                >
                  <picture>
                    {toAvif(thumbSrc(shot)) && <source type="image/avif" srcSet={toAvif(thumbSrc(shot))} />}
                    <img src={thumbSrc(shot)} alt="" loading="lazy" decoding="async" draggable={false} />
                  </picture>
                </button>
              ))}
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

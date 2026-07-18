import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Icon from '../icons/Icon';
import { copy, type Lang } from '../../lib/i18n';

export type GalleryShot = {
  src: string;
  srcHi?: string;
  alt: string;
};

type Props = {
  title: string;
  /** Cover + gallery shots (cover usually index 0) */
  images: GalleryShot[];
  /** How many leading images are the cover (shown above the grid) */
  coverCount?: number;
  /** Desktop landscape (default) or phone portrait framing */
  variant?: 'desktop' | 'phone';
};

function readLang(): Lang {
  return document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
}

/** Bento span for desktop landscape grids */
function desktopSpan(i: number, total: number): 'full' | 'wide' | 'std' {
  if (total <= 2) return 'full';
  if (i === 0 && total >= 3) return 'wide';
  if (total % 2 === 1 && i === total - 1) return 'full';
  return 'std';
}

export default function CaseMedia({
  title,
  images,
  coverCount = 1,
  variant = 'desktop',
}: Props) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>('de');
  const phone = variant === 'phone';

  useEffect(() => {
    const sync = () => setLang(readLang());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => obs.disconnect();
  }, []);

  // Preload adjacent hi-res when lightbox open
  useEffect(() => {
    if (open === null) return;
    const targets = [open - 1, open, open + 1]
      .filter((i) => i >= 0 && i < images.length)
      .map((i) => images[i].srcHi || images[i].src);
    for (const src of targets) {
      const img = new Image();
      img.src = src;
    }
  }, [open, images]);

  const cover = images.slice(0, coverCount);
  const strip = images.slice(coverCount);

  if (!images.length) return null;

  return (
    <>
      {cover.map((shot, i) => (
        <div key={`cover-${shot.src}`} className="wrap mb-10">
          <motion.button
            type="button"
            className={`shot-gallery__cover-trigger${phone ? ' shot-gallery__cover-trigger--phone' : ''}`}
            onClick={() => setOpen(i)}
            aria-label={
              lang === 'en' ? `Open gallery — ${title}` : `Galerie öffnen — ${title}`
            }
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-8% 0px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="shot-gallery__cover-panel glass-panel">
              <img
                src={shot.src}
                alt={shot.alt}
                width={phone ? 390 : 1600}
                height={phone ? 844 : 1000}
                className="shot-gallery__cover-img"
              />
              <span className="shot-gallery__cover-cue" aria-hidden>
                <Icon name="expand" size={16} weight="bold" />
              </span>
            </span>
          </motion.button>
        </div>
      ))}

      {strip.length > 0 ? (
        <div className="mb-14">
          <div className="wrap mb-5 flex items-end justify-between gap-4">
            <p className="section-label mb-0">
              <span data-lang="de">{copy.de.work.gallery}</span>
              <span data-lang="en">{copy.en.work.gallery}</span>
            </p>
            <p className="shot-gallery__count-hint">
              {strip.length}{' '}
              <span data-lang="de">Screens</span>
              <span data-lang="en">shots</span>
            </p>
          </div>
          <div className={`shot-gallery${phone ? ' shot-gallery--phone' : ''}`}>
            <div className="shot-gallery__grid wrap">
              {strip.map((shot, i) => {
                const abs = i + coverCount;
                const span = phone ? 'std' : desktopSpan(i, strip.length);
                return (
                  <motion.button
                    key={`${shot.src}-${abs}`}
                    type="button"
                    className={`shot-gallery__card shot-gallery__card--${span}`}
                    onClick={() => setOpen(abs)}
                    aria-label={
                      lang === 'en'
                        ? `Open image ${abs + 1} of ${images.length}: ${shot.alt}`
                        : `Bild ${abs + 1} von ${images.length} öffnen: ${shot.alt}`
                    }
                    initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-6% 0px' }}
                    transition={{
                      duration: 0.5,
                      delay: reduce ? 0 : Math.min(i * 0.045, 0.28),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    onMouseMove={(e) => {
                      if (reduce) return;
                      const el = e.currentTarget;
                      const r = el.getBoundingClientRect();
                      const x = ((e.clientX - r.left) / r.width) * 100;
                      const y = ((e.clientY - r.top) / r.height) * 100;
                      el.style.setProperty('--mx', `${x}%`);
                      el.style.setProperty('--my', `${y}%`);
                    }}
                  >
                    <span className="shot-gallery__frame">
                      <img
                        src={shot.src}
                        alt=""
                        width={phone ? 390 : 1040}
                        height={phone ? 844 : 650}
                        loading="lazy"
                        decoding="async"
                        className="shot-gallery__thumb"
                      />
                      <span className="shot-gallery__shine" aria-hidden />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <GalleryLightbox
        images={images}
        index={open}
        title={title}
        lang={lang}
        reduce={!!reduce}
        phone={phone}
        onClose={() => setOpen(null)}
        onChange={setOpen}
      />
    </>
  );
}

type LightboxProps = {
  images: GalleryShot[];
  index: number | null;
  title: string;
  lang: Lang;
  reduce: boolean;
  phone?: boolean;
  onClose: () => void;
  onChange: (i: number | null) => void;
};

function GalleryLightbox({
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
  const dragX = useRef(0);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (index === null) return;
      onChange((index + dir + total) % total);
    },
    [index, onChange, total],
  );

  useEffect(() => {
    if (index === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [index, onClose, go]);

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
    dragX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const dx = e.clientX - dragX.current;
    if (Math.abs(dx) > 56) go(dx < 0 ? 1 : -1);
  };

  return (
    <AnimatePresence>
      {active && index !== null ? (
        <motion.div
          className={`gallery-view${phone ? ' gallery-view--phone' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — ${copy[lang].work.gallery}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
        >
          <div className="gallery-view__veil" aria-hidden />

          <div className="gallery-view__chrome" onClick={(e) => e.stopPropagation()}>
            <p className="gallery-view__meta">
              <span className="gallery-view__title">{title}</span>
              <span className="gallery-view__count">
                {index + 1} / {total}
              </span>
            </p>
            <button
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
                <span aria-hidden>‹</span>
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
                <span aria-hidden>›</span>
              </button>
            </>
          ) : null}

          <div
            ref={stageRef}
            className="gallery-view__stage"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <AnimatePresence mode="wait">
              <motion.figure
                key={src}
                className="gallery-view__figure"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }
                }
              >
                <img
                  src={src}
                  alt={active.alt}
                  className="gallery-view__image"
                  decoding="async"
                  draggable={false}
                />
              </motion.figure>
            </AnimatePresence>
          </div>

          {total > 1 ? (
            <div
              className="gallery-view__film"
              ref={filmRef}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label={lang === 'en' ? 'Gallery thumbnails' : 'Galerie-Vorschaubilder'}
            >
              {images.map((shot, i) => (
                <button
                  key={`film-${shot.src}-${i}`}
                  type="button"
                  data-film={i}
                  role="option"
                  aria-selected={i === index}
                  className={`gallery-view__film-item${i === index ? ' gallery-view__film-item--active' : ''}${phone ? ' gallery-view__film-item--phone' : ''}`}
                  onClick={() => onChange(i)}
                >
                  <img src={shot.src} alt="" loading="lazy" decoding="async" draggable={false} />
                </button>
              ))}
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  /** How many leading images are the cover (hidden from strip if also in gallery) */
  coverCount?: number;
  /** Desktop landscape (default) or phone portrait framing */
  variant?: 'desktop' | 'phone';
};

function readLang(): Lang {
  return document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
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

  const cover = images.slice(0, coverCount);
  const strip = images.slice(coverCount);

  if (!images.length) return null;

  return (
    <>
      {cover.map((shot, i) => (
        <div key={`cover-${shot.src}`} className="wrap mb-10">
          <button
            type="button"
            className={`shot-gallery__cover-trigger${phone ? ' shot-gallery__cover-trigger--phone' : ''}`}
            onClick={() => setOpen(i)}
            aria-label={
              lang === 'en' ? `Open gallery — ${title}` : `Galerie öffnen — ${title}`
            }
          >
            <span className="shot-gallery__cover-panel glass-panel">
              <img
                src={shot.src}
                alt={shot.alt}
                width={phone ? 390 : 1600}
                height={phone ? 844 : 1000}
                className="shot-gallery__cover-img"
              />
            </span>
          </button>
        </div>
      ))}

      {strip.length > 0 ? (
        <div className="mb-12">
          <div className="wrap mb-4">
            <p className="section-label">
              <span data-lang="de">{copy.de.work.gallery}</span>
              <span data-lang="en">{copy.en.work.gallery}</span>
            </p>
          </div>
          <div className={`shot-gallery${phone ? ' shot-gallery--phone' : ''}`}>
            <div className="shot-gallery__track">
              {strip.map((shot, i) => {
                const abs = i + coverCount;
                return (
                  <button
                    key={`${shot.src}-${abs}`}
                    type="button"
                    className="shot-gallery__card"
                    onClick={() => setOpen(abs)}
                    aria-label={
                      lang === 'en'
                        ? `Open image ${abs + 1} of ${images.length}: ${shot.alt}`
                        : `Bild ${abs + 1} von ${images.length} öffnen: ${shot.alt}`
                    }
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
                    </span>
                  </button>
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

  const src = useMemo(() => {
    if (!active) return '';
    return active.srcHi || active.src;
  }, [active]);

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

          <div className="gallery-view__stage" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              <motion.figure
                key={src}
                className="gallery-view__figure"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: 'spring', stiffness: 380, damping: 34, mass: 0.75 }
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

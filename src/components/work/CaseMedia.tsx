import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Icon from '../icons/Icon';
import { copy, type Lang } from '../../lib/i18n';
import { toAvif } from '../../lib/img';
import GalleryLightbox, { altFor, readLang, type GalleryShot } from './GalleryLightbox';

/** Weiterhin von hier importierbar (CaseMediaTabs, CaseSurfaceStack) */
export type { GalleryShot };

type Props = {
  title: string;
  /** Cover + gallery shots (cover usually index 0) */
  images: GalleryShot[];
  /** How many leading images are the cover (shown above the grid) */
  coverCount?: number;
  /** Desktop landscape (default) or phone portrait framing */
  variant?: 'desktop' | 'phone';
  /** Show “Galerie / N screens” header above the grid */
  showHead?: boolean;
};

export default function CaseMedia({
  title,
  images,
  coverCount = 1,
  variant = 'desktop',
  showHead = true,
}: Props) {
  // Keep gallery content visible in SSR, including before hydration and without JavaScript.
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>('de');
  const phone = variant === 'phone';
  /** Remember which thumb opened the lightbox so focus can return on close. */
  const triggerRef = useRef<HTMLElement | null>(null);

  const openAt = (i: number, el: HTMLElement) => {
    triggerRef.current = el;
    setOpen(i);
  };

  const close = () => {
    setOpen(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  };

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
            onClick={(e) => openAt(i, e.currentTarget)}
            aria-label={
              lang === 'en' ? `Open gallery — ${title}` : `Galerie öffnen — ${title}`
            }
            initial={false}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px 240px 0px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="shot-gallery__cover-panel glass-panel">
              <picture>
                {toAvif(shot.src) && <source type="image/avif" srcSet={toAvif(shot.src)} />}
                <img
                  src={shot.src}
                  alt={altFor(shot, lang)}
                  {...(shot.altEn ? { 'data-alt-en': shot.altEn } : {})}
                  width={phone ? 390 : 1600}
                  height={phone ? 844 : 1000}
                  className="shot-gallery__cover-img"
                />
              </picture>
              <span className="shot-gallery__cover-cue" aria-hidden>
                <Icon name="expand" size={16} weight="bold" />
              </span>
            </span>
          </motion.button>
        </div>
      ))}

      {strip.length > 0 ? (
        <div className="case-page__gallery">
          {showHead ? (
            <div className="wrap case-page__gallery-head">
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
          ) : null}
          <div className={`shot-gallery${phone ? ' shot-gallery--phone' : ''}`}>
            <div className="shot-gallery__grid wrap">
              {strip.map((shot, i) => {
                const abs = i + coverCount;
                return (
                  <motion.button
                    key={`${shot.src}-${abs}`}
                    type="button"
                    className="shot-gallery__card"
                    onClick={(e) => openAt(abs, e.currentTarget)}
                    aria-label={
                      lang === 'en'
                        ? `Open image ${abs + 1} of ${images.length}: ${altFor(shot, lang)}`
                        : `Bild ${abs + 1} von ${images.length} öffnen: ${altFor(shot, lang)}`
                    }
                    initial={false}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '0px 0px 240px 0px' }}
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
                      <picture>
                        {toAvif(shot.src) && <source type="image/avif" srcSet={toAvif(shot.src)} />}
                        <img
                          src={shot.src}
                          alt=""
                          width={phone ? 390 : 1040}
                          height={phone ? 844 : 650}
                          loading="lazy"
                          decoding="async"
                          className="shot-gallery__thumb"
                        />
                      </picture>
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
        onClose={close}
        onChange={setOpen}
      />
    </>
  );
}

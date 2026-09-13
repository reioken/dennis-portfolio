import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import AnimatedLogo from './AnimatedLogo';
import BerryLiveLogo from './BerryLiveLogo';
import NexusSplashMark from './NexusSplashMark';
import RiftcastLiveLogo from './RiftcastLiveLogo';
import MinaLiveLogo from './MinaLiveLogo';
import WebsitesStackLogo from './WebsitesStackLogo';
import { toAvif } from '../../lib/img';
import Icon from '../icons/Icon';

/** Tag slugs are data values — show localized labels on the cards. */
const TAG_LABELS: Record<string, { de: string; en: string }> = {
  product: { de: 'Product', en: 'Product' },
  design: { de: 'Design', en: 'Design' },
  archive: { de: 'Archiv', en: 'Archive' },
  lab: { de: 'Labor', en: 'Lab' },
};

/** Rendert beide Sprachen; CSS blendet die inaktive aus (siehe global.css). */
function Bi({ de, en }: { de: string; en?: string }) {
  if (!en || en === de) return <>{de}</>;
  return (
    <>
      <span data-lang="de">{de}</span>
      <span data-lang="en">{en}</span>
    </>
  );
}

type Props = {
  href: string;
  title: string;
  summary: string;
  year: string;
  role: string;
  titleEn?: string;
  summaryEn?: string;
  yearEn?: string;
  roleEn?: string;
  /** Fallback / legacy card image when no logo is set */
  cover: string;
  /** 720 px sibling of the cover (scripts/build-thumbs.mjs); the card renders at ≤ 600 px, the cover itself is 1200+ */
  coverSm?: string;
  /** Project logo shown on the card */
  logo?: string;
  /**
   * Live logo:
   * - `nexus-splash` → splash shimmer on hover
   * - `berry-laugh` → Berry-Bot laugh on hover
   * - URL → SMIL SVG via object
   */
  logoLive?: string;
  tags: string[];
  featured?: boolean;
  preview?: boolean;
  /** First visible card: start fetching its cover without a lazy-loading delay. */
  priority?: boolean;
  previews?: string[];
  status?: string;
  /** Smaller card — homepage archive strip */
  compact?: boolean;
  coverAlt?: string;
  /** Mina is intentionally presented as a case study; product apps are builds. */
  caseStudy?: boolean;
  headingLevel?: 'h2' | 'h3';
};

export default function ProjectCard({
  href,
  title,
  summary,
  year,
  role,
  titleEn,
  summaryEn,
  yearEn,
  roleEn,
  cover,
  coverSm,
  logo,
  logoLive,
  tags,
  featured = false,
  preview = false,
  priority = false,
  previews = [],
  status,
  compact = false,
  coverAlt,
  caseStudy = false,
  headingLevel = 'h3',
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const mark = logo || cover;
  const isLogo = Boolean(logo) && !preview;
  /** Idle-Schweben nur auf großen Karten — Craft/Compact bleibt ruhig */
  const ambient = !reduce && !compact;
  const liveActive = hovering && !reduce;
  const Heading = headingLevel;

  const onMove = (e: React.MouseEvent) => {
    if (preview || reduce || window.matchMedia('(pointer: coarse)').matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -5, y: px * 5 });
  };

  const onLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHovering(false);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      className={`project-card group relative block overflow-hidden border border-[var(--stroke)] bg-[var(--panel-soft)] shadow-[var(--lg-edge),var(--lg-spec)] ${
        featured
          ? 'rounded-[28px] md:col-span-2 md:grid md:grid-cols-2 md:gap-0'
          : compact
            ? 'project-card--compact rounded-[14px]'
            : 'rounded-[var(--radius)]'
      }`}
      style={{
        transformStyle: 'preserve-3d',
        backdropFilter: preview ? 'none' : 'var(--frost)',
        WebkitBackdropFilter: preview ? 'none' : 'var(--frost)',
      }}
      onMouseMove={onMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={onLeave}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.4 }}
      whileHover={reduce ? undefined : { borderColor: 'color-mix(in srgb, var(--ice) 45%, var(--stroke))' }}
    >
      <div
        className={`relative overflow-hidden ${
          isLogo
            ? `project-logo-panel${featured ? ' md:min-h-[320px] md:aspect-auto md:h-full' : ''}`
            : featured
              ? 'md:min-h-[320px]'
              : ''
        }`}
      >
        {preview && previews.length > 1 ? <div className="project-card__phone-previews" aria-hidden>{previews.map((src) => <picture key={src}>{toAvif(src) && <source type="image/avif" srcSet={toAvif(src)} />}<img src={src} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" width={360} height={780} /></picture>)}</div> : isLogo ? (
          <>
            <div className="project-logo-panel__glow" aria-hidden />
            <div
              className={`absolute inset-0 flex items-center justify-center ${
                compact ? 'p-5' : featured ? 'p-10 md:p-14' : 'p-8'
              }`}
            >
              {logoLive === 'nexus-splash' ? (
                <NexusSplashMark
                  ambient={ambient}
                  active={liveActive}
                  title={coverAlt ?? `${title} logo`}
                  className="project-logo-panel__mark project-logo-panel__mark--live"
                />
              ) : logoLive === 'berry-laugh' ? (
                <BerryLiveLogo
                  active={liveActive}
                  title={coverAlt ?? `${title} logo`}
                  className={`project-logo-panel__mark project-logo-panel__mark--live${ambient ? ' is-ambient' : ''}`}
                />
              ) : logoLive === 'riftcast-cast' ? (
                <RiftcastLiveLogo
                  active={liveActive}
                  title={coverAlt ?? `${title} logo`}
                  className={`project-logo-panel__mark project-logo-panel__mark--live${ambient ? ' is-ambient' : ''}`}
                />
              ) : logoLive === 'mina-heart' ? (
                <MinaLiveLogo
                  active={liveActive}
                  title={coverAlt ?? `${title} logo`}
                  className={`project-logo-panel__mark project-logo-panel__mark--live${ambient ? ' is-ambient' : ''}`}
                />
              ) : logoLive === 'websites-stack' ? (
                <WebsitesStackLogo
                  active={liveActive}
                  title={coverAlt ?? `${title} logo`}
                  className="project-logo-panel__mark project-logo-panel__mark--live"
                />
              ) : logoLive && !reduce ? (
                <AnimatedLogo
                  src={logoLive}
                  title={coverAlt ?? `${title} logo`}
                  className={`project-logo-panel__mark project-logo-panel__mark--live max-h-[70%] max-w-[78%] w-full h-full object-contain${ambient ? ' is-ambient' : ''}`}
                />
              ) : (
                <img
                  src={mark}
                  alt={coverAlt ?? `${title} logo`}
                  width={640}
                  height={320}
                  loading={priority ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`project-logo-panel__mark max-h-full max-w-full object-contain ${
                    logoLive || reduce || compact ? '' : 'project-logo-panel__mark--idle'
                  }`}
                />
              )}
            </div>
          </>
        ) : (
          <picture>
            {toAvif(cover) && <source type="image/avif" srcSet={coverSm && toAvif(coverSm) ? `${toAvif(coverSm)} 720w, ${toAvif(cover)} 1400w` : toAvif(cover)} sizes={coverSm ? '(min-width: 768px) 40vw, 100vw' : undefined} />}
            <img
              src={cover}
              srcSet={coverSm ? `${coverSm} 720w, ${cover} 1400w` : undefined}
              sizes={coverSm ? '(min-width: 768px) 40vw, 100vw' : undefined}
              fetchPriority={priority ? 'high' : undefined}
              alt={coverAlt ?? `${title} cover`}
              width={1200}
              height={750}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className={`w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.045] ${
                featured
                  ? 'aspect-[16/10] h-full md:aspect-auto md:absolute md:inset-0'
                  : compact
                    ? 'aspect-[16/9]'
                    : 'aspect-[16/10]'
              }`}
            />
          </picture>
        )}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
            isLogo ? 'opacity-40 group-hover:opacity-55' : 'opacity-10 group-hover:opacity-0'
          }`}
          style={{
            background: isLogo
              ? 'linear-gradient(180deg, rgba(6,7,10,0.15) 0%, rgba(6,7,10,0.05) 45%, rgba(6,7,10,0.55) 100%)'
              : 'linear-gradient(180deg, rgba(6,7,10,0.55) 0%, rgba(6,7,10,0.12) 42%, rgba(6,7,10,0.72) 100%)',
          }}
          aria-hidden
        />
        <span
          className={`absolute z-10 whitespace-nowrap rounded-md bg-[rgba(6,7,10,0.78)] font-[family-name:var(--font-mono)] tracking-[0.08em] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.45)] backdrop-blur-sm ${
            compact
              ? 'left-2 top-2 px-1.5 py-0.5 text-[0.62rem]'
              : 'left-3 top-3 px-2 py-1 text-[0.7rem]'
          }`}
        >
          <Bi de={year} en={yearEn} />
          {status ? <> · <Bi de={({ live: 'Live', wip: 'In Entwicklung', private: 'Privat', archived: 'Archiv', released: 'Veröffentlicht', case: 'Case Study' } as Record<string,string>)[status] ?? status} en={({ live: 'Live', wip: 'In development', private: 'Private', archived: 'Archive', released: 'Released', case: 'Case study' } as Record<string,string>)[status] ?? status} /></> : null}
        </span>
      </div>
      <div
        className={`relative flex flex-col justify-end ${
          featured ? 'p-5 md:p-8' : compact ? 'p-3.5' : 'p-5'
        }`}
      >
        <div
          className={`uppercase tracking-[0.14em] text-[var(--dim)] ${
            compact ? 'mb-1 text-[0.62rem]' : 'mb-2 text-[0.75rem]'
          }`}
        >
          <Bi de={role} en={roleEn} />
        </div>
        <Heading
          className={`display text-[var(--text)] transition-colors duration-300 group-hover:text-[color-mix(in_srgb,var(--meta)_55%,var(--text))] ${
            featured
              ? 'mb-2 text-[clamp(1.6rem,3vw,2.2rem)]'
              : compact
                ? 'mb-1 text-[1.05rem] leading-snug'
                : 'mb-2 text-[1.35rem]'
          }`}
        >
          <Bi de={title} en={titleEn} />
        </Heading>
        <p
          className={`text-[var(--dim)] ${
            featured
              ? 'mb-4 line-clamp-3 max-w-[40ch] text-[0.95rem]'
              : compact
                ? 'mb-2.5 line-clamp-2 text-[0.8rem] leading-snug'
                : 'mb-4 line-clamp-2 text-[0.95rem]'
          }`}
        >
          <Bi de={summary} en={summaryEn} />
        </p>
        <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {tags.slice(0, featured ? 5 : compact ? 2 : 3).map((tag) => {
            const label = TAG_LABELS[tag];
            return (
              <span
                key={tag}
                className={`rounded-md border border-[var(--stroke)] uppercase tracking-[0.1em] text-[var(--faint)] ${
                  compact ? 'px-1.5 py-px text-[0.58rem]' : 'px-2 py-0.5 text-[0.68rem]'
                }`}
              >
                {label ? (
                  <>
                    <span data-lang="de">{label.de}</span>
                    <span data-lang="en">{label.en}</span>
                  </>
                ) : (
                  tag
                )}
              </span>
            );
          })}
        </div>
        <span
          className={`inline-flex items-center gap-2 font-semibold uppercase tracking-[0.14em] text-[var(--ice)] transition group-hover:text-[var(--text)] ${
            compact ? 'mt-3 text-[0.65rem]' : 'mt-5 text-[0.75rem]'
          }`}
          aria-hidden
        >
          <span data-lang="de">{caseStudy ? 'Case Study ansehen' : 'Projekt ansehen'}</span>
          <span data-lang="en">{caseStudy ? 'View case study' : 'View project'}</span>
          <Icon name="arrow-up-right" size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.a>
  );
}

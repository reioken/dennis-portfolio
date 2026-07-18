import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import AnimatedLogo from './AnimatedLogo';
import BerryLiveLogo from './BerryLiveLogo';
import NexusSplashMark from './NexusSplashMark';

type Props = {
  href: string;
  title: string;
  summary: string;
  year: string;
  role: string;
  /** Fallback / legacy card image when no logo is set */
  cover: string;
  /** Project logo shown on the card */
  logo?: string;
  /**
   * Live logo:
   * - `nexus-splash` → full splash shimmer
   * - `berry-laugh` → Berry-Bot laugh loop
   * - URL → SMIL SVG via &lt;object&gt;
   */
  logoLive?: string;
  tags: string[];
  featured?: boolean;
  /** Smaller card — homepage archive strip */
  compact?: boolean;
  coverAlt?: string;
};

export default function ProjectCard({
  href,
  title,
  summary,
  year,
  role,
  cover,
  logo,
  logoLive,
  tags,
  featured = false,
  compact = false,
  coverAlt,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const mark = logo || cover;
  const isLogo = Boolean(logo);

  const onMove = (e: React.MouseEvent) => {
    if (reduce || window.matchMedia('(pointer: coarse)').matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -5, y: px * 5 });
  };

  const onLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      className={`group relative block overflow-hidden border border-[var(--stroke)] bg-[var(--panel-soft)] shadow-[var(--lg-edge),var(--lg-spec)] ${
        featured
          ? 'rounded-[28px] md:col-span-2 md:grid md:grid-cols-2 md:gap-0'
          : compact
            ? 'rounded-[14px]'
            : 'rounded-[var(--radius)]'
      }`}
      style={{
        transformStyle: 'preserve-3d',
        backdropFilter: 'var(--frost)',
        WebkitBackdropFilter: 'var(--frost)',
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.4 }}
      whileHover={reduce ? undefined : { borderColor: 'color-mix(in srgb, var(--ice) 45%, var(--stroke))' }}
    >
      <div
        className={`relative overflow-hidden ${
          isLogo
            ? `project-logo-panel ${featured ? 'md:min-h-[320px] md:aspect-auto md:h-full' : ''}`
            : featured
              ? 'md:min-h-[320px]'
              : ''
        }`}
      >
        {isLogo ? (
          <>
            <div className="project-logo-panel__glow" aria-hidden />
            <div
              className={`absolute inset-0 flex items-center justify-center ${
                compact ? 'p-5' : featured ? 'p-10 md:p-14' : 'p-8'
              }`}
            >
              {logoLive && !reduce && logoLive === 'nexus-splash' ? (
                <NexusSplashMark
                  title={coverAlt ?? `${title} logo`}
                  className="project-logo-panel__mark project-logo-panel__mark--live"
                />
              ) : logoLive && !reduce && logoLive === 'berry-laugh' ? (
                <BerryLiveLogo
                  title={coverAlt ?? `${title} logo`}
                  className="project-logo-panel__mark project-logo-panel__mark--live"
                />
              ) : logoLive && !reduce ? (
                <AnimatedLogo
                  src={logoLive}
                  title={coverAlt ?? `${title} logo`}
                  className="project-logo-panel__mark project-logo-panel__mark--live max-h-[70%] max-w-[78%] w-full h-full object-contain"
                />
              ) : (
                <img
                  src={mark}
                  alt={coverAlt ?? `${title} logo`}
                  width={640}
                  height={320}
                  loading="lazy"
                  decoding="async"
                  className={`project-logo-panel__mark max-h-full max-w-full object-contain ${
                    logoLive || reduce ? '' : 'project-logo-panel__mark--idle'
                  }`}
                />
              )}
            </div>
          </>
        ) : (
          <img
            src={cover}
            alt={coverAlt ?? `${title} cover`}
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
            className={`w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.045] ${
              featured
                ? 'aspect-[16/10] h-full md:aspect-auto md:absolute md:inset-0'
                : compact
                  ? 'aspect-[16/9]'
                  : 'aspect-[16/10]'
            }`}
          />
        )}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
            isLogo ? 'opacity-40 group-hover:opacity-55' : 'opacity-70 group-hover:opacity-85'
          }`}
          style={{
            background: isLogo
              ? 'linear-gradient(180deg, rgba(6,7,10,0.15) 0%, rgba(6,7,10,0.05) 45%, rgba(6,7,10,0.55) 100%)'
              : 'linear-gradient(180deg, rgba(6,7,10,0.55) 0%, rgba(6,7,10,0.12) 42%, rgba(6,7,10,0.72) 100%)',
          }}
          aria-hidden
        />
        <span
          className={`absolute rounded-md bg-[rgba(6,7,10,0.78)] font-[family-name:var(--font-mono)] tracking-[0.1em] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.45)] backdrop-blur-sm ${
            compact
              ? 'left-2 top-2 px-1.5 py-0.5 text-[0.62rem]'
              : 'left-3 top-3 px-2 py-1 text-[0.7rem]'
          }`}
        >
          {year}
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
          {role}
        </div>
        <h3
          className={`display text-[var(--text)] transition-colors duration-300 group-hover:text-[color-mix(in_srgb,var(--meta)_55%,var(--text))] ${
            featured
              ? 'mb-2 text-[clamp(1.6rem,3vw,2.2rem)]'
              : compact
                ? 'mb-1 text-[1.05rem] leading-snug'
                : 'mb-2 text-[1.35rem]'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-[var(--dim)] ${
            featured
              ? 'mb-4 line-clamp-3 max-w-[40ch] text-[0.95rem]'
              : compact
                ? 'mb-2.5 line-clamp-2 text-[0.8rem] leading-snug'
                : 'mb-4 line-clamp-2 text-[0.95rem]'
          }`}
        >
          {summary}
        </p>
        <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {tags.slice(0, featured ? 5 : compact ? 2 : 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-md border border-[var(--stroke)] uppercase tracking-[0.1em] text-[var(--faint)] ${
                compact ? 'px-1.5 py-px text-[0.58rem]' : 'px-2 py-0.5 text-[0.68rem]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          className={`inline-flex items-center gap-2 font-semibold uppercase tracking-[0.14em] text-[var(--ice)] transition group-hover:text-[var(--text)] ${
            compact ? 'mt-3 text-[0.65rem]' : 'mt-5 text-[0.75rem]'
          }`}
          aria-hidden
        >
          <span data-lang="de">Case öffnen</span>
          <span data-lang="en">Open case</span>
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
        </span>
      </div>
    </motion.a>
  );
}

import { copy } from '../../lib/i18n';
import AvailabilityStatus from '../brand/AvailabilityStatus';
import BrandLockup from '../brand/BrandLockup';
import WorkCollage from './WorkCollage';

type Shot = { src: string; alt?: string; format?: 'phone' | 'wide' };

type Props = {
  brand: string;
  headlineDe: string;
  headlineEn: string;
  supportDe: string;
  supportEn: string;
  collageShots: Shot[];
  workHref?: string;
  contactHref?: string;
};

export default function HeroStage({
  brand,
  headlineDe,
  headlineEn,
  supportDe,
  supportEn,
  collageShots,
  workHref = '/work',
  contactHref = '/contact',
}: Props) {
  return (
    <section className="hero-stage relative min-h-[100svh] overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <WorkCollage shots={collageShots} />
      </div>

      {/* Text always visible — no opacity:0 entrance (was hiding hero copy) */}
      <div className="hero-copy wrap relative z-20 flex min-h-[100svh] flex-col justify-center pb-12 pt-[calc(var(--nav-h)+3rem)] md:min-h-[100dvh] md:pb-24 md:pt-[calc(var(--nav-h)+3.5rem)]">
        <div className="max-w-4xl">
          <div className="hero-copy__item mb-7 max-w-xl">
            <BrandLockup name={brand} weight="hero" />
          </div>

          <h1 className="hero-copy__item name-lock gradient-text mb-6 max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(1.55rem,5vw,3.4rem)] font-semibold uppercase leading-[1.08] tracking-[0.05em] sm:max-w-none">
            <span data-lang="de" data-edit="home.headline.de">
              {headlineDe}
            </span>
            <span data-lang="en" data-edit="home.headline.en">
              {headlineEn}
            </span>
          </h1>

          <p className="hero-copy__item mb-5 max-w-[42ch] text-[1.05rem] font-normal normal-case tracking-normal text-[var(--dim)]">
            <span data-lang="de" data-edit="home.support.de">
              {supportDe}
            </span>
            <span data-lang="en" data-edit="home.support.en">
              {supportEn}
            </span>
          </p>

          <div className="hero-copy__item mb-9">
            <AvailabilityStatus showLocation />
          </div>

          <div className="hero-copy__item flex flex-wrap gap-3">
            <a href={workHref} className="btn btn--primary">
              <span data-lang="de" data-edit="home.ctaWork.de">
                {copy.de.home.ctaWork}
              </span>
              <span data-lang="en" data-edit="home.ctaWork.en">
                {copy.en.home.ctaWork}
              </span>
            </a>
            <a href={contactHref} className="btn">
              <span data-lang="de" data-edit="home.ctaContact.de">
                {copy.de.home.ctaContact}
              </span>
              <span data-lang="en" data-edit="home.ctaContact.en">
                {copy.en.home.ctaContact}
              </span>
            </a>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--violet) 55%, transparent), color-mix(in srgb, var(--ice) 55%, transparent), transparent)',
        }}
      />
    </section>
  );
}

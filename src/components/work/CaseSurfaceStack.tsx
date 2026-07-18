import { useEffect, useState } from 'react';
import CaseMedia, { type GalleryShot } from './CaseMedia';

export type CaseSurface = {
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
  surfaces: CaseSurface[];
};

export default function CaseSurfaceStack({ title, surfaces }: Props) {
  const [activeId, setActiveId] = useState(surfaces[0]?.id ?? '');

  useEffect(() => {
    if (!surfaces.length) return;
    const nodes = surfaces
      .map((s) => document.getElementById(`surface-${s.id}`))
      .filter((n): n is HTMLElement => !!n);

    if (!nodes.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id.replace(/^surface-/, '');
        if (id) setActiveId(id);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0.15, 0.35, 0.55] },
    );

    for (const n of nodes) obs.observe(n);
    return () => obs.disconnect();
  }, [surfaces]);

  if (!surfaces.length) return null;

  const jump = (id: string) => {
    const el = document.getElementById(`surface-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  return (
    <div className="case-stack">
      <div className="wrap case-stack__nav-wrap">
        <p className="case-stack__nav-label">
          <span data-lang="de">Ansichten</span>
          <span data-lang="en">Surfaces</span>
        </p>
        <div className="case-stack__nav" role="navigation" aria-label={`${title} surfaces`}>
          {surfaces.map((surface, i) => {
            const selected = surface.id === activeId;
            return (
              <button
                key={surface.id}
                type="button"
                className={`case-stack__chip${selected ? ' case-stack__chip--active' : ''}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => jump(surface.id)}
              >
                <span className="case-stack__num" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span data-lang="de">{surface.labelDe}</span>
                <span data-lang="en">{surface.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {surfaces.map((surface, i) => (
        <section
          key={surface.id}
          id={`surface-${surface.id}`}
          className="case-stack__section"
          aria-labelledby={`surface-title-${surface.id}`}
        >
          <div className="wrap case-stack__head">
            <div className="case-stack__meta">
              <span className="case-stack__index" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="case-stack__copy">
                <h2 id={`surface-title-${surface.id}`} className="case-stack__title">
                  <span data-lang="de">{surface.labelDe}</span>
                  <span data-lang="en">{surface.labelEn}</span>
                </h2>
                {(surface.blurbDe || surface.blurbEn) && (
                  <p className="case-stack__blurb">
                    {surface.blurbDe && <span data-lang="de">{surface.blurbDe}</span>}
                    {surface.blurbEn && <span data-lang="en">{surface.blurbEn}</span>}
                  </p>
                )}
              </div>
            </div>
            <p className="case-stack__count">
              {surface.images.length}{' '}
              <span data-lang="de">Screens</span>
              <span data-lang="en">shots</span>
            </p>
          </div>

          <CaseMedia
            title={`${title} — ${surface.labelDe}`}
            images={surface.images}
            coverCount={0}
            variant={surface.variant}
            showHead={false}
          />
        </section>
      ))}
    </div>
  );
}

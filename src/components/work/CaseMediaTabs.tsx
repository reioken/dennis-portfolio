import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import CaseMedia, { type GalleryShot } from './CaseMedia';

export type CaseSurface = {
  id: string;
  labelDe: string;
  labelEn: string;
  variant: 'phone' | 'desktop';
  images: GalleryShot[];
};

type Props = {
  title: string;
  surfaces: CaseSurface[];
};

export default function CaseMediaTabs({ title, surfaces }: Props) {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState(surfaces[0]?.id ?? '');
  const active = useMemo(
    () => surfaces.find((s) => s.id === activeId) ?? surfaces[0],
    [surfaces, activeId],
  );

  if (!surfaces.length || !active) return null;

  return (
    <div className="case-surfaces">
      <div className="wrap mb-3">
        <div className="case-surfaces__tabs" role="tablist" aria-label={`${title} surfaces`}>
          {surfaces.map((surface) => {
            const selected = surface.id === active.id;
            return (
              <button
                key={surface.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`case-tab-${surface.id}`}
                aria-controls={`case-panel-${surface.id}`}
                className={`case-surfaces__tab${selected ? ' case-surfaces__tab--active' : ''}`}
                onClick={() => setActiveId(surface.id)}
              >
                <span data-lang="de">{surface.labelDe}</span>
                <span data-lang="en">{surface.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          id={`case-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`case-tab-${active.id}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <CaseMedia
            title={`${title} — ${active.labelDe}`}
            images={active.images}
            coverCount={0}
            variant={active.variant}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

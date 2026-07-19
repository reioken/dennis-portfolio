import { useRef, useState, type ReactNode } from 'react';
import { toAvif } from '../../lib/img';

type Page = { src: string; alt: string };

type Props = {
  labelDe: string;
  labelEn: string;
  /** Sliced image pages (image-document mode) */
  pages?: Page[];
  /** Alternative: pre-rendered document markup (HTML mode) */
  children?: ReactNode;
};

/**
 * Long-form case study: starts as a compact preview panel with a fade-out,
 * expands inline to the full document on demand. Content is either a list of
 * sliced image pages or arbitrary document markup via children.
 */
export default function CaseDocument({ labelDe, labelEn, pages = [], children }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const shown = open ? pages : pages.slice(0, 2);

  const toggle = () => {
    setOpen((v) => {
      if (v && rootRef.current) {
        // Collapsing from way down the document — bring the reader back into view
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        rootRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
      return !v;
    });
  };

  return (
    <section ref={rootRef} className="wrap case-doc" aria-label={labelDe}>
      <div className="case-doc__head">
        <p className="section-label mb-0">
          <span data-lang="de">{labelDe}</span>
          <span data-lang="en">{labelEn}</span>
        </p>
        {pages.length > 0 && (
          <p className="case-doc__hint">
            {pages.length}{' '}
            <span data-lang="de">Abschnitte</span>
            <span data-lang="en">sections</span>
          </p>
        )}
      </div>

      <div className={`case-doc__pages${open ? '' : ' case-doc__pages--preview'}`}>
        {children
          ? children
          : shown.map((page, i) => (
              <picture key={page.src}>
                {toAvif(page.src) && <source type="image/avif" srcSet={toAvif(page.src)} />}
                <img
                  src={page.src}
                  alt={page.alt}
                  width={1400}
                  height={1465}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </picture>
            ))}
        {!open && <div className="case-doc__fade" aria-hidden />}
      </div>

      <div className="case-doc__actions">
        <button type="button" className="btn btn--primary" onClick={toggle} aria-expanded={open}>
          {open ? (
            <>
              <span data-lang="de">Study einklappen</span>
              <span data-lang="en">Collapse study</span>
            </>
          ) : (
            <>
              <span data-lang="de">Komplette Study ansehen</span>
              <span data-lang="en">View full study</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

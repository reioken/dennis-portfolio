import { useEffect, useMemo, useState } from 'react';
import ProjectCard from './ProjectCard';
import { copy, type Lang } from '../../lib/i18n';

export type WorkItem = {
  slug: string;
  title: string;
  summary: string;
  year: string;
  role: string;
  titleEn?: string;
  summaryEn?: string;
  yearEn?: string;
  roleEn?: string;
  cover: string;
  logo?: string;
  logoLive?: string;
  tags: string[];
  featured: boolean;
  status?: string;
  platform: string[];
  coverAlt?: string;
  coverAltEn?: string;
  previews?: string[];
};

const filterIds = ['selected', 'all', 'product', 'games', 'design', 'archive', 'lab'] as const;
type FilterId = (typeof filterIds)[number];

function isFilterId(v: string | null): v is FilterId {
  return !!v && (filterIds as readonly string[]).includes(v);
}

type Props = { items: WorkItem[]; basePath?: string };

export default function WorkFilter({ items, basePath = '/' }: Props) {
  const root = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const [active, setActive] = useState<FilterId>('selected');
  const [lang, setLang] = useState<Lang>('de');

  useEffect(() => {
    const read = () => setLang(document.documentElement.dataset.lang === 'en' ? 'en' : 'de');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => obs.disconnect();
  }, []);

  // Restore filter from URL (?filter=product) so filtered views are shareable
  useEffect(() => {
    const restore = () => {
      const fromUrl = new URLSearchParams(window.location.search).get('filter');
      setActive(isFilterId(fromUrl) ? fromUrl : 'selected');
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const select = (id: FilterId) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === 'selected') url.searchParams.delete('filter');
    else url.searchParams.set('filter', id);
    window.history.replaceState(window.history.state, '', url);
  };

  /** Beide Sprachen ins Markup — steht schon vor der Hydration korrekt da */
  const labelMap = {
    selected: ['Ausgewählt', 'Selected'],
    games: ['Spiele', 'Games'],
    all: [copy.de.work.filterAll, copy.en.work.filterAll],
    product: [copy.de.work.filterProduct, copy.en.work.filterProduct],
    design: [copy.de.work.filterDesign, copy.en.work.filterDesign],
    archive: [copy.de.work.filterArchive, copy.en.work.filterArchive],
    lab: [copy.de.work.filterLab, copy.en.work.filterLab],
  } as const;

  const filters = filterIds.map((id) => ({
    id,
    labelDe: labelMap[id][0],
    labelEn: labelMap[id][1],
  }));

  const visible = useMemo(() => {
    if (active === 'all') return items;
    if (active === 'selected') return items.filter((item) => item.featured);
    if (active === 'games') return items.filter((item) => item.platform.includes('game'));
    // Design-Filter: aktuelle Design-Cases — Archiv läuft separat
    if (active === 'design') {
      return items.filter((item) => item.tags.includes('design') && !item.tags.includes('archive'));
    }
    return items.filter((item) => item.tags.includes(active));
  }, [active, items]);

  return (
    <div>
      <div className="work-filter" role="group" aria-label={copy[lang].work.filterAria}>
        {filters.map((f) => {
          const on = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              className={`work-filter__tab ${on ? 'is-active' : ''}`}
              onClick={() => select(f.id)}
            >
              {f.labelDe === f.labelEn ? (
                f.labelDe
              ) : (
                <>
                  <span data-lang="de">{f.labelDe}</span>
                  <span data-lang="en">{f.labelEn}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        <span data-lang="de">{visible.length} Projekte angezeigt</span>
        <span data-lang="en">{visible.length} projects shown</span>
      </p>

      {visible.length === 0 ? (
        <p className="normal-case tracking-normal text-[var(--dim)]">
          <span data-lang="de">{copy.de.work.filterEmpty}</span>
          <span data-lang="en">{copy.en.work.filterEmpty}</span>
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {visible.map((item, index) => (
            <ProjectCard
              key={item.slug}
              href={`${root}work/${item.slug}/`}
              title={item.title}
              summary={item.summary}
              year={item.year}
              role={item.role}
              titleEn={item.titleEn}
              summaryEn={item.summaryEn}
              yearEn={item.yearEn}
              roleEn={item.roleEn}
              cover={item.cover}
              coverAlt={lang === 'en' ? item.coverAltEn ?? item.coverAlt : item.coverAlt}
              previews={item.previews}
              preview
              priority={index === 0}
              status={item.status}
              logo={item.logo}
              logoLive={item.logoLive}
              tags={item.tags}
              caseStudy={item.slug === 'mina'}
              headingLevel="h2"
            />
          ))}
        </div>
      )}
    </div>
  );
}

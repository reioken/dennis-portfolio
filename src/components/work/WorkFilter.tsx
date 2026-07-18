import { useEffect, useMemo, useState } from 'react';
import ProjectCard from './ProjectCard';
import { copy, type Lang } from '../../lib/i18n';

export type WorkItem = {
  slug: string;
  title: string;
  summary: string;
  year: string;
  role: string;
  cover: string;
  logo?: string;
  logoLive?: string;
  tags: string[];
  featured: boolean;
};

const filterIds = ['all', 'product', 'design', 'archive', 'lab'] as const;

type Props = { items: WorkItem[]; basePath?: string };

export default function WorkFilter({ items, basePath = '/' }: Props) {
  const root = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const [active, setActive] = useState<(typeof filterIds)[number]>('all');
  const [lang, setLang] = useState<Lang>('de');

  useEffect(() => {
    const read = () => setLang(document.documentElement.dataset.lang === 'en' ? 'en' : 'de');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => obs.disconnect();
  }, []);

  const labelMap = {
    all: copy[lang].work.filterAll,
    product: copy[lang].work.filterProduct,
    design: copy[lang].work.filterDesign,
    archive: copy[lang].work.filterArchive,
    lab: copy[lang].work.filterLab,
  } as const;

  const filters = filterIds.map((id) => ({
    id,
    label: labelMap[id],
  }));

  const visible = useMemo(() => {
    if (active === 'all') return items;
    return items.filter((item) => item.tags.includes(active));
  }, [active, items]);

  return (
    <div>
      <div className="work-filter" role="tablist" aria-label={copy[lang].work.filterAria}>
        {filters.map((f) => {
          const on = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`work-filter__tab ${on ? 'is-active' : ''}`}
              onClick={() => setActive(f.id)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="normal-case tracking-normal text-[var(--dim)]">{copy[lang].work.filterEmpty}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {visible.map((item) => (
            <ProjectCard
              key={item.slug}
              href={`${root}work/${item.slug}`}
              title={item.title}
              summary={item.summary}
              year={item.year}
              role={item.role}
              cover={item.cover}
              logo={item.logo}
              logoLive={item.logoLive}
              tags={item.tags}
            />
          ))}
        </div>
      )}
    </div>
  );
}

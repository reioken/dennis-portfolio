import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BrandMark from '../brand/BrandMark';
import Icon from '../icons/Icon';
import LangSwitch from '../i18n/LangSwitch';
import { copy, type Lang } from '../../lib/i18n';

type NavItem = { href: string; labelKey: keyof typeof copy.de.nav };
type WorkLink = { href: string; title: string };

type Props = {
  items: NavItem[];
  workLinks?: WorkLink[];
  currentPath: string;
  brand: string;
  homeHref?: string;
};

function normalizePath(path: string) {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function readScrollY() {
  return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
}

export default function GlassNav({
  items,
  workLinks = [],
  currentPath,
  brand,
  homeHref = '/',
}: Props) {
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('de');
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0, opacity: 0 });
  const home = normalizePath(homeHref);
  const [path, setPath] = useState(() => normalizePath(currentPath));

  useEffect(() => {
    setPath(normalizePath(currentPath || window.location.pathname));
  }, [currentPath]);

  useEffect(() => {
    const read = () => {
      const l = document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
      setLang(l);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => {
      const on = readScrollY() > 8;
      setScrolled(on);
      document.documentElement.dataset.navScrolled = on ? '1' : '0';
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        sync();
      });
    };
    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      delete document.documentElement.dataset.navScrolled;
    };
  }, []);

  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) {
      setPill((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const update = () => {
      const r = active.getBoundingClientRect();
      const pr = root.getBoundingClientRect();
      setPill({ left: r.left - pr.left, width: r.width, opacity: 1 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [path, open, lang]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const isActive = (href: string) => {
    const h = normalizePath(href);
    if (h === home) return path === home;
    return path === h || path.startsWith(`${h}/`);
  };

  const label = (key: NavItem['labelKey']) => copy[lang].nav[key];

  const panelTransition = reduce
    ? { duration: 0.12 }
    : { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 };

  return (
    <header
      className={`glass-nav fixed inset-x-0 top-0 z-50 ${scrolled ? 'is-scrolled' : ''}`}
      data-scrolled={scrolled ? '1' : '0'}
    >
      <div className="glass-nav__bar relative mx-auto flex h-11 items-center justify-between gap-2">
        <a
          href={homeHref}
          className="group flex h-9 items-center gap-2.5 px-1 text-[var(--text)]"
          aria-label={`${brand} — Home`}
        >
          <BrandMark size={30} weight="nav" title={brand} className="shrink-0" />
          <span className="hidden min-w-0 max-w-[11.5rem] flex-col justify-center gap-0.5 md:flex lg:max-w-[16rem]">
            <span
              className="truncate font-[family-name:var(--font-display)] text-[0.78rem] font-medium leading-none tracking-[-0.01em] text-[var(--text)]"
              data-edit="site.name"
            >
              {brand}
            </span>
            <span className="truncate text-[0.52rem] font-medium leading-none uppercase tracking-[0.16em] text-[var(--faint)]">
              UX/UI · Art Director
            </span>
          </span>
        </a>

        <nav className="hidden md:block" aria-label="Main">
          <div ref={listRef} className="relative flex items-center gap-0.5">
            <motion.span
              aria-hidden
              className="absolute inset-y-0 rounded-md bg-[color-mix(in_srgb,var(--violet)_32%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--ice)_40%,transparent)]"
              animate={
                reduce
                  ? { left: pill.left, width: pill.width, opacity: pill.opacity }
                  : {
                      left: pill.left,
                      width: pill.width,
                      opacity: pill.opacity,
                      transition: { type: 'spring', stiffness: 480, damping: 36 },
                    }
              }
              initial={false}
            />
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'page' : undefined}
                  className={`relative z-10 rounded-md px-2.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    active ? 'text-[var(--ice)]' : 'text-[var(--faint)] hover:text-[var(--dim)]'
                  }`}
                >
                  {label(item.labelKey)}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-1.5">
          <LangSwitch />
          <button
            ref={btnRef}
            type="button"
            className={`nav-icon-btn ${open ? 'is-open' : ''}`}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{copy[lang].nav.menu}</span>
            <Icon name={open ? 'close' : 'menu'} size={18} weight="bold" className="text-[var(--text)]" />
          </button>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.div
              ref={panelRef}
              id="site-menu"
              className="nav-dropdown"
              role="navigation"
              aria-label={lang === 'en' ? 'Menu' : 'Menü'}
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={panelTransition}
            >
              <div className="nav-dropdown__glow" aria-hidden />
              <ul className="nav-dropdown__list">
                {items.map((item, i) => {
                  const active = isActive(item.href);
                  return (
                    <motion.li
                      key={item.href}
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { delay: 0.03 + i * 0.035, type: 'spring', stiffness: 500, damping: 34 }
                      }
                    >
                      <a
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`nav-dropdown__link ${active ? 'is-active' : ''}`}
                        onClick={() => setOpen(false)}
                      >
                        <span>{label(item.labelKey)}</span>
                        {active ? <span className="nav-dropdown__dot" aria-hidden /> : null}
                      </a>
                    </motion.li>
                  );
                })}
              </ul>

              {workLinks.length > 0 ? (
                <div className="nav-dropdown__section">
                  <p className="nav-dropdown__section-label">
                    <span data-lang="de">Projekte</span>
                    <span data-lang="en">Projects</span>
                  </p>
                  <ul className="nav-dropdown__list nav-dropdown__list--compact">
                    {workLinks.map((w, i) => {
                      const active = isActive(w.href);
                      return (
                        <motion.li
                          key={w.href}
                          initial={reduce ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={
                            reduce
                              ? { duration: 0 }
                              : {
                                  delay: 0.08 + i * 0.025,
                                  type: 'spring',
                                  stiffness: 500,
                                  damping: 36,
                                }
                          }
                        >
                          <a
                            href={w.href}
                            aria-current={active ? 'page' : undefined}
                            className={`nav-dropdown__link nav-dropdown__link--sub ${active ? 'is-active' : ''}`}
                            onClick={() => setOpen(false)}
                          >
                            {w.title}
                          </a>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

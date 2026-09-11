import { useEffect, useRef, useState } from 'react';

import Icon, { type IconName } from '../icons/Icon';
import LangSwitch from '../i18n/LangSwitch';
import { copy, type Lang } from '../../lib/i18n';
import './site-nav.css';

type NavItem = { href: string; labelKey: keyof typeof copy.de.nav };

/** Was die Leiste in der Mitte anzeigt: die Station der Halle (Zähler · Name · Version) */
export type NavStation = { index: number; total: number; title: string; titleEn?: string; version?: string };

type Props = {
  items: NavItem[];
  currentPath: string;
  brand: string;
  homeHref?: string;
  /** Seitenmodus wie am <body>: hall / case / arcade / page */
  mode?: 'page' | 'hall' | 'case' | 'arcade';
  /** Station beim Laden (die Halle meldet Änderungen per hall:focus) */
  station?: NavStation;
};

type FocusDetail = NavStation & { mode?: string };



function normalizePath(path: string) {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

const nn = (i: number) => String(i + 1).padStart(2, '0');
const routeIcons: Record<string, IconName> = { home: 'home', work: 'work', about: 'about', lab: 'lab', contact: 'contact', arcade: 'grid' };

/**
 * Das Schild über der Halle: eine ruhige 40-px-Leiste ohne Fläche. Links die Marke, in den
 * Automaten-Ansichten den separaten Zurück-Button am Panel, in der Mitte die Station,
 * rechts DE/EN und die Menü-Taste mit allen Routen. Im Close-up und beim Spielen wird sie leise und
 * verschwindet nach ein paar Sekunden Ruhe, bis sich der Zeiger rührt.
 */
export default function GlassNav({ items, currentPath, brand, homeHref = '/', mode = 'page', station }: Props) {
  const [open, setOpen] = useState(false);
  const [quiet, setQuiet] = useState(false);

  const [st, setSt] = useState<FocusDetail | undefined>(station);
  // EN pages clone DE markup; the first client render must match it before the DOM-language effect runs.
  const initialLang: Lang = 'de';
  const [lang, setLang] = useState<Lang>(initialLang);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const home = normalizePath(homeHref);
  const [path, setPath] = useState(() => normalizePath(currentPath));
  const inHallWorld = mode !== 'page';
  const caseLike = mode === 'case' || mode === 'arcade';

  useEffect(() => {
    setPath(normalizePath(currentPath || window.location.pathname));
  }, [currentPath]);

  /* Sprache aus dem DOM (serverseitig pro Route gesetzt) */
  useEffect(() => {
    const read = () => setLang(document.documentElement.dataset.lang === 'en' ? 'en' : 'de');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => obs.disconnect();
  }, []);

  /* Die Halle meldet Fokus und Modus — die Anzeige folgt live */
  useEffect(() => {
    const onFocus = (e: Event) => {
      const d = (e as CustomEvent<FocusDetail>).detail;
      if (d && Number.isFinite(d.index)) setSt(d);
    };
    document.addEventListener('hall:focus', onFocus);
    return () => document.removeEventListener('hall:focus', onFocus);
  }, []);

  /* Leise im Close-up und beim Spielen: html.is-screen bzw. body[data-mode=arcade] mit laufendem Spiel */
  useEffect(() => {
    const check = () => {
      const q = document.documentElement.classList.contains('is-screen') || document.body.dataset.playing === '1';
      setQuiet(q);

    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-playing', 'data-mode'] });
    return () => obs.disconnect();
  }, []);


  /* Menü: Fokusfalle, Esc, Klick daneben */
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector<HTMLElement>('main');
    const wasInert = main?.hasAttribute('inert');
    const body = document.body;
    const previousOverflow = body.style.overflow;
    main?.setAttribute('inert', '');
    body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => (panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? panelRef.current?.querySelector<HTMLElement>('a[href]'))?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        requestAnimationFrame(() => btnRef.current?.focus());
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
      btnRef.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      cancelAnimationFrame(focusFrame);
      if (!wasInert) main?.removeAttribute('inert');
      body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const isActive = (href: string) => {
    const h = normalizePath(href);
    if (h === home) return path === home;
    return path === h || path.startsWith(`${h}/`);
  };

  /** Beide Sprachen ins Markup — die Leiste steht damit schon vor der Hydration richtig da */
  const label = (key: NavItem['labelKey']) => (
    <>
      <span data-lang="de">{copy.de.nav[key]}</span>
      <span data-lang="en">{copy.en.nav[key]}</span>
    </>
  );

  const pageItem = items.find((it) => normalizePath(it.href) !== home && isActive(it.href));
  // In der Halle steht die Station auf der Plakette unten — die Leiste zeigt sie erst im Zoom, Close-up und Spiel
  const showStation = Boolean(st) && (st?.mode ?? mode) !== 'hall';

  return (
    <header className={`site-nav${caseLike ? ' is-case' : ''}${inHallWorld ? ' is-world' : ' is-page'}${quiet ? ' is-quiet' : ''}`}>
      <div className="site-nav__bar">
        <div className="site-nav__left">
          <a href={homeHref} className="site-nav__brand" aria-label={`${brand} — Home`}>

            <span className="site-nav__name" data-edit="site.name">
              {brand.split(' ')[0]}
            </span>
          </a>
        </div>

        {/* Mitte: die Station der Halle, sonst die Seite */}
        <p className="site-nav__readout mono" aria-live="polite">
          {showStation && st ? (
            <>
              <span className="site-nav__count">
                {nn(st.index)} / {nn(st.total - 1)}
              </span>
              <span className="site-nav__sep" aria-hidden>
                ·
              </span>
              <span className="site-nav__title"><span data-lang="de">{st.title}</span><span data-lang="en">{st.titleEn ?? st.title}</span></span>
            </>
          ) : !st && pageItem ? (
            <span className="site-nav__title">{label(pageItem.labelKey)}</span>
          ) : null}
        </p>

        <div className="site-nav__right">
          {items.filter((it) => it.labelKey === 'work' || it.labelKey === 'about' || it.labelKey === 'contact').map((item) => (
            <a key={item.href} href={item.href} className={`site-nav__direct site-nav__direct--${item.labelKey}`} aria-current={isActive(item.href) ? 'page' : undefined}>{label(item.labelKey)}</a>
          ))}
          <LangSwitch initialLang={initialLang} />

          <button
            ref={btnRef}
            type="button"
            className={`site-nav__menu${open ? ' is-open' : ''}`}
            aria-label={lang === 'en' ? (open ? 'Close menu' : 'Open menu') : (open ? 'Menü schließen' : 'Menü öffnen')}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} size={18} />
            <span className="site-nav__menu-label">
              <span data-lang="de">{copy.de.nav.menu}</span>
              <span data-lang="en">{copy.en.nav.menu}</span>
            </span>
          </button>
        </div>

        {open ? (
          <div ref={panelRef} id="site-menu" className="nav-dropdown site-nav__sheet" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'Menu' : 'Menü'}>
            <div className="site-nav__sheet-heading">
              <p className="site-nav__directory">Navigation</p>
              <button type="button" className="site-nav__dismiss" aria-label={lang === 'en' ? 'Close menu' : 'Menü schließen'} onClick={() => { setOpen(false); btnRef.current?.focus(); }}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <ul className="nav-dropdown__list">
              {items.map((item) => {
                const active = isActive(item.href);
                // Stationen der Halle bekommen ihren Zähler: Über mich steht ganz links, Kontakt ganz rechts
                const suffix = st && item.labelKey === 'about' ? `01 / ${nn(st.total - 1)}` : st && item.labelKey === 'contact' ? `${nn(st.total - 1)} / ${nn(st.total - 1)}` : null;
                return (
                  <li key={item.href}>
                    <a href={item.href} aria-current={active ? 'page' : undefined} className={`nav-dropdown__link${active ? ' is-active' : ''}`} onClick={() => setOpen(false)}>
                      <span className="site-nav__entry"><Icon name={routeIcons[item.labelKey] ?? 'grid'} size={20} />{label(item.labelKey)}</span>
                      {suffix ? <span className="site-nav__suffix mono">{suffix}</span> : active ? <span className="nav-dropdown__dot" aria-hidden /> : null}
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="site-nav__utilities">
              <a href={`${homeHref.replace(/\/$/, '')}/impressum/`}>{lang === 'en' ? 'Legal notice' : 'Impressum'}</a>
              <a href={`${homeHref.replace(/\/$/, '')}/privacy/`}>{lang === 'en' ? 'Privacy' : 'Datenschutz'}</a>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

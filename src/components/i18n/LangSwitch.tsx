import { useEffect, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import type { Lang } from '../../lib/i18n';

/**
 * Sprachwechsel über echte Routen: DE lebt auf /…, EN auf /en/….
 * Die URL ist die Quelle der Wahrheit — html[data-lang] wird serverseitig pro Route gesetzt; der Toggle
 * navigiert zur Schwester-URL. Die EN-Seiten sind das DE-HTML mit html[data-lang="en"] (scripts/en-routes.mjs),
 * darum kommt der aktive Zustand aus CSS (html[data-lang] .lang-switch [data-part]) und nicht aus React-Klassen —
 * abweichende Server-Attribute würde die Hydration nicht korrigieren.
 * Der Wechsel läuft als weiche Navigation: die Halle bleibt stehen und zündet nicht neu; der Swap setzt
 * html[data-lang], Halle und Navigation beobachten das Attribut.
 */
export default function LangSwitch({ initialLang = 'de' }: { initialLang?: Lang }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const label = () => {
      const en = document.documentElement.dataset.lang === 'en';
      const b = ref.current;
      if (!b) return;
      b.setAttribute('aria-label', en ? 'Auf Deutsch wechseln' : 'Switch to English');
      b.title = en ? 'Deutsch' : 'English';
    };
    label();
    const observer = new MutationObserver(label);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    // Sprache zur Klickzeit aus dem DOM lesen (serverseitig pro Route gesetzt)
    const current: Lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
    const next: Lang = current === 'de' ? 'en' : 'de';
    const { pathname, search, hash } = window.location;
    const target =
      next === 'en'
        ? pathname.startsWith('/en/') || pathname === '/en'
          ? pathname
          : `/en${pathname === '/' ? '/' : pathname}`
        : pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    navigate(`${target}${search}${hash}`);
  };

  return (
    <button
      ref={ref}
      type="button"
      className="lang-switch"
      onClick={toggle}
      aria-label={initialLang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
      title={initialLang === 'de' ? 'English' : 'Deutsch'}
    >
      <span data-part="de">DE</span>
      <span className="lang-switch__sep" aria-hidden>
        /
      </span>
      <span data-part="en">EN</span>
    </button>
  );
}

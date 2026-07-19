import { useEffect, useState } from 'react';
import type { Lang } from '../../lib/i18n';

const STORAGE_KEY = 'portfolio-lang';

/**
 * Sprachwechsel über echte Routen: DE lebt auf /…, EN auf /en/….
 * Die URL ist die Quelle der Wahrheit — html[data-lang] wird serverseitig
 * pro Route gesetzt; der Toggle navigiert zur Schwester-URL.
 */
export default function LangSwitch() {
  const [lang, setLang] = useState<Lang>('de');

  useEffect(() => {
    setLang(document.documentElement.dataset.lang === 'en' ? 'en' : 'de');
  }, []);

  const toggle = () => {
    // Sprache zur Klickzeit aus dem DOM lesen (serverseitig pro Route gesetzt) —
    // der React-State könnte direkt nach der Hydration noch beim Default stehen
    const current: Lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'de';
    const next: Lang = current === 'de' ? 'en' : 'de';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Speicherung optional */
    }
    const { pathname, search, hash } = window.location;
    const target =
      next === 'en'
        ? pathname.startsWith('/en/') || pathname === '/en'
          ? pathname
          : `/en${pathname === '/' ? '/' : pathname}`
        : pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    window.location.assign(`${target}${search}${hash}`);
  };

  return (
    <button
      type="button"
      className="lang-switch"
      onClick={toggle}
      aria-label={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
      title={lang === 'de' ? 'English' : 'Deutsch'}
    >
      <span className={lang === 'de' ? 'is-active' : ''} data-part="de">
        DE
      </span>
      <span className="lang-switch__sep" aria-hidden>
        /
      </span>
      <span className={lang === 'en' ? 'is-active' : ''} data-part="en">
        EN
      </span>
    </button>
  );
}

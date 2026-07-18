import { useEffect, useState } from 'react';
import type { Lang } from '../../lib/i18n';

const STORAGE_KEY = 'portfolio-lang';

function applyLang(lang: Lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

export default function LangSwitch() {
  const [lang, setLang] = useState<Lang>('de');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const next: Lang = saved === 'en' ? 'en' : 'de';
    setLang(next);
    applyLang(next);
  }, []);

  const toggle = () => {
    const next: Lang = lang === 'de' ? 'en' : 'de';
    setLang(next);
    applyLang(next);
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

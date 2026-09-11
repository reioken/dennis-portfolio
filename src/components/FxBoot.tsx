import { useEffect } from 'react';

/** Detect reduced motion / weak hints and expose --fx + accent helpers. */
export default function FxBoot() {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (mq.matches) root.classList.add('fx-off');
      else root.classList.remove('fx-off');
    };
    apply();
    mq.addEventListener('change', apply);

    const saved = localStorage.getItem('portfolio-accent');
    if (saved === 'ocean' || saved === 'ember' || saved === 'default') {
      if (saved === 'default') root.removeAttribute('data-accent');
      else root.setAttribute('data-accent', saved);
    }

    return () => mq.removeEventListener('change', apply);
  }, []);

  return null;
}

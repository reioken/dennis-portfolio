import { useEffect } from 'react';
import { applyAll } from '../../lib/layout-runtime';

/** Applies text/image overrides + block layout while the gate is enabled. */
export default function ContentRuntime() {
  useEffect(() => {
    const run = () => {
      // Don't fight live inline editing
      if (document.documentElement.dataset.editMode === '1') return;
      applyAll();
    };
    run();
    window.addEventListener('db-content-updated', run);
    window.addEventListener('astro:page-load', run);
    const t = window.setInterval(run, 2000);
    return () => {
      window.removeEventListener('db-content-updated', run);
      window.removeEventListener('astro:page-load', run);
      window.clearInterval(t);
    };
  }, []);

  return null;
}

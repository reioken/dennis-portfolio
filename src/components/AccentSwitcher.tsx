import { useEffect, useState } from 'react';

const accents = [
  { id: 'default', label: 'Nexus' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'ember', label: 'Ember' },
] as const;

export default function AccentSwitcher() {
  const [accent, setAccent] = useState<(typeof accents)[number]['id']>('default');

  useEffect(() => {
    const saved = localStorage.getItem('portfolio-accent');
    if (saved === 'ocean' || saved === 'ember' || saved === 'default') setAccent(saved);
  }, []);

  const apply = (id: (typeof accents)[number]['id']) => {
    setAccent(id);
    localStorage.setItem('portfolio-accent', id);
    const root = document.documentElement;
    if (id === 'default') root.removeAttribute('data-accent');
    else root.setAttribute('data-accent', id);
  };

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-[var(--stroke)] bg-[var(--glass)] p-1">
      {accents.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`min-h-9 rounded-full px-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${
            accent === a.id
              ? 'bg-[color-mix(in_srgb,var(--violet)_28%,transparent)] text-[var(--text)]'
              : 'text-[var(--dim)]'
          }`}
          onClick={() => apply(a.id)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

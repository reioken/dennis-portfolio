import Icon from '../icons/Icon';

export default function BackToTop({ labelDe, labelEn }: { labelDe: string; labelEn: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1.5 py-1.5 font-semibold uppercase tracking-[0.12em] text-[var(--faint)] transition-colors hover:text-[var(--text)]"
      onClick={() => {
        const target = document.querySelector<HTMLElement>('main h1, #main');
        if (target) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }}
    >
      <span data-lang="de">{labelDe}</span>
      <span data-lang="en">{labelEn}</span>
      <Icon name="arrow-up" size={16} />
    </button>
  );
}

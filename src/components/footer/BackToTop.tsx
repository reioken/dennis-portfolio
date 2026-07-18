export default function BackToTop({ labelDe, labelEn }: { labelDe: string; labelEn: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em] text-[var(--faint)] transition-colors hover:text-[var(--text)]"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <span data-lang="de">{labelDe}</span>
      <span data-lang="en">{labelEn}</span>
      <span aria-hidden="true">↑</span>
    </button>
  );
}

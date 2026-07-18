import BrandMark from './BrandMark';

type Props = {
  name: string;
  role?: string;
  className?: string;
  weight?: 'nav' | 'hero' | 'footer';
  compact?: boolean;
};

/**
 * [mark]  Name
 *         Title
 * Fixed mark size — never overlaps text.
 */
export default function BrandLockup({
  name,
  role = 'UX/UI Designer · Art Director',
  className = '',
  weight = 'hero',
  compact = false,
}: Props) {
  const markSize = weight === 'nav' ? 30 : weight === 'footer' ? 40 : compact ? 44 : 56;

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <BrandMark size={markSize} weight={weight} title={name} className="shrink-0" />
      <div className="min-w-0 flex flex-col justify-center gap-1">
        <p
          className={`font-[family-name:var(--font-display)] font-medium tracking-[-0.01em] text-[var(--text)] ${
            compact ? 'text-[0.95rem] leading-tight' : 'text-[clamp(1.1rem,2.6vw,1.5rem)] leading-tight'
          }`}
          data-edit="site.name"
        >
          {name}
        </p>
        <p
          className={`font-medium uppercase tracking-[0.18em] text-[var(--dim)] ${
            compact ? 'text-[0.58rem] leading-none' : 'text-[0.68rem] leading-none'
          }`}
        >
          {role}
        </p>
      </div>
    </div>
  );
}

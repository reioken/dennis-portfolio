type Weight = 'nav' | 'hero' | 'footer' | 'auto';

type Props = {
  className?: string;
  size?: number;
  weight?: Weight;
  title?: string;
};

/**
 * DBF monogram — brand gradient + soft glow (matches site violet→blue→ice).
 * Masked from mark-white.png so the silhouette stays crisp.
 */
export default function BrandMark({
  className = '',
  size = 32,
  weight = 'auto',
  title = 'Dennis Bierreth-Fernandez',
}: Props) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const mask = `url("${base}brand/mark-white.png")`;
  const hero = weight === 'hero' || size >= 48;
  const nav = weight === 'nav' || (!hero && size <= 32);
  const glow = hero
    ? 'drop-shadow(0 0 14px color-mix(in srgb, var(--violet) 45%, transparent)) drop-shadow(0 0 28px color-mix(in srgb, var(--blue) 28%, transparent))'
    : nav
      ? undefined // nav glow + hover shimmer live in CSS
      : 'drop-shadow(0 0 10px color-mix(in srgb, var(--blue) 30%, transparent))';

  return (
    <span
      role="img"
      aria-label={title}
      className={`brand-mark inline-block shrink-0 ${hero ? 'brand-mark--hero' : ''} ${nav ? 'brand-mark--nav' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: nav
          ? 'linear-gradient(125deg, var(--violet) 0%, var(--blue) 30%, color-mix(in srgb, var(--ice) 70%, white) 48%, var(--blue) 66%, var(--violet) 100%)'
          : 'linear-gradient(135deg, var(--violet) 0%, var(--blue) 48%, var(--ice) 100%)',
        backgroundSize: nav ? '240% 240%' : '200% 200%',
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        filter: glow,
      }}
    />
  );
}

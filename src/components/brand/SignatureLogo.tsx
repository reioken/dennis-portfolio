import paths from '../../assets/brand/signature-paths.json';
import './signature-logo.css';

/** Shared vector artwork; instance names keep clip/gradient IDs unique. */
export default function SignatureLogo({ instance, decorative = false }: { instance: 'header' | 'startup'; decorative?: boolean }) {
  const clip = `signature-${instance}-clip`;
  const sheen = `signature-${instance}-sheen`;
  const foil = `signature-${instance}-foil`;
  const glare = `signature-${instance}-glare`;
  const grain = `signature-${instance}-grain`;
  return (
    <svg className="signature-logo" viewBox={paths.viewBox} width="670" height="155"
      onPointerMove={instance === 'header' ? event => {
        if (event.pointerType === 'touch') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        event.currentTarget.style.setProperty('--foil-shift', `${(x - .5) * 240}px`);
        event.currentTarget.style.setProperty('--foil-glare-x', `${(x - .5) * 670}px`);
        event.currentTarget.style.setProperty('--foil-glare-y', `${(y - .5) * 155}px`);
      } : undefined}
      role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'dennisbf.'}
      aria-hidden={decorative || undefined} focusable="false">
      <defs>
        <clipPath id={clip}><path d={paths.word} clipRule="evenodd" /><path d={paths.dot} clipRule="evenodd" /></clipPath>
        <linearGradient id={sheen}>
          <stop offset="0" stopColor="#c1a0ef" stopOpacity="0" />
          <stop offset=".35" stopColor="#c5efed" stopOpacity=".35" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity=".85" />
          <stop offset=".65" stopColor="#f0c5e6" stopOpacity=".4" />
          <stop offset="1" stopColor="#c1a0ef" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={foil} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7a85bc" />
          <stop offset=".18" stopColor="#c1b4e8" />
          <stop offset=".34" stopColor="#83b9df" />
          <stop offset=".48" stopColor="#c0e5df" />
          <stop offset=".58" stopColor="#ecdfbc" />
          <stop offset=".69" stopColor="#a9b7e5" />
          <stop offset=".83" stopColor="#b4a0d8" />
          <stop offset="1" stopColor="#98d0dc" />
        </linearGradient>
        <radialGradient id={glare}>
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset=".25" stopColor="#e4f5ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <pattern id={grain} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
          <path d="M0 0V5" stroke="#f4f8ff" strokeWidth=".7" />
        </pattern>
      </defs>
      <path className="signature-logo__ink" d={paths.word} fillRule="evenodd" />
      <path className="signature-logo__dot" d={paths.dot} fillRule="evenodd" />
      {instance === 'header' && <g className="signature-logo__holo" clipPath={`url(#${clip})`}>
        <rect className="signature-logo__foil" x="-335" y="-155" width="1340" height="465" fill={`url(#${foil})`} />
        <ellipse className="signature-logo__glare" cx="335" cy="77" rx="220" ry="125" fill={`url(#${glare})`} />
        <rect width="670" height="155" fill={`url(#${grain})`} opacity=".16" />
      </g>}
      <g clipPath={`url(#${clip})`}><rect className="signature-logo__sweep" x="0" y="0" width="220" height="155" fill={`url(#${sheen})`} /></g>
    </svg>
  );
}

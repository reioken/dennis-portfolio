import { useEffect, useRef } from 'react';
import logoSvg from '../../assets/logos/nexus-live.svg?raw';

/** NEXUS diamond mark — splash shimmer on hover (`active`). */
export default function NexusSplashMark({
  className = '',
  title = 'NEXUS',
  active = false,
}: {
  className?: string;
  title?: string;
  active?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = rootRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg?.pauseAnimations) return;
    if (active) svg.unpauseAnimations();
    else {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }
  }, [active]);

  return (
    <div
      ref={rootRef}
      className={`nx-sp ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <div className="nx-sp__aura" aria-hidden />
      <div className="nx-sp__rays" aria-hidden />
      <div className="nx-sp__wrap" aria-hidden>
        <span className="nx-sp__burst" />
        <span className="nx-sp__glint g1" />
        <span className="nx-sp__glint g2" />
        <span className="nx-sp__glint g3" />
        <span className="nx-sp__glint g4" />
        <div
          className="nx-sp__mark"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
      </div>
    </div>
  );
}

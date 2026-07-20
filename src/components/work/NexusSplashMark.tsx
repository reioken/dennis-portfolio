import { useEffect, useRef } from 'react';
import logoSvg from '../../assets/logos/nexus-live.svg?raw';

/**
 * NEXUS diamond — ambient prismatic float by default, full crystal flex on hover.
 * SVG SMIL runs continuously (no pause/reset) so loops stay seamless.
 */
export default function NexusSplashMark({
  className = '',
  title = 'NEXUS',
  active = false,
  ambient = true,
}: {
  className?: string;
  title?: string;
  active?: boolean;
  /** When false (reduced motion), freeze SVG SMIL */
  ambient?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = rootRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg?.pauseAnimations) return;
    if (ambient) svg.unpauseAnimations();
    else {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
    }
  }, [ambient]);

  return (
    <div
      ref={rootRef}
      className={`nx-sp ${ambient ? 'is-live' : ''} ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <div className="nx-sp__aura" aria-hidden />
      <div className="nx-sp__aura nx-sp__aura--core" aria-hidden />
      <div className="nx-sp__rays" aria-hidden />
      <div className="nx-sp__dust" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`nx-sp__mote m${i + 1}`} />
        ))}
      </div>
      <div className="nx-sp__wrap" aria-hidden>
        <span className="nx-sp__burst" />
        <span className="nx-sp__glint g1" />
        <span className="nx-sp__glint g2" />
        <span className="nx-sp__glint g3" />
        <span className="nx-sp__glint g4" />
        <span className="nx-sp__glint g5" />
        <span className="nx-sp__glint g6" />
        <div
          className="nx-sp__mark"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
      </div>
    </div>
  );
}

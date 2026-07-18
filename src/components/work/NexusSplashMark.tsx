import logoSvg from '../../assets/logos/nexus-live.svg?raw';

/** NEXUS diamond mark + splash-stage shimmer (chroma, glow, aura, rays, glints). */
export default function NexusSplashMark({
  className = '',
  title = 'NEXUS',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`nx-sp ${className}`}
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

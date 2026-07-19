/**
 * Website Designs card mark — stacked client site previews with ambient drift.
 */
const SITES = [
  { src: '/media/websites/gecam-cover.webp', alt: 'GECAM' },
  { src: '/media/websites/leonardo-cover.webp', alt: 'Leonardo' },
  { src: '/media/websites/aak-cover.webp', alt: 'AAK' },
  { src: '/media/websites/bouche-cover.webp', alt: 'Bouche' },
] as const;

export default function WebsitesStackLogo({
  className = '',
  title = 'Website Designs',
  active = false,
}: {
  className?: string;
  title?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`web-stack ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <div className="web-stack__stage" aria-hidden>
        {SITES.map((site, i) => (
          <div key={site.src} className={`web-stack__card c${i + 1}`}>
            <img src={site.src} alt="" draggable={false} decoding="async" />
          </div>
        ))}
      </div>
    </div>
  );
}

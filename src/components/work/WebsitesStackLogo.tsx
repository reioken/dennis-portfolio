/**
 * Website Designs card mark — stacked newer client previews with ambient drift.
 */
const SITES = [
  { src: '/media/websites/baufinanz-cover.webp', alt: 'Baufinanz' },
  { src: '/media/websites/willi-alt-cover.webp', alt: 'Willi Alt' },
  { src: '/media/websites/ig-seidel-cover.webp', alt: 'IG Seidel' },
  { src: '/media/sportmueller/category-1.webp', alt: 'SportMüller Shop' },
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

/** Renders an animated SVG logo via <object> so SMIL loops actually play. */
export default function AnimatedLogo({
  src,
  className = '',
  title = '',
}: {
  src: string;
  className?: string;
  title?: string;
}) {
  return (
    <object
      data={src}
      type="image/svg+xml"
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={`pointer-events-none ${className}`}
    >
      {/* Fallback if object fails */}
      <img src={src} alt="" className={className} decoding="async" />
    </object>
  );
}

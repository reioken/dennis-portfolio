/**
 * Floordirekt Studio lockup — rebuilt with the site font (Outfit, skewed for the
 * italic brand look), dotless ı carrying the yellow check, red STUDIO tag.
 * On hover (`active`): studio-flash glow sweep, check pop, STUDIO blinks on air.
 */
export default function FdStudioLiveLogo({
  className = '',
  title = 'Floordirekt Studio',
  active = false,
}: {
  className?: string;
  title?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`fdl ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <svg viewBox="0 0 440 130" aria-hidden className="fdl__svg">
        <g transform="skewX(-8)" className="fdl__word">
          <text
            x="36"
            y="92"
            fill="#ffffff"
            fontFamily="var(--font-display)"
            fontSize="58"
            fontWeight="800"
            letterSpacing="-0.5"
          >
            Floordırekt
          </text>
        </g>
        {/* Yellow check — drawn in final (already slanted) coordinates like the
            brand original: chunky, flat perpendicular cuts, elbow resting on the
            ı stem, long right arm reaching over toward the r. */}
        <g className="fdl__check">
          <path
            d="M203.5 49 L209.5 44.5 L214.5 50 L230.5 36 L236.5 42 L213 61 Z"
            fill="#ffd23f"
          />
        </g>
        <text
          className="fdl__reg"
          x="326"
          y="97"
          fill="#ffffff"
          fontFamily="var(--font-display)"
          fontSize="11"
          fontWeight="700"
        >
          ®
        </text>
        <text
          className="fdl__studio"
          x="344"
          y="51"
          fill="#e2313f"
          fontFamily="var(--font-display)"
          fontSize="16"
          fontWeight="800"
          letterSpacing="3.5"
        >
          STUDIO
        </text>
      </svg>
    </div>
  );
}

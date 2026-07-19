import { useEffect, useId, useRef, useState } from 'react';

/**
 * Berry-Bot mark — same laugh as the app header brand, triggered on hover.
 */
export default function BerryLiveLogo({
  className = '',
  title = 'Berry',
  active = false,
}: {
  className?: string;
  title?: string;
  active?: boolean;
}) {
  const [laughing, setLaughing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActive = useRef(false);
  const uid = `berry-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const ambient = className.includes('is-ambient');

  useEffect(() => {
    if (active && !wasActive.current) {
      if (timer.current) clearTimeout(timer.current);
      setLaughing(true);
      timer.current = setTimeout(() => setLaughing(false), 700);
    }
    wasActive.current = active;
    if (!active) {
      setLaughing(false);
      if (timer.current) clearTimeout(timer.current);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active]);

  return (
    <div
      className={`berry-live ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <svg
        viewBox="0 0 96 96"
        aria-hidden
        className="berry-live__bot"
        data-laugh={laughing || undefined}
      >
        <defs>
          <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8fff2" stopOpacity="0.05" />
            <stop offset="32%" stopColor="#9dffc8" stopOpacity="0.95" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="64%" stopColor="#5ce6a0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e8fff2" stopOpacity="0.05" />
            {ambient ? (
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from="0 0.5 0.5"
                to="360 0.5 0.5"
                dur="8s"
                repeatCount="indefinite"
              />
            ) : null}
          </linearGradient>
        </defs>
        <rect className="bot-shell" x="2" y="45" width="10" height="21" rx="5" />
        <rect className="bot-accent" x="2" y="55" width="10" height="11" rx="5" />
        <rect className="bot-shell" x="84" y="45" width="10" height="21" rx="5" />
        <rect className="bot-accent" x="84" y="55" width="10" height="11" rx="5" />
        <g className="bot-leaves">
          <path
            className="bot-shell-stroke"
            d="M50 26 C51 18 54 13 60 9"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path className="bot-accent" d="M52 16 C44 4 26 2 16 12 C22 24 42 26 52 16 Z" />
          <path className="bot-accent2" d="M60 12 C66 4 78 3 84 10 C80 20 66 20 60 12 Z" />
        </g>
        <ellipse className="bot-head" cx="48" cy="56" rx="35" ry="31" strokeWidth="1.5" />
        {/* Soft prism rim — light walks the silhouette */}
        <ellipse
          cx="48"
          cy="56"
          rx="35"
          ry="31"
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth="3.2"
          opacity="0.35"
          style={{ mixBlendMode: 'screen' }}
        />
        <ellipse
          cx="48"
          cy="56"
          rx="35"
          ry="31"
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth="1.1"
          opacity="0.85"
          style={{ mixBlendMode: 'screen' }}
        />
        <rect
          className="bot-visor"
          x="20"
          y="38"
          width="56"
          height="35"
          rx="14"
          strokeWidth="2.75"
        />
        <rect
          x="20"
          y="38"
          width="56"
          height="35"
          rx="14"
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth="2.4"
          opacity="0.4"
          style={{ mixBlendMode: 'screen' }}
        />
        <rect
          x="20"
          y="38"
          width="56"
          height="35"
          rx="14"
          fill="none"
          stroke={`url(#${uid}-rim)`}
          strokeWidth="0.9"
          opacity="0.9"
          style={{ mixBlendMode: 'screen' }}
        />
        <path
          className="bot-line"
          d="M29.5 56 Q35.5 47.5 41.5 56"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="bot-line"
          d="M54.5 56 Q60.5 47.5 66.5 56"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="bot-mouth-idle bot-line"
          d="M43.5 61.5 Q48 65.5 52.5 61.5"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path className="bot-mouth-open bot-accent" d="M40 60 L56 60 A8 8 0 0 1 40 60 Z" />
        <rect className="bot-accent" x="33" y="78.5" width="9" height="4" rx="2" />
        <circle className="bot-accent" cx="49" cy="80.5" r="2.2" />
        <circle className="bot-accent" cx="56.5" cy="80.5" r="2.2" />
        <circle className="bot-accent" cx="64" cy="80.5" r="2.2" />
      </svg>
    </div>
  );
}

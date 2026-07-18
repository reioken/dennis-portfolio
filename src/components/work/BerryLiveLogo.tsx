import { useEffect, useState } from 'react';

/**
 * Berry-Bot mark — same laugh animation as the top-left brand tap in the app.
 * Loops so the card shows the interaction without requiring a click.
 */
export default function BerryLiveLogo({
  className = '',
  title = 'Berry',
}: {
  className?: string;
  title?: string;
}) {
  const [laughing, setLaughing] = useState(false);

  useEffect(() => {
    let laughTimer: ReturnType<typeof setTimeout> | undefined;
    const cycle = () => {
      setLaughing(true);
      laughTimer = setTimeout(() => setLaughing(false), 700);
    };
    // First laugh shortly after mount, then every 2.8s
    const first = setTimeout(cycle, 600);
    const loop = setInterval(cycle, 2800);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
      if (laughTimer) clearTimeout(laughTimer);
    };
  }, []);

  return (
    <div className={`berry-live ${className}`} role="img" aria-label={title}>
      <svg
        viewBox="0 0 96 96"
        aria-hidden
        className="berry-live__bot"
        data-laugh={laughing || undefined}
      >
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
        <rect
          className="bot-visor"
          x="20"
          y="38"
          width="56"
          height="35"
          rx="14"
          strokeWidth="2.75"
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

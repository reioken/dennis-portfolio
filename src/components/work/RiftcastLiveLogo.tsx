import { useId } from 'react';

/**
 * Riftcast R mark — clean rebuild of the speed-R (pennant arm, bowl, blade, slash leg).
 * On hover (`active`) the mark "casts": sustained tilt, glow pulse and broadcast rings.
 */
export default function RiftcastLiveLogo({
  className = '',
  title = 'Riftcast',
  active = false,
}: {
  className?: string;
  title?: string;
  active?: boolean;
}) {
  const gradId = `rcg-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const rimDur = active ? '5.5s' : '10s';

  return (
    <div
      className={`rc-live ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <span className="rc-live__ring rc-live__ring--1" aria-hidden />
      <span className="rc-live__ring rc-live__ring--2" aria-hidden />
      <span className="rc-live__ring rc-live__ring--3" aria-hidden />
      <svg viewBox="0 0 64 64" aria-hidden className="rc-live__mark">
        <defs>
          <linearGradient id={gradId} x1="8" y1="2" x2="54" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.45" stopColor="#D8DEFF" />
            <stop offset="1" stopColor="#B69CFF" />
          </linearGradient>
          <linearGradient id={`${gradId}-rim`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0" stopColor="#B69CFF" stopOpacity="0" />
            <stop offset="0.38" stopColor="#D8DEFF" stopOpacity="0.18" />
            <stop offset="0.5" stopColor="#F4F6FF" stopOpacity="0.48" />
            <stop offset="0.62" stopColor="#8EC5FF" stopOpacity="0.2" />
            <stop offset="1" stopColor="#B69CFF" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 32 32"
              to="360 32 32"
              dur={rimDur}
              repeatCount="indefinite"
            />
          </linearGradient>
          <filter id={`${gradId}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          fill={`url(#${gradId})`}
          d="M4.5 4 L37 4 C48.5 4 58 11.5 58 23 C58 31.5 52.5 37.5 44 40 L57.5 58.5 L47 58.5 L33 43 L18.5 36 C30 38.6 45.5 34.5 45.5 23 C45.5 14.5 40 11.5 33.5 11.5 L14 11.5 Z"
        />
        <path
          fill="none"
          stroke={`url(#${gradId}-rim)`}
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter={`url(#${gradId}-soft)`}
          opacity="0.42"
          style={{ mixBlendMode: 'screen' }}
          d="M4.5 4 L37 4 C48.5 4 58 11.5 58 23 C58 31.5 52.5 37.5 44 40 L57.5 58.5 L47 58.5 L33 43 L18.5 36 C30 38.6 45.5 34.5 45.5 23 C45.5 14.5 40 11.5 33.5 11.5 L14 11.5 Z"
        />
        <path
          fill="none"
          stroke={`url(#${gradId}-rim)`}
          strokeWidth="0.7"
          strokeLinejoin="round"
          opacity="0.4"
          style={{ mixBlendMode: 'screen' }}
          d="M4.5 4 L37 4 C48.5 4 58 11.5 58 23 C58 31.5 52.5 37.5 44 40 L57.5 58.5 L47 58.5 L33 43 L18.5 36 C30 38.6 45.5 34.5 45.5 23 C45.5 14.5 40 11.5 33.5 11.5 L14 11.5 Z"
        />
      </svg>
    </div>
  );
}

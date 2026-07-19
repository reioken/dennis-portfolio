import { useId } from 'react';

/**
 * Mina lockup — white wordmark + speech bubble, coral heart.
 * On hover (`active`) the bubble gives a little nudge, the heart beats and
 * two mini hearts float up out of the bubble.
 * Soft coral/cream rim behind the strokes for a premium edge catch.
 */
export default function MinaLiveLogo({
  className = '',
  title = 'Mina',
  active = false,
}: {
  className?: string;
  title?: string;
  active?: boolean;
}) {
  const uid = `mina-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const ambient = className.includes('is-ambient');

  const wordPaths = (
    <>
      <path d="M30 193 V126" />
      <path d="M30 148 Q30 121 55 121 Q80 121 80 148 V193" />
      <path d="M80 148 Q80 121 105 121 Q130 121 130 148 V193" />
      <path d="M172 193 V126" />
      <path d="M214 193 V126" />
      <path d="M214 148 Q214 121 239 121 Q264 121 264 148 V193" />
      <circle cx="330" cy="157" r="36" />
      <path d="M366 193 V126" />
    </>
  );

  const bubblePath =
    'M150 14 h60 a16 16 0 0 1 16 16 v32 a16 16 0 0 1 -16 16 h-22 l-14 14 v-14 h-24 a16 16 0 0 1 -16 -16 V30 a16 16 0 0 1 16 -16 z';

  return (
    <div
      className={`mina-live ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <svg viewBox="0 0 400 220" aria-hidden className="mina-live__svg">
        <defs>
          {/* Contrasting coral → cream rim (against white wordmark) */}
          <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f4796b" stopOpacity="0" />
            <stop offset="28%" stopColor="#f4796b" stopOpacity="0.55" />
            <stop offset="48%" stopColor="#ffe8e2" stopOpacity="0.7" />
            <stop offset="58%" stopColor="#ffb4a8" stopOpacity="0.45" />
            <stop offset="78%" stopColor="#f4796b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f4796b" stopOpacity="0" />
            {ambient ? (
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from="0 0.5 0.5"
                to="360 0.5 0.5"
                dur="11s"
                repeatCount="indefinite"
              />
            ) : null}
          </linearGradient>
          <linearGradient id={`${uid}-rim-core`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff6f4" stopOpacity="0" />
            <stop offset="42%" stopColor="#ffd0c8" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="58%" stopColor="#f4796b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fff6f4" stopOpacity="0" />
            {ambient ? (
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from="180 0.5 0.5"
                to="540 0.5 0.5"
                dur="13s"
                repeatCount="indefinite"
              />
            ) : null}
          </linearGradient>
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer coral bloom — sits behind white strokes */}
        <g
          stroke={`url(#${uid}-rim)`}
          strokeWidth="34"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.42"
          filter={`url(#${uid}-soft)`}
          style={{ mixBlendMode: 'screen' }}
        >
          {wordPaths}
        </g>
        <path
          d={bubblePath}
          stroke={`url(#${uid}-rim)`}
          strokeWidth="16"
          strokeLinejoin="round"
          fill="none"
          opacity="0.4"
          filter={`url(#${uid}-soft)`}
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Tighter specular core on the silhouette */}
        <g
          stroke={`url(#${uid}-rim-core)`}
          strokeWidth="29"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.5"
          style={{ mixBlendMode: 'screen' }}
        >
          {wordPaths}
        </g>
        <path
          d={bubblePath}
          stroke={`url(#${uid}-rim-core)`}
          strokeWidth="12.5"
          strokeLinejoin="round"
          fill="none"
          opacity="0.48"
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Crisp white wordmark */}
        <g
          stroke="#ffffff"
          strokeWidth="27"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {wordPaths}
        </g>
        <g className="mina-live__bubble">
          <path
            d={bubblePath}
            stroke="#ffffff"
            strokeWidth="11"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            className="mina-live__heart"
            d="M180 38 C175.5 28.5 161 28.5 157.5 39 C154 49 164 56 180 68 C196 56 206 49 202.5 39 C199 28.5 184.5 28.5 180 38 Z"
            fill="#f4796b"
          />
        </g>
        <path
          className="mina-live__mini mina-live__mini--1"
          d="M180 38 C175.5 28.5 161 28.5 157.5 39 C154 49 164 56 180 68 C196 56 206 49 202.5 39 C199 28.5 184.5 28.5 180 38 Z"
          fill="#f4796b"
          transform="translate(165 4) scale(0.34)"
        />
        <path
          className="mina-live__mini mina-live__mini--2"
          d="M180 38 C175.5 28.5 161 28.5 157.5 39 C154 49 164 56 180 68 C196 56 206 49 202.5 39 C199 28.5 184.5 28.5 180 38 Z"
          fill="#ffffff"
          transform="translate(120 -2) scale(0.26)"
        />
      </svg>
    </div>
  );
}

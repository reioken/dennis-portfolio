/**
 * Mina lockup — white wordmark + speech bubble, coral heart.
 * On hover (`active`) the bubble gives a little nudge, the heart beats and
 * two mini hearts float up out of the bubble.
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
  return (
    <div
      className={`mina-live ${active ? 'is-hot' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <svg viewBox="0 0 400 220" aria-hidden className="mina-live__svg">
        <g
          stroke="#ffffff"
          strokeWidth="27"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          <path d="M30 193 V126" />
          <path d="M30 148 Q30 121 55 121 Q80 121 80 148 V193" />
          <path d="M80 148 Q80 121 105 121 Q130 121 130 148 V193" />
          <path d="M172 193 V126" />
          <path d="M214 193 V126" />
          <path d="M214 148 Q214 121 239 121 Q264 121 264 148 V193" />
          <circle cx="330" cy="157" r="36" />
          <path d="M366 193 V126" />
        </g>
        <g className="mina-live__bubble">
          <path
            d="M150 14 h60 a16 16 0 0 1 16 16 v32 a16 16 0 0 1 -16 16 h-22 l-14 14 v-14 h-24 a16 16 0 0 1 -16 -16 V30 a16 16 0 0 1 16 -16 z"
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

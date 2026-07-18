type Shot = { src: string; alt?: string };

type Props = {
  shots: Shot[];
};

type IndexedShot = Shot & { slot: number };

/** Slow dual-rail screenshot collage for the hero background (CSS-driven). */
export default function WorkCollage({ shots }: Props) {
  if (!shots.length) return null;

  // Cap weight: enough variety without duplicating the full library twice in network
  const trimmed: IndexedShot[] = shots.slice(0, 8).map((s, slot) => ({ ...s, slot }));
  const railA = [...trimmed, ...trimmed];
  const reversed = [...trimmed].reverse();
  const railB = [...reversed, ...reversed];

  return (
    <div className="hero-collage" aria-hidden>
      <div className="hero-collage__glow" />
      <div className="hero-collage__rail hero-collage__rail--a">
        <div className="hero-collage__track hero-collage__track--a">
          {railA.map((shot, i) => (
            <CollageCard
              key={`a-${i}`}
              src={shot.src}
              tilt={i % 2 === 0 ? -3 : 2.5}
              priority={i < 3}
              editKey={`img.collage.${shot.slot}`}
            />
          ))}
        </div>
      </div>
      <div className="hero-collage__rail hero-collage__rail--b">
        <div className="hero-collage__track hero-collage__track--b">
          {railB.map((shot, i) => (
            <CollageCard
              key={`b-${i}`}
              src={shot.src}
              tilt={i % 2 === 0 ? 2 : -2.5}
              wide={i % 3 === 0}
              priority={false}
              editKey={`img.collage.${shot.slot}`}
            />
          ))}
        </div>
      </div>
      <div className="hero-collage__vignette" />
    </div>
  );
}

function CollageCard({
  src,
  tilt,
  wide,
  editKey,
  priority,
}: {
  src: string;
  tilt: number;
  wide?: boolean;
  editKey?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`hero-collage__card ${wide ? 'hero-collage__card--wide' : ''}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <img
        src={src}
        alt=""
        width={720}
        height={450}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority="low"
        draggable={false}
        {...(editKey ? { 'data-edit-img': editKey } : {})}
      />
    </div>
  );
}

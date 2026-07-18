type Shot = { src: string; alt?: string; format?: 'phone' | 'wide' };

type Props = {
  shots: Shot[];
};

type IndexedShot = Shot & { slot: number };

/** Phone-app screenshots should keep portrait frames (not landscape crops). */
function resolveFormat(src: string, format?: Shot['format']): Shot['format'] {
  if (format) return format;
  if (/\/media\/berry\/shots\//.test(src)) return 'phone';
  if (/\/media\/riftcast\/shots\/screen-(app|quality|pad)/.test(src)) return 'phone';
  return undefined;
}

/** Build a seamless marquee track: dense half, then duplicated for -50% scroll. */
function loopTrack(items: IndexedShot[]): IndexedShot[] {
  if (!items.length) return [];
  const half =
    items.length >= 4
      ? [...items, ...items]
      : [...items, ...items, ...items, ...items];
  return [...half, ...half];
}

/**
 * Split into disjoint rails with matching rhythm (desktop/phone pairs),
 * so top and bottom stay visually symmetrical without shared screenshots.
 */
function splitRails(shots: IndexedShot[]): [IndexedShot[], IndexedShot[]] {
  if (shots.length < 2) return [shots, shots];

  const phones = shots.filter((s) => s.format === 'phone');
  const desks = shots.filter((s) => s.format !== 'phone');
  const top: IndexedShot[] = [];
  const bottom: IndexedShot[] = [];
  const n = Math.max(desks.length, phones.length);

  for (let i = 0; i < n; i++) {
    const rail = i % 2 === 0 ? top : bottom;
    if (desks[i]) rail.push(desks[i]!);
    if (phones[i]) rail.push(phones[i]!);
  }

  if (!top.length || !bottom.length) {
    const mid = Math.ceil(shots.length / 2);
    return [shots.slice(0, mid), shots.slice(mid)];
  }
  return [top, bottom];
}

/** Slow dual-rail screenshot collage for the hero background (CSS-driven). */
export default function WorkCollage({ shots }: Props) {
  if (!shots.length) return null;

  const trimmed: IndexedShot[] = shots.slice(0, 8).map((s, slot) => ({
    ...s,
    slot,
    format: resolveFormat(s.src, s.format),
  }));

  const [topBase, bottomBase] = splitRails(trimmed);
  const railA = loopTrack(topBase);
  // Reverse bottom order only — same set density, opposite scroll already in CSS
  const railB = loopTrack([...bottomBase].reverse());

  return (
    <div className="hero-collage" aria-hidden>
      <div className="hero-collage__glow" />
      <div className="hero-collage__rail hero-collage__rail--a">
        <div className="hero-collage__track hero-collage__track--a">
          {railA.map((shot, i) => (
            <CollageCard
              key={`a-${i}`}
              src={shot.src}
              format={shot.format}
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
              format={shot.format}
              tilt={i % 2 === 0 ? 2 : -2.5}
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
  format,
  editKey,
  priority,
}: {
  src: string;
  tilt: number;
  format?: 'phone' | 'wide';
  editKey?: string;
  priority?: boolean;
}) {
  const phone = format === 'phone';
  return (
    <div
      className={`hero-collage__card ${phone ? 'hero-collage__card--phone' : ''} ${format === 'wide' ? 'hero-collage__card--wide' : ''}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <img
        src={src}
        alt=""
        width={phone ? 390 : 720}
        height={phone ? 844 : 450}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority="low"
        draggable={false}
        {...(editKey ? { 'data-edit-img': editKey } : {})}
      />
    </div>
  );
}

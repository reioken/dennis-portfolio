type Props = {
  src: string;
  name: string;
  roleDe: string;
  roleEn: string;
};

/** Plain cutout — no orbit, glow, sheen, or motion. */
export default function PortraitStage({ src, name }: Props) {
  return (
    <div className="portrait-stage relative mx-auto w-full max-w-[560px]">
      <div className="portrait-cut">
        <img
          src={src}
          alt={`Portrait von ${name}`}
          width={1024}
          height={1024}
          className="portrait-cut__img"
          data-edit-img="img.portrait"
          decoding="async"
        />
      </div>
    </div>
  );
}

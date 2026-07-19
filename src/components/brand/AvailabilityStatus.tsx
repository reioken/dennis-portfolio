import { site } from '../../lib/site';

type Props = {
  showLocation?: boolean;
  className?: string;
};

/** Quiet availability strip — role at employer + freelance openness */
export default function AvailabilityStatus({ showLocation = false, className = '' }: Props) {
  const { de, en } = site.availability;
  return (
    <div className={`avail ${className}`.trim()}>
      <p className="avail__role">
        <span data-lang="de">
          {de.role} <span className="avail__muted">bei</span> {de.employer}
        </span>
        <span data-lang="en">
          {en.role} <span className="avail__muted">at</span> {en.employer}
        </span>
      </p>
      <p className="avail__open">
        <span className="avail__open-mark" aria-hidden />
        <span data-lang="de">{de.open}</span>
        <span data-lang="en">{en.open}</span>
      </p>
      {showLocation ? (
        <p className="avail__loc">
          <span data-lang="de">{site.location}</span>
          <span data-lang="en">Mannheim/Heidelberg area</span>
        </p>
      ) : null}
    </div>
  );
}

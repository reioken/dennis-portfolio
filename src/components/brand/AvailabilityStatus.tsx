import { site } from '../../lib/site';

type Props = {
  showLocation?: boolean;
  className?: string;
};

/** Status-Pill: fest angestellt · nicht open for hire · Freelance willkommen */
export default function AvailabilityStatus({ showLocation = false, className = '' }: Props) {
  const { de, en } = site.availability;
  return (
    <p className={`hero-status ${className}`.trim()}>
      <span className="hero-status__dot" aria-hidden />
      <span className="hero-status__body">
        <span data-lang="de" className="hero-status__lang">
          <span className="hero-status__part">{de.role}</span>
          <span className="hero-status__sep" aria-hidden>
            ·
          </span>
          <span className="hero-status__part hero-status__part--nohire">{de.noHire}</span>
          <span className="hero-status__sep" aria-hidden>
            ·
          </span>
          <span className="hero-status__part hero-status__part--freelance">{de.freelance}</span>
          {showLocation ? (
            <>
              <span className="hero-status__sep" aria-hidden>
                ·
              </span>
              <span className="hero-status__part">{site.location}</span>
            </>
          ) : null}
        </span>
        <span data-lang="en" className="hero-status__lang">
          <span className="hero-status__part">{en.role}</span>
          <span className="hero-status__sep" aria-hidden>
            ·
          </span>
          <span className="hero-status__part hero-status__part--nohire">{en.noHire}</span>
          <span className="hero-status__sep" aria-hidden>
            ·
          </span>
          <span className="hero-status__part hero-status__part--freelance">{en.freelance}</span>
          {showLocation ? (
            <>
              <span className="hero-status__sep" aria-hidden>
                ·
              </span>
              <span className="hero-status__part">Mannheim/Heidelberg area</span>
            </>
          ) : null}
        </span>
      </span>
    </p>
  );
}

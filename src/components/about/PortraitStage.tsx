import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Props = {
  src: string;
  name: string;
  roleDe: string;
  roleEn: string;
};

export default function PortraitStage({ src, name, roleDe, roleEn }: Props) {
  const reduce = useReducedMotion();
  const gid = useId().replace(/:/g, '');

  return (
    <div className={`portrait-stage relative mx-auto w-full max-w-[560px]${reduce ? '' : ' is-live'}`}>
      {/* Soft brand lights — sit behind the cutout, never over the face */}
      <div className="portrait-light portrait-light--violet" aria-hidden />
      <div className="portrait-light portrait-light--blue" aria-hidden />
      <div className="portrait-light portrait-light--ice" aria-hidden />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-6%]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 42, repeat: Infinity, ease: 'linear' }}
      >
        <motion.svg
          className="portrait-orbit absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          fill="none"
          initial={reduce ? { opacity: 0.28 } : { opacity: 0, scale: 0.94, rotate: -10 }}
          animate={reduce ? { opacity: 0.28 } : { opacity: 0.7, scale: 1, rotate: 0 }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <defs>
            <linearGradient id={`pt-orbit-${gid}`} x1="8%" y1="12%" x2="92%" y2="88%">
              <stop offset="0%" stopColor="var(--pt-violet)" stopOpacity="0.95" />
              <stop offset="38%" stopColor="var(--pt-blue)" stopOpacity="0.9" />
              <stop offset="68%" stopColor="var(--pt-ice)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--pt-violet)" stopOpacity="0.75" />
            </linearGradient>
          </defs>
          {/* Soft asymmetric blob — not a circle */}
          <path
            className="portrait-orbit__path"
            d="M52.4 3.8
               C71.2 2.2 89.6 14.8 94.8 32.6
               C99.6 49.8 93.2 70.4 80.4 83.2
               C66.8 96.8 46.2 101.2 29.6 94.4
               C14.2 88.2 4.4 72.6 3.6 55.8
               C2.8 38.4 11.6 20.2 26.8 11.4
               C35.8 6.2 44.2 4.6 52.4 3.8 Z"
            stroke={`url(#pt-orbit-${gid})`}
            strokeWidth="0.7"
            strokeLinecap="round"
          />
          <circle cx="52.4" cy="3.8" r="1.05" fill="var(--pt-violet)" opacity="0.8" />
          <circle cx="94.2" cy="48" r="0.9" fill="var(--pt-ice)" opacity="0.7" />
          <circle cx="22" cy="90" r="0.85" fill="var(--pt-blue)" opacity="0.6" />
        </motion.svg>
      </motion.div>

      <p className="portrait-name" aria-hidden>
        {name}
      </p>

      <motion.div
        className="portrait-cut relative z-[2]"
        style={{ ['--pt-mask' as string]: `url(${src})` }}
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.215, 0.61, 0.355, 1] }}
      >
        {/* Soft rim + site-gradient shimmer — masked to the cutout */}
        <span className="portrait-cut__rim" aria-hidden />
        <span className="portrait-cut__shimmer" aria-hidden />
        <img
          src={src}
          alt={`Portrait von ${name}`}
          width={1024}
          height={1024}
          className="relative z-10"
          data-edit-img="img.portrait"
          decoding="async"
        />
      </motion.div>

      <motion.div
        className="absolute bottom-1 right-1 z-20 max-w-[11.5rem] rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] px-3.5 py-3 shadow-[var(--lg-depth)]"
        style={{ backdropFilter: 'var(--frost-nav)', WebkitBackdropFilter: 'var(--frost-nav)' }}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, type: 'spring', stiffness: 160, damping: 20 }}
      >
        <p className="text-[0.78rem] font-semibold uppercase leading-tight tracking-[0.08em] text-[var(--text)]">
          <span data-lang="de" data-edit="about.role.de">
            {roleDe}
          </span>
          <span data-lang="en" data-edit="about.role.en">
            {roleEn}
          </span>
        </p>
      </motion.div>
    </div>
  );
}

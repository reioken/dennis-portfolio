import { motion, useReducedMotion } from 'motion/react';

type Props = {
  src: string;
  name: string;
  roleDe: string;
  roleEn: string;
};

export default function PortraitStage({ src, name, roleDe, roleEn }: Props) {
  const reduce = useReducedMotion();

  return (
    <div className={`portrait-stage relative mx-auto w-full max-w-[560px]${reduce ? '' : ' is-live'}`}>
      {/* Soft brand lights — sit behind the cutout, never over the face */}
      <div className="portrait-light portrait-light--violet" aria-hidden />
      <div className="portrait-light portrait-light--blue" aria-hidden />
      <div className="portrait-light portrait-light--ice" aria-hidden />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-4%]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 36, repeat: Infinity, ease: 'linear' }}
      >
        <motion.div
          className="portrait-orbit absolute inset-0 rounded-full"
          initial={reduce ? { opacity: 0.25 } : { opacity: 0, scale: 0.94, rotate: -8 }}
          animate={reduce ? { opacity: 0.25 } : { opacity: 0.55, scale: 1, rotate: 0 }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--violet)] opacity-70" />
          <span className="absolute bottom-[18%] right-0 h-1.5 w-1.5 translate-x-1/2 rounded-full bg-[var(--ice)] opacity-60" />
        </motion.div>
      </motion.div>

      <p
        aria-hidden
        className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap font-[family-name:var(--font-display)] text-[0.72rem] font-bold tracking-[0.35em] uppercase text-[var(--meta)] md:block"
      >
        {name}
      </p>

      <motion.div
        className="portrait-cut relative"
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

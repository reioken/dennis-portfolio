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
      {/* Soft orbit — slow, far out, no hard dashed ring */}
      <motion.div
        aria-hidden
        className="portrait-orbit pointer-events-none absolute inset-[-6%]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 48, repeat: Infinity, ease: 'linear' }}
      >
        <div className="portrait-orbit__ring absolute inset-0">
          <span className="portrait-spark portrait-spark--a" />
          <span className="portrait-spark portrait-spark--b" />
          <span className="portrait-spark portrait-spark--c" />
        </div>
      </motion.div>

      <p
        aria-hidden
        className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap font-[family-name:var(--font-display)] text-[0.72rem] font-bold tracking-[0.35em] uppercase text-[var(--meta)] md:block"
      >
        {name}
      </p>

      <motion.div
        className="portrait-cut relative"
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.215, 0.61, 0.355, 1] }}
      >
        <span
          className="portrait-cut__sheen"
          aria-hidden
          style={{
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            WebkitMaskSize: '100% auto',
            maskSize: '100% auto',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
        <img
          src={src}
          alt={`Portrait von ${name}`}
          width={720}
          height={720}
          className="relative z-10"
          data-edit-img="img.portrait"
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

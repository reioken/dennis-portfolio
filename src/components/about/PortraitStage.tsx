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
    <div className="portrait-stage relative mx-auto w-full max-w-[440px]">
      {/* Orbiting ring — continuous spin on the outer wrapper, entrance on the inner ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-8%]"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 28, repeat: Infinity, ease: 'linear' }}
      >
        <motion.div
          className="absolute inset-0 rounded-full border border-dashed border-[color-mix(in_srgb,var(--ice)_35%,transparent)]"
          initial={reduce ? { opacity: 0.4 } : { opacity: 0, scale: 0.9, rotate: -8 }}
          animate={reduce ? { opacity: 0.4 } : { opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ember)] shadow-[0_0_18px_var(--ember)]" />
          <span className="absolute bottom-[18%] right-0 h-2 w-2 translate-x-1/2 rounded-full bg-[var(--ice)] shadow-[0_0_14px_var(--ice)]" />
        </motion.div>
      </motion.div>

      {/* Vertical name rail */}
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
        <div
          aria-hidden
          className="absolute inset-[12%_18%_8%] rounded-[40%_60%_55%_45%/45%_40%_60%_55%] border border-[color-mix(in_srgb,var(--gold)_40%,transparent)]"
        />
        <img
          src={src}
          alt={`Portrait von ${name}`}
          width={640}
          height={800}
          className="relative z-10"
          data-edit-img="img.portrait"
        />
      </motion.div>

      <motion.div
        className="absolute -bottom-2 right-0 z-20 max-w-[200px] rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] px-3.5 py-3 shadow-[var(--lg-depth)]"
        style={{ backdropFilter: 'var(--frost-nav)', WebkitBackdropFilter: 'var(--frost-nav)' }}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, type: 'spring', stiffness: 160, damping: 20 }}
      >
        <p className="text-[0.88rem] font-semibold leading-snug">
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

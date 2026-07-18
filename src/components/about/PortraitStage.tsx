import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';

type Props = {
  src: string;
  name: string;
  role: string;
};

export default function PortraitStage({ src, name, role }: Props) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-portrait]',
        { y: 40, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out' },
      );
      gsap.fromTo(
        '[data-ring]',
        { rotate: -8, scale: 0.9, opacity: 0 },
        { rotate: 0, scale: 1, opacity: 1, duration: 1.2, ease: 'power2.out', delay: 0.15 },
      );
      gsap.to('[data-orbit]', {
        rotate: 360,
        duration: 28,
        repeat: -1,
        ease: 'none',
      });
    }, root);
    return () => ctx.revert();
  }, [reduce]);

  return (
    <div ref={root} className="portrait-stage relative mx-auto w-full max-w-[440px]">
      {/* Orbiting ring */}
      <div
        data-orbit
        data-ring
        aria-hidden
        className="pointer-events-none absolute inset-[-8%] rounded-full border border-dashed border-[color-mix(in_srgb,var(--ice)_35%,transparent)]"
        style={{ opacity: reduce ? 0.4 : 0 }}
      >
        <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ember)] shadow-[0_0_18px_var(--ember)]" />
        <span className="absolute bottom-[18%] right-0 h-2 w-2 translate-x-1/2 rounded-full bg-[var(--ice)] shadow-[0_0_14px_var(--ice)]" />
      </div>

      {/* Vertical name rail */}
      <p
        aria-hidden
        className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap font-[family-name:var(--font-display)] text-[0.72rem] font-bold tracking-[0.35em] uppercase text-[var(--meta)] md:block"
      >
        {name}
      </p>

      <div data-portrait className="portrait-cut relative" style={{ opacity: reduce ? 1 : 0 }}>
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
      </div>

      <motion.div
        className="absolute -bottom-2 right-0 z-20 max-w-[200px] rounded-2xl border border-[var(--stroke)] bg-[var(--panel)] px-3.5 py-3 shadow-[var(--lg-depth)]"
        style={{ backdropFilter: 'var(--frost-nav)', WebkitBackdropFilter: 'var(--frost-nav)' }}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, type: 'spring', stiffness: 160, damping: 20 }}
      >
        <p className="text-[0.88rem] font-semibold leading-snug" data-edit="site.role">
          {role}
        </p>
      </motion.div>
    </div>
  );
}

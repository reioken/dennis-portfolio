import { memo } from 'react';
import AnimatedLogo from '../work/AnimatedLogo';
import BerryLiveLogo from '../work/BerryLiveLogo';
import NexusSplashMark from '../work/NexusSplashMark';
import RiftcastLiveLogo from '../work/RiftcastLiveLogo';
import MinaLiveLogo from '../work/MinaLiveLogo';
import WebsitesStackLogo from '../work/WebsitesStackLogo';

type Props = {
  /** Token (nexus-splash, berry-laugh, …) oder URL einer SMIL-SVG */
  logoLive?: string;
  /** Statisches Logo als Fallback */
  logo?: string;
  title: string;
  active?: boolean;
  ambient?: boolean;
  reduce?: boolean;
  className?: string;
};

/** Ein Einstieg für alle lebenden Marken — Launcher-Bühne und Cast nutzen denselben Dispatcher. */
function LiveMark({ logoLive, logo, title, active = false, ambient = true, reduce = false, className = '' }: Props) {
  const hot = active && !reduce;
  const amb = ambient && !reduce;
  const cls = `live-mark ${className}`.trim();
  switch (logoLive) {
    case 'nexus-splash':
      return <NexusSplashMark ambient={amb} active={hot} title={title} className={cls} />;
    case 'berry-laugh':
      return <BerryLiveLogo active={hot} title={title} className={`${cls}${amb ? ' is-ambient' : ''}`} />;
    case 'riftcast-cast':
      return <RiftcastLiveLogo active={hot} title={title} className={`${cls}${amb ? ' is-ambient' : ''}`} />;
    case 'mina-heart':
      return <MinaLiveLogo active={hot} title={title} className={`${cls}${amb ? ' is-ambient' : ''}`} />;
    case 'websites-stack':
      return <WebsitesStackLogo active={hot} title={title} className={cls} />;
    default:
      if (logoLive && !reduce) {
        return <AnimatedLogo src={logoLive} title={title} className={`${cls} h-full w-full object-contain`} />;
      }
      if (logo) {
        return <img src={logo} alt={title} width={320} height={320} loading="lazy" decoding="async" className={`${cls} h-full w-full object-contain`} />;
      }
      return null;
  }
}

export default memo(LiveMark);

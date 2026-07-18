import type { ComponentProps } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  EnvelopeSimple,
  Flask,
  House,
  List,
  User,
  X,
} from '@phosphor-icons/react';

const map = {
  home: House,
  work: Briefcase,
  about: User,
  lab: Flask,
  contact: EnvelopeSimple,
  menu: List,
  close: X,
  external: ArrowUpRight,
} as const;

type Name = keyof typeof map;

type Props = {
  name: Name;
  size?: number;
  className?: string;
  weight?: ComponentProps<typeof House>['weight'];
};

export default function Icon({ name, size = 18, className, weight = 'regular' }: Props) {
  const Cmp = map[name];
  return <Cmp size={size} weight={weight} className={className} aria-hidden />;
}

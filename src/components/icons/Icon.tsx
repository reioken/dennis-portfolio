/** Nucleo Sharp / 24px outline. Selected from the owner's local Nucleo collection.
 * Source IDs are recorded in nucleo-sources.json. Keep the original drawing/stroke geometry.
 */
const icons = {
  'home': (<g><path d="M9 21V16C9 14.3431 10.3431 13 12 13C13.6569 13 15 14.3431 15 16V21" stroke="currentColor" strokeWidth="2" fill="none"></path><path d="M12 2L2 9.5V10.5L4 11V21H20V11L22 10.5V9.5L12 2Z" stroke="currentColor" strokeWidth="2" fill="none"></path></g>),
  'work': (<g><path d="M16 7V2H8V7" stroke="currentColor" strokeWidth="2" fill="none"></path><path d="M21 7V11.4399C15.4839 14.8477 8.51612 14.8477 3 11.4399V7H21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path><path d="M22 22H2V14.3164C2.64874 14.7005 3.31725 15.0398 4 15.3369V20H20V15.3359C20.6828 15.0386 21.3512 14.6988 22 14.3145V22Z" fill="currentColor" data-stroke="none"></path></g>),
  'about': (<g><path d="M16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2C14.2091 2 16 3.79086 16 6Z" stroke="currentColor" strokeWidth="2" fill="none"></path><path d="M21 21.0001V16.3096C15.4029 13.2001 8.59712 13.2001 3 16.3096V21.0001H21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path></g>),
  'lab': (<g><path d="M5 16L5.80474 16.503C7.80916 17.7557 10.2963 17.9599 12.4782 17.0508C14.1043 16.3732 15.9206 16.3069 17.5918 16.8639L19.5 17.5" stroke="currentColor" strokeWidth="2" fill="none"></path><path d="M8 2H10V11C6.3228 12.8386 4 16.597 4 20.7082V22H20V20.7082C20 16.597 17.6772 12.8386 14 11V2H16" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path></g>),
  'contact': (<g><path d="M2 6V8L12 13L22 8V6" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path> <path d="M2 4V20H22V4H2Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" fill="none"></path></g>),
  'menu': (<g><path d="M3 12L12 12L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path><path d="M3 5L21 5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path><path d="M3 19L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path></g>),
  'close': (<g><path d="M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M4 4L20 20" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'external': (<g><path d="M4 20L20 4L19.801 4.19902" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M13 4H20V11" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'expand': (<g><path d="M3 16L3 21L8 21" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path> <path d="M21 8L21 3L16 3" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path> <path d="M21 16L21 21L16 21" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path> <path d="M3 8L3 3L8 3" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'chevron-left': (<g><path d="M16 20.5L7.5 12L16 3.5" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'chevron-right': (<g><path d="M8 20.5L16.5 12L8 3.5" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'arrow-up-right': (<g><path d="M4 20L20 4L19.801 4.19902" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M13 4H20V11" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'arrow-left': (<g><path d="M21 12L3 12L3.5 12" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M10 19L3 12L10 5" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'arrow-up': (<g><path d="M12 21V3.00003V3.50003" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M19 10L12 3L5 10" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'grid': (<g><path d="M10 14L10 21L3 21L3 14L10 14Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M10 3L10 10L3 10L3 3L10 3Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M21 3L21 10L14 10L14 3L21 3Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M21 14L21 21L14 21L14 14L21 14Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path></g>),
  'info': (<g><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M12 16V12H10" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"></path><path d="M12 8.01V8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none"></path></g>),
} as const;

export type IconName = keyof typeof icons;
type Props = {
  name: IconName;
  size?: number;
  className?: string;
  /** Compatibility with existing callers; Nucleo's original stroke is preserved. */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
};

export default function Icon({ name, size = 18, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      {icons[name]}
    </svg>
  );
}

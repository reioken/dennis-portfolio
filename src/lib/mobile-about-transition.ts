/** Only the mobile home/About pair shares the claw's native page transition. */
export function mobileAboutTransition(from: string, to: string) {
  const home = (path: string) => /^\/(en\/?)?$/.test(path);
  const about = (path: string) => /^\/(en\/)?about\/?$/.test(path);
  return window.innerWidth < 900 && ((home(from) && about(to)) || (about(from) && home(to)));
}

// Presentation pacing is independent of camera movement and cabinet selection.
export const LOGO_HOLD_MS = 15000;
export const LOGO_FADE_MS = 1200;
export const SHOT_HOLD_MS = 7500;
export const SHOT_FADE_MS = 800;
export const CABINET_HOLD_MS = 7000;
export function tvPresentation(elapsed, count, reduced = false, parked = false) {
  if (reduced || parked || count < 1) return { kind: 'logo', index: 0, duration: 0 };
  const shots = Math.min(3, count);
  const logoPeriod = LOGO_FADE_MS + LOGO_HOLD_MS;
  const cycle = logoPeriod + LOGO_FADE_MS + SHOT_HOLD_MS + (shots - 1) * (SHOT_FADE_MS + SHOT_HOLD_MS);
  let t = Math.max(0, elapsed) % cycle;
  if (t < logoPeriod) return { kind: 'logo', index: 0, duration: LOGO_FADE_MS };
  t -= logoPeriod;
  for(let i=0;i<shots;i++){
    const duration=i===0?LOGO_FADE_MS:SHOT_FADE_MS;
    if(t<duration+SHOT_HOLD_MS)return {kind:'shot',index:i,duration};
    t-=duration+SHOT_HOLD_MS;
  }
  return {kind:'logo',index:0,duration:LOGO_FADE_MS};
}

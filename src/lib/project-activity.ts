/** Editorial work state, confirmed by Dennis on 2026-10-04.
 * Separate from delivery status: a private build can be finished, and a live
 * product can be on hold. Never derive activity from scanner data or dates.
 */
export type ProjectActivityId = 'finished' | 'active' | 'paused';

export const PROJECT_ACTIVITY_LABELS = {
  finished: { id: 'finished', de: 'Vorerst abgeschlossen', en: 'Finished for now' },
  active: { id: 'active', de: 'In Entwicklung', en: 'In development' },
  paused: { id: 'paused', de: 'Pausiert', en: 'On hold' },
} as const;

const PROJECT_ACTIVITY: Readonly<Record<string, ProjectActivityId>> = {
  riftback: 'finished',
  nexus: 'finished',
  lowlight: 'finished',
  'vgm-battle': 'finished',
  snapsize: 'finished',
  'cab-no-9': 'active',
  'echo-frequency': 'paused',
  safeplate: 'paused',
  hookline: 'paused',
  berry: 'paused',
};

export function getProjectActivity(slug: string) {
  const id = Object.prototype.hasOwnProperty.call(PROJECT_ACTIVITY, slug)
    ? PROJECT_ACTIVITY[slug]
    : undefined;
  return id ? PROJECT_ACTIVITY_LABELS[id] : undefined;
}

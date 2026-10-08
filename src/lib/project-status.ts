import type { ProjectActivityId } from './project-activity';

/** Delivery labels already used on project cards, shared by the other surfaces. */
export const PROJECT_STATUS_COPY = {
  de: { live: 'Live', wip: 'In Entwicklung', private: 'Privat', archived: 'Archiv', released: 'Veröffentlicht', case: 'Case Study' },
  en: { live: 'Live', wip: 'In development', private: 'Private', archived: 'Archive', released: 'Released', case: 'Case study' },
} as const;

export function getProjectStatus(status?: string, activity?: ProjectActivityId) {
  // The activity line already says this. Keep delivery and activity distinct without repeating it.
  if (!status || (status === 'wip' && activity === 'active')) return undefined;
  if (status === 'wip' && activity === 'paused') return { de: 'Prototyp', en: 'Prototype' };
  return {
    de: (PROJECT_STATUS_COPY.de as Record<string, string>)[status] ?? status,
    en: (PROJECT_STATUS_COPY.en as Record<string, string>)[status] ?? status,
  };
}

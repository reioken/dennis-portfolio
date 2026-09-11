/**
 * Typed access to the Werkstatt shipping log written by scripts/werkstatt-scan.mjs.
 * The JSON is committed, so builds without the sibling repos (CI) still render;
 * `machine` tells you whether the last scan ran on the owner's machine.
 */
import data from '../data/werkstatt.json';

export interface WerkstattCommit {
  /** YYYY-MM-DD */
  date: string;
  /** null for non-public projects */
  subject: string | null;
}

export interface WerkstattLogEntry {
  /** YYYY-MM-DD */
  date: string;
  subject: string;
}

export interface WerkstattProduct {
  slug: string;
  public: boolean;
  git: boolean;
  version: string | null;
  lastCommit: WerkstattCommit | null;
  /** Latest subjects, newest first; empty for non-public or non-git projects */
  recent: WerkstattLogEntry[];
  /** Newest file mtime (YYYY-MM-DD) for folders that are not git repos */
  lastTouched: string | null;
  /** Commit date or lastTouched, whichever applies; products are sorted by it desc */
  lastActivity: string | null;
  /** YYYY-MM-DD -> commits that day (last 400 days); null for non-git folders */
  commits: Record<string, number> | null;
  commitsLast90Days: number;
  /** 'cache' when the path was missing at scan time and the previous entry was kept */
  source: 'scan' | 'cache';
}

export interface WerkstattTotals {
  products: number;
  commitsLast90Days: number;
  activeProjectsLast30Days: number;
}

export interface WerkstattData {
  /** ISO timestamp of the last scan */
  generatedAt: string;
  /** true when at least half of the configured project paths existed at scan time */
  machine: boolean;
  products: WerkstattProduct[];
  /** YYYY-MM-DD -> commits across all projects that day */
  heatmap: Record<string, number>;
  totals: WerkstattTotals;
}

export interface HeatmapCell {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

/** One column of a GitHub-style grid: exactly 7 cells, Monday first. */
export type HeatmapWeek = HeatmapCell[];

export interface WerkstattLogItem extends WerkstattLogEntry {
  slug: string;
}

export const werkstatt = data as WerkstattData;

export function getProduct(slug: string): WerkstattProduct | undefined {
  return werkstatt.products.find((p) => p.slug === slug);
}

/* ---- date helpers (UTC day arithmetic, immune to DST) ---- */

const DAY_MS = 86_400_000;

function toDayIndex(iso: string): number {
  const parts = iso.slice(0, 10).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayIndex(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday (1970-01-01 was a Thursday). */
function weekday(index: number): number {
  return (((index + 3) % 7) + 7) % 7;
}

/**
 * Weeks x 7 days ending on the scan date (or `end`), Monday first, suitable
 * for a GitHub-style grid. The first week is padded back to its Monday, so a
 * few cells before the requested window are included; the last week runs to
 * Sunday, so cells after `end` appear with their (usually zero) counts.
 */
export function heatmapWeeks(days = 182, end: string | Date = werkstatt.generatedAt): HeatmapWeek[] {
  const endIso = typeof end === 'string' ? end : end.toISOString();
  const endIndex = toDayIndex(endIso);
  const startIndex = endIndex - Math.max(1, days) + 1;
  const mondayIndex = startIndex - weekday(startIndex);
  const weekCount = Math.ceil((endIndex - mondayIndex + 1) / 7);
  const weeks: HeatmapWeek[] = [];
  for (let w = 0; w < weekCount; w += 1) {
    const week: HeatmapWeek = [];
    for (let d = 0; d < 7; d += 1) {
      const date = fromDayIndex(mondayIndex + w * 7 + d);
      week.push({ date, count: werkstatt.heatmap[date] ?? 0 });
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Latest commit subjects across public projects, newest first. Ties on the
 * same day keep each project's own order, then the product order (most
 * recently active project first).
 */
export function recentLog(limit = 12): WerkstattLogItem[] {
  const items: Array<WerkstattLogItem & { rank: number }> = [];
  werkstatt.products.forEach((product, productRank) => {
    if (!product.public) return;
    product.recent.forEach((entry, i) => {
      items.push({ slug: product.slug, date: entry.date, subject: entry.subject, rank: i * 1000 + productRank });
    });
  });
  items.sort((a, b) => (a.date === b.date ? a.rank - b.rank : a.date < b.date ? 1 : -1));
  return items.slice(0, Math.max(0, limit)).map(({ slug, date, subject }) => ({ slug, date, subject }));
}

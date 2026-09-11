/**
 * Die Stationen der Spielhalle — einmal berechnet, auf jeder Seite identisch serialisiert.
 * `/`, `/work/<slug>/` und `/arcade/<id>/` tragen dieselbe persistente Hall-Insel
 * (ClientRouter + transition:persist); nur so bleibt die WebGL-Bühne beim Navigieren stehen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCollection } from 'astro:content';
import type { HallItem, HallMachine, HallProp, MachineKind } from '../components/hall/Hall';
import { p, resolveLogoLive } from './paths';
import { getProduct } from './werkstatt';
import { arcadeBuild } from './arcade-build';

const asset = (src: string) => p(src.replace(/^\//, ''));

/** Kleine Variante bevorzugen, wenn scripts/build-thumbs.mjs eine erzeugt hat */
function screenSrc(src: string) {
  const clean = src.replace(/^\//, '');
  const sm = clean.replace(/(\.\w+)$/, '@sm.webp');
  return fs.existsSync(path.join(process.cwd(), 'public', sm)) ? p(sm) : p(clean);
}

/** Transparentes Logo fürs Leuchtschild, wenn public/media/<slug>/marquee.webp existiert */
function marqueeFor(slug: string) {
  const rel = `media/${slug === 'carillon' ? 'ashwake' : slug === 'hookline' ? 'ceiling' : slug}/marquee.webp`;
  return fs.existsSync(path.join(process.cwd(), 'public', rel)) ? p(rel) : undefined;
}

/** Scanner-Version nur übernehmen, wenn sie mehr sagt als das package.json-Placeholder */
function liveVersion(slug: string) {
  const v = getProduct(slug)?.version;
  if (!v || v === '0.1.0') return null;
  return /^\d/.test(v) ? `v${v}` : v;
}

/** Welcher Automat für welches Produkt: Spiele = Cabinet, Audio = Jukebox, Phone-Apps = Kiosk, Rest = Terminal */
export function kindFor(platform: string[]): MachineKind {
  if (platform.includes('game')) return 'cabinet';
  if (platform.includes('audio')) return 'jukebox';
  if (platform.includes('mobile') && !platform.includes('desktop')) return 'kiosk';
  return 'terminal';
}

/** Reihenfolge in der Halle — Rhythmus aus Cabinets, Terminals und Kiosken */
export const ORDER = [
  'riftback',
  'nexus',
  'lowlight',
  'saute-survivors',
  'echo-frequency',
  'safeplate',
  'cab-no-9',
  'hookline',
  'berry',
  'carillon',
  'riftcast',
  'briefly',
  'mina',
];
const rank = new Map(ORDER.map((s, i) => [s, i]));

/** Requisiten pro Produkt — das Taxi aus Cab No. 9 steht als Modell vor dem Automaten */
const PROPS: Record<string, HallProp[]> = {
  'cab-no-9': [{ url: 'models/taxi.glb', size: 1.55, x: -1.05, z: 0.3, rotY: 0.62, glow: ['RoofLamp_Face'] }],
};

/** Animierte Figuren als Sprite-Sheet (Idle-Frames aus dem Spiel, scripts: sharp-Composite) */
const CHARACTER_SHEETS: Record<string, { url: string; cols: number; rows: number; frames: number; fps: number }> = {
  carillon: { url: 'media/ashwake/ash-idle.webp', cols: 4, rows: 4, frames: 16, fps: 8 },
};

/** Figuren als echte 3D-Modelle (public/models/chars) — Nori ist ein eigenes 20k-Mesh aus Sauté Survivors */
const CHARACTER_MODELS: Record<string, string> = {
  'saute-survivors': 'models/chars/nori.glb',
};

/** Die Halle startet ganz links an der Kasse (Über mich) */
export const HOME_SLUG = 'kasse';

export type HallData = {
  items: HallItem[];
  machines: HallMachine[];
  /** Index der Station, vor der die Halle beim ersten Besuch steht */
  initial: number;
  homeSlug: string;
};

let cache: Promise<HallData> | null = null;

export function buildHallItems(): Promise<HallData> {
  if (!cache) cache = build();
  return cache;
}

async function build(): Promise<HallData> {
  const works = await getCollection('work');
  const machines: HallMachine[] = works
    .filter((w) => !w.data.tags.includes('archive'))
    .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || a.data.order - b.data.order)
    .map((w) => {
      const d = w.data;
      const gallery = d.gallery.length ? d.gallery : d.surfaces?.[0]?.gallery ?? [];
      const uniq = (d.hallScreens?.length ? d.hallScreens : [d.cover, ...gallery.filter((g) => g !== d.cover)]).slice(0, 4).map(screenSrc);
      // Der Bildschirm-Loop hat vier feste Plätze — kürzere Galerien wiederholen sich
      const shots = uniq.length ? Array.from({ length: 4 }, (_, i) => uniq[i % uniq.length]) : [];
      const kind = kindFor(d.platform);
      return {
        kind,
        slug: w.id,
        href: p(`work/${w.id}`),
        arcadeHref: arcadeBuild(d.arcade?.id) ? p(`arcade/${d.arcade!.id}`) : undefined,
        arcadeId: d.arcade?.id,
        controls: d.arcade ? { de: d.arcade.controlsDe, en: d.arcade.controlsEn } : undefined,
        title: d.title,
        titleEn: d.titleEn,
        summary: d.summary,
        summaryEn: d.summaryEn,
        brand: d.brand ?? { primary: '#ac8bfd', secondary: '#4a82fe' },
        screens: shots,
        screenFormat: kind === 'kiosk' ? 'phone' : 'wide',
        logo: d.logo ? asset(d.logo) : undefined,
        marquee: marqueeFor(w.id),
        logoLive: resolveLogoLive(d.logoLive),
        version: liveVersion(w.id) ?? d.version,
        engine: d.engine,
        status: d.status,
        character: d.character ? asset(d.character) : undefined,
        characterModel: CHARACTER_MODELS[w.id] ? p(CHARACTER_MODELS[w.id]) : undefined,
        characterSheet: CHARACTER_SHEETS[w.id] ? { ...CHARACTER_SHEETS[w.id], url: p(CHARACTER_SHEETS[w.id].url) } : undefined,
        characterName: d.characterName,
        props: PROPS[w.id]?.map((pr) => ({ ...pr, url: p(pr.url) })),
      };
    });

  /* Die Kasse steht am Eingang, das Telefon hängt am Ende der Halle */
  const items: HallItem[] = [
    {
      kind: 'kasse',
      slug: 'kasse',
      href: p('about'),
      portrait: p('media/me/portrait-v12.webp'),
      // Freigegebene Figur mit Foto-Tattoos; Version verhindert veraltete GLB-Caches.
      figure: fs.existsSync(path.join(process.cwd(), 'public', 'models', 'dennis.glb')) ? p('models/dennis.glb?v=9326936a358e') : undefined,
    },
    ...machines,
    { kind: 'phone', slug: 'telefon', href: p('contact') },
  ];
  const initial = Math.max(0, items.findIndex((m) => m.slug === HOME_SLUG));
  return { items, machines, initial, homeSlug: HOME_SLUG };
}

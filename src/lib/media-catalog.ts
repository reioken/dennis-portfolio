/** Pickable site media for the hero collage editor. Paths are site-root absolute. */

export type MediaItem = {
  src: string;
  label: string;
  group: string;
};

export const COLLAGE_SLOT_KEYS = [
  'img.collage.0',
  'img.collage.1',
  'img.collage.2',
  'img.collage.3',
  'img.collage.4',
  'img.collage.5',
  'img.collage.6',
  'img.collage.7',
  'img.collage.8',
  'img.collage.9',
  'img.collage.10',
  'img.collage.11',
  'img.collage.12',
  'img.collage.13',
  'img.collage.14',
  'img.collage.15',
] as const;

export type CollageSlotKey = (typeof COLLAGE_SLOT_KEYS)[number];

/** Defaults = strong product UI shots for the hero collage */
export const COLLAGE_DEFAULTS: Record<CollageSlotKey, string> = {
  'img.collage.0': '/media/nexus/shots/screen-home-featured.webp',
  'img.collage.1': '/media/berry/shots/screen-home.webp',
  'img.collage.2': '/media/riftcast/shots/screen-quality.webp',
  'img.collage.3': '/media/nexus/shots/screen-showcase.webp',
  'img.collage.4': '/media/berry/shots/screen-collection.webp',
  'img.collage.5': '/media/riftcast/shots/screen-app.webp',
  'img.collage.6': '/media/floordirekt/shots/screen-pruefen.webp',
  'img.collage.7': '/media/nexus/shots/screen-coverflow.webp',
  'img.collage.8': '/media/berry/shots/screen-search.webp',
  'img.collage.9': '/media/riftcast/shots/screen-desktop.webp',
  'img.collage.10': '/media/nexus/shots/screen-couch-featured.webp',
  'img.collage.11': '/media/berry/shots/screen-decks-meta.webp',
  'img.collage.12': '/media/riftcast/shots/screen-desktop-controls.webp',
  'img.collage.13': '/media/floordirekt/shots/screen-start.webp',
  'img.collage.14': '/media/berry/shots/screen-insights.webp',
  'img.collage.15': '/media/nexus/shots/screen-grid.webp',
};

export const COLLAGE_MEDIA: MediaItem[] = [
  // NEXUS — product UI
  { src: '/media/nexus/shots/screen-splash.webp', label: 'Splash', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-home.webp', label: 'Home', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-home-featured.webp', label: 'Home Featured', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-grid.webp', label: 'Grid', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-showcase.webp', label: 'Showcase', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-coverflow.webp', label: 'Cover Flow', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-couch.webp', label: 'Couch', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-couch-featured.webp', label: 'Couch Featured', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-toplists.webp', label: 'Toplisten', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-wrapped.webp', label: 'Wrapped', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-cmdk.webp', label: 'Command Palette', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-blizzard.webp', label: 'Blizzard Hub', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-bulk.webp', label: 'Bulk', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-heatmap.webp', label: 'Heatmap', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-dice.webp', label: 'Dice', group: 'NEXUS' },
  { src: '/media/nexus/shots/screen-onboard.webp', label: 'Onboarding', group: 'NEXUS' },

  // Berry — phone UI
  { src: '/media/berry/shots/screen-home.webp', label: 'Home', group: 'Berry' },
  { src: '/media/berry/shots/screen-search.webp', label: 'Search', group: 'Berry' },
  { src: '/media/berry/shots/screen-collection.webp', label: 'Collection', group: 'Berry' },
  { src: '/media/berry/shots/screen-decks-meta.webp', label: 'Decks Meta', group: 'Berry' },
  { src: '/media/berry/shots/screen-deck-editor.webp', label: 'Deck Editor', group: 'Berry' },
  { src: '/media/berry/shots/screen-insights.webp', label: 'Insights', group: 'Berry' },
  { src: '/media/berry/shots/screen-tournaments.webp', label: 'Tournaments', group: 'Berry' },

  // Riftcast — product surfaces
  { src: '/media/riftcast/shots/screen-desktop.webp', label: 'Desktop', group: 'Riftcast' },
  { src: '/media/riftcast/shots/screen-desktop-controls.webp', label: 'Desktop Controls', group: 'Riftcast' },
  { src: '/media/riftcast/shots/screen-launcher.webp', label: 'Launcher', group: 'Riftcast' },
  { src: '/media/riftcast/shots/screen-launcher-remote.webp', label: 'Launcher Remote', group: 'Riftcast' },
  { src: '/media/riftcast/shots/screen-app.webp', label: 'Phone Controls', group: 'Riftcast' },
  { src: '/media/riftcast/shots/screen-quality.webp', label: 'Quality', group: 'Riftcast' },
  { src: '/media/riftcast/shots/screen-pad.webp', label: 'Pad Shooter', group: 'Riftcast' },

  // Floordirekt
  { src: '/media/floordirekt/shots/screen-pruefen.webp', label: 'Prüfen', group: 'Floordirekt' },
  { src: '/media/floordirekt/shots/screen-start.webp', label: 'Start', group: 'Floordirekt' },
  { src: '/media/floordirekt/shots/screen-bilder.webp', label: 'Bilder', group: 'Floordirekt' },
  { src: '/media/floordirekt/shots/screen-layout-export.webp', label: 'Layout & Export', group: 'Floordirekt' },
  { src: '/media/floordirekt/shots/screen-sprachen.webp', label: 'Sprachen', group: 'Floordirekt' },
  { src: '/media/floordirekt/shots/screen-fertig.webp', label: 'Fertig', group: 'Floordirekt' },

  // Forever
  { src: '/media/forever/flyer-web.jpg', label: 'Flyer', group: 'Forever' },
  { src: '/media/forever/flyer-2-web.jpg', label: 'Flyer 2', group: 'Forever' },
  { src: '/media/forever/banner-1-web.jpg', label: 'Banner 1', group: 'Forever' },
  { src: '/media/forever/banner-2-web.jpg', label: 'Banner 2', group: 'Forever' },
  { src: '/media/forever/product-1-web.jpg', label: 'Produkt 1', group: 'Forever' },
  { src: '/media/forever/product-2-web.jpg', label: 'Produkt 2', group: 'Forever' },
  { src: '/media/forever/product-fsnc-1.webp', label: 'FSNC', group: 'Forever' },

  // SportMüller (folded into Website Designs)
  { src: '/media/sportmueller/ad-helme-cover.webp', label: 'SportMüller Helme', group: 'Websites' },
  { src: '/media/sportmueller/ad-ski-cover.webp', label: 'SportMüller Ski', group: 'Websites' },
  { src: '/media/sportmueller/category-1.webp', label: 'SportMüller Shop', group: 'Websites' },
  { src: '/media/sportmueller/product-1.webp', label: 'SportMüller Produkt', group: 'Websites' },

  // Mina
  { src: '/media/mina/cover.webp', label: 'Cover', group: 'Mina' },
  { src: '/media/mina/slide-1.webp', label: 'Slide 1', group: 'Mina' },
  { src: '/media/mina/slide-2.webp', label: 'Slide 2', group: 'Mina' },
  { src: '/media/mina/slide-3.webp', label: 'Slide 3', group: 'Mina' },
  { src: '/media/mina/slide-4.webp', label: 'Slide 4', group: 'Mina' },

  // Craft
  { src: '/media/craft/skate-logo.webp', label: 'Skate Logo', group: 'Craft' },
  { src: '/media/craft/barber-mockup.webp', label: 'Barber', group: 'Craft' },
  { src: '/media/craft/shop-mockup.webp', label: 'Shop', group: 'Craft' },
  { src: '/media/craft/landing-concept.webp', label: 'Landing', group: 'Craft' },
  { src: '/media/craft/sleeve.webp', label: 'Sleeve', group: 'Craft' },
  { src: '/media/craft/parfum-3d.webp', label: 'Parfum 3D', group: 'Craft' },

  // Websites
  { src: '/media/websites/gecam-cover.webp', label: 'GECAM', group: 'Websites' },
  { src: '/media/websites/leonardo-cover.webp', label: 'Leonardo', group: 'Websites' },
  { src: '/media/websites/aak-cover.webp', label: 'AAK', group: 'Websites' },
  { src: '/media/websites/bouche-cover.webp', label: 'Bouche', group: 'Websites' },
  { src: '/media/websites/baufinanz-cover.webp', label: 'Baufinanz', group: 'Websites' },
  { src: '/media/websites/willi-alt-cover.webp', label: 'Willi Alt', group: 'Websites' },
  { src: '/media/websites/ig-seidel-cover.webp', label: 'IG Seidel', group: 'Websites' },
];

export const COLLAGE_GROUPS = ['Alle', ...Array.from(new Set(COLLAGE_MEDIA.map((m) => m.group)))] as const;

export function collageSlotLabel(index: number) {
  return `Slot ${index + 1}`;
}

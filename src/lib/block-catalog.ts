export type BlockSource = 'native' | 'custom';

export type BlockDef = {
  type: string;
  label: string;
  description: string;
  source: BlockSource;
  /** pages where this block is suggested */
  pages: string[];
  /** default props for custom blocks */
  defaults?: Record<string, string>;
};

export type BlockInstance = {
  id: string;
  type: string;
  source: BlockSource;
  label: string;
  hidden?: boolean;
  props?: Record<string, string>;
};

/** Suggested / addable blocks */
export const BLOCK_CATALOG: BlockDef[] = [
  // Native home
  { type: 'hero', label: 'Hero', description: 'Name, Job, CTAs + Collage', source: 'native', pages: ['home'] },
  { type: 'marquee', label: 'Marquee', description: 'Laufende Skill-Zeile', source: 'native', pages: ['home'] },
  { type: 'featured', label: 'Selected Work', description: 'Featured Projekte', source: 'native', pages: ['home'] },
  { type: 'archive', label: 'Archive', description: 'Archiv-Projekte', source: 'native', pages: ['home'] },
  { type: 'cta', label: 'Next / CTA', description: 'Abschluss-Call-to-Action', source: 'native', pages: ['home'] },

  // Native about
  { type: 'about-intro', label: 'About Intro', description: 'Portrait + Bio', source: 'native', pages: ['about'] },
  { type: 'skills', label: 'Skills', description: 'Fähigkeiten-Grid', source: 'native', pages: ['about'] },
  { type: 'timeline', label: 'Timeline', description: 'Berufserfahrung', source: 'native', pages: ['about'] },
  { type: 'education', label: 'Ausbildung', description: 'Education-Karten', source: 'native', pages: ['about'] },
  { type: 'cv', label: 'CV Download', description: 'Lebenslauf-Block', source: 'native', pages: ['about'] },

  // Native contact
  { type: 'contact', label: 'Contact', description: 'Kontakt-Bereich', source: 'native', pages: ['contact'] },

  // Custom — fit the portfolio
  {
    type: 'quote',
    label: 'Zitat / Statement',
    description: 'Kurzes Statement mit Gradient',
    source: 'custom',
    pages: ['home', 'about', 'contact', 'work', 'lab'],
    defaults: {
      'quote.de': 'Design, das man fühlt — und das shipped.',
      'quote.en': 'Design you feel — and that ships.',
      'quote.cite.de': 'Arbeitsprinzip',
      'quote.cite.en': 'Working principle',
    },
  },
  {
    type: 'text',
    label: 'Textblock',
    description: 'Label + Titel + Fließtext',
    source: 'custom',
    pages: ['home', 'about', 'contact', 'work', 'lab'],
    defaults: {
      'label.de': 'Notiz',
      'label.en': 'Note',
      'title.de': 'Neuer Abschnitt',
      'title.en': 'New section',
      'body.de': 'Hier kannst du eigenen Inhalt ergänzen.',
      'body.en': 'Add your own content here.',
    },
  },
  {
    type: 'image-banner',
    label: 'Bild-Banner',
    description: 'Vollbreites Bild mit Caption',
    source: 'custom',
    pages: ['home', 'about', 'work', 'lab'],
    defaults: {
      image: '',
      'caption.de': 'Bildunterschrift',
      'caption.en': 'Caption',
    },
  },
  {
    type: 'stats',
    label: 'Stats-Zeile',
    description: '3 Kennzahlen',
    source: 'custom',
    pages: ['home', 'about'],
    defaults: {
      'a.value': '6+',
      'a.label.de': 'Jahre Experience',
      'a.label.en': 'Years experience',
      'b.value': '2',
      'b.label.de': 'Own Products',
      'b.label.en': 'Own products',
      'c.value': 'UI/UX',
      'c.label.de': 'Fokus',
      'c.label.en': 'Focus',
    },
  },
  {
    type: 'dual-cta',
    label: 'Dual CTA',
    description: 'Zwei Buttons nebeneinander',
    source: 'custom',
    pages: ['home', 'about', 'contact'],
    defaults: {
      'title.de': 'Als Nächstes?',
      'title.en': 'What’s next?',
      'a.label.de': 'Work ansehen',
      'a.label.en': 'View work',
      'a.href': '/work',
      'b.label.de': 'Kontakt',
      'b.label.en': 'Contact',
      'b.href': '/contact',
    },
  },
  {
    type: 'divider',
    label: 'Trenner',
    description: 'Visuelle Linie',
    source: 'custom',
    pages: ['home', 'about', 'contact', 'work', 'lab'],
    defaults: {},
  },
];

export function pageKeyFromPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean.endsWith('/index.html')) return 'home';
  if (clean.includes('/about')) return 'about';
  if (clean.includes('/contact')) return 'contact';
  if (clean.includes('/lab')) return 'lab';
  if (clean.includes('/work')) return 'work';
  return 'other';
}

export function uid(prefix = 'b') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

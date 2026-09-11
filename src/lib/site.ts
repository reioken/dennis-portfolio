export const site = {
  name: 'Dennis Bierreth-Fernandez',
  shortName: 'Dennis',
  monogram: 'DBF',
  tagline: 'Art Director · UX/UI · Independent Product Builder',
  role: 'Art Director · UX/UI · Independent Product Builder',
  email: 'dennis@dennisbf.design',
  location: 'Raum Mannheim/Heidelberg',
  address: 'Deutschland',
  /** Status — fest angestellt, Freelance offen (ohne Negativ-Framing) */
  availability: {
    de: {
      role: 'Art Director',
      employer: 'Floordirekt',
      open: 'Offen für Freelance',
    },
    en: {
      role: 'Art Director',
      employer: 'Floordirekt',
      open: 'Open for freelance',
    },
  },
  /** Only for Impressum / Datenschutz (§ 5 TMG) — not shown on marketing pages */
  legalAddress: 'In den Gänsgräben 31, 68542 Heddesheim',
  profile: {
    de: 'Art Director, UX/UI Designer und Independent Product Builder mit 6+ Jahren Agentur- und Inhouse-Erfahrung.',
    en: 'Art director, UX/UI designer and independent product builder with 6+ years of agency and in-house experience.',
  },
  description:
    'Art Director · UX/UI · Independent Product Builder — eigene Apps, Spiele und Tools: NEXUS, Berry, Riftcast, Riftback, Safeplate, Carillon, Echo Frequency.',
  url: 'https://www.dennisbf.design/',
  links: {
    github: 'https://github.com/reioken',
    linkedin: 'https://www.linkedin.com/in/dennis-b-b08834272/',
  },
} as const;

export const navItems = [
  { href: '/', labelKey: 'home' as const },
  { href: '/work', labelKey: 'work' as const },
  { href: '/about', labelKey: 'about' as const },
  { href: '/lab', labelKey: 'lab' as const },
  { href: '/arcade', labelKey: 'arcade' as const },
  { href: '/contact', labelKey: 'contact' as const },
] as const;

export const skills = [
  {
    group: { de: 'Design & KI', en: 'Design & AI' },
    items: {
      de: [
        'Photoshop & Illustrator',
        'InDesign',
        'Premiere & After Effects',
        'Figma',
        'KI-Agenten & multimodale Workflows',
        'Generative Bild-Pipelines & Serienproduktion',
      ],
      en: [
        'Photoshop & Illustrator',
        'InDesign',
        'Premiere & After Effects',
        'Figma',
        'AI agents & multimodal workflows',
        'Generative image pipelines & series production',
      ],
    },
  },
  {
    group: { de: 'Web & Product', en: 'Web & Product' },
    items: {
      de: ['HTML / CSS', 'WordPress / CMS', 'Desktop Apps', 'Mobile Apps', 'Electron & Capacitor', 'Product Systems'],
      en: ['HTML / CSS', 'WordPress / CMS', 'Desktop apps', 'Mobile apps', 'Electron & Capacitor', 'Product systems'],
    },
  },
  {
    group: { de: 'Kompetenzen', en: 'Competencies' },
    items: {
      de: [
        'Art Direction',
        'UI/UX Design & Strategy',
        'Wireframing & Prototyping',
        'Corporate Branding',
        'Video Editing & Motion',
        'Design Thinking',
        'Print Production',
        'Moderne Websites',
        'Motion & Micro-Animations',
        'Landing Experiences',
        'KI-Workflows im Alltag — von Prompt bis Pipeline',
      ],
      en: [
        'Art direction',
        'UI/UX design & strategy',
        'Wireframing & prototyping',
        'Corporate branding',
        'Video editing & motion',
        'Design thinking',
        'Print production',
        'Modern websites',
        'Motion & micro-animations',
        'Landing experiences',
        'Everyday AI workflows — prompt to pipeline',
      ],
    },
  },
] as const;

export const languages = [
  { name: { de: 'Deutsch', en: 'German' }, level: { de: 'Muttersprache', en: 'Native' } },
  { name: { de: 'Englisch', en: 'English' }, level: { de: 'Verhandlungssicher', en: 'Business fluent' } },
] as const;

export const timeline = [
  {
    year: '2025 – heute',
    yearEn: '2025 – present',
    title: {
      de: 'Art Director — Floordirekt',
      en: 'Art Director — Floordirekt',
    },
    body: {
      de: 'Visuelle Richtung für Marke und Shop: Design-Systeme, Kampagnen, Bildsprache und UX/UI quer über Touchpoints.',
      en: 'Visual direction for brand and shop: design systems, campaigns, imagery language, and UX/UI across touchpoints.',
    },
  },
  {
    year: '2025 – heute',
    yearEn: '2025 – present',
    title: {
      de: 'Independent Product Builds — Apps, Spiele, Tools',
      en: 'Independent Product Builds — apps, games, tools',
    },
    body: {
      de: 'Neben der Festanstellung: NEXUS, Berry, Riftcast, Riftback, Safeplate, Lowlight und vier Spiele in Godot und Unity — von Konzept und Design-System bis zum laufenden Build.',
      en: 'Alongside my full-time role: NEXUS, Berry, Riftcast, Riftback, Safeplate, Lowlight and four games in Godot and Unity — from concept and design system to running build.',
    },
  },
  {
    year: '06/2024 – heute',
    yearEn: '06/2024 – present',
    title: {
      de: 'UX/UI-Weiterbildung & ausgewählte Freelance-Projekte',
      en: 'UX/UI training & selected freelance projects',
    },
    body: {
      de: 'UX/UI Bootcamp mit Case Studies (Research, Wireframing, Usability-Tests, Figma), ergänzt durch ausgewählte Branding- und Web-Projekte.',
      en: 'UX/UI bootcamp with case studies (research, wireframing, usability tests, Figma), complemented by selected branding and web projects.',
    },
  },
  {
    year: '09/2022 – 06/2024',
    yearEn: '09/2022 – 06/2024',
    title: {
      de: 'Grafiker & Content Creator — Forever GmbH',
      en: 'Designer & Content Creator — Forever GmbH',
    },
    body: {
      de: 'Visuelle Markenkommunikation (Print & Digital), Video-Content (Premiere/After Effects), Produktfotografie und High-End-Retusche für E-Commerce.',
      en: 'Visual brand communication (print & digital), video content (Premiere/After Effects), product photography and high-end retouching for e-commerce.',
    },
  },
  {
    year: '09/2020 – 03/2022',
    yearEn: '09/2020 – 03/2022',
    title: {
      de: 'Web- & Grafikdesigner — performio GmbH, Mannheim',
      en: 'Web & Graphic Designer — performio GmbH, Mannheim',
    },
    body: {
      de: 'Responsive Websites (WordPress & Elementor), Corporate Designs, Logos und digitale Werbemittel für KMU.',
      en: 'Responsive websites (WordPress & Elementor), corporate designs, logos, and digital ads for SMEs.',
    },
  },
  {
    year: '04/2019 – 04/2020',
    yearEn: '04/2019 – 04/2020',
    title: {
      de: 'Designer & Reinzeichner — cyberWear Heidelberg GmbH',
      en: 'Designer & Clean Artist — cyberWear Heidelberg GmbH',
    },
    body: {
      de: 'Merchandise-Design für Key Accounts (u. a. Porsche, Audi, Deutsche Bahn). Präzise Druckdaten und Reinzeichnungen.',
      en: 'Merchandise design for key accounts (incl. Porsche, Audi, Deutsche Bahn). Precise print data and clean artwork.',
    },
  },
  {
    year: '01/2018 – 01/2019',
    yearEn: '01/2018 – 01/2019',
    title: {
      de: 'Mitarbeiter E-Commerce — Decathlon, Mannheim',
      en: 'E-Commerce Associate — Decathlon, Mannheim',
    },
    body: {
      de: 'Unterstützung im Online-Handel und Kundenberatung.',
      en: 'Support in online retail and customer advisory.',
    },
  },
  {
    year: '2012 – 2014',
    yearEn: '2012 – 2014',
    title: {
      de: 'FSJ — Johanniter-Unfall-Hilfe, Hausnotrufzentrale',
      en: 'Voluntary Social Year (FSJ) — Johanniter, home emergency call center',
    },
    body: {
      de: 'Freiwilliges Soziales Jahr in einer Hausnotrufzentrale: Notrufe entgegennehmen, Einsatzkoordination und direkte Unterstützung für hilfebedürftige Menschen.',
      en: 'Voluntary social year in a home emergency call center: handling emergency calls, coordinating responses, and supporting people in need.',
    },
  },
] as const;

export const education = [
  {
    year: '06/2025 – 09/2025',
    title: {
      de: 'Zertifikat: UX/UI Design',
      en: 'Certificate: UX/UI Design',
    },
    body: {
      de: 'Intensiv-Bootcamp bei neuefische GmbH (Remote). Schwerpunkte: Design Thinking, User Research, Information Architecture, Figma Deep-Dive, Design Systems.',
      en: 'Intensive bootcamp at neuefische GmbH (remote). Focus: design thinking, user research, information architecture, Figma deep-dive, design systems.',
    },
    url: 'https://eu.credential.net/16488cdc-8902-407d-970d-e03d96b7c412',
    urlLabel: {
      de: 'Zertifikat ansehen',
      en: 'View certificate',
    },
  },
  {
    year: '09/2015 – 09/2017',
    title: {
      de: 'Staatl. anerkannter Mediendesigner',
      en: 'State-certified Media Designer',
    },
    body: {
      de: 'SRH Fachschule, Heidelberg.',
      en: 'SRH Fachschule, Heidelberg.',
    },
  },
  {
    year: '10/2014 – 09/2015',
    title: {
      de: 'Studium Game Engineering (ohne Abschl.)',
      en: 'Game Engineering studies (no degree)',
    },
    body: {
      de: 'SRH Hochschule, Heidelberg. Gewonnen: Game-Design-Contest für Valedo — smartphonegekoppelte Rehab-Apps, die Menschen spielerisch das Gehen wieder beibringen.',
      en: 'SRH Hochschule, Heidelberg. Won a game design contest for Valedo — phone-linked rehab apps that help people relearn walking through play.',
    },
  },
  {
    year: '2012',
    title: { de: 'Fachabitur', en: 'Fachabitur' },
    body: {
      de: 'Carl-Benz-Gymnasium.',
      en: 'Carl-Benz-Gymnasium.',
    },
  },
] as const;


export const site = {
  name: 'Dennis Bierreth-Fernandez',
  shortName: 'Dennis',
  monogram: 'DBF',
  tagline: 'Hobby-Softwareentwickler · UX/UI Designer · Art Director',
  role: 'Hobby-Softwareentwickler · Art Director & UI/UX Designer',
  email: 'dennis@dennisbf.design',
  location: 'Raum Mannheim/Heidelberg',
  address: 'Deutschland',
  /** Aktueller Status — verhindert unpassende Recruiter-Anfragen, schärft Freelance */
  availability: {
    de: 'Aktuell Art Director bei Floordirekt · offen für Freelance-Projekte',
    en: 'Currently Art Director at Floordirekt · open for freelance projects',
  },
  /** Only for Impressum / Datenschutz (§ 5 TMG) — not shown on marketing pages */
  legalAddress: '68542 Heddesheim',
  profile: {
    de: 'Hobby-Softwareentwickler mit 6+ Jahren Agentur und Inhouse. Art Direction, UX/UI, Branding, Video und eigene Product-Builds.',
    en: 'Hobby software developer with 6+ years agency and in-house. Art direction, UX/UI, branding, video and self-built products.',
  },
  description:
    'Hobby-Softwareentwickler · Art Director & UI/UX Designer — Floordirekt, NEXUS, Berry, Riftcast.',
  url: 'https://www.dennisbf.design/',
  links: {
    github: 'https://github.com/reioken',
    linkedin: 'https://www.linkedin.com/in/dennis-b-b08834272/',
  },
  cvPdf: 'cv/Dennis-Bierreth-Fernandez-Lebenslauf-2026.pdf',
  cvMd: 'cv/Dennis-Bierreth-Fernandez-CV-2026.md',
} as const;

export const navItems = [
  { href: '/', labelKey: 'home' as const },
  { href: '/work', labelKey: 'work' as const },
  { href: '/about', labelKey: 'about' as const },
  { href: '/lab', labelKey: 'lab' as const },
  { href: '/contact', labelKey: 'contact' as const },
] as const;

export const skills = [
  {
    group: { de: 'Design Tools', en: 'Design Tools' },
    items: {
      de: [
        'Photoshop & Illustrator',
        'InDesign',
        'Premiere & After Effects',
        'Figma',
        'ComfyUI & Gen-AI-Pipelines',
        'Cursor & Claude Code',
      ],
      en: [
        'Photoshop & Illustrator',
        'InDesign',
        'Premiere & After Effects',
        'Figma',
        'ComfyUI & gen-AI pipelines',
        'Cursor & Claude Code',
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
      de: 'Art Direction & Studio Tools — Floordirekt',
      en: 'Art Direction & Studio Tools — Floordirekt',
    },
    body: {
      de: 'Floordirekt Studio / Produktbild Studio: Imagery-System und Studio-Workflow für Shop-Produktbilder — Varianten, mehrsprachige Overlays, Batch-Export, visuelle Standards.',
      en: 'Floordirekt Studio / Product Image Studio: imagery system and studio workflow for shop product shots — variants, multilingual overlays, batch export, visual standards.',
    },
  },
  {
    year: '2025 – heute',
    yearEn: '2025 – present',
    title: {
      de: 'Product Design — NEXUS, Berry & Riftcast',
      en: 'Product Design — NEXUS, Berry & Riftcast',
    },
    body: {
      de: 'NEXUS: Premium Desktop Game Library (UI, Landing, Installer). Berry: Mobile Collector App (Product Design, App-UI, Design-System). Riftcast: Remote Desktop. Von Konzept bis funktionierender App.',
      en: 'NEXUS: premium desktop game library (UI, landing, installer). Berry: mobile collector app (product design, app UI, design system). Riftcast: remote desktop. Concept to working app.',
    },
  },
  {
    year: '06/2024 – heute',
    yearEn: '06/2024 – present',
    title: {
      de: 'UX/UI & Freelance Design — neuefische / Freelance',
      en: 'UX/UI & Freelance Design — neuefische / Freelance',
    },
    body: {
      de: 'UX/UI Bootcamp mit Case Studies (Research, Wireframing, Usability-Tests, Figma). Freiberufliche Branding- und Web-Projekte. Moderne Websites mit Motion.',
      en: 'UX/UI bootcamp with case studies (research, wireframing, usability tests, Figma). Freelance branding and web projects. Modern websites with motion.',
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

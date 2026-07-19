/** All editable fields shown in the personal editor */
export type FieldKind = 'text' | 'textarea' | 'image';

export type ContentField = {
  key: string;
  label: string;
  kind: FieldKind;
  group: string;
};

export const CONTENT_FIELDS: ContentField[] = [
  // Meta / Brand
  { key: 'site.name', label: 'Name', kind: 'text', group: 'Brand' },
  { key: 'site.shortName', label: 'Kurzname (Nav)', kind: 'text', group: 'Brand' },
  { key: 'site.role', label: 'Job-Titel', kind: 'text', group: 'Brand' },
  { key: 'site.email', label: 'E-Mail', kind: 'text', group: 'Brand' },
  { key: 'site.location', label: 'Ort', kind: 'text', group: 'Brand' },
  { key: 'site.description', label: 'Meta Description', kind: 'textarea', group: 'Brand' },

  // Home DE
  { key: 'home.headline.de', label: 'Hero Job (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.support.de', label: 'Hero Support (DE)', kind: 'textarea', group: 'Home DE' },
  { key: 'home.ctaWork.de', label: 'CTA Work (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.ctaContact.de', label: 'CTA Contact (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.featuredLabel.de', label: 'Featured Label (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.featuredTitle.de', label: 'Featured Title (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.featuredBody.de', label: 'Featured Body (DE)', kind: 'textarea', group: 'Home DE' },
  { key: 'home.archiveLabel.de', label: 'Archive Label (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.archiveTitle.de', label: 'Archive Title (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.archiveBody.de', label: 'Archive Body (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.nextLabel.de', label: 'Next Label (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.nextTitle.de', label: 'Next Title (DE)', kind: 'text', group: 'Home DE' },
  { key: 'home.nextBody.de', label: 'Next Body (DE)', kind: 'textarea', group: 'Home DE' },
  { key: 'home.nextCta.de', label: 'Next CTA (DE)', kind: 'text', group: 'Home DE' },

  // Home EN
  { key: 'home.headline.en', label: 'Hero Job (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.support.en', label: 'Hero Support (EN)', kind: 'textarea', group: 'Home EN' },
  { key: 'home.ctaWork.en', label: 'CTA Work (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.ctaContact.en', label: 'CTA Contact (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.featuredLabel.en', label: 'Featured Label (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.featuredTitle.en', label: 'Featured Title (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.featuredBody.en', label: 'Featured Body (EN)', kind: 'textarea', group: 'Home EN' },
  { key: 'home.archiveLabel.en', label: 'Archive Label (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.archiveTitle.en', label: 'Archive Title (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.archiveBody.en', label: 'Archive Body (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.nextLabel.en', label: 'Next Label (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.nextTitle.en', label: 'Next Title (EN)', kind: 'text', group: 'Home EN' },
  { key: 'home.nextBody.en', label: 'Next Body (EN)', kind: 'textarea', group: 'Home EN' },
  { key: 'home.nextCta.en', label: 'Next CTA (EN)', kind: 'text', group: 'Home EN' },

  // About
  { key: 'about.role.de', label: 'About Role (DE)', kind: 'text', group: 'About DE' },
  { key: 'about.lead.de', label: 'About Lead (DE)', kind: 'textarea', group: 'About DE' },
  { key: 'about.body.de', label: 'About Body (DE)', kind: 'textarea', group: 'About DE' },
  { key: 'about.skillsIntro.de', label: 'Skills Intro (DE)', kind: 'textarea', group: 'About DE' },
  { key: 'about.role.en', label: 'About Role (EN)', kind: 'text', group: 'About EN' },
  { key: 'about.lead.en', label: 'About Lead (EN)', kind: 'textarea', group: 'About EN' },
  { key: 'about.body.en', label: 'About Body (EN)', kind: 'textarea', group: 'About EN' },
  { key: 'about.skillsIntro.en', label: 'Skills Intro (EN)', kind: 'textarea', group: 'About EN' },

  // Contact
  { key: 'contact.title.de', label: 'Contact Title (DE)', kind: 'text', group: 'Contact' },
  { key: 'contact.body.de', label: 'Contact Body (DE)', kind: 'textarea', group: 'Contact' },
  { key: 'contact.title.en', label: 'Contact Title (EN)', kind: 'text', group: 'Contact' },
  { key: 'contact.body.en', label: 'Contact Body (EN)', kind: 'textarea', group: 'Contact' },

  // Footer
  { key: 'footer.tagline.de', label: 'Footer Tagline (DE)', kind: 'text', group: 'Footer' },
  { key: 'footer.tagline.en', label: 'Footer Tagline (EN)', kind: 'text', group: 'Footer' },

  // Gate
  { key: 'gate.title', label: 'Under Construction Titel', kind: 'text', group: 'Gate' },
  { key: 'gate.subtitle', label: 'Under Construction Text', kind: 'textarea', group: 'Gate' },
  { key: 'gate.hint', label: 'Passwort-Hinweis', kind: 'text', group: 'Gate' },

  // Images
  { key: 'img.portrait', label: 'About Portrait', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.0', label: 'Hero Collage 1', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.1', label: 'Hero Collage 2', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.2', label: 'Hero Collage 3', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.3', label: 'Hero Collage 4', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.4', label: 'Hero Collage 5', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.5', label: 'Hero Collage 6', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.6', label: 'Hero Collage 7', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.7', label: 'Hero Collage 8', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.8', label: 'Hero Collage 9', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.9', label: 'Hero Collage 10', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.10', label: 'Hero Collage 11', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.11', label: 'Hero Collage 12', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.12', label: 'Hero Collage 13', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.13', label: 'Hero Collage 14', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.14', label: 'Hero Collage 15', kind: 'image', group: 'Bilder' },
  { key: 'img.collage.15', label: 'Hero Collage 16', kind: 'image', group: 'Bilder' },
  { key: 'img.favicon', label: 'Favicon URL', kind: 'image', group: 'Bilder' },
];

/**
 * Site texts for pages: the 404 page and the browser-tab title a detail page
 * falls back to when its entry does not exist.
 */

import type { SiteTexts } from "./locale";

export interface PageTexts {
  /** app/(site)/not-found.tsx */
  notFound: {
    title: string;
    body:  string;
    cta:   string;
  };
  /** Metadata title when the entry behind a detail route is missing. */
  missing: {
    page:       string;
    post:       string;
    article:    string;
    caseStudy:  string;
    teamMember: string;
    vacancy:    string;
    job:        string;
    event:      string;
    company:    string;
  };
}

export const PAGE_TEXTS: SiteTexts<PageTexts> = {
  en: {
    notFound: {
      title: "Page not found",
      body:  "The page you're looking for doesn't exist or has been moved. Head back to the homepage and we'll get you back on track.",
      cta:   "Back to homepage",
    },
    missing: {
      page:       "Page not found",
      post:       "Post not found",
      article:    "Article not found",
      caseStudy:  "Case study not found",
      teamMember: "Team member not found",
      vacancy:    "Vacancy not found",
      job:        "Job not found",
      event:      "Event not found",
      company:    "Company not found",
    },
  },

  nl: {
    notFound: {
      title: "Deze pagina bestaat niet",
      body:  "De pagina die je zoekt bestaat niet of is verplaatst. Ga terug naar de homepage en zoek van daaruit verder.",
      cta:   "Naar de homepage",
    },
    missing: {
      page:       "Deze pagina bestaat niet",
      post:       "Artikel niet gevonden",
      article:    "Artikel niet gevonden",
      caseStudy:  "Case niet gevonden",
      teamMember: "Teamlid niet gevonden",
      vacancy:    "Vacature niet gevonden",
      job:        "Vacature niet gevonden",
      event:      "Evenement niet gevonden",
      company:    "Bedrijf niet gevonden",
    },
  },
};

/**
 * Site texts for the content blocks: listings, article and vacancy headers,
 * sliders, the map, product detail, pricing, logo strip, notification, media
 * and the hero.
 *
 * `en` is what these blocks always said. `nl` is the same in Dutch. A text with
 * a variable part is a small function, so the word order can differ per
 * language.
 *
 * A few of these were hard-coded in Dutch (slider arrows, "Video afspelen",
 * "Sluit melding"). Those keep their Dutch text under `nl` and get an English
 * one under `en`.
 *
 * What is NOT in here: anything an editor types in the CMS. Headings, CTA
 * labels, alt texts and captions from the CMS always win. These are only the
 * fixed words and the fallbacks.
 */

import type { SiteTexts } from "./locale";

export type BlockTexts = {
  /** Locale for Intl date formatting in the blocks. */
  dateLocale: string;

  // ── Listing and related content ────────────────────────────────────────────
  viewAll:        string;
  relatedContent: string;
  /** Shown in place of a slider that has no slides yet. */
  sliderEmpty:    string;

  // ── Media slider ───────────────────────────────────────────────────────────
  mediaSlider:   string;
  slides:        string;
  previousSlide: string;
  nextSlide:     string;
  goToSlide:     (n: number) => string;

  // ── Article header ─────────────────────────────────────────────────────────
  updatedOn:    (date: string) => string;
  readingTime:  (min: number) => string;
  articleCover: string;

  // ── Vacancy header ─────────────────────────────────────────────────────────
  remoteLabels:    Record<"on-site" | "hybrid" | "remote", string>;
  contractLabels:  Record<"full-time" | "part-time" | "contract" | "internship" | "freelance", string>;
  closed:          string;
  closesToday:     string;
  closesInDays:    (days: number) => string;
  closesOn:        (date: string) => string;
  location:        string;
  workStyle:       string;
  contract:        string;
  hours:           string;
  level:           string;
  salary:          string;
  startDate:       string;
  deadline:        string;
  noDetails:       string;

  // ── Timeline slider ────────────────────────────────────────────────────────
  noMedia:      string;
  video:        string;
  previousItem: string;
  nextItem:     string;
  goTo:         (label: string) => string;

  // ── Map ────────────────────────────────────────────────────────────────────
  mapTitle: string;
  address:  string;
  email:    string;
  phone:    string;

  // ── Product detail ─────────────────────────────────────────────────────────
  productImagePlaceholder: (title: string) => string;
  productImageN:           (title: string, n: number) => string;
  specifications:          string;
  relatedProducts:         string;

  // ── Pricing table ──────────────────────────────────────────────────────────
  features:    string;
  notIncluded: string;

  // ── Logo strip ─────────────────────────────────────────────────────────────
  partnerLogos: string;

  // ── Notification ───────────────────────────────────────────────────────────
  closeNotification: string;

  // ── Media (video facade) ───────────────────────────────────────────────────
  playVideo: string;

  // ── Hero ───────────────────────────────────────────────────────────────────
  heroBanner:     string;
  pageHeader:     string;
  hero:           string;
  /** aria-roledescription of the rotating hero. */
  carousel:       string;
  slideN:         (n: number) => string;
  previous:       string;
  next:           string;
  youtubePlayer:  string;
  vimeoPlayer:    string;

  // ── Built-in copy of the intro and solution blocks (used when no props) ────
  introDefaults: {
    label:    string;
    headline: string;
    body:     string;
    /** One text per point, in the order of the icons in IntroBlock. */
    points:   readonly [string, string, string];
  };
  solutionDefaults: {
    label:       string;
    headline:    string;
    subheadline: string;
    /** One entry per step, in the order of the icons in SolutionBlock. */
    features:    readonly [
      { title: string; description: string },
      { title: string; description: string },
      { title: string; description: string },
    ];
  };
};

export const BLOCK_TEXTS: SiteTexts<BlockTexts> = {
  en: {
    dateLocale: "en",

    viewAll:        "View all",
    relatedContent: "Related content",
    sliderEmpty:    "Add slides in the CMS to see the slider",

    mediaSlider:   "Media slider",
    slides:        "Slides",
    previousSlide: "Previous slide",
    nextSlide:     "Next slide",
    goToSlide:     (n) => `Go to slide ${n}`,

    updatedOn:    (date) => `Updated ${date}`,
    readingTime:  (min) => `${min} min read`,
    articleCover: "Article cover",

    remoteLabels: {
      "on-site": "On-site",
      "hybrid":  "Hybrid",
      "remote":  "Remote",
    },
    contractLabels: {
      "full-time":  "Full-time",
      "part-time":  "Part-time",
      "contract":   "Contract",
      "internship": "Internship",
      "freelance":  "Freelance",
    },
    closed:       "Closed",
    closesToday:  "Closes today",
    closesInDays: (days) => `Closes in ${days} day${days === 1 ? "" : "s"}`,
    closesOn:     (date) => `Closes ${date}`,
    location:     "Location",
    workStyle:    "Work style",
    contract:     "Contract",
    hours:        "Hours",
    level:        "Level",
    salary:       "Salary",
    startDate:    "Start date",
    deadline:     "Deadline",
    noDetails:    "No details available.",

    noMedia:      "No media",
    video:        "Video",
    previousItem: "Previous item",
    nextItem:     "Next item",
    goTo:         (label) => `Go to ${label}`,

    mapTitle: "Office location map",
    address:  "Address",
    email:    "Email",
    phone:    "Phone",

    productImagePlaceholder: (title) => `${title} product image placeholder`,
    productImageN:           (title, n) => `${title} image ${n}`,
    specifications:          "Specifications",
    relatedProducts:         "Related Products",

    features:    "Features",
    notIncluded: "Not included",

    partnerLogos: "Partner logos",

    closeNotification: "Close notification",

    playVideo: "Play video",

    heroBanner:    "Hero banner",
    pageHeader:    "Page header",
    hero:          "Hero",
    carousel:      "carousel",
    slideN:        (n) => `Slide ${n}`,
    previous:      "Previous",
    next:          "Next",
    youtubePlayer: "YouTube video player",
    vimeoPlayer:   "Vimeo video player",

    introDefaults: {
      label:    "The problem",
      headline: "One website can't speak to everyone.",
      body:     "Marketing teams spend weeks crafting the perfect message — then serve it identically to every visitor, regardless of where they came from, what device they're using, or what they actually need.",
      points: [
        "Traffic from 10+ sources lands on one generic page",
        "Your best leads leave before they see your real value",
        "True personalisation takes months of engineering",
      ],
    },
    solutionDefaults: {
      label:       "How it works",
      headline:    "Three steps to adaptive.",
      subheadline: "No code changes, no data science team. Just connect, configure, and let Chameleon decide.",
      features: [
        {
          title:       "Connect your sources",
          description: "Install the snippet or connect via API. Chameleon starts collecting visitor signals — UTM params, referrers, geo, device, and more — immediately.",
        },
        {
          title:       "Define your experiences",
          description: "Use the visual editor to create content variants. Each experience is a complete page configuration — headline, copy, CTA, even layout.",
        },
        {
          title:       "Let Chameleon decide",
          description: "The rule engine evaluates every visitor in real time and serves the best-match experience. You see the results in the analytics dashboard.",
        },
      ],
    },
  },

  nl: {
    dateLocale: "nl-NL",

    viewAll:        "Bekijk alles",
    relatedContent: "Ook interessant",
    sliderEmpty:    "Voeg slides toe in het CMS om de slider te zien",

    mediaSlider:   "Mediaslider",
    slides:        "Slides",
    previousSlide: "Vorige slide",
    nextSlide:     "Volgende slide",
    goToSlide:     (n) => `Ga naar slide ${n}`,

    updatedOn:    (date) => `Bijgewerkt op ${date}`,
    readingTime:  (min) => `${min} min leestijd`,
    articleCover: "Omslagbeeld van het artikel",

    remoteLabels: {
      "on-site": "Op locatie",
      "hybrid":  "Hybride",
      "remote":  "Op afstand",
    },
    contractLabels: {
      "full-time":  "Fulltime",
      "part-time":  "Parttime",
      "contract":   "Tijdelijk",
      "internship": "Stage",
      "freelance":  "Freelance",
    },
    closed:       "Gesloten",
    closesToday:  "Sluit vandaag",
    closesInDays: (days) => `Sluit over ${days} ${days === 1 ? "dag" : "dagen"}`,
    closesOn:     (date) => `Sluit op ${date}`,
    location:     "Locatie",
    workStyle:    "Werkplek",
    contract:     "Contract",
    hours:        "Uren",
    level:        "Niveau",
    salary:       "Salaris",
    startDate:    "Startdatum",
    deadline:     "Sluitingsdatum",
    noDetails:    "Geen details beschikbaar.",

    noMedia:      "Geen media",
    video:        "Video",
    previousItem: "Vorig item",
    nextItem:     "Volgend item",
    goTo:         (label) => `Ga naar ${label}`,

    mapTitle: "Kaart met de locatie van het kantoor",
    address:  "Adres",
    email:    "E-mail",
    phone:    "Telefoon",

    productImagePlaceholder: (title) => `Geen productfoto van ${title}`,
    productImageN:           (title, n) => `${title}, foto ${n}`,
    specifications:          "Specificaties",
    relatedProducts:         "Vergelijkbare producten",

    features:    "Functies",
    notIncluded: "Niet inbegrepen",

    partnerLogos: "Logo's van partners",

    closeNotification: "Sluit melding",

    playVideo: "Video afspelen",

    heroBanner:    "Hoofdbanner",
    pageHeader:    "Paginakop",
    hero:          "Hoofdbanner",
    carousel:      "carrousel",
    slideN:        (n) => `Slide ${n}`,
    previous:      "Vorige",
    next:          "Volgende",
    youtubePlayer: "YouTube-videospeler",
    vimeoPlayer:   "Vimeo-videospeler",

    introDefaults: {
      label:    "Het probleem",
      headline: "Eén website kan niet iedereen aanspreken.",
      body:     "Marketingteams werken wekenlang aan de perfecte boodschap. Daarna krijgt elke bezoeker precies hetzelfde te zien. Waar je vandaan komt, welk apparaat je gebruikt en wat je nodig hebt maakt geen verschil.",
      points: [
        "Verkeer uit meer dan 10 bronnen komt op één algemene pagina uit",
        "Je beste leads haken af voordat ze zien wat je echt te bieden hebt",
        "Echte personalisatie kost maanden ontwikkelwerk",
      ],
    },
    solutionDefaults: {
      label:       "Zo werkt het",
      headline:    "In drie stappen adaptief.",
      subheadline: "Geen aanpassingen in je code en geen team van datawetenschappers. Je koppelt, stelt in en laat Chameleon kiezen.",
      features: [
        {
          title:       "Koppel je bronnen",
          description: "Plaats de snippet of koppel via de API. Chameleon verzamelt meteen signalen van bezoekers, zoals UTM-parameters, verwijzers, locatie en apparaat.",
        },
        {
          title:       "Bepaal je ervaringen",
          description: "Maak contentvarianten in de visuele editor. Elke ervaring is een volledige paginaconfiguratie met kop, tekst, CTA en zelfs de indeling.",
        },
        {
          title:       "Laat Chameleon kiezen",
          description: "De regelmotor beoordeelt elke bezoeker in realtime en toont de ervaring die het best past. De resultaten zie je in het analysedashboard.",
        },
      ],
    },
  },
};

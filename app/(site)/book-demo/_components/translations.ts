/**
 * Book Demo page translations
 *
 * Supported locales: en · nl · de
 *
 * Used by BookDemoClient (client component) and the page.tsx server components
 * for each locale. Adding a new locale: extend the `locales` object below and
 * create a new locale directory with its own page.tsx.
 */

export type BookDemoLocale = "en" | "nl" | "de";

export interface BookDemoTranslations {
  // ── Page shell (server component) ─────────────────────────────────────────
  metaTitle:        string;
  metaDescription:  string;
  ogTitle:          string;
  ogDescription:    string;
  badge:            string;
  pageHeading:      string;
  pageSubheading:   string;
  trustNoCreditCard:   string;
  trustCalendarInvite: string;
  trustLiveQA:         string;

  // ── Card header band ────────────────────────────────────────────────────────
  cardTitle:       string;
  cardSubtitle:    string;
  cardDescription: string;

  // ── Step labels ─────────────────────────────────────────────────────────────
  stepDate:      string;
  stepTime:      string;
  stepDetails:   string;
  stepConfirmed: string;

  // ── Calendar ─────────────────────────────────────────────────────────────────
  months:          readonly [string, string, string, string, string, string, string, string, string, string, string, string];
  dayHeaders:      readonly [string, string, string, string, string, string, string];
  chooseDateTitle: string;
  weekendsNote:    string;

  // ── Time slots ───────────────────────────────────────────────────────────────
  availableTimesPrefix: string;   // "Available times — "
  loadingSlots:         string;
  noSlotsTitle:         string;
  noSlotsBody:          string;
  tryAgain:             string;
  backToCalendar:       string;
  chooseTimeTitle:      string;
  timezone:             string;   // displayed after date on step 2

  // ── Details form ─────────────────────────────────────────────────────────────
  yourDetailsTitle: string;
  labelFullName:    string;
  labelWorkEmail:   string;
  labelCompany:     string;
  labelPhone:       string;
  labelMessage:     string;
  hintOptional:     string;
  hintCompany:      string;
  hintPhone:        string;
  hintMessage:      string;
  placeholderName:    string;
  placeholderEmail:   string;
  placeholderCompany: string;
  placeholderPhone:   string;
  placeholderMessage: string;
  changeSlot:         string;
  duration:           string;

  // ── Submit ────────────────────────────────────────────────────────────────────
  submitLabel:      string;
  submittingLabel:  string;
  submitNote:       string;

  // ── Validation errors ────────────────────────────────────────────────────────
  errorNameRequired:    string;
  errorEmailRequired:   string;
  errorEmailInvalid:    string;
  errorLoadSlots:       string;
  errorConnect:         string;
  errorGeneric:         string;
  errorNetwork:         string;

  // ── Confirmation screen ───────────────────────────────────────────────────────
  confirmedTitle:    string;
  confirmedBody:     string;
  confirmedBookingLabel:  string;
  confirmedExpectLabel:   string;
  confirmedExpectItems:   readonly [string, string, string];
  bookAnother:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// English
// ─────────────────────────────────────────────────────────────────────────────

const en: BookDemoTranslations = {
  metaTitle:       "Book a Demo — Mister Chameleon",
  metaDescription: "Schedule a free 30-minute demo and see how Mister Chameleon personalises your website in real time for every individual visitor.",
  ogTitle:         "Book a free demo — Mister Chameleon",
  ogDescription:   "Pick a date and time that suits you. We'll show you the platform live.",

  badge:          "Free · 30 min · No commitment",
  pageHeading:    "See Mister Chameleon in action",
  pageSubheading: "Book a personalised demo and watch your website adapt to each individual visitor in real time. Pick a slot below and we'll send you a calendar invite straight away.",

  trustNoCreditCard:   "No credit card required",
  trustCalendarInvite: "Calendar invite sent instantly",
  trustLiveQA:         "Live Q&A included",

  cardTitle:       "Book a Demo",
  cardSubtitle:    "30 min · Free · No commitment",
  cardDescription: "See Mister Chameleon personalise your website in real time — tailored to every individual visitor.",

  stepDate:      "Date",
  stepTime:      "Time",
  stepDetails:   "Details",
  stepConfirmed: "Confirmed",

  months:     ["January","February","March","April","May","June","July","August","September","October","November","December"],
  dayHeaders: ["Mo","Tu","We","Th","Fr","Sa","Su"],
  chooseDateTitle: "Choose a date",
  weekendsNote:    "Weekends unavailable — Mon–Fri only",

  availableTimesPrefix: "Available times — ",
  loadingSlots:         "Loading available slots…",
  noSlotsTitle:         "No slots available",
  noSlotsBody:          "All times on this day are taken. Try another date.",
  tryAgain:             "Try again",
  backToCalendar:       "Back to calendar",
  chooseTimeTitle:      "Choose a time",
  timezone:             "Europe/Amsterdam",

  yourDetailsTitle: "Your details",
  labelFullName:    "Full name",
  labelWorkEmail:   "Work email",
  labelCompany:     "Company",
  labelPhone:       "Phone",
  labelMessage:     "Anything you'd like us to know?",
  hintOptional:     "Optional",
  hintCompany:      "Optional",
  hintPhone:        "Optional",
  hintMessage:      "Optional — helps us tailor the demo",
  placeholderName:    "Jasper Mulders",
  placeholderEmail:   "jasper@company.com",
  placeholderCompany: "Acme Corp",
  placeholderPhone:   "+31 6 12345678",
  placeholderMessage: "e.g. We run an e-commerce store and want to personalise product recommendations…",
  changeSlot:  "Change",
  duration:    "30 minutes",

  submitLabel:     "Confirm booking",
  submittingLabel: "Confirming booking…",
  submitNote:      "You'll receive a calendar invite and confirmation email immediately after booking.",

  errorNameRequired:  "Name is required.",
  errorEmailRequired: "Email is required.",
  errorEmailInvalid:  "Please enter a valid email address.",
  errorLoadSlots:     "Could not load time slots.",
  errorConnect:       "Failed to connect. Please try again.",
  errorGeneric:       "Something went wrong. Please try again.",
  errorNetwork:       "Network error. Please check your connection and try again.",

  confirmedTitle: "You're all set!",
  confirmedBody:  "Your demo is booked. Check your inbox — a calendar invite and confirmation are on their way to",
  confirmedBookingLabel: "Your booking",
  confirmedExpectLabel:  "What to expect",
  confirmedExpectItems:  [
    "Live personalisation demo tailored to your website",
    "Real-time visitor profiling and rule-based adaptation",
    "Q&A with our team — no sales pressure",
  ],
  bookAnother: "Book another demo slot",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dutch
// ─────────────────────────────────────────────────────────────────────────────

const nl: BookDemoTranslations = {
  metaTitle:       "Boek een demo — Mister Chameleon",
  metaDescription: "Plan een gratis demo van 30 minuten en zie hoe Mister Chameleon uw website in real time personaliseert voor iedere individuele bezoeker.",
  ogTitle:         "Boek een gratis demo — Mister Chameleon",
  ogDescription:   "Kies een datum en tijd die u schikt. We laten u het platform live zien.",

  badge:          "Gratis · 30 min · Vrijblijvend",
  pageHeading:    "Zie Mister Chameleon in actie",
  pageSubheading: "Boek een gepersonaliseerde demo en zie hoe uw website zich in real time aanpast aan iedere individuele bezoeker. Kies een tijdslot hieronder en we sturen u direct een agenda-uitnodiging.",

  trustNoCreditCard:   "Geen creditcard vereist",
  trustCalendarInvite: "Agenda-uitnodiging direct verzonden",
  trustLiveQA:         "Live Q&A inbegrepen",

  cardTitle:       "Boek een demo",
  cardSubtitle:    "30 min · Gratis · Vrijblijvend",
  cardDescription: "Zie hoe Mister Chameleon uw website in real time personaliseert — afgestemd op iedere individuele bezoeker.",

  stepDate:      "Datum",
  stepTime:      "Tijd",
  stepDetails:   "Gegevens",
  stepConfirmed: "Bevestigd",

  months:     ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"],
  dayHeaders: ["Ma","Di","Wo","Do","Vr","Za","Zo"],
  chooseDateTitle: "Kies een datum",
  weekendsNote:    "Weekenden niet beschikbaar — ma–vr",

  availableTimesPrefix: "Beschikbare tijden — ",
  loadingSlots:         "Beschikbare tijdslots laden…",
  noSlotsTitle:         "Geen tijdslots beschikbaar",
  noSlotsBody:          "Alle tijden op deze dag zijn bezet. Kies een andere datum.",
  tryAgain:             "Opnieuw proberen",
  backToCalendar:       "Terug naar kalender",
  chooseTimeTitle:      "Kies een tijd",
  timezone:             "Europa/Amsterdam",

  yourDetailsTitle: "Uw gegevens",
  labelFullName:    "Volledige naam",
  labelWorkEmail:   "Zakelijk e-mailadres",
  labelCompany:     "Bedrijf",
  labelPhone:       "Telefoonnummer",
  labelMessage:     "Iets wat u ons wilt laten weten?",
  hintOptional:     "Optioneel",
  hintCompany:      "Optioneel",
  hintPhone:        "Optioneel",
  hintMessage:      "Optioneel — helpt ons de demo af te stemmen",
  placeholderName:    "Jan de Vries",
  placeholderEmail:   "jan@bedrijf.nl",
  placeholderCompany: "Acme B.V.",
  placeholderPhone:   "+31 6 12345678",
  placeholderMessage: "Bijv. wij hebben een webshop en willen productaanbevelingen personaliseren…",
  changeSlot:  "Wijzigen",
  duration:    "30 minuten",

  submitLabel:     "Boeking bevestigen",
  submittingLabel: "Boeking bevestigen…",
  submitNote:      "U ontvangt direct na het boeken een agenda-uitnodiging en bevestigingsmail.",

  errorNameRequired:  "Naam is verplicht.",
  errorEmailRequired: "E-mailadres is verplicht.",
  errorEmailInvalid:  "Voer een geldig e-mailadres in.",
  errorLoadSlots:     "Tijdslots konden niet worden geladen.",
  errorConnect:       "Verbinding mislukt. Probeer opnieuw.",
  errorGeneric:       "Er is iets misgegaan. Probeer opnieuw.",
  errorNetwork:       "Netwerkfout. Controleer uw verbinding en probeer opnieuw.",

  confirmedTitle: "Alles is geregeld!",
  confirmedBody:  "Uw demo is geboekt. Controleer uw inbox — een agenda-uitnodiging en bevestiging zijn onderweg naar",
  confirmedBookingLabel: "Uw boeking",
  confirmedExpectLabel:  "Wat u kunt verwachten",
  confirmedExpectItems:  [
    "Live personalisatiedemo afgestemd op uw website",
    "Realtime bezoekerprofiling en regelgebaseerde aanpassing",
    "Q&A met ons team — geen verkoopdruk",
  ],
  bookAnother: "Nog een demo boeken",
};

// ─────────────────────────────────────────────────────────────────────────────
// German
// ─────────────────────────────────────────────────────────────────────────────

const de: BookDemoTranslations = {
  metaTitle:       "Demo buchen — Mister Chameleon",
  metaDescription: "Vereinbaren Sie eine kostenlose 30-minütige Demo und sehen Sie, wie Mister Chameleon Ihre Website in Echtzeit für jeden einzelnen Besucher personalisiert.",
  ogTitle:         "Kostenlose Demo buchen — Mister Chameleon",
  ogDescription:   "Wählen Sie Datum und Uhrzeit, die Ihnen passen. Wir zeigen Ihnen die Plattform live.",

  badge:          "Kostenlos · 30 Min. · Unverbindlich",
  pageHeading:    "Mister Chameleon in Aktion erleben",
  pageSubheading: "Buchen Sie eine personalisierte Demo und erleben Sie, wie Ihre Website sich in Echtzeit an jeden einzelnen Besucher anpasst. Wählen Sie unten einen Termin – wir senden Ihnen sofort eine Kalendereinladung.",

  trustNoCreditCard:   "Keine Kreditkarte erforderlich",
  trustCalendarInvite: "Kalendereinladung sofort versandt",
  trustLiveQA:         "Live Q&A inklusive",

  cardTitle:       "Demo buchen",
  cardSubtitle:    "30 Min. · Kostenlos · Unverbindlich",
  cardDescription: "Sehen Sie, wie Mister Chameleon Ihre Website in Echtzeit personalisiert – individuell für jeden Besucher.",

  stepDate:      "Datum",
  stepTime:      "Uhrzeit",
  stepDetails:   "Angaben",
  stepConfirmed: "Bestätigt",

  months:     ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
  dayHeaders: ["Mo","Di","Mi","Do","Fr","Sa","So"],
  chooseDateTitle: "Datum wählen",
  weekendsNote:    "Wochenenden nicht verfügbar — Mo–Fr",

  availableTimesPrefix: "Verfügbare Zeiten — ",
  loadingSlots:         "Verfügbare Zeitfenster werden geladen…",
  noSlotsTitle:         "Keine Zeitfenster verfügbar",
  noSlotsBody:          "Alle Zeiten an diesem Tag sind belegt. Wählen Sie ein anderes Datum.",
  tryAgain:             "Erneut versuchen",
  backToCalendar:       "Zurück zum Kalender",
  chooseTimeTitle:      "Uhrzeit wählen",
  timezone:             "Europa/Amsterdam",

  yourDetailsTitle: "Ihre Angaben",
  labelFullName:    "Vollständiger Name",
  labelWorkEmail:   "Geschäftliche E-Mail",
  labelCompany:     "Unternehmen",
  labelPhone:       "Telefon",
  labelMessage:     "Möchten Sie uns etwas mitteilen?",
  hintOptional:     "Optional",
  hintCompany:      "Optional",
  hintPhone:        "Optional",
  hintMessage:      "Optional — hilft uns, die Demo anzupassen",
  placeholderName:    "Max Mustermann",
  placeholderEmail:   "max@unternehmen.de",
  placeholderCompany: "Mustermann GmbH",
  placeholderPhone:   "+49 30 12345678",
  placeholderMessage: "Z. B. wir betreiben einen Online-Shop und möchten Produktempfehlungen personalisieren…",
  changeSlot:  "Ändern",
  duration:    "30 Minuten",

  submitLabel:     "Buchung bestätigen",
  submittingLabel: "Buchung wird bestätigt…",
  submitNote:      "Sie erhalten sofort nach der Buchung eine Kalendereinladung und eine Bestätigungsmail.",

  errorNameRequired:  "Name ist erforderlich.",
  errorEmailRequired: "E-Mail-Adresse ist erforderlich.",
  errorEmailInvalid:  "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  errorLoadSlots:     "Zeitfenster konnten nicht geladen werden.",
  errorConnect:       "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
  errorGeneric:       "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
  errorNetwork:       "Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.",

  confirmedTitle: "Alles erledigt!",
  confirmedBody:  "Ihre Demo ist gebucht. Prüfen Sie Ihren Posteingang – eine Kalendereinladung und Bestätigung sind unterwegs an",
  confirmedBookingLabel: "Ihre Buchung",
  confirmedExpectLabel:  "Was Sie erwartet",
  confirmedExpectItems:  [
    "Live-Personalisierungsdemo, abgestimmt auf Ihre Website",
    "Echtzeit-Besucherprofiling und regelbasierte Anpassung",
    "Q&A mit unserem Team – kein Verkaufsdruck",
  ],
  bookAnother: "Weitere Demo buchen",
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export const BOOK_DEMO_TRANSLATIONS: Record<BookDemoLocale, BookDemoTranslations> = { en, nl, de };

export function getBookDemoTranslations(locale: BookDemoLocale): BookDemoTranslations {
  return BOOK_DEMO_TRANSLATIONS[locale] ?? BOOK_DEMO_TRANSLATIONS.en;
}

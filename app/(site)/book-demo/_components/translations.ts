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
  metaTitle:       "Plan een demo | Mister Chameleon",
  metaDescription: "Zie in dertig minuten hoe jouw site eruitziet voor verschillende bezoekers. Gratis en zonder verplichting.",
  ogTitle:         "Plan een demo | Mister Chameleon",
  ogDescription:   "Kies een moment dat je past. We laten het platform live zien op jouw site.",

  badge:          "Gratis · 30 minuten · Zonder verplichting",
  pageHeading:    "Plan een demo van Mister Chameleon",
  pageSubheading: "Dertig minuten, gratis en zonder verplichting. We laten zien hoe jouw site eruitziet voor verschillende bezoekers. Kies een moment en je krijgt meteen een uitnodiging in je agenda.",

  trustNoCreditCard:   "Geen creditcard nodig",
  trustCalendarInvite: "Meteen een uitnodiging in je agenda",
  trustLiveQA:         "Ruimte voor al je vragen",

  cardTitle:       "Kies een moment",
  cardSubtitle:    "30 minuten · Gratis · Zonder verplichting",
  cardDescription: "We laten zien hoe jouw site eruitziet voor verschillende bezoekers.",

  stepDate:      "Datum",
  stepTime:      "Tijd",
  stepDetails:   "Gegevens",
  stepConfirmed: "Bevestigd",

  months:     ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"],
  dayHeaders: ["Ma","Di","Wo","Do","Vr","Za","Zo"],
  chooseDateTitle: "Kies een datum",
  weekendsNote:    "Van maandag tot en met vrijdag",

  availableTimesPrefix: "Beschikbare tijden op ",
  loadingSlots:         "Beschikbare tijden laden…",
  noSlotsTitle:         "Geen tijden beschikbaar",
  noSlotsBody:          "Deze dag zit vol. Kies een andere datum.",
  tryAgain:             "Opnieuw proberen",
  backToCalendar:       "Terug naar de kalender",
  chooseTimeTitle:      "Kies een tijd",
  timezone:             "Europa/Amsterdam",

  yourDetailsTitle: "Je gegevens",
  labelFullName:    "Naam",
  labelWorkEmail:   "Zakelijk e-mailadres",
  labelCompany:     "Bedrijf",
  labelPhone:       "Telefoonnummer",
  labelMessage:     "Wil je ons vooraf iets laten weten?",
  hintOptional:     "Optioneel",
  hintCompany:      "Optioneel",
  hintPhone:        "Optioneel",
  hintMessage:      "Optioneel. Zo stemmen we de demo op je af.",
  placeholderName:    "Jan de Vries",
  placeholderEmail:   "jan@bedrijf.nl",
  placeholderCompany: "Acme B.V.",
  placeholderPhone:   "+31 6 12345678",
  placeholderMessage: "Bijvoorbeeld dat je twee doelgroepen hebt die elk iets anders zoeken.",
  changeSlot:  "Wijzigen",
  duration:    "30 minuten",

  submitLabel:     "Demo bevestigen",
  submittingLabel: "Bezig met bevestigen…",
  submitNote:      "Je krijgt meteen een uitnodiging in je agenda en een bevestiging per mail.",

  errorNameRequired:  "Vul je naam in.",
  errorEmailRequired: "Vul je e-mailadres in.",
  errorEmailInvalid:  "Dit e-mailadres klopt niet.",
  errorLoadSlots:     "De tijden konden niet worden geladen.",
  errorConnect:       "Er is geen verbinding. Probeer het opnieuw.",
  errorGeneric:       "Er ging iets mis. Probeer het opnieuw.",
  errorNetwork:       "Er is geen verbinding. Controleer je internet en probeer het opnieuw.",

  confirmedTitle: "Je demo staat gepland",
  confirmedBody:  "Kijk in je inbox. De uitnodiging en de bevestiging zijn onderweg naar",
  confirmedBookingLabel: "Je afspraak",
  confirmedExpectLabel:  "Wat je kunt verwachten",
  confirmedExpectItems:  [
    "Een demo op jouw eigen site",
    "Je ziet hoe we een bezoeker herkennen en de pagina aanpassen",
    "Tijd voor al je vragen",
  ],
  bookAnother: "Nog een demo plannen",
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

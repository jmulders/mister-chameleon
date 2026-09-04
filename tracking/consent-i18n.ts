/**
 * Consent UI translations (nl / en) for the cookie banner, declaration and
 * preferences launcher. Kept in one place so the copy stays consistent across
 * the banner, the "/cookies" page and the always-on settings modal.
 *
 * Components take a `locale` prop; the server layout / page resolves it from the
 * mc_locale cookie. Unknown locales fall back to English.
 */

export type ConsentLocale = "nl" | "en";

export interface ConsentTexts {
  banner: {
    title:         string;
    description:   string;
    essentialLabel: string;
    essentialNote:  string;
    acceptAll:     string;
    customize:     string;
    save:          string;
    essentialOnly: string;
    moreLink:      string;
  };
  /** Category label + description, used by both the banner and the declaration. */
  catMeta: Record<"essential" | "analytics" | "personalization" | "enrichment" | "advertising", { label: string; description: string }>;
  declaration: {
    acceptAll:          string;
    rejectNonEssential: string;
    savePreferences:    string;
    saved:              string;
    alwaysOn:           string;
    allowed:            string;
    off:                string;
    cols: { cookie: string; provider: string; purpose: string; lifetime: string; type: string; domain: string };
  };
  preferences: {
    launcher: string;
    title:    string;
    close:    string;
  };
  policyPage: {
    heading: string;
    intro:   string;
    note:    string;
  };
}

const EN: ConsentTexts = {
  banner: {
    title:          "We value your privacy",
    description:    "We use cookies to improve your experience, analyze traffic, and show relevant content. You can choose which types of cookies you allow.",
    essentialLabel: "Essential",
    essentialNote:  "Required for the site to function. Cannot be disabled.",
    acceptAll:      "Accept all",
    customize:      "Customize",
    save:           "Save preferences",
    essentialOnly:  "Essential only",
    moreLink:       "More about cookies →",
  },
  catMeta: {
    essential:       { label: "Strictly necessary", description: "Required for the site to work (session, your consent choice, language). Always on." },
    analytics:       { label: "Analytics",          description: "Helps us understand how visitors interact with the site (page views, events)." },
    personalization: { label: "Personalization",    description: "Lets us remember you across visits to tailor content to your behavior over time. Anonymous, session-only adjustments do not need this." },
    enrichment:      { label: "Enrichment",         description: "Lets us recognize your company and context to provide more relevant information." },
    advertising:     { label: "Advertising",        description: "Lets us share ad click identifiers with advertising platforms (Google, Meta) so a conversion can be matched to the ad you clicked. No advertising data is shared without this." },
  },
  declaration: {
    acceptAll:          "Accept all",
    rejectNonEssential: "Reject non-essential",
    savePreferences:    "Save preferences",
    saved:              "Preferences saved.",
    alwaysOn:           "Always on",
    allowed:            "Allowed",
    off:                "Off",
    cols: { cookie: "Cookie", provider: "Provider", purpose: "Purpose", lifetime: "Lifetime", type: "Type", domain: "Domain" },
  },
  preferences: {
    launcher: "Cookie settings",
    title:    "Cookie preferences",
    close:    "Close",
  },
  policyPage: {
    heading: "Cookie policy",
    intro:   "Below is every cookie this website may place, grouped by purpose. For each cookie you can see who sets it, what it's for, how long it's kept (lifetime), its type and domain. You can change your choices at any time — they take effect immediately and are remembered.",
    note:    "Integration cookies (Google Analytics, Leadinfo) are only set when that integration is enabled for this site. Strictly-necessary cookies are always active because the site cannot function without them.",
  },
};

const NL: ConsentTexts = {
  banner: {
    title:          "We hechten waarde aan uw privacy",
    description:    "We gebruiken cookies om uw ervaring te verbeteren, het verkeer te analyseren en relevante content te tonen. U kiest zelf welke soorten cookies u toestaat.",
    essentialLabel: "Essentieel",
    essentialNote:  "Nodig om de site te laten werken. Kan niet worden uitgezet.",
    acceptAll:      "Alles accepteren",
    customize:      "Aanpassen",
    save:           "Voorkeuren opslaan",
    essentialOnly:  "Alleen essentieel",
    moreLink:       "Meer over cookies →",
  },
  catMeta: {
    essential:       { label: "Strikt noodzakelijk", description: "Nodig om de site te laten werken (sessie, uw keuze, taal). Altijd aan." },
    analytics:       { label: "Analytics",           description: "Helpt ons begrijpen hoe bezoekers de site gebruiken (paginaweergaven, gebeurtenissen)." },
    personalization: { label: "Personalisatie",      description: "Laat ons u over bezoeken heen herkennen om content op uw gedrag in de tijd af te stemmen. Anonieme, sessie-only aanpassingen hebben dit niet nodig." },
    enrichment:      { label: "Verrijking",          description: "Stelt ons in staat uw bedrijf en context te herkennen voor relevantere informatie." },
    advertising:     { label: "Advertenties",        description: "Laat ons advertentie-klik-ID's delen met advertentieplatforms (Google, Meta) zodat een conversie kan worden gekoppeld aan de advertentie waarop u klikte. Zonder deze keuze worden geen advertentiegegevens gedeeld." },
  },
  declaration: {
    acceptAll:          "Alles accepteren",
    rejectNonEssential: "Niet-essentieel weigeren",
    savePreferences:    "Voorkeuren opslaan",
    saved:              "Voorkeuren opgeslagen.",
    alwaysOn:           "Altijd aan",
    allowed:            "Toegestaan",
    off:                "Uit",
    cols: { cookie: "Cookie", provider: "Aanbieder", purpose: "Doel", lifetime: "Bewaartermijn", type: "Type", domain: "Domein" },
  },
  preferences: {
    launcher: "Cookie-instellingen",
    title:    "Cookievoorkeuren",
    close:    "Sluiten",
  },
  policyPage: {
    heading: "Cookiebeleid",
    intro:   "Hieronder staat elke cookie die deze website kan plaatsen, gegroepeerd per doel. Per cookie ziet u wie hem plaatst, waarvoor hij dient, hoe lang hij bewaard wordt (bewaartermijn), het type en het domein. U kunt uw keuze op elk moment aanpassen — die geldt direct en wordt onthouden.",
    note:    "Integratie-cookies (Google Analytics, Leadinfo) worden alleen geplaatst als die integratie voor deze site aanstaat. Strikt noodzakelijke cookies staan altijd aan omdat de site zonder deze niet werkt.",
  },
};

const DICT: Record<ConsentLocale, ConsentTexts> = { nl: NL, en: EN };

/**
 * Clamp an arbitrary locale string (e.g. "nl", "nl-NL", "en_GB", "de") to the
 * supported ConsentLocale union, with English as the last resort. Callers resolve
 * the raw locale from the mc_locale cookie, falling back to the tenant's default
 * language — so a fresh visitor on a Dutch tenant gets the Dutch banner even
 * without a cookie. Any unsupported language (e.g. "de") → "en".
 */
export function toConsentLocale(locale?: string | null): ConsentLocale {
  const lang = (locale ?? "").slice(0, 2).toLowerCase();
  return lang in DICT ? (lang as ConsentLocale) : "en";
}

/** Resolve consent copy for a locale string (e.g. "nl", "nl-NL"). Falls back to English. */
export function consentTexts(locale?: string | null): ConsentTexts {
  return DICT[toConsentLocale(locale)];
}

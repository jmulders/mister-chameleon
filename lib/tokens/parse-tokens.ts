/**
 * Dynamic Token Parser
 *
 * Vervangt {{placeholder}}-tokens in CMS-tekst met echte bezoekersdata uit de
 * Mr. Chameleon context.  Dit is de kern van de "Content Matrix"-aanpak:
 * één variant kan zo voor honderden bezoekerssegmenten gepersonaliseerd worden
 * zonder dat er aparte CMS-documenten nodig zijn.
 *
 * ─── Ondersteunde tokens ──────────────────────────────────────────────────────
 *
 *   ── Enrichment / CRM ──────────────────────────────────────────────────────
 *   {{company_name}}   Reverse-IP bedrijfsnaam (bijv. "Philips N.V.")
 *   {{company_short}}  Bedrijfsnaam zonder rechtsvorm (bijv. "Philips")
 *   {{location}}       Stad als beschikbaar, anders regio (bijv. "Amsterdam")
 *   {{city}}           Alleen stad (bijv. "Rotterdam")
 *   {{region}}         Alleen regio/provincie (bijv. "Noord-Holland")
 *   {{industry}}       Bedrijfstak (bijv. "Technologie")
 *   {{first_name}}     CRM-voornaam — stille lege string als onbekend
 *
 *   ── Visitor context ───────────────────────────────────────────────────────
 *   {{source}}         Verkeersbron (bijv. "LinkedIn", "Google")
 *   {{device}}         Apparaattype: "desktop" of "mobile"
 *   {{visit_type}}     Bezoektype: "new" of "returning"
 *   {{campaign}}       UTM-campagnenaam — stille lege string als afwezig
 *   {{medium}}         UTM-medium (bijv. "cpc", "email") — stille lege string als afwezig
 *
 * ─── Veiligheid ──────────────────────────────────────────────────────────────
 *
 *   Alle vervangen waarden worden gesaneerd: HTML-speciale tekens worden
 *   ge-escaped zodat geen XSS mogelijk is via CRM- of enrichment-data.
 *
 * ─── Onbekende tokens ────────────────────────────────────────────────────────
 *
 *   Een token dat niet in de resolver-map staat, blijft ongewijzigd
 *   ({{unknown_token}}) zodat typo's zichtbaar zijn in staging.
 *
 * ─── Gebruik ─────────────────────────────────────────────────────────────────
 *
 *   const title = parseTokens("Welkom, {{company_name}}!", {
 *     companyName: "Philips N.V.",
 *     city:        "Eindhoven",
 *   });
 *   // → "Welkom, Philips N.V.!"
 *
 *   const title = parseTokens("Klanten in {{location}} kiezen voor ons.", {});
 *   // → "Klanten in uw regio kiezen voor ons."
 */

// ── Token-context type ────────────────────────────────────────────────────────

/**
 * Platte subset van EnrichmentOutput + VisitorContext die als input dient voor
 * de token-parser.  Wordt typisch samengesteld in de RSC-page-component uit de
 * HomepageExperience die al is opgehaald door composeHomepageExperience().
 *
 * Alle velden zijn optioneel: ontbrekende velden activeren de fallback-waarden.
 */
export interface TokenContext {
  // ── Enrichment / CRM ───────────────────────────────────────────────────────

  /** Volledige bedrijfsnaam (reverse-IP), bijv. "Philips N.V." */
  companyName?: string | null;

  /** Stad van de bezoeker (IP-gebaseerd of CDN-header), bijv. "Amsterdam" */
  city?: string | null;

  /** Regio / provincie, bijv. "Noord-Holland" */
  region?: string | null;

  /** Bedrijfstak, bijv. "Technology", "Financial Services" */
  companyIndustry?: string | null;

  /** CRM-voornaam van de bezoeker */
  firstName?: string | null;

  // ── Visitor context ────────────────────────────────────────────────────────

  /** Herkende verkeersbron: "linkedin" | "google" | "direct" | "unknown" */
  source?: string | null;

  /**
   * Apparaattype van de bezoeker: "mobile" | "desktop".
   * Bruikbaar voor copy die speelt op device-context.
   */
  device?: string | null;

  /**
   * Bezoektype: "new" | "returning".
   * Stille fallback zodat "new" of "returning" niet rauw in copy verschijnt.
   */
  visitType?: string | null;

  /**
   * UTM-campagnenaam uit de utm_campaign queryparameter.
   * Stille lege-string fallback — alleen zichtbaar als campagne bekend is.
   */
  utmCampaign?: string | null;

  /**
   * UTM-medium uit de utm_medium queryparameter (bijv. "cpc", "email").
   * Stille lege-string fallback.
   */
  utmMedium?: string | null;
}

// ── Nederlandstalige fallback-waarden ────────────────────────────────────────
//
// Wanneer een token-waarde ontbreekt of null is, wordt de fallback-string
// gebruikt.  Kies neutrale, geloofwaardige tekst die ook onpersoonlijk goed
// leest in de zin.

const FALLBACKS: Record<string, string> = {
  // Enrichment / CRM
  company_name:  "uw organisatie",
  company_short: "uw organisatie",
  location:      "uw regio",
  city:          "uw stad",
  region:        "uw regio",
  industry:      "uw sector",
  first_name:    "",           // stille fallback — vermijd "Beste ,"
  // Visitor context
  source:        "",           // stille fallback — "via [leeg]" laat geen spoor
  device:        "your device",
  visit_type:    "",           // stille fallback — "new"/"returning" past slecht rauw in copy
  campaign:      "",           // stille fallback — alleen zichtbaar als UTM aanwezig
  medium:        "",           // stille fallback
};

// ── HTML-escaping ─────────────────────────────────────────────────────────────
//
// Enrichment-data kan willekeurige strings bevatten.  We escapen de vijf
// gevaarlijke HTML-tekens zodat geïnjecteerde waarden nooit als markup worden
// geïnterpreteerd, ook al wordt de output in dangerouslySetInnerHTML gebruikt.

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

// ── Token-resolver ────────────────────────────────────────────────────────────

/**
 * Zet een token-naam om naar de bijbehorende waarde uit de context.
 * Geeft de fallback terug als de waarde ontbreekt of leeg is.
 * Onbekende tokens worden ongewijzigd teruggegeven.
 */
function resolveToken(token: string, ctx: TokenContext): string {
  let resolved: string | null | undefined;

  switch (token) {
    case "company_name":
      resolved = ctx.companyName;
      break;

    case "company_short":
      // Verwijder rechtsvorm-suffixen (B.V., N.V., Ltd., GmbH, …) voor
      // een minder formele, conversationele naam.
      resolved = ctx.companyName
        ? ctx.companyName
            .replace(/\s+(B\.?V\.?|N\.?V\.?|Ltd\.?|GmbH|S\.?A\.?|Inc\.?|LLC)\.?$/i, "")
            .trim()
        : null;
      break;

    case "location":
      // Voorkeur: stad > regio > fallback
      resolved = ctx.city ?? ctx.region;
      break;

    case "city":
      resolved = ctx.city;
      break;

    case "region":
      resolved = ctx.region;
      break;

    case "industry":
      resolved = ctx.companyIndustry;
      break;

    case "first_name":
      resolved = ctx.firstName;
      break;

    case "source":
      // Capitalize first letter for natural copy: "Via LinkedIn" not "Via linkedin"
      resolved = ctx.source
        ? ctx.source.charAt(0).toUpperCase() + ctx.source.slice(1)
        : null;
      break;

    case "device":
      resolved = ctx.device;
      break;

    case "visit_type":
      resolved = ctx.visitType;
      break;

    case "campaign":
      resolved = ctx.utmCampaign;
      break;

    case "medium":
      resolved = ctx.utmMedium;
      break;

    default:
      // Onbekend token — ongewijzigd laten zodat typo's zichtbaar zijn.
      return `{{${token}}}`;
  }

  const value = resolved?.trim() || null;

  if (!value) {
    // Gebruik de fallback of een lege string als er geen fallback is.
    return FALLBACKS[token] ?? "";
  }

  return escapeHtml(value);
}

// ── Publieke API ──────────────────────────────────────────────────────────────

/** Regex die alle {{token}}-patronen matcht (token = alfanumeriek + underscore). */
const TOKEN_PATTERN = /\{\{([a-z_][a-z0-9_]*)\}\}/gi;

/**
 * Vervangt alle `{{token}}`-placeholders in `text` met echte waarden uit `ctx`.
 *
 * - Tokens zonder match in de context krijgen de fallback-waarde.
 * - Onbekende tokens blijven ongewijzigd staan.
 * - Alle ingevulde waarden worden HTML-ge-escaped.
 * - Geeft de originele string terug als er geen tokens in staan.
 *
 * @param text  De te verwerken tekst (bijv. CMS-title of subtitle).
 * @param ctx   De bezoekerscontext met enrichment-data.
 * @returns     De verwerkte tekst met alle tokens vervangen.
 *
 * @example
 * parseTokens("Welkom bij {{company_name}} in {{location}}!", {
 *   companyName: "ASML N.V.",
 *   city:        "Veldhoven",
 * });
 * // → "Welkom bij ASML N.V. in Veldhoven!"
 *
 * parseTokens("Oplossingen voor {{industry}}", {});
 * // → "Oplossingen voor uw sector"
 */
export function parseTokens(text: string, ctx: TokenContext): string {
  if (!text.includes("{{")) return text; // Fast path — geen tokens aanwezig.
  return text.replace(TOKEN_PATTERN, (_, token: string) =>
    resolveToken(token.toLowerCase(), ctx),
  );
}

// ── Context-builder helper ────────────────────────────────────────────────────

/**
 * Bouwt een `TokenContext` op uit de velden die al beschikbaar zijn in de
 * `HomepageExperience` (enrichment + visitorContext).
 *
 * Gebruik dit in je RSC-page-component zodat je niet handmatig alle
 * velden hoeft door te sturen.
 *
 * @example
 * const tokenCtx = buildTokenContext(experience);
 * const title    = parseTokens(variant.content.title, tokenCtx);
 */
/**
 * Bouwt een `TokenContext` rechtstreeks vanuit een `DecisionContext`-achtig object
 * zoals `input` uit de homepage-pipeline.
 *
 * Gebruik dit in page.tsx (RSC) waar je de volledige pipeline-output hebt:
 *
 * @example
 * const tokenCtx = buildTokenContextFromInput(input);
 * <TemplateRenderer pageConfig={pageConfig} contextData={contextData} tokenContext={tokenCtx} />
 */
export function buildTokenContextFromInput(input: {
  source?:         string | null;
  device?:         string | null;
  visitType?:      string | null;
  utmCampaign?:    string | null;
  utmMedium?:      string | null;
  enrichment?: {
    companyName?:     string | null;
    city?:            string | null;
    region?:          string | null;
    companyIndustry?: string | null;
    firstName?:       string | null;
  } | null;
}): TokenContext {
  const e = input.enrichment ?? {};
  return {
    companyName:     e.companyName     ?? null,
    city:            e.city            ?? null,
    region:          e.region          ?? null,
    companyIndustry: e.companyIndustry ?? null,
    firstName:       e.firstName       ?? null,
    source:          input.source      ?? null,
    device:          input.device      ?? null,
    visitType:       input.visitType   ?? null,
    utmCampaign:     input.utmCampaign ?? null,
    utmMedium:       input.utmMedium   ?? null,
  };
}

export function buildTokenContext(experience: {
  enrichment?: {
    companyName?: string | null;
    city?: string | null;
    region?: string | null;
    companyIndustry?: string | null;
    firstName?: string | null;
  } | null;
  visitorContext?: {
    source?:      string | null;
    device?:      string | null;
    visitType?:   string | null;
    utmCampaign?: string | null;
    utmMedium?:   string | null;
  } | null;
}): TokenContext {
  const e   = experience.enrichment    ?? {};
  const ctx = experience.visitorContext ?? {};
  return {
    companyName:     e.companyName     ?? null,
    city:            e.city            ?? null,
    region:          e.region          ?? null,
    companyIndustry: e.companyIndustry ?? null,
    firstName:       e.firstName       ?? null,
    source:          ctx.source        ?? null,
    device:          ctx.device        ?? null,
    visitType:       ctx.visitType     ?? null,
    utmCampaign:     ctx.utmCampaign   ?? null,
    utmMedium:       ctx.utmMedium     ?? null,
  };
}

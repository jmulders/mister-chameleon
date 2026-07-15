/**
 * Adaptive Blocks — Platform Seed Data
 *
 * Default starting content for every known adaptive block key.
 * Run seedPlatformBlocks() once to populate the adaptive_blocks table.
 *
 * Content is in Dutch to match the Mister Chameleon product language.
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 *
 *   Each block has only a defaultVariant — the baseline content.
 *   Actual adaptive variants (per-traffic-source copy) are managed in the
 *   tenant's CMS (Sanity / Storyblok / Statamic) and synced via webhook.
 *   Tokens like {{company_name}} in the content are resolved at render time.
 */

import { upsertAdaptiveBlock } from "./adaptive-blocks-store";
import type { AdaptiveVariantContent } from "@/cms/types";
import type { VariantDecisionMeta } from "@/ai/variant-meta";

// ── AI / Decision metadata derivation ─────────────────────────────────────────
//
// Every platform default block ships with complete decisionMeta so it is
// AI-selectable out of the box. The signals are derived from the block key
// (slot, audience, traffic source, funnel stage). Tenants can still override
// per block in the editor.

const kHas = (k: string, ...w: string[]) => w.some((x) => k.includes(x));

function deriveDecisionMeta(key: string): VariantDecisionMeta {
  const slot = key.split("_")[0]!;

  const audience = kHas(key, "careers")
    ? "Werkzoekende kandidaten"
    : kHas(key, "saas")
      ? "B2B SaaS-bedrijven"
      : "B2B-besluitvormers";

  const sources: VariantDecisionMeta["bestForSources"] =
    kHas(key, "google")            ? ["google"]
    : kHas(key, "linkedin")        ? ["linkedin"]
    : kHas(key, "direct", "brand") ? ["direct"]
    : ["google", "linkedin", "direct", "unknown"];

  const stage: "awareness" | "consideration" | "decision" | "retention" =
    kHas(key, "onboarding", "customer", "returning", "expansion") ? "retention"
    : (kHas(key, "intent", "apply", "signup", "trial", "meeting", "offer", "urgency") || slot === "conversion" || key.endsWith("_demo")) ? "decision"
    : kHas(key, "consideration", "comparison", "cases", "vision", "job_match", "guide", "highlights", "reassurance") ? "consideration"
    : "awareness";

  const intentLevel: VariantDecisionMeta["intentLevel"] = stage === "retention" ? "decision" : stage;
  const funnelStages: VariantDecisionMeta["funnelStages"] =
    stage === "retention"     ? ["retention"]
    : stage === "decision"    ? ["decision"]
    : stage === "consideration" ? ["consideration", "decision"]
    : ["awareness", "consideration"];

  const tone: VariantDecisionMeta["tone"] =
    slot === "proof"                       ? "credibility"
    : kHas(key, "reassurance")             ? "credibility"
    : kHas(key, "urgency", "offer")        ? "urgency"
    : kHas(key, "vision")                  ? "inspiring"
    : (slot === "hero" && key.endsWith("_default")) ? "inspiring"
    : stage === "decision"                 ? "direct"
    : kHas(key, "guide", "highlights", "comparison", "consideration") ? "educational"
    : (slot === "cta" || slot === "conversion") ? "direct"
    : "educational";

  const primaryGoal = ({
    hero:         "De juiste eerste indruk wekken en doorklikken naar de primaire CTA",
    proof:        "Vertrouwen opbouwen met concreet bewijs",
    cta:          "Een concrete vervolgstap laten zetten",
    conversion:   "De conversie afronden (aanmelden of aanvragen)",
    feature:      "Productwaarde en mogelijkheden uitleggen",
    notification: "Aandacht trekken voor nieuws of een actie",
  } as Record<string, string>)[slot] ?? "Bezoeker naar de volgende stap begeleiden";

  const slotNL: Record<string, string> = {
    hero: "hero", proof: "proof", cta: "CTA", conversion: "conversie",
    feature: "feature", notification: "notificatie",
  };
  const stageNL: Record<string, string> = {
    awareness: "kennismakings", consideration: "overwegings",
    decision: "beslissings", retention: "retentie",
  };
  const srcClause = sources.length === 1 ? `, met name bij bezoekers via ${sources[0]}` : "";

  return {
    decisionLabel:    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    decisionSummary:  `Toon dit ${slotNL[slot] ?? slot}-blok aan ${audience.toLowerCase()} in de ${stageNL[stage]}fase${srcClause}.`,
    intendedAudience: audience,
    intentLevel,
    funnelStages,
    bestForSources:   sources,
    tone,
    primaryGoal,
    supportingGoals:  ["Relevantie vergroten voor dit bezoekerstype", "Uitval verlagen"],
  };
}

// ── Seed payload type ─────────────────────────────────────────────────────────

interface SeedBlock {
  key:     string;
  content: AdaptiveVariantContent;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import type { AdaptiveVariantItem } from "@/cms/types";

interface ContentOpts {
  layoutVariant?: string;
  contentAlign?:  "left" | "center" | "right";
}

function c(
  title:    string,
  subtitle: string,
  tag:      string,
  ctas:     { label: string; href: string }[] = [],
  opts:     ContentOpts = {},
): AdaptiveVariantContent {
  return { title, subtitle, tag, ctas, ...opts };
}

/** Content met per-kaart items — voor proof- en feature-blokken. */
function ci(
  title:    string,
  subtitle: string,
  tag:      string,
  items:    AdaptiveVariantItem[],
  ctas:     { label: string; href: string }[] = [],
  opts:     ContentOpts = {},
): AdaptiveVariantContent {
  return { title, subtitle, tag, ctas, items, ...opts };
}


// ── Hero ──────────────────────────────────────────────────────────────────────

const heroBlocks: SeedBlock[] = [
  // ─ hero_default: brand-achtergrond, gecentreerd ─────────────────────────────
  {
    key:     "hero_default",
    content: c(
      "Uw website past zich aan iedere bezoeker aan",
      "Mister Chameleon personaliseert uw B2B website in real-time — zonder cookies, zonder handmatig segmenteren.",
      "Website personalisatie",
      [{ label: "Bekijk een demo", href: "/demo" }, { label: "Hoe het werkt", href: "/features" }],
      { layoutVariant: "hero_default", contentAlign: "center" },
    ),
  },

  // ─ hero_google_problem: background + centred ─────────────────────────────────
  {
    key:     "hero_google_problem",
    content: c(
      "Stop met één boodschap voor iedereen",
      "De meeste B2B websites tonen iedere bezoeker hetzelfde verhaal. Mister Chameleon maakt het verschil: relevantie per bezoeker, meer conversie.",
      "Gevonden via Google",
      [{ label: "Gratis demo aanvragen", href: "/demo" }, { label: "Hoe het werkt", href: "/features" }],
      { layoutVariant: "hero_background", contentAlign: "center" },
    ),
  },

  // ─ hero_linkedin_vision: split + links ───────────────────────────────────────
  {
    key:     "hero_linkedin_vision",
    content: c(
      "Uw website die meegroeit met uw doelgroep",
      "Professionals die via LinkedIn binnenkomen, verwachten relevantie. Toon ze exact het verhaal dat aansluit op hun sector en uitdaging.",
      "De toekomst van B2B marketing",
      [{ label: "Plan een kennismaking", href: "/demo" }, { label: "Ontdek de cases", href: "/cases" }],
      { layoutVariant: "hero_split", contentAlign: "left" },
    ),
  },

  // ─ hero_direct_brand: default brand + centred ────────────────────────────────
  {
    key:     "hero_direct_brand",
    content: c(
      "Slimste personalisatie voor B2B groei",
      "U kent ons al. Kijk hoe andere B2B-bedrijven hun conversie verhogen met gepersonaliseerde websites — en hoe u morgen kunt beginnen.",
      "Welkom bij Mister Chameleon",
      [{ label: "Start gratis proefperiode", href: "/signup" }, { label: "Bekijk demo", href: "/demo" }],
      { layoutVariant: "hero_default", contentAlign: "center" },
    ),
  },

  // ─ hero_consideration: split + links ─────────────────────────────────────────
  {
    key:     "hero_consideration",
    content: c(
      "Vergelijk en kies de aanpak die bij u past",
      "In de overweegfase helpen we u met concrete use cases, prijzen en referenties van vergelijkbare bedrijven uit uw sector.",
      "Waarom Mister Chameleon?",
      [{ label: "Vergelijk pakketten", href: "/pricing" }, { label: "Lees cases", href: "/cases" }],
      { layoutVariant: "hero_split", contentAlign: "left" },
    ),
  },

  // ─ hero_intent_direct: background + centred, hoge urgentie ───────────────────
  {
    key:     "hero_intent_direct",
    content: c(
      "Start vandaag met website personalisatie",
      "U weet wat u wilt. Wij ook. Plan een demo in en we laten u zien hoe u binnen 48 uur live kunt gaan.",
      "Klaar om te starten?",
      [{ label: "Plan een demo", href: "/demo" }, { label: "Direct starten", href: "/signup" }],
      { layoutVariant: "hero_background", contentAlign: "center" },
    ),
  },

  // ─ hero_customer_onboarding: banner (compact) ────────────────────────────────
  {
    key:     "hero_customer_onboarding",
    content: c(
      "Uw gepersonaliseerde website is bijna klaar",
      "Volg de stappen in uw onboarding-dashboard en activeer uw eerste personalisatieregel vandaag nog.",
      "Welkom aan boord",
      [{ label: "Open onboarding", href: "/onboarding" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },

  // ─ hero_saas_default: split + links ──────────────────────────────────────────
  {
    key:     "hero_saas_default",
    content: c(
      "Meer trial-aanmeldingen. Minder churn.",
      "Mister Chameleon helpt SaaS-bedrijven relevanter te zijn voor iedere bezoeker — van eerste bezoek tot klantretentie.",
      "B2B SaaS personalisatie",
      [{ label: "Bekijk SaaS use cases", href: "/cases" }, { label: "Start gratis", href: "/signup" }],
      { layoutVariant: "hero_split", contentAlign: "left" },
    ),
  },

  // ─ hero_saas_consideration: split + links ────────────────────────────────────
  {
    key:     "hero_saas_consideration",
    content: c(
      "Is Mister Chameleon de juiste keuze voor uw SaaS?",
      "Kijk welke functies uw conversie verbeteren en lees wat vergelijkbare SaaS-bedrijven bereiken na implementatie.",
      "Vergelijk SaaS-opties",
      [{ label: "Vergelijk pakketten", href: "/pricing" }, { label: "Lees SaaS-cases", href: "/cases" }],
      { layoutVariant: "hero_split", contentAlign: "left" },
    ),
  },

  // ─ hero_saas_intent: background + centred ────────────────────────────────────
  {
    key:     "hero_saas_intent",
    content: c(
      "Start uw SaaS-personalisatie vandaag",
      "Geen langdurige implementatie. In 48 uur live met gepersonaliseerde content voor uw trial-flow.",
      "Direct starten",
      [{ label: "Start gratis trial", href: "/signup" }, { label: "Plan een demo", href: "/demo" }],
      { layoutVariant: "hero_background", contentAlign: "center" },
    ),
  },

  // ─ hero_saas_trial: proof (trust metrics) ────────────────────────────────────
  {
    key:     "hero_saas_trial",
    content: c(
      "Maak het meeste van uw trial",
      "Ontdek de krachtigste functies, importeer uw content en plan uw lancering — alles in één dashboard.",
      "U bent in uw proefperiode",
      [{ label: "Open onboarding", href: "/onboarding" }, { label: "Bekijk features", href: "/features" }],
      { layoutVariant: "hero_proof", contentAlign: "center" },
    ),
  },

  // ─ hero_saas_customer_onboarding: banner (compact) ───────────────────────────
  {
    key:     "hero_saas_customer_onboarding",
    content: c(
      "Uw SaaS-website is nu intelligenter",
      "Start met de onboarding checklist en activeer uw eerste personalisatieregel in minder dan 30 minuten.",
      "Welkom als klant",
      [{ label: "Open onboarding", href: "/onboarding" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },

  // ─ hero_careers_default: background + centred ────────────────────────────────
  {
    key:     "hero_careers_default",
    content: c(
      "Bouw mee aan de toekomst van B2B websites",
      "We zijn een groeiend team van marketeers, engineers en strategen die personalisatie toegankelijk maken voor iedereen.",
      "Werken bij Mister Chameleon",
      [{ label: "Bekijk vacatures", href: "/vacatures" }, { label: "Over ons team", href: "/over-ons" }],
      { layoutVariant: "hero_background", contentAlign: "center" },
    ),
  },

  // ─ hero_careers_job_match: split + links ─────────────────────────────────────
  {
    key:     "hero_careers_job_match",
    content: c(
      "Er staat een rol klaar die bij u past",
      "Op basis van uw profiel zagen we een aantal vacatures die goed bij u aansluiten. Bekijk ze hieronder.",
      "Vacature voor u gevonden",
      [{ label: "Bekijk vacatures", href: "/vacatures" }],
      { layoutVariant: "hero_split", contentAlign: "left" },
    ),
  },

  // ─ hero_careers_high_intent: background + links ──────────────────────────────
  {
    key:     "hero_careers_high_intent",
    content: c(
      "Wij zoeken u — start uw sollicitatie vandaag",
      "U bent er klaar voor. Wij ook. Stuur uw cv en we nemen binnen twee werkdagen contact op.",
      "Solliciteer nu",
      [{ label: "Direct solliciteren", href: "/solliciteren" }, { label: "Stel een vraag", href: "/contact" }],
      { layoutVariant: "hero_background", contentAlign: "left" },
    ),
  },

  // ─ hero_careers_reassurance: default + links ─────────────────────────────────
  {
    key:     "hero_careers_reassurance",
    content: c(
      "Een eerlijk en transparant sollicitatieproces",
      "We geven altijd persoonlijke terugkoppeling, hanteren een helder tijdpad en respecteren uw privacy gedurende het hele traject.",
      "Vragen over solliciteren?",
      [{ label: "Hoe werkt het?", href: "/sollicitatieprocedure" }, { label: "Stuur een bericht", href: "/contact" }],
      { layoutVariant: "hero_default", contentAlign: "left" },
    ),
  },

  // ── Page banner variants (compact banners for inner CMS pages) ────────────────
  // Used by cms-page-decision.ts: resolvePageBannerKey() returns these keys
  // for the hero slot on inner pages (/contact, /about, /features, etc.)

  {
    key:     "hero_page_banner_awareness",
    content: c(
      "Ontdek wat website personalisatie voor u kan doen",
      "Mister Chameleon past uw B2B website automatisch aan op iedere bezoeker — zonder cookies, zonder code.",
      "Website personalisatie",
      [{ label: "Bekijk een demo", href: "/demo" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },
  {
    key:     "hero_page_banner_consideration",
    content: c(
      "Bekijk hoe Mister Chameleon bij uw aanpak past",
      "Vergelijk functies, lees cases en ontdek welk pakket het beste aansluit op uw groeidoelstellingen.",
      "In de overwegingsfase?",
      [{ label: "Vergelijk opties", href: "/pricing" }, { label: "Lees cases", href: "/cases" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },
  {
    key:     "hero_page_banner_high_intent",
    content: c(
      "Klaar om te starten? We zetten u direct live",
      "Plan een demo en ga binnen 48 uur live met gepersonaliseerde content voor uw bezoekers.",
      "Aan de slag",
      [{ label: "Plan een demo", href: "/demo" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },
  {
    key:     "hero_page_banner_enterprise",
    content: c(
      "Enterprise-grade personalisatie voor uw B2B-team",
      "Dedicated onboarding, SLA-garantie en enterprise-integraties — voor teams die serieus personaliseren.",
      "Enterprise",
      [{ label: "Neem contact op", href: "/contact" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },
  {
    key:     "hero_page_banner_returning",
    content: c(
      "Welkom terug — we hebben het bijgehouden",
      "Ontdek de nieuwste functies en verbeteringen die klaarstaan voor u in uw account.",
      "Welkom terug",
      [{ label: "Open dashboard", href: "/dashboard" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },
  {
    key:     "hero_page_banner_friction",
    content: c(
      "Nog vragen? We beantwoorden ze graag",
      "Twijfelt u ergens over? Neem contact op of bekijk onze veelgestelde vragen — we helpen u verder.",
      "Hulp nodig?",
      [{ label: "Stel een vraag", href: "/contact" }, { label: "Veelgestelde vragen", href: "/faq" }],
      { layoutVariant: "hero_page_banner", contentAlign: "left" },
    ),
  },
];

// ── Proof ─────────────────────────────────────────────────────────────────────

const proofBlocks: SeedBlock[] = [
  {
    key:     "proof_default",
    content: ci(
      "U hoeft ons niet te geloven — u meet het",
      "Elke aanpassing draait tegen een controlegroep die de gewone site ziet. Het verschil tussen beide groepen is uw resultaat.",
      "Meten boven beloven",
      [
        { title: "Controlegroep standaard", text: "Een deel van uw bezoekers krijgt altijd de ongewijzigde site. Zo weet u wat personalisatie toevoegde — en of het iets toevoegde." },
        { title: "Geen cookiebanner nodig", text: "De basis werkt zonder cookies en zonder profielopbouw. Verrijking zit achter instellingen die u zelf bepaalt." },
        { title: "No-code implementatie",   text: "Eén snippet in uw CMS en u bent live — geen developer nodig, geen IT-traject." },
      ],
    ),
  },
  {
    key:     "proof_cases",
    content: ci(
      "Hoe anderen het aanpakken",
      "Wat personalisatie oplevert hangt af van wie er binnenkomt en wat u ze te vertellen heeft. Dit zijn de patronen die we terugzien.",
      "Uit de praktijk",
      [
        { title: "Beginnen bij de hero",     text: "Eén blok, drie doelgroepen. Dat is waar het verschil het grootst is en de inspanning het kleinst — vandaar dat vrijwel iedereen daar start." },
        { title: "Herkennen op bedrijfsniveau", text: "Voor ABM telt niet de persoon maar het account: welk bedrijf zit achter het IP, en wat weet uw CRM daar al van." },
        { title: "Afrekenen met de controlegroep", text: "Zonder controlegroep weet u alleen dát er iets veranderde, niet of het hielp. Daarom staat die standaard aan." },
      ],
    ),
  },
  {
    key:     "proof_vision",
    content: ci(
      "De personalisatielaag die B2B-marketing miste",
      "Relevantie verhogen zonder third-party cookies en zonder IT-traject. Dat kon lang niet — daarom deed vrijwel niemand het.",
      "Waarom nu wel",
      [
        { title: "Cookievrije personalisatie", text: "Alle segmentering werkt op gedrag en context, niet op third-party data. Geen toestemming nodig om te beginnen." },
        { title: "Geen IT-traject vereist",    text: "Marketeers beheren de regels zelf. IT plaatst eenmalig de snippet — dat is alles." },
        { title: "Naast uw bestaande stack",   text: "Uw CMS blijft uw CMS, uw CRM blijft uw CRM. Wij vervangen niets; we bewegen mee met wat er al staat." },
      ],
    ),
  },
  {
    key:     "proof_platform",
    content: ci(
      "Uw bezoeker merkt er niets van",
      "De beslissing valt server-side, vóórdat de pagina wordt verstuurd. Geen tussenlaag die eerst iets anders laat zien.",
      "Zo werkt het onder de motorkap",
      [
        { title: "Geen flikkering",     text: "Personalisatie die in de browser draait toont eerst de standaardpagina en verbouwt die daarna. Hier ziet de bezoeker alleen het eindresultaat." },
        { title: "Geen extra laadtijd", text: "Er komt geen script bij dat moet wachten op een beslissing. Zoekmachines zien een gewone, snelle pagina." },
        { title: "AVG-first",           text: "De basis werkt zonder cookies en zonder profielopbouw. Bewaartermijnen en verwijderverzoeken zijn ingebouwd, niet bijgeschakeld." },
      ],
    ),
  },
  {
    key:     "proof_stats",
    content: ci(
      "Cijfers uit uw eigen site, niet uit een brochure",
      "Wij zetten hier geen gemiddelden neer die u toch niet kunt narekenen. Dit is wat u vanaf dag één zelf meet.",
      "Wat u gaat meten",
      [
        { title: "Lift ten opzichte van de controlegroep", text: "Het verschil tussen bezoekers die de aangepaste site zagen en die de gewone site zagen. Dat is uw werkelijke opbrengst." },
        { title: "Conversie per doelgroep",  text: "Per bron, per segment, per variant. Zo ziet u niet alleen dát het werkt, maar voor wie." },
        { title: "Wat er níét werkte",       text: "Varianten die onder de controlegroep presteren ziet u net zo goed. Dat is de helft van de waarde." },
      ],
    ),
  },
  {
    key:     "proof_reassurance",
    content: ci(
      "Personalisatie die u altijd onder controle houdt",
      "U bepaalt de regels. U goedkeurt de content. Wij zorgen voor de techniek — transparant en zonder black-box magie.",
      "Geen verrassingen",
      [
        { title: "U beheert de regels",        text: "Definieer zelf wanneer welke variant getoond wordt. Geen afhankelijkheid van een extern bureau of developer." },
        { title: "Volledige audit trail",      text: "Elke gepersonaliseerde weergave is terug te herleiden. U ziet precies welke variant wanneer aan wie getoond is." },
        { title: "Altijd terug te draaien",    text: "Zet een variant met één klik uit. De standaard content verschijnt direct — zonder cache-problemen." },
      ],
    ),
  },
  {
    key:     "proof_saas_default",
    content: ci(
      "SaaS-klanten zien 40% meer trial-aanmeldingen",
      "Door de juiste boodschap op het juiste moment onderscheidt uw platform zich en converteert beter dan concurrenten.",
      "SaaS-benchmarks",
      [
        { title: "+40% trial-aanmeldingen",  text: "SaaS-bedrijven die personaliseren op kanaal en intentie zien gemiddeld 40% meer proefaccounts per maand." },
        { title: "Kortere sales-cyclus",     text: "Bezoekers die relevante copy zien, zijn al halfwege overtuigd — uw salescyclus wordt meetbaar korter." },
        { title: "Hogere activatiegraad",    text: "Nieuwe gebruikers die via gepersonaliseerde hero binnenkomen, activeren vaker hun account in week één." },
      ],
    ),
  },
  {
    key:     "proof_saas_consideration",
    content: ci(
      "Bekijk use cases voor uw type SaaS-product",
      "Van developer-tools tot HR-software: Mister Chameleon past zich aan uw specifieke koopproces en doelgroep aan.",
      "Past het bij uw product?",
      [
        { title: "Developer-tools",      text: "Toon technische diepgang aan developers en een ROI-verhaal aan kopers — automatisch op basis van gedragssignalen." },
        { title: "HR- en work-tech",     text: "Personaliseer op rol (HR-manager vs. IT) en fase (oriëntatie vs. beslissing) zonder handmatige segmentatie." },
        { title: "Finance- en legal-SaaS", text: "Compliance en veiligheid voorop bij juridische beslissers; efficiency en integraties bij operationele gebruikers." },
      ],
    ),
  },
  {
    key:     "proof_saas_intent",
    content: ci(
      "Wie al weet wat hij zoekt, hoeft niet overtuigd te worden",
      "Een bezoeker die voor de derde keer terugkomt en de prijzen bekijkt, zit in een andere fase dan iemand die net binnenvalt. Uw pagina kan dat weten.",
      "Aansluiten op de fase",
      [
        { title: "Terugkeer telt mee",    text: "Hoe vaak iemand er was en waar hij naar keek, bepaalt of hij de introductie krijgt of meteen de casus en de prijs." },
        { title: "CTA volgt de intentie", text: "Wie oriënteert krijgt een gids; wie vergelijkt krijgt een gesprek. Dezelfde pagina, een andere uitnodiging." },
        { title: "Sales ziet het ook",    text: "Wat de bezoeker op de site deed, komt mee in uw CRM — zodat het gesprek niet bij nul begint." },
      ],
    ),
  },
  {
    key:     "proof_saas_reassurance",
    content: ci(
      "Wij personaliseren alleen op basis van wat werkt",
      "Geen giswerk. Geen black box. Iedere beslissing is traceerbaar en uitlegbaar aan uw hele team.",
      "Vertrouw op de data",
      [
        { title: "Beslissingen op basis van data",  text: "Alle regels zijn gebaseerd op bewezen patronen in uw eigen verkeer — niet op aannames of generieke segmenten." },
        { title: "Volledig transparant",            text: "U ziet welke regel getriggerd is, welke variant getoond is en wat het resultaat was — per bezoek." },
        { title: "Continu verbeterend",             text: "Het systeem leert van uw conversiedata en suggereert aanpassingen die uw team zelf kan goedkeuren." },
      ],
    ),
  },
  {
    key:     "proof_careers_default",
    content: ci(
      "Een bedrijf dat groeit — en u laat meegroeit",
      "Meer dan 40 collega's, een echte leeromgeving en de vrijheid om werk te doen dat ertoe doet.",
      "Werken bij ons",
      [
        { title: "40+ collega's",             text: "Een compact, hecht team van marketeers, engineers en productdenkers die allemaal eigenaarschap nemen." },
        { title: "Leer van de besten",        text: "Wekelijkse kennissessies, een ruim opleidingsbudget en directe toegang tot seniors die u echt helpen groeien." },
        { title: "Impact op dag één",         text: "Geen inwerkperiode van maanden. U werkt direct aan echte producten voor echte klanten — met echte verantwoordelijkheid." },
      ],
    ),
  },
  {
    key:     "proof_careers_team",
    content: ci(
      "Teamleden die net als u zijn begonnen",
      "Lees de verhalen van collega's die de stap maakten — en wat hen bindt aan Mister Chameleon.",
      "Ontmoet het team",
      [
        { title: "Van junior naar lead",       text: "Meerdere teamleden groeiden binnen twee jaar door van starter naar teamlead — zonder politiek, op basis van werk." },
        { title: "Divers en internationaal",   text: "Ons team komt uit acht landen. Verschillende achtergronden maken de beste producten." },
        { title: "Echte verhalen",             text: "Geen gladde employer-branding. Onze collega's vertellen eerlijk wat ze fijn vinden — en wat beter kan." },
      ],
    ),
  },
  {
    key:     "proof_careers_reassurance",
    content: ci(
      "U weet altijd waar u aan toe bent",
      "Geen lang wachten, geen vage feedback. We zijn eerlijk over de rol, de stappen en onze beslissing.",
      "Een fair sollicitatieproces",
      [
        { title: "Reactie binnen 3 werkdagen", text: "U hoort altijd van ons — ook als het antwoord nee is. Geen maanden wachten op een stilzwijgend afwijzing." },
        { title: "Twee gespreksrondes",        text: "Eén kennismaking en één inhoudelijk gesprek. Geen eindeloze assessment-carrousel of onbetaalde opdrachten." },
        { title: "Eerlijke feedback",          text: "Als wij nee zeggen, vertellen we waarom. Als u nee zegt, waarderen we dat evenzeer — respect werkt twee kanten op." },
      ],
    ),
  },
];

// ── CTA ───────────────────────────────────────────────────────────────────────

const ctaBlocks: SeedBlock[] = [
  {
    key:     "cta_default",
    content: c(
      "Ontdek wat personalisatie voor u kan doen",
      "Vraag een gratis demo aan en bekijk samen hoe uw website relevanter wordt voor iedere bezoeker.",
      "Eerste stap",
      [{ label: "Demo aanvragen", href: "/demo" }, { label: "Meer weten", href: "/over-ons" }],
    ),
  },
  {
    key:     "cta_guide",
    content: c(
      "Download de B2B personalisatie-gids",
      "Stap-voor-stap uitleg over hoe u uw website aanpast op verschillende bezoekersprofielen — gratis.",
      "Gratis gids",
      [{ label: "Download gratis", href: "/gids" }],
    ),
  },
  {
    key:     "cta_platform",
    content: c(
      "Start vandaag kosteloos met bouwen",
      "Maak een account aan en verken het platform in uw eigen tempo. Geen creditcard nodig.",
      "Gratis starten",
      [{ label: "Gratis account aanmaken", href: "/signup" }],
    ),
  },
  {
    key:     "cta_meeting",
    content: c(
      "Plan een 20-minuten kennismaking",
      "Kijk live hoe Mister Chameleon werkt — met uw eigen website als voorbeeld.",
      "Persoonlijk gesprek",
      [{ label: "Plan een demo", href: "/demo" }, { label: "Bel ons", href: "/contact" }],
    ),
  },
  {
    key:     "cta_demo",
    content: c(
      "Bekijk een gratis demo op uw eigen website",
      "We laten u in 30 minuten zien hoe personalisatie er voor uw bezoekers uitziet — volledig vrijblijvend.",
      "Live demo",
      [{ label: "Gratis demo bekijken", href: "/demo" }],
    ),
  },
  {
    key:     "cta_onboarding",
    content: c(
      "Start uw onboarding nu",
      "Volg de stappen en ga live met uw eerste personalisatieregel — vandaag nog.",
      "Aan de slag",
      [{ label: "Open onboarding", href: "/onboarding" }],
    ),
  },
  {
    key:     "cta_expansion",
    content: c(
      "Ontgrendel meer met uw plan",
      "Meer domeinen, meer segmenten, meer regels — bekijk welke uitbreidingen bij uw groei passen.",
      "Meer mogelijkheden",
      [{ label: "Bekijk uitbreidingen", href: "/pricing" }, { label: "Neem contact op", href: "/contact" }],
    ),
  },
  {
    key:     "cta_saas_default",
    content: c(
      "Leer hoe het werkt voor uw type product",
      "Zie hoe andere SaaS-bedrijven Mister Chameleon inzetten voor trial-optimalisatie en retentie.",
      "SaaS-klanten starten hier",
      [{ label: "Bekijk SaaS use cases", href: "/cases" }],
    ),
  },
  {
    key:     "cta_saas_demo",
    content: c(
      "Plan een productdemo voor uw SaaS-team",
      "We laten u live zien hoe het aansluit op uw trial-flow, onboarding en retentiestrategie.",
      "Demo boeken",
      [{ label: "Demo plannen", href: "/demo" }],
    ),
  },
  {
    key:     "cta_saas_trial",
    content: c(
      "Start uw gratis proefperiode",
      "14 dagen volledig toegang. Geen creditcard. Opzeggen met één klik.",
      "Gratis proberen",
      [{ label: "Start gratis trial", href: "/signup" }],
    ),
  },
  {
    key:     "cta_saas_onboarding",
    content: c(
      "Activeer uw eerste personalisatieregel",
      "Volg de onboarding wizard en zie binnen 30 minuten resultaat in uw eigen dashboard.",
      "Volgende stap",
      [{ label: "Open onboarding", href: "/onboarding" }],
    ),
  },
  {
    key:     "cta_saas_expansion",
    content: c(
      "Klaar voor meer? Bekijk uw uitbreidingsopties",
      "Meer domeinen, meer regels, meer segmenten — precies wat u nodig heeft voor de volgende groeifase.",
      "Schaal op",
      [{ label: "Bekijk uitbreidingen", href: "/pricing" }],
    ),
  },
  {
    key:     "cta_careers_browse",
    content: c(
      "Vind een rol die bij u past",
      "Bekijk alle open posities en filter op afdeling, locatie of ervaringsniveau.",
      "Vacatures bekijken",
      [{ label: "Bekijk vacatures", href: "/vacatures" }],
    ),
  },
  {
    key:     "cta_careers_apply",
    content: c(
      "Stuur uw sollicitatie in — het duurt 5 minuten",
      "Direct solliciteren via ons formulier. We nemen altijd persoonlijk contact op binnen twee werkdagen.",
      "Solliciteer nu",
      [{ label: "Solliciteer direct", href: "/solliciteren" }],
    ),
  },
  {
    key:     "cta_careers_open",
    content: c(
      "Geen passende vacature? Stuur een open sollicitatie",
      "We bewaren uw gegevens en nemen contact op zodra er een passende rol beschikbaar is.",
      "Geen passende vacature?",
      [{ label: "Open sollicitatie", href: "/open-sollicitatie" }],
    ),
  },
  {
    key:     "cta_careers_contact",
    content: c(
      "Wil u eerst meer weten?",
      "Neem contact op met ons recruitmentteam. We beantwoorden uw vragen graag en persoonlijk.",
      "Stel een vraag",
      [{ label: "Neem contact op", href: "/contact" }],
    ),
  },
];

// ── Feature ───────────────────────────────────────────────────────────────────

const featureBlocks: SeedBlock[] = [
  {
    key:     "feature_default",
    content: ci(
      "Alles wat u nodig heeft voor slimme personalisatie",
      "Van real-time segmentering tot content management — alle functies die B2B-groei ondersteunen, in één platform.",
      "Functies",
      [
        { title: "Real-time segmentering",  body: "Classificeer iedere bezoeker direct op basis van kanaal, gedrag en apparaat — zonder cookiemuur of log-in." },
        { title: "Visuele variant-editor",  body: "Stel hero, proof en CTA-varianten in via een no-code editor. Publiceer en test zonder uw developer lastig te vallen." },
        { title: "Webhooks & API",          body: "Koppel Mister Chameleon aan uw CRM, MAP of datalayer. Data stroomt automatisch van en naar uw bestaande tools." },
      ],
      [],
      { layoutVariant: "feature_grid" },
    ),
  },
  {
    key:     "feature_grid_primary",
    content: ci(
      "Alles wat u nodig heeft voor slimme personalisatie",
      "Van real-time segmentering tot content management — alle functies die B2B-groei ondersteunen, in één platform.",
      "Functies",
      [
        {
          title: "Real-time segmentering",
          body:  "Classificeer iedere bezoeker direct op basis van kanaal, gedrag en apparaat — zonder cookiemuur of log-in.",
          cta:   "Meer over segmentering",
          ctaHref: "/features#segmentering",
        },
        {
          title: "Visuele variant-editor",
          body:  "Stel hero, proof en CTA-varianten in via een no-code editor. Publiceer en test zonder uw developer lastig te vallen.",
          cta:   "Meer over de editor",
          ctaHref: "/features#editor",
        },
        {
          title: "Webhooks & API",
          body:  "Koppel Mister Chameleon aan uw CRM, MAP of datalayer. Data stroomt automatisch van en naar uw bestaande tools.",
          cta:   "Meer over integraties",
          ctaHref: "/features#integraties",
        },
      ],
    ),
  },
  {
    key:     "feature_highlights",
    content: ci(
      "De functies die het verschil maken",
      "Selectief en krachtig: de kerncapaciteiten van Mister Chameleon op een rij — voor marketeers en groeiteams.",
      "Kerncapaciteiten",
      [
        {
          title: "Regelgebaseerde personalisatie",
          body:  "Definieer zelf wanneer welke variant getoond wordt. Van simpele kanaalregels tot complexe gedragscondities — allemaal zonder code.",
        },
        {
          title: "A/B-testinfrastructuur",
          body:  "Test twee varianten tegelijk op een gecontroleerde steekproef. Bekijk statistisch significante resultaten direct in uw dashboard.",
        },
        {
          title: "Prestatie-inzichten",
          body:  "Zie per variant hoeveel bezoekers er doorheen gingen, hoeveel er converteerden en welke combinatie het best presteert.",
        },
      ],
    ),
  },
  {
    key:     "feature_comparison",
    content: ci(
      "Kies het plan dat bij uw groei past",
      "Vergelijk functies, limieten en prijzen van alle pakketten naast elkaar — zonder verborgen kosten.",
      "Vergelijk opties",
      [
        {
          title: "Starter",
          body:  "Tot 10.000 unieke bezoekers per maand. Eén domein, drie slots, no-code editor en standaard segmentregels. Ideaal om te starten.",
          cta:   "Kies Starter",
          ctaHref: "/pricing#starter",
        },
        {
          title: "Groei",
          body:  "Tot 100.000 bezoekers. Meerdere domeinen, A/B-testing, webhooks en prioriteitsondersteuning. Voor teams die serieus groeien.",
          cta:   "Kies Groei",
          ctaHref: "/pricing#groei",
        },
        {
          title: "Enterprise",
          body:  "Onbeperkt bezoekers, SLA-garantie, dedicated onboarding, SSO en audit-log. Maatwerk voor enterprise-omgevingen.",
          cta:   "Neem contact op",
          ctaHref: "/contact",
        },
      ],
    ),
  },
];

// ── Conversion ────────────────────────────────────────────────────────────────

const conversionBlocks: SeedBlock[] = [
  {
    key:     "conversion_default",
    content: c(
      "Start vandaag met bouwen",
      "Maak uw account aan en verken het platform — helemaal gratis, geen creditcard vereist.",
      "Aan de slag",
      [{ label: "Account aanmaken", href: "/signup" }, { label: "Plan een demo", href: "/demo" }],
      { layoutVariant: "default" },
    ),
  },
  {
    key:     "conversion_signup",
    content: c(
      "Start vandaag met bouwen",
      "Maak uw account aan en verken het platform — helemaal gratis, geen creditcard vereist.",
      "Gratis account aanmaken",
      [{ label: "Account aanmaken", href: "/signup" }],
    ),
  },
  {
    key:     "conversion_demo",
    content: c(
      "Plan een persoonlijke demo",
      "Onze experts laten u live zien hoe Mister Chameleon werkt met uw eigen website als uitgangspunt.",
      "Demo aanvragen",
      [{ label: "Demo plannen", href: "/demo" }],
    ),
  },
  {
    key:     "conversion_contact",
    content: c(
      "Stel uw vraag aan ons team",
      "We beantwoorden uw vragen snel en persoonlijk. U krijgt binnen één werkdag antwoord.",
      "Neem contact op",
      [{ label: "Stuur een bericht", href: "/contact" }],
    ),
  },
];

// ── Notification ──────────────────────────────────────────────────────────────

const notificationBlocks: SeedBlock[] = [
  {
    key:     "notification_default",
    content: c(
      "Mister Chameleon 2.0 is beschikbaar",
      "Ontdek de nieuwe functies in uw dashboard.",
      "Nieuw",
      [{ label: "Bekijk wat er nieuw is", href: "/changelog" }],
    ),
  },
  {
    key:     "notification_offer",
    content: c(
      "Start nu en ontvang 30 dagen gratis",
      "Tijdelijke aanbieding: geldig tot einde van de maand. Geen creditcard nodig.",
      "Tijdelijke aanbieding",
      [{ label: "Aanbieding benutten", href: "/signup" }],
    ),
  },
  {
    key:     "notification_urgency",
    content: c(
      "Nog 3 onboarding-sessies beschikbaar deze week",
      "Plan uw persoonlijke onboarding en ga live vóór het weekend.",
      "Beperkte plekken",
      [{ label: "Plan onboarding", href: "/demo" }],
    ),
  },
  {
    key:     "notification_returning",
    content: c(
      "Fijn dat u er weer bent",
      "Er zijn updates voor uw account. Bekijk wat er nieuw is.",
      "Welkom terug",
      [{ label: "Bekijk updates", href: "/dashboard" }],
    ),
  },
];

// ── All seed blocks combined ──────────────────────────────────────────────────

export const ALL_SEED_BLOCKS: SeedBlock[] = [
  ...heroBlocks,
  ...proofBlocks,
  ...ctaBlocks,
  ...featureBlocks,
  ...conversionBlocks,
  ...notificationBlocks,
];

// ── Seed function ─────────────────────────────────────────────────────────────

export interface SeedResult {
  ok:       boolean;
  inserted: number;
  skipped:  number;
  errors:   string[];
}

/**
 * Upsert all seed blocks into adaptive_blocks (tenant_id = null).
 *
 * Uses upsert semantics: existing rows are updated, new rows are inserted.
 * Safe to run multiple times.
 *
 * @param overwrite  When false (default), skip keys that already have a row.
 *                   When true, overwrite existing content and adaptive variants.
 */
export async function seedPlatformBlocks(overwrite = false): Promise<SeedResult> {
  const result: SeedResult = { ok: true, inserted: 0, skipped: 0, errors: [] };

  // Fetch existing keys to honour the overwrite flag
  const { listPlatformBlocks } = await import("./adaptive-blocks-store");
  const existing = await listPlatformBlocks();
  const existingKeys = new Set(existing.map((b) => b.key));

  for (const seed of ALL_SEED_BLOCKS) {
    if (!overwrite && existingKeys.has(seed.key)) {
      result.skipped++;
      continue;
    }

    const upserted = await upsertAdaptiveBlock({
      key:              seed.key,
      tenantId:         null,       // platform-wide
      isActive:         true,
      defaultVariant:   {
        ...seed.content,
        // Ship complete AI/Decision signals so the block is AI-selectable.
        decisionMeta: seed.content.decisionMeta ?? deriveDecisionMeta(seed.key),
      },
      adaptiveVariants: [],
    });

    if (upserted.ok) {
      result.inserted++;
    } else {
      result.errors.push(`${seed.key}: ${upserted.error}`);
      result.ok = false;
    }
  }

  return result;
}

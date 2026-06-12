"use client";

/**
 * ThemeWebPreview — 4 visually + structurally distinct layout profiles
 * across 18 page templates.
 *
 *   corporate  — Georgia serif, 0-radius cards, thin borders, gray alt-sections
 *   tech       — dark panels, dot-grid texture, monospace "// labels", pill tags
 *   editorial  — warm paper, big serif headings, pull quotes, ✦ dividers
 *   energetic  — diagonal clip-path, 900-weight, pill buttons, bold primary fills
 */

import { useState }               from "react";
import { NavBar }                  from "@/components/layout/NavBar";
import { FooterCorporate }         from "@/components/layout/footer/FooterCorporate";
import { FooterMinimal }           from "@/components/layout/footer/FooterMinimal";
import { FooterBranding }          from "@/components/layout/footer/FooterBranding";
import { HeroBlock }               from "@/components/blocks/HeroBlock";
import { CTABlock }                from "@/components/blocks/CTABlock";
import { ProofBlock }              from "@/components/blocks/ProofBlock";
import { AboutBlock }              from "@/components/blocks/sections/AboutBlock";
import { ArticleBodyBlock }        from "@/components/blocks/sections/ArticleBodyBlock";
import { ArticleMetaBlock }        from "@/components/blocks/sections/ArticleMetaBlock";
import { CartSummaryBlock }        from "@/components/blocks/sections/CartSummaryBlock";
import { CheckoutBlock }           from "@/components/blocks/sections/CheckoutBlock";
import { ContactSectionBlock }     from "@/components/blocks/sections/ContactSectionBlock";
import { ContentSectionBlock }     from "@/components/blocks/sections/ContentSectionBlock";
import { FaqSectionBlock }         from "@/components/blocks/sections/FaqSectionBlock";
import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { FilterBarBlock }          from "@/components/blocks/sections/FilterBarBlock";
import { FormSectionBlock }        from "@/components/blocks/sections/FormSectionBlock";
import { ListingBlock }            from "@/components/blocks/sections/ListingBlock";
import { LogoStripBlock }          from "@/components/blocks/sections/LogoStripBlock";
import { MapBlock }                from "@/components/blocks/sections/MapBlock";
import { NewsListBlock }           from "@/components/blocks/sections/NewsListBlock";
import { PricingSectionBlock }     from "@/components/blocks/sections/PricingSectionBlock";
import { ProcessStepsBlock }       from "@/components/blocks/sections/ProcessStepsBlock";
import { ProductDetailBlock }      from "@/components/blocks/sections/ProductDetailBlock";
import { ProductOverviewBlock }    from "@/components/blocks/sections/ProductOverviewBlock";
import { QuickLinksBlock }         from "@/components/blocks/sections/QuickLinksBlock";
import { RecruiterPanelBlock }     from "@/components/blocks/sections/RecruiterPanelBlock";
import { RelatedContentBlock }     from "@/components/blocks/sections/RelatedContentBlock";
import { SearchBlock }             from "@/components/blocks/sections/SearchBlock";
import { StatsBlock }              from "@/components/blocks/sections/StatsBlock";
import { TeamSectionBlock }        from "@/components/blocks/sections/TeamSectionBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";
import { TextMediaBlock }          from "@/components/blocks/sections/TextMediaBlock";
import { TimelineBlock }           from "@/components/blocks/sections/TimelineBlock";
import { VacancyMetaBlock }        from "@/components/blocks/sections/VacancyMetaBlock";
import { ApplyPanelBlock }          from "@/components/blocks/sections/ApplyPanelBlock";
import type { NavigationItemData, FooterColumnData, SocialLinkData } from "@/cms/types";

// ── Profile ───────────────────────────────────────────────────────────────────
type P = "corporate" | "tech" | "editorial" | "energetic" | "werkenbij";

const PROFILE_MAP: Record<string, P> = {
  "corporate-blue": "corporate", "corporate-trust": "corporate", "corporate-clean": "corporate",
  "clean-corporate": "corporate", "healthcare-calm": "corporate", "warm-professional": "corporate",
  "modern-saas": "tech", "tech-indigo": "tech", "modern-green": "tech",
  "dark-contrast": "tech", "modern-dark": "tech", "dark-ai": "tech", "structured-saas": "tech",
  "premium-editorial": "editorial", "editorial-classic": "editorial",
  "portfolio-showcase": "editorial", "premium-luxury": "editorial", "minimal-neutral": "editorial",
  "bold-dark": "energetic", "bold-marketing": "energetic", "startup-energy": "energetic",
  "playful-startup": "energetic", "recruitment-energy": "energetic", "careers-human": "energetic",
  "industrial-strong": "energetic", "valentine-pink": "energetic", "dutch-orange": "energetic",
  // ── Client-type blueprints ────────────────────────────────────────────────
  "werkenbij-blueprint":      "werkenbij",  // WorkScout style — search hero, vacature cards, culture, perks
  "corporate-b2b-blueprint":  "corporate",  // professional B2B — split hero, services table, authority
  "saas-blueprint":           "tech",       // product-led SaaS — dark, dot-grid, browser mockup
};
const getProfile = (k: string): P => PROFILE_MAP[k] ?? "corporate";
const pic = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

// ── Nav / footer data ─────────────────────────────────────────────────────────

// Rich nav with dropdown children (used for mega / grid variants)
const NAV_RICH: NavigationItemData[] = [
  { id: "home",      label: "Home",      href: "#home" },
  { id: "about",     label: "Over ons",  href: "#over-ons",  children: [
    { id: "team",    label: "Ons team",       href: "#team",    description: "Maak kennis met onze mensen" },
    { id: "mission", label: "Missie & visie", href: "#missie",  description: "Waar we voor staan" },
    { id: "history", label: "Onze geschiedenis", href: "#history", description: "15 jaar digitale groei" },
  ]},
  { id: "services",  label: "Diensten",  href: "#diensten",  children: [
    { id: "s1", label: "Strategie & advies",   href: "#strategie",     description: "Van vraagstuk naar aanpak" },
    { id: "s2", label: "Implementatie",         href: "#implementatie", description: "Bouwen en uitrollen" },
    { id: "s3", label: "Data & analytics",      href: "#data",          description: "Inzichten die groeien" },
    { id: "s4", label: "Content & creatie",     href: "#content",       description: "Verhalen die converteren" },
    { id: "s5", label: "Beheer & support",      href: "#beheer",        description: "Na de livegang" },
  ]},
  { id: "cases",     label: "Cases",     href: "#cases" },
  { id: "blog",      label: "Blog",      href: "#blog" },
  { id: "vacatures", label: "Vacatures", href: "#vacatures" },
  { id: "contact",   label: "Contact",   href: "#contact" },
];

// Minimal nav (editorial + energetic)
const NAV: NavigationItemData[] = [
  { id: "home",      label: "Home",      href: "#home" },
  { id: "about",     label: "Over ons",  href: "#over-ons",  children: [
    { id: "team",    label: "Ons team",       href: "#team",    description: "Maak kennis met onze mensen" },
    { id: "mission", label: "Missie & visie", href: "#missie",  description: "Waar we voor staan" },
  ]},
  { id: "services",  label: "Diensten",  href: "#diensten",  children: [
    { id: "s1", label: "Strategie & advies",  href: "#strategie",    description: "Van vraagstuk naar aanpak" },
    { id: "s2", label: "Implementatie",        href: "#implementatie", description: "Bouwen en uitrollen" },
    { id: "s3", label: "Beheer & support",     href: "#beheer",        description: "Na de livegang" },
  ]},
  { id: "blog",      label: "Blog",      href: "#blog" },
  { id: "vacatures", label: "Vacatures", href: "#vacatures" },
  { id: "contact",   label: "Contact",   href: "#contact" },
];

// Werkenbij nav — employer brand / job board focused
const NAV_WERKENBIJ: NavigationItemData[] = [
  { id: "wb-home",     label: "Werkenbij",  href: "#home" },
  { id: "wb-vac",      label: "Vacatures",  href: "#vacatures" },
  { id: "wb-cultuur",  label: "Cultuur",    href: "#cultuur" },
  { id: "wb-team",     label: "Team",       href: "#team" },
  { id: "wb-over",     label: "Over ons",   href: "#over-ons" },
  { id: "wb-contact",  label: "Contact",    href: "#contact" },
];

const FOOTER_COLS: FooterColumnData[] = [
  { title: "Bedrijf",  links: [{ label: "Over ons", href: "#" }, { label: "Team", href: "#" }, { label: "Vacatures", href: "#" }, { label: "Pers", href: "#" }] },
  { title: "Diensten", links: [{ label: "Strategie", href: "#" }, { label: "Implementatie", href: "#" }, { label: "Data", href: "#" }, { label: "Support", href: "#" }] },
  { title: "Kennis",   links: [{ label: "Blog", href: "#" }, { label: "Cases", href: "#" }, { label: "Agenda", href: "#" }, { label: "Downloads", href: "#" }] },
  { title: "Contact",  links: [{ label: "Neem contact op", href: "#" }, { label: "Privacy", href: "#" }, { label: "Voorwaarden", href: "#" }] },
];
const FOOTER_NAV: NavigationItemData[] = [
  { id: "f1", label: "Over ons",    href: "#over-ons" },
  { id: "f2", label: "Diensten",    href: "#diensten" },
  { id: "f3", label: "Blog",        href: "#blog" },
  { id: "f4", label: "Vacatures",   href: "#vacatures" },
  { id: "f5", label: "Privacy",     href: "#privacy" },
  { id: "f6", label: "Voorwaarden", href: "#voorwaarden" },
];
const SOCIAL: SocialLinkData[] = [
  { label: "LinkedIn",  url: "#linkedin" },
  { label: "Instagram", url: "#instagram" },
  { label: "Facebook",  url: "#facebook" },
  { label: "X",         url: "#x" },
];

// ── Profile-specific header & footer ─────────────────────────────────────────

function ProfileHeader({ p }: { p: P }) {
  // Corporate: compact flyout nav, understated header
  if (p === "corporate") return (
    <NavBar items={NAV_RICH} navVariant="flyout" navDensity="compact" />
  );
  // Tech: full mega menu, comfortable density, SaaS family
  if (p === "tech") return (
    <NavBar items={NAV_RICH} navVariant="mega" navDensity="comfortable" navFamily="modern-saas" />
  );
  // Editorial: newspaper-style top bar above centered minimal nav
  if (p === "editorial") return (
    <header>
      <div style={{ borderBottom: "1px solid var(--border)", padding: "0.5rem 0", background: "var(--section-subtle-bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: GEO, fontStyle: "italic" }}>Digitaal bureau &amp; contentstudio</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>hallo@misterchameleon.nl · +31 20 123 4567</span>
        </div>
      </div>
      <div style={{ borderBottom: "3px solid var(--text)", padding: "1.5rem 2rem 0", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center", marginBottom: "1rem" }}>
          <div style={{ fontFamily: GEO, fontSize: "clamp(1.5rem,3vw,2.25rem)", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text)", textTransform: "uppercase" as const }}>Mister Chameleon</div>
        </div>
        <NavBar items={NAV} navVariant="flyout" navDensity="comfortable" />
      </div>
    </header>
  );
  // Werkenbij: clean white header with employer-brand nav + "Werken bij ons" CTA
  if (p === "werkenbij") return (
    <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky" as const, top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: fH, fontSize: "1.125rem", fontWeight: 800, color: "var(--primary)", padding: "1rem 0", letterSpacing: "-0.01em" }}>Werkenbij MC</span>
        <NavBar items={NAV_WERKENBIJ} navVariant="flyout" navDensity="comfortable" />
        <span style={{ ...btnS(p), fontSize: 12, padding: "0.5rem 1.25rem", whiteSpace: "nowrap" as const }}>Bekijk vacatures</span>
      </div>
    </div>
  );
  // Energetic: sticky primary-colored header with bold CTA
  return (
    <div style={{ background: "var(--bg)", borderBottom: "3px solid var(--primary)", position: "sticky" as const, top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: fH, fontSize: "1.25rem", fontWeight: 900, color: "var(--primary)", padding: "1rem 0", letterSpacing: "-0.02em", textTransform: "uppercase" as const }}>MC</span>
        <NavBar items={NAV} navVariant="flyout" navDensity="compact" />
        <span style={{ ...btnS(p), fontSize: 12, padding: "0.5rem 1.25rem", whiteSpace: "nowrap" as const }}>START NU →</span>
      </div>
    </div>
  );
}

function ProfileFooter({ p }: { p: P }) {
  const yr = new Date().getFullYear();
  if (p === "corporate") return (
    <FooterCorporate siteTitle="Mister Chameleon" logoUrl={null} logoAlt="MC" footerNav={FOOTER_NAV} footerColumns={FOOTER_COLS} socialLinks={SOCIAL} contactEmail="hallo@misterchameleon.nl" contactPhone="+31 20 123 4567" year={yr} density="comfortable" />
  );
  if (p === "tech") return (
    <FooterCorporate siteTitle="Mister Chameleon" logoUrl={null} logoAlt="MC" footerNav={FOOTER_NAV} footerColumns={FOOTER_COLS} socialLinks={SOCIAL} contactEmail="hallo@misterchameleon.nl" year={yr} density="spacious" />
  );
  if (p === "editorial") return (
    <FooterMinimal siteTitle="Mister Chameleon" logoUrl={null} logoAlt="MC" footerNav={FOOTER_NAV} year={yr} density="spacious" />
  );
  if (p === "werkenbij") return (
    <FooterBranding siteTitle="Werkenbij MC" logoUrl={null} logoAlt="MC" footerNav={[
      { id: "f1", label: "Vacatures",       href: "#vacatures" },
      { id: "f2", label: "Cultuur",         href: "#cultuur" },
      { id: "f3", label: "Team",            href: "#team" },
      { id: "f4", label: "Over ons",        href: "#over-ons" },
      { id: "f5", label: "Privacy",         href: "#privacy" },
      { id: "f6", label: "Open sollicitatie", href: "#contact" },
    ]} socialLinks={SOCIAL} year={yr} density="comfortable" />
  );
  return (
    <FooterBranding siteTitle="Mister Chameleon" logoUrl={null} logoAlt="MC" footerNav={FOOTER_NAV} socialLinks={SOCIAL} year={yr} density="comfortable" />
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "home",           label: "Homepage" },
  { id: "over-ons",       label: "Over ons" },
  { id: "diensten",       label: "Diensten" },
  { id: "dienst-detail",  label: "Dienst detail" },
  { id: "blog-list",      label: "Blog" },
  { id: "blog-detail",    label: "Blog artikel" },
  { id: "jobs-list",      label: "Vacatures" },
  { id: "jobs-detail",    label: "Vacature detail" },
  { id: "contact",        label: "Contact" },
  { id: "agenda",         label: "Agenda" },
  { id: "event-detail",   label: "Event detail" },
  { id: "producten",      label: "Producten" },
  { id: "product-detail", label: "Product" },
  { id: "winkelwagen",    label: "Winkelwagen" },
  { id: "checkout",       label: "Checkout" },
  { id: "landingspagina", label: "Landingspagina" },
  { id: "prijzen",        label: "Prijzen" },
  { id: "zoeken",         label: "Zoeken" },
] as const;
type PageId = (typeof TABS)[number]["id"];

// ── Profile-aware primitives ──────────────────────────────────────────────────
const fH = "var(--font-heading, system-ui, sans-serif)";
const GEO = "Georgia, 'Times New Roman', serif";

// Section backgrounds — always use theme CSS variables so any preset looks right.
// Profile controls *which* token to use (bg vs bg-subtle vs bg-inverse), not the
// actual colour value.
function sectBg(p: P, alt = false): string {
  if (p === "corporate") return alt ? "var(--section-subtle-bg)" : "var(--bg)";
  if (p === "tech")      return alt ? "var(--bg-subtle)"         : "var(--bg)";
  if (p === "editorial") return alt ? "var(--bg)"                : "var(--section-subtle-bg)";
  if (p === "werkenbij") return alt ? "var(--section-subtle-bg)" : "var(--bg)";
  // energetic
  return alt ? "var(--bg)" : "var(--bg)";
}

// Card styles — structure (radius, shadow, border style) from profile,
// colours from CSS variables so every theme preset renders correctly.
function cardS(p: P): React.CSSProperties {
  if (p === "corporate") return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 0, overflow: "hidden" };
  if (p === "tech")      return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "var(--radius-card, 6px)", overflow: "hidden" };
  if (p === "editorial") return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, overflow: "hidden" };
  if (p === "werkenbij") return { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" };
  // energetic — shadow instead of border
  return { background: "var(--card-bg)", border: "none", borderRadius: 20, overflow: "hidden", boxShadow: "var(--card-shadow, 0 6px 28px rgba(0,0,0,0.09))" };
}

// Headings — font-family and weight from profile, colour from CSS variable.
function headS(p: P, sz: "xl" | "lg" | "md" = "lg"): React.CSSProperties {
  const s = { xl: "clamp(2.5rem,5vw,3.75rem)", lg: "clamp(1.875rem,3vw,2.5rem)", md: "clamp(1.25rem,2vw,1.625rem)" }[sz];
  if (p === "corporate") return { fontFamily: GEO, fontSize: s, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 };
  if (p === "tech")      return { fontFamily: fH,  fontSize: s, fontWeight: 800, color: "var(--text)", lineHeight: 1.1, letterSpacing: "-0.025em" };
  if (p === "editorial") return { fontFamily: GEO, fontSize: s, fontWeight: 700, color: "var(--text)", lineHeight: 1.15 };
  if (p === "werkenbij") return { fontFamily: fH,  fontSize: s, fontWeight: 800, color: "var(--text)", lineHeight: 1.15, letterSpacing: "-0.02em" };
  return { fontFamily: fH, fontSize: s, fontWeight: 900, color: "var(--text)", lineHeight: 1.0, letterSpacing: "-0.03em" };
}

// Eyebrow labels — structure from profile, colours from CSS variables.
function eyeS(p: P): React.CSSProperties {
  if (p === "corporate") return { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.12em", borderLeft: "3px solid var(--primary)", paddingLeft: 8 };
  if (p === "tech")      return { fontFamily: "monospace", fontSize: 12, color: "var(--primary)", letterSpacing: "0.03em" };
  if (p === "editorial") return { fontFamily: GEO, fontStyle: "italic" as const, fontSize: 14, color: "var(--primary)" };
  if (p === "werkenbij") return { fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.1em" };
  return { fontSize: 10, fontWeight: 900, color: "var(--btn-text, #fff)", background: "var(--primary)", padding: "3px 12px", borderRadius: 100, textTransform: "uppercase" as const, letterSpacing: "0.1em", display: "inline-block" as const };
}

// Buttons — shape from profile (radius, weight, caps), colours always from vars.
function btnS(p: P): React.CSSProperties {
  const base: React.CSSProperties = { display: "inline-block", padding: "0.7rem 1.75rem", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "var(--btn-bg, var(--primary))", color: "var(--btn-text, #fff)" };
  if (p === "corporate") return { ...base, borderRadius: 2, letterSpacing: "0.04em", border: "1px solid var(--primary)" };
  if (p === "tech")      return { ...base, borderRadius: "var(--radius-interactive, 6px)" };
  if (p === "editorial") return { ...base, borderRadius: 100, paddingLeft: "2.25rem", paddingRight: "2.25rem" };
  if (p === "werkenbij") return { ...base, borderRadius: 8, fontWeight: 600, letterSpacing: "0.01em" };
  return { ...base, borderRadius: 100, fontWeight: 900, textTransform: "uppercase" as const, letterSpacing: "0.08em" };
}

// Wrap: profile-aware section container
function W({ children, bg, py = "4rem", dot }: { children: React.ReactNode; bg?: string; py?: string; dot?: boolean }) {
  const dotBg = dot ? { backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "20px 20px" } : {};
  return (
    <section style={{ background: bg ?? "var(--bg)", padding: `${py} 0`, ...dotBg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>{children}</div>
    </section>
  );
}

// Section heading
function SH({ eyebrow, title, sub, align = "center", p }: { eyebrow?: string; title: string; sub?: string; align?: "center" | "left"; p: P }) {
  
  const subC = "var(--text-muted)";
  const ey = eyebrow ? (p === "tech" ? `// ${eyebrow}` : eyebrow) : undefined;
  return (
    <div style={{ textAlign: align, marginBottom: "2.5rem" }}>
      {ey && <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>{ey}</div>}
      <h2 style={headS(p, "lg")}>{title}</h2>
      {sub && <p style={{ fontSize: "1rem", color: subC, maxWidth: 560, margin: align === "center" ? "0.75rem auto 0" : "0.75rem 0 0", lineHeight: 1.65 }}>{sub}</p>}
    </div>
  );
}

// Divider
function Div({ p }: { p: P }) {
  if (p === "corporate") return <div style={{ borderTop: "1px solid #dee2e6" }} />;
  if (p === "tech")      return null;
  if (p === "editorial") return <div style={{ textAlign: "center", color: "var(--primary)", fontSize: 18, letterSpacing: "0.55em", padding: "0.25rem 0", opacity: 0.55 }}>✦ ✦ ✦</div>;
  if (p === "werkenbij") return <div style={{ borderTop: "1px solid var(--border)" }} />;
  return <div style={{ height: 4, background: "var(--primary)" }} />;
}

// Profile-aware primary button
function Btn({ children, p }: { children: React.ReactNode; p: P }) {
  return <span style={btnS(p)}>{children}</span>;
}

// Card wrapper
function Card({ children, p, style = {} }: { children: React.ReactNode; p: P; style?: React.CSSProperties }) {
  return <div style={{ ...cardS(p), ...style }}>{children}</div>;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const ARTICLES = [
  { seed: "art-1", cat: "Strategie",   title: "5 trends die uw sector in 2025 bepalen",       excerpt: "Een diepgaande analyse van de ontwikkelingen die de komende jaren bepalend zijn.", date: "12 mei 2025", read: "8 min" },
  { seed: "art-2", cat: "Technologie", title: "AI in de praktijk: van hype naar waarde",       excerpt: "Hoe organisaties AI succesvol inzetten zonder de valkuilen.", date: "8 mei 2025", read: "6 min" },
  { seed: "art-3", cat: "Leiderschap", title: "Verandering managen in onzekere tijden",        excerpt: "Handvatten voor leidinggevenden die hun team meenemen in transformatie.", date: "3 mei 2025", read: "10 min" },
  { seed: "art-4", cat: "Klantcase",   title: "Hoe Bedrijf X de conversie verdubbelde",       excerpt: "Een kijkje achter de schermen van een succesvolle optimalisatie.", date: "28 apr 2025", read: "5 min" },
  { seed: "art-5", cat: "Strategie",   title: "Data-gedreven werken: waar te beginnen",        excerpt: "Praktische eerste stappen voor organisaties die serieus willen starten.", date: "22 apr 2025", read: "7 min" },
  { seed: "art-6", cat: "Technologie", title: "De toekomst van klantcommunicatie",             excerpt: "Personalisatie op schaal: wat werkt echt en wat is overrated?", date: "17 apr 2025", read: "9 min" },
];
const JOBS = [
  { seed: "job-1", title: "Frontend Developer",     dept: "Technologie", loc: "Amsterdam",   type: "Full-time", level: "Medior", sal: "€3.500–€5.000" },
  { seed: "job-2", title: "UX/UI Designer",          dept: "Design",      loc: "Remote",      type: "Full-time", level: "Medior", sal: "€3.000–€4.500" },
  { seed: "job-3", title: "Project Manager Digital", dept: "Projecten",   loc: "Amsterdam",   type: "Full-time", level: "Senior", sal: "€4.500–€6.500" },
  { seed: "job-4", title: "Content Strateeg",        dept: "Marketing",   loc: "Hybrid",      type: "Full-time", level: "Junior", sal: "€2.800–€3.800" },
  { seed: "job-5", title: "Data Analyst",            dept: "Data",        loc: "Amsterdam",   type: "Full-time", level: "Medior", sal: "€3.800–€5.500" },
];
const EVENTS = [
  { seed: "ev1", day: "22", mon: "MEI",  title: "Workshop: Data-gedreven besluitvorming",    loc: "Amsterdam",  time: "09:00–13:00", spots: "Nog 8 plekken",    featured: true  },
  { seed: "ev2", day: "28", mon: "MEI",  title: "Webinar: AI voor managers",                 loc: "Online",     time: "15:00–16:30", spots: "Vrij toegankelijk", featured: false },
  { seed: "ev3", day: "31", mon: "MEI",  title: "Networking: Digital Leaders Dinner",        loc: "Rotterdam",  time: "18:30–22:00", spots: "Nog 12 plekken",   featured: true  },
  { seed: "ev4", day: "12", mon: "JUN",  title: "Masterclass: Customer Experience 2025",     loc: "Online",     time: "11:00–12:30", spots: "Vrij toegankelijk", featured: false },
  { seed: "ev5", day: "19", mon: "JUN",  title: "Congres: Digitale Transformatie Nederland", loc: "Utrecht",    time: "09:00–18:00", spots: "Nog 25 plekken",   featured: true  },
];
const TEAM_MEMBERS = [
  { name: "Marie van den Berg", role: "CEO & Oprichter", bio: "Wij geloven dat elke organisatie de technologie verdient die bij hen past.", imageUrl: pic("team-ceo", 300, 300) },
  { name: "Tom Bakker",          role: "CTO",             bio: "Technologie is pas waardevol als het écht gebruikt wordt door mensen.",       imageUrl: pic("team-cto", 300, 300) },
  { name: "Lisa Smit",           role: "Head of Design",  bio: "Goed design lost problemen op voordat gebruikers ze tegenkomen.",             imageUrl: pic("team-des", 300, 300) },
  { name: "Pieter Janssen",      role: "Lead Developer",  bio: "Code is communicatie — met computers én met collega's.",                      imageUrl: pic("team-dev", 300, 300) },
];

// ── Shared block data ─────────────────────────────────────────────────────────
const STATS_DATA = {
  heading: "Onze impact in cijfers",
  items: [{ value: "200+", label: "Afgeronde projecten" }, { value: "15 jr", label: "Ervaring" }, { value: "98%", label: "Klanttevredenheid" }, { value: "35", label: "Collega's" }],
};
const FEATURES_DATA = {
  heading: "Wat wij voor u doen",
  features: [
    { title: "Strategie & advies",  description: "Van vraagstuk naar een helder plan.",   icon: "strategy"  },
    { title: "Implementatie",        description: "Van plan naar werkende oplossing.",      icon: "code"      },
    { title: "Content & creatie",    description: "Verhalen die raken en converteren.",     icon: "edit"      },
    { title: "Data & analytics",     description: "Inzichten die uw groei versnellen.",     icon: "chart"     },
    { title: "Beheer & support",     description: "Continuïteit na de livegang.",           icon: "shield"    },
    { title: "Training & workshops", description: "Kennis die intern blijft groeien.",      icon: "book"      },
  ],
  cta: { label: "Bekijk alle diensten", href: "#" },
};
const LOGOS_DATA: import("@/page-config").LogoStripBlockData = {
  heading: "Vertrouwd door",
  logos: [],
  animationEnabled: true,
  grayscale: true,
};
const TESTIMONIALS_DATA = {
  heading: "Wat onze klanten zeggen",
  testimonials: [
    { quote: "Dankzij hun aanpak hebben we onze conversie in zes maanden met 40% verhoogd.", author: "Anke de Vries",   company: "CEO, TechCorp NL" },
    { quote: "Ze denken mee als strategisch partner, niet alleen als uitvoerende partij.",    author: "Mark Jansen",    company: "Directeur, GrowthLab" },
    { quote: "De snelheid, kwaliteit én communicatie zijn echt op een ander niveau.",         author: "Sophie Bakker",  company: "CMO, ScaleUp BV" },
  ],
};
const TEAM_SECTION_DATA = {
  heading: "Het team",
  intro: "Een diverse groep professionals die zich dagelijks inzet voor uw succes.",
  members: TEAM_MEMBERS.map(m => ({ name: m.name, role: m.role, bio: m.bio, imageUrl: m.imageUrl })),
};
const PROCESS_DATA = {
  heading: "Hoe wij werken",
  steps: [
    { title: "Intake & verkenning",   description: "We leren uw organisatie, doelen en uitdagingen kennen.", duration: "Week 1"    },
    { title: "Strategie & ontwerp",   description: "We vertalen inzichten naar een helder plan en prototype.", duration: "Week 2–3"  },
    { title: "Bouwen & testen",       description: "Iteratief ontwikkelen met doorlopende feedback.",          duration: "Week 4–8"  },
    { title: "Lancering & overdracht",description: "Live gaan, training en kennisoverdracht aan uw team.",    duration: "Week 9–10" },
  ],
};
const FAQ_DATA = {
  heading: "Veelgestelde vragen",
  items: [
    { question: "Hoe lang duurt een gemiddeld project?",            answer: "De doorlooptijd hangt af van scope, maar een gemiddeld project duurt 6–12 weken." },
    { question: "Werken jullie met vaste prijzen of uurprijzen?",   answer: "We werken in de meeste gevallen met vaste projectprijzen, zodat u vooraf weet waar u aan toe bent." },
    { question: "Kunnen we na de livegang op jullie rekenen?",      answer: "Ja. We bieden flexibele beheer- en supportcontracten na elke oplevering." },
    { question: "Voor welke sectoren werken jullie?",               answer: "We zijn actief in B2B, SaaS, professionele dienstverlening, zorg en overheid." },
  ],
};
const TIMELINE_DATA = {
  heading: "Onze geschiedenis",
  items: [
    { id: "t1", title: "Oprichting",          date: "2009", description: "Gestart als klein webbureau met grote ambities." },
    { id: "t2", title: "Eerste grote klant",  date: "2012", description: "Eerste enterprise-opdracht; team groeit naar 8 mensen." },
    { id: "t3", title: "Strategie-tak",       date: "2016", description: "Uitbreiding naar strategisch advies naast techniek." },
    { id: "t4", title: "Platform-focus",      date: "2022", description: "Lancering van ons eigen contextuele communicatieplatform." },
  ],
};
const PRICING_DATA = {
  heading: "Transparante tarieven",
  tiers: [
    { name: "Starter",    price: "€2.950",       period: "eenmalig", description: "Ideaal voor starters en kleine teams.", features: ["Professionele website", "CMS-koppeling", "3 maanden support", "SEO-basis"], ctaLabel: "Begin vandaag",   ctaHref: "#", highlighted: false },
    { name: "Growth",     price: "€7.500",       period: "eenmalig", description: "Voor groeiende organisaties.",          features: ["Alles van Starter", "Maatwerk design", "Analytics dashboard", "Contenttraining", "12 maanden support"], ctaLabel: "Kies Growth",    ctaHref: "#", highlighted: true,  badge: "Meest gekozen" },
    { name: "Enterprise", price: "Op maat",      period: "",         description: "Voor complexe, schaalbare trajecten.",  features: ["Alles van Growth", "Dedicated team", "SLA-garantie", "CRM-integraties", "Doorlopend advies"], ctaLabel: "Neem contact op", ctaHref: "#", highlighted: false },
  ],
};
const RELATED_ARTICLES = {
  heading: "Meer lezen",
  items: ARTICLES.slice(0, 3).map((a, i) => ({
    id: String(i), title: a.title, href: "#", excerpt: a.excerpt,
    imageUrl: pic(a.seed, 400, 260), category: a.cat, date: a.date,
  })),
};
const LISTING_JOBS = {
  heading: "Openstaande vacatures",
  items: JOBS.map(j => ({
    id: j.seed, title: j.title, href: "#", category: j.dept,
    meta: [{ label: "Locatie", value: j.loc }, { label: "Type", value: j.type }, { label: "Niveau", value: j.level }],
  })),
};
const LISTING_EVENTS = {
  heading: "Aankomende events",
  items: EVENTS.map(e => ({
    id: e.seed, title: e.title, href: "#", category: e.loc,
    meta: [{ label: "Datum", value: `${e.day} ${e.mon}` }, { label: "Tijd", value: e.time }, { label: "Beschikbaarheid", value: e.spots }],
  })),
};
const FILTER_CATS = {
  placeholder: "Zoek...",
  categories: [
    { label: "Alle categorieën", value: "all" },
    { label: "Strategie",        value: "strategie" },
    { label: "Technologie",      value: "tech" },
    { label: "Leiderschap",      value: "leiderschap" },
  ],
};
const PRODUCTS_DATA = {
  heading: "Onze producten",
  products: [
    { title: "Starterskit Digital",  price: "€ 2.950",      badge: "Populair",  description: "Alles voor een groeiend bedrijf online.", cta: { label: "Bekijk", href: "#" }, imageUrl: pic("prod-1", 400, 300) },
    { title: "Content Platform Pro", price: "€ 5.500 /jr",  badge: undefined,   description: "CMS, workflows en publicatie in één platform.", cta: { label: "Bekijk", href: "#" }, imageUrl: pic("prod-2", 400, 300) },
    { title: "Analytics Suite",      price: "€ 3.200 /jr",  badge: "Nieuw",     description: "Van data naar beslissingen — realtime.", cta: { label: "Bekijk", href: "#" }, imageUrl: pic("prod-3", 400, 300) },
    { title: "E-mail Automation",    price: "€ 1.800 /jr",  badge: undefined,   description: "Slimme campagnes op basis van gedrag.", cta: { label: "Bekijk", href: "#" }, imageUrl: pic("prod-4", 400, 300) },
  ],
};

// ── Extra helpers ─────────────────────────────────────────────────────────────

/** Consistent image wrapper */
function Img({ src, radius = 0, style = {} }: { src: string; radius?: number | string; style?: React.CSSProperties }) {
  return (
    <div style={{ overflow: "hidden", borderRadius: radius, background: "var(--bg-subtle)", lineHeight: 0, ...style }}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

/** Full-bleed photo with gradient overlay + content */
function PhotoBanner({ src, children, h = "55vh" }: { src: string; children: React.ReactNode; h?: string }) {
  return (
    <div style={{ position: "relative", height: h, minHeight: 400, overflow: "hidden" }}>
      <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.18) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: "0 0 4rem 4rem", maxWidth: 1200 }}>{children}</div>
    </div>
  );
}

// ── Page components ───────────────────────────────────────────────────────────

function HomePage({ p }: { p: P }) {
  // ─── CORPORATE — annual report aesthetic ─────────────────────────────────
  if (p === "corporate") return (
    <>
      {/* Split hero: serif text left + full-height photo right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "72vh", borderBottom: "1px solid var(--border)" }}>
        <div style={{ background: "var(--bg)", padding: "5rem 4rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ ...eyeS(p), marginBottom: "1.5rem" }}>Digitaal bureau — Amsterdam</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2.25rem,4vw,3.5rem)", fontWeight: 700, color: "var(--text)", lineHeight: 1.15, margin: 0 }}>Van strategie tot schaalbare digitale resultaten</h1>
          <div style={{ width: 48, height: 3, background: "var(--primary)", margin: "2rem 0" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "1.0625rem", lineHeight: 1.75, margin: 0 }}>Al 15 jaar helpen we organisaties groeien met slimme technologie en doordachte communicatie.</p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2.5rem" }}>
            <span style={btnS(p)}>Bekijk diensten</span>
            <span style={{ ...btnS(p), background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}>Contact opnemen</span>
          </div>
        </div>
        <div style={{ overflow: "hidden" }}>
          <img src={pic("hero-corp", 800, 700)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </div>
      {/* 4-stat ruler bar */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--section-subtle-bg)", padding: "1.75rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
          {[["200+","Afgeronde projecten"],["15 jr","Sectorervaring"],["98%","Klanttevredenheid"],["35","Professionals"]].map(([v,l],i) => (
            <div key={l} style={{ textAlign: "center", padding: "0.5rem 1rem", borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily: GEO, fontSize: "2.125rem", fontWeight: 700, color: "var(--primary)", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "0.4rem", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Services table — numbered rows */}
      <W bg={sectBg(p)}>
        <SH eyebrow="Wat wij doen" title="Geïntegreerde diensten" sub="Elk onderdeel versterkt het geheel." p={p} align="left" />
        <div style={{ border: "1px solid var(--border)" }}>
          {FEATURES_DATA.features.map((f, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 2fr", borderBottom: i < 5 ? "1px solid var(--border)" : "none", alignItems: "stretch" }}>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.25rem", fontFamily: "monospace", fontSize: 13, color: "var(--text-muted)", background: "var(--section-subtle-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{f.title}</div>
              </div>
              <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center" }}>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{f.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "2rem" }}><span style={btnS(p)}>Bekijk alle diensten →</span></div>
      </W>
      {/* CEO portrait + blockquote */}
      <W bg={sectBg(p, true)}>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "3rem", alignItems: "center", maxWidth: 860, margin: "0 auto", padding: "2rem 0" }}>
          <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <img src={pic("team-ceo", 200, 240)} alt="CEO" style={{ width: "100%", display: "block" }} />
          </div>
          <div>
            <blockquote style={{ fontFamily: GEO, fontSize: "clamp(1.125rem,2vw,1.5rem)", lineHeight: 1.65, fontStyle: "italic", color: "var(--text)", borderLeft: "4px solid var(--primary)", paddingLeft: "1.5rem", margin: 0 }}>"Wij zijn geen bureau dat campagnes bouwt en verdwijnt. Wij zijn de partner die meedenkt, meegroeit en meefeest bij elk resultaat."</blockquote>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1.5rem", paddingLeft: "1.5rem" }}>
              <div style={{ width: 32, height: 1, background: "var(--primary)" }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, fontFamily: GEO }}>Marie van den Berg — CEO &amp; Oprichter</p>
            </div>
          </div>
        </div>
      </W>
      {/* Case study 3-col grid */}
      <W bg={sectBg(p)}>
        <SH eyebrow="Klantcases" title="Resultaten die ertoe doen" p={p} align="left" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)" }}>
          {[["case-1","Strategie","Conversie +40%","TechCorp NL verdubbelde haar online omzet in zes maanden."],
            ["case-2","Implementatie","Time-to-market −60%","Een cloud-migratie afgerond in minder dan acht weken."],
            ["case-3","Data","€1,2M extra omzet","Gepersonaliseerde communicatie die direct resultaat leverde."]
          ].map(([seed,cat,kpi,copy]) => (
            <div key={seed as string} style={{ background: "var(--bg)" }}>
              <img src={pic(seed as string, 480, 220)} alt="" style={{ width: "100%", display: "block", height: 160, objectFit: "cover" }} />
              <div style={{ padding: "1.5rem" }}>
                <div style={{ ...eyeS(p), marginBottom: "0.5rem" }}>{cat as string}</div>
                <div style={{ fontFamily: GEO, fontSize: "1.25rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{kpi as string}</div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>{copy as string}</p>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Testimonials — ruled 3-col */}
      <W bg={sectBg(p, true)}>
        <SH eyebrow="Klantervaringen" title="Wat onze klanten zeggen" p={p} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid var(--border)" }}>
          {TESTIMONIALS_DATA.testimonials.map((t, i) => (
            <div key={i} style={{ padding: "2rem", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <p style={{ fontFamily: GEO, fontStyle: "italic", color: "var(--text)", lineHeight: 1.7, margin: 0, fontSize: "0.9375rem" }}>"{t.quote}"</p>
              <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{t.author}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.company}</div>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Full-width CTA bar */}
      <div style={{ background: "var(--primary)", padding: "3rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: 0 }}>Klaar voor een vrijblijvend gesprek?</h3>
            <p style={{ color: "rgba(255,255,255,0.8)", margin: "0.5rem 0 0", fontSize: 15 }}>Wij reageren doorgaans binnen één werkdag.</p>
          </div>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)", flexShrink: 0 }}>Maak een afspraak →</span>
        </div>
      </div>
    </>
  );

  // ─── TECH — dark SaaS product (Linear/Vercel style) ─────────────────────
  if (p === "tech") return (
    <>
      {/* Dark split hero: left headline + right product screenshot */}
      <div style={{ background: "var(--bg)", minHeight: "80vh", display: "grid", gridTemplateColumns: "1fr 1.2fr", alignItems: "center" }}>
        <div style={{ padding: "6rem 3rem 6rem 4rem" }}>
          <div style={eyeS(p)}>// platform voor contextuele communicatie</div>
          <h1 style={{ ...headS(p, "xl"), margin: "1.25rem 0", letterSpacing: "-0.03em" }}>De juiste boodschap. De juiste bezoeker. Automatisch.</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.0625rem", lineHeight: 1.7, maxWidth: 480 }}>Mister Chameleon past uw website realtime aan op basis van wie er bezoekt en waarom.</p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem", flexWrap: "wrap" as const }}>
            <span style={btnS(p)}>Start gratis trial</span>
            <span style={{ ...btnS(p), background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}>Bekijk demo →</span>
          </div>
          <div style={{ display: "flex", gap: "2rem", marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid var(--border)" }}>
            {[["99.9%","Uptime"],["3.2×","Conversie"],["200+","Klanten"]].map(([v,l]) => (
              <div key={l}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "3rem 4rem 3rem 0" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card, 8px)", overflow: "hidden", background: "var(--card-bg)" }}>
            <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", gap: "0.4rem", alignItems: "center" }}>
              {["#FF5F57","#FFBD2E","#28CA41"].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "block" }} />)}
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginLeft: "0.75rem" }}>dashboard — mister-chameleon.io</span>
            </div>
            <img src={pic("dashboard-saas", 700, 440)} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      </div>
      {/* Feature cards: dark, icon labels, pill tags */}
      <W bg={sectBg(p, true)} dot>
        <div style={eyeS(p)}>// features</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Alles wat u nodig heeft</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[
            { icon: "⚡", title: "Realtime aanpassing", desc: "Variant-switching in <50ms, geen page reload.", tag: "Core" },
            { icon: "🎯", title: "Segment-targeting",   desc: "Bedrijfsgrootte, industrie, UTM — elke dimensie.", tag: "Targeting" },
            { icon: "📊", title: "A/B analytics",       desc: "Statistische significantie met één klik.", tag: "Analytics" },
            { icon: "🔌", title: "Integraties",          desc: "HubSpot, Salesforce, GA4 plug-and-play.", tag: "Connectors" },
            { icon: "🔒", title: "Enterprise security",  desc: "SOC 2 Type II, GDPR, custom data residency.", tag: "Security" },
            { icon: "⚙️", title: "API-first",            desc: "REST + webhooks voor iedere workflow.", tag: "Developer" },
          ].map(f => (
            <div key={f.title} style={{ ...cardS(p), padding: "1.75rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>{f.icon}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{f.title}</span>
                <span style={{ padding: "2px 8px", borderRadius: 100, fontSize: 10, background: "var(--card-bg)", color: "var(--primary)", border: "1px solid var(--border)" }}>{f.tag}</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </W>
      {/* Integration showcase */}
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <div style={eyeS(p)}>// integraties</div>
            <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 1rem" }}>Werkt met uw stack</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>Plug-and-play met alle tools die u al gebruikt. Live binnen één werkdag.</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const, marginTop: "1.5rem" }}>
              {["HubSpot","Salesforce","GA4","Segment","Mixpanel","Intercom","Slack","Zapier"].map(t => (
                <span key={t} style={{ padding: "5px 12px", borderRadius: 100, fontSize: 12, background: "var(--card-bg)", color: "var(--text)", border: "1px solid var(--border)", fontFamily: "monospace" }}>{t}</span>
              ))}
            </div>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "1.75rem" }}>Bekijk alle integraties →</span>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card, 8px)", overflow: "hidden" }}>
            <img src={pic("integrations-tech", 600, 400)} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      </W>
      {/* Testimonials — dark cards */}
      <W bg={sectBg(p, true)} dot>
        <div style={eyeS(p)}>// testimonials</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Wat klanten zeggen</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {TESTIMONIALS_DATA.testimonials.map((t, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.75rem" }}>
              <div style={{ color: "var(--primary)", fontSize: "1.5rem", lineHeight: 1, marginBottom: "1rem", fontFamily: GEO }}>"</div>
              <p style={{ color: "var(--text)", lineHeight: 1.7, margin: 0, fontSize: "0.9375rem" }}>{t.quote}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{t.author[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t.author}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA — terminal style */}
      <div style={{ background: "var(--primary)", padding: "4rem 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: "1rem" }}>$ npm install @misterchameleon/sdk</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(1.75rem,3vw,2.5rem)", fontWeight: 800, color: "#fff", margin: "0 0 1rem", letterSpacing: "-0.03em" }}>Klaar om te starten?</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "2rem", fontSize: "1.0625rem" }}>Stel uw eerste variant in binnen 10 minuten.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>Probeer 14 dagen gratis →</span>
        </div>
      </div>
    </>
  );

  // ─── EDITORIAL — independent magazine (Monocle style) ────────────────────
  if (p === "editorial") return (
    <>
      {/* Full-bleed hero with gradient overlay */}
      <div style={{ position: "relative", height: "75vh", minHeight: 480, overflow: "hidden" }}>
        <img src={pic("editorial-hero", 1400, 900)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.12) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 1200, padding: "0 4rem 5rem" }}>
          <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", fontStyle: "italic", fontFamily: GEO, letterSpacing: "0.06em", marginBottom: "1rem" }}>Digitaal bureau &amp; contentstudio · Amsterdam</span>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2.5rem,5.5vw,4.5rem)", fontWeight: 700, color: "#fff", margin: "0 0 1.75rem", lineHeight: 1.1, maxWidth: 660 }}>Wij bouwen aan merken die mensen raken</h1>
          <span style={{ ...btnS(p) }}>Ontdek ons werk →</span>
        </div>
      </div>
      {/* Centered pull-quote */}
      <W bg={sectBg(p, true)} py="5rem">
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "5rem", lineHeight: 0.6, color: "var(--primary)", fontFamily: GEO, userSelect: "none" as const, marginBottom: "1.5rem", opacity: 0.22 }}>"</div>
          <p style={{ fontFamily: GEO, fontSize: "clamp(1.25rem,2.25vw,1.75rem)", lineHeight: 1.6, color: "var(--text)", fontStyle: "italic", margin: 0 }}>Wij zijn geen bureau dat campagnes bouwt en verdwijnt. Wij zijn de partner die meedenkt, meegroeit en meefeest bij elk resultaat.</p>
          <div style={{ width: 40, height: 1, background: "var(--primary)", margin: "2rem auto 1rem" }} />
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>— Marie van den Berg, CEO &amp; Oprichter</p>
        </div>
      </W>
      <Div p={p} />
      {/* Asymmetric 3:2 featured article */}
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "5rem", alignItems: "center" }}>
          <img src={pic("editorial-work-1", 700, 480)} alt="" style={{ width: "100%", borderRadius: 16, display: "block" }} />
          <div>
            <div style={eyeS(p)}>Strategie &amp; craft</div>
            <h2 style={{ ...headS(p, "lg"), margin: "0.75rem 0 1.25rem" }}>Verhalen die blijven hangen</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>We werken voor merken die iets te zeggen hebben. Onze aanpak combineert strategie, craft en technologie.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginTop: "0.75rem" }}>Niet sneller, maar slimmer. Niet luider, maar relevanter.</p>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "2rem" }}>Bekijk ons werk →</span>
          </div>
        </div>
      </W>
      <Div p={p} />
      {/* 3-col magazine article grid */}
      <W bg={sectBg(p, true)}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "2.5rem", borderBottom: "2px solid var(--text)", paddingBottom: "0.75rem" }}>
          <h2 style={{ fontFamily: GEO, fontSize: "1.375rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>Recente artikelen</h2>
          <span style={{ ...eyeS(p) }}>Kennisbank</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2.5rem" }}>
          {ARTICLES.slice(0, 3).map(a => (
            <div key={a.seed}>
              <img src={pic(a.seed, 400, 260)} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} />
              <div style={{ marginTop: "1rem" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.09em" }}>{a.cat}</span>
                <h3 style={{ fontFamily: GEO, fontSize: "1.0625rem", fontWeight: 700, color: "var(--text)", marginTop: "0.4rem", lineHeight: 1.4 }}>{a.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, marginTop: "0.5rem" }}>{a.excerpt}</p>
                <div style={{ display: "flex", gap: "0.5rem", fontSize: 12, color: "var(--text-muted)", marginTop: "0.75rem" }}>
                  <span>{a.date}</span><span>·</span><span>{a.read} lezen</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Editorial big-number stats */}
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {[["40%","hogere conversie voor onze klanten"],["€1,2M","extra omzet via personalisatie"],["15 jr","ervaring in digitale groei"]].map(([v,l],i) => (
            <div key={v} style={{ textAlign: "center", padding: "3rem 2rem", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily: GEO, fontSize: "clamp(3rem,5vw,4.5rem)", fontWeight: 700, color: "var(--primary)", lineHeight: 0.9 }}>{v}</div>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", marginTop: "1rem", lineHeight: 1.5 }}>{l}</p>
            </div>
          ))}
        </div>
      </W>
      <Div p={p} />
      {/* Team editorial grid */}
      <W bg={sectBg(p, true)}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={eyeS(p)}>Het team</div>
          <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem" }}>De mensen achter het werk</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}>
          {TEAM_MEMBERS.map(m => (
            <div key={m.name} style={{ textAlign: "center" }}>
              <img src={m.imageUrl} alt={m.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, display: "block" }} />
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)" }}>{m.name}</div>
                <div style={{ fontSize: 13, color: "var(--primary)", fontStyle: "italic", marginTop: 2 }}>{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </W>
    </>
  );

  // ─── WERKENBIJ — employer brand / job board (WorkScout style) ──────────────
  if (p === "werkenbij") return (
    <>
      {/* Centered hero: headline + prominent job search bar */}
      <div style={{ background: "var(--bg)", padding: "5rem 2rem 4rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Vacatures &amp; cultuur</div>
          <h1 style={{ fontFamily: fH, fontSize: "clamp(2.25rem,5vw,3.5rem)", fontWeight: 800, color: "var(--text)", margin: "0 0 1.25rem", lineHeight: 1.1, letterSpacing: "-0.02em" }}>Jouw volgende stap<br />begint hier</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.0625rem", lineHeight: 1.65, marginBottom: "2.5rem" }}>Ontdek onze openstaande vacatures en maak kennis met de mensen achter ons merk.</p>
          {/* Search bar */}
          <div style={{ display: "flex", maxWidth: 680, margin: "0 auto", border: "2px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--card-bg)", boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
            <input readOnly placeholder="Functie of afdeling…" style={{ flex: 1, padding: "1rem 1.25rem", border: "none", background: "transparent", outline: "none", fontSize: 15, color: "var(--text)", minWidth: 0 }} />
            <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
            <input readOnly placeholder="Stad of remote…" style={{ flex: 1, padding: "1rem 1.25rem", border: "none", background: "transparent", outline: "none", fontSize: 15, color: "var(--text)", minWidth: 0 }} />
            <span style={{ ...btnS(p), borderRadius: "0 10px 10px 0", margin: 0, display: "flex", alignItems: "center", padding: "0 1.75rem", flexShrink: 0, cursor: "pointer" }}>Zoeken</span>
          </div>
          {/* Category chips */}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" as const, marginTop: "1.5rem" }}>
            {["Frontend Developer","UX Designer","Marketing","Data Analyst","Product Manager","Operations"].map(cat => (
              <span key={cat} style={{ padding: "0.35rem 0.875rem", borderRadius: 100, fontSize: 13, background: "var(--section-subtle-bg)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>{cat}</span>
            ))}
          </div>
        </div>
      </div>
      {/* Stats strip */}
      <div style={{ background: "var(--primary)", padding: "1.25rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "flex", justifyContent: "center", gap: "4rem" }}>
          {[["12","Openstaande vacatures"],["95+","Medewerkers"],["4.7 ★","Glassdoor"],["2009","Opgericht"]].map(([v,l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.82)", marginTop: "0.3rem" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Featured vacatures grid */}
      <W bg={sectBg(p)} py="4rem">
        <SH eyebrow="Openstaande posities" title="Vind jouw volgende uitdaging" sub="Wij zoeken gedreven mensen die willen groeien." p={p} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {JOBS.map(j => (
            <div key={j.seed} style={{ ...cardS(p), padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: "var(--section-subtle-bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{j.dept}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{j.type}</span>
              </div>
              <h3 style={{ fontFamily: fH, fontWeight: 700, fontSize: "1.0625rem", color: "var(--text)", margin: "0 0 0.5rem", lineHeight: 1.3 }}>{j.title}</h3>
              <div style={{ display: "flex", gap: "1rem", fontSize: 13, color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                <span>📍 {j.loc}</span>
                <span>⚡ {j.level}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{j.sal}</span>
                <span style={{ ...btnS(p), fontSize: 12, padding: "0.4rem 1rem" }}>Meer info →</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <span style={{ ...btnS(p), fontSize: 15, padding: "0.875rem 2.5rem" }}>Bekijk alle vacatures →</span>
        </div>
      </W>
      {/* Culture section: text left + photo mosaic right */}
      <W bg={sectBg(p, true)} py="5rem">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div>
            <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>Onze cultuur</div>
            <h2 style={{ ...headS(p, "lg"), margin: "0 0 1.25rem" }}>Een plek waar je<br />écht kunt groeien</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginBottom: "1rem" }}>Bij ons staat jouw ontwikkeling centraal. We investeren in training, geven je ruimte om te experimenteren en vieren successen samen.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginBottom: "2rem" }}>Flexibel werken, platte organisatie en een team van mensen die enthousiast zijn over wat ze doen.</p>
            <span style={{ ...btnS(p) }}>Bekijk onze cultuurpagina →</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <img src={pic("wb-cult1", 320, 240)} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }} />
            <img src={pic("wb-cult2", 320, 320)} alt="" style={{ width: "100%", borderRadius: 10, display: "block", marginTop: "1.5rem" }} />
            <img src={pic("wb-cult3", 320, 200)} alt="" style={{ width: "100%", borderRadius: 10, display: "block", marginTop: "-0.75rem" }} />
            <img src={pic("wb-cult4", 320, 240)} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }} />
          </div>
        </div>
      </W>
      {/* Employee story cards */}
      <W bg={sectBg(p)} py="4rem">
        <SH eyebrow="Medewerker verhalen" title="Mensen van ons team" sub="Hoor hoe het is om bij ons te werken." p={p} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.25rem" }}>
          {[
            { img: pic("team-ceo",300,300), name: "Marie van den Berg", role: "CEO & Oprichter",  quote: "Ik ben trots op een team dat elke dag het beste van zichzelf geeft — en samen plezier heeft." },
            { img: pic("team-cto",300,300), name: "Tom Bakker",          role: "Lead Developer",   quote: "De vrijheid om technologie op de juiste manier te bouwen, dat vind ik nergens anders." },
            { img: pic("team-des",300,300), name: "Lisa Smit",           role: "UX Designer",      quote: "Goed design maken voor échte gebruikers — dat geeft me energie elke dag opnieuw." },
          ].map(m => (
            <div key={m.name} style={{ ...cardS(p), overflow: "hidden" }}>
              <div style={{ position: "relative", height: 220 }}>
                <img src={m.img} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 35%, transparent 70%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, padding: "1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{m.role}</div>
                </div>
              </div>
              <div style={{ padding: "1.25rem" }}>
                <p style={{ color: "var(--text)", lineHeight: 1.7, fontSize: "0.9375rem", margin: 0, fontStyle: "italic" }}>"{m.quote}"</p>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Perks / benefits grid */}
      <W bg={sectBg(p, true)} py="4rem">
        <SH eyebrow="Arbeidsvoorwaarden" title="Werken bij ons betekent" p={p} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[
            { icon: "🏡", title: "Hybride werken",       desc: "Thuis of op kantoor — jij kiest hoe en waar je het beste werkt." },
            { icon: "📚", title: "Budget voor groei",    desc: "€1.500 per jaar voor opleidingen, conferenties en boeken." },
            { icon: "🏋️", title: "Vitaliteitsbudget",   desc: "Sportabonnement, fietsplan en maandelijkse teamlunches." },
            { icon: "💻", title: "Goede tools",          desc: "MacBook Pro, premium software en ergonomische werkplek." },
            { icon: "🎯", title: "Impact maken",         desc: "Jouw werk heeft directe invloed op klanten en ons platform." },
            { icon: "💸", title: "Concurrerend salaris", desc: "Marktconform salaris, pensioen en jaarlijkse salarisreview." },
          ].map(b => (
            <div key={b.title} style={{ ...cardS(p), padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ fontSize: "1.625rem", lineHeight: 1, flexShrink: 0 }}>{b.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.35rem", fontSize: "0.9375rem" }}>{b.title}</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Final CTA */}
      <div style={{ background: "var(--primary)", padding: "4rem 0" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(1.75rem,3vw,2.5rem)", fontWeight: 800, color: "#fff", margin: "0 0 1rem", letterSpacing: "-0.02em" }}>Klaar voor je volgende stap?</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.0625rem", marginBottom: "2rem" }}>Bekijk onze openstaande vacatures en stuur je sollicitatie in.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>Bekijk vacatures</span>
            <span style={{ ...btnS(p), background: "transparent", border: "2px solid rgba(255,255,255,0.6)", color: "#fff" }}>Open sollicitatie →</span>
          </div>
        </div>
      </div>
    </>
  );

  // ─── ENERGETIC — startup growth marketing (Webflow style) ─────────────────
  return (
    <>
      {/* Full-bleed hero, diagonal bottom cut */}
      <div style={{ position: "relative", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", background: "var(--bg)" }}>
        <img src={pic("hero-energetic", 1400, 800)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.2 }} />
        <div style={{ position: "relative", padding: "7rem 4rem 10rem", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Wij bouwen groeiplatforms</div>
          <h1 style={{ fontFamily: fH, fontSize: "clamp(3rem,7vw,5.5rem)", fontWeight: 900, color: "var(--text)", margin: "0 0 1.25rem", lineHeight: 0.95, letterSpacing: "-0.04em", textTransform: "uppercase" as const }}>NIET ZOMAAR<br />EEN BUREAU.</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1.125rem", maxWidth: 520, lineHeight: 1.6, margin: "0 0 2.5rem" }}>Ambitieus, snel en resultaatgericht — wij leveren resultaten die meetbaar zijn.</p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <span style={btnS(p)}>START NU →</span>
            <span style={{ ...btnS(p), background: "transparent", border: "2px solid var(--primary)", color: "var(--primary)" }}>BEKIJK CASES</span>
          </div>
        </div>
      </div>
      {/* Diagonal primary stat strip */}
      <div style={{ clipPath: "polygon(0 0,100% 10%,100% 100%,0 90%)", background: "var(--primary)", padding: "5rem 0 6rem", marginTop: "-4rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 4rem", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}>
          {[["200+","Projecten live"],["15 jr","In business"],["€40M+","Omzet"],["35","Professionals"]].map(([v,l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(2rem,4vw,3.25rem)", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", marginTop: "0.5rem", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Case image cards with primary gradient overlay */}
      <W bg={sectBg(p)} py="5rem">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>Klantcases</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>RESULTATEN DIE SPREKEN</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.25rem" }}>
          {[["case-1","E-commerce","CONVERSIE +40%","TechCorp NL"],["case-2","SaaS","TIME-TO-MARKET −60%","CloudBase"],["case-3","Retail","€1,2M EXTRA","ShopMax"]].map(([seed,cat,kpi,brand]) => (
            <div key={seed as string} style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "4/3" as const }}>
              <img src={pic(seed as string, 480, 360)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--primary) 0%, transparent 65%)", opacity: 0.88 }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "1.5rem" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: "0.25rem" }}>{cat as string} · {brand as string}</div>
                <div style={{ fontSize: "1.375rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{kpi as string}</div>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Service cards with bold primary top border */}
      <W bg={sectBg(p, true)}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>Onze diensten</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>WAT WIJ DOEN</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {FEATURES_DATA.features.map((f, i) => (
            <div key={i} style={{ ...cardS(p), borderTop: "3px solid var(--primary)", padding: "1.75rem" }}>
              <div style={{ fontWeight: 900, fontSize: "1.0625rem", color: "var(--text)", marginBottom: "0.5rem", textTransform: "uppercase" as const }}>{f.title}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </W>
      {/* Team in primary diagonal band */}
      <div style={{ background: "var(--primary)", padding: "5rem 0", clipPath: "polygon(0 8%,100% 0,100% 92%,0 100%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 4rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <div style={{ ...eyeS(p), color: "rgba(255,255,255,0.8)", marginBottom: "1rem" }}>Over ons</div>
            <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "#fff", lineHeight: 1.0, margin: "0 0 1rem", textTransform: "uppercase" as const }}>WIJ ZIJN DE MOTOR ACHTER UW GROEI</h2>
            <p style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: "0 0 2rem" }}>Ambitieus team. Bewezen aanpak. Meetbare resultaten. Al 15 jaar.</p>
            <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>LEER ONS KENNEN →</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {TEAM_MEMBERS.map(m => (
              <div key={m.name} style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1" as const }}>
                <img src={m.imageUrl} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "0.4rem 0.75rem" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{m.name.split(" ")[0]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Testimonials — energetic cards */}
      <W bg={sectBg(p)}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>WAT KLANTEN ZEGGEN</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {TESTIMONIALS_DATA.testimonials.map((t, i) => (
            <div key={i} style={{ ...cardS(p), borderTop: "3px solid var(--primary)", padding: "1.75rem" }}>
              <p style={{ color: "var(--text)", lineHeight: 1.7, margin: "0 0 1.5rem", fontWeight: 500 }}>"{t.quote}"</p>
              <div style={{ fontWeight: 900, fontSize: 13, color: "var(--text)", textTransform: "uppercase" as const }}>{t.author}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.company}</div>
            </div>
          ))}
        </div>
      </W>
      {/* Final CTA band */}
      <div style={{ background: "var(--primary)", padding: "4.5rem 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, color: "#fff", margin: "0 0 1rem", letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>KLAAR VOOR IETS GROOTS?</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.125rem", marginBottom: "2rem" }}>Geen lange intake, gewoon starten.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>PLAN EEN GESPREK →</span>
        </div>
      </div>
    </>
  );
}

function AboutPage({ p }: { p: P }) {
  // ─── CORPORATE — jaarverslag-stijl ───────────────────────────────────────
  if (p === "corporate") return (
    <>
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--section-subtle-bg)", padding: "3.5rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
          <div style={eyeS(p)}>Over ons</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, color: "var(--text)", margin: "0.75rem 0 0", lineHeight: 1.2 }}>Een bureau gebouwd op vertrouwen en expertise</h1>
        </div>
      </div>
      <Div p={p} />
      {/* Mission: text left + photo right */}
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div>
            <div style={eyeS(p)}>Onze missie</div>
            <h2 style={{ fontFamily: GEO, fontSize: "clamp(1.5rem,2.5vw,2rem)", fontWeight: 700, color: "var(--text)", margin: "0.75rem 0 1.25rem", lineHeight: 1.3 }}>Digitale groei die echt telt</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>Wij geloven dat duurzame groei begint bij een goed begrip van uw organisatie, uw klanten en uw doelen. Technologie is een middel, geen doel.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginTop: "0.75rem" }}>Al 15 jaar combineren we strategisch inzicht met vakmanschap om resultaten te leveren die er toe doen.</p>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "2rem" }}>Bekijk ons team</span>
          </div>
          <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <img src={pic("about-mission-corp", 600, 440)} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      </W>
      {/* Stats ruler */}
      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--section-subtle-bg)", padding: "2rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
          {STATS_DATA.items.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0.5rem", borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily: GEO, fontSize: "2.25rem", fontWeight: 700, color: "var(--primary)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "0.4rem", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Timeline as ruled table */}
      <W bg={sectBg(p)}>
        <SH eyebrow="Onze geschiedenis" title="15 jaar digitale groei" p={p} align="left" />
        <div style={{ border: "1px solid var(--border)" }}>
          {TIMELINE_DATA.items.map((t, i) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "100px 1fr 3fr", borderBottom: i < TIMELINE_DATA.items.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.25rem", fontFamily: GEO, fontSize: "1.125rem", fontWeight: 700, color: "var(--primary)", background: "var(--section-subtle-bg)", display: "flex", alignItems: "center" }}>{t.date}</div>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{t.title}</div>
              </div>
              <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center" }}>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Team grid — ruled cells */}
      <W bg={sectBg(p, true)}>
        <SH eyebrow="Het team" title="De mensen achter de resultaten" p={p} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)" }}>
          {TEAM_MEMBERS.map(m => (
            <div key={m.name} style={{ background: "var(--bg)" }}>
              <img src={m.imageUrl} alt={m.name} style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }} />
              <div style={{ padding: "1.25rem 1rem" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </W>
    </>
  );

  // ─── TECH — dark SaaS ─────────────────────────────────────────────────────
  if (p === "tech") return (
    <>
      <div style={{ background: "var(--bg)", padding: "5rem 4rem 4rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <span style={eyeS(p)}>// about</span>
          <h1 style={{ ...headS(p, "xl"), marginTop: "1rem", maxWidth: 700 }}>Built by engineers, for engineers</h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 540, lineHeight: 1.7, marginTop: "1.25rem", fontSize: "1.0625rem" }}>We started small with a big mission: make relevance infrastructure invisible and performance obvious.</p>
        </div>
      </div>
      {/* Mission: screenshot + bullets */}
      <W bg={sectBg(p, true)} dot>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card, 8px)", overflow: "hidden" }}>
            <img src={pic("about-tech-mission", 640, 440)} alt="" style={{ width: "100%", display: "block" }} />
          </div>
          <div>
            <div style={eyeS(p)}>// our-approach</div>
            <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 1rem" }}>We bouwen voor de lange termijn</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>Geen quick wins, maar structurele verbeteringen die maanden en jaren later nog werken.</p>
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
              {["Open source first","Zero vendor lock-in","Privacy by design","Ops-friendly APIs"].map(v => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", flexShrink: 0, display: "block" }} />
                  <span style={{ fontSize: 14, color: "var(--text)", fontFamily: "monospace" }}>{v}</span>
                </div>
              ))}
            </div>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "2rem" }}>Bekijk onze stack →</span>
          </div>
        </div>
      </W>
      {/* Process — 2-col cards */}
      <W bg={sectBg(p)}>
        <div style={eyeS(p)}>// how-we-work</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Onze werkwijze</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1rem" }}>
          {PROCESS_DATA.steps.map((s, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.75rem", display: "flex", gap: "1.25rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 700, color: "var(--primary)", lineHeight: 1, flexShrink: 0, width: 40 }}>{String(i + 1).padStart(2, "0")}</div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.4rem" }}>{s.title}</div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{s.description}</p>
                <span style={{ fontSize: 11, color: "var(--primary)", fontFamily: "monospace", marginTop: "0.5rem", display: "block" }}>{s.duration}</span>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Timeline — vertical dot line */}
      <W bg={sectBg(p, true)} dot>
        <div style={eyeS(p)}>// history</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Mijlpalen</h2>
        <div style={{ paddingLeft: "2rem" }}>
          {TIMELINE_DATA.items.map((t, i) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "1.5rem", paddingBottom: "2rem", borderLeft: i < TIMELINE_DATA.items.length - 1 ? "2px solid var(--border)" : "2px solid transparent", paddingLeft: "1.5rem", position: "relative" as const }}>
              <div style={{ position: "absolute" as const, left: -7, top: 4, width: 12, height: 12, borderRadius: "50%", background: "var(--primary)", border: "2px solid var(--bg)" }} />
              <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--primary)", fontWeight: 700, paddingTop: 2 }}>{t.date}</div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.25rem" }}>{t.title}</div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Team — compact avatar cards */}
      <W bg={sectBg(p)}>
        <div style={eyeS(p)}>// team</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Het team</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {TEAM_MEMBERS.map(m => (
            <div key={m.name} style={{ ...cardS(p), padding: "1.5rem", textAlign: "center" }}>
              <img src={m.imageUrl} alt={m.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 1rem" }} />
              <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.875rem" }}>{m.name}</div>
              <div style={{ fontSize: 11, color: "var(--primary)", fontFamily: "monospace", marginTop: 2 }}>{m.role}</div>
            </div>
          ))}
        </div>
      </W>
    </>
  );

  // ─── EDITORIAL — magazine stijl ───────────────────────────────────────────
  if (p === "editorial") return (
    <>
      {/* Full-bleed header photo */}
      <div style={{ position: "relative", height: "50vh", minHeight: 340, overflow: "hidden" }}>
        <img src={pic("about-editorial", 1400, 700)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.68) 30%, rgba(0,0,0,0.08) 100%)" }} />
        <div style={{ position: "absolute", bottom: "3rem", left: "4rem", right: "4rem" }}>
          <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", fontStyle: "italic", fontFamily: GEO, marginBottom: "0.5rem" }}>Over ons</span>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2rem,4vw,3.25rem)", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2 }}>Wij geloven in de kracht van verhalen</h1>
        </div>
      </div>
      {/* Pull quote */}
      <W bg={sectBg(p, true)} py="4rem">
        <blockquote style={{ fontFamily: GEO, fontSize: "clamp(1.25rem,2vw,1.625rem)", lineHeight: 1.6, fontStyle: "italic", borderLeft: "4px solid var(--primary)", paddingLeft: "1.5rem", margin: "0 auto", maxWidth: 760, color: "var(--text)" }}>"Wij zijn geen bureau dat campagnes bouwt en verdwijnt. Wij zijn de langdurige partner die meedenkt, meegroeit en meefeest."</blockquote>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "1.25rem", paddingLeft: "calc(1.5rem + 4px)" }}>— Marie van den Berg, CEO &amp; Oprichter</p>
      </W>
      <Div p={p} />
      {/* Philosophy: text left, image right */}
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div>
            <div style={eyeS(p)}>Onze filosofie</div>
            <h2 style={{ ...headS(p, "lg"), margin: "0.75rem 0 1.25rem" }}>Mensen vóór technologie</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>Elk project begint met een vraag: wat heeft dit merk écht te zeggen? Pas als we dat snappen, gaan we bouwen.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginTop: "0.75rem" }}>We geloven in de kracht van slow thinking, diepe samenwerking en eerlijk advies.</p>
          </div>
          <img src={pic("about-philosophy", 600, 440)} alt="" style={{ width: "100%", borderRadius: 16, display: "block" }} />
        </div>
      </W>
      <Div p={p} />
      {/* Approach: image left, text right */}
      <W bg={sectBg(p, true)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <img src={pic("about-approach", 600, 440)} alt="" style={{ width: "100%", borderRadius: 16, display: "block" }} />
          <div>
            <div style={eyeS(p)}>Onze werkwijze</div>
            <h2 style={{ ...headS(p, "lg"), margin: "0.75rem 0 1.25rem" }}>Transparant en iteratief</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>We werken in korte cycli met veel contact. U ziet en beïnvloedt het werk terwijl het groeit — geen verrassingen bij de oplevering.</p>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "1.75rem" }}>Lees meer over onze aanpak →</span>
          </div>
        </div>
      </W>
      <Div p={p} />
      {/* Team editorial grid with bio */}
      <W bg={sectBg(p)}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={eyeS(p)}>De mensen</div>
          <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem" }}>Kennismaken?</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "2rem" }}>
          {TEAM_MEMBERS.map(m => (
            <div key={m.name}>
              <img src={m.imageUrl} alt={m.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, display: "block" }} />
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{m.name}</div>
                <div style={{ fontSize: 13, color: "var(--primary)", fontStyle: "italic", marginTop: 2 }}>{m.role}</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>{m.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </W>
    </>
  );

  // ─── ENERGETIC — startup marketing ───────────────────────────────────────
  return (
    <>
      {/* Bold hero with image overlay */}
      <div style={{ position: "relative", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)" }}>
        <img src={pic("about-energetic", 1400, 700)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, var(--primary) 0%, rgba(0,0,0,0.5) 100%)", opacity: 0.88 }} />
        <div style={{ position: "relative", padding: "6rem 4rem 9rem", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Over ons</div>
          <h1 style={{ fontFamily: fH, fontSize: "clamp(2.75rem,6vw,5rem)", fontWeight: 900, color: "#fff", margin: "0 0 1.25rem", lineHeight: 0.95, letterSpacing: "-0.04em", textTransform: "uppercase" as const }}>WIJ ZIJN DE MOTOR ACHTER UW GROEI</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", maxWidth: 520, lineHeight: 1.6, margin: "0 0 2rem" }}>Ambitieus, snel en resultaatgericht — dat is wie wij zijn.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>KOM ONS ONTMOETEN →</span>
        </div>
      </div>
      {/* Stats strip */}
      <div style={{ background: "var(--primary)", padding: "2.5rem 0", marginTop: "-3rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 4rem", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {STATS_DATA.items.map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(1.75rem,3vw,2.5rem)", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: "0.4rem", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Team grid — bold cards with primary accent */}
      <W bg={sectBg(p)} py="5rem">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>Het team</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>DE MENSEN ACHTER DE RESULTATEN</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1.25rem" }}>
          {TEAM_MEMBERS.map(m => (
            <div key={m.name} style={{ ...cardS(p), borderTop: "3px solid var(--primary)", overflow: "hidden" }}>
              <img src={m.imageUrl} alt={m.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
              <div style={{ padding: "1.25rem" }}>
                <div style={{ fontWeight: 900, fontSize: "0.9375rem", color: "var(--text)", textTransform: "uppercase" as const }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 2, fontWeight: 700 }}>{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Values — numbered bold cards */}
      <W bg={sectBg(p, true)}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>Onze waarden</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>WAAR WIJ VOOR STAAN</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1rem" }}>
          {[["01","RESULTAATGERICHT","Elk project heeft een duidelijk meetbaar doel. Geen projecten om projecten."],
            ["02","RADICAAL EERLIJK","We zeggen wat we denken — ook als dat soms moeilijk is."],
            ["03","SNEL &amp; ITERATIEF","Liever snelle lessen dan trage perfectie."],
            ["04","TEAM FIRST","Uw succes is ons succes. Altijd."]
          ].map(([nr,title,desc]) => (
            <div key={nr} style={{ ...cardS(p), padding: "2rem", display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary)", lineHeight: 1, flexShrink: 0 }}>{nr}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.0625rem", color: "var(--text)", marginBottom: "0.5rem" }} dangerouslySetInnerHTML={{ __html: title }} />
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }} dangerouslySetInnerHTML={{ __html: desc }} />
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA */}
      <div style={{ background: "var(--primary)", padding: "4rem 0", clipPath: "polygon(0 12%,100% 0,100% 100%,0 100%)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 2rem 0", textAlign: "center" }}>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,2.75rem)", fontWeight: 900, color: "#fff", margin: "0 0 1rem", textTransform: "uppercase" as const }}>WERKEN BIJ ONS?</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.0625rem", marginBottom: "2rem" }}>We zijn altijd op zoek naar nieuw talent.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>BEKIJK VACATURES →</span>
        </div>
      </div>
    </>
  );
}

function DienstenPage({ p }: { p: P }) {
  // ─── CORPORATE — ruled table layout ──────────────────────────────────────
  if (p === "corporate") return (
    <>
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--section-subtle-bg)", padding: "3.5rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem" }}>
          <div style={eyeS(p)}>Onze diensten</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, color: "var(--text)", margin: "0.75rem 0 0", lineHeight: 1.2 }}>Geïntegreerde diensten voor duurzame digitale groei</h1>
        </div>
      </div>
      <Div p={p} />
      {/* Services numbered table */}
      <W bg={sectBg(p)}>
        <SH eyebrow="Wat wij doen" title="Van strategie tot resultaat" sub="Elk onderdeel versterkt het geheel." p={p} align="left" />
        <div style={{ border: "1px solid var(--border)" }}>
          {FEATURES_DATA.features.map((f, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 220px 1fr 140px", alignItems: "stretch", borderBottom: i < 5 ? "1px solid var(--border)" : "none" }}>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.5rem", fontFamily: "monospace", fontSize: 13, color: "var(--text-muted)", background: "var(--section-subtle-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.5rem", display: "flex", alignItems: "center" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{f.title}</div>
              </div>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.5rem", display: "flex", alignItems: "center" }}>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{f.description}</p>
              </div>
              <div style={{ padding: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ ...btnS(p), fontSize: 12, padding: "0.4rem 1rem" }}>Meer info</span>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Approach: text + image */}
      <W bg={sectBg(p, true)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div>
            <div style={eyeS(p)}>Onze aanpak</div>
            <h2 style={{ fontFamily: GEO, fontSize: "clamp(1.5rem,2.5vw,2rem)", fontWeight: 700, color: "var(--text)", margin: "0.75rem 0 1.25rem", lineHeight: 1.3 }}>Resultaat is ons kompas</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>We starten altijd met een duidelijk gedefinieerd resultaat. Zo weten we allebei wanneer we geslaagd zijn.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginTop: "0.75rem" }}>Ons werk is transparant, meetbaar en afgestemd op uw bedrijfsdoelen.</p>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "2rem" }}>Plan een gesprek</span>
          </div>
          <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <img src={pic("services-approach-corp", 600, 440)} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      </W>
      {/* Process — ruled table */}
      <W bg={sectBg(p)}>
        <SH eyebrow="Werkwijze" title="Hoe een project verloopt" p={p} align="left" />
        <div style={{ border: "1px solid var(--border)" }}>
          {PROCESS_DATA.steps.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 220px 1fr", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.25rem", background: "var(--section-subtle-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "var(--primary)" }}>{i + 1}</div>
              <div style={{ borderRight: "1px solid var(--border)", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column" as const, justifyContent: "center" }}>
                <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 2 }}>{s.duration}</div>
              </div>
              <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center" }}>
                <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA bar */}
      <div style={{ background: "var(--primary)", padding: "3rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: 0 }}>Welke dienst past bij uw vraagstuk?</h3>
            <p style={{ color: "rgba(255,255,255,0.8)", margin: "0.5rem 0 0", fontSize: 15 }}>We denken graag vrijblijvend mee.</p>
          </div>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)", flexShrink: 0 }}>Neem contact op →</span>
        </div>
      </div>
    </>
  );

  // ─── TECH — dark SaaS cards ───────────────────────────────────────────────
  if (p === "tech") return (
    <>
      <div style={{ background: "var(--bg)", padding: "5rem 4rem 4rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <span style={eyeS(p)}>// services</span>
          <h1 style={{ ...headS(p, "xl"), marginTop: "1rem", maxWidth: 680 }}>Alles wat u nodig heeft<br />in één platform</h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 520, lineHeight: 1.65, marginTop: "1.25rem", fontSize: "1.0625rem" }}>Onze diensten zijn ontworpen om samen te werken — van strategie tot data, alles sluit op elkaar aan.</p>
        </div>
      </div>
      {/* Feature cards: 3-col with icon circles */}
      <W bg={sectBg(p, true)} dot>
        <div style={eyeS(p)}>// feature-set</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Wat zit er in?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {FEATURES_DATA.features.map((f, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.75rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem", fontSize: 14, color: "#fff", fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.4rem" }}>{f.title}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </W>
      {/* Approach: screenshot + text */}
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card, 8px)", overflow: "hidden" }}>
            <img src={pic("services-how-tech", 600, 420)} alt="" style={{ width: "100%", display: "block" }} />
          </div>
          <div>
            <div style={eyeS(p)}>// hoe-wij-werken</div>
            <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 1rem" }}>Agile, transparant, meetbaar</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>We werken in tweewekelijkse sprints met vaste demo- en feedbackmomenten. U ziet altijd waar we staan.</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const, marginTop: "1.25rem" }}>
              {["Scrum","CI/CD","TDD","Pair programming"].map(t => (
                <span key={t} style={{ padding: "4px 10px", borderRadius: 100, fontSize: 12, background: "var(--card-bg)", color: "var(--text)", border: "1px solid var(--border)", fontFamily: "monospace" }}>{t}</span>
              ))}
            </div>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "2rem" }}>Bekijk onze aanpak →</span>
          </div>
        </div>
      </W>
      {/* Process — 4-col terminal cards */}
      <W bg={sectBg(p, true)} dot>
        <div style={eyeS(p)}>// process</div>
        <h2 style={{ ...headS(p, "lg"), margin: "1rem 0 2.5rem" }}>Stap voor stap</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {PROCESS_DATA.steps.map((s, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.75rem" }}>
              <div style={{ fontFamily: "monospace", fontSize: "1.75rem", fontWeight: 700, color: "var(--primary)", lineHeight: 1, marginBottom: "1rem" }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.4rem" }}>{s.title}</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{s.description}</p>
              <div style={{ fontSize: 11, color: "var(--primary)", fontFamily: "monospace", marginTop: "0.75rem" }}>{s.duration}</div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA terminal */}
      <div style={{ background: "var(--primary)", padding: "4rem 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: "1rem" }}>$ ./start-project.sh --intake</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(1.75rem,3vw,2.5rem)", fontWeight: 800, color: "#fff", margin: "0 0 1rem", letterSpacing: "-0.03em" }}>Klaar om te starten?</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "2rem" }}>Stel uw eerste project in binnen één werkdag.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>Plan intake gesprek →</span>
        </div>
      </div>
    </>
  );

  // ─── EDITORIAL — magazine alternating rows ────────────────────────────────
  if (p === "editorial") return (
    <>
      {/* Photo header */}
      <div style={{ position: "relative", height: "40vh", minHeight: 280, overflow: "hidden" }}>
        <img src={pic("services-editorial", 1400, 600)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.1) 100%)" }} />
        <div style={{ position: "absolute", bottom: "3rem", left: "4rem", right: "4rem" }}>
          <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.6)", fontStyle: "italic", fontFamily: GEO, marginBottom: "0.5rem" }}>Onze diensten</span>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2 }}>Wat wij voor u kunnen betekenen</h1>
        </div>
      </div>
      {/* Intro centered */}
      <W bg={sectBg(p, true)} py="4rem">
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={eyeS(p)}>Onze werkwijze</div>
          <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem" }}>Strategie, craft &amp; technologie — in balans</h2>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginTop: "1rem" }}>We geloven niet in losse diensten. We geloven in samenhangende aanpakken die echt verschil maken voor uw merk en uw klanten.</p>
        </div>
      </W>
      <Div p={p} />
      {/* Alternating service rows */}
      <W bg={sectBg(p)}>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "5rem" }}>
          {FEATURES_DATA.features.slice(0, 4).map((f, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: i % 2 === 0 ? "1fr 1.5fr" : "1.5fr 1fr", gap: "4rem", alignItems: "center" }}>
              {i % 2 === 0 ? (
                <>
                  <div>
                    <div style={eyeS(p)}>0{i + 1}</div>
                    <h3 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", margin: "0.75rem 0 1rem", lineHeight: 1.3 }}>{f.title}</h3>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>{f.description}</p>
                    <span style={{ ...btnS(p), display: "inline-block", marginTop: "1.5rem" }}>Meer over {f.title} →</span>
                  </div>
                  <img src={pic(`service-ed-${i}`, 580, 380)} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} />
                </>
              ) : (
                <>
                  <img src={pic(`service-ed-${i}`, 580, 380)} alt="" style={{ width: "100%", borderRadius: 12, display: "block" }} />
                  <div>
                    <div style={eyeS(p)}>0{i + 1}</div>
                    <h3 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", margin: "0.75rem 0 1rem", lineHeight: 1.3 }}>{f.title}</h3>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>{f.description}</p>
                    <span style={{ ...btnS(p), display: "inline-block", marginTop: "1.5rem" }}>Meer over {f.title} →</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </W>
      <Div p={p} />
      {/* CTA editorial */}
      <W bg={sectBg(p, true)} py="5rem">
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={eyeS(p)}>Samenwerken?</div>
          <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem" }}>Waar kunnen wij u mee helpen?</h2>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.8, marginTop: "1rem" }}>We denken graag vrijblijvend mee over uw vraagstuk.</p>
          <span style={{ ...btnS(p), display: "inline-block", marginTop: "2rem" }}>Neem contact op →</span>
        </div>
      </W>
    </>
  );

  // ─── ENERGETIC — diagonal hero + bold cards ───────────────────────────────
  return (
    <>
      {/* Diagonal primary hero */}
      <div style={{ clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)", background: "var(--primary)", padding: "5rem 4rem 7.5rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Onze diensten</div>
          <h1 style={{ fontFamily: fH, fontSize: "clamp(2.75rem,6vw,5rem)", fontWeight: 900, color: "#fff", margin: "0 0 1.25rem", lineHeight: 0.95, letterSpacing: "-0.04em", textTransform: "uppercase" as const }}>WIJ BOUWEN WAAR JIJ<br />OP KUNT BOUWEN</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", maxWidth: 540, lineHeight: 1.6, margin: "0 0 2.5rem" }}>Strategie, design, code en groei — alles onder één dak.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>BEKIJK ALLES</span>
        </div>
      </div>
      {/* Service cards — numbered, bold top border */}
      <W bg={sectBg(p)} py="5rem">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>WAT WIJ DOEN</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {FEATURES_DATA.features.map((f, i) => (
            <div key={i} style={{ ...cardS(p), borderTop: "3px solid var(--primary)", padding: "2rem" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary)", lineHeight: 1, marginBottom: "0.75rem" }}>{String(i + 1).padStart(2, "0")}.</div>
              <div style={{ fontWeight: 900, fontSize: "1.0625rem", color: "var(--text)", marginBottom: "0.75rem", textTransform: "uppercase" as const }}>{f.title}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, margin: "0 0 1.25rem" }}>{f.description}</p>
              <span style={{ ...btnS(p), fontSize: 12, padding: "0.4rem 1rem" }}>MEER INFO →</span>
            </div>
          ))}
        </div>
      </W>
      {/* Process — 4-col bold */}
      <W bg={sectBg(p, true)}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ ...eyeS(p), marginBottom: "0.75rem" }}>Werkwijze</div>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,3rem)", fontWeight: 900, color: "var(--text)", margin: 0, letterSpacing: "-0.03em", textTransform: "uppercase" as const }}>ZO WERKEN WE</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {PROCESS_DATA.steps.map((s, i) => (
            <div key={i} style={{ ...cardS(p), borderTop: "3px solid var(--primary)", padding: "1.75rem" }}>
              <div style={{ fontSize: "3rem", fontWeight: 900, color: "var(--primary)", lineHeight: 0.9, marginBottom: "1rem" }}>{i + 1}</div>
              <div style={{ fontWeight: 900, fontSize: "0.9375rem", color: "var(--text)", marginBottom: "0.5rem", textTransform: "uppercase" as const }}>{s.title}</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{s.description}</p>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginTop: "0.75rem", textTransform: "uppercase" as const }}>{s.duration}</div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA */}
      <div style={{ background: "var(--primary)", padding: "4rem 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
          <h2 style={{ fontFamily: fH, fontSize: "clamp(2rem,3.5vw,2.75rem)", fontWeight: 900, color: "#fff", margin: "0 0 1rem", textTransform: "uppercase" as const }}>WAT KAN MISTER CHAMELEON VOOR JOU DOEN?</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.125rem", marginBottom: "2rem" }}>Laten we het uitvinden.</p>
          <span style={{ ...btnS(p), background: "#fff", color: "var(--primary)" }}>PLAN EEN GESPREK →</span>
        </div>
      </div>
    </>
  );
}

function DienstDetailPage({ p }: { p: P }) {
  const deliverables = ["Strategische analyse en marktscan", "Prioriteitenmatrix en groeiplan", "Digitale routekaart (12 maanden)", "Implementatiebegeleiding", "Voortgangsrapportage per kwartaal", "Aanbevelingen voor organisatieontwikkeling"];
  const faqItems = FAQ_DATA.items.slice(0, 4);
  const processSteps = [{ num: "01", title: "Intakegesprek", desc: "We brengen uw situatie en doelen in kaart.", dur: "Week 1" }, { num: "02", title: "Analyse", desc: "Data, markt en concurrentie onder de loep.", dur: "Week 2–3" }, { num: "03", title: "Strategie", desc: "Een helder plan met concrete stappen.", dur: "Week 4–5" }, { num: "04", title: "Implementatie", desc: "Begeleiding bij de uitvoering.", dur: "Lopend" }];

  if (p === "corporate") return (
    <>
      {/* Breadcrumb header */}
      <W bg={sectBg(p, true)} py="2.5rem">
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "1.5rem", letterSpacing: "0.04em" }}>Diensten &rsaquo; <strong style={{ color: "var(--text)" }}>Strategie &amp; Advies</strong></div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "3rem", alignItems: "end", borderBottom: "2px solid var(--border)", paddingBottom: "2rem" }}>
          <div>
            <div style={eyeS(p)}>Dienst</div>
            <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Strategie &amp; digitaal advies</h1>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginTop: "1rem", maxWidth: 560 }}>Van vraagstuk naar heldere aanpak — gestructureerd, onderbouwd en in samenwerking met uw team.</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ ...btnS(p), display: "inline-block" }}>Vraag offerte aan</span>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: "0.75rem" }}>Of bel: +31 20 123 4567</div>
          </div>
        </div>
      </W>
      {/* Description + image */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "3rem", alignItems: "start" }}>
          <div>
            <h2 style={{ ...headS(p, "lg"), marginBottom: "1rem" }}>Wat wij doen</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1rem" }}>Wij helpen organisaties om hun strategische vragen te beantwoorden met een combinatie van datagedreven analyse, marktkennis en praktijkervaring. Geen generieke adviezen, maar een aanpak die past bij uw context.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>Samen met uw team vertalen we inzichten naar een heldere routekaart met concrete prioriteiten, verantwoordelijkheden en meetpunten.</p>
          </div>
          <img src={pic("dienst-strat", 480, 360)} alt="" style={{ width: "100%", borderRadius: 0, border: "1px solid var(--border)" }} />
        </div>
      </W>
      <Div p={p} />
      {/* Deliverables numbered table */}
      <W bg={sectBg(p, true)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Wat ontvangt u?</h2>
        <div style={{ border: "1px solid var(--border)" }}>
          {deliverables.map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "56px 1fr", borderBottom: i < deliverables.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ padding: "1rem", borderRight: "1px solid var(--border)", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>0{i + 1}</div>
              <div style={{ padding: "1rem 1.25rem", fontFamily: GEO, color: "var(--text)", lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </W>
      {/* Process ruled table */}
      <W bg={sectBg(p)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Aanpak</h2>
        <div style={{ border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 2fr 100px", background: "var(--primary)", color: "#fff" }}>
            {["#", "Fase", "Omschrijving", "Doorlooptijd"].map(h => (
              <div key={h} style={{ padding: "0.75rem 1rem", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{h}</div>
            ))}
          </div>
          {processSteps.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 2fr 100px", borderBottom: i < processSteps.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ padding: "1rem", fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{s.num}</div>
              <div style={{ padding: "1rem", fontWeight: 700, fontFamily: GEO, color: "var(--text)" }}>{s.title}</div>
              <div style={{ padding: "1rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{s.desc}</div>
              <div style={{ padding: "1rem", fontSize: 12, color: "var(--text-muted)" }}>{s.dur}</div>
            </div>
          ))}
        </div>
      </W>
      {/* CEO blockquote */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ borderLeft: "4px solid var(--primary)", paddingLeft: "2rem", maxWidth: 680 }}>
          <p style={{ fontFamily: GEO, fontSize: "1.375rem", lineHeight: 1.6, color: "var(--text)", fontStyle: "italic" }}>"Strategie zonder uitvoering is een droom. Uitvoering zonder strategie is een nachtmerrie. Wij zorgen voor beide."</p>
          <div style={{ marginTop: "1rem", fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>— Marie van den Berg, CEO &amp; Oprichter</div>
        </div>
      </W>
      {/* FAQ ruled list */}
      <W bg={sectBg(p)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Veelgestelde vragen</h2>
        <div style={{ border: "1px solid var(--border)" }}>
          {faqItems.map((f, i) => (
            <div key={i} style={{ padding: "1.25rem 1.5rem", borderBottom: i < faqItems.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{f.question}</div>
              <div style={{ color: "var(--text-muted)", lineHeight: 1.65 }}>{f.answer}</div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA bar */}
      <div style={{ background: "var(--primary)", padding: "3rem 2rem", textAlign: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <div style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>Klaar om te starten?</div>
            <div style={{ color: "rgba(255,255,255,0.8)", marginTop: "0.25rem" }}>We denken vrijblijvend mee over uw vraagstuk.</div>
          </div>
          <span style={{ background: "#fff", color: "var(--primary)", padding: "0.875rem 2rem", fontWeight: 700, borderRadius: 0, fontFamily: GEO, cursor: "pointer", display: "inline-block" }}>Neem contact op</span>
        </div>
      </div>
    </>
  );

  if (p === "tech") return (
    <>
      {/* Dark split hero */}
      <div style={{ background: sectBg(p), display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 480 }}>
        <div style={{ padding: "4rem 2rem 4rem 3rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" as const }}>
            {["Strategie", "AI-integratie", "Digitale transformatie"].map(t => (
              <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.75rem", borderRadius: 100, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>{t}</span>
            ))}
          </div>
          <div style={eyeS(p)}>// service</div>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Strategie &amp; digitaal advies</h1>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.65, marginTop: "1rem", maxWidth: 480 }}>Van vraagstuk naar implementeerbaar plan — met een aanpak die past bij hoe moderne teams werken.</p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" as const }}>
            <span style={{ ...btnS(p), display: "inline-block" }}>Start een project</span>
            <span style={{ padding: "0.75rem 1.5rem", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>Bekijk referenties</span>
          </div>
        </div>
        <div style={{ background: sectBg(p, true), display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", borderLeft: "1px solid var(--border)" }}>
          <img src={pic("dienst-tech", 480, 360)} alt="" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }} />
        </div>
      </div>
      {/* 2-col feature cards monospace numbered */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={eyeS(p)}>// deliverables</div>
        <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1.5rem" }}>Wat je krijgt</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1rem" }}>
          {deliverables.map((d, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.25rem 1.5rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 700, marginTop: 2, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: "var(--text)", lineHeight: 1.5 }}>{d}</span>
            </div>
          ))}
        </div>
      </W>
      {/* 4-col process cards */}
      <W bg={sectBg(p)} py="3rem">
        <div style={eyeS(p)}>// process</div>
        <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1.5rem" }}>Aanpak</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {processSteps.map((s, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.5rem", borderTop: "2px solid var(--primary)" }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 700, marginBottom: "0.75rem" }}>{s.num}</div>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.desc}</div>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", marginTop: "1rem" }}>{s.dur}</div>
            </div>
          ))}
        </div>
      </W>
      {/* 2-col FAQ dark cards */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={eyeS(p)}>// faq</div>
        <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1.5rem" }}>Veelgestelde vragen</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {faqItems.map((f, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.5rem" }}>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{f.question}</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.answer}</div>
            </div>
          ))}
        </div>
      </W>
      {/* Terminal CTA */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ ...cardS(p), padding: "2.5rem", maxWidth: 680, margin: "0 auto", borderTop: "2px solid var(--primary)" }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--primary)", marginBottom: "1rem" }}>$ ./start-project.sh --service=strategy</div>
          <h3 style={{ ...headS(p, "md"), marginBottom: "0.5rem" }}>Klaar om te starten?</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>We plannen een 30-minuten call om te kijken hoe we kunnen helpen.</p>
          <span style={{ ...btnS(p), display: "inline-block" }}>Plan een call</span>
        </div>
      </W>
    </>
  );

  if (p === "editorial") return (
    <>
      {/* Full-bleed photo header */}
      <div style={{ position: "relative", height: "55vh", minHeight: 400, overflow: "hidden" }}>
        <img src={pic("dienst-ed-hero", 1400, 600)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)" }} />
        <div style={{ position: "absolute", bottom: "3rem", left: "3rem", maxWidth: 560 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: "0.75rem" }}>Dienst</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2rem,4.5vw,3.5rem)", fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>Strategie &amp; digitaal advies</h1>
        </div>
      </div>
      {/* Pull quote */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: GEO, fontSize: "4rem", color: "var(--primary)", lineHeight: 0.5, marginBottom: "1rem" }}>&ldquo;</div>
          <p style={{ fontFamily: GEO, fontSize: "clamp(1.25rem,2.5vw,1.75rem)", lineHeight: 1.55, color: "var(--text)", fontStyle: "italic" }}>Strategie zonder uitvoering is een droom. Wij zorgen voor beide — helder en concreet.</p>
          <div style={{ width: 48, height: 2, background: "var(--primary)", margin: "1.5rem auto 0" }} />
        </div>
      </W>
      <Div p={p} />
      {/* Description + image */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "3rem", alignItems: "start" }}>
          <div>
            <h2 style={{ fontFamily: GEO, fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>Wat wij doen</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1rem" }}>Wij helpen organisaties om hun strategische vragen te beantwoorden met een combinatie van datagedreven analyse, marktkennis en praktijkervaring. Geen generieke adviezen, maar een aanpak die past bij uw context.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.85 }}>Samen met uw team vertalen we inzichten naar een heldere routekaart met concrete prioriteiten, verantwoordelijkheden en meetpunten.</p>
            <span style={{ ...btnS(p), display: "inline-block", marginTop: "1.5rem" }}>Plan een kennismaking</span>
          </div>
          <img src={pic("dienst-ed-body", 480, 380)} alt="" style={{ width: "100%", borderRadius: 12 }} />
        </div>
      </W>
      {/* Deliverables 2-col editorial grid */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ borderBottom: "2px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>Wat ontvangt u?</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
          {deliverables.map((d, i) => (
            <div key={i} style={{ padding: "1.25rem 1.5rem 1.25rem 0", borderBottom: "1px solid var(--border)", borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none", paddingRight: i % 2 === 0 ? "2rem" : 0, paddingLeft: i % 2 === 1 ? "2rem" : 0, display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <span style={{ color: "var(--primary)", fontFamily: GEO, fontWeight: 700, flexShrink: 0 }}>✦</span>
              <span style={{ color: "var(--text)", lineHeight: 1.55 }}>{d}</span>
            </div>
          ))}
        </div>
      </W>
      {/* Centered testimonial */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <img src={pic("team-ceo", 72, 72)} alt="" style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 1rem" }} />
          <p style={{ fontFamily: GEO, fontSize: "1.125rem", lineHeight: 1.7, color: "var(--text)", fontStyle: "italic" }}>"De samenwerking voelde als een echte partnerschap. Ze begrijpen onze sector en denken mee op strategisch niveau."</p>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "0.75rem", fontWeight: 600 }}>— Jan Vermeer, Directeur Operaties</div>
        </div>
      </W>
      {/* Editorial CTA */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap" as const }}>
          <div>
            <h3 style={{ fontFamily: GEO, fontSize: "1.375rem", fontWeight: 700, color: "var(--text)" }}>Klaar om te starten?</h3>
            <p style={{ color: "var(--text-muted)", marginTop: "0.25rem" }}>We denken vrijblijvend mee over uw vraagstuk.</p>
          </div>
          <span style={{ ...btnS(p), display: "inline-block" }}>Neem contact op</span>
        </div>
      </W>
    </>
  );

  // energetic
  return (
    <>
      {/* Diagonal primary hero */}
      <div style={{ background: "var(--primary)", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", padding: "4rem 2rem 6rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" as const }}>
            {["Strategie", "AI-integratie", "Groei"].map(t => (
              <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.75rem", borderRadius: 100, background: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700 }}>{t}</span>
            ))}
          </div>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Dienst</div>
          <h1 style={{ ...headS(p, "xl"), color: "#fff", margin: "0 0 1rem" }}>STRATEGIE &amp; DIGITAAL ADVIES</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", maxWidth: 560, lineHeight: 1.6 }}>Van vraagstuk naar heldere aanpak — in samenwerking met uw team.</p>
          <span style={{ display: "inline-block", marginTop: "2rem", background: "#fff", color: "var(--primary)", padding: "0.875rem 2rem", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>VRAAG OFFERTE AAN</span>
        </div>
      </div>
      {/* 2-col bold numbered deliverables */}
      <W bg={sectBg(p)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>WAT ONTVANGT U?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1rem" }}>
          {deliverables.map((d, i) => (
            <Card key={i} p={p} style={{ padding: "1.5rem", borderTop: "3px solid var(--primary)", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--primary)", lineHeight: 1, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: "var(--text)", lineHeight: 1.5, fontWeight: 600 }}>{d}</span>
            </Card>
          ))}
        </div>
      </W>
      {/* 4-col bold process */}
      <W bg={sectBg(p, true)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>ONZE AANPAK</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {processSteps.map((s, i) => (
            <Card key={i} p={p} style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary)", lineHeight: 1, marginBottom: "0.75rem" }}>{s.num}</div>
              <div style={{ fontWeight: 900, color: "var(--text)", marginBottom: "0.5rem", fontSize: "1.0625rem" }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.desc}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginTop: "1rem", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{s.dur}</div>
            </Card>
          ))}
        </div>
      </W>
      {/* Testimonial in primary band */}
      <div style={{ background: "var(--primary)", padding: "3rem 2rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: GEO, fontSize: "1.375rem", lineHeight: 1.6, color: "#fff", fontStyle: "italic" }}>"De samenwerking voelde als een echte partnerschap. Resultaat: 40% meer conversie in kwartaal 1."</p>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: "1rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>— Jan Vermeer, Directeur Operaties</div>
        </div>
      </div>
      {/* Bottom CTA */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ textAlign: "center" }}>
          <h3 style={{ ...headS(p, "lg"), marginBottom: "0.5rem" }}>KLAAR OM TE STARTEN?</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>We denken vrijblijvend mee over uw vraagstuk.</p>
          <Btn p={p}>NEEM CONTACT OP</Btn>
        </div>
      </W>
    </>
  );
}

function BlogListPage({ p }: { p: P }) {
  if (p === "corporate") return (
    <>
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "end" }}>
          <div>
            <div style={eyeS(p)}>Kennisbank</div>
            <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Blog & inzichten</h1>
          </div>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.65 }}>Praktische kennis, trends en casestudies — om u te helpen betere beslissingen te nemen.</p>
        </div>
      </W>
      <Div p={p} />
      <W bg={sectBg(p)}>
        <FilterBarBlock data={FILTER_CATS} />
        <NewsListBlock data={{ heading: "", items: ARTICLES.map(a => ({ title: a.title, url: "#", excerpt: a.excerpt, date: a.date, imageUrl: pic(a.seed, 400, 260), category: a.cat })) }} variant="news_grid" />
      </W>
      <W bg={sectBg(p, true)}><QuickLinksBlock data={{ heading: "Meer thema's", links: [{ id: "1", label: "Strategie", href: "#", description: "Denkkaders voor groei" }, { id: "2", label: "Technologie", href: "#", description: "Tools en trends" }, { id: "3", label: "Leiderschap", href: "#", description: "Mens en organisatie" }, { id: "4", label: "Data", href: "#", description: "Cijfers en inzichten" }, { id: "5", label: "Klantcases", href: "#", description: "Leren van de praktijk" }, { id: "6", label: "Downloads", href: "#", description: "Rapporten en whitepapers" }] }} /></W>
    </>
  );
  if (p === "tech") return (
    <>
      <div style={{ background: sectBg(p), padding: "4rem 2rem 3rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <span style={eyeS(p)}>// blog</span>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Engineering &amp; Insights</h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.65, marginTop: "0.75rem" }}>Deep dives, case studies en praktische kennis van ons team.</p>
        </div>
      </div>
      <W bg={sectBg(p, true)}>
        <FilterBarBlock data={FILTER_CATS} />
        <NewsListBlock data={{ heading: "", items: ARTICLES.map(a => ({ title: a.title, url: "#", excerpt: a.excerpt, date: a.date, imageUrl: pic(a.seed, 400, 260), category: a.cat })) }} variant="news_grid" />
      </W>
    </>
  );
  if (p === "editorial") return (
    <>
      <W bg={sectBg(p, true)} py="4rem">
        <div style={{ borderBottom: "3px solid var(--text)", paddingBottom: "1.5rem", marginBottom: "3rem" }}>
          <div style={eyeS(p)}>Ons magazine</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(3rem,6vw,5rem)", fontWeight: 700, color: "var(--text)", margin: "0.5rem 0 0", lineHeight: 1.0 }}>Blog &amp; Inzichten</h1>
        </div>
        {ARTICLES[0] && (
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "2rem", alignItems: "start", marginBottom: "3rem" }}>
            <div>
              <img src={pic(ARTICLES[0].seed, 700, 440)} alt="" style={{ width: "100%", borderRadius: 16 }} />
            </div>
            <div style={{ paddingTop: "1rem" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{ARTICLES[0].cat}</span>
              <h2 style={{ fontFamily: GEO, fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", marginTop: "0.5rem", lineHeight: 1.25 }}>{ARTICLES[0].title}</h2>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginTop: "0.75rem" }}>{ARTICLES[0].excerpt}</p>
              <span style={{ ...btnS(p), display: "inline-block", marginTop: "1.25rem" }}>Lees verder</span>
            </div>
          </div>
        )}
        <Div p={p} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2rem", marginTop: "2rem" }}>
          {ARTICLES.slice(1, 4).map(a => (
            <div key={a.seed}>
              <img src={pic(a.seed, 400, 260)} alt="" style={{ width: "100%", borderRadius: 12 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.1em", display: "block", marginTop: "0.75rem" }}>{a.cat}</span>
              <h3 style={{ fontFamily: GEO, fontSize: "1.125rem", fontWeight: 700, color: "var(--text)", marginTop: "0.25rem", lineHeight: 1.35 }}>{a.title}</h3>
            </div>
          ))}
        </div>
      </W>
    </>
  );
  // energetic
  return (
    <>
      <div style={{ background: "var(--primary)", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", padding: "4rem 2rem 6rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Blog</div>
          <h1 style={{ ...headS(p, "xl"), color: "#fff", margin: "0 0 1rem" }}>KENNIS DIE WERKT</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.125rem", maxWidth: 540, lineHeight: 1.6 }}>Praktische inzichten, trends en casestudies van ons team.</p>
        </div>
      </div>
      <W bg={sectBg(p)}>
        <FilterBarBlock data={FILTER_CATS} />
        <NewsListBlock data={{ heading: "", items: ARTICLES.map(a => ({ title: a.title, url: "#", excerpt: a.excerpt, date: a.date, imageUrl: pic(a.seed, 400, 260), category: a.cat })) }} variant="news_grid" />
      </W>
    </>
  );
}

function BlogDetailPage({ p }: { p: P }) {
  const art = ARTICLES[0];
  const relatedArts = ARTICLES.slice(1, 4);
  const bodyParas = [
    "De digitale transformatie verloopt niet langer in golfbewegingen — ze is permanent. Organisaties die dit begrijpen, bouwen vandaag al aan de infrastructuur van morgen. Dat vraagt om een andere manier van denken: van projectmatig naar adaptief, van technologie-eerst naar mens-eerst.",
    "Drie jaar na de eerste grote AI-golf zien we een duidelijk patroon: organisaties die inzetten op cultuurverandering naast technologie boeken structureel betere resultaten. Niet de tool maakt het verschil, maar hoe mensen ermee leren werken.",
    "In onze praktijk zien we dat de beste resultaten ontstaan wanneer strategie, data en uitvoering van begin af aan met elkaar worden verbonden. Geen losse initiatieven, maar een samenhangende aanpak die groeit met de organisatie.",
  ];

  if (p === "corporate") return (
    <>
      {/* Formal ruled header */}
      <W bg={sectBg(p, true)} py="2.5rem">
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "1.5rem", letterSpacing: "0.04em" }}>Blog &rsaquo; <strong style={{ color: "var(--text)" }}>{art.cat}</strong></div>
        <div style={{ borderBottom: "2px solid var(--border)", paddingBottom: "2rem" }}>
          <h1 style={{ ...headS(p, "xl"), maxWidth: 800, lineHeight: 1.2 }}>{art.title}</h1>
          <div style={{ display: "flex", gap: "2rem", marginTop: "1.5rem", flexWrap: "wrap" as const }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <img src={pic("team-ceo", 40, 40)} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
              <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Marie van den Berg</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>CEO &amp; Oprichter</div></div>
            </div>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" as const }}>
              {[["Gepubliceerd", art.date], ["Leestijd", "8 min"], ["Categorie", art.cat]].map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginTop: 2 }}>{v}</div></div>
              ))}
            </div>
          </div>
        </div>
      </W>
      {/* Cover image */}
      <W bg={sectBg(p)} py="2rem">
        <img src={pic(art.seed, 1100, 520)} alt="" style={{ width: "100%", border: "1px solid var(--border)" }} />
      </W>
      {/* Narrow article body */}
      <W bg={sectBg(p)} py="0">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "3rem", alignItems: "start" }}>
          <div style={{ maxWidth: 680 }}>
            {bodyParas.map((para, i) => (
              <p key={i} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
            ))}
            {/* Corporate blockquote */}
            <div style={{ borderLeft: "4px solid var(--primary)", paddingLeft: "1.5rem", margin: "2rem 0" }}>
              <p style={{ fontFamily: GEO, fontSize: "1.25rem", lineHeight: 1.6, color: "var(--text)", fontStyle: "italic" }}>"Organisaties die cultuurverandering en technologie samen aanpakken, boeken structureel betere resultaten."</p>
            </div>
            {bodyParas.slice(0, 1).map((para, i) => (
              <p key={`b-${i}`} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
            ))}
          </div>
          {/* Sidebar */}
          <div style={{ paddingTop: "1rem" }}>
            <div style={{ ...cardS(p), padding: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Tags</div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const }}>
                {["Strategie", "2025", "Trends", "AI", "Digitaal"].map(t => (
                  <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.625rem", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ ...cardS(p), padding: "1.5rem" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Over de auteur</div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <img src={pic("team-ceo", 48, 48)} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                <div><div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", fontSize: "0.9375rem" }}>Marie van den Berg</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>CEO &amp; Oprichter</div></div>
              </div>
            </div>
          </div>
        </div>
      </W>
      <Div p={p} />
      {/* Related articles ruled grid */}
      <W bg={sectBg(p, true)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Meer inzichten</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, border: "1px solid var(--border)" }}>
          {relatedArts.map((a, i) => (
            <div key={a.seed} style={{ padding: "1.5rem", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <img src={pic(a.seed, 340, 200)} alt="" style={{ width: "100%", marginBottom: "0.75rem", border: "1px solid var(--border)" }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{a.cat}</div>
              <h3 style={{ fontFamily: GEO, fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginTop: "0.25rem", lineHeight: 1.35 }}>{a.title}</h3>
            </div>
          ))}
        </div>
      </W>
      {/* Newsletter CTA bar */}
      <div style={{ background: "var(--primary)", padding: "2.5rem 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" as const }}>
          <div><div style={{ fontFamily: GEO, fontSize: "1.375rem", fontWeight: 700, color: "#fff" }}>Blijf op de hoogte</div><div style={{ color: "rgba(255,255,255,0.8)", marginTop: "0.25rem" }}>Wekelijks nieuwe inzichten in uw inbox.</div></div>
          <span style={{ background: "#fff", color: "var(--primary)", padding: "0.75rem 1.75rem", fontWeight: 700, fontFamily: GEO, cursor: "pointer", display: "inline-block" }}>Aanmelden</span>
        </div>
      </div>
    </>
  );

  if (p === "tech") return (
    <>
      {/* Dark header with pill tags */}
      <div style={{ background: sectBg(p), padding: "4rem 2rem 3rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const, marginBottom: "1.25rem" }}>
            {["Strategie", "2025", "AI", "Trends"].map(t => (
              <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.75rem", borderRadius: 100, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>{t}</span>
            ))}
          </div>
          <div style={eyeS(p)}>// blog</div>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem", lineHeight: 1.2 }}>{art.title}</h1>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "1.5rem", alignItems: "center", flexWrap: "wrap" as const }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <img src={pic("team-ceo", 36, 36)} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace" }}>Marie van den Berg</span>
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{art.date} · 8 min read</span>
          </div>
        </div>
      </div>
      {/* Dark cover card */}
      <W bg={sectBg(p, true)} py="2rem">
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <img src={pic(art.seed, 900, 460)} alt="" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }} />
        </div>
      </W>
      {/* Article body */}
      <W bg={sectBg(p)} py="2rem">
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {bodyParas.map((para, i) => (
            <p key={i} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
          ))}
          {/* code-block key insight */}
          <div style={{ ...cardS(p), padding: "1.5rem", borderLeft: "3px solid var(--primary)", margin: "2rem 0" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", marginBottom: "0.75rem" }}>// key insight</div>
            <p style={{ color: "var(--text)", fontFamily: "monospace", fontSize: 13, lineHeight: 1.7 }}>Organisaties die cultuurverandering en technologie samen aanpakken boeken structureel betere resultaten. Tools zijn catalysatoren, niet oplossingen.</p>
          </div>
          {bodyParas.slice(0, 1).map((para, i) => (
            <p key={`c-${i}`} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
          ))}
        </div>
      </W>
      {/* Related dark cards */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={eyeS(p)}>// related</div>
        <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1.5rem" }}>Meer lezen</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {relatedArts.map(a => (
            <div key={a.seed} style={{ ...cardS(p), overflow: "hidden" }}>
              <img src={pic(a.seed, 340, 200)} alt="" style={{ width: "100%", display: "block" }} />
              <div style={{ padding: "1rem" }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--primary)", marginBottom: "0.5rem" }}>{a.cat}</div>
                <div style={{ fontWeight: 700, color: "var(--text)", lineHeight: 1.35, fontSize: "0.9375rem" }}>{a.title}</div>
              </div>
            </div>
          ))}
        </div>
      </W>
      {/* Terminal subscribe CTA */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ ...cardS(p), padding: "2rem", maxWidth: 560, margin: "0 auto", borderTop: "2px solid var(--primary)" }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--primary)", marginBottom: "1rem" }}>$ subscribe --newsletter</div>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>Wekelijks nieuwe inzichten over strategie, technologie en digitale transformatie.</p>
          <span style={{ ...btnS(p), display: "inline-block" }}>Aanmelden</span>
        </div>
      </W>
    </>
  );

  if (p === "editorial") return (
    <>
      {/* Magazine full-bleed header */}
      <div style={{ position: "relative", height: "55vh", minHeight: 400, overflow: "hidden" }}>
        <img src={pic(art.seed, 1400, 600)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)" }} />
        <div style={{ position: "absolute", bottom: "3rem", left: "50%", transform: "translateX(-50%)", width: "90%", maxWidth: 720, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.12em", marginBottom: "0.75rem" }}>{art.cat}</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(1.75rem,4vw,3rem)", fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{art.title}</h1>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: "1rem" }}>Door Marie van den Berg · {art.date} · 8 min leestijd</div>
        </div>
      </div>
      {/* Editorial article body */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: GEO, fontSize: "1.25rem", lineHeight: 1.7, color: "var(--text)", fontStyle: "italic", marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "2rem" }}>{art.excerpt}</p>
          {bodyParas.map((para, i) => (
            <p key={i} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
          ))}
          {/* Editorial pull quote */}
          <div style={{ margin: "2.5rem 0", textAlign: "center" }}>
            <div style={{ fontFamily: GEO, fontSize: "3.5rem", color: "var(--primary)", lineHeight: 0.5, marginBottom: "1rem" }}>&ldquo;</div>
            <p style={{ fontFamily: GEO, fontSize: "1.375rem", lineHeight: 1.55, color: "var(--text)", fontStyle: "italic" }}>Organisaties die cultuurverandering en technologie samen aanpakken, boeken structureel betere resultaten.</p>
            <div style={{ width: 40, height: 2, background: "var(--primary)", margin: "1.25rem auto 0" }} />
          </div>
          {bodyParas.slice(0, 2).map((para, i) => (
            <p key={`d-${i}`} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
          ))}
        </div>
      </W>
      <Div p={p} />
      {/* Editorial 3-col related */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ borderBottom: "2px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: GEO, fontSize: "1.375rem", fontWeight: 700, color: "var(--text)" }}>Meer lezen</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "2rem" }}>
          {relatedArts.map(a => (
            <div key={a.seed}>
              <img src={pic(a.seed, 340, 220)} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: "0.75rem" }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>{a.cat}</div>
              <h3 style={{ fontFamily: GEO, fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginTop: "0.25rem", lineHeight: 1.35 }}>{a.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>{a.excerpt.slice(0, 80)}…</p>
            </div>
          ))}
        </div>
      </W>
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontFamily: GEO, fontSize: "1.375rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>Blijf op de hoogte</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.25rem" }}>Wekelijks nieuwe inzichten in uw inbox — geen spam, altijd relevant.</p>
          <span style={{ ...btnS(p), display: "inline-block" }}>Aanmelden voor nieuwsbrief</span>
        </div>
      </W>
    </>
  );

  // energetic
  return (
    <>
      {/* Bold primary clip-path header */}
      <div style={{ background: "var(--primary)", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", padding: "4rem 2rem 6rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" as const }}>
            {["Strategie", "2025", "AI"].map(t => (
              <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.75rem", borderRadius: 100, background: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700 }}>{t}</span>
            ))}
          </div>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Blog</div>
          <h1 style={{ ...headS(p, "xl"), color: "#fff", margin: "0 0 1rem", maxWidth: 800, lineHeight: 1.1 }}>{art.title.toUpperCase()}</h1>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 700 }}>Marie van den Berg · {art.date} · 8 min</div>
        </div>
      </div>
      {/* Cover image */}
      <W bg={sectBg(p)} py="2rem">
        <img src={pic(art.seed, 1100, 520)} alt="" style={{ width: "100%", borderRadius: 0 }} />
      </W>
      {/* Body */}
      <W bg={sectBg(p, true)} py="2rem">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {bodyParas.map((para, i) => (
            <p key={i} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
          ))}
          {/* Bold insight card */}
          <Card p={p} style={{ padding: "1.75rem", borderTop: "4px solid var(--primary)", margin: "2rem 0" }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Kernboodschap</div>
            <p style={{ fontWeight: 700, color: "var(--text)", lineHeight: 1.6, fontSize: "1.0625rem" }}>Organisaties die cultuurverandering en technologie samen aanpakken boeken structureel betere resultaten.</p>
          </Card>
          {bodyParas.slice(0, 1).map((para, i) => (
            <p key={`e-${i}`} style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem", fontSize: "1.0625rem" }}>{para}</p>
          ))}
        </div>
      </W>
      {/* Primary CTA band */}
      <div style={{ background: "var(--primary)", padding: "3rem 2rem", textAlign: "center" }}>
        <h3 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>BLIJF OP DE HOOGTE</h3>
        <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>Wekelijks nieuwe inzichten in uw inbox.</p>
        <span style={{ display: "inline-block", background: "#fff", color: "var(--primary)", padding: "0.875rem 2rem", fontWeight: 900, cursor: "pointer" }}>AANMELDEN</span>
      </div>
    </>
  );
}

function JobsListPage({ p }: { p: P }) {
  if (p === "corporate") return (
    <>
      <HeroBlock tag="Werken bij ons" title="Sluit u aan bij een ambitieus en hecht team" subtitle="" ctas={[]} layoutVariant="hero_compact" />
      <Div p={p} />
      <W bg={sectBg(p)}>
        <FilterBarBlock data={{ ...FILTER_CATS, placeholder: "Zoek op functie of afdeling...", categories: [{ label: "Alle afdelingen", value: "all" }, { label: "Technologie", value: "tech" }, { label: "Design", value: "design" }, { label: "Marketing", value: "marketing" }] }} />
        <div style={{ marginTop: "1.5rem" }}>
          {JOBS.map(j => (
            <div key={j.seed} style={{ ...cardS(p), display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "1rem", alignItems: "center", padding: "1.25rem 1.5rem", marginBottom: 1 }}>
              <div><div style={{ fontWeight: 700, color: "var(--text)", fontFamily: GEO }}>{j.title}</div><div style={{ fontSize: 13, color: "var(--text-muted)" }}>{j.dept}</div></div>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{j.loc}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{j.type}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{j.level}</span>
              <span style={{ ...btnS(p), fontSize: 12, padding: "0.4rem 1rem" }}>Bekijk</span>
            </div>
          ))}
        </div>
      </W>
      <W bg={sectBg(p, true)}><ProcessStepsBlock data={{ heading: "Zo verloopt onze selectie", steps: [{ title: "Online sollicitatie", description: "Stuur je CV via het formulier.", duration: "Dag 1" }, { title: "Kennismakingsgesprek", description: "30 min telefonisch of via Teams.", duration: "Week 1" }, { title: "Verdiepingsgesprek", description: "Face-to-face met het team.", duration: "Week 2" }, { title: "Welkom aan boord", description: "Contract en onboarding.", duration: "Week 3" }] }} /></W>
      <CTABlock title="Staat jouw functie er niet bij?" text="Stuur een open sollicitatie." cta={{ label: "Open sollicitatie", href: "#" }} />
    </>
  );
  if (p === "tech") return (
    <>
      <div style={{ background: sectBg(p), padding: "4rem 2rem 3rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <span style={eyeS(p)}>// careers</span>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Open positions</h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.65, marginTop: "0.75rem" }}>We hire curious, driven people who want to build things that matter.</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const, marginTop: "1.5rem" }}>
            {["All", "Engineering", "Design", "Product", "Marketing"].map((d, i) => (
              <span key={d} style={{ padding: "0.375rem 0.875rem", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer", background: i === 0 ? "var(--primary)" : "rgba(255,255,255,0.07)", color: i === 0 ? "#fff" : "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>{d}</span>
            ))}
          </div>
        </div>
      </div>
      <W bg={sectBg(p, true)}>
        <ListingBlock data={LISTING_JOBS} variant="listing_cards" />
        <div style={{ marginTop: "2rem" }}><FaqSectionBlock data={{ heading: "Veelgestelde vragen", items: FAQ_DATA.items.slice(0, 2) }} /></div>
      </W>
      <CTABlock title="Don't see your role?" text="Send an open application — we're always open to exceptional talent." cta={{ label: "Apply now", href: "#" }} />
    </>
  );
  if (p === "editorial") return (
    <>
      <W bg={sectBg(p, true)} py="4rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "4rem", alignItems: "end" }}>
          <div>
            <div style={eyeS(p)}>Werken bij ons</div>
            <h1 style={{ fontFamily: GEO, fontSize: "clamp(2.5rem,5vw,4rem)", fontWeight: 700, color: "var(--text)", lineHeight: 1.1, margin: "0.75rem 0 1rem" }}>Een plek waar je kunt groeien</h1>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>We werken met mensen die nieuwsgierig zijn, eigenaarschap nemen en iets willen achterlaten.</p>
          </div>
          <img src={pic("jobs-ed", 480, 360)} alt="" style={{ width: "100%", borderRadius: 16 }} />
        </div>
      </W>
      <Div p={p} />
      <W bg="#fff"><ListingBlock data={LISTING_JOBS} variant="listing_cards" /></W>
      <W bg={sectBg(p, true)}><ContentSectionBlock data={{ eyebrow: "Cultuur", heading: "Waarom wij?", intro: "We investeren structureel in onze mensen: coaching, conferentiebudget, peer reviews en ruimte om te experimenteren.", ctas: [{ label: "Lees meer over onze cultuur →", href: "#" }], align: "center" }} /></W>
      <TeamSectionBlock data={{ ...TEAM_SECTION_DATA, heading: "Je toekomstige collega's" }} variant="team_compact" />
    </>
  );
  return (
    <>
      <HeroBlock tag="Werken bij ons" title="Sluit je aan bij ons team" subtitle="Wij bouwen aan iets groots. Jij hoort erbij." ctas={[{ label: "Bekijk alle vacatures →", href: "#" }]} layoutVariant="hero_background" contentAlign="center" />
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1.25rem" }}>
          {JOBS.map(j => (
            <Card key={j.seed} p={p} style={{ padding: "1.5rem", borderTop: `3px solid var(--primary)` }}>
              <div style={{ fontWeight: 900, fontSize: "1.125rem", color: "var(--text)" }}>{j.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", margin: "0.25rem 0 1rem" }}>{j.dept} · {j.loc}</div>
              <Btn p={p}>Solliciteer</Btn>
            </Card>
          ))}
        </div>
      </W>
      <ProcessStepsBlock data={{ heading: "Zo verloopt onze selectie", steps: PROCESS_DATA.steps }} />
      <CTABlock title="Staat jouw functie er niet bij?" text="Stuur een open sollicitatie — we zijn altijd op zoek naar talent." cta={{ label: "OPEN SOLLICITATIE →", href: "#" }} />
    </>
  );
}

function JobDetailPage({ p }: { p: P }) {
  const selSteps = [{ num: "01", title: "Online sollicitatie", desc: "Stuur je CV via het formulier. We reageren binnen twee werkdagen.", dur: "Dag 1" }, { num: "02", title: "Kennismakingsgesprek", desc: "30 minuten telefonisch of via Teams met HR.", dur: "Week 1" }, { num: "03", title: "Verdiepingsgesprek", desc: "Face-to-face gesprek met het team en een korte case.", dur: "Week 2" }, { num: "04", title: "Welkom aan boord", desc: "Contract, onboarding en eerste werkdag.", dur: "Week 3" }];
  const jobMeta = [["Afdeling", "Technologie"], ["Locatie", "Amsterdam"], ["Type", "Full-time"], ["Niveau", "Medior"], ["Salaris", "€3.500 – €5.000"], ["Uren", "32–40 uur"]];

  if (p === "corporate") return (
    <>
      {/* Formal ruled header */}
      <W bg={sectBg(p, true)} py="2.5rem">
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "1.5rem", letterSpacing: "0.04em" }}>Vacatures &rsaquo; <strong style={{ color: "var(--text)" }}>Technologie</strong></div>
        <div style={{ borderBottom: "2px solid var(--border)", paddingBottom: "2rem" }}>
          <div style={eyeS(p)}>Vacature</div>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Frontend Developer</h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginTop: "1.5rem", border: "1px solid var(--border)", padding: "1.25rem" }}>
            {jobMeta.map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600, marginTop: 4 }}>{v}</div></div>
            ))}
          </div>
        </div>
      </W>
      {/* Description + apply 2-col */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "3rem", alignItems: "start" }}>
          <div>
            <h2 style={{ ...headS(p, "lg"), marginBottom: "1rem" }}>Over de rol</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1rem" }}>Als Frontend Developer bouw je aan de digitale producten die onze klanten dagelijks gebruiken. Je werkt nauw samen met designers en backend-ontwikkelaars in een agile team.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1.5rem" }}>Je takenpakket omvat: bouwen van nieuwe features, code reviews, bijdragen aan de design system en samenwerken met product en design om de beste gebruikerservaring te leveren.</p>
            <h3 style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "0.75rem" }}>Wat vragen wij?</h3>
            <div style={{ border: "1px solid var(--border)" }}>
              {["3+ jaar ervaring met React en TypeScript", "Oog voor detail en UX-gevoel", "Ervaring met REST API's en GraphQL", "Goede communicatievaardigheden in NL/EN"].map((r, i) => (
                <div key={i} style={{ padding: "0.75rem 1rem", borderBottom: i < 3 ? "1px solid var(--border)" : "none", display: "flex", gap: "0.75rem" }}>
                  <span style={{ color: "var(--primary)", fontWeight: 700 }}>→</span>
                  <span style={{ color: "var(--text-muted)" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...cardS(p), padding: "1.5rem", border: "1px solid var(--border)" }}>
              <h3 style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>Solliciteer nu</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: "1.25rem" }}>Stuur je CV en een korte motivatie. We reageren binnen twee werkdagen.</p>
              <span style={{ ...btnS(p), display: "block", textAlign: "center" as const, marginBottom: "0.75rem" }}>Direct solliciteren</span>
              <div style={{ textAlign: "center" as const, fontSize: 13 }}><a href="#" style={{ color: "var(--primary)", textDecoration: "underline" }}>Stel een vraag</a></div>
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <img src={pic("team-cto", 40, 40)} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                  <div><div style={{ fontFamily: GEO, fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>Tom Bakker</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>CTO &amp; Hiring Manager</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </W>
      <Div p={p} />
      {/* Selection process ruled table */}
      <W bg={sectBg(p, true)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Selectieproces</h2>
        <div style={{ border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 2fr 100px", background: "var(--primary)", color: "#fff" }}>
            {["#", "Stap", "Omschrijving", "Timing"].map(h => (
              <div key={h} style={{ padding: "0.75rem 1rem", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{h}</div>
            ))}
          </div>
          {selSteps.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "72px 1fr 2fr 100px", borderBottom: i < selSteps.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ padding: "1rem", fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{s.num}</div>
              <div style={{ padding: "1rem", fontWeight: 700, fontFamily: GEO, color: "var(--text)" }}>{s.title}</div>
              <div style={{ padding: "1rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{s.desc}</div>
              <div style={{ padding: "1rem", fontSize: 12, color: "var(--text-muted)" }}>{s.dur}</div>
            </div>
          ))}
        </div>
      </W>
    </>
  );

  if (p === "tech") return (
    <>
      {/* Dark header with pill tags */}
      <div style={{ background: sectBg(p), padding: "4rem 2rem 3rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as const, marginBottom: "1.25rem" }}>
            {["TypeScript", "React", "GraphQL", "Remote-friendly"].map(t => (
              <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.75rem", borderRadius: 100, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>{t}</span>
            ))}
          </div>
          <div style={eyeS(p)}>// careers</div>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Frontend Developer</h1>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "1.25rem", flexWrap: "wrap" as const }}>
            {jobMeta.slice(0, 4).map(([l, v]) => (
              <div key={l}><span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{l.toLowerCase()}: </span><span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>{v}</span></div>
            ))}
          </div>
        </div>
      </div>
      {/* Role + apply 2-col */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "2rem", alignItems: "start" }}>
          <div>
            <div style={eyeS(p)}>// role</div>
            <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1rem" }}>Over de rol</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1rem" }}>Als Frontend Developer bouw je aan de digitale producten die onze klanten dagelijks gebruiken. Je werkt nauw samen met designers en backend-ontwikkelaars in een agile team.</p>
            <div style={eyeS(p)}>// requirements</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem", marginTop: "0.75rem" }}>
              {["3+ jaar ervaring met React en TypeScript", "Oog voor detail en UX-gevoel", "Ervaring met REST API's en GraphQL", "Goede communicatievaardigheden in NL/EN"].map((r, i) => (
                <div key={i} style={{ ...cardS(p), padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Apply dark card */}
          <div style={{ ...cardS(p), padding: "2rem", borderTop: "2px solid var(--primary)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", marginBottom: "1rem" }}>$ apply --role=frontend-dev</div>
            <h3 style={{ ...headS(p, "md"), marginBottom: "0.5rem" }}>Solliciteer nu</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: "1.5rem" }}>Stuur je CV en een korte motivatie. We reageren binnen twee werkdagen.</p>
            <span style={{ ...btnS(p), display: "block", textAlign: "center" as const, marginBottom: "0.75rem" }}>Direct solliciteren</span>
            <div style={{ textAlign: "center" as const, fontSize: 13, color: "var(--text-muted)", marginTop: "1rem" }}>Vragen? <a href="#" style={{ color: "var(--primary)" }}>tom@misterchameleon.nl</a></div>
            <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <img src={pic("team-cto", 36, 36)} alt="" style={{ width: 36, height: 36, borderRadius: "50%" }} />
              <div><div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>Tom Bakker</div><div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>CTO &amp; Hiring Manager</div></div>
            </div>
          </div>
        </div>
      </W>
      {/* 4-col monospace process steps */}
      <W bg={sectBg(p)} py="3rem">
        <div style={eyeS(p)}>// hiring_process</div>
        <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1.5rem" }}>Selectieproces</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {selSteps.map((s, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.5rem", borderTop: "2px solid var(--primary)" }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 700, marginBottom: "0.75rem" }}>{s.num}</div>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.desc}</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", marginTop: "1rem" }}>{s.dur}</div>
            </div>
          ))}
        </div>
      </W>
    </>
  );

  if (p === "editorial") return (
    <>
      {/* Magazine 3:2 grid header */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "3rem", alignItems: "end", borderBottom: "2px solid var(--border)", paddingBottom: "2rem" }}>
          <div>
            <div style={eyeS(p)}>Vacature</div>
            <h1 style={{ fontFamily: GEO, fontSize: "clamp(2rem,4.5vw,3.25rem)", fontWeight: 700, color: "var(--text)", lineHeight: 1.1, margin: "0.75rem 0 1rem" }}>Frontend Developer</h1>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" as const }}>
              {jobMeta.slice(0, 4).map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 700 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <img src={pic("jobs-ed-team", 440, 320)} alt="" style={{ width: "100%", borderRadius: 12 }} />
        </div>
      </W>
      {/* Role + recruiter 2-col */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "3rem", alignItems: "start" }}>
          <div>
            <h2 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>Over de rol</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1rem" }}>Als Frontend Developer bouw je aan de digitale producten die onze klanten dagelijks gebruiken. Je werkt nauw samen met designers en backend-ontwikkelaars in een agile team.</p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.85, marginBottom: "1.5rem" }}>Je takenpakket omvat: bouwen van nieuwe features, code reviews, bijdragen aan de design system en samenwerken met product en design.</p>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1rem" }}>
              <h3 style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "0.75rem" }}>Wat vragen wij?</h3>
              {["3+ jaar ervaring met React en TypeScript", "Oog voor detail en UX-gevoel", "Ervaring met REST API's en GraphQL", "Goede communicatievaardigheden in NL/EN"].map((r, i) => (
                <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <span style={{ color: "var(--primary)", fontFamily: GEO, fontWeight: 700, flexShrink: 0 }}>✦</span>
                  <span style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...cardS(p), padding: "1.75rem", borderRadius: 12 }}>
              <h3 style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>Solliciteer</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: "1.25rem" }}>Stuur je CV en een korte motivatie. We reageren binnen twee werkdagen.</p>
              <span style={{ ...btnS(p), display: "block", textAlign: "center" as const, marginBottom: "1.25rem" }}>Direct solliciteren</span>
              <div style={{ paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Je contactpersoon</div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <img src={pic("team-cto", 48, 48)} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                  <div><div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)" }}>Tom Bakker</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>CTO &amp; Hiring Manager</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </W>
      <Div p={p} />
      {/* Editorial centered CTA */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: GEO, fontSize: "3rem", color: "var(--primary)", lineHeight: 0.5, marginBottom: "1.25rem" }}>&ldquo;</div>
          <p style={{ fontFamily: GEO, fontSize: "1.25rem", lineHeight: 1.6, color: "var(--text)", fontStyle: "italic" }}>"We werken met mensen die nieuwsgierig zijn, eigenaarschap nemen en iets willen achterlaten."</p>
          <div style={{ width: 40, height: 2, background: "var(--primary)", margin: "1.5rem auto" }} />
          <span style={{ ...btnS(p), display: "inline-block" }}>Kom ons team versterken</span>
        </div>
      </W>
    </>
  );

  // energetic
  return (
    <>
      {/* Diagonal primary hero */}
      <div style={{ background: "var(--primary)", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", padding: "4rem 2rem 6rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" as const }}>
            {["TypeScript", "React", "Full-time", "Amsterdam"].map(t => (
              <span key={t} style={{ fontSize: 11, padding: "0.25rem 0.75rem", borderRadius: 100, background: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700 }}>{t}</span>
            ))}
          </div>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Vacature</div>
          <h1 style={{ ...headS(p, "xl"), color: "#fff", margin: "0 0 1rem" }}>FRONTEND DEVELOPER</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", maxWidth: 540, lineHeight: 1.6 }}>Bouw mee aan digitale producten die echte impact maken.</p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            <span style={{ display: "inline-block", background: "#fff", color: "var(--primary)", padding: "0.875rem 2rem", fontWeight: 900, cursor: "pointer" }}>SOLLICITEER NU</span>
            <span style={{ display: "inline-block", border: "2px solid #fff", color: "#fff", padding: "0.875rem 2rem", fontWeight: 900, cursor: "pointer" }}>STEL EEN VRAAG</span>
          </div>
        </div>
      </div>
      {/* Role + apply 2-col */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "2rem", alignItems: "start" }}>
          <div>
            <h2 style={{ ...headS(p, "lg"), marginBottom: "1rem" }}>OVER DE ROL</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.75, marginBottom: "1rem" }}>Als Frontend Developer bouw je aan de digitale producten die onze klanten dagelijks gebruiken. Je werkt nauw samen met designers en backend-ontwikkelaars in een agile team.</p>
            <h3 style={{ fontWeight: 900, color: "var(--text)", marginBottom: "0.75rem", textTransform: "uppercase" as const, fontSize: "0.875rem", letterSpacing: "0.06em" }}>WAT WE VRAGEN</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {["3+ jaar React/TypeScript", "Gevoel voor UX en detail", "REST + GraphQL kennis", "NL/EN communicatie"].map((r, i) => (
                <Card key={i} p={p} style={{ padding: "0.875rem 1rem", borderTop: "2px solid var(--primary)" }}>
                  <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{r}</span>
                </Card>
              ))}
            </div>
          </div>
          {/* Apply card with primary border */}
          <Card p={p} style={{ padding: "2rem", border: "2px solid var(--primary)" }}>
            <h3 style={{ ...headS(p, "md"), marginBottom: "0.5rem" }}>SOLLICITEER</h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem", margin: "1rem 0" }}>
              {jobMeta.map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{l}</span>
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <span style={{ ...btnS(p), display: "block", textAlign: "center" as const, marginTop: "1rem" }}>DIRECT SOLLICITEREN</span>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
              <img src={pic("team-cto", 40, 40)} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
              <div><div style={{ fontWeight: 900, color: "var(--text)", fontSize: 13 }}>Tom Bakker</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>CTO &amp; Hiring Manager</div></div>
            </div>
          </Card>
        </div>
      </W>
      {/* Tech stack grid cards */}
      <W bg={sectBg(p, true)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>SELECTIEPROCES</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
          {selSteps.map((s, i) => (
            <Card key={i} p={p} style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary)", lineHeight: 1, marginBottom: "0.75rem" }}>{s.num}</div>
              <div style={{ fontWeight: 900, color: "var(--text)", marginBottom: "0.5rem", fontSize: "1.0625rem" }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.desc}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginTop: "1rem", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{s.dur}</div>
            </Card>
          ))}
        </div>
      </W>
    </>
  );
}

function ContactPage({ p }: { p: P }) {
  if (p === "corporate") return (
    <>
      <HeroBlock tag="Contact" title="Neem contact op" subtitle="Wij reageren doorgaans binnen één werkdag." ctas={[]} layoutVariant="hero_compact" />
      <Div p={p} />
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "4rem" }}>
          <FormSectionBlock data={{ formKey: "contact", title: "Stuur ons een bericht" }} />
          <div>
            <ContactSectionBlock data={{ heading: "Onze gegevens", address: "Herengracht 182", phone: "+31 20 123 4567", email: "hallo@misterchameleon.nl", hours: "Ma–Vr 09:00–17:30" }} />
            <div style={{ marginTop: "2rem" }}><FaqSectionBlock data={{ heading: "Veelgestelde vragen", items: FAQ_DATA.items.slice(0, 2) }} /></div>
          </div>
        </div>
      </W>
      <MapBlock data={{ address: "Herengracht 182", city: "Amsterdam", country: "Nederland", email: "hallo@misterchameleon.nl", phone: "+31 20 123 4567" }} />
    </>
  );
  if (p === "tech") return (
    <>
      <div style={{ background: sectBg(p), display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 480 }}>
        <div style={{ padding: "4rem 2rem 4rem 3rem" }}>
          <span style={eyeS(p)}>// contact</span>
          <h1 style={{ ...headS(p, "xl"), marginTop: "1rem", marginBottom: "1.5rem" }}>Let's talk</h1>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.65, marginBottom: "2rem" }}>Whether it's a quick question or a big project — we're here.</p>
          <FormSectionBlock data={{ formKey: "contact" }} />
        </div>
        <div style={{ background: sectBg(p, true), padding: "4rem 2rem 4rem 3rem", borderLeft: "1px solid var(--border)" }}>
          <ContactSectionBlock data={{ heading: "Reach us", address: "Herengracht 182", phone: "+31 20 123 4567", email: "hallo@misterchameleon.nl", hours: "Mon–Fri 09:00–17:30" }} />
          <div style={{ marginTop: "2rem" }}><FaqSectionBlock data={{ heading: "FAQ", items: FAQ_DATA.items.slice(0, 2) }} /></div>
        </div>
      </div>
      <MapBlock data={{ address: "Herengracht 182", city: "Amsterdam", country: "Nederland", email: "hallo@misterchameleon.nl", phone: "+31 20 123 4567" }} />
    </>
  );
  if (p === "editorial") return (
    <>
      <W bg={sectBg(p, true)} py="4rem">
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={eyeS(p)}>Contact</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2.5rem,5vw,4rem)", fontWeight: 700, color: "var(--text)", lineHeight: 1.1, margin: "0.75rem 0 1rem" }}>Wij horen graag van u</h1>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>Heeft u een vraag, een idee of een uitdaging? We denken graag mee.</p>
        </div>
      </W>
      <Div p={p} />
      <W bg="#fff">
        <FormSectionBlock data={{ formKey: "contact", title: "" }} variant="form_card" />
      </W>
      <W bg={sectBg(p, true)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem" }}>
          <ContactSectionBlock data={{ heading: "Onze gegevens", address: "Herengracht 182", phone: "+31 20 123 4567", email: "hallo@misterchameleon.nl", hours: "Ma–Vr 09:00–17:30" }} />
          <TeamSectionBlock data={{ heading: "Wie helpt u verder?", members: TEAM_MEMBERS.slice(0, 2).map(m => ({ name: m.name, role: m.role, imageUrl: m.imageUrl })) }} variant="team_compact" />
        </div>
      </W>
    </>
  );
  return (
    <>
      <div style={{ background: "var(--primary)", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", padding: "4rem 2rem 6rem", textAlign: "center" }}>
        <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Contact</div>
        <h1 style={{ ...headS(p, "xl"), color: "#fff", margin: "0 0 1rem" }}>LATEN WE PRATEN</h1>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.125rem", lineHeight: 1.6, maxWidth: 540, margin: "0 auto" }}>Groot plan of snelle vraag — we staan voor je klaar.</p>
      </div>
      <W bg={sectBg(p)}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Card p={p} style={{ padding: "2.5rem" }}>
            <FormSectionBlock data={{ formKey: "contact", title: "Stuur een bericht" }} />
          </Card>
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <ContactSectionBlock data={{ phone: "+31 20 123 4567", email: "hallo@misterchameleon.nl", hours: "Ma–Vr 09:00–17:30" }} />
          </div>
        </div>
      </W>
    </>
  );
}

function AgendaPage({ p }: { p: P }) {
  const isD = p === "tech";
  return (
    <>
      {isD
        ? <div style={{ background: sectBg(p), padding: "4rem 2rem 3rem" }}><div style={{ maxWidth: 1200, margin: "0 auto" }}><span style={eyeS(p)}>// events</span><h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Events &amp; Meetups</h1><p style={{ color: "var(--text-muted)", marginTop: "0.75rem" }}>Join us in Amsterdam, Rotterdam, and online.</p></div></div>
        : <HeroBlock tag="Agenda" title="Evenementen & workshops" subtitle="Praktische kennis opdoen, netwerken en inspiratie halen — live en online." ctas={[]} layoutVariant="hero_compact" />
      }
      <W bg={sectBg(p)}>
        <FilterBarBlock data={{ placeholder: "Zoek op thema of locatie...", categories: [{ label: "Alle types", value: "all" }, { label: "Amsterdam", value: "amsterdam" }, { label: "Online", value: "online" }, { label: "Rotterdam", value: "rotterdam" }] }} />
        {p === "editorial"
          ? <div style={{ marginTop: "2rem" }}>
              {EVENTS.map(e => (
                <div key={e.seed} style={{ ...cardS(p), display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "1.5rem", alignItems: "center", padding: "1.5rem", marginBottom: "1rem" }}>
                  <div style={{ textAlign: "center", minWidth: 56 }}>
                    <div style={{ fontFamily: GEO, fontSize: "2.25rem", fontWeight: 700, color: "var(--primary)", lineHeight: 1 }}>{e.day}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{e.mon}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: GEO, fontSize: "1.125rem", fontWeight: 700, color: "var(--text)" }}>{e.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "0.25rem" }}>{e.loc} · {e.time}</div>
                  </div>
                  <span style={btnS(p)}>Aanmelden</span>
                </div>
              ))}
            </div>
          : <ListingBlock data={LISTING_EVENTS} variant="listing_cards" />
        }
      </W>
      <W bg={isD ? "#0d1527" : sectBg(p, true)}>
        <ContentSectionBlock data={{ eyebrow: "Organiseer een event", heading: "Wilt u ons uitnodigen als spreker?", intro: "Wij verzorgen ook keynotes, workshops op locatie en bedrijfsspecifieke masterclasses.", ctas: [{ label: "Neem contact op", href: "#", variant: "primary" }], align: "center" }} />
      </W>
      {p === "energetic" && <PricingSectionBlock data={PRICING_DATA} />}
      {p === "tech" && <TimelineBlock data={TIMELINE_DATA} variant="timeline_milestones" />}
    </>
  );
}

function EventDetailPage({ p }: { p: P }) {
  const isD = p === "tech" || p === "energetic";
  return (
    <>
      <HeroBlock tag="Workshop" title="Data-gedreven besluitvorming voor managers" subtitle="Een intensieve halvedagworkshop voor leidinggevenden die beter willen werken met data." ctas={[{ label: "Meld je aan", href: "#" }]} layoutVariant={isD ? "hero_dark_split" : "hero_split"} />
      <W bg={sectBg(p)}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "3rem" }}>
          <ContentSectionBlock data={{ eyebrow: "Over dit event", heading: "Wat kun je verwachten?", intro: "In vier uur tijd leer je hoe je data-inzichten vertaalt naar betere besluiten. Praktisch, concreet en direct toepasbaar.", ctas: [], align: "left" }} />
          <div>
            <Card p={p} style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "0.5rem" }}>📅 22 mei 2025, 09:00–13:00</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "1.5rem" }}>📍 Amsterdam · Nog 8 plekken</div>
              <FormSectionBlock data={{ formKey: "contact", title: "Aanmelden", submitLabel: "Reserveer mijn plek" }} />
            </Card>
          </div>
        </div>
      </W>
      <MapBlock data={{ address: "Herengracht 182", city: "Amsterdam", country: "Nederland", email: "events@misterchameleon.nl", phone: "+31 20 123 4567" }} />
    </>
  );
}

function ProductenPage({ p }: { p: P }) {
  const isD = p === "tech";
  return (
    <>
      {isD
        ? <div style={{ background: sectBg(p), padding: "4rem 2rem 3rem" }}><div style={{ maxWidth: 1200, margin: "0 auto" }}><span style={eyeS(p)}>// products</span><h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Onze producten</h1><p style={{ color: "var(--text-muted)", marginTop: "0.75rem" }}>Klaar om te gebruiken. Schaalbaar wanneer u groeit.</p></div></div>
        : <HeroBlock tag="Producten" title="Slimme tools voor moderne organisaties" subtitle="Kant-en-klare oplossingen die direct waarde toevoegen." ctas={[]} layoutVariant="hero_compact" />
      }
      <W bg={sectBg(p)}>
        <FilterBarBlock data={{ placeholder: "Zoek een product...", categories: [{ label: "Alle producten", value: "all" }, { label: "Platform", value: "platform" }, { label: "Analytics", value: "analytics" }, { label: "Marketing", value: "marketing" }] }} />
        <div style={{ marginTop: "1.5rem" }}><ProductOverviewBlock data={PRODUCTS_DATA} /></div>
      </W>
      <LogoStripBlock data={LOGOS_DATA} />
    </>
  );
}

function ProductDetailPage({ p }: { p: P }) {
  return (
    <>
      <ProductDetailBlock data={{ title: "Content Platform Pro", description: "Alles wat een groeiende organisatie nodig heeft voor consistente, schaalbare content. Van CMS tot publicatieworkflows — in één omgeving.", gallery: [{ url: pic("product-main", 800, 560), alt: "Product overview" }, { url: pic("product-2", 400, 280), alt: "Dashboard" }, { url: pic("product-3", 400, 280), alt: "Analytics" }], specs: [{ label: "Gebruikers", value: "Tot 25 interne gebruikers" }, { label: "Opslag", value: "100 GB media-opslag" }, { label: "Integraties", value: "HubSpot, Salesforce, GA4" }, { label: "SLA", value: "99.9% uptime garantie" }], price: "€ 5.500 / jaar", badge: "Meest gekozen", cta: { label: "Begin vandaag", href: "#" }, secondaryCta: { label: "Plan een demo", href: "#" } }} />
      <TestimonialSectionBlock data={TESTIMONIALS_DATA} />
      <RelatedContentBlock data={{ heading: "Gerelateerde producten", items: [{ id: "1", title: "Analytics Suite", href: "#", imageUrl: pic("prod-3", 400, 260), category: "Analytics", excerpt: "Van data naar beslissingen." }, { id: "2", title: "E-mail Automation", href: "#", imageUrl: pic("prod-4", 400, 260), category: "Marketing", excerpt: "Slimme campagnes op basis van gedrag." }, { id: "3", title: "Starterskit Digital", href: "#", imageUrl: pic("prod-1", 400, 260), category: "Platform", excerpt: "Ideaal voor starters." }] }} />
    </>
  );
}

function WinkelwagenPage({ p }: { p: P }) {
  return (
    <W bg={sectBg(p)} py="3rem">
      <CartSummaryBlock data={{ heading: "Uw winkelwagen", emptyMessage: "Uw winkelwagen is nog leeg.", checkoutHref: "#", continueShoppingHref: "#", checkoutLabel: "Afrekenen", continueShoppingLabel: "Verder winkelen" }} />
    </W>
  );
}

function CheckoutPage({ p }: { p: P }) {
  return (
    <W bg={sectBg(p)} py="3rem">
      <CheckoutBlock data={{ heading: "Afronden", intro: "Vul uw gegevens in om de bestelling te plaatsen.", paymentProvider: "Stripe", returnHref: "#", returnLabel: "Terug naar winkel" }} />
    </W>
  );
}

function LandingspaginaPage({ p }: { p: P }) {
  const isD = p === "tech";
  return (
    <>
      <HeroBlock tag="Webinar — 28 mei 2025" title="AI voor managers: van hype naar waarde" subtitle="In 90 minuten leer je hoe je AI inzet in je organisatie — zonder technische kennis." ctas={[{ label: isD ? "Registreer gratis" : "Meld je aan →", href: "#" }, { label: "Bekijk het programma", href: "#" }]} layoutVariant={isD ? "hero_dark_split" : p === "energetic" ? "hero_background" : "hero_split"} contentAlign={p === "energetic" ? "center" : undefined} />
      <FeatureGridBlock data={{ heading: "Wat leer je?", features: FEATURES_DATA.features, columns: 3 }} />
      <TextMediaBlock data={{ eyebrow: "Spreker", heading: "Marie van den Berg", ctas: [{ label: "Bekijk profiel", href: "#" }], mediaUrl: pic("team-ceo", 400, 400), mediaType: "image", mediaAlt: "Spreker" }} variant="text_media_right" />
      <TestimonialSectionBlock data={{ heading: "Wat vorige deelnemers zeggen", testimonials: TESTIMONIALS_DATA.testimonials }} />
      <W bg={sectBg(p, true)}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <SH eyebrow="Laatste plekken" title="Registreer nu gratis" sub="Het webinar start op 28 mei om 15:00. Deelname is volledig gratis." p={p} />
          <Card p={p} style={{ padding: "2rem", textAlign: "left" }}>
            <FormSectionBlock data={{ formKey: "contact", title: "", submitLabel: "Registreer gratis" }} />
          </Card>
        </div>
      </W>
      <FaqSectionBlock data={FAQ_DATA} />
    </>
  );
}

function PrijzenPage({ p }: { p: P }) {
  const plans = [
    { name: "Starter", price: "€ 950", per: "/ maand", highlight: false, desc: "Voor kleinere organisaties die willen beginnen.", features: ["Tot 5 gebruikers", "Basis analytics", "E-mail support", "1 integratie"] },
    { name: "Groei", price: "€ 2.450", per: "/ maand", highlight: true, desc: "De meest gekozen keuze voor groeiende teams.", features: ["Tot 25 gebruikers", "Geavanceerde analytics", "Prioriteitssupport", "Onbeperkte integraties", "API-toegang"] },
    { name: "Enterprise", price: "Op maat", per: "", highlight: false, desc: "Voor grote organisaties met specifieke eisen.", features: ["Onbeperkt gebruikers", "Dedicated support", "SLA 99.9%", "Custom integraties", "Security review"] },
  ];
  const featRows = [["Gebruikers", "Tot 5", "Tot 25", "Onbeperkt"], ["Analytics", "Basis", "Geavanceerd", "Custom"], ["Integraties", "1", "Onbeperkt", "Custom"], ["Support", "E-mail", "Prioriteit", "Dedicated"], ["API-toegang", "—", "✓", "✓"], ["SLA", "—", "99.5%", "99.9%"], ["Onboarding", "Zelfservice", "Begeleide setup", "Volledig managed"]];

  if (p === "corporate") return (
    <>
      {/* Ruled breadcrumb header */}
      <W bg={sectBg(p, true)} py="2.5rem">
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "1.5rem", letterSpacing: "0.04em" }}>Tarieven</div>
        <div style={{ borderBottom: "2px solid var(--border)", paddingBottom: "2rem" }}>
          <div style={eyeS(p)}>Investering</div>
          <h1 style={{ ...headS(p, "xl"), marginTop: "0.75rem" }}>Transparante prijzen</h1>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginTop: "1rem", maxWidth: 600 }}>We geloven in eerlijkheid. Geen verborgen kosten, geen onaangename verrassingen. Kies het plan dat past bij uw organisatie.</p>
        </div>
      </W>
      {/* 3-col pricing in ruled grid */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, border: "1px solid var(--border)" }}>
          {plans.map((plan, i) => (
            <div key={plan.name} style={{ padding: "2rem", borderRight: i < 2 ? "1px solid var(--border)" : "none", background: plan.highlight ? "var(--primary)" : "transparent" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.7)" : "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{plan.name}</div>
              <div style={{ fontFamily: GEO, fontSize: "2.25rem", fontWeight: 700, color: plan.highlight ? "#fff" : "var(--text)", marginTop: "0.5rem" }}>{plan.price}</div>
              {plan.per && <div style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>{plan.per}</div>}
              <p style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.8)" : "var(--text-muted)", marginTop: "0.75rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>{plan.desc}</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem", marginBottom: "1.5rem" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: "0.625rem", fontSize: 13 }}>
                    <span style={{ color: plan.highlight ? "#fff" : "var(--primary)", fontWeight: 700 }}>→</span>
                    <span style={{ color: plan.highlight ? "rgba(255,255,255,0.9)" : "var(--text-muted)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <span style={{ display: "block", padding: "0.75rem", textAlign: "center" as const, fontFamily: GEO, fontWeight: 700, fontSize: 14, cursor: "pointer", border: plan.highlight ? "2px solid #fff" : "1px solid var(--border)", color: plan.highlight ? "#fff" : "var(--primary)", background: "transparent" }}>
                {plan.name === "Enterprise" ? "Neem contact op" : "Aan de slag"}
              </span>
            </div>
          ))}
        </div>
      </W>
      {/* Features comparison table */}
      <W bg={sectBg(p, true)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Alles inbegrepen</h2>
        <div style={{ border: "1px solid var(--border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "var(--primary)", color: "#fff" }}>
            {["Feature", "Starter", "Groei", "Enterprise"].map(h => (
              <div key={h} style={{ padding: "0.75rem 1rem", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{h}</div>
            ))}
          </div>
          {featRows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: i < featRows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ padding: "0.875rem 1rem", fontFamily: GEO, fontWeight: 600, color: "var(--text)" }}>{row[0]}</div>
              {row.slice(1).map((v, j) => (
                <div key={j} style={{ padding: "0.875rem 1rem", fontSize: 13, color: v === "—" ? "var(--border)" : "var(--text-muted)" }}>{v}</div>
              ))}
            </div>
          ))}
        </div>
      </W>
      {/* FAQ ruled */}
      <W bg={sectBg(p)} py="3rem">
        <h2 style={{ ...headS(p, "lg"), marginBottom: "1.5rem" }}>Veelgestelde vragen</h2>
        <div style={{ border: "1px solid var(--border)" }}>
          {FAQ_DATA.items.slice(0, 4).map((f, i) => (
            <div key={i} style={{ padding: "1.25rem 1.5rem", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{f.question}</div>
              <div style={{ color: "var(--text-muted)", lineHeight: 1.65 }}>{f.answer}</div>
            </div>
          ))}
        </div>
      </W>
      {/* CTA bar */}
      <div style={{ background: "var(--primary)", padding: "3rem 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" as const }}>
          <div><div style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>Weet u nog niet welk plan past?</div><div style={{ color: "rgba(255,255,255,0.8)", marginTop: "0.25rem" }}>We helpen u graag de juiste keuze maken.</div></div>
          <span style={{ background: "#fff", color: "var(--primary)", padding: "0.875rem 2rem", fontWeight: 700, fontFamily: GEO, cursor: "pointer", display: "inline-block" }}>Praat met ons</span>
        </div>
      </div>
    </>
  );

  if (p === "tech") return (
    <>
      {/* Dark centered header */}
      <div style={{ background: sectBg(p), padding: "5rem 2rem 4rem", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={eyeS(p)}>// pricing</div>
          <h1 style={{ ...headS(p, "xl"), marginTop: "1rem" }}>Eerlijke prijzen. Geen verrassingen.</h1>
          <p style={{ color: "var(--text-muted)", marginTop: "1rem", lineHeight: 1.65, fontSize: "1.0625rem" }}>Alle plannen inclusief onboarding en support. Schakel op elk moment op of af.</p>
        </div>
      </div>
      {/* Pricing cards with outline highlight */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {plans.map(plan => (
            <div key={plan.name} style={{ ...cardS(p), padding: "2rem", border: plan.highlight ? "2px solid var(--primary)" : "1px solid var(--border)", position: "relative" as const }}>
              {plan.highlight && <div style={{ position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--primary)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "0.25rem 0.875rem", borderRadius: 100, fontFamily: "monospace" }}>meest gekozen</div>}
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary)", fontWeight: 700, marginBottom: "0.5rem" }}>{plan.name.toLowerCase()}</div>
              <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "var(--text)" }}>{plan.price}</div>
              {plan.per && <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)" }}>{plan.per}</div>}
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "0.75rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>{plan.desc}</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem", marginBottom: "1.5rem" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: "0.625rem", fontSize: 13 }}>
                    <span style={{ fontFamily: "monospace", color: "var(--primary)", fontWeight: 700 }}>✓</span>
                    <span style={{ color: "var(--text-muted)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <span style={{ ...btnS(p), display: "block", textAlign: "center" as const }}>{plan.name === "Enterprise" ? "Contact" : "Aan de slag"}</span>
            </div>
          ))}
        </div>
      </W>
      {/* FAQ 2-col dark cards */}
      <W bg={sectBg(p)} py="3rem">
        <div style={eyeS(p)}>// faq</div>
        <h2 style={{ ...headS(p, "lg"), marginTop: "0.75rem", marginBottom: "1.5rem" }}>Veelgestelde vragen</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {FAQ_DATA.items.slice(0, 4).map((f, i) => (
            <div key={i} style={{ ...cardS(p), padding: "1.5rem" }}>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{f.question}</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.answer}</div>
            </div>
          ))}
        </div>
      </W>
      {/* Terminal CTA */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ ...cardS(p), padding: "2rem", maxWidth: 560, margin: "0 auto", borderTop: "2px solid var(--primary)" }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--primary)", marginBottom: "1rem" }}>$ talk-to-sales --topic=pricing</div>
          <h3 style={{ ...headS(p, "md"), marginBottom: "0.5rem" }}>Weet u nog niet welk plan past?</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>We helpen u graag de juiste keuze maken — geheel vrijblijvend.</p>
          <span style={{ ...btnS(p), display: "inline-block" }}>Praat met ons</span>
        </div>
      </W>
    </>
  );

  if (p === "editorial") return (
    <>
      {/* Magazine centered header */}
      <W bg={sectBg(p, true)} py="4rem">
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={eyeS(p)}>Tarieven</div>
          <h1 style={{ fontFamily: GEO, fontSize: "clamp(2.5rem,5vw,4rem)", fontWeight: 700, color: "var(--text)", lineHeight: 1.1, margin: "0.75rem 0 1rem" }}>Transparante prijzen</h1>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>We geloven in eerlijkheid. Kies het plan dat past bij uw organisatie.</p>
          <div style={{ width: 48, height: 2, background: "var(--primary)", margin: "1.5rem auto 0" }} />
        </div>
      </W>
      <Div p={p} />
      {/* Editorial rounded pricing cards */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.5rem" }}>
          {plans.map(plan => (
            <div key={plan.name} style={{ padding: "2rem", borderRadius: 16, border: plan.highlight ? `2px solid var(--primary)` : "1px solid var(--border)", background: plan.highlight ? "#fff" : "transparent", boxShadow: plan.highlight ? "0 8px 32px rgba(0,0,0,0.08)" : "none", position: "relative" as const }}>
              {plan.highlight && <div style={{ position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--primary)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "0.25rem 0.875rem", borderRadius: 100 }}>Meest gekozen</div>}
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>{plan.name}</div>
              <div style={{ fontFamily: GEO, fontSize: "2.25rem", fontWeight: 700, color: "var(--text)" }}>{plan.price}</div>
              {plan.per && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{plan.per}</div>}
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "0.75rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>{plan.desc}</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.625rem", marginBottom: "1.5rem" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: "0.625rem", fontSize: 13 }}>
                    <span style={{ color: "var(--primary)", fontFamily: GEO, fontWeight: 700, flexShrink: 0 }}>✦</span>
                    <span style={{ color: "var(--text-muted)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <span style={{ ...btnS(p), display: "block", textAlign: "center" as const }}>{plan.name === "Enterprise" ? "Neem contact op" : "Aan de slag"}</span>
            </div>
          ))}
        </div>
      </W>
      {/* FAQ editorial */}
      <W bg={sectBg(p, true)} py="3rem">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ borderBottom: "2px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem" }}>
            <h2 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>Veelgestelde vragen</h2>
          </div>
          {FAQ_DATA.items.slice(0, 4).map((f, i) => (
            <div key={i} style={{ paddingBottom: "1.5rem", marginBottom: "1.5rem", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
              <h3 style={{ fontFamily: GEO, fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>{f.question}</h3>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.75 }}>{f.answer}</p>
            </div>
          ))}
        </div>
      </W>
      <W bg={sectBg(p)} py="3rem">
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontFamily: GEO, fontSize: "1.375rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.5rem" }}>Weet u nog niet welk plan past?</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: "1.25rem" }}>We helpen u graag de juiste keuze maken — geheel vrijblijvend.</p>
          <span style={{ ...btnS(p), display: "inline-block" }}>Praat met ons</span>
        </div>
      </W>
    </>
  );

  // energetic
  return (
    <>
      {/* Diagonal primary hero */}
      <div style={{ background: "var(--primary)", clipPath: "polygon(0 0,100% 0,100% 88%,0 100%)", padding: "4rem 2rem 6rem", textAlign: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ ...eyeS(p), marginBottom: "1rem" }}>Tarieven</div>
          <h1 style={{ ...headS(p, "xl"), color: "#fff", margin: "0 0 1rem" }}>TRANSPARANTE PRIJZEN</h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", maxWidth: 540, lineHeight: 1.6, margin: "0 auto" }}>Geen verborgen kosten. Geen verrassingen. Schakel op elk moment op of af.</p>
        </div>
      </div>
      {/* Bold pricing cards (4px primary top border for highlighted) */}
      <W bg={sectBg(p)} py="3rem">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {plans.map(plan => (
            <Card key={plan.name} p={p} style={{ padding: "2rem", borderTop: plan.highlight ? "4px solid var(--primary)" : "2px solid var(--border)", position: "relative" as const }}>
              {plan.highlight && <div style={{ position: "absolute" as const, top: -12, left: "1.5rem", background: "var(--primary)", color: "#fff", fontSize: 11, fontWeight: 900, padding: "0.25rem 0.875rem", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>MEEST GEKOZEN</div>}
              <div style={{ fontSize: 11, fontWeight: 900, color: plan.highlight ? "var(--primary)" : "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>{plan.name}</div>
              <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "var(--text)" }}>{plan.price}</div>
              {plan.per && <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>{plan.per}</div>}
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "0.75rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>{plan.desc}</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem", marginBottom: "1.5rem" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: "0.625rem", fontSize: 13 }}>
                    <span style={{ color: "var(--primary)", fontWeight: 900 }}>✓</span>
                    <span style={{ color: "var(--text-muted)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <span style={{ ...btnS(p), display: "block", textAlign: "center" as const }}>{plan.name === "Enterprise" ? "NEEM CONTACT OP" : "AAN DE SLAG"}</span>
            </Card>
          ))}
        </div>
      </W>
      {/* Primary CTA */}
      <div style={{ background: "var(--primary)", padding: "3rem 2rem", textAlign: "center" }}>
        <h3 style={{ fontFamily: GEO, fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>WEET U NOG NIET WELK PLAN PAST?</h3>
        <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>We helpen u graag de juiste keuze maken — geheel vrijblijvend.</p>
        <span style={{ display: "inline-block", background: "#fff", color: "var(--primary)", padding: "0.875rem 2rem", fontWeight: 900, cursor: "pointer" }}>PRAAT MET ONS</span>
      </div>
    </>
  );
}

function ZoekenPage({ p }: { p: P }) {
  const isD = p === "tech";
  return (
    <W bg={isD ? "#0d1527" : sectBg(p)} py="4rem">
      <SearchBlock data={{ title: "Zoeken", placeholder: "Zoek op naam, dienst of onderwerp...", description: "Zoek door onze content, diensten en vacatures." }} />
    </W>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ThemeWebPreview({ presetKey }: { presetKey: string }) {
  const [page, setPage] = useState<PageId>("home");
  const profile = getProfile(presetKey);

  const pages: Record<PageId, React.ReactNode> = {
    "home":           <HomePage           p={profile} />,
    "over-ons":       <AboutPage          p={profile} />,
    "diensten":       <DienstenPage       p={profile} />,
    "dienst-detail":  <DienstDetailPage   p={profile} />,
    "blog-list":      <BlogListPage       p={profile} />,
    "blog-detail":    <BlogDetailPage     p={profile} />,
    "jobs-list":      <JobsListPage       p={profile} />,
    "jobs-detail":    <JobDetailPage      p={profile} />,
    "contact":        <ContactPage        p={profile} />,
    "agenda":         <AgendaPage         p={profile} />,
    "event-detail":   <EventDetailPage    p={profile} />,
    "producten":      <ProductenPage      p={profile} />,
    "product-detail": <ProductDetailPage  p={profile} />,
    "winkelwagen":    <WinkelwagenPage     p={profile} />,
    "checkout":       <CheckoutPage       p={profile} />,
    "landingspagina": <LandingspaginaPage p={profile} />,
    "prijzen":        <PrijzenPage        p={profile} />,
    "zoeken":         <ZoekenPage         p={profile} />,
  };

  // Tab strip: profile-specific background + typography
  const tabBg  = profile === "tech" ? "var(--bg-subtle)" : profile === "energetic" ? "var(--primary)" : "var(--bg)";
  const tabBdr = profile === "editorial" ? "2px solid var(--border-strong)" : "1px solid var(--border)";
  const tabFont = profile === "editorial" ? GEO : profile === "tech" ? "monospace" : fH;
  const tabC = (active: boolean): React.CSSProperties => {
    if (profile === "energetic") return { color: active ? "var(--btn-text,#fff)" : "rgba(255,255,255,0.6)", borderBottom: active ? "3px solid var(--btn-text,#fff)" : "3px solid transparent", fontWeight: 700 };
    if (profile === "editorial") return { fontFamily: GEO, color: active ? "var(--text)" : "var(--text-muted)", borderBottom: active ? "2px solid var(--text)" : "2px solid transparent", fontStyle: "italic" as const };
    if (profile === "tech")      return { fontFamily: "monospace", color: active ? "var(--primary)" : "var(--text-muted)", borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent", fontSize: 11 };
    return { color: active ? "var(--primary)" : "var(--text-muted)", borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent" };
  };

  return (
    <div data-site="" style={{ minHeight: "100vh", background: "var(--bg, #ffffff)" }}>
      <ProfileHeader p={profile} />
      <div style={{ background: tabBg, borderBottom: tabBdr, overflowX: "auto" as const, position: "sticky" as const, top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", minWidth: "max-content", padding: "0 0.5rem" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setPage(t.id)}
              style={{ padding: "0.625rem 0.75rem", fontSize: 11, fontWeight: 600, fontFamily: tabFont, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" as const, ...tabC(t.id === page) }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {pages[page]}
      <ProfileFooter p={profile} />
    </div>
  );
}

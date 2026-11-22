/**
 * Mister Chameleon — the platform's own house style as a gallery preset.
 *
 * Follows docs/website/huisstijl.md, which sums up the logo manual, the four
 * leaflets and the folder (2011). Every colour below is one of the 18 colours
 * of the logo's gradient, the manual's black, white, or a neutral grey.
 *
 *   - White pages, black text (#1a171b), a lot of white.
 *   - One colour per piece for headings and buttons. The leaflets use purple,
 *     blue, magenta or green; this preset takes purple (#672180).
 *   - Headings in bold capitals.
 *   - Hero and footer black with white text, as the folder. The footer's top
 *     line is the folder's light blue (#009ee0).
 *   - Flat: no gradients (hero and CTA are one solid colour each) and hardly
 *     any shadow.
 *
 * Type: the documents are set in Gotham (Black, Bold, Medium, Book). Gotham is
 * a licensed typeface the platform cannot serve, so the preset uses Montserrat,
 * the closest face in lib/supported-fonts.ts. Swap it in Design → Typography
 * once a Gotham web licence is in place.
 *
 * The preset carries a brand layer: applying it also switches on the flat
 * circles of app/brand/mister-chameleon.css (see lib/brand/brand-layer.ts).
 *
 * Two presets without colour follow the same rules, for a site that wants the
 * house style in ink only: "Zwart-wit" (black pages, white text) and
 * "Wit-zwart" (white pages, black text). The black is the manual's black, the
 * greys are steps between it and white. Only a form's "sent" and "wrong" keep
 * the manual's green and red, because black cannot tell those two apart. They
 * carry no brand layer of their own: a site that has the circles keeps them
 * when a rule switches it to one of these (see brandLayerFor).
 */
import type { DesignPresetCard } from "./design-presets-gallery";

const BLACK   = "#1a171b";
const PURPLE  = "#672180";
const MAGENTA = "#cb005a";
const NAVY    = "#00519e";
const CYAN    = "#009ee0";
const RED     = "#e2001a";
const GREEN   = "#009036";

const GOTHAM_STAND_IN = "'Montserrat', system-ui, sans-serif";

export const MISTER_CHAMELEON_PRESET_CARDS: readonly DesignPresetCard[] = [
  {
    id: "mister-chameleon",
    name: "Mister Chameleon",
    description:
      "Mister Chameleon's own house style, after the logo manual, the leaflets and the folder. White pages, black text, headings in bold capitals and the purple of the logo. Comes with the flat circles.",
    category: "House style",
    baseTheme: "custom",
    brandLayer: "mister-chameleon",
    swatch: { primary: PURPLE, background: "#ffffff", foreground: BLACK, accent: MAGENTA },
    tokenOverrides: {
      color: {
        primary: PURPLE,
        // A darker step of the same purple for hover; the manual has no hover colour.
        primaryHover: "#521a66",
        onPrimary: "#ffffff",
        secondary: MAGENTA,
        accent: "#f2f1f2",
        background: "#ffffff",
        foreground: BLACK,
        muted: "#f5f4f5",
        mutedForeground: "#5c585d",
        border: "#e3e1e4",
        card: "#ffffff",
        cardForeground: BLACK,
        link: NAVY,
        success: GREEN,
        danger: RED,
        // One solid colour each: the house style has no gradients.
        gradient: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE} 100%)`,
        gradientHero: `linear-gradient(180deg, ${BLACK} 0%, ${BLACK} 100%)`,
      },
      typography: {
        fontHeading: GOTHAM_STAND_IN,
        fontBody: GOTHAM_STAND_IN,
        fontSans: GOTHAM_STAND_IN,
        fontUI: GOTHAM_STAND_IN,
        headingWeight: "800",
        letterSpacing: "0",
        headingTransform: "uppercase",
        headingLineHeight: "1.1",
      },
      radius: { interactive: "6px", card: "10px", popover: "8px", sm: "4px", md: "6px", lg: "10px", full: "9999px" },
      shadow: { md: "0 1px 2px rgba(26,23,27,.08)", lg: "0 6px 18px rgba(26,23,27,.10)" },
      border: { width: "1px" },
      spacing: { base: "1rem", sectionPadding: "clamp(36px,4.5vw,64px)", container: "72rem", align: "center" },
      component: { buttonPaddingX: "1.4rem", buttonPaddingY: ".75rem" },
      motion: { hoverLift: "-2px" },
      layout: {
        headerBg: "#ffffff", headerBgScrolled: "#ffffff", headerFg: BLACK, headerBorder: "#e3e1e4",
        footerBg: BLACK, footerFg: "#ffffff", footerBorder: CYAN,
        navLinkSize: "0.95rem", navLinkWeight: "700", navLinkTracking: "0", navTransform: "none",
      },
      focus: { ringWidth: "3px", ringColor: NAVY },
    },
  },
  {
    id: "zwart-wit",
    name: "Zwart-wit",
    description:
      "The Mister Chameleon house style in ink only, dark. Black pages, white text, white buttons with black text, headings in bold capitals. No colour except a form's green and red.",
    category: "House style",
    baseTheme: "custom",
    swatch: { primary: "#ffffff", background: BLACK, foreground: "#ffffff", accent: "#2b272c" },
    tokenOverrides: {
      color: {
        primary: "#ffffff",
        primaryHover: "#e3e1e4",
        onPrimary: BLACK,
        secondary: "#bdbabe",
        accent: "#2b272c",
        background: BLACK,
        foreground: "#ffffff",
        muted: "#232024",
        mutedForeground: "#bdbabe",
        border: "#3d393e",
        card: "#232024",
        cardForeground: "#ffffff",
        link: "#ffffff",
        // Lighter steps of the manual's green and red, so they read on black.
        success: "#3fbf6e",
        danger: "#ff5a68",
        // The closing block is a white band with black text. Hero as the page.
        gradient: `linear-gradient(135deg, #ffffff 0%, #ffffff 100%)`,
        gradientHero: `linear-gradient(180deg, ${BLACK} 0%, ${BLACK} 100%)`,
      },
      typography: {
        fontHeading: GOTHAM_STAND_IN,
        fontBody: GOTHAM_STAND_IN,
        fontSans: GOTHAM_STAND_IN,
        fontUI: GOTHAM_STAND_IN,
        headingWeight: "800",
        letterSpacing: "0",
        headingTransform: "uppercase",
        headingLineHeight: "1.1",
      },
      radius: { interactive: "6px", card: "10px", popover: "8px", sm: "4px", md: "6px", lg: "10px", full: "9999px" },
      shadow: { md: "none", lg: "none" },
      border: { width: "1px" },
      spacing: { base: "1rem", sectionPadding: "clamp(36px,4.5vw,64px)", container: "72rem", align: "center" },
      component: { buttonPaddingX: "1.4rem", buttonPaddingY: ".75rem" },
      motion: { hoverLift: "-2px" },
      layout: {
        headerBg: BLACK, headerBgScrolled: BLACK, headerFg: "#ffffff", headerBorder: "#3d393e",
        footerBg: BLACK, footerFg: "#ffffff", footerBorder: "#ffffff",
        navLinkSize: "0.95rem", navLinkWeight: "700", navLinkTracking: "0", navTransform: "none",
      },
      focus: { ringWidth: "3px", ringColor: "#ffffff" },
    },
  },
  {
    id: "wit-zwart",
    name: "Wit-zwart",
    description:
      "The Mister Chameleon house style in ink only, light. White pages, black text, black buttons with white text, headings in bold capitals. No colour except a form's green and red.",
    category: "House style",
    baseTheme: "custom",
    swatch: { primary: BLACK, background: "#ffffff", foreground: BLACK, accent: "#f2f1f2" },
    tokenOverrides: {
      color: {
        primary: BLACK,
        primaryHover: "#000000",
        onPrimary: "#ffffff",
        secondary: "#5c585d",
        accent: "#f2f1f2",
        background: "#ffffff",
        foreground: BLACK,
        muted: "#f5f4f5",
        mutedForeground: "#5c585d",
        border: "#d6d4d7",
        card: "#ffffff",
        cardForeground: BLACK,
        link: BLACK,
        success: GREEN,
        danger: RED,
        // The closing block is a black band. The hero is white, like the page.
        gradient: `linear-gradient(135deg, ${BLACK} 0%, ${BLACK} 100%)`,
        gradientHero: `linear-gradient(180deg, #ffffff 0%, #ffffff 100%)`,
      },
      typography: {
        fontHeading: GOTHAM_STAND_IN,
        fontBody: GOTHAM_STAND_IN,
        fontSans: GOTHAM_STAND_IN,
        fontUI: GOTHAM_STAND_IN,
        headingWeight: "800",
        letterSpacing: "0",
        headingTransform: "uppercase",
        headingLineHeight: "1.1",
      },
      radius: { interactive: "6px", card: "10px", popover: "8px", sm: "4px", md: "6px", lg: "10px", full: "9999px" },
      shadow: { md: "none", lg: "none" },
      border: { width: "1px" },
      spacing: { base: "1rem", sectionPadding: "clamp(36px,4.5vw,64px)", container: "72rem", align: "center" },
      component: { buttonPaddingX: "1.4rem", buttonPaddingY: ".75rem" },
      motion: { hoverLift: "-2px" },
      layout: {
        headerBg: "#ffffff", headerBgScrolled: "#ffffff", headerFg: BLACK, headerBorder: "#d6d4d7",
        footerBg: "#ffffff", footerFg: BLACK, footerBorder: BLACK,
        navLinkSize: "0.95rem", navLinkWeight: "700", navLinkTracking: "0", navTransform: "none",
      },
      focus: { ringWidth: "3px", ringColor: BLACK },
    },
  },
];

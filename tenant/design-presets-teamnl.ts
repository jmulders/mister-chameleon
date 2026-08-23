/**
 * TeamNL Oranje preset — official Holland Orange palette.
 *
 * Orange #FF9B00, flag red #BF3922, cobalt #193153, white. White button text on
 * orange/cobalt to match the official Team Oranje / OnsOranje button style.
 * For Team Oranje, sport and Koningsdag. Category "Occasion & Themed".
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const TEAMNL_PRESET_CARDS: readonly DesignPresetCard[] = [
  {
    "id": "teamnl-oranje",
    "name": "TeamNL Oranje",
    "description": "Official Holland Orange with the Dutch flag red, cobalt blue and white. For Team Oranje, sport and Koningsdag.",
    "category": "Occasion & Themed",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#ff9b00",
      "background": "#fff8ee",
      "foreground": "#16202e",
      "accent": "#193153"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#ff9b00",
        "primaryHover": "#e08a00",
        "onPrimary": "#ffffff",
        "secondary": "#193153",
        "accent": "#193153",
        "background": "#fff8ee",
        "foreground": "#16202e",
        "muted": "#ffedd6",
        "mutedForeground": "#5f6a78",
        "border": "#f0ddc4",
        "card": "#ffffff",
        "cardForeground": "#16202e",
        "link": "#193153",
        "success": "#3f8a6a",
        "danger": "#bf3922",
        "gradient": "linear-gradient(135deg, #ff9b00 0%, #193153 120%)",
        "gradientHero": "linear-gradient(135deg, #16202e 0%, #193153 45%, #ff9b00 110%)"
      },
      "typography": {
        "fontHeading": "'Oswald', system-ui, sans-serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "fontSans": "'Work Sans', system-ui, sans-serif",
        "fontUI": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.1"
      },
      "radius": {
        "interactive": "8px",
        "card": "14px",
        "popover": "10px",
        "sm": "5px",
        "md": "8px",
        "lg": "14px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(25,49,83,.14)",
        "lg": "0 20px 48px rgba(25,49,83,.18)"
      },
      "border": {
        "width": "1px"
      },
      "component": {
        "buttonPaddingX": "1.25rem",
        "buttonPaddingY": ".7rem"
      },
      "motion": {
        "hoverLift": "-3px"
      },
      "layout": {
        "headerBg": "#fff8ee",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#16202e",
        "headerBorder": "#f0ddc4",
        "footerBg": "#16202e",
        "footerFg": "#ffedd6",
        "footerBorder": "#ff9b00",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#ff9b00"
      }
    }
  }
] as const;

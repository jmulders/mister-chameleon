/**
 * LAB Colour presets: heritage expansion.
 *
 * 24 further complete-look presets based on the LAB Colour Library and its
 * heritage paint friends (Farrow & Ball, Little Greene), plus pastels, jewel
 * tones and dark schemes to broaden the range. Same shape as LAB_PRESET_CARDS;
 * spread alongside it into DESIGN_PRESET_GALLERY. Fonts are supported Google
 * Fonts (see lib/fonts.ts). Descriptions are English.
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const LAB_HERITAGE_CARDS: readonly DesignPresetCard[] = [
  {
    "id": "dove-grey-blush",
    "name": "Dove Grey & Blush",
    "description": "Dove Grey + Blush. Soft dove grey with a blush accent. Quiet, soft, contemporary.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#7d7a76",
      "background": "#f2f0ec",
      "foreground": "#2f2d2a",
      "accent": "#d8a9a4"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#7d7a76",
        "primaryHover": "#666460",
        "onPrimary": "#ffffff",
        "secondary": "#d8a9a4",
        "accent": "#d8a9a4",
        "background": "#f2f0ec",
        "foreground": "#2f2d2a",
        "muted": "#e6e3dc",
        "mutedForeground": "#71706b",
        "border": "#d8d5cd",
        "card": "#ffffff",
        "cardForeground": "#2f2d2a",
        "link": "#69675f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #7d7a76 0%, #d8a9a4 120%)",
        "gradientHero": "linear-gradient(180deg, #2b2a27 0%, #47453f 55%, #7d7a76 100%)"
      },
      "typography": {
        "fontHeading": "'Manrope', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f2f0ec",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2f2d2a",
        "headerBorder": "#d8d5cd",
        "footerBg": "#2b2a27",
        "footerFg": "#e6e3dc",
        "footerBorder": "#7d7a76",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#7d7a76"
      }
    }
  },
  {
    "id": "graphite-linen",
    "name": "Graphite & Linen",
    "description": "Graphite + Linen. Deep warm graphite on linen. Serious, minimal, grounded.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4a4744",
      "background": "#efeade",
      "foreground": "#2a2724",
      "accent": "#c3b48a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4a4744",
        "primaryHover": "#393633",
        "onPrimary": "#ffffff",
        "secondary": "#c3b48a",
        "accent": "#c3b48a",
        "background": "#efeade",
        "foreground": "#2a2724",
        "muted": "#e3dbc8",
        "mutedForeground": "#6f6a63",
        "border": "#d6ceba",
        "card": "#ffffff",
        "cardForeground": "#2a2724",
        "link": "#5a544a",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #4a4744 0%, #c3b48a 120%)",
        "gradientHero": "linear-gradient(180deg, #22201d 0%, #333130 55%, #4a4744 100%)"
      },
      "typography": {
        "fontHeading": "'PT Serif', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#efeade",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2a2724",
        "headerBorder": "#d6ceba",
        "footerBg": "#22201d",
        "footerFg": "#e3dbc8",
        "footerBorder": "#4a4744",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4a4744"
      }
    }
  },
  {
    "id": "amethyst-bone",
    "name": "Amethyst & Bone",
    "description": "Amethyst + Bone. Jewel purple on warm bone. Rich, distinctive, refined.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6a4a80",
      "background": "#f2edf0",
      "foreground": "#281f2a",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6a4a80",
        "primaryHover": "#553a67",
        "onPrimary": "#ffffff",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#f2edf0",
        "foreground": "#281f2a",
        "muted": "#e8dde6",
        "mutedForeground": "#776b78",
        "border": "#ded0da",
        "card": "#ffffff",
        "cardForeground": "#281f2a",
        "link": "#6a4a80",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6a4a80 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #241a2c 0%, #392a48 55%, #6a4a80 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
        "fontBody": "'Mulish', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f2edf0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#281f2a",
        "headerBorder": "#ded0da",
        "footerBg": "#241a2c",
        "footerFg": "#e8dde6",
        "footerBorder": "#6a4a80",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6a4a80"
      }
    }
  },
  {
    "id": "bronze-red-linen",
    "name": "Bronze Red & Linen",
    "description": "Bronze Red + Linen. Deep terracotta-red on warm linen. Bold, warm, crafted.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#9a4a34",
      "background": "#f1e8d9",
      "foreground": "#3a241c",
      "accent": "#d8c19a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#9a4a34",
        "primaryHover": "#803a28",
        "onPrimary": "#ffffff",
        "secondary": "#d8c19a",
        "accent": "#d8c19a",
        "background": "#f1e8d9",
        "foreground": "#3a241c",
        "muted": "#e7dcc4",
        "mutedForeground": "#8a6a5a",
        "border": "#e0d0b8",
        "card": "#ffffff",
        "cardForeground": "#3a241c",
        "link": "#853d2a",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #9a4a34 0%, #d8c19a 120%)",
        "gradientHero": "linear-gradient(180deg, #3a241c 0%, #6a3325 55%, #9a4a34 100%)"
      },
      "typography": {
        "fontHeading": "'Merriweather', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f1e8d9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a241c",
        "headerBorder": "#e0d0b8",
        "footerBg": "#3a241c",
        "footerFg": "#e7dcc4",
        "footerBorder": "#9a4a34",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#9a4a34"
      }
    }
  },
  {
    "id": "buttermilk-slate",
    "name": "Buttermilk & Slate",
    "description": "Buttermilk + Slate. Soft warm yellow with a cool slate accent. Bright, gentle, balanced.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b8973a",
      "background": "#f6f0dd",
      "foreground": "#3a3320",
      "accent": "#5f6d78"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b8973a",
        "primaryHover": "#9a7c2c",
        "onPrimary": "#ffffff",
        "secondary": "#5f6d78",
        "accent": "#5f6d78",
        "background": "#f6f0dd",
        "foreground": "#3a3320",
        "muted": "#ece2c3",
        "mutedForeground": "#867a54",
        "border": "#ddd0ab",
        "card": "#ffffff",
        "cardForeground": "#3a3320",
        "link": "#9a7c2c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b8973a 0%, #5f6d78 120%)",
        "gradientHero": "linear-gradient(180deg, #322913 0%, #6b5827 55%, #b8973a 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f6f0dd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a3320",
        "headerBorder": "#ddd0ab",
        "footerBg": "#322913",
        "footerFg": "#ece2c3",
        "footerBorder": "#b8973a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b8973a"
      }
    }
  },
  {
    "id": "coral-cream",
    "name": "Coral & Cream",
    "description": "Coral + Cream. Soft coral on warm cream. Friendly, warm, inviting.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#d1705f",
      "background": "#f6ede2",
      "foreground": "#3a2822",
      "accent": "#d8c6a8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#d1705f",
        "primaryHover": "#b95a4a",
        "onPrimary": "#ffffff",
        "secondary": "#d8c6a8",
        "accent": "#d8c6a8",
        "background": "#f6ede2",
        "foreground": "#3a2822",
        "muted": "#ece0cd",
        "mutedForeground": "#8a6f62",
        "border": "#e0d2bd",
        "card": "#ffffff",
        "cardForeground": "#3a2822",
        "link": "#bd5c4c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #d1705f 0%, #d8c6a8 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2822 0%, #7a4438 55%, #d1705f 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
        "fontBody": "'Nunito', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f6ede2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2822",
        "headerBorder": "#e0d2bd",
        "footerBg": "#3a2822",
        "footerFg": "#ece0cd",
        "footerBorder": "#d1705f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#d1705f"
      }
    }
  },
  {
    "id": "dead-salmon-ammonite",
    "name": "Dead Salmon & Ammonite",
    "description": "Dead Salmon + Ammonite. Muted rose-brown on cool grey. Heritage, soft, grounded.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#a4796e",
      "background": "#f0e8de",
      "foreground": "#3a2c26",
      "accent": "#9c978c"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#a4796e",
        "primaryHover": "#8c6459",
        "onPrimary": "#ffffff",
        "secondary": "#9c978c",
        "accent": "#9c978c",
        "background": "#f0e8de",
        "foreground": "#3a2c26",
        "muted": "#e4d8cb",
        "mutedForeground": "#847069",
        "border": "#ddccbd",
        "card": "#ffffff",
        "cardForeground": "#3a2c26",
        "link": "#8c6459",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #a4796e 0%, #9c978c 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2c26 0%, #6f4f47 55%, #a4796e 100%)"
      },
      "typography": {
        "fontHeading": "'Lora', Georgia, serif",
        "fontBody": "'Mulish', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f0e8de",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2c26",
        "headerBorder": "#ddccbd",
        "footerBg": "#3a2c26",
        "footerFg": "#e4d8cb",
        "footerBorder": "#a4796e",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#a4796e"
      }
    }
  },
  {
    "id": "dusty-lilac-bone",
    "name": "Dusty Lilac & Bone",
    "description": "Dusty Lilac + Bone. Soft muted purple on warm bone. Gentle, contemporary, calm.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8a7a94",
      "background": "#f2eef0",
      "foreground": "#2f2830",
      "accent": "#c9b995"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8a7a94",
        "primaryHover": "#736380",
        "onPrimary": "#ffffff",
        "secondary": "#c9b995",
        "accent": "#c9b995",
        "background": "#f2eef0",
        "foreground": "#2f2830",
        "muted": "#e8dfe6",
        "mutedForeground": "#77707a",
        "border": "#ded1da",
        "card": "#ffffff",
        "cardForeground": "#2f2830",
        "link": "#73637f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8a7a94 0%, #c9b995 120%)",
        "gradientHero": "linear-gradient(180deg, #2a2430 0%, #453c50 55%, #8a7a94 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
        "fontBody": "'Mulish', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f2eef0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2f2830",
        "headerBorder": "#ded1da",
        "footerBg": "#2a2430",
        "footerFg": "#e8dfe6",
        "footerBorder": "#8a7a94",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8a7a94"
      }
    }
  },
  {
    "id": "marigold-clay",
    "name": "Marigold & Clay",
    "description": "Marigold + Clay. Bright marigold with a clay accent. Sunny, energetic, warm.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#cf8a2a",
      "background": "#f6efdd",
      "foreground": "#3d2f1c",
      "accent": "#a8593f"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#cf8a2a",
        "primaryHover": "#b0731f",
        "onPrimary": "#ffffff",
        "secondary": "#a8593f",
        "accent": "#a8593f",
        "background": "#f6efdd",
        "foreground": "#3d2f1c",
        "muted": "#ede0c4",
        "mutedForeground": "#8a7550",
        "border": "#ddd0ac",
        "card": "#ffffff",
        "cardForeground": "#3d2f1c",
        "link": "#b0731f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #cf8a2a 0%, #a8593f 120%)",
        "gradientHero": "linear-gradient(180deg, #332715 0%, #6b5320 55%, #cf8a2a 100%)"
      },
      "typography": {
        "fontHeading": "'Space Grotesk', system-ui, sans-serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f6efdd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3d2f1c",
        "headerBorder": "#ddd0ac",
        "footerBg": "#332715",
        "footerFg": "#ede0c4",
        "footerBorder": "#cf8a2a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#cf8a2a"
      }
    }
  },
  {
    "id": "setting-plaster-bone",
    "name": "Setting Plaster & Bone",
    "description": "Setting Plaster + Bone. Soft pink-nude on warm bone. Warm, calm, understated.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b98a7a",
      "background": "#f4ece3",
      "foreground": "#3f2f28",
      "accent": "#c9b995"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b98a7a",
        "primaryHover": "#a2725f",
        "onPrimary": "#ffffff",
        "secondary": "#c9b995",
        "accent": "#c9b995",
        "background": "#f4ece3",
        "foreground": "#3f2f28",
        "muted": "#ecddd0",
        "mutedForeground": "#8a7268",
        "border": "#e2d2c3",
        "card": "#ffffff",
        "cardForeground": "#3f2f28",
        "link": "#a2725f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b98a7a 0%, #c9b995 120%)",
        "gradientHero": "linear-gradient(180deg, #3f2f28 0%, #7a574b 55%, #b98a7a 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
        "fontBody": "'Nunito', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f4ece3",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3f2f28",
        "headerBorder": "#e2d2c3",
        "footerBg": "#3f2f28",
        "footerFg": "#ecddd0",
        "footerBorder": "#b98a7a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b98a7a"
      }
    }
  },
  {
    "id": "wine-blush",
    "name": "Wine & Blush",
    "description": "Wine + Blush. Deep burgundy with a soft blush accent. Warm, luxe, intimate.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6e2c3e",
      "background": "#f5eef0",
      "foreground": "#2e1c22",
      "accent": "#d8a9a4"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6e2c3e",
        "primaryHover": "#571f2e",
        "onPrimary": "#ffffff",
        "secondary": "#d8a9a4",
        "accent": "#d8a9a4",
        "background": "#f5eef0",
        "foreground": "#2e1c22",
        "muted": "#ecdfe1",
        "mutedForeground": "#8a6f76",
        "border": "#e2d2d6",
        "card": "#ffffff",
        "cardForeground": "#2e1c22",
        "link": "#6e2c3e",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6e2c3e 0%, #d8a9a4 120%)",
        "gradientHero": "linear-gradient(180deg, #2e1c22 0%, #4a222f 55%, #6e2c3e 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
        "fontBody": "'Nunito', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f5eef0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2e1c22",
        "headerBorder": "#e2d2d6",
        "footerBg": "#2e1c22",
        "footerFg": "#ecdfe1",
        "footerBorder": "#6e2c3e",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6e2c3e"
      }
    }
  },
  {
    "id": "card-room-green-bone",
    "name": "Card Room Green & Bone",
    "description": "Card Room Green + Bone. Deep grey-green on warm bone. Understated, heritage, quiet.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#45514a",
      "background": "#f0ece0",
      "foreground": "#2b302c",
      "accent": "#c9b995"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#45514a",
        "primaryHover": "#353f3a",
        "onPrimary": "#ffffff",
        "secondary": "#c9b995",
        "accent": "#c9b995",
        "background": "#f0ece0",
        "foreground": "#2b302c",
        "muted": "#e4ddc9",
        "mutedForeground": "#63695f",
        "border": "#d5cdb9",
        "card": "#ffffff",
        "cardForeground": "#2b302c",
        "link": "#3e4c44",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #45514a 0%, #c9b995 120%)",
        "gradientHero": "linear-gradient(180deg, #232a26 0%, #333d38 55%, #45514a 100%)"
      },
      "typography": {
        "fontHeading": "'Merriweather', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f0ece0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2b302c",
        "headerBorder": "#d5cdb9",
        "footerBg": "#232a26",
        "footerFg": "#e4ddc9",
        "footerBorder": "#45514a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#45514a"
      }
    }
  },
  {
    "id": "cooking-apple-linen",
    "name": "Cooking Apple Green & Old Linen",
    "description": "Cooking Apple Green + Old Linen. Muted apple green on linen. Natural, soft, botanical.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#7d8a5f",
      "background": "#f1efe0",
      "foreground": "#33361f",
      "accent": "#c3b48a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#7d8a5f",
        "primaryHover": "#66724b",
        "onPrimary": "#ffffff",
        "secondary": "#c3b48a",
        "accent": "#c3b48a",
        "background": "#f1efe0",
        "foreground": "#33361f",
        "muted": "#e6e2cc",
        "mutedForeground": "#6f7255",
        "border": "#d8d4b6",
        "card": "#ffffff",
        "cardForeground": "#33361f",
        "link": "#66724b",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #7d8a5f 0%, #c3b48a 120%)",
        "gradientHero": "linear-gradient(180deg, #2c2e1c 0%, #4b5138 55%, #7d8a5f 100%)"
      },
      "typography": {
        "fontHeading": "'Source Serif 4', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f1efe0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#33361f",
        "headerBorder": "#d8d4b6",
        "footerBg": "#2c2e1c",
        "footerFg": "#e6e2cc",
        "footerBorder": "#7d8a5f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#7d8a5f"
      }
    }
  },
  {
    "id": "green-smoke-slipper",
    "name": "Green Smoke & Slipper Satin",
    "description": "Green Smoke + Slipper Satin. Soft green-grey on warm white. Muted, gentle, refined.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6a7566",
      "background": "#f1eee2",
      "foreground": "#2f342c",
      "accent": "#c9b995"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6a7566",
        "primaryHover": "#556051",
        "onPrimary": "#ffffff",
        "secondary": "#c9b995",
        "accent": "#c9b995",
        "background": "#f1eee2",
        "foreground": "#2f342c",
        "muted": "#e5e1cf",
        "mutedForeground": "#6a7264",
        "border": "#d7d3bf",
        "card": "#ffffff",
        "cardForeground": "#2f342c",
        "link": "#586451",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6a7566 0%, #c9b995 120%)",
        "gradientHero": "linear-gradient(180deg, #282d24 0%, #454d40 55%, #6a7566 100%)"
      },
      "typography": {
        "fontHeading": "'Lora', Georgia, serif",
        "fontBody": "'Mulish', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f1eee2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2f342c",
        "headerBorder": "#d7d3bf",
        "footerBg": "#282d24",
        "footerFg": "#e5e1cf",
        "footerBorder": "#6a7566",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6a7566"
      }
    }
  },
  {
    "id": "hague-blue-bone",
    "name": "Hague Blue & Bone",
    "description": "Hague Blue + Bone. Deep teal-blue on warm bone. Heritage, calm, confident.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2a3b45",
      "background": "#f0ece0",
      "foreground": "#212e33",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2a3b45",
        "primaryHover": "#1f2d35",
        "onPrimary": "#ffffff",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#f0ece0",
        "foreground": "#212e33",
        "muted": "#e4dcc9",
        "mutedForeground": "#5f6d72",
        "border": "#d6ccb8",
        "card": "#ffffff",
        "cardForeground": "#212e33",
        "link": "#2f4650",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #2a3b45 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #18242a 0%, #213139 55%, #2a3b45 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
        "fontBody": "'Source Sans 3', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f0ece0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#212e33",
        "headerBorder": "#d6ccb8",
        "footerBg": "#18242a",
        "footerFg": "#e4dcc9",
        "footerBorder": "#2a3b45",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2a3b45"
      }
    }
  },
  {
    "id": "inchyra-blue-sand",
    "name": "Inchyra Blue & Sand",
    "description": "Inchyra Blue + Sand. Dark blue-green on warm sand. Moody, sophisticated, deep.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#34474a",
      "background": "#f0ebdd",
      "foreground": "#26302f",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#34474a",
        "primaryHover": "#28383a",
        "onPrimary": "#ffffff",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#f0ebdd",
        "foreground": "#26302f",
        "muted": "#e5dcc6",
        "mutedForeground": "#5f6c6a",
        "border": "#d5cdb7",
        "card": "#ffffff",
        "cardForeground": "#26302f",
        "link": "#38504f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #34474a 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #1c2828 0%, #263636 55%, #34474a 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f0ebdd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#26302f",
        "headerBorder": "#d5cdb7",
        "footerBg": "#1c2828",
        "footerFg": "#e5dcc6",
        "footerBorder": "#34474a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#34474a"
      }
    }
  },
  {
    "id": "jade-cream",
    "name": "Jade & Cream",
    "description": "Jade + Cream. Jewel jade green on warm cream. Rich, fresh, elegant.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#1f6e5a",
      "background": "#f1efe1",
      "foreground": "#1d302a",
      "accent": "#d8c69a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#1f6e5a",
        "primaryHover": "#175748",
        "onPrimary": "#ffffff",
        "secondary": "#d8c69a",
        "accent": "#d8c69a",
        "background": "#f1efe1",
        "foreground": "#1d302a",
        "muted": "#e7e1cc",
        "mutedForeground": "#5f716b",
        "border": "#d7d2b9",
        "card": "#ffffff",
        "cardForeground": "#1d302a",
        "link": "#1f6e5a",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #1f6e5a 0%, #d8c69a 120%)",
        "gradientHero": "linear-gradient(180deg, #123028 0%, #175144 55%, #1f6e5a 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f1efe1",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1d302a",
        "headerBorder": "#d7d2b9",
        "footerBg": "#123028",
        "footerFg": "#e7e1cc",
        "footerBorder": "#1f6e5a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#1f6e5a"
      }
    }
  },
  {
    "id": "pigeon-slipper",
    "name": "Pigeon & Slipper Satin",
    "description": "Pigeon + Slipper Satin. Soft blue-grey on warm white. Calm, timeless, gentle.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6f7d7a",
      "background": "#f1eee3",
      "foreground": "#2d322f",
      "accent": "#cabfa8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6f7d7a",
        "primaryHover": "#5a6764",
        "onPrimary": "#ffffff",
        "secondary": "#cabfa8",
        "accent": "#cabfa8",
        "background": "#f1eee3",
        "foreground": "#2d322f",
        "muted": "#e6e1d1",
        "mutedForeground": "#6a726f",
        "border": "#d7d2c1",
        "card": "#ffffff",
        "cardForeground": "#2d322f",
        "link": "#5c6a66",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6f7d7a 0%, #cabfa8 120%)",
        "gradientHero": "linear-gradient(180deg, #28302e 0%, #455150 55%, #6f7d7a 100%)"
      },
      "typography": {
        "fontHeading": "'Manrope', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f1eee3",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2d322f",
        "headerBorder": "#d7d2c1",
        "footerBg": "#28302e",
        "footerFg": "#e6e1d1",
        "footerBorder": "#6f7d7a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6f7d7a"
      }
    }
  },
  {
    "id": "powder-blue-stone",
    "name": "Powder Blue & Stone",
    "description": "Powder Blue + Stone. Soft pale blue on warm stone. Airy, light, serene.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#5f7d8a",
      "background": "#eef1f2",
      "foreground": "#26303a",
      "accent": "#c9bfa8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#5f7d8a",
        "primaryHover": "#4c6873",
        "onPrimary": "#ffffff",
        "secondary": "#c9bfa8",
        "accent": "#c9bfa8",
        "background": "#eef1f2",
        "foreground": "#26303a",
        "muted": "#e0e7ea",
        "mutedForeground": "#5f6d76",
        "border": "#cfd9de",
        "card": "#ffffff",
        "cardForeground": "#26303a",
        "link": "#4f6b76",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #5f7d8a 0%, #c9bfa8 120%)",
        "gradientHero": "linear-gradient(180deg, #25313a 0%, #3d525c 55%, #5f7d8a 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#eef1f2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#26303a",
        "headerBorder": "#cfd9de",
        "footerBg": "#25313a",
        "footerFg": "#e0e7ea",
        "footerBorder": "#5f7d8a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#5f7d8a"
      }
    }
  },
  {
    "id": "sapphire-sand",
    "name": "Sapphire & Sand",
    "description": "Sapphire + Sand. Jewel sapphire blue on warm sand. Deep, confident, refined.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#1c4a7a",
      "background": "#f0ecdd",
      "foreground": "#1a2738",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#1c4a7a",
        "primaryHover": "#153a61",
        "onPrimary": "#ffffff",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#f0ecdd",
        "foreground": "#1a2738",
        "muted": "#e5ddc6",
        "mutedForeground": "#5f6a7a",
        "border": "#d5cdb6",
        "card": "#ffffff",
        "cardForeground": "#1a2738",
        "link": "#22537f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #1c4a7a 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #122238 0%, #163a5f 55%, #1c4a7a 100%)"
      },
      "typography": {
        "fontHeading": "'Sora', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f0ecdd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1a2738",
        "headerBorder": "#d5cdb6",
        "footerBg": "#122238",
        "footerFg": "#e5ddc6",
        "footerBorder": "#1c4a7a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#1c4a7a"
      }
    }
  },
  {
    "id": "stiffkey-blue-shaded",
    "name": "Stiffkey Blue & Shaded White",
    "description": "Stiffkey Blue + Shaded White. Deep inky navy on soft off-white. Dramatic, classic, deep.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#26303f",
      "background": "#f0ebde",
      "foreground": "#20293a",
      "accent": "#b9a98f"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#26303f",
        "primaryHover": "#1c2531",
        "onPrimary": "#ffffff",
        "secondary": "#b9a98f",
        "accent": "#b9a98f",
        "background": "#f0ebde",
        "foreground": "#20293a",
        "muted": "#e5dfcd",
        "mutedForeground": "#5f6675",
        "border": "#d5cdba",
        "card": "#ffffff",
        "cardForeground": "#20293a",
        "link": "#2c3a4f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #26303f 0%, #b9a98f 120%)",
        "gradientHero": "linear-gradient(180deg, #161d28 0%, #1f2734 55%, #26303f 100%)"
      },
      "typography": {
        "fontHeading": "'Libre Baskerville', Georgia, serif",
        "fontBody": "'Source Sans 3', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 10px 30px rgba(40,34,28,.12)",
        "lg": "0 20px 48px rgba(40,34,28,.16)"
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
        "headerBg": "#f0ebde",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#20293a",
        "headerBorder": "#d5cdba",
        "footerBg": "#161d28",
        "footerFg": "#e5dfcd",
        "footerBorder": "#26303f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#26303f"
      }
    }
  },
  {
    "id": "forest-ochre",
    "name": "Forest & Ochre",
    "description": "Deep forest canvas with an ochre primary. Botanical, warm, deep.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#cf9a3a",
      "background": "#111f19",
      "foreground": "#e8f0ea",
      "accent": "#8fae7a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#cf9a3a",
        "primaryHover": "#b0812c",
        "onPrimary": "#131f18",
        "secondary": "#8fae7a",
        "accent": "#8fae7a",
        "background": "#111f19",
        "foreground": "#e8f0ea",
        "muted": "#162a22",
        "mutedForeground": "#9db6a8",
        "border": "#254036",
        "card": "#162a22",
        "cardForeground": "#e8f0ea",
        "link": "#d9a848",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #cf9a3a 0%, #8fae7a 120%)",
        "gradientHero": "linear-gradient(180deg, #0c1813 0%, #111f19 55%, #1d3b2e 100%)"
      },
      "typography": {
        "fontHeading": "'Source Serif 4', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 12px 32px rgba(0,0,0,.45)",
        "lg": "0 24px 56px rgba(0,0,0,.55)"
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
        "headerBg": "#111f19",
        "headerBgScrolled": "#162a22",
        "headerFg": "#e8f0ea",
        "headerBorder": "#254036",
        "footerBg": "#0c1813",
        "footerFg": "#e8f0ea",
        "footerBorder": "#cf9a3a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#cf9a3a"
      }
    }
  },
  {
    "id": "graphite-brass",
    "name": "Graphite & Brass",
    "description": "Graphite canvas with a brass primary. Dark, luxe, editorial.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c9a24b",
      "background": "#1a1917",
      "foreground": "#f0ede6",
      "accent": "#9a9184"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c9a24b",
        "primaryHover": "#ab873a",
        "onPrimary": "#1a1917",
        "secondary": "#9a9184",
        "accent": "#9a9184",
        "background": "#1a1917",
        "foreground": "#f0ede6",
        "muted": "#232220",
        "mutedForeground": "#a8a49a",
        "border": "#37352f",
        "card": "#232220",
        "cardForeground": "#f0ede6",
        "link": "#d4ac52",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #c9a24b 0%, #9a9184 120%)",
        "gradientHero": "linear-gradient(180deg, #131210 0%, #1a1917 55%, #2c2a25 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
        "fontBody": "'Mulish', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 12px 32px rgba(0,0,0,.45)",
        "lg": "0 24px 56px rgba(0,0,0,.55)"
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
        "headerBg": "#1a1917",
        "headerBgScrolled": "#232220",
        "headerFg": "#f0ede6",
        "headerBorder": "#37352f",
        "footerBg": "#131210",
        "footerFg": "#f0ede6",
        "footerBorder": "#c9a24b",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c9a24b"
      }
    }
  },
  {
    "id": "midnight-blue-sand",
    "name": "Midnight Blue & Sand",
    "description": "Midnight blue canvas with a soft blue primary and sand accent. Calm, deep, refined.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#7fa8d0",
      "background": "#131b2a",
      "foreground": "#e9eef6",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#7fa8d0",
        "primaryHover": "#6690bd",
        "onPrimary": "#131b2a",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#131b2a",
        "foreground": "#e9eef6",
        "muted": "#1a2436",
        "mutedForeground": "#9fb0c6",
        "border": "#2a3752",
        "card": "#1a2436",
        "cardForeground": "#e9eef6",
        "link": "#8fb4d8",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #7fa8d0 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #0e1420 0%, #131b2a 55%, #25344e 100%)"
      },
      "typography": {
        "fontHeading": "'Space Grotesk', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "headingWeight": "700",
        "letterSpacing": "-0.01em",
        "headingTransform": "none",
        "headingLineHeight": "1.12"
      },
      "radius": {
        "interactive": "10px",
        "card": "16px",
        "popover": "12px",
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "full": "9999px"
      },
      "spacing": {
        "base": "1rem",
        "sectionPadding": "clamp(56px,8vw,128px)",
        "container": "72rem",
        "align": "center"
      },
      "shadow": {
        "md": "0 12px 32px rgba(0,0,0,.45)",
        "lg": "0 24px 56px rgba(0,0,0,.55)"
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
        "headerBg": "#131b2a",
        "headerBgScrolled": "#1a2436",
        "headerFg": "#e9eef6",
        "headerBorder": "#2a3752",
        "footerBg": "#0e1420",
        "footerFg": "#e9eef6",
        "footerBorder": "#7fa8d0",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#7fa8d0"
      }
    }
  }
] as const;

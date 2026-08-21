/**
 * LAB Colour presets for the design gallery.
 *
 * 50 curated theme presets based on the LAB Colour Library (labcolourtheworld.com),
 * grouped into four categories. Each is a COMPLETE look (grouped tokenOverrides)
 * applied via applyDesignPresetAction, which also derives the site-wide block tokens.
 * Fonts are paired per preset from the supported Google Font set (see lib/fonts.ts).
 *
 * Grouped in the Presets tab by the `category` field on DesignPresetCard.
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const LAB_PRESET_CARDS: readonly DesignPresetCard[] = [
  {
    "id": "elephants-breath-ammonite",
    "name": "Elephant's Breath & Ammonite",
    "description": "Elephant's Breath + Ammonite. Warm greige with a cooler grey. Timeless, soft, serious.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#9c978c",
      "background": "#ece7de",
      "foreground": "#3b3730",
      "accent": "#b8b0a2"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#9c978c",
        "primaryHover": "#847f74",
        "onPrimary": "#ffffff",
        "secondary": "#b8b0a2",
        "accent": "#b8b0a2",
        "background": "#ece7de",
        "foreground": "#3b3730",
        "muted": "#e0d9cc",
        "mutedForeground": "#7a7469",
        "border": "#d6cfc1",
        "card": "#ffffff",
        "cardForeground": "#3b3730",
        "link": "#6f695d",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #9c978c 0%, #b8b0a2 120%)",
        "gradientHero": "linear-gradient(180deg, #3b3730 0%, #5f594e 55%, #9c978c 100%)"
      },
      "typography": {
        "fontHeading": "'Libre Baskerville', Georgia, serif",
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
        "headerBg": "#ece7de",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3b3730",
        "headerBorder": "#d6cfc1",
        "footerBg": "#3b3730",
        "footerFg": "#e0d9cc",
        "footerBorder": "#9c978c",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#9c978c"
      }
    }
  },
  {
    "id": "nude-cashmere-mushroom",
    "name": "Nude Cashmere & Mushroom",
    "description": "Nude Cashmere + Mushroom. Cashmere neutrals with a warm taupe primary. Cosy, soft, refined.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8f7f6a",
      "background": "#f0e6d9",
      "foreground": "#3c352c",
      "accent": "#c9b7a1"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8f7f6a",
        "primaryHover": "#786a56",
        "onPrimary": "#ffffff",
        "secondary": "#c9b7a1",
        "accent": "#c9b7a1",
        "background": "#f0e6d9",
        "foreground": "#3c352c",
        "muted": "#e7d9cc",
        "mutedForeground": "#867766",
        "border": "#ddcfbd",
        "card": "#ffffff",
        "cardForeground": "#3c352c",
        "link": "#71634f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8f7f6a 0%, #c9b7a1 120%)",
        "gradientHero": "linear-gradient(180deg, #3c352c 0%, #5f5344 55%, #8f7f6a 100%)"
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
        "headerBg": "#f0e6d9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3c352c",
        "headerBorder": "#ddcfbd",
        "footerBg": "#3c352c",
        "footerFg": "#e7d9cc",
        "footerBorder": "#8f7f6a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8f7f6a"
      }
    }
  },
  {
    "id": "old-linen-ammonite",
    "name": "Old Linen & Ammonite",
    "description": "Old Linen + Ammonite. Linen neutral with a cool grey primary. Timeless, calm, refined.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#847f74",
      "background": "#efe6d6",
      "foreground": "#37342d",
      "accent": "#b3aa9a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#847f74",
        "primaryHover": "#6c675d",
        "onPrimary": "#ffffff",
        "secondary": "#b3aa9a",
        "accent": "#b3aa9a",
        "background": "#efe6d6",
        "foreground": "#37342d",
        "muted": "#e4dac7",
        "mutedForeground": "#787268",
        "border": "#d9d0bf",
        "card": "#ffffff",
        "cardForeground": "#37342d",
        "link": "#665f54",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #847f74 0%, #b3aa9a 120%)",
        "gradientHero": "linear-gradient(180deg, #2f2c27 0%, #514c43 55%, #847f74 100%)"
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
        "headerBg": "#efe6d6",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#37342d",
        "headerBorder": "#d9d0bf",
        "footerBg": "#2f2c27",
        "footerFg": "#e4dac7",
        "footerBorder": "#847f74",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#847f74"
      }
    }
  },
  {
    "id": "shaded-white-skimming-stone",
    "name": "Shaded White & Skimming Stone",
    "description": "Shaded White + Skimming Stone. Minimalist off-white with subtle warm grey. Light, calm, airy.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8f8877",
      "background": "#f0ebe0",
      "foreground": "#3a362e",
      "accent": "#cfc6b6"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8f8877",
        "primaryHover": "#767065",
        "onPrimary": "#ffffff",
        "secondary": "#cfc6b6",
        "accent": "#cfc6b6",
        "background": "#f0ebe0",
        "foreground": "#3a362e",
        "muted": "#e6e0d2",
        "mutedForeground": "#7d766a",
        "border": "#dbd4c5",
        "card": "#ffffff",
        "cardForeground": "#3a362e",
        "link": "#6d6659",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8f8877 0%, #cfc6b6 120%)",
        "gradientHero": "linear-gradient(180deg, #3a362e 0%, #5c554a 55%, #8f877e 100%)"
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
        "headerBg": "#f0ebe0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a362e",
        "headerBorder": "#dbd4c5",
        "footerBg": "#3a362e",
        "footerFg": "#e6e0d2",
        "footerBorder": "#8f8877",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8f8877"
      }
    }
  },
  {
    "id": "slipper-satin-bone",
    "name": "Slipper Satin & Bone",
    "description": "Slipper Satin + Bone. Soft warm whites with a subtle taupe primary. Minimalist, light, quiet.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8a7c62",
      "background": "#f3ecdd",
      "foreground": "#3c362b",
      "accent": "#c9b995"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8a7c62",
        "primaryHover": "#746851",
        "onPrimary": "#ffffff",
        "secondary": "#c9b995",
        "accent": "#c9b995",
        "background": "#f3ecdd",
        "foreground": "#3c362b",
        "muted": "#e9dfca",
        "mutedForeground": "#7d7563",
        "border": "#ddd2ba",
        "card": "#ffffff",
        "cardForeground": "#3c362b",
        "link": "#6f6350",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8a7c62 0%, #c9b995 120%)",
        "gradientHero": "linear-gradient(180deg, #3c362b 0%, #5c5343 55%, #8a7c62 100%)"
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
        "headerBg": "#f3ecdd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3c362b",
        "headerBorder": "#ddd2ba",
        "footerBg": "#3c362b",
        "footerFg": "#e9dfca",
        "footerBorder": "#8a7c62",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8a7c62"
      }
    }
  },
  {
    "id": "world-of-stone",
    "name": "World of Stone",
    "description": "Frosted Sand + Mushroom. Warm greige neutrals with a soft taupe primary and sandy tones. Calm, natural, stony.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8a7d68",
      "background": "#efe9dd",
      "foreground": "#3a352d",
      "accent": "#b8a98f"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8a7d68",
        "primaryHover": "#766a57",
        "onPrimary": "#ffffff",
        "secondary": "#b8a98f",
        "accent": "#b8a98f",
        "background": "#efe9dd",
        "foreground": "#3a352d",
        "muted": "#e4dccb",
        "mutedForeground": "#7c7264",
        "border": "#d8cebb",
        "card": "#ffffff",
        "cardForeground": "#3a352d",
        "link": "#6f6453",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8a7d68 0%, #b8a98f 120%)",
        "gradientHero": "linear-gradient(180deg, #3a352d 0%, #5c5346 55%, #8a7d68 100%)"
      },
      "typography": {
        "fontHeading": "'Lora', Georgia, serif",
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
        "headerBg": "#efe9dd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a352d",
        "headerBorder": "#d8cebb",
        "footerBg": "#3a352d",
        "footerFg": "#e4dccb",
        "footerBorder": "#8a7d68",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8a7d68"
      }
    }
  },
  {
    "id": "ammonite-ibiza-rush",
    "name": "Ammonite & Ibiza Rush",
    "description": "Ammonite + Ibiza Rush. Cool grey with a rust-coral accent. Balanced, warm-cool, modern.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8a8378",
      "background": "#eee9df",
      "foreground": "#332f2a",
      "accent": "#c4623f"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8a8378",
        "primaryHover": "#6f695e",
        "onPrimary": "#ffffff",
        "secondary": "#c4623f",
        "accent": "#c4623f",
        "background": "#eee9df",
        "foreground": "#332f2a",
        "muted": "#e2dccd",
        "mutedForeground": "#787169",
        "border": "#d6cfc0",
        "card": "#ffffff",
        "cardForeground": "#332f2a",
        "link": "#665f55",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8a8378 0%, #c4623f 120%)",
        "gradientHero": "linear-gradient(180deg, #2a2723 0%, #4c4740 55%, #8a8378 100%)"
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
        "headerBg": "#eee9df",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#332f2a",
        "headerBorder": "#d6cfc0",
        "footerBg": "#2a2723",
        "footerFg": "#e2dccd",
        "footerBorder": "#8a8378",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8a8378"
      }
    }
  },
  {
    "id": "aubergine-camel",
    "name": "Aubergine & Camel",
    "description": "Deep aubergine with a camel accent. Moody, luxe, refined.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#5a2a4d",
      "background": "#f4eef1",
      "foreground": "#2e1f2a",
      "accent": "#c99a6a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#5a2a4d",
        "primaryHover": "#46203c",
        "onPrimary": "#ffffff",
        "secondary": "#c99a6a",
        "accent": "#c99a6a",
        "background": "#f4eef1",
        "foreground": "#2e1f2a",
        "muted": "#e9dee6",
        "mutedForeground": "#786070",
        "border": "#e0cfda",
        "card": "#ffffff",
        "cardForeground": "#2e1f2a",
        "link": "#5a2a4d",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #5a2a4d 0%, #c99a6a 120%)",
        "gradientHero": "linear-gradient(180deg, #2a1523 0%, #412039 55%, #5a2a4d 100%)"
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
        "headerBg": "#f4eef1",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2e1f2a",
        "headerBorder": "#e0cfda",
        "footerBg": "#2a1523",
        "footerFg": "#e9dee6",
        "footerBorder": "#5a2a4d",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#5a2a4d"
      }
    }
  },
  {
    "id": "burnt-orange-teal",
    "name": "Burnt Orange & Teal",
    "description": "Vivid burnt orange with a deep teal accent. Warm-cool complementary, lively.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c05a2a",
      "background": "#f6efe4",
      "foreground": "#3a2820",
      "accent": "#1f6b68"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c05a2a",
        "primaryHover": "#a44921",
        "onPrimary": "#ffffff",
        "secondary": "#1f6b68",
        "accent": "#1f6b68",
        "background": "#f6efe4",
        "foreground": "#3a2820",
        "muted": "#ece0cd",
        "mutedForeground": "#8a6f5c",
        "border": "#e0d2bd",
        "card": "#ffffff",
        "cardForeground": "#3a2820",
        "link": "#a84c22",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c05a2a 0%, #1f6b68 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2820 0%, #7a3a1e 55%, #c05a2a 100%)"
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
        "headerBg": "#f6efe4",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2820",
        "headerBorder": "#e0d2bd",
        "footerBg": "#3a2820",
        "footerFg": "#ece0cd",
        "footerBorder": "#c05a2a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c05a2a"
      }
    }
  },
  {
    "id": "clay-mid-frosted-sand",
    "name": "Clay Mid & Frosted Sand",
    "description": "Clay - Mid + Frosted Sand. Earthy clay red-brown on warm sand. Warm, crafted, grounded.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#a8593f",
      "background": "#f1e8d7",
      "foreground": "#3f2a22",
      "accent": "#d8c19a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#a8593f",
        "primaryHover": "#8f4832",
        "onPrimary": "#ffffff",
        "secondary": "#d8c19a",
        "accent": "#d8c19a",
        "background": "#f1e8d7",
        "foreground": "#3f2a22",
        "muted": "#e9dec9",
        "mutedForeground": "#8a6a5a",
        "border": "#e0d2ba",
        "card": "#ffffff",
        "cardForeground": "#3f2a22",
        "link": "#944c36",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #a8593f 0%, #d8c19a 120%)",
        "gradientHero": "linear-gradient(180deg, #3f2a22 0%, #743f30 55%, #a8593f 100%)"
      },
      "typography": {
        "fontHeading": "'Merriweather', Georgia, serif",
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
        "headerBg": "#f1e8d7",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3f2a22",
        "headerBorder": "#e0d2ba",
        "footerBg": "#3f2a22",
        "footerFg": "#e9dec9",
        "footerBorder": "#a8593f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#a8593f"
      }
    }
  },
  {
    "id": "clay-mid-old-linen",
    "name": "Clay Mid & Old Linen",
    "description": "Clay - Mid + Old Linen. Earthy clay red-brown on linen neutrals. Warm, crafted, grounded.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#a8593f",
      "background": "#efe6d6",
      "foreground": "#3f2a22",
      "accent": "#caa98f"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#a8593f",
        "primaryHover": "#8f4832",
        "onPrimary": "#ffffff",
        "secondary": "#caa98f",
        "accent": "#caa98f",
        "background": "#efe6d6",
        "foreground": "#3f2a22",
        "muted": "#e4dac7",
        "mutedForeground": "#8a6a5a",
        "border": "#e0d1bd",
        "card": "#ffffff",
        "cardForeground": "#3f2a22",
        "link": "#944c36",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #a8593f 0%, #caa98f 120%)",
        "gradientHero": "linear-gradient(180deg, #3f2a22 0%, #743f30 55%, #a8593f 100%)"
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
        "headerBg": "#efe6d6",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3f2a22",
        "headerBorder": "#e0d1bd",
        "footerBg": "#3f2a22",
        "footerFg": "#e4dac7",
        "footerBorder": "#a8593f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#a8593f"
      }
    }
  },
  {
    "id": "coffee-cream-old-flax",
    "name": "Coffee Cream & Old Flax",
    "description": "Coffee Cream + Old Flax. Warm cream with an olive-flax accent. Cosy, natural, warm.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#9a8f6b",
      "background": "#f1e9d8",
      "foreground": "#3c3525",
      "accent": "#c3b48a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#9a8f6b",
        "primaryHover": "#847a58",
        "onPrimary": "#ffffff",
        "secondary": "#c3b48a",
        "accent": "#c3b48a",
        "background": "#f1e9d8",
        "foreground": "#3c3525",
        "muted": "#e8dcc2",
        "mutedForeground": "#867a5c",
        "border": "#ddd0b4",
        "card": "#ffffff",
        "cardForeground": "#3c3525",
        "link": "#7e754f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #9a8f6b 0%, #c3b48a 120%)",
        "gradientHero": "linear-gradient(180deg, #3a3524 0%, #5f5738 55%, #9a8f6b 100%)"
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
        "headerBg": "#f1e9d8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3c3525",
        "headerBorder": "#ddd0b4",
        "footerBg": "#3a3524",
        "footerFg": "#e8dcc2",
        "footerBorder": "#9a8f6b",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#9a8f6b"
      }
    }
  },
  {
    "id": "coffee-cream-terra-pink",
    "name": "Coffee Cream & Terra Pink",
    "description": "Coffee Cream + Terra Pink. Warm cream with a terracotta-pink primary. Warm, cosy, soft.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c0897c",
      "background": "#f3ecdb",
      "foreground": "#40302a",
      "accent": "#d8c6a8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c0897c",
        "primaryHover": "#a86f62",
        "onPrimary": "#ffffff",
        "secondary": "#d8c6a8",
        "accent": "#d8c6a8",
        "background": "#f3ecdb",
        "foreground": "#40302a",
        "muted": "#ebdfc7",
        "mutedForeground": "#8a7060",
        "border": "#e1d4bb",
        "card": "#ffffff",
        "cardForeground": "#40302a",
        "link": "#a8695c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c0897c 0%, #d8c6a8 120%)",
        "gradientHero": "linear-gradient(180deg, #40302a 0%, #83564b 55%, #c0897c 100%)"
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
        "headerBg": "#f3ecdb",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#40302a",
        "headerBorder": "#e1d4bb",
        "footerBg": "#40302a",
        "footerFg": "#ebdfc7",
        "footerBorder": "#c0897c",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c0897c"
      }
    }
  },
  {
    "id": "dusty-rose-slate",
    "name": "Dusty Rose & Slate",
    "description": "Dusty rose with a cool slate accent. Soft, contemporary, gentle.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b06b74",
      "background": "#f6eef0",
      "foreground": "#3a2a2d",
      "accent": "#5f6d78"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b06b74",
        "primaryHover": "#985761",
        "onPrimary": "#ffffff",
        "secondary": "#5f6d78",
        "accent": "#5f6d78",
        "background": "#f6eef0",
        "foreground": "#3a2a2d",
        "muted": "#eadde3",
        "mutedForeground": "#8a7076",
        "border": "#e2d2d6",
        "card": "#ffffff",
        "cardForeground": "#3a2a2d",
        "link": "#a05e68",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b06b74 0%, #5f6d78 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2a2d 0%, #79484f 55%, #b06b74 100%)"
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
        "headerBg": "#f6eef0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2a2d",
        "headerBorder": "#e2d2d6",
        "footerBg": "#3a2a2d",
        "footerFg": "#eadde3",
        "footerBorder": "#b06b74",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b06b74"
      }
    }
  },
  {
    "id": "ibiza-rush-bone",
    "name": "Ibiza Rush & Bone",
    "description": "Ibiza Rush + Bone. Rust-coral on bone off-white. Warm, energetic, inviting.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c4623f",
      "background": "#f4ebd9",
      "foreground": "#40291f",
      "accent": "#d9c7a0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c4623f",
        "primaryHover": "#ac5133",
        "onPrimary": "#ffffff",
        "secondary": "#d9c7a0",
        "accent": "#d9c7a0",
        "background": "#f4ebd9",
        "foreground": "#40291f",
        "muted": "#ecdfc6",
        "mutedForeground": "#8a6a52",
        "border": "#e4d4b9",
        "card": "#ffffff",
        "cardForeground": "#40291f",
        "link": "#b0522f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c4623f 0%, #d9c7a0 120%)",
        "gradientHero": "linear-gradient(180deg, #40291f 0%, #8a3f28 55%, #c4623f 100%)"
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
        "headerBg": "#f4ebd9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#40291f",
        "headerBorder": "#e4d4b9",
        "footerBg": "#40291f",
        "footerFg": "#ecdfc6",
        "footerBorder": "#c4623f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c4623f"
      }
    }
  },
  {
    "id": "ibiza-rush-spider-mum",
    "name": "Ibiza Rush & Spider Mum",
    "description": "Ibiza Rush + Spider Mum. Rust-coral with an ochre/mustard accent. Warm, energetic, sunny.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c4623f",
      "background": "#f6ede0",
      "foreground": "#40291f",
      "accent": "#c9a24b"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c4623f",
        "primaryHover": "#ac5133",
        "onPrimary": "#ffffff",
        "secondary": "#c9a24b",
        "accent": "#c9a24b",
        "background": "#f6ede0",
        "foreground": "#40291f",
        "muted": "#efe1cd",
        "mutedForeground": "#8a6a52",
        "border": "#e6d3ba",
        "card": "#ffffff",
        "cardForeground": "#40291f",
        "link": "#b0522f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c4623f 0%, #c9a24b 120%)",
        "gradientHero": "linear-gradient(180deg, #40291f 0%, #8a3f28 55%, #c4623f 100%)"
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
        "headerBg": "#f6ede0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#40291f",
        "headerBorder": "#e6d3ba",
        "footerBg": "#40291f",
        "footerFg": "#efe1cd",
        "footerBorder": "#c4623f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c4623f"
      }
    }
  },
  {
    "id": "mushroom-terra-pink",
    "name": "Mushroom & Terra Pink",
    "description": "Mushroom + Terra Pink. Taupe neutrals with a dusty terracotta-pink primary. Warm, soft, earthy.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#bd8074",
      "background": "#efe6da",
      "foreground": "#41352d",
      "accent": "#a79a86"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#bd8074",
        "primaryHover": "#a56a5f",
        "onPrimary": "#ffffff",
        "secondary": "#a79a86",
        "accent": "#a79a86",
        "background": "#efe6da",
        "foreground": "#41352d",
        "muted": "#e6dbcb",
        "mutedForeground": "#877566",
        "border": "#ddceba",
        "card": "#ffffff",
        "cardForeground": "#41352d",
        "link": "#a5675b",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #bd8074 0%, #a79a86 120%)",
        "gradientHero": "linear-gradient(180deg, #41352d 0%, #7a5347 55%, #bd8074 100%)"
      },
      "typography": {
        "fontHeading": "'Lora', Georgia, serif",
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
        "headerBg": "#efe6da",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#41352d",
        "headerBorder": "#ddceba",
        "footerBg": "#41352d",
        "footerFg": "#e6dbcb",
        "footerBorder": "#bd8074",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#bd8074"
      }
    }
  },
  {
    "id": "mustard-pine",
    "name": "Mustard & Pine",
    "description": "Strong mustard with a deep pine-green accent. Warm, energetic, retro.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#a9781a",
      "background": "#f6f1e2",
      "foreground": "#3a3320",
      "accent": "#2f4a37"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#a9781a",
        "primaryHover": "#8c6114",
        "onPrimary": "#ffffff",
        "secondary": "#2f4a37",
        "accent": "#2f4a37",
        "background": "#f6f1e2",
        "foreground": "#3a3320",
        "muted": "#ece2c7",
        "mutedForeground": "#867a54",
        "border": "#ddd0ab",
        "card": "#ffffff",
        "cardForeground": "#3a3320",
        "link": "#8c6114",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #a9781a 0%, #2f4a37 120%)",
        "gradientHero": "linear-gradient(180deg, #322913 0%, #6b5417 55%, #a9781a 100%)"
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
        "headerBg": "#f6f1e2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a3320",
        "headerBorder": "#ddd0ab",
        "footerBg": "#322913",
        "footerFg": "#ece2c7",
        "footerBorder": "#a9781a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#a9781a"
      }
    }
  },
  {
    "id": "oxblood-stone",
    "name": "Oxblood & Stone",
    "description": "Deep oxblood wine on warm stone. Bold, grounded, editorial.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6e2230",
      "background": "#f5efe9",
      "foreground": "#2e1c1e",
      "accent": "#cfa06a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6e2230",
        "primaryHover": "#571a26",
        "onPrimary": "#ffffff",
        "secondary": "#cfa06a",
        "accent": "#cfa06a",
        "background": "#f5efe9",
        "foreground": "#2e1c1e",
        "muted": "#eaded2",
        "mutedForeground": "#8a6a63",
        "border": "#e0d0c2",
        "card": "#ffffff",
        "cardForeground": "#2e1c1e",
        "link": "#6e2230",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6e2230 0%, #cfa06a 120%)",
        "gradientHero": "linear-gradient(180deg, #2c1417 0%, #4a1a23 55%, #6e2230 100%)"
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
        "headerBg": "#f5efe9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2e1c1e",
        "headerBorder": "#e0d0c2",
        "footerBg": "#2c1417",
        "footerFg": "#eaded2",
        "footerBorder": "#6e2230",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6e2230"
      }
    }
  },
  {
    "id": "plum-gold",
    "name": "Plum & Gold",
    "description": "Deep plum with a gold accent. Rich, premium, warm.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4a2540",
      "background": "#f3eef1",
      "foreground": "#281f27",
      "accent": "#c9a24b"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4a2540",
        "primaryHover": "#391d32",
        "onPrimary": "#ffffff",
        "secondary": "#c9a24b",
        "accent": "#c9a24b",
        "background": "#f3eef1",
        "foreground": "#281f27",
        "muted": "#e8dde5",
        "mutedForeground": "#77606f",
        "border": "#ded0da",
        "card": "#ffffff",
        "cardForeground": "#281f27",
        "link": "#4a2540",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #4a2540 0%, #c9a24b 120%)",
        "gradientHero": "linear-gradient(180deg, #241320 0%, #371c30 55%, #4a2540 100%)"
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
        "headerBg": "#f3eef1",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#281f27",
        "headerBorder": "#ded0da",
        "footerBg": "#241320",
        "footerFg": "#e8dde5",
        "footerBorder": "#4a2540",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4a2540"
      }
    }
  },
  {
    "id": "spider-mum-nigiri",
    "name": "Spider Mum & Nigiri",
    "description": "Spider Mum + Nigiri. Warm ochre on deep charcoal. Bold, warm, editorial.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#a67f34",
      "background": "#f2ebd8",
      "foreground": "#2c2820",
      "accent": "#2e2a26"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#a67f34",
        "primaryHover": "#8a6829",
        "onPrimary": "#ffffff",
        "secondary": "#2e2a26",
        "accent": "#2e2a26",
        "background": "#f2ebd8",
        "foreground": "#2c2820",
        "muted": "#e9ddc0",
        "mutedForeground": "#7d7052",
        "border": "#ddd0b0",
        "card": "#ffffff",
        "cardForeground": "#2c2820",
        "link": "#7f6327",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #a67f34 0%, #2e2a26 120%)",
        "gradientHero": "linear-gradient(180deg, #22201a 0%, #4a3f26 55%, #a67f34 100%)"
      },
      "typography": {
        "fontHeading": "'Oswald', system-ui, sans-serif",
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
        "headerBg": "#f2ebd8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2c2820",
        "headerBorder": "#ddd0b0",
        "footerBg": "#22201a",
        "footerFg": "#e9ddc0",
        "footerBorder": "#a67f34",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#a67f34"
      }
    }
  },
  {
    "id": "spider-mum-portland-stone",
    "name": "Spider Mum & Portland Stone",
    "description": "Spider Mum + Portland Stone. Warm ochre on limestone neutral. Sunny, natural, inviting.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b3893a",
      "background": "#f2ebd9",
      "foreground": "#3d3623",
      "accent": "#d8cdb8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b3893a",
        "primaryHover": "#98722d",
        "onPrimary": "#ffffff",
        "secondary": "#d8cdb8",
        "accent": "#d8cdb8",
        "background": "#f2ebd9",
        "foreground": "#3d3623",
        "muted": "#e8ddc2",
        "mutedForeground": "#867a55",
        "border": "#ddd0b2",
        "card": "#ffffff",
        "cardForeground": "#3d3623",
        "link": "#8f6e2c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b3893a 0%, #d8cdb8 120%)",
        "gradientHero": "linear-gradient(180deg, #33301f 0%, #6b5c30 55%, #b3893a 100%)"
      },
      "typography": {
        "fontHeading": "'Montserrat', system-ui, sans-serif",
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
        "headerBg": "#f2ebd9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3d3623",
        "headerBorder": "#ddd0b2",
        "footerBg": "#33301f",
        "footerFg": "#e8ddc2",
        "footerBorder": "#b3893a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b3893a"
      }
    }
  },
  {
    "id": "terra-pink-cashmere",
    "name": "Terra Pink & Nude Cashmere",
    "description": "Terra Pink + Nude Cashmere. Dusty terracotta-pink on cashmere neutrals. Warm, soft, inviting.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c0897c",
      "background": "#efe4da",
      "foreground": "#4a352f",
      "accent": "#d8b7a3"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c0897c",
        "primaryHover": "#ac7469",
        "onPrimary": "#ffffff",
        "secondary": "#d8b7a3",
        "accent": "#d8b7a3",
        "background": "#efe4da",
        "foreground": "#4a352f",
        "muted": "#e7d9cc",
        "mutedForeground": "#8c7268",
        "border": "#e0cfc0",
        "card": "#ffffff",
        "cardForeground": "#4a352f",
        "link": "#a86c60",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c0897c 0%, #d8b7a3 120%)",
        "gradientHero": "linear-gradient(180deg, #4a352f 0%, #8a5b50 55%, #c0897c 100%)"
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
        "headerBg": "#efe4da",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#4a352f",
        "headerBorder": "#e0cfc0",
        "footerBg": "#4a352f",
        "footerFg": "#e7d9cc",
        "footerBorder": "#c0897c",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c0897c"
      }
    }
  },
  {
    "id": "terra-pink-portland-stone",
    "name": "Terra Pink & Portland Stone",
    "description": "Terra Pink + Portland Stone. Dusty terracotta-pink on limestone. Warm, soft, refined.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c0897c",
      "background": "#f1e8db",
      "foreground": "#432f28",
      "accent": "#d8cdb8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c0897c",
        "primaryHover": "#a86f62",
        "onPrimary": "#ffffff",
        "secondary": "#d8cdb8",
        "accent": "#d8cdb8",
        "background": "#f1e8db",
        "foreground": "#432f28",
        "muted": "#e8dcc7",
        "mutedForeground": "#8a6f62",
        "border": "#e0d2bb",
        "card": "#ffffff",
        "cardForeground": "#432f28",
        "link": "#a8695c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c0897c 0%, #d8cdb8 120%)",
        "gradientHero": "linear-gradient(180deg, #432f28 0%, #83564b 55%, #c0897c 100%)"
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
        "headerBg": "#f1e8db",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#432f28",
        "headerBorder": "#e0d2bb",
        "footerBg": "#432f28",
        "footerFg": "#e8dcc7",
        "footerBorder": "#c0897c",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c0897c"
      }
    }
  },
  {
    "id": "terracotta-teal",
    "name": "Terracotta & Deep Teal",
    "description": "Warm terracotta with a deep teal accent. Complementary, crafted, warm.",
    "category": "Warm & Earthy",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b45a3a",
      "background": "#f5ede2",
      "foreground": "#3a271f",
      "accent": "#2c6e6a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b45a3a",
        "primaryHover": "#98492d",
        "onPrimary": "#ffffff",
        "secondary": "#2c6e6a",
        "accent": "#2c6e6a",
        "background": "#f5ede2",
        "foreground": "#3a271f",
        "muted": "#ebdfcd",
        "mutedForeground": "#8a6d5a",
        "border": "#e0d0bb",
        "card": "#ffffff",
        "cardForeground": "#3a271f",
        "link": "#a04f32",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b45a3a 0%, #2c6e6a 120%)",
        "gradientHero": "linear-gradient(180deg, #3a271f 0%, #753a26 55%, #b45a3a 100%)"
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
        "headerBg": "#f5ede2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a271f",
        "headerBorder": "#e0d0bb",
        "footerBg": "#3a271f",
        "footerFg": "#ebdfcd",
        "footerBorder": "#b45a3a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b45a3a"
      }
    }
  },
  {
    "id": "amaze-frosted-sand",
    "name": "Amaze & Frosted Sand",
    "description": "Amaze + Frosted Sand. Deep teal on warm sand. Elegant, cool-warm contrast, fresh.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4c6b6e",
      "background": "#f0e9d8",
      "foreground": "#26302f",
      "accent": "#e0cfa8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4c6b6e",
        "primaryHover": "#3c585b",
        "onPrimary": "#ffffff",
        "secondary": "#e0cfa8",
        "accent": "#e0cfa8",
        "background": "#f0e9d8",
        "foreground": "#26302f",
        "muted": "#e8ddc9",
        "mutedForeground": "#63716f",
        "border": "#dbd2be",
        "card": "#ffffff",
        "cardForeground": "#26302f",
        "link": "#3f6265",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #4c6b6e 0%, #e0cfa8 120%)",
        "gradientHero": "linear-gradient(180deg, #20302f 0%, #37504f 55%, #4c6b6e 100%)"
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
        "headerBg": "#f0e9d8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#26302f",
        "headerBorder": "#dbd2be",
        "footerBg": "#20302f",
        "footerFg": "#e8ddc9",
        "footerBorder": "#4c6b6e",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4c6b6e"
      }
    }
  },
  {
    "id": "bottle-green-brass",
    "name": "Bottle Green & Brass",
    "description": "Deep bottle green with a brass accent on warm cream. Rich, classic, botanical.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#1f5138",
      "background": "#f2f1e7",
      "foreground": "#1b2a20",
      "accent": "#c9a24b"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#1f5138",
        "primaryHover": "#173e2b",
        "onPrimary": "#ffffff",
        "secondary": "#c9a24b",
        "accent": "#c9a24b",
        "background": "#f2f1e7",
        "foreground": "#1b2a20",
        "muted": "#e6e4d3",
        "mutedForeground": "#5f6b5c",
        "border": "#d3d3c0",
        "card": "#ffffff",
        "cardForeground": "#1b2a20",
        "link": "#1f5138",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #1f5138 0%, #c9a24b 120%)",
        "gradientHero": "linear-gradient(180deg, #122a1f 0%, #193f2c 55%, #1f5138 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
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
        "headerBg": "#f2f1e7",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1b2a20",
        "headerBorder": "#d3d3c0",
        "footerBg": "#122a1f",
        "footerFg": "#e6e4d3",
        "footerBorder": "#1f5138",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#1f5138"
      }
    }
  },
  {
    "id": "bronze-green-old-linen",
    "name": "Bronze Green & Old Linen",
    "description": "Light Bronze Green + Old Linen. Refined bronze-green on linen. Classic, earthy, understated.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#545142",
      "background": "#efe7d6",
      "foreground": "#31332b",
      "accent": "#a89f80"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#545142",
        "primaryHover": "#434134",
        "onPrimary": "#ffffff",
        "secondary": "#a89f80",
        "accent": "#a89f80",
        "background": "#efe7d6",
        "foreground": "#31332b",
        "muted": "#e4dac7",
        "mutedForeground": "#6f7060",
        "border": "#d7cfb9",
        "card": "#ffffff",
        "cardForeground": "#31332b",
        "link": "#5f5c45",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #545142 0%, #a89f80 120%)",
        "gradientHero": "linear-gradient(180deg, #282a22 0%, #3d3f31 55%, #545142 100%)"
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
        "headerBg": "#efe7d6",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#31332b",
        "headerBorder": "#d7cfb9",
        "footerBg": "#282a22",
        "footerFg": "#e4dac7",
        "footerBorder": "#545142",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#545142"
      }
    }
  },
  {
    "id": "elephants-breath-old-flax",
    "name": "Elephant's Breath & Old Flax",
    "description": "Elephant's Breath + Old Flax. Warm greige with an olive-flax primary. Natural, calm, earthy.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8a815f",
      "background": "#eee8dc",
      "foreground": "#37342a",
      "accent": "#c3b593"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8a815f",
        "primaryHover": "#726a4c",
        "onPrimary": "#ffffff",
        "secondary": "#c3b593",
        "accent": "#c3b593",
        "background": "#eee8dc",
        "foreground": "#37342a",
        "muted": "#e3dbc9",
        "mutedForeground": "#7d7660",
        "border": "#d8d1bd",
        "card": "#ffffff",
        "cardForeground": "#37342a",
        "link": "#6d6549",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8a815f 0%, #c3b593 120%)",
        "gradientHero": "linear-gradient(180deg, #2f2c21 0%, #514c37 55%, #8a815f 100%)"
      },
      "typography": {
        "fontHeading": "'Lora', Georgia, serif",
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
        "headerBg": "#eee8dc",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#37342a",
        "headerBorder": "#d8d1bd",
        "footerBg": "#2f2c21",
        "footerFg": "#e3dbc9",
        "footerBorder": "#8a815f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8a815f"
      }
    }
  },
  {
    "id": "frosted-sand-silk-dreamer",
    "name": "Frosted Sand & Silk Dreamer",
    "description": "Frosted Sand + Silk Dreamer. Warm sand with a muted blue-grey accent. Light, airy, serene.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6f7a80",
      "background": "#f1e9d8",
      "foreground": "#33322e",
      "accent": "#9fa9b0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6f7a80",
        "primaryHover": "#5b666c",
        "onPrimary": "#ffffff",
        "secondary": "#9fa9b0",
        "accent": "#9fa9b0",
        "background": "#f1e9d8",
        "foreground": "#33322e",
        "muted": "#e9decb",
        "mutedForeground": "#6f7377",
        "border": "#dcd3c0",
        "card": "#ffffff",
        "cardForeground": "#33322e",
        "link": "#5c686e",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6f7a80 0%, #9fa9b0 120%)",
        "gradientHero": "linear-gradient(180deg, #2b3033 0%, #4a565b 55%, #6f7a80 100%)"
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
        "headerBg": "#f1e9d8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#33322e",
        "headerBorder": "#dcd3c0",
        "footerBg": "#2b3033",
        "footerFg": "#e9decb",
        "footerBorder": "#6f7a80",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6f7a80"
      }
    }
  },
  {
    "id": "navy-sand",
    "name": "Navy & Sand",
    "description": "Classic deep navy on warm sand. Sharp, trustworthy, timeless.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#1c2a4a",
      "background": "#f4f1e8",
      "foreground": "#1a1f2b",
      "accent": "#b98a4a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#1c2a4a",
        "primaryHover": "#141f38",
        "onPrimary": "#ffffff",
        "secondary": "#b98a4a",
        "accent": "#b98a4a",
        "background": "#f4f1e8",
        "foreground": "#1a1f2b",
        "muted": "#e8e2d0",
        "mutedForeground": "#5f6474",
        "border": "#d5d2c1",
        "card": "#ffffff",
        "cardForeground": "#1a1f2b",
        "link": "#22335c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #1c2a4a 0%, #b98a4a 120%)",
        "gradientHero": "linear-gradient(180deg, #111827 0%, #182242 55%, #1c2a4a 100%)"
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
        "headerBg": "#f4f1e8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1a1f2b",
        "headerBorder": "#d5d2c1",
        "footerBg": "#111827",
        "footerFg": "#e8e2d0",
        "footerBorder": "#1c2a4a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#1c2a4a"
      }
    }
  },
  {
    "id": "olive-cream",
    "name": "Olive & Cream",
    "description": "Deep olive drab on cream. Earthy but green-forward, understated.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6f6a3a",
      "background": "#f2f1e5",
      "foreground": "#302f20",
      "accent": "#b57f5a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6f6a3a",
        "primaryHover": "#59552d",
        "onPrimary": "#ffffff",
        "secondary": "#b57f5a",
        "accent": "#b57f5a",
        "background": "#f2f1e5",
        "foreground": "#302f20",
        "muted": "#e6e3cf",
        "mutedForeground": "#726f4f",
        "border": "#d7d3b8",
        "card": "#ffffff",
        "cardForeground": "#302f20",
        "link": "#5e5a30",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6f6a3a 0%, #b57f5a 120%)",
        "gradientHero": "linear-gradient(180deg, #2b2a1c 0%, #4a472b 55%, #6f6a3a 100%)"
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
        "headerBg": "#f2f1e5",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#302f20",
        "headerBorder": "#d7d3b8",
        "footerBg": "#2b2a1c",
        "footerFg": "#e6e3cf",
        "footerBorder": "#6f6a3a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6f6a3a"
      }
    }
  },
  {
    "id": "petrol-blue-amber",
    "name": "Petrol Blue & Amber",
    "description": "Deep petrol blue with a warm amber accent. Confident, marine, high contrast.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#16667a",
      "background": "#f1f5f5",
      "foreground": "#16262b",
      "accent": "#d98f5a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#16667a",
        "primaryHover": "#0f5060",
        "onPrimary": "#ffffff",
        "secondary": "#d98f5a",
        "accent": "#d98f5a",
        "background": "#f1f5f5",
        "foreground": "#16262b",
        "muted": "#e3ecec",
        "mutedForeground": "#5f7176",
        "border": "#cddadb",
        "card": "#ffffff",
        "cardForeground": "#16262b",
        "link": "#155f72",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #16667a 0%, #d98f5a 120%)",
        "gradientHero": "linear-gradient(180deg, #0d2b33 0%, #134c5b 55%, #16667a 100%)"
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
        "headerBg": "#f1f5f5",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#16262b",
        "headerBorder": "#cddadb",
        "footerBg": "#0d2b33",
        "footerFg": "#e3ecec",
        "footerBorder": "#16667a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#16667a"
      }
    }
  },
  {
    "id": "portland-bronze-green",
    "name": "Portland Stone & Bronze Green",
    "description": "Portland Stone + Light Bronze Green. Limestone neutral with a refined bronze-green primary. Classic, earthy, understated.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#545142",
      "background": "#eee8d9",
      "foreground": "#33352c",
      "accent": "#9a9576"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#545142",
        "primaryHover": "#434134",
        "onPrimary": "#ffffff",
        "secondary": "#9a9576",
        "accent": "#9a9576",
        "background": "#eee8d9",
        "foreground": "#33352c",
        "muted": "#e2dbc6",
        "mutedForeground": "#6f7060",
        "border": "#d5ceb8",
        "card": "#ffffff",
        "cardForeground": "#33352c",
        "link": "#5f5c45",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #545142 0%, #9a9576 120%)",
        "gradientHero": "linear-gradient(180deg, #2a2c24 0%, #3d3f31 55%, #545142 100%)"
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
        "headerBg": "#eee8d9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#33352c",
        "headerBorder": "#d5ceb8",
        "footerBg": "#2a2c24",
        "footerFg": "#e2dbc6",
        "footerBorder": "#545142",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#545142"
      }
    }
  },
  {
    "id": "prussian-sand",
    "name": "Prussian Blue & Sand",
    "description": "Deep prussian blue on warm sand. Dramatic, deep, refined.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#12324a",
      "background": "#f1ede0",
      "foreground": "#1a2530",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#12324a",
        "primaryHover": "#0d2739",
        "onPrimary": "#ffffff",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#f1ede0",
        "foreground": "#1a2530",
        "muted": "#e6dcc6",
        "mutedForeground": "#5f6a76",
        "border": "#d6cdb8",
        "card": "#ffffff",
        "cardForeground": "#1a2530",
        "link": "#173b56",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #12324a 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #0d2233 0%, #102b40 55%, #12324a 100%)"
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
        "headerBg": "#f1ede0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1a2530",
        "headerBorder": "#d6cdb8",
        "footerBg": "#0d2233",
        "footerFg": "#e6dcc6",
        "footerBorder": "#12324a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#12324a"
      }
    }
  },
  {
    "id": "sage-terracotta",
    "name": "Sage & Terracotta",
    "description": "Soft muted sage with a terracotta accent. Calm, natural, balanced.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6b7d64",
      "background": "#f1f2ec",
      "foreground": "#2c322a",
      "accent": "#c0714a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6b7d64",
        "primaryHover": "#576851",
        "onPrimary": "#ffffff",
        "secondary": "#c0714a",
        "accent": "#c0714a",
        "background": "#f1f2ec",
        "foreground": "#2c322a",
        "muted": "#e4e6d9",
        "mutedForeground": "#6a7263",
        "border": "#d4d6c6",
        "card": "#ffffff",
        "cardForeground": "#2c322a",
        "link": "#586850",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6b7d64 0%, #c0714a 120%)",
        "gradientHero": "linear-gradient(180deg, #283026 0%, #455040 55%, #6b7d64 100%)"
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
        "headerBg": "#f1f2ec",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2c322a",
        "headerBorder": "#d4d6c6",
        "footerBg": "#283026",
        "footerFg": "#e4e6d9",
        "footerBorder": "#6b7d64",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6b7d64"
      }
    }
  },
  {
    "id": "silk-dreamer-amaze",
    "name": "Silk Dreamer & Amaze",
    "description": "Silk Dreamer + Amaze. Muted blue-grey with a deep teal jewel accent. Calm, elegant, cool.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4c6b6e",
      "background": "#eef1f1",
      "foreground": "#26302f",
      "accent": "#9fa9b0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4c6b6e",
        "primaryHover": "#3c585b",
        "onPrimary": "#ffffff",
        "secondary": "#9fa9b0",
        "accent": "#9fa9b0",
        "background": "#eef1f1",
        "foreground": "#26302f",
        "muted": "#dfe6e6",
        "mutedForeground": "#63716f",
        "border": "#cdd7d6",
        "card": "#ffffff",
        "cardForeground": "#26302f",
        "link": "#3f6265",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #4c6b6e 0%, #9fa9b0 120%)",
        "gradientHero": "linear-gradient(180deg, #26302f 0%, #3a4f50 55%, #4c6b6e 100%)"
      },
      "typography": {
        "fontHeading": "'Source Serif 4', Georgia, serif",
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
        "headerBg": "#eef1f1",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#26302f",
        "headerBorder": "#cdd7d6",
        "footerBg": "#26302f",
        "footerFg": "#dfe6e6",
        "footerBorder": "#4c6b6e",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4c6b6e"
      }
    }
  },
  {
    "id": "silk-dreamer-shaded-white",
    "name": "Silk Dreamer & Shaded White",
    "description": "Silk Dreamer + Shaded White. Muted blue-grey on soft off-white. Calm, airy, cool.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#5f6f72",
      "background": "#eef0ec",
      "foreground": "#2c322f",
      "accent": "#9fa9b0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#5f6f72",
        "primaryHover": "#4c5b5e",
        "onPrimary": "#ffffff",
        "secondary": "#9fa9b0",
        "accent": "#9fa9b0",
        "background": "#eef0ec",
        "foreground": "#2c322f",
        "muted": "#e6e0d2",
        "mutedForeground": "#6b7570",
        "border": "#d6d7cb",
        "card": "#ffffff",
        "cardForeground": "#2c322f",
        "link": "#4f6265",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #5f6f72 0%, #9fa9b0 120%)",
        "gradientHero": "linear-gradient(180deg, #262f2e 0%, #3f5052 55%, #5f6f72 100%)"
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
        "headerBg": "#eef0ec",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2c322f",
        "headerBorder": "#d6d7cb",
        "footerBg": "#262f2e",
        "footerFg": "#e6e0d2",
        "footerBorder": "#5f6f72",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#5f6f72"
      }
    }
  },
  {
    "id": "skimming-stone-bronze-green",
    "name": "Skimming Stone & Bronze Green",
    "description": "Skimming Stone + Light Bronze Green. Warm grey with a bronze-green primary. Understated, natural, classic.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#565343",
      "background": "#efeadd",
      "foreground": "#32332b",
      "accent": "#cfc6b6"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#565343",
        "primaryHover": "#444234",
        "onPrimary": "#ffffff",
        "secondary": "#cfc6b6",
        "accent": "#cfc6b6",
        "background": "#efeadd",
        "foreground": "#32332b",
        "muted": "#e6e0d0",
        "mutedForeground": "#747365",
        "border": "#d9d3c2",
        "card": "#ffffff",
        "cardForeground": "#32332b",
        "link": "#5f5c46",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #565343 0%, #cfc6b6 120%)",
        "gradientHero": "linear-gradient(180deg, #2a2b23 0%, #3e4032 55%, #565343 100%)"
      },
      "typography": {
        "fontHeading": "'Libre Baskerville', Georgia, serif",
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
        "headerBg": "#efeadd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#32332b",
        "headerBorder": "#d9d3c2",
        "footerBg": "#2a2b23",
        "footerFg": "#e6e0d0",
        "footerBorder": "#565343",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#565343"
      }
    }
  },
  {
    "id": "slate-blue-clay",
    "name": "Slate Blue & Clay",
    "description": "Desaturated slate blue with a clay accent. Muted, professional, cool.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4a5f78",
      "background": "#eef1f4",
      "foreground": "#26303a",
      "accent": "#b57a5a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4a5f78",
        "primaryHover": "#3a4d63",
        "onPrimary": "#ffffff",
        "secondary": "#b57a5a",
        "accent": "#b57a5a",
        "background": "#eef1f4",
        "foreground": "#26303a",
        "muted": "#e0e6ec",
        "mutedForeground": "#61707d",
        "border": "#cfd8e0",
        "card": "#ffffff",
        "cardForeground": "#26303a",
        "link": "#42586f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #4a5f78 0%, #b57a5a 120%)",
        "gradientHero": "linear-gradient(180deg, #232f3a 0%, #37485c 55%, #4a5f78 100%)"
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
        "headerBg": "#eef1f4",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#26303a",
        "headerBorder": "#cfd8e0",
        "footerBg": "#232f3a",
        "footerFg": "#e0e6ec",
        "footerBorder": "#4a5f78",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4a5f78"
      }
    }
  },
  {
    "id": "teal-coral",
    "name": "Teal & Coral",
    "description": "Jewel teal with a bright coral accent. Fresh, vivid, modern.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#157f7a",
      "background": "#eef4f2",
      "foreground": "#1c302e",
      "accent": "#e07a5f"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#157f7a",
        "primaryHover": "#0f6560",
        "onPrimary": "#ffffff",
        "secondary": "#e07a5f",
        "accent": "#e07a5f",
        "background": "#eef4f2",
        "foreground": "#1c302e",
        "muted": "#dfeae7",
        "mutedForeground": "#5f7370",
        "border": "#ccdcd8",
        "card": "#ffffff",
        "cardForeground": "#1c302e",
        "link": "#147772",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #157f7a 0%, #e07a5f 120%)",
        "gradientHero": "linear-gradient(180deg, #123331 0%, #125a56 55%, #157f7a 100%)"
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
        "headerBg": "#eef4f2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1c302e",
        "headerBorder": "#ccdcd8",
        "footerBg": "#123331",
        "footerFg": "#dfeae7",
        "footerBorder": "#157f7a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#157f7a"
      }
    }
  },
  {
    "id": "white-truffle-amaze",
    "name": "White Truffle & Amaze",
    "description": "White Truffle + Amaze. Creamy off-white with a teal jewel primary. Fresh, refined, elegant.",
    "category": "Cool & Green",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4c6b6e",
      "background": "#f1ede2",
      "foreground": "#26302f",
      "accent": "#b7a98c"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4c6b6e",
        "primaryHover": "#3c585b",
        "onPrimary": "#ffffff",
        "secondary": "#b7a98c",
        "accent": "#b7a98c",
        "background": "#f1ede2",
        "foreground": "#26302f",
        "muted": "#e7e0d0",
        "mutedForeground": "#63716f",
        "border": "#dad3c3",
        "card": "#ffffff",
        "cardForeground": "#26302f",
        "link": "#3f6265",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #4c6b6e 0%, #b7a98c 120%)",
        "gradientHero": "linear-gradient(180deg, #20302f 0%, #37504f 55%, #4c6b6e 100%)"
      },
      "typography": {
        "fontHeading": "'Source Serif 4', Georgia, serif",
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
        "headerBg": "#f1ede2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#26302f",
        "headerBorder": "#dad3c3",
        "footerBg": "#20302f",
        "footerFg": "#e7e0d0",
        "footerBorder": "#4c6b6e",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4c6b6e"
      }
    }
  },
  {
    "id": "aubergine-night",
    "name": "Aubergine Night",
    "description": "Dark aubergine canvas with an orchid primary. Moody, luxe, distinctive.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b07ac0",
      "background": "#1c1220",
      "foreground": "#efe6f0",
      "accent": "#d4a24b"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b07ac0",
        "primaryHover": "#9863a8",
        "onPrimary": "#1c1220",
        "secondary": "#d4a24b",
        "accent": "#d4a24b",
        "background": "#1c1220",
        "foreground": "#efe6f0",
        "muted": "#25182b",
        "mutedForeground": "#b199b6",
        "border": "#3a2842",
        "card": "#25182b",
        "cardForeground": "#efe6f0",
        "link": "#bd8acc",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #b07ac0 0%, #d4a24b 120%)",
        "gradientHero": "linear-gradient(180deg, #150d18 0%, #1c1220 55%, #33203b 100%)"
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
        "headerBg": "#1c1220",
        "headerBgScrolled": "#25182b",
        "headerFg": "#efe6f0",
        "headerBorder": "#3a2842",
        "footerBg": "#150d18",
        "footerFg": "#efe6f0",
        "footerBorder": "#b07ac0",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b07ac0"
      }
    }
  },
  {
    "id": "charcoal-chartreuse",
    "name": "Charcoal & Chartreuse",
    "description": "Near-black charcoal with a chartreuse accent. Bold, graphic, energetic.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b6c24a",
      "background": "#171814",
      "foreground": "#f0f0e8",
      "accent": "#8a8f78"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b6c24a",
        "primaryHover": "#9aa63a",
        "onPrimary": "#171814",
        "secondary": "#8a8f78",
        "accent": "#8a8f78",
        "background": "#171814",
        "foreground": "#f0f0e8",
        "muted": "#1f201a",
        "mutedForeground": "#a6a89a",
        "border": "#33342b",
        "card": "#1f201a",
        "cardForeground": "#f0f0e8",
        "link": "#c2ce58",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #b6c24a 0%, #8a8f78 120%)",
        "gradientHero": "linear-gradient(180deg, #111209 0%, #171814 55%, #2a2b22 100%)"
      },
      "typography": {
        "fontHeading": "'Oswald', system-ui, sans-serif",
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
        "headerBg": "#171814",
        "headerBgScrolled": "#1f201a",
        "headerFg": "#f0f0e8",
        "headerBorder": "#33342b",
        "footerBg": "#111209",
        "footerFg": "#f0f0e8",
        "footerBorder": "#b6c24a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b6c24a"
      }
    }
  },
  {
    "id": "coffee-cream-nigiri",
    "name": "Coffee Cream & Nigiri",
    "description": "Coffee Cream + Nigiri. Warm cream with a charcoal primary. Warm, high-contrast, refined.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2f2b26",
      "background": "#f2e9d5",
      "foreground": "#2c2823",
      "accent": "#c3b48a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2f2b26",
        "primaryHover": "#454037",
        "onPrimary": "#ffffff",
        "secondary": "#c3b48a",
        "accent": "#c3b48a",
        "background": "#f2e9d5",
        "foreground": "#2c2823",
        "muted": "#e9dcbf",
        "mutedForeground": "#7a6f5b",
        "border": "#ddd0b2",
        "card": "#ffffff",
        "cardForeground": "#2c2823",
        "link": "#5a5247",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #2f2b26 0%, #c3b48a 120%)",
        "gradientHero": "linear-gradient(180deg, #221f1a 0%, #33302a 55%, #524a3f 100%)"
      },
      "typography": {
        "fontHeading": "'PT Serif', Georgia, serif",
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
        "headerBg": "#f2e9d5",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2c2823",
        "headerBorder": "#ddd0b2",
        "footerBg": "#221f1a",
        "footerFg": "#e9dcbf",
        "footerBorder": "#2f2b26",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2f2b26"
      }
    }
  },
  {
    "id": "deep-forest-emerald",
    "name": "Deep Forest & Emerald",
    "description": "Dark forest canvas with an emerald primary. Rich, botanical, deep.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4a9e6f",
      "background": "#10201a",
      "foreground": "#e8f0ea",
      "accent": "#cfae6a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4a9e6f",
        "primaryHover": "#3b845b",
        "onPrimary": "#0c1913",
        "secondary": "#cfae6a",
        "accent": "#cfae6a",
        "background": "#10201a",
        "foreground": "#e8f0ea",
        "muted": "#152a22",
        "mutedForeground": "#9db6a8",
        "border": "#254036",
        "card": "#152a22",
        "cardForeground": "#e8f0ea",
        "link": "#59b07e",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #4a9e6f 0%, #cfae6a 120%)",
        "gradientHero": "linear-gradient(180deg, #0b1813 0%, #10201a 55%, #1d3b2e 100%)"
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
        "headerBg": "#10201a",
        "headerBgScrolled": "#152a22",
        "headerFg": "#e8f0ea",
        "headerBorder": "#254036",
        "footerBg": "#0b1813",
        "footerFg": "#e8f0ea",
        "footerBorder": "#4a9e6f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4a9e6f"
      }
    }
  },
  {
    "id": "midnight-petrol",
    "name": "Midnight Petrol",
    "description": "Dark petrol canvas with a bright teal primary. Moody, premium, high-contrast.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#4bb0b8",
      "background": "#0f1e24",
      "foreground": "#eaf1f2",
      "accent": "#d98f5a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#4bb0b8",
        "primaryHover": "#3d949b",
        "onPrimary": "#0f1e24",
        "secondary": "#d98f5a",
        "accent": "#d98f5a",
        "background": "#0f1e24",
        "foreground": "#eaf1f2",
        "muted": "#14272e",
        "mutedForeground": "#9fb2b6",
        "border": "#254048",
        "card": "#14272e",
        "cardForeground": "#eaf1f2",
        "link": "#5fc0c8",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #4bb0b8 0%, #d98f5a 120%)",
        "gradientHero": "linear-gradient(180deg, #0a171c 0%, #0f1e24 55%, #1c3b44 100%)"
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
        "headerBg": "#0f1e24",
        "headerBgScrolled": "#14272e",
        "headerFg": "#eaf1f2",
        "headerBorder": "#254048",
        "footerBg": "#0a171c",
        "footerFg": "#eaf1f2",
        "footerBorder": "#4bb0b8",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#4bb0b8"
      }
    }
  },
  {
    "id": "nigiri-bone",
    "name": "Nigiri & Bone",
    "description": "Nigiri + Bone. Deep charcoal on bone off-white. Editorial, high-contrast, refined.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2e2a26",
      "background": "#efe8d9",
      "foreground": "#2a2620",
      "accent": "#c9b995"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2e2a26",
        "primaryHover": "#453f37",
        "onPrimary": "#ffffff",
        "secondary": "#c9b995",
        "accent": "#c9b995",
        "background": "#efe8d9",
        "foreground": "#2a2620",
        "muted": "#e5dcc7",
        "mutedForeground": "#726b5f",
        "border": "#d9d0bf",
        "card": "#ffffff",
        "cardForeground": "#2a2620",
        "link": "#5a5247",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #2e2a26 0%, #c9b995 120%)",
        "gradientHero": "linear-gradient(180deg, #1e1b17 0%, #2e2a26 55%, #4a4238 100%)"
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
        "headerBg": "#efe8d9",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2a2620",
        "headerBorder": "#d9d0bf",
        "footerBg": "#1e1b17",
        "footerFg": "#e5dcc7",
        "footerBorder": "#2e2a26",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2e2a26"
      }
    }
  },
  {
    "id": "onyx-brass",
    "name": "Onyx & Brass",
    "description": "Warm onyx canvas with a brass primary. Luxe, understated, editorial.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c9a24b",
      "background": "#17140f",
      "foreground": "#f2ede2",
      "accent": "#9a8f74"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c9a24b",
        "primaryHover": "#ab873a",
        "onPrimary": "#17140f",
        "secondary": "#9a8f74",
        "accent": "#9a8f74",
        "background": "#17140f",
        "foreground": "#f2ede2",
        "muted": "#201c15",
        "mutedForeground": "#aca291",
        "border": "#352f24",
        "card": "#201c15",
        "cardForeground": "#f2ede2",
        "link": "#d4ac52",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #c9a24b 0%, #9a8f74 120%)",
        "gradientHero": "linear-gradient(180deg, #110e0a 0%, #17140f 55%, #2c2619 100%)"
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
        "headerBg": "#17140f",
        "headerBgScrolled": "#201c15",
        "headerFg": "#f2ede2",
        "headerBorder": "#352f24",
        "footerBg": "#110e0a",
        "footerFg": "#f2ede2",
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
    "id": "white-truffle-nigiri",
    "name": "White Truffle & Nigiri",
    "description": "White Truffle + Nigiri. Creamy off-white with a deep charcoal-black primary. Crisp, refined, high-contrast.",
    "category": "Deep & Editorial",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2e2a26",
      "background": "#efece2",
      "foreground": "#2e2a26",
      "accent": "#b7a98c"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2e2a26",
        "primaryHover": "#454038",
        "onPrimary": "#ffffff",
        "secondary": "#b7a98c",
        "accent": "#b7a98c",
        "background": "#efece2",
        "foreground": "#2e2a26",
        "muted": "#e5e0d2",
        "mutedForeground": "#726b60",
        "border": "#d9d3c4",
        "card": "#ffffff",
        "cardForeground": "#2e2a26",
        "link": "#5b5348",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #2e2a26 0%, #b7a98c 120%)",
        "gradientHero": "linear-gradient(180deg, #1f1c18 0%, #2e2a26 55%, #4a4339 100%)"
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
        "headerBg": "#efece2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2e2a26",
        "headerBorder": "#d9d3c4",
        "footerBg": "#1f1c18",
        "footerFg": "#e5e0d2",
        "footerBorder": "#2e2a26",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2e2a26"
      }
    }
  }
] as const;

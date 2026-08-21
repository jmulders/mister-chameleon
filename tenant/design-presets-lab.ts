/**
 * LAB Colour presets for the design gallery.
 *
 * 30 curated theme presets based on the LAB Colour Library (labcolourtheworld.com),
 * grouped into categories. Each is a COMPLETE look (grouped tokenOverrides) applied
 * via applyDesignPresetAction, which also derives the site-wide block tokens.
 *
 * NOTE: requires a `category` field on DesignPresetCard.
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const LAB_PRESET_CARDS: readonly DesignPresetCard[] = [
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
    "id": "shaded-white-skimming-stone",
    "name": "Shaded White & Skimming Stone",
    "description": "Shaded White + Skimming Stone. Minimalist off-white with a subtle warm grey. Light, calm, airy.",
    "category": "Neutrals & Stone",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8f8877e",
      "background": "#f0ebe0",
      "foreground": "#3a362e",
      "accent": "#cfc6b6"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8f8877e",
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
        "gradient": "linear-gradient(135deg, #8f8877e 0%, #cfc6b6 120%)",
        "gradientHero": "linear-gradient(180deg, #3a362e 0%, #5c554a 55%, #8f877e 100%)"
      },
      "typography": {
        "fontHeading": "'Inter', system-ui, sans-serif",
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
        "footerBorder": "#8f8877e",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8f8877e"
      }
    }
  },
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
        "fontHeading": "'Libre Franklin', system-ui, sans-serif",
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
    "id": "slipper-satin-bone",
    "name": "Slipper Satin & Bone",
    "description": "Slipper Satin + Bone. Soft warm whites with a subtle taupe primary. Minimalist, light, calm.",
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
        "fontHeading": "'Libre Franklin', system-ui, sans-serif",
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
    "id": "terra-pink-cashmere",
    "name": "Terra Pink & Nude Cashmere",
    "description": "Terra Pink + Nude Cashmere. Dusty terracotta pink on cashmere neutrals. Warm, soft, inviting.",
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
    "id": "ibiza-rush-spider-mum",
    "name": "Ibiza Rush & Spider Mum",
    "description": "Ibiza Rush + Spider Mum. Rust coral with an ochre/mustard accent. Warm, energetic, sunny.",
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
        "fontHeading": "'Poppins', system-ui, sans-serif",
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
    "id": "clay-mid-old-linen",
    "name": "Clay Mid & Old Linen",
    "description": "Clay - Mid + Old Linen. Earthy clay red-brown on linen neutrals. Warm, artisanal, grounded.",
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
    "id": "mushroom-terra-pink",
    "name": "Mushroom & Terra Pink",
    "description": "Mushroom + Terra Pink. Taupe neutrals with a dusty terracotta pink primary. Warm, soft, earthy.",
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
    "id": "spider-mum-portland-stone",
    "name": "Spider Mum & Portland Stone",
    "description": "Spider Mum + Portland Stone. Warm ochre on a limestone neutral. Sunny, natural, inviting.",
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
        "fontHeading": "'Poppins', system-ui, sans-serif",
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
    "id": "clay-mid-frosted-sand",
    "name": "Clay Mid & Frosted Sand",
    "description": "Clay - Mid + Frosted Sand. Earthy clay red-brown on warm sand. Warm, artisanal, grounded.",
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
    "id": "ibiza-rush-bone",
    "name": "Ibiza Rush & Bone",
    "description": "Ibiza Rush + Bone. Rust coral on bone off-white. Warm, energetic, inviting.",
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
        "fontHeading": "'Poppins', system-ui, sans-serif",
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
    "id": "coffee-cream-terra-pink",
    "name": "Coffee Cream & Terra Pink",
    "description": "Coffee Cream + Terra Pink. Warm cream with a terracotta pink primary. Warm, cosy, soft.",
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
    "id": "terra-pink-portland-stone",
    "name": "Terra Pink & Portland Stone",
    "description": "Terra Pink + Portland Stone. Dusty terracotta pink on limestone. Warm, soft, refined.",
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
    "id": "ammonite-ibiza-rush",
    "name": "Ammonite & Ibiza Rush",
    "description": "Ammonite + Ibiza Rush. Cool grey with a rust coral accent. Balanced, warm-cool, modern.",
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
        "fontHeading": "'Inter', system-ui, sans-serif",
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
        "fontHeading": "'Spectral', Georgia, serif",
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
        "fontHeading": "'Fraunces', Georgia, serif",
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
        "fontHeading": "'Libre Franklin', system-ui, sans-serif",
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
        "fontHeading": "'Spectral', Georgia, serif",
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
        "fontHeading": "'Inter', system-ui, sans-serif",
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
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
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
        "fontHeading": "'Spectral', Georgia, serif",
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
  }
] as const;

/**
 * Pride and Midnight presets.
 *
 * 10 presets: Pride (flag-inspired gradients) and a dark Midnight
 * series. Same shape as LAB_PRESET_CARDS; spread into DESIGN_PRESET_GALLERY.
 * All four font vars set; fonts are supported Google Fonts. Descriptions English.
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const PRIDE_MIDNIGHT_PRESET_CARDS: readonly DesignPresetCard[] = [
  {
    "id": "pride-bi",
    "name": "Bi Pride",
    "description": "Magenta, purple and blue. Vivid, confident, bold.",
    "category": "Pride",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#d60270",
      "background": "#fff5fa",
      "foreground": "#24102a",
      "accent": "#0038a8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#d60270",
        "primaryHover": "#b0025c",
        "onPrimary": "#ffffff",
        "secondary": "#0038a8",
        "accent": "#0038a8",
        "background": "#fff5fa",
        "foreground": "#24102a",
        "muted": "#ffe6f2",
        "mutedForeground": "#7a5a70",
        "border": "#f5d3e6",
        "card": "#ffffff",
        "cardForeground": "#24102a",
        "link": "#9b4f96",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(180deg, #d60270 0%, #d60270 40%, #9b4f96 50%, #0038a8 60%, #0038a8 100%)",
        "gradientHero": "linear-gradient(180deg, #d60270 0%, #d60270 40%, #9b4f96 50%, #0038a8 60%, #0038a8 100%)"
      },
      "typography": {
        "fontHeading": "'Sora', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 10px 30px rgba(20,16,28,.14)",
        "lg": "0 20px 48px rgba(20,16,28,.18)"
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
        "headerBg": "#fff5fa",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#24102a",
        "headerBorder": "#f5d3e6",
        "footerBg": "#24102a",
        "footerFg": "#ffe6f2",
        "footerBorder": "#d60270",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#d60270"
      }
    }
  },
  {
    "id": "pride-rainbow",
    "name": "Pride Rainbow",
    "description": "The six-colour rainbow flag on white. Joyful, bold, celebratory.",
    "category": "Pride",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8b1fd6",
      "background": "#ffffff",
      "foreground": "#1a1420",
      "accent": "#ff8c00"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8b1fd6",
        "primaryHover": "#7018b0",
        "onPrimary": "#ffffff",
        "secondary": "#ff8c00",
        "accent": "#ff8c00",
        "background": "#ffffff",
        "foreground": "#1a1420",
        "muted": "#f5f2f7",
        "mutedForeground": "#5f5a66",
        "border": "#e6e0ec",
        "card": "#ffffff",
        "cardForeground": "#1a1420",
        "link": "#8b1fd6",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(90deg, #e40303 0%, #ff8c00 20%, #ffed00 40%, #008026 60%, #004dff 80%, #750787 100%)",
        "gradientHero": "linear-gradient(90deg, #e40303 0%, #ff8c00 20%, #ffed00 40%, #008026 60%, #004dff 80%, #750787 100%)"
      },
      "typography": {
        "fontHeading": "'Poppins', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 10px 30px rgba(20,16,28,.14)",
        "lg": "0 20px 48px rgba(20,16,28,.18)"
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
        "headerBg": "#ffffff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1a1420",
        "headerBorder": "#e6e0ec",
        "footerBg": "#1a1420",
        "footerFg": "#f5f2f7",
        "footerBorder": "#8b1fd6",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8b1fd6"
      }
    }
  },
  {
    "id": "pride-progress",
    "name": "Progress Pride",
    "description": "The Progress flag chevron blend. Inclusive, bold, celebratory.",
    "category": "Pride",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#d60270",
      "background": "#ffffff",
      "foreground": "#141418",
      "accent": "#55cdfc"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#d60270",
        "primaryHover": "#b0025c",
        "onPrimary": "#ffffff",
        "secondary": "#55cdfc",
        "accent": "#55cdfc",
        "background": "#ffffff",
        "foreground": "#141418",
        "muted": "#f4f4f6",
        "mutedForeground": "#5f5f66",
        "border": "#e4e4e8",
        "card": "#ffffff",
        "cardForeground": "#141418",
        "link": "#b0025c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #000000 0%, #613915 10%, #55cdfc 22%, #f7a8b8 33%, #ffffff 44%, #e40303 56%, #ff8c00 66%, #ffed00 74%, #008026 84%, #004dff 92%, #750787 100%)",
        "gradientHero": "linear-gradient(135deg, #000000 0%, #613915 10%, #55cdfc 22%, #f7a8b8 33%, #ffffff 44%, #e40303 56%, #ff8c00 66%, #ffed00 74%, #008026 84%, #004dff 92%, #750787 100%)"
      },
      "typography": {
        "fontHeading": "'Poppins', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 10px 30px rgba(20,16,28,.14)",
        "lg": "0 20px 48px rgba(20,16,28,.18)"
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
        "headerBg": "#ffffff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#141418",
        "headerBorder": "#e4e4e8",
        "footerBg": "#0c0c10",
        "footerFg": "#f4f4f6",
        "footerBorder": "#d60270",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#d60270"
      }
    }
  },
  {
    "id": "pride-trans",
    "name": "Trans Pride",
    "description": "Sky blue, pink and white. Soft, warm, affirming.",
    "category": "Pride",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#3aa8e0",
      "background": "#ffffff",
      "foreground": "#1c2a33",
      "accent": "#f7a8b8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#3aa8e0",
        "primaryHover": "#2f8ec0",
        "onPrimary": "#ffffff",
        "secondary": "#f7a8b8",
        "accent": "#f7a8b8",
        "background": "#ffffff",
        "foreground": "#1c2a33",
        "muted": "#eef7fc",
        "mutedForeground": "#5f6d76",
        "border": "#d6e6f0",
        "card": "#ffffff",
        "cardForeground": "#1c2a33",
        "link": "#2f8ec0",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(180deg, #55cdfc 0%, #f7a8b8 25%, #ffffff 50%, #f7a8b8 75%, #55cdfc 100%)",
        "gradientHero": "linear-gradient(180deg, #55cdfc 0%, #f7a8b8 25%, #ffffff 50%, #f7a8b8 75%, #55cdfc 100%)"
      },
      "typography": {
        "fontHeading": "'Manrope', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 10px 30px rgba(20,16,28,.14)",
        "lg": "0 20px 48px rgba(20,16,28,.18)"
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
        "headerBg": "#ffffff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1c2a33",
        "headerBorder": "#d6e6f0",
        "footerBg": "#1c2a33",
        "footerFg": "#eef7fc",
        "footerBorder": "#3aa8e0",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#3aa8e0"
      }
    }
  },
  {
    "id": "midnight-amber",
    "name": "Midnight Amber",
    "description": "Dark canvas with an amber glow. Warm, cosy, deep.",
    "category": "Midnight",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#fbbf24",
      "background": "#1a150c",
      "foreground": "#f5efe2",
      "accent": "#fde68a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#fbbf24",
        "primaryHover": "#e0a616",
        "onPrimary": "#1a150c",
        "secondary": "#fde68a",
        "accent": "#fde68a",
        "background": "#1a150c",
        "foreground": "#f5efe2",
        "muted": "#281f12",
        "mutedForeground": "#b6a894",
        "border": "#3a2f1a",
        "card": "#281f12",
        "cardForeground": "#f5efe2",
        "link": "#fbbf24",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #fbbf24 0%, #fde68a 120%)",
        "gradientHero": "linear-gradient(180deg, #130f08 0%, #1a150c 55%, #3a2f1a 100%)"
      },
      "typography": {
        "fontHeading": "'Sora', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 12px 32px rgba(0,0,0,.5)",
        "lg": "0 24px 56px rgba(0,0,0,.6)"
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
        "headerBg": "#1a150c",
        "headerBgScrolled": "#281f12",
        "headerFg": "#f5efe2",
        "headerBorder": "#3a2f1a",
        "footerBg": "#130f08",
        "footerFg": "#f5efe2",
        "footerBorder": "#fbbf24",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#fbbf24"
      }
    }
  },
  {
    "id": "midnight-emerald",
    "name": "Midnight Emerald",
    "description": "Dark canvas with an emerald glow. Rich, deep, botanical.",
    "category": "Midnight",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#34d399",
      "background": "#0c1a14",
      "foreground": "#e6f2ea",
      "accent": "#a7f3d0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#34d399",
        "primaryHover": "#22b07e",
        "onPrimary": "#0c1a14",
        "secondary": "#a7f3d0",
        "accent": "#a7f3d0",
        "background": "#0c1a14",
        "foreground": "#e6f2ea",
        "muted": "#12281f",
        "mutedForeground": "#9db6a8",
        "border": "#22392e",
        "card": "#12281f",
        "cardForeground": "#e6f2ea",
        "link": "#4fe0aa",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #34d399 0%, #a7f3d0 120%)",
        "gradientHero": "linear-gradient(180deg, #081310 0%, #0c1a14 55%, #1a3a2a 100%)"
      },
      "typography": {
        "fontHeading": "'Sora', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 12px 32px rgba(0,0,0,.5)",
        "lg": "0 24px 56px rgba(0,0,0,.6)"
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
        "headerBg": "#0c1a14",
        "headerBgScrolled": "#12281f",
        "headerFg": "#e6f2ea",
        "headerBorder": "#22392e",
        "footerBg": "#081310",
        "footerFg": "#e6f2ea",
        "footerBorder": "#34d399",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#34d399"
      }
    }
  },
  {
    "id": "midnight-indigo",
    "name": "Midnight Indigo",
    "description": "Deep indigo canvas with a soft indigo glow. Calm, deep, nocturnal.",
    "category": "Midnight",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8b8cff",
      "background": "#0f1024",
      "foreground": "#e9eaf7",
      "accent": "#c0c2ff"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8b8cff",
        "primaryHover": "#7274e0",
        "onPrimary": "#0f1024",
        "secondary": "#c0c2ff",
        "accent": "#c0c2ff",
        "background": "#0f1024",
        "foreground": "#e9eaf7",
        "muted": "#171833",
        "mutedForeground": "#9fa2c6",
        "border": "#282a4a",
        "card": "#171833",
        "cardForeground": "#e9eaf7",
        "link": "#a0a2ff",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #8b8cff 0%, #c0c2ff 120%)",
        "gradientHero": "linear-gradient(180deg, #0a0b1a 0%, #0f1024 55%, #22244a 100%)"
      },
      "typography": {
        "fontHeading": "'Space Grotesk', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 12px 32px rgba(0,0,0,.5)",
        "lg": "0 24px 56px rgba(0,0,0,.6)"
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
        "headerBg": "#0f1024",
        "headerBgScrolled": "#171833",
        "headerFg": "#e9eaf7",
        "headerBorder": "#282a4a",
        "footerBg": "#0a0b1a",
        "footerFg": "#e9eaf7",
        "footerBorder": "#8b8cff",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8b8cff"
      }
    }
  },
  {
    "id": "midnight-mono",
    "name": "Midnight Mono",
    "description": "Near-black monochrome. Minimal, sleek, quiet.",
    "category": "Midnight",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#d4d4d8",
      "background": "#101012",
      "foreground": "#ececee",
      "accent": "#71717a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#d4d4d8",
        "primaryHover": "#b8b8bd",
        "onPrimary": "#101012",
        "secondary": "#71717a",
        "accent": "#71717a",
        "background": "#101012",
        "foreground": "#ececee",
        "muted": "#191a1d",
        "mutedForeground": "#a1a1aa",
        "border": "#2a2a2e",
        "card": "#191a1d",
        "cardForeground": "#ececee",
        "link": "#d4d4d8",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #d4d4d8 0%, #71717a 120%)",
        "gradientHero": "linear-gradient(180deg, #0b0b0d 0%, #101012 55%, #232326 100%)"
      },
      "typography": {
        "fontHeading": "'Space Grotesk', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 12px 32px rgba(0,0,0,.5)",
        "lg": "0 24px 56px rgba(0,0,0,.6)"
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
        "headerBg": "#101012",
        "headerBgScrolled": "#191a1d",
        "headerFg": "#ececee",
        "headerBorder": "#2a2a2e",
        "footerBg": "#0b0b0d",
        "footerFg": "#ececee",
        "footerBorder": "#d4d4d8",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#d4d4d8"
      }
    }
  },
  {
    "id": "midnight-rose",
    "name": "Midnight Rose",
    "description": "Dark canvas with a rose glow. Moody, warm, intimate.",
    "category": "Midnight",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#fb7185",
      "background": "#1c1015",
      "foreground": "#f5e9ec",
      "accent": "#fecdd3"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#fb7185",
        "primaryHover": "#e0596d",
        "onPrimary": "#1c1015",
        "secondary": "#fecdd3",
        "accent": "#fecdd3",
        "background": "#1c1015",
        "foreground": "#f5e9ec",
        "muted": "#28181e",
        "mutedForeground": "#b69da4",
        "border": "#3a2830",
        "card": "#28181e",
        "cardForeground": "#f5e9ec",
        "link": "#fb7185",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #fb7185 0%, #fecdd3 120%)",
        "gradientHero": "linear-gradient(180deg, #150c10 0%, #1c1015 55%, #3a2028 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
        "fontBody": "'Mulish', system-ui, sans-serif",
        "fontSans": "'Mulish', system-ui, sans-serif",
        "fontUI": "'Mulish', system-ui, sans-serif",
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
        "md": "0 12px 32px rgba(0,0,0,.5)",
        "lg": "0 24px 56px rgba(0,0,0,.6)"
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
        "headerBg": "#1c1015",
        "headerBgScrolled": "#28181e",
        "headerFg": "#f5e9ec",
        "headerBorder": "#3a2830",
        "footerBg": "#150c10",
        "footerFg": "#f5e9ec",
        "footerBorder": "#fb7185",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#fb7185"
      }
    }
  },
  {
    "id": "midnight-teal",
    "name": "Midnight Teal",
    "description": "Dark canvas with a teal glow. Cool, calm, deep.",
    "category": "Midnight",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2dd4bf",
      "background": "#0c1a1c",
      "foreground": "#e6f2f2",
      "accent": "#99f6e4"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2dd4bf",
        "primaryHover": "#1fb0a0",
        "onPrimary": "#0c1a1c",
        "secondary": "#99f6e4",
        "accent": "#99f6e4",
        "background": "#0c1a1c",
        "foreground": "#e6f2f2",
        "muted": "#12282b",
        "mutedForeground": "#9db6b6",
        "border": "#22393c",
        "card": "#12282b",
        "cardForeground": "#e6f2f2",
        "link": "#4fe0cf",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #2dd4bf 0%, #99f6e4 120%)",
        "gradientHero": "linear-gradient(180deg, #081314 0%, #0c1a1c 55%, #1a3a3c 100%)"
      },
      "typography": {
        "fontHeading": "'Manrope', system-ui, sans-serif",
        "fontBody": "'Inter', system-ui, sans-serif",
        "fontSans": "'Inter', system-ui, sans-serif",
        "fontUI": "'Inter', system-ui, sans-serif",
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
        "md": "0 12px 32px rgba(0,0,0,.5)",
        "lg": "0 24px 56px rgba(0,0,0,.6)"
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
        "headerBg": "#0c1a1c",
        "headerBgScrolled": "#12282b",
        "headerFg": "#e6f2f2",
        "headerBorder": "#22393c",
        "footerBg": "#081314",
        "footerFg": "#e6f2f2",
        "footerBorder": "#2dd4bf",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2dd4bf"
      }
    }
  }
] as const;

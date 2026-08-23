/**
 * Statement presets: bold, metallic and themed complete looks.
 *
 * 17 high-impact presets across three categories (Bold & Vivid,
 * Metallic, Occasion & Themed), based on vivid and metallic palettes plus a few
 * occasion themes. Same shape as LAB_PRESET_CARDS; spread into DESIGN_PRESET_GALLERY.
 * Fonts are supported Google Fonts; all four font vars are set. Descriptions English.
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const STATEMENT_PRESET_CARDS: readonly DesignPresetCard[] = [
  {
    "id": "bold-red-black",
    "name": "Bold Red & Black",
    "description": "Pure red on black and white. Swiss, industrial, decisive.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#e2231a",
      "background": "#ffffff",
      "foreground": "#111111",
      "accent": "#111111"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#e2231a",
        "primaryHover": "#c11a12",
        "onPrimary": "#ffffff",
        "secondary": "#111111",
        "accent": "#111111",
        "background": "#ffffff",
        "foreground": "#111111",
        "muted": "#f2f2f2",
        "mutedForeground": "#5f5f5f",
        "border": "#111111",
        "card": "#ffffff",
        "cardForeground": "#111111",
        "link": "#c11a12",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #e2231a 0%, #111111 120%)",
        "gradientHero": "linear-gradient(180deg, #111111 0%, #7a120d 55%, #e2231a 100%)"
      },
      "typography": {
        "fontHeading": "'Oswald', system-ui, sans-serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "fontSans": "'Work Sans', system-ui, sans-serif",
        "fontUI": "'Work Sans', system-ui, sans-serif",
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
        "headerFg": "#111111",
        "headerBorder": "#111111",
        "footerBg": "#111111",
        "footerFg": "#f2f2f2",
        "footerBorder": "#e2231a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#e2231a"
      }
    }
  },
  {
    "id": "cobalt-tangerine",
    "name": "Cobalt & Tangerine",
    "description": "Deep cobalt with a tangerine burst. Confident, punchy, modern.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#1a44e0",
      "background": "#f4f7ff",
      "foreground": "#10203a",
      "accent": "#ff7a1a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#1a44e0",
        "primaryHover": "#1436b8",
        "onPrimary": "#ffffff",
        "secondary": "#ff7a1a",
        "accent": "#ff7a1a",
        "background": "#f4f7ff",
        "foreground": "#10203a",
        "muted": "#e2ebff",
        "mutedForeground": "#5f6a80",
        "border": "#cdd8f0",
        "card": "#ffffff",
        "cardForeground": "#10203a",
        "link": "#1a44e0",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #1a44e0 0%, #ff7a1a 120%)",
        "gradientHero": "linear-gradient(180deg, #0d1830 0%, #122f8a 55%, #1a44e0 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
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
        "headerBg": "#f4f7ff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#10203a",
        "headerBorder": "#cdd8f0",
        "footerBg": "#0d1830",
        "footerFg": "#e2ebff",
        "footerBorder": "#1a44e0",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#1a44e0"
      }
    }
  },
  {
    "id": "electric-teal-magenta",
    "name": "Electric Teal & Magenta",
    "description": "Electric teal with a magenta jolt. Vivid, playful, high-energy.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#00b3a4",
      "background": "#f2fbfb",
      "foreground": "#10302f",
      "accent": "#ff2d78"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#00b3a4",
        "primaryHover": "#009488",
        "onPrimary": "#ffffff",
        "secondary": "#ff2d78",
        "accent": "#ff2d78",
        "background": "#f2fbfb",
        "foreground": "#10302f",
        "muted": "#ddf4f2",
        "mutedForeground": "#5f7472",
        "border": "#c8e6e3",
        "card": "#ffffff",
        "cardForeground": "#10302f",
        "link": "#009488",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #00b3a4 0%, #ff2d78 120%)",
        "gradientHero": "linear-gradient(180deg, #0a2b29 0%, #0d6b62 55%, #00b3a4 100%)"
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
        "headerBg": "#f2fbfb",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#10302f",
        "headerBorder": "#c8e6e3",
        "footerBg": "#0a2b29",
        "footerFg": "#ddf4f2",
        "footerBorder": "#00b3a4",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#00b3a4"
      }
    }
  },
  {
    "id": "emerald-gold-black",
    "name": "Emerald, Gold & Black",
    "description": "Emerald and gold on black. Rich, dramatic, luxe.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#14a06a",
      "background": "#0d1a14",
      "foreground": "#eaf3ec",
      "accent": "#d4af37"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#14a06a",
        "primaryHover": "#0f8256",
        "onPrimary": "#0d1a14",
        "secondary": "#d4af37",
        "accent": "#d4af37",
        "background": "#0d1a14",
        "foreground": "#eaf3ec",
        "muted": "#12241b",
        "mutedForeground": "#9db6a8",
        "border": "#22392e",
        "card": "#12241b",
        "cardForeground": "#eaf3ec",
        "link": "#2bbd83",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #14a06a 0%, #d4af37 120%)",
        "gradientHero": "linear-gradient(180deg, #08130d 0%, #0d1a14 55%, #1a3a2a 100%)"
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
        "headerBg": "#0d1a14",
        "headerBgScrolled": "#12241b",
        "headerFg": "#eaf3ec",
        "headerBorder": "#22392e",
        "footerBg": "#08130d",
        "footerFg": "#eaf3ec",
        "footerBorder": "#14a06a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#14a06a"
      }
    }
  },
  {
    "id": "hot-pink-navy",
    "name": "Hot Pink & Navy",
    "description": "Hot pink against deep navy. Bold, confident, contemporary.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#ff1e73",
      "background": "#fff5f8",
      "foreground": "#14172e",
      "accent": "#14224a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#ff1e73",
        "primaryHover": "#e00d5f",
        "onPrimary": "#ffffff",
        "secondary": "#14224a",
        "accent": "#14224a",
        "background": "#fff5f8",
        "foreground": "#14172e",
        "muted": "#ffe6ee",
        "mutedForeground": "#6a5f70",
        "border": "#f5d3e0",
        "card": "#ffffff",
        "cardForeground": "#14172e",
        "link": "#e00d5f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #ff1e73 0%, #14224a 120%)",
        "gradientHero": "linear-gradient(180deg, #14172e 0%, #8a1049 55%, #ff1e73 100%)"
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
        "headerBg": "#fff5f8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#14172e",
        "headerBorder": "#f5d3e0",
        "footerBg": "#14172e",
        "footerFg": "#ffe6ee",
        "footerBorder": "#ff1e73",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#ff1e73"
      }
    }
  },
  {
    "id": "lime-charcoal",
    "name": "Lime & Charcoal",
    "description": "Acid lime on charcoal. Sharp, graphic, energetic.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#a3d400",
      "background": "#16180f",
      "foreground": "#f0f2e6",
      "accent": "#e8ecd6"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#a3d400",
        "primaryHover": "#89b400",
        "onPrimary": "#16180f",
        "secondary": "#e8ecd6",
        "accent": "#e8ecd6",
        "background": "#16180f",
        "foreground": "#f0f2e6",
        "muted": "#1f2116",
        "mutedForeground": "#a6a894",
        "border": "#34372a",
        "card": "#1f2116",
        "cardForeground": "#f0f2e6",
        "link": "#b4e01a",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #a3d400 0%, #e8ecd6 120%)",
        "gradientHero": "linear-gradient(180deg, #101208 0%, #161810 55%, #2a2d1a 100%)"
      },
      "typography": {
        "fontHeading": "'Space Grotesk', system-ui, sans-serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "fontSans": "'Work Sans', system-ui, sans-serif",
        "fontUI": "'Work Sans', system-ui, sans-serif",
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
        "headerBg": "#16180f",
        "headerBgScrolled": "#1f2116",
        "headerFg": "#f0f2e6",
        "headerBorder": "#34372a",
        "footerBg": "#101208",
        "footerFg": "#f0f2e6",
        "footerBorder": "#a3d400",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#a3d400"
      }
    }
  },
  {
    "id": "ultraviolet-acid",
    "name": "Ultraviolet & Acid Yellow",
    "description": "Electric ultraviolet with an acid-yellow pop on near-black. Loud, futuristic, high-voltage.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#7c1fd6",
      "background": "#faf7ff",
      "foreground": "#1a0b2e",
      "accent": "#ffe01a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#7c1fd6",
        "primaryHover": "#6416b0",
        "onPrimary": "#ffffff",
        "secondary": "#ffe01a",
        "accent": "#ffe01a",
        "background": "#faf7ff",
        "foreground": "#1a0b2e",
        "muted": "#f0e9ff",
        "mutedForeground": "#6a5a80",
        "border": "#e3d6f5",
        "card": "#ffffff",
        "cardForeground": "#1a0b2e",
        "link": "#7c1fd6",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #7c1fd6 0%, #ffe01a 120%)",
        "gradientHero": "linear-gradient(180deg, #12081f 0%, #3f1284 55%, #7c1fd6 100%)"
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
        "headerBg": "#faf7ff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1a0b2e",
        "headerBorder": "#e3d6f5",
        "footerBg": "#12081f",
        "footerFg": "#f0e9ff",
        "footerBorder": "#7c1fd6",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#7c1fd6"
      }
    }
  },
  {
    "id": "violet-lime",
    "name": "Violet & Lime",
    "description": "Royal violet with a lime spark. Vivid, creative, fresh.",
    "category": "Bold & Vivid",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6d28d9",
      "background": "#f7f5ff",
      "foreground": "#1e1233",
      "accent": "#9ae600"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6d28d9",
        "primaryHover": "#5a1fb5",
        "onPrimary": "#ffffff",
        "secondary": "#9ae600",
        "accent": "#9ae600",
        "background": "#f7f5ff",
        "foreground": "#1e1233",
        "muted": "#ece7ff",
        "mutedForeground": "#665a80",
        "border": "#ddd3f5",
        "card": "#ffffff",
        "cardForeground": "#1e1233",
        "link": "#6d28d9",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #6d28d9 0%, #9ae600 120%)",
        "gradientHero": "linear-gradient(180deg, #160c28 0%, #3d1a80 55%, #6d28d9 100%)"
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
        "headerBg": "#f7f5ff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1e1233",
        "headerBorder": "#ddd3f5",
        "footerBg": "#160c28",
        "footerFg": "#ece7ff",
        "footerBorder": "#6d28d9",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6d28d9"
      }
    }
  },
  {
    "id": "champagne-gold",
    "name": "Champagne & Gold",
    "description": "Soft champagne and gold on cream. Elegant, warm, understated luxe.",
    "category": "Metallic",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c2a24a",
      "background": "#f7f1e3",
      "foreground": "#3a2f1a",
      "accent": "#e6d4a8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c2a24a",
        "primaryHover": "#a5883a",
        "onPrimary": "#ffffff",
        "secondary": "#e6d4a8",
        "accent": "#e6d4a8",
        "background": "#f7f1e3",
        "foreground": "#3a2f1a",
        "muted": "#ede2c8",
        "mutedForeground": "#867754",
        "border": "#ddceac",
        "card": "#ffffff",
        "cardForeground": "#3a2f1a",
        "link": "#a5883a",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #c2a24a 0%, #e6d4a8 60%, #9a7f34 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2f1a 0%, #6b5a2a 55%, #c2a24a 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
        "fontBody": "'Work Sans', system-ui, sans-serif",
        "fontSans": "'Work Sans', system-ui, sans-serif",
        "fontUI": "'Work Sans', system-ui, sans-serif",
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
        "headerBg": "#f7f1e3",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2f1a",
        "headerBorder": "#ddceac",
        "footerBg": "#3a2f1a",
        "footerFg": "#ede2c8",
        "footerBorder": "#c2a24a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#c2a24a"
      }
    }
  },
  {
    "id": "chrome-cobalt",
    "name": "Chrome & Cobalt",
    "description": "Brushed chrome with a cobalt charge on near-black. Sleek, technical, cool.",
    "category": "Metallic",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8fa3b8",
      "background": "#14181f",
      "foreground": "#eef2f7",
      "accent": "#2f6bff"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8fa3b8",
        "primaryHover": "#7e8fa2",
        "onPrimary": "#14181f",
        "secondary": "#2f6bff",
        "accent": "#2f6bff",
        "background": "#14181f",
        "foreground": "#eef2f7",
        "muted": "#1d2430",
        "mutedForeground": "#9fb0c6",
        "border": "#2a3341",
        "card": "#1d2430",
        "cardForeground": "#eef2f7",
        "link": "#a7bad0",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #8fa3b8 0%, #d3dde8 50%, #5f7488 120%)",
        "gradientHero": "linear-gradient(180deg, #0f1218 0%, #14181f 55%, #28303e 100%)"
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
        "headerBg": "#14181f",
        "headerBgScrolled": "#1d2430",
        "headerFg": "#eef2f7",
        "headerBorder": "#2a3341",
        "footerBg": "#0f1218",
        "footerFg": "#eef2f7",
        "footerBorder": "#8fa3b8",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8fa3b8"
      }
    }
  },
  {
    "id": "copper-gold-bronze",
    "name": "Copper, Gold & Bronze",
    "description": "Warm copper, gold and bronze with a metallic sheen. Luxe, warm, crafted.",
    "category": "Metallic",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b87333",
      "background": "#f7efe4",
      "foreground": "#2e1f14",
      "accent": "#d4af37"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b87333",
        "primaryHover": "#9a5f28",
        "onPrimary": "#ffffff",
        "secondary": "#d4af37",
        "accent": "#d4af37",
        "background": "#f7efe4",
        "foreground": "#2e1f14",
        "muted": "#eaddc9",
        "mutedForeground": "#7a6450",
        "border": "#e0cdb4",
        "card": "#ffffff",
        "cardForeground": "#2e1f14",
        "link": "#a5601f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b87333 0%, #d4af37 60%, #8a5a2a 120%)",
        "gradientHero": "linear-gradient(180deg, #2e1f14 0%, #7a4a20 55%, #b87333 100%)",
        "gradientAccent": "linear-gradient(90deg, #d4af37 0%, #b87333 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
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
        "headerBg": "#f7efe4",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2e1f14",
        "headerBorder": "#e0cdb4",
        "footerBg": "#2e1f14",
        "footerFg": "#eaddc9",
        "footerBorder": "#b87333",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b87333"
      }
    }
  },
  {
    "id": "gunmetal-brass",
    "name": "Gunmetal & Brass",
    "description": "Dark gunmetal with a brass primary. Moody, industrial, premium.",
    "category": "Metallic",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#c9a24b",
      "background": "#1a1d21",
      "foreground": "#eef0f2",
      "accent": "#8a9098"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#c9a24b",
        "primaryHover": "#ab873a",
        "onPrimary": "#1a1d21",
        "secondary": "#8a9098",
        "accent": "#8a9098",
        "background": "#1a1d21",
        "foreground": "#eef0f2",
        "muted": "#232830",
        "mutedForeground": "#a0a6ae",
        "border": "#343a44",
        "card": "#232830",
        "cardForeground": "#eef0f2",
        "link": "#d4ac52",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #c9a24b 0%, #e0c06a 55%, #9a7a30 120%)",
        "gradientHero": "linear-gradient(180deg, #121418 0%, #1a1d21 55%, #2c323c 100%)"
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
        "headerBg": "#1a1d21",
        "headerBgScrolled": "#232830",
        "headerFg": "#eef0f2",
        "headerBorder": "#343a44",
        "footerBg": "#121418",
        "footerFg": "#eef0f2",
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
    "id": "rose-gold-charcoal",
    "name": "Rose Gold & Charcoal",
    "description": "Rose gold on soft charcoal. Warm, refined, contemporary luxe.",
    "category": "Metallic",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b76e79",
      "background": "#faf1ee",
      "foreground": "#241a1a",
      "accent": "#d9a7a0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b76e79",
        "primaryHover": "#9c5763",
        "onPrimary": "#ffffff",
        "secondary": "#d9a7a0",
        "accent": "#d9a7a0",
        "background": "#faf1ee",
        "foreground": "#241a1a",
        "muted": "#f0ddd7",
        "mutedForeground": "#7a6560",
        "border": "#e6cfc7",
        "card": "#ffffff",
        "cardForeground": "#241a1a",
        "link": "#9c5763",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b76e79 0%, #d9a7a0 60%, #8a4f58 120%)",
        "gradientHero": "linear-gradient(180deg, #241a1a 0%, #6a3f43 55%, #b76e79 100%)"
      },
      "typography": {
        "fontHeading": "'Cormorant Garamond', Georgia, serif",
        "fontBody": "'Nunito', system-ui, sans-serif",
        "fontSans": "'Nunito', system-ui, sans-serif",
        "fontUI": "'Nunito', system-ui, sans-serif",
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
        "headerBg": "#faf1ee",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#241a1a",
        "headerBorder": "#e6cfc7",
        "footerBg": "#241a1a",
        "footerFg": "#f0ddd7",
        "footerBorder": "#b76e79",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b76e79"
      }
    }
  },
  {
    "id": "silver-platinum-iron",
    "name": "Silver, Platinum & Iron",
    "description": "Cool silver, platinum and iron with a brushed-metal sheen. Modern, precise, industrial.",
    "category": "Metallic",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#6b7280",
      "background": "#f4f5f7",
      "foreground": "#1c2126",
      "accent": "#b8bcc4"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#6b7280",
        "primaryHover": "#565d68",
        "onPrimary": "#ffffff",
        "secondary": "#b8bcc4",
        "accent": "#b8bcc4",
        "background": "#f4f5f7",
        "foreground": "#1c2126",
        "muted": "#e5e8ec",
        "mutedForeground": "#606871",
        "border": "#d7dade",
        "card": "#ffffff",
        "cardForeground": "#1c2126",
        "link": "#565d68",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #9aa0a8 0%, #d4d7dc 50%, #6b7280 120%)",
        "gradientHero": "linear-gradient(180deg, #1c2126 0%, #454b54 55%, #6b7280 100%)",
        "gradientAccent": "linear-gradient(90deg, #d4d7dc 0%, #9aa0a8 100%)"
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
        "headerBg": "#f4f5f7",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1c2126",
        "headerBorder": "#d7dade",
        "footerBg": "#1c2126",
        "footerFg": "#e5e8ec",
        "footerBorder": "#6b7280",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#6b7280"
      }
    }
  },
  {
    "id": "dutch-red-white-blue",
    "name": "Red White Blue",
    "description": "Dutch flag red, white and blue. Crisp, confident, national.",
    "category": "Occasion & Themed",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#21468b",
      "background": "#ffffff",
      "foreground": "#12193a",
      "accent": "#ae1c28"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#21468b",
        "primaryHover": "#193768",
        "onPrimary": "#ffffff",
        "secondary": "#ae1c28",
        "accent": "#ae1c28",
        "background": "#ffffff",
        "foreground": "#12193a",
        "muted": "#eef2f9",
        "mutedForeground": "#5f6a86",
        "border": "#d3dcee",
        "card": "#ffffff",
        "cardForeground": "#12193a",
        "link": "#21468b",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #21468b 0%, #ae1c28 120%)",
        "gradientHero": "linear-gradient(180deg, #0e1633 0%, #182f66 55%, #21468b 100%)"
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
        "headerBg": "#ffffff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#12193a",
        "headerBorder": "#d3dcee",
        "footerBg": "#0e1633",
        "footerFg": "#eef2f9",
        "footerBorder": "#21468b",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#21468b"
      }
    }
  },
  {
    "id": "valentine-romance",
    "name": "Valentine",
    "description": "Blush pink, bold red and black. Romantic, warm, high-contrast.",
    "category": "Occasion & Themed",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#d81e40",
      "background": "#fff2f5",
      "foreground": "#24080f",
      "accent": "#ff5c8a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#d81e40",
        "primaryHover": "#b81533",
        "onPrimary": "#ffffff",
        "secondary": "#ff5c8a",
        "accent": "#ff5c8a",
        "background": "#fff2f5",
        "foreground": "#24080f",
        "muted": "#ffe0e8",
        "mutedForeground": "#8a5a66",
        "border": "#f5cdd8",
        "card": "#ffffff",
        "cardForeground": "#24080f",
        "link": "#b81533",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #d81e40 0%, #ff5c8a 120%)",
        "gradientHero": "linear-gradient(180deg, #24080f 0%, #8a1030 55%, #d81e40 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
        "fontBody": "'Nunito', system-ui, sans-serif",
        "fontSans": "'Nunito', system-ui, sans-serif",
        "fontUI": "'Nunito', system-ui, sans-serif",
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
        "headerBg": "#fff2f5",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#24080f",
        "headerBorder": "#f5cdd8",
        "footerBg": "#24080f",
        "footerFg": "#ffe0e8",
        "footerBorder": "#d81e40",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#d81e40"
      }
    }
  }
] as const;

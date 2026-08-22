/**
 * Collection presets: seasonal, pastel-neon and brand-archetype complete looks.
 *
 * 17 presets across three categories (Seasonal, Pastel Neon, Brand
 * Archetypes). Brand entries are generic industry archetypes, not copies of any
 * specific brand. Same shape as LAB_PRESET_CARDS; spread into DESIGN_PRESET_GALLERY.
 * All four font vars set; fonts are supported Google Fonts. Descriptions English.
 */
import type { DesignPresetCard } from "./design-presets-gallery";

export const COLLECTION_PRESET_CARDS: readonly DesignPresetCard[] = [
  {
    "id": "autumn-harvest",
    "name": "Autumn Harvest",
    "description": "Rust, amber and warm brown. Cosy, earthy, seasonal.",
    "category": "Seasonal",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b5551f",
      "background": "#f6ede0",
      "foreground": "#3a2618",
      "accent": "#c98a2b"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b5551f",
        "primaryHover": "#984516",
        "onPrimary": "#ffffff",
        "secondary": "#c98a2b",
        "accent": "#c98a2b",
        "background": "#f6ede0",
        "foreground": "#3a2618",
        "muted": "#ecdcc4",
        "mutedForeground": "#8a6f52",
        "border": "#e0cdb0",
        "card": "#ffffff",
        "cardForeground": "#3a2618",
        "link": "#984516",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b5551f 0%, #c98a2b 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2618 0%, #7a3f18 55%, #b5551f 100%)"
      },
      "typography": {
        "fontHeading": "'Lora', Georgia, serif",
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
        "headerBg": "#f6ede0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2618",
        "headerBorder": "#e0cdb0",
        "footerBg": "#3a2618",
        "footerFg": "#ecdcc4",
        "footerBorder": "#b5551f",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b5551f"
      }
    }
  },
  {
    "id": "christmas",
    "name": "Christmas",
    "description": "Deep green, bold red and gold. Festive, warm, classic.",
    "category": "Seasonal",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#b3122a",
      "background": "#f7f2ea",
      "foreground": "#14251a",
      "accent": "#1f6e3d"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#b3122a",
        "primaryHover": "#910f22",
        "onPrimary": "#ffffff",
        "secondary": "#1f6e3d",
        "accent": "#1f6e3d",
        "background": "#f7f2ea",
        "foreground": "#14251a",
        "muted": "#ece1cf",
        "mutedForeground": "#6a6153",
        "border": "#ddcdb4",
        "card": "#ffffff",
        "cardForeground": "#14251a",
        "link": "#1f6e3d",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #b3122a 0%, #1f6e3d 100%)",
        "gradientHero": "linear-gradient(180deg, #122a1c 0%, #7a0f1f 55%, #b3122a 100%)"
      },
      "typography": {
        "fontHeading": "'Playfair Display', Georgia, serif",
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
        "headerBg": "#f7f2ea",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#14251a",
        "headerBorder": "#ddcdb4",
        "footerBg": "#122a1c",
        "footerFg": "#ece1cf",
        "footerBorder": "#b3122a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#b3122a"
      }
    }
  },
  {
    "id": "halloween",
    "name": "Halloween",
    "description": "Pumpkin orange, black and purple. Dark, playful, bold.",
    "category": "Seasonal",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#ff7518",
      "background": "#16121c",
      "foreground": "#f2ecf5",
      "accent": "#7c3aed"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#ff7518",
        "primaryHover": "#e0600d",
        "onPrimary": "#16121c",
        "secondary": "#7c3aed",
        "accent": "#7c3aed",
        "background": "#16121c",
        "foreground": "#f2ecf5",
        "muted": "#1f1a28",
        "mutedForeground": "#a89bb0",
        "border": "#342b40",
        "card": "#1f1a28",
        "cardForeground": "#f2ecf5",
        "link": "#ff8f45",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #ff7518 0%, #7c3aed 120%)",
        "gradientHero": "linear-gradient(180deg, #100c15 0%, #16121c 55%, #2a2036 100%)"
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
        "headerBg": "#16121c",
        "headerBgScrolled": "#1f1a28",
        "headerFg": "#f2ecf5",
        "headerBorder": "#342b40",
        "footerBg": "#100c15",
        "footerFg": "#f2ecf5",
        "footerBorder": "#ff7518",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#ff7518"
      }
    }
  },
  {
    "id": "spring-bloom",
    "name": "Spring Bloom",
    "description": "Fresh green with blossom pink. Light, fresh, optimistic.",
    "category": "Seasonal",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#5aa84a",
      "background": "#f4fbf2",
      "foreground": "#1c3220",
      "accent": "#f39ac0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#5aa84a",
        "primaryHover": "#478a3a",
        "onPrimary": "#ffffff",
        "secondary": "#f39ac0",
        "accent": "#f39ac0",
        "background": "#f4fbf2",
        "foreground": "#1c3220",
        "muted": "#e3f3dd",
        "mutedForeground": "#5f7560",
        "border": "#cde6c6",
        "card": "#ffffff",
        "cardForeground": "#1c3220",
        "link": "#478a3a",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #5aa84a 0%, #f39ac0 120%)",
        "gradientHero": "linear-gradient(180deg, #183020 0%, #356b2c 55%, #5aa84a 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
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
        "headerBg": "#f4fbf2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1c3220",
        "headerBorder": "#cde6c6",
        "footerBg": "#183020",
        "footerFg": "#e3f3dd",
        "footerBorder": "#5aa84a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#5aa84a"
      }
    }
  },
  {
    "id": "summer-splash",
    "name": "Summer Splash",
    "description": "Turquoise, coral and sunshine. Bright, playful, warm.",
    "category": "Seasonal",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#12b3c4",
      "background": "#f2fcfd",
      "foreground": "#103032",
      "accent": "#ff7a5c"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#12b3c4",
        "primaryHover": "#0e94a2",
        "onPrimary": "#ffffff",
        "secondary": "#ff7a5c",
        "accent": "#ff7a5c",
        "background": "#f2fcfd",
        "foreground": "#103032",
        "muted": "#ddf4f6",
        "mutedForeground": "#5f7476",
        "border": "#c8e8ea",
        "card": "#ffffff",
        "cardForeground": "#103032",
        "link": "#0e94a2",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #12b3c4 0%, #ff7a5c 120%)",
        "gradientHero": "linear-gradient(180deg, #0a2b2d 0%, #0d6b74 55%, #12b3c4 100%)"
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
        "headerBg": "#f2fcfd",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#103032",
        "headerBorder": "#c8e8ea",
        "footerBg": "#0a2b2d",
        "footerFg": "#ddf4f6",
        "footerBorder": "#12b3c4",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#12b3c4"
      }
    }
  },
  {
    "id": "winter-frost",
    "name": "Winter Frost",
    "description": "Icy blue, silver and white. Crisp, cool, serene.",
    "category": "Seasonal",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#3f7fb0",
      "background": "#f2f7fb",
      "foreground": "#1c2833",
      "accent": "#b8c6d4"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#3f7fb0",
        "primaryHover": "#336790",
        "onPrimary": "#ffffff",
        "secondary": "#b8c6d4",
        "accent": "#b8c6d4",
        "background": "#f2f7fb",
        "foreground": "#1c2833",
        "muted": "#e2ecf4",
        "mutedForeground": "#5f6d7a",
        "border": "#cfdce6",
        "card": "#ffffff",
        "cardForeground": "#1c2833",
        "link": "#336790",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #3f7fb0 0%, #b8c6d4 120%)",
        "gradientHero": "linear-gradient(180deg, #182631 0%, #2c5476 55%, #3f7fb0 100%)"
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
        "headerBg": "#f2f7fb",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#1c2833",
        "headerBorder": "#cfdce6",
        "footerBg": "#182631",
        "footerFg": "#e2ecf4",
        "footerBorder": "#3f7fb0",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#3f7fb0"
      }
    }
  },
  {
    "id": "pastel-neon-blue",
    "name": "Pastel Neon Blue",
    "description": "Pastel sky with an electric-blue charge. Clean, bright, modern.",
    "category": "Pastel Neon",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2f7bff",
      "background": "#f2f8ff",
      "foreground": "#12203a",
      "accent": "#ffe0b0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2f7bff",
        "primaryHover": "#1f63dd",
        "onPrimary": "#ffffff",
        "secondary": "#ffe0b0",
        "accent": "#ffe0b0",
        "background": "#f2f8ff",
        "foreground": "#12203a",
        "muted": "#e0edff",
        "mutedForeground": "#5f6d84",
        "border": "#cddbef",
        "card": "#ffffff",
        "cardForeground": "#12203a",
        "link": "#1f63dd",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #2f7bff 0%, #ffe0b0 120%)",
        "gradientHero": "linear-gradient(180deg, #101a30 0%, #1a4fa0 55%, #2f7bff 100%)"
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
        "headerBg": "#f2f8ff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#12203a",
        "headerBorder": "#cddbef",
        "footerBg": "#101a30",
        "footerFg": "#e0edff",
        "footerBorder": "#2f7bff",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2f7bff"
      }
    }
  },
  {
    "id": "pastel-neon-lilac",
    "name": "Pastel Neon Lilac",
    "description": "Pastel lilac with a neon-violet spark. Soft, dreamy, vivid.",
    "category": "Pastel Neon",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#8b2def",
      "background": "#f8f4ff",
      "foreground": "#231a33",
      "accent": "#ffe8b0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#8b2def",
        "primaryHover": "#7420cf",
        "onPrimary": "#ffffff",
        "secondary": "#ffe8b0",
        "accent": "#ffe8b0",
        "background": "#f8f4ff",
        "foreground": "#231a33",
        "muted": "#ede6ff",
        "mutedForeground": "#6f6080",
        "border": "#ded3f5",
        "card": "#ffffff",
        "cardForeground": "#231a33",
        "link": "#7420cf",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #8b2def 0%, #ffe8b0 120%)",
        "gradientHero": "linear-gradient(180deg, #1c1428 0%, #5a1aa0 55%, #8b2def 100%)"
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
        "headerBg": "#f8f4ff",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#231a33",
        "headerBorder": "#ded3f5",
        "footerBg": "#1c1428",
        "footerFg": "#ede6ff",
        "footerBorder": "#8b2def",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#8b2def"
      }
    }
  },
  {
    "id": "pastel-neon-mint",
    "name": "Pastel Neon Mint",
    "description": "Pastel mint with a neon-green pop. Cool, fresh, energetic.",
    "category": "Pastel Neon",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#00e08a",
      "background": "#f2fdf8",
      "foreground": "#10302a",
      "accent": "#ffd6e8"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#00e08a",
        "primaryHover": "#00bd74",
        "onPrimary": "#0c2620",
        "secondary": "#ffd6e8",
        "accent": "#ffd6e8",
        "background": "#f2fdf8",
        "foreground": "#10302a",
        "muted": "#ddf6ec",
        "mutedForeground": "#5f7570",
        "border": "#c8ebdd",
        "card": "#ffffff",
        "cardForeground": "#10302a",
        "link": "#00a866",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #00e08a 0%, #ffd6e8 120%)",
        "gradientHero": "linear-gradient(180deg, #0a231d 0%, #0d6b4a 55%, #00e08a 100%)"
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
        "headerBg": "#f2fdf8",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#10302a",
        "headerBorder": "#c8ebdd",
        "footerBg": "#0a231d",
        "footerFg": "#ddf6ec",
        "footerBorder": "#00e08a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#00e08a"
      }
    }
  },
  {
    "id": "pastel-neon-peach",
    "name": "Pastel Neon Peach",
    "description": "Pastel peach with a neon-coral pop. Warm, soft, lively.",
    "category": "Pastel Neon",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#ff5a3c",
      "background": "#fff5f0",
      "foreground": "#3a2018",
      "accent": "#bfe6ff"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#ff5a3c",
        "primaryHover": "#e0461f",
        "onPrimary": "#ffffff",
        "secondary": "#bfe6ff",
        "accent": "#bfe6ff",
        "background": "#fff5f0",
        "foreground": "#3a2018",
        "muted": "#ffe6da",
        "mutedForeground": "#8a6f60",
        "border": "#f5d3c4",
        "card": "#ffffff",
        "cardForeground": "#3a2018",
        "link": "#e0461f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #ff5a3c 0%, #bfe6ff 120%)",
        "gradientHero": "linear-gradient(180deg, #3a2018 0%, #a83a1f 55%, #ff5a3c 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
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
        "headerBg": "#fff5f0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#3a2018",
        "headerBorder": "#f5d3c4",
        "footerBg": "#3a2018",
        "footerFg": "#ffe6da",
        "footerBorder": "#ff5a3c",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#ff5a3c"
      }
    }
  },
  {
    "id": "pastel-neon-pink",
    "name": "Pastel Neon Pink",
    "description": "Soft pastels with a neon-pink jolt. Fresh, playful, modern.",
    "category": "Pastel Neon",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#ff2e93",
      "background": "#fdf4fb",
      "foreground": "#2a1230",
      "accent": "#b8f0e0"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#ff2e93",
        "primaryHover": "#e01a7c",
        "onPrimary": "#ffffff",
        "secondary": "#b8f0e0",
        "accent": "#b8f0e0",
        "background": "#fdf4fb",
        "foreground": "#2a1230",
        "muted": "#f8e6f4",
        "mutedForeground": "#7a6080",
        "border": "#f0d6ea",
        "card": "#ffffff",
        "cardForeground": "#2a1230",
        "link": "#e01a7c",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #ff2e93 0%, #b8f0e0 120%)",
        "gradientHero": "linear-gradient(180deg, #2a1230 0%, #a01060 55%, #ff2e93 100%)"
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
        "headerBg": "#fdf4fb",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2a1230",
        "headerBorder": "#f0d6ea",
        "footerBg": "#2a1230",
        "footerFg": "#f8e6f4",
        "footerBorder": "#ff2e93",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#ff2e93"
      }
    }
  },
  {
    "id": "brand-eco-green",
    "name": "Eco Green",
    "description": "Earthy green with a kraft accent. Natural, sustainable, calm.",
    "category": "Brand Archetypes",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#3f7d3a",
      "background": "#f4f7ee",
      "foreground": "#22301c",
      "accent": "#cbb089"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#3f7d3a",
        "primaryHover": "#31642d",
        "onPrimary": "#ffffff",
        "secondary": "#cbb089",
        "accent": "#cbb089",
        "background": "#f4f7ee",
        "foreground": "#22301c",
        "muted": "#e6ecd8",
        "mutedForeground": "#66714f",
        "border": "#d5ddbe",
        "card": "#ffffff",
        "cardForeground": "#22301c",
        "link": "#31642d",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #3f7d3a 0%, #cbb089 120%)",
        "gradientHero": "linear-gradient(180deg, #1c2818 0%, #2f5c2b 55%, #3f7d3a 100%)"
      },
      "typography": {
        "fontHeading": "'Outfit', system-ui, sans-serif",
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
        "headerBg": "#f4f7ee",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#22301c",
        "headerBorder": "#d5ddbe",
        "footerBg": "#1c2818",
        "footerFg": "#e6ecd8",
        "footerBorder": "#3f7d3a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#3f7d3a"
      }
    }
  },
  {
    "id": "brand-fintech-navy",
    "name": "Fintech Navy",
    "description": "Deep navy with a mint-green accent. Secure, precise, professional.",
    "category": "Brand Archetypes",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#12224a",
      "background": "#ffffff",
      "foreground": "#101a2e",
      "accent": "#16c79a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#12224a",
        "primaryHover": "#0d1936",
        "onPrimary": "#ffffff",
        "secondary": "#16c79a",
        "accent": "#16c79a",
        "background": "#ffffff",
        "foreground": "#101a2e",
        "muted": "#eef2f7",
        "mutedForeground": "#5f6a7c",
        "border": "#dde4ee",
        "card": "#ffffff",
        "cardForeground": "#101a2e",
        "link": "#16977a",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #12224a 0%, #16c79a 120%)",
        "gradientHero": "linear-gradient(180deg, #0b1424 0%, #101d3e 55%, #12224a 100%)"
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
        "headerFg": "#101a2e",
        "headerBorder": "#dde4ee",
        "footerBg": "#0b1424",
        "footerFg": "#eef2f7",
        "footerBorder": "#12224a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#12224a"
      }
    }
  },
  {
    "id": "brand-luxury-black-gold",
    "name": "Luxury Black & Gold",
    "description": "Black canvas with a gold primary. Premium, elegant, high-end.",
    "category": "Brand Archetypes",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#d4af37",
      "background": "#121212",
      "foreground": "#f2efe6",
      "accent": "#b8925a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#d4af37",
        "primaryHover": "#b8922c",
        "onPrimary": "#121212",
        "secondary": "#b8925a",
        "accent": "#b8925a",
        "background": "#121212",
        "foreground": "#f2efe6",
        "muted": "#1c1c1c",
        "mutedForeground": "#a8a498",
        "border": "#33322c",
        "card": "#1c1c1c",
        "cardForeground": "#f2efe6",
        "link": "#e0bd52",
        "success": "#5fbf90",
        "danger": "#e07a72",
        "gradient": "linear-gradient(135deg, #d4af37 0%, #b8925a 120%)",
        "gradientHero": "linear-gradient(180deg, #0c0c0c 0%, #121212 55%, #26241c 100%)"
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
        "headerBg": "#121212",
        "headerBgScrolled": "#1c1c1c",
        "headerFg": "#f2efe6",
        "headerBorder": "#33322c",
        "footerBg": "#0c0c0c",
        "footerFg": "#f2efe6",
        "footerBorder": "#d4af37",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#d4af37"
      }
    }
  },
  {
    "id": "brand-playful-pop",
    "name": "Playful Pop",
    "description": "Bright pink and sunshine yellow. Fun, friendly, energetic.",
    "category": "Brand Archetypes",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#ff5c8a",
      "background": "#fff9f0",
      "foreground": "#2e1a2a",
      "accent": "#ffd21a"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#ff5c8a",
        "primaryHover": "#e0466f",
        "onPrimary": "#ffffff",
        "secondary": "#ffd21a",
        "accent": "#ffd21a",
        "background": "#fff9f0",
        "foreground": "#2e1a2a",
        "muted": "#ffeede",
        "mutedForeground": "#7a6068",
        "border": "#f5ddc8",
        "card": "#ffffff",
        "cardForeground": "#2e1a2a",
        "link": "#e0466f",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #ff5c8a 0%, #ffd21a 120%)",
        "gradientHero": "linear-gradient(180deg, #2e1a2a 0%, #a83a5a 55%, #ff5c8a 100%)"
      },
      "typography": {
        "fontHeading": "'Poppins', system-ui, sans-serif",
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
        "headerBg": "#fff9f0",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2e1a2a",
        "headerBorder": "#f5ddc8",
        "footerBg": "#2e1a2a",
        "footerFg": "#ffeede",
        "footerBorder": "#ff5c8a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#ff5c8a"
      }
    }
  },
  {
    "id": "brand-tech-blue",
    "name": "Tech Blue",
    "description": "Clean tech blue with a cyan accent. Modern, trustworthy, product-led.",
    "category": "Brand Archetypes",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#2563eb",
      "background": "#ffffff",
      "foreground": "#0f1b2e",
      "accent": "#06b6d4"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#2563eb",
        "primaryHover": "#1d4fd0",
        "onPrimary": "#ffffff",
        "secondary": "#06b6d4",
        "accent": "#06b6d4",
        "background": "#ffffff",
        "foreground": "#0f1b2e",
        "muted": "#f1f5fb",
        "mutedForeground": "#5f6a7a",
        "border": "#e2e8f2",
        "card": "#ffffff",
        "cardForeground": "#0f1b2e",
        "link": "#2563eb",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #2563eb 0%, #06b6d4 120%)",
        "gradientHero": "linear-gradient(180deg, #0f1b2e 0%, #1a3f9a 55%, #2563eb 100%)"
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
        "headerFg": "#0f1b2e",
        "headerBorder": "#e2e8f2",
        "footerBg": "#0f1b2e",
        "footerFg": "#f1f5fb",
        "footerBorder": "#2563eb",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#2563eb"
      }
    }
  },
  {
    "id": "brand-wellness-calm",
    "name": "Wellness Calm",
    "description": "Soft sage with a blush accent. Calm, gentle, restorative.",
    "category": "Brand Archetypes",
    "baseTheme": "custom",
    "swatch": {
      "primary": "#7fa08a",
      "background": "#f5f7f2",
      "foreground": "#2b332a",
      "accent": "#e6cfc7"
    },
    "tokenOverrides": {
      "color": {
        "primary": "#7fa08a",
        "primaryHover": "#688a73",
        "onPrimary": "#ffffff",
        "secondary": "#e6cfc7",
        "accent": "#e6cfc7",
        "background": "#f5f7f2",
        "foreground": "#2b332a",
        "muted": "#e8ede1",
        "mutedForeground": "#6a7263",
        "border": "#d7ddcc",
        "card": "#ffffff",
        "cardForeground": "#2b332a",
        "link": "#688a73",
        "success": "#3f8a6a",
        "danger": "#b4534a",
        "gradient": "linear-gradient(135deg, #7fa08a 0%, #e6cfc7 120%)",
        "gradientHero": "linear-gradient(180deg, #283026 0%, #455040 55%, #7fa08a 100%)"
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
        "headerBg": "#f5f7f2",
        "headerBgScrolled": "#ffffff",
        "headerFg": "#2b332a",
        "headerBorder": "#d7ddcc",
        "footerBg": "#283026",
        "footerFg": "#e8ede1",
        "footerBorder": "#7fa08a",
        "navLinkSize": "0.95rem",
        "navLinkWeight": "600",
        "navLinkTracking": "0",
        "navTransform": "none"
      },
      "focus": {
        "ringWidth": "3px",
        "ringColor": "#7fa08a"
      }
    }
  }
] as const;

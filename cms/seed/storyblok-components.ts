/**
 * Storyblok Component Schema Definitions
 *
 * Declarative list of every component schema the Mister Chameleon platform
 * seeds into a Storyblok space.  Consumed by `seedStoryblokSpaceAction` which
 * calls `client.upsertComponent()` for each entry before seeding the stories.
 *
 * ─── Why this matters ─────────────────────────────────────────────────────────
 *
 *   Storyblok stores stories as raw JSON.  Without registered component schemas
 *   the editor renders all fields as a flat key-value dump (`[object Object]` for
 *   arrays), and the "Open preview" button emits a "Template 404.liquid is
 *   missing" error because Storyblok falls back to its Liquid renderer.
 *
 *   Registering schemas:
 *     • Gives the visual editor proper field controls (text, textarea, blocks).
 *     • Restricts which block types can be dropped into each `bloks` field.
 *     • Allows "Open preview" to resolve correctly once the space domain is set.
 *
 * ─── Component catalogue ──────────────────────────────────────────────────────
 *
 *   Leaf / nestable (no bloks children)
 *   ────────────────────────────────────
 *   ctaLink          — label + href + optional variant; used in hero & content CTAs
 *   proofItem        — title + text; item row inside a proof_variant
 *   feature          — title + description + icon; card in a featureGrid
 *   testimonial      — quote + author + role + company + avatarUrl
 *   step             — title + description + duration; row in processSteps
 *   faqItem          — question + answer
 *   navItem          — label + href; used in siteSettings nav arrays
 *   footerLink       — label + href + openInNewTab; one link inside a footerColumn
 *   footerColumn     — title + links[]; one column in the structured footer
 *   socialLink       — label + url; social media profile in the footer
 *
 *   Page section components (nestable blocks inside page.sections)
 *   ───────────────────────────────────────────────────────────────
 *   textSection      — variant + heading + body
 *   contentSection   — eyebrow + heading + intro + body + ctas[]
 *   featureGrid      — variant + heading + features[] + CTA
 *   testimonialSection — variant + heading + testimonials[]
 *   processSteps     — variant + heading + steps[]
 *   formSection      — form_key + title + intro
 *   faqSection       — variant + heading + items[]
 *
 *   Root components (story root)
 *   ─────────────────────────────
 *   page             — title + template + SEO + sections[]
 *   hero_variant     — key + is_active + tag + title + subtitle + layout + ctas[]
 *   proof_variant    — key + is_active + title + items[]
 *   cta_variant      — key + is_active + title + text + cta_label + cta_href
 *   siteSettings     — siteTitle + logo + headerCta + mainNavigation[] + footerColumns[] + footerNavigation[] + contact + socialLinks[]
 *
 * ─── Registration order ───────────────────────────────────────────────────────
 *
 *   Leaf components are listed first so that when container components reference
 *   them in `component_whitelist`, Storyblok can resolve the names.
 *   (Storyblok does accept forward-references in whitelists, but ordering is
 *   safer and makes the list easier to reason about.)
 */

import type { StoryblokComponentDef } from "../providers/storyblok-management-client";

// ── Leaf / nestable item components ───────────────────────────────────────────

/** CTA link — label, href, optional variant.
 *  Used in hero_variant.ctas and contentSection.ctas. */
const ctaLink: StoryblokComponentDef = {
  name:         "ctaLink",
  display_name: "CTA Link",
  is_root:      false,
  is_nestable:  true,
  schema: {
    label:   { type: "text",    display_name: "Label",   pos: 0, required: true },
    href:    { type: "text",    display_name: "URL",     pos: 1, required: true },
    variant: {
      type:         "option",
      display_name: "Variant",
      pos:          2,
      options: [
        { value: "primary",   name: "Primary"   },
        { value: "secondary", name: "Secondary" },
        { value: "ghost",     name: "Ghost"     },
      ],
    },
  },
};

/** Proof item — title + supporting text.
 *  One row inside a proof_variant.items bloks array. */
const proofItem: StoryblokComponentDef = {
  name:         "proofItem",
  display_name: "Proof Item",
  is_root:      false,
  is_nestable:  true,
  schema: {
    title: { type: "text",     display_name: "Title", pos: 0, required: true },
    text:  { type: "textarea", display_name: "Text",  pos: 1 },
  },
};

/** Feature card — title + description + optional icon name.
 *  Used inside featureGrid.features. */
const feature: StoryblokComponentDef = {
  name:         "feature",
  display_name: "Feature",
  is_root:      false,
  is_nestable:  true,
  schema: {
    title:       { type: "text",     display_name: "Title",       pos: 0, required: true },
    description: { type: "textarea", display_name: "Description", pos: 1 },
    icon:        { type: "text",     display_name: "Icon name",   pos: 2 },
  },
};

/** Testimonial quote — author attribution fields.
 *  Used inside testimonialSection.testimonials. */
const testimonial: StoryblokComponentDef = {
  name:         "testimonial",
  display_name: "Testimonial",
  is_root:      false,
  is_nestable:  true,
  schema: {
    quote:     { type: "textarea", display_name: "Quote",      pos: 0, required: true },
    author:    { type: "text",     display_name: "Author",     pos: 1, required: true },
    role:      { type: "text",     display_name: "Role",       pos: 2 },
    company:   { type: "text",     display_name: "Company",    pos: 3 },
    avatarUrl: { type: "text",     display_name: "Avatar URL", pos: 4 },
  },
};

/** Process step — title + description + optional duration label.
 *  Used inside processSteps.steps. */
const step: StoryblokComponentDef = {
  name:         "step",
  display_name: "Process Step",
  is_root:      false,
  is_nestable:  true,
  schema: {
    title:       { type: "text",     display_name: "Title",       pos: 0, required: true },
    description: { type: "textarea", display_name: "Description", pos: 1 },
    duration:    { type: "text",     display_name: "Duration",    pos: 2 },
  },
};

/** FAQ item — question + answer pair.
 *  Used inside faqSection.items. */
const faqItem: StoryblokComponentDef = {
  name:         "faqItem",
  display_name: "FAQ Item",
  is_root:      false,
  is_nestable:  true,
  schema: {
    question: { type: "text",     display_name: "Question", pos: 0, required: true },
    answer:   { type: "textarea", display_name: "Answer",   pos: 1 },
  },
};

/** Navigation item — label + href.
 *  Used in siteSettings.mainNavigation and siteSettings.footerNavigation. */
const navItem: StoryblokComponentDef = {
  name:         "navItem",
  display_name: "Navigation Item",
  is_root:      false,
  is_nestable:  true,
  schema: {
    label: { type: "text", display_name: "Label", pos: 0, required: true },
    href:  { type: "text", display_name: "URL",   pos: 1, required: true },
  },
};

/** Footer link — label + href + optional new-tab flag.
 *  One link inside a footerColumn.links bloks array. */
const footerLink: StoryblokComponentDef = {
  name:         "footerLink",
  display_name: "Footer Link",
  is_root:      false,
  is_nestable:  true,
  schema: {
    label:         { type: "text",    display_name: "Label",        pos: 0, required: true },
    href:          { type: "text",    display_name: "URL",          pos: 1, required: true },
    openInNewTab:  { type: "boolean", display_name: "Open in new tab", pos: 2 },
  },
};

/** Footer column — optional heading + ordered list of footer links.
 *  Used inside siteSettings.footerColumns bloks array. */
const footerColumn: StoryblokComponentDef = {
  name:         "footerColumn",
  display_name: "Footer Column",
  is_root:      false,
  is_nestable:  true,
  schema: {
    title: { type: "text", display_name: "Column Title", pos: 0 },
    links: {
      type:                "bloks",
      display_name:        "Links",
      pos:                 1,
      restrict_components: true,
      component_whitelist: ["footerLink"],
    },
  },
};

/** Social link — platform label + absolute profile URL.
 *  Used inside siteSettings.socialLinks bloks array. */
const socialLink: StoryblokComponentDef = {
  name:         "socialLink",
  display_name: "Social Link",
  is_root:      false,
  is_nestable:  true,
  schema: {
    label: { type: "text", display_name: "Platform (e.g. LinkedIn)", pos: 0, required: true },
    url:   { type: "text", display_name: "Profile URL",              pos: 1, required: true },
  },
};

/** Feature item — title + body copy + optional icon name.
 *  Used inside feature_variant.items bloks array. */
const featureItem: StoryblokComponentDef = {
  name:         "featureItem",
  display_name: "Feature Item",
  is_root:      false,
  is_nestable:  true,
  schema: {
    title: { type: "text",     display_name: "Title",       pos: 0, required: true },
    body:  { type: "textarea", display_name: "Body",        pos: 1 },
    icon:  { type: "text",     display_name: "Icon name",   pos: 2 },
  },
};

/** Conversion CTA item — label + href + optional variant.
 *  Used inside conversion_variant.ctas bloks array. */
const conversionCta: StoryblokComponentDef = {
  name:         "conversionCta",
  display_name: "Conversion CTA",
  is_root:      false,
  is_nestable:  true,
  schema: {
    label:   { type: "text",   display_name: "Label",   pos: 0, required: true },
    href:    { type: "text",   display_name: "URL",     pos: 1, required: true },
    variant: {
      type:         "option",
      display_name: "Variant",
      pos:          2,
      options: [
        { value: "primary",   name: "Primary"   },
        { value: "secondary", name: "Secondary" },
        { value: "ghost",     name: "Ghost"     },
      ],
    },
  },
};

// ── Page section components ────────────────────────────────────────────────────

/** Text section — optional variant + heading + body copy.
 *  Mapped by mapStoryblokSection("textSection"). */
const textSection: StoryblokComponentDef = {
  name:         "textSection",
  display_name: "Text Section",
  is_root:      false,
  is_nestable:  true,
  schema: {
    variant: {
      type:         "option",
      display_name: "Variant",
      pos:          0,
      options: [
        { value: "text_lead",   name: "Lead"   },
        { value: "text_normal", name: "Normal" },
        { value: "text_small",  name: "Small"  },
      ],
    },
    heading: { type: "text",     display_name: "Heading", pos: 1 },
    body:    { type: "textarea", display_name: "Body",    pos: 2 },
  },
};

/** Content section — eyebrow + heading + intro + rich body + CTA links.
 *  Mapped by mapStoryblokSection("contentSection"). */
const contentSection: StoryblokComponentDef = {
  name:         "contentSection",
  display_name: "Content Section",
  is_root:      false,
  is_nestable:  true,
  schema: {
    eyebrow: { type: "text",     display_name: "Eyebrow", pos: 0 },
    heading: { type: "text",     display_name: "Heading", pos: 1 },
    intro:   { type: "text",     display_name: "Intro",   pos: 2 },
    body:    { type: "textarea", display_name: "Body",    pos: 3 },
    ctas:    {
      type:                "bloks",
      display_name:        "CTAs",
      pos:                 4,
      restrict_components: true,
      component_whitelist: ["ctaLink"],
    },
  },
};

/** Feature grid — heading + array of feature cards + optional CTA.
 *  Mapped by mapStoryblokSection("featureGrid"). */
const featureGrid: StoryblokComponentDef = {
  name:         "featureGrid",
  display_name: "Feature Grid",
  is_root:      false,
  is_nestable:  true,
  schema: {
    variant:  { type: "text",     display_name: "Variant",   pos: 0 },
    heading:  { type: "text",     display_name: "Heading",   pos: 1 },
    features: {
      type:                "bloks",
      display_name:        "Features",
      pos:                 2,
      restrict_components: true,
      component_whitelist: ["feature"],
    },
    cta_label: { type: "text", display_name: "CTA Label", pos: 3 },
    cta_href:  { type: "text", display_name: "CTA URL",   pos: 4 },
  },
};

/** Testimonial section — heading + array of testimonial quotes.
 *  Mapped by mapStoryblokSection("testimonialSection"). */
const testimonialSection: StoryblokComponentDef = {
  name:         "testimonialSection",
  display_name: "Testimonial Section",
  is_root:      false,
  is_nestable:  true,
  schema: {
    variant:      { type: "text",  display_name: "Variant",      pos: 0 },
    heading:      { type: "text",  display_name: "Heading",      pos: 1 },
    testimonials: {
      type:                "bloks",
      display_name:        "Testimonials",
      pos:                 2,
      restrict_components: true,
      component_whitelist: ["testimonial"],
    },
  },
};

/** Process steps — heading + ordered steps with optional duration.
 *  Mapped by mapStoryblokSection("processSteps"). */
const processSteps: StoryblokComponentDef = {
  name:         "processSteps",
  display_name: "Process Steps",
  is_root:      false,
  is_nestable:  true,
  schema: {
    variant: { type: "text",  display_name: "Variant", pos: 0 },
    heading: { type: "text",  display_name: "Heading", pos: 1 },
    steps:   {
      type:                "bloks",
      display_name:        "Steps",
      pos:                 2,
      restrict_components: true,
      component_whitelist: ["step"],
    },
  },
};

/** Form section — selectable form key + optional title and intro.
 *  Mapped by mapStoryblokSection("formSection"). */
const formSection: StoryblokComponentDef = {
  name:         "formSection",
  display_name: "Form Section",
  is_root:      false,
  is_nestable:  true,
  schema: {
    form_key: {
      type:         "option",
      display_name: "Form",
      pos:          0,
      options: [
        { value: "contact",     name: "Contact"     },
        { value: "newsletter",  name: "Newsletter"  },
        { value: "appointment", name: "Appointment" },
      ],
    },
    title: { type: "text",     display_name: "Title", pos: 1 },
    intro: { type: "textarea", display_name: "Intro", pos: 2 },
  },
};

/** FAQ section — heading + question/answer pairs.
 *  Mapped by mapStoryblokSection("faqSection"). */
const faqSection: StoryblokComponentDef = {
  name:         "faqSection",
  display_name: "FAQ Section",
  is_root:      false,
  is_nestable:  true,
  schema: {
    variant: { type: "text",  display_name: "Variant", pos: 0 },
    heading: { type: "text",  display_name: "Heading", pos: 1 },
    items:   {
      type:                "bloks",
      display_name:        "Items",
      pos:                 2,
      restrict_components: true,
      component_whitelist: ["faqItem"],
    },
  },
};

// ── Root components ────────────────────────────────────────────────────────────

/** Page root — title + template + SEO + sections array.
 *  Used for all marketing pages (home, approach, about, contact, …). */
const page: StoryblokComponentDef = {
  name:         "page",
  display_name: "Page",
  is_root:      true,
  is_nestable:  false,
  schema: {
    title: { type: "text", display_name: "Title", pos: 0 },
    template: {
      type:         "option",
      display_name: "Template",
      pos:          1,
      options: [
        { value: "marketing-page", name: "Marketing Page" },
        { value: "detail-page",    name: "Detail Page"    },
        { value: "article-page",   name: "Article Page"   },
      ],
    },
    seo_title:       { type: "text",     display_name: "SEO Title",       pos: 2 },
    seo_description: { type: "textarea", display_name: "SEO Description", pos: 3 },
    sections: {
      type:                "bloks",
      display_name:        "Sections",
      pos:                 4,
      restrict_components: true,
      component_whitelist: [
        "textSection",
        "richText",
        "contentSection",
        "featureGrid",
        "testimonialSection",
        "processSteps",
        "formSection",
        "faqSection",
        "logoStrip",
        "textMedia",
        "stats",
        "about",
        "teamSection",
        "newsList",
        "ctaSection",
        "pricingSection",
        "mapBlock",
        "articleMeta",
        "articleBody",
        "relatedContent",
      ],
    },
  },
};

/** Hero variant — adaptive hero block content driven by the decision engine. */
const heroVariant: StoryblokComponentDef = {
  name:         "hero_variant",
  display_name: "Hero Variant",
  is_root:      true,
  is_nestable:  false,
  schema: {
    key:       { type: "text",    display_name: "Variant key",  pos: 0, required: true },
    is_active: { type: "boolean", display_name: "Active",       pos: 1 },
    tag:       { type: "text",    display_name: "Tag line",     pos: 2 },
    title:     { type: "text",    display_name: "Title",        pos: 3, required: true },
    subtitle:  { type: "textarea", display_name: "Subtitle",   pos: 4 },
    layout_variant: {
      type:         "option",
      display_name: "Layout",
      pos:          5,
      options: [
        { value: "split",      name: "Split"      },
        { value: "centered",   name: "Centered"   },
        { value: "fullwidth",  name: "Full width" },
      ],
    },
    content_align: {
      type:         "option",
      display_name: "Content align",
      pos:          6,
      options: [
        { value: "left",   name: "Left"   },
        { value: "center", name: "Center" },
      ],
    },
    ctas: {
      type:                "bloks",
      display_name:        "CTAs",
      pos:                 7,
      restrict_components: true,
      component_whitelist: ["ctaLink"],
    },
  },
};

/** Proof variant — adaptive social-proof block driven by the decision engine. */
const proofVariant: StoryblokComponentDef = {
  name:         "proof_variant",
  display_name: "Proof Variant",
  is_root:      true,
  is_nestable:  false,
  schema: {
    key:       { type: "text",    display_name: "Variant key", pos: 0, required: true },
    is_active: { type: "boolean", display_name: "Active",      pos: 1 },
    title:     { type: "text",    display_name: "Title",       pos: 2, required: true },
    items: {
      type:                "bloks",
      display_name:        "Items",
      pos:                 3,
      restrict_components: true,
      component_whitelist: ["proofItem"],
    },
  },
};

/** CTA variant — adaptive call-to-action block driven by the decision engine. */
const ctaVariant: StoryblokComponentDef = {
  name:         "cta_variant",
  display_name: "CTA Variant",
  is_root:      true,
  is_nestable:  false,
  schema: {
    key:       { type: "text",     display_name: "Variant key", pos: 0, required: true },
    is_active: { type: "boolean",  display_name: "Active",      pos: 1 },
    title:     { type: "text",     display_name: "Title",       pos: 2, required: true },
    text:      { type: "textarea", display_name: "Text",        pos: 3 },
    cta_label: { type: "text",     display_name: "CTA Label",   pos: 4 },
    cta_href:  { type: "text",     display_name: "CTA URL",     pos: 5 },
  },
};

/** Feature variant — adaptive feature/benefit block driven by the decision engine. */
const featureVariant: StoryblokComponentDef = {
  name:         "feature_variant",
  display_name: "Feature Variant",
  is_root:      true,
  is_nestable:  false,
  schema: {
    key:       { type: "text",    display_name: "Variant key",  pos: 0, required: true },
    is_active: { type: "boolean", display_name: "Active",       pos: 1 },
    title:     { type: "text",    display_name: "Title",        pos: 2, required: true },
    subtitle:  { type: "textarea", display_name: "Subtitle",   pos: 3 },
    layout_variant: {
      type:         "option",
      display_name: "Layout",
      pos:          4,
      options: [
        { value: "feature_grid",       name: "Grid"        },
        { value: "feature_highlights", name: "Highlights"  },
        { value: "feature_comparison", name: "Comparison"  },
      ],
    },
    items: {
      type:                "bloks",
      display_name:        "Items",
      pos:                 5,
      restrict_components: true,
      component_whitelist: ["featureItem"],
    },
  },
};

/** Conversion variant — adaptive intent-specific conversion section. */
const conversionVariant: StoryblokComponentDef = {
  name:         "conversion_variant",
  display_name: "Conversion Variant",
  is_root:      true,
  is_nestable:  false,
  schema: {
    key:       { type: "text",     display_name: "Variant key", pos: 0, required: true },
    is_active: { type: "boolean",  display_name: "Active",      pos: 1 },
    title:     { type: "text",     display_name: "Title",       pos: 2, required: true },
    text:      { type: "textarea", display_name: "Text",        pos: 3 },
    layout_variant: {
      type:         "option",
      display_name: "Layout",
      pos:          4,
      options: [
        { value: "conversion_banner", name: "Banner" },
        { value: "conversion_split",  name: "Split"  },
        { value: "conversion_card",   name: "Card"   },
      ],
    },
    ctas: {
      type:                "bloks",
      display_name:        "CTAs",
      pos:                 5,
      restrict_components: true,
      component_whitelist: ["conversionCta"],
    },
    form_key:       { type: "text", display_name: "Form Key",      pos: 6 },
    urgency_label:  { type: "text", display_name: "Urgency Label", pos: 7 },
  },
};

/** Notification variant — adaptive overlay/banner notification. */
const notificationVariant: StoryblokComponentDef = {
  name:         "notification_variant",
  display_name: "Notification Variant",
  is_root:      true,
  is_nestable:  false,
  schema: {
    key:       { type: "text",     display_name: "Variant key", pos: 0, required: true },
    is_active: { type: "boolean",  display_name: "Active",      pos: 1 },
    message:   { type: "textarea", display_name: "Message",     pos: 2, required: true },
    severity: {
      type:         "option",
      display_name: "Severity",
      pos:          3,
      options: [
        { value: "info",    name: "Info"    },
        { value: "success", name: "Success" },
        { value: "warning", name: "Warning" },
        { value: "promo",   name: "Promo"   },
      ],
    },
    cta_label: { type: "text",    display_name: "CTA Label",         pos: 4 },
    cta_href:  { type: "text",    display_name: "CTA URL",           pos: 5 },
    position: {
      type:         "option",
      display_name: "Position",
      pos:          6,
      options: [
        { value: "top",          name: "Top banner"      },
        { value: "bottom-right", name: "Bottom-right toast" },
      ],
    },
    dismissible:     { type: "boolean", display_name: "Dismissible",     pos: 7 },
    auto_dismiss_ms: { type: "text",    display_name: "Auto-dismiss (ms)", pos: 8 },
  },
};

/** Site settings — full shell configuration: nav, branding, footer, contact, social.
 *  Read by StoryblokProvider.getSiteSettings() at slug "site-settings". */
const siteSettings: StoryblokComponentDef = {
  name:         "siteSettings",
  display_name: "Site Settings",
  is_root:      true,
  is_nestable:  false,
  schema: {
    // ── Branding ──────────────────────────────────────────────────────────────
    siteTitle: { type: "text", display_name: "Site Title",    pos: 0 },
    logo_url:  { type: "text", display_name: "Logo URL",      pos: 1 },
    logo_alt:  { type: "text", display_name: "Logo Alt Text", pos: 2 },

    // ── Header CTA ────────────────────────────────────────────────────────────
    header_cta_label: { type: "text", display_name: "Header CTA Label", pos: 3 },
    header_cta_href:  { type: "text", display_name: "Header CTA URL",   pos: 4 },
    header_cta_style: {
      type:         "option",
      display_name: "Header CTA Style",
      pos:          5,
      options: [
        { value: "primary", name: "Primary" },
        { value: "outline", name: "Outline" },
        { value: "ghost",   name: "Ghost"   },
      ],
    },

    // ── Navigation ────────────────────────────────────────────────────────────
    mainNavigation: {
      type:                "bloks",
      display_name:        "Main Navigation",
      pos:                 6,
      restrict_components: true,
      component_whitelist: ["navItem"],
    },

    // ── Footer ────────────────────────────────────────────────────────────────
    footerColumns: {
      type:                "bloks",
      display_name:        "Footer Columns",
      pos:                 7,
      restrict_components: true,
      component_whitelist: ["footerColumn"],
    },
    footerNavigation: {
      type:                "bloks",
      display_name:        "Footer Bottom Links",
      pos:                 8,
      restrict_components: true,
      component_whitelist: ["navItem"],
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    contact_email: { type: "text", display_name: "Contact Email", pos: 9  },
    contact_phone: { type: "text", display_name: "Contact Phone", pos: 10 },

    // ── Social ────────────────────────────────────────────────────────────────
    socialLinks: {
      type:                "bloks",
      display_name:        "Social Links",
      pos:                 11,
      restrict_components: true,
      component_whitelist: ["socialLink"],
    },
  },
};

// ── Exported list ──────────────────────────────────────────────────────────────
//
// Registration order: leaf / nestable items first, then section containers,
// then root components.  This ensures component_whitelist references resolve
// correctly even if Storyblok validates them on creation.

// ── Additional section components ─────────────────────────────────────────────

/** logoItem — name + imageUrl + imageAlt; one logo in a logoStrip */
const logoItem: StoryblokComponentDef = {
  name: "logoItem", display_name: "Logo Item",
  is_root: false, is_nestable: true,
  schema: {
    name:      { type: "text",  display_name: "Company name",  pos: 0 },
    image_url: { type: "text",  display_name: "Logo image URL", pos: 1 },
    image_alt: { type: "text",  display_name: "Alt text",       pos: 2 },
  },
};

/** statItem — label + value + prefix + suffix + description */
const statItem: StoryblokComponentDef = {
  name: "statItem", display_name: "Stat Item",
  is_root: false, is_nestable: true,
  schema: {
    label:       { type: "text", display_name: "Label",           pos: 0, required: true },
    value:       { type: "text", display_name: "Value",           pos: 1, required: true },
    prefix:      { type: "text", display_name: "Prefix (e.g. €)", pos: 2 },
    suffix:      { type: "text", display_name: "Suffix (e.g. %)", pos: 3 },
    description: { type: "text", display_name: "Description",     pos: 4 },
  },
};

/** teamMember — name + role + bio + image_url + profile_href */
const teamMember: StoryblokComponentDef = {
  name: "teamMember", display_name: "Team Member",
  is_root: false, is_nestable: true,
  schema: {
    name:         { type: "text",     display_name: "Full name",    pos: 0, required: true },
    role:         { type: "text",     display_name: "Role / title", pos: 1, required: true },
    bio:          { type: "textarea", display_name: "Bio",          pos: 2 },
    image_url:    { type: "text",     display_name: "Photo URL",    pos: 3 },
    profile_href: { type: "text",     display_name: "Profile link", pos: 4 },
  },
};

/** newsItem — title + url + excerpt + date + image_url + category */
const newsItem: StoryblokComponentDef = {
  name: "newsItem", display_name: "News / Insight Item",
  is_root: false, is_nestable: true,
  schema: {
    title:     { type: "text",     display_name: "Title",           pos: 0, required: true },
    url:       { type: "text",     display_name: "URL",             pos: 1, required: true },
    excerpt:   { type: "textarea", display_name: "Excerpt",         pos: 2 },
    date:      { type: "text",     display_name: "Date (ISO 8601)", pos: 3 },
    image_url: { type: "text",     display_name: "Cover image URL", pos: 4 },
    category:  { type: "text",     display_name: "Category",        pos: 5 },
  },
};

/** priceTier — pricing tier for a pricingSection */
const priceTier: StoryblokComponentDef = {
  name: "priceTier", display_name: "Pricing Tier",
  is_root: false, is_nestable: true,
  schema: {
    name:        { type: "text",     display_name: "Tier name",   pos: 0, required: true },
    price:       { type: "text",     display_name: "Price",       pos: 1, required: true },
    period:      { type: "text",     display_name: "Period",       pos: 2 },
    description: { type: "textarea", display_name: "Description", pos: 3 },
    features:    { type: "textarea", display_name: "Features (one per line)", pos: 4 },
    cta_label:   { type: "text",     display_name: "CTA label",   pos: 5, required: true },
    cta_href:    { type: "text",     display_name: "CTA URL",     pos: 6, required: true },
    highlighted: { type: "boolean",  display_name: "Highlighted", pos: 7 },
    badge:       { type: "text",     display_name: "Badge text",  pos: 8 },
  },
};

const richText: StoryblokComponentDef = {
  name: "richText", display_name: "Rich Text",
  is_root: false, is_nestable: true,
  schema: {
    body:      { type: "textarea", display_name: "Body text", pos: 0 },
    max_width: {
      type: "option", display_name: "Max width", pos: 1,
      options: [{ value: "narrow", name: "Narrow" }, { value: "default", name: "Default" }, { value: "wide", name: "Wide" }],
    },
  },
};

const logoStrip: StoryblokComponentDef = {
  name: "logoStrip", display_name: "Logo Strip",
  is_root: false, is_nestable: true,
  schema: {
    heading:           { type: "text",    display_name: "Heading",          pos: 0 },
    logos:             { type: "bloks",   display_name: "Logos",            pos: 1, restrict_components: true, component_whitelist: ["logoItem"] },
    animation_enabled: { type: "boolean", display_name: "Enable animation", pos: 2 },
    grayscale:         { type: "boolean", display_name: "Greyscale",        pos: 3 },
    show_labels:       { type: "boolean", display_name: "Show labels",      pos: 4 },
  },
};

const textMedia: StoryblokComponentDef = {
  name: "textMedia", display_name: "Text + Media",
  is_root: false, is_nestable: true,
  schema: {
    eyebrow:    { type: "text",     display_name: "Eyebrow",           pos: 0 },
    heading:    { type: "text",     display_name: "Heading",           pos: 1 },
    body:       { type: "textarea", display_name: "Body",              pos: 2 },
    ctas:       { type: "bloks",    display_name: "CTAs",              pos: 3, restrict_components: true, component_whitelist: ["ctaLink"] },
    media_type: {
      type: "option", display_name: "Media type", pos: 4,
      options: [{ value: "image", name: "Image" }, { value: "video", name: "Video" }],
    },
    media_url:  { type: "text",     display_name: "Media URL",         pos: 5 },
    media_alt:  { type: "text",     display_name: "Media alt text",    pos: 6 },
    caption:    { type: "text",     display_name: "Caption",           pos: 7 },
  },
};

const stats: StoryblokComponentDef = {
  name: "stats", display_name: "Stats / Metrics",
  is_root: false, is_nestable: true,
  schema: {
    heading: { type: "text",  display_name: "Heading", pos: 0 },
    items:   { type: "bloks", display_name: "Items",   pos: 1, restrict_components: true, component_whitelist: ["statItem"] },
  },
};

const about: StoryblokComponentDef = {
  name: "about", display_name: "About / Split Media",
  is_root: false, is_nestable: true,
  schema: {
    heading:   { type: "text",     display_name: "Heading",   pos: 0 },
    body:      { type: "textarea", display_name: "Body",      pos: 1 },
    image_url: { type: "text",     display_name: "Image URL", pos: 2 },
    image_alt: { type: "text",     display_name: "Image alt", pos: 3 },
    ctas:      { type: "bloks",    display_name: "CTAs",      pos: 4, restrict_components: true, component_whitelist: ["ctaLink"] },
  },
};

const teamSection: StoryblokComponentDef = {
  name: "teamSection", display_name: "Team Section",
  is_root: false, is_nestable: true,
  schema: {
    heading: { type: "text",     display_name: "Heading", pos: 0 },
    intro:   { type: "textarea", display_name: "Intro",   pos: 1 },
    members: { type: "bloks",    display_name: "Members", pos: 2, restrict_components: true, component_whitelist: ["teamMember"] },
  },
};

const newsList: StoryblokComponentDef = {
  name: "newsList", display_name: "News / Insights List",
  is_root: false, is_nestable: true,
  schema: {
    heading:   { type: "text",   display_name: "Heading",   pos: 0 },
    max_items: { type: "number", display_name: "Max items", pos: 1 },
    items:     { type: "bloks",  display_name: "Items",     pos: 2, restrict_components: true, component_whitelist: ["newsItem"] },
  },
};

const ctaSection: StoryblokComponentDef = {
  name: "ctaSection", display_name: "CTA Section",
  is_root: false, is_nestable: true,
  schema: {
    title:       { type: "text",     display_name: "Title",       pos: 0 },
    description: { type: "textarea", display_name: "Description", pos: 1 },
    cta_label:   { type: "text",     display_name: "CTA label",   pos: 2 },
    cta_href:    { type: "text",     display_name: "CTA URL",     pos: 3 },
  },
};

const pricingSection: StoryblokComponentDef = {
  name: "pricingSection", display_name: "Pricing Section",
  is_root: false, is_nestable: true,
  schema: {
    heading:    { type: "text",     display_name: "Heading",    pos: 0 },
    subheading: { type: "textarea", display_name: "Subheading", pos: 1 },
    tiers:      { type: "bloks",    display_name: "Tiers",      pos: 2, restrict_components: true, component_whitelist: ["priceTier"] },
    footnote:   { type: "text",     display_name: "Footnote",   pos: 3 },
  },
};

const mapBlock: StoryblokComponentDef = {
  name: "mapBlock", display_name: "Map / Contact Block",
  is_root: false, is_nestable: true,
  schema: {
    heading:   { type: "text", display_name: "Heading",          pos: 0 },
    address:   { type: "text", display_name: "Street address",   pos: 1 },
    city:      { type: "text", display_name: "City",             pos: 2 },
    country:   { type: "text", display_name: "Country",          pos: 3 },
    email:     { type: "text", display_name: "Email",            pos: 4 },
    phone:     { type: "text", display_name: "Phone",            pos: 5 },
    embed_url: { type: "text", display_name: "Map embed URL",    pos: 6 },
  },
};

// ── Entity / article components ───────────────────────────────────────────────

const articleMeta: StoryblokComponentDef = {
  name: "articleMeta", display_name: "Article Meta",
  is_root: false, is_nestable: true,
  schema: {
    title:            { type: "text",     display_name: "Title",              pos: 0 },
    published_at:     { type: "text",     display_name: "Published at (ISO)", pos: 1 },
    category:         { type: "text",     display_name: "Category",           pos: 2 },
    reading_time:     { type: "number",   display_name: "Reading time (min)", pos: 3 },
    author_name:      { type: "text",     display_name: "Author name",        pos: 4 },
    author_role:      { type: "text",     display_name: "Author role",        pos: 5 },
    cover_image_url:  { type: "text",     display_name: "Cover image URL",    pos: 6 },
    cover_image_alt:  { type: "text",     display_name: "Cover image alt",    pos: 7 },
  },
};

const articleBody: StoryblokComponentDef = {
  name: "articleBody", display_name: "Article Body",
  is_root: false, is_nestable: true,
  schema: {
    body: { type: "textarea", display_name: "Body (markdown / plain text)", pos: 0 },
  },
};

/** Related content — a heading + list of linked article cards.
 *  Used at the bottom of case studies and insight articles. */
const relatedContent: StoryblokComponentDef = {
  name: "relatedContent", display_name: "Related Content",
  is_root: false, is_nestable: true,
  schema: {
    heading: { type: "text",     display_name: "Heading", pos: 0 },
    items:   { type: "textarea", display_name: "Items (JSON)",  pos: 1 },
  },
};

const caseStudy: StoryblokComponentDef = {
  name: "caseStudy", display_name: "Case Study",
  is_root: true, is_nestable: false,
  schema: {
    title:           { type: "text",     display_name: "Title",            pos: 0, required: true },
    client:          { type: "text",     display_name: "Client name",      pos: 1 },
    category:        { type: "text",     display_name: "Category",         pos: 2 },
    published_at:    { type: "text",     display_name: "Published at",     pos: 3 },
    cover_image_url: { type: "text",     display_name: "Cover image URL",  pos: 4 },
    cover_image_alt: { type: "text",     display_name: "Cover image alt",  pos: 5 },
    excerpt:         { type: "textarea", display_name: "Excerpt",          pos: 6 },
    body:            { type: "textarea", display_name: "Body",             pos: 7 },
    sections:        { type: "bloks",    display_name: "Sections",         pos: 8 },
  },
};

const insightArticle: StoryblokComponentDef = {
  name: "insightArticle", display_name: "Insight / Article",
  is_root: true, is_nestable: false,
  schema: {
    title:           { type: "text",     display_name: "Title",            pos: 0, required: true },
    category:        { type: "text",     display_name: "Category",         pos: 1 },
    published_at:    { type: "text",     display_name: "Published at",     pos: 2 },
    reading_time:    { type: "number",   display_name: "Reading time (min)", pos: 3 },
    author_name:     { type: "text",     display_name: "Author name",      pos: 4 },
    author_role:     { type: "text",     display_name: "Author role",      pos: 5 },
    cover_image_url: { type: "text",     display_name: "Cover image URL",  pos: 6 },
    excerpt:         { type: "textarea", display_name: "Excerpt",          pos: 7 },
    body:            { type: "textarea", display_name: "Body",             pos: 8 },
    sections:        { type: "bloks",    display_name: "Sections",         pos: 9 },
  },
};

export const STORYBLOK_COMPONENT_DEFINITIONS: StoryblokComponentDef[] = [
  // Leaf nestable items
  ctaLink,
  proofItem,
  feature,
  testimonial,
  step,
  faqItem,
  navItem,
  footerLink,
  footerColumn,
  socialLink,
  featureItem,
  conversionCta,
  logoItem,
  statItem,
  teamMember,
  newsItem,
  priceTier,
  // Page section blocks
  textSection,
  contentSection,
  featureGrid,
  testimonialSection,
  processSteps,
  formSection,
  faqSection,
  richText,
  logoStrip,
  textMedia,
  stats,
  about,
  teamSection,
  newsList,
  ctaSection,
  pricingSection,
  mapBlock,
  articleMeta,
  articleBody,
  relatedContent,
  // Root components
  page,
  heroVariant,
  proofVariant,
  ctaVariant,
  featureVariant,
  conversionVariant,
  notificationVariant,
  siteSettings,
  caseStudy,
  insightArticle,
];

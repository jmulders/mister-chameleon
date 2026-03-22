"use client";

/**
 * TenantSetupWizard
 *
 * A 6-step internal wizard for generating a new tenant configuration.
 * All state is local. On completion, a TypeScript config snippet is
 * produced that can be pasted directly into the codebase.
 *
 * Steps:
 *   1  Identity & Package   tenantId, name, hostname, packageId
 *   2  CMS & Decision       cmsProvider, decisionProvider, notes
 *   3  Pages & Blocks       page types, block toggles, variant key selection
 *   4  Contact & Features   contact form config, feature flags
 *   5  Theme                preset picker, radius, brand metadata
 *   6  Review & Generate    summary + generated TypeScript output
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — known variant keys from decision/types.ts
// ─────────────────────────────────────────────────────────────────────────────

const HERO_KEYS  = ["hero_google_problem", "hero_linkedin_vision", "hero_direct_brand"] as const;
const PROOF_KEYS = ["proof_cases", "proof_vision", "proof_platform"] as const;
const CTA_KEYS   = ["cta_guide", "cta_platform", "cta_meeting"] as const;

const HERO_KEY_LABELS: Record<string, string> = {
  hero_google_problem:  "Google Problem — search-intent visitor, solution-seeker framing",
  hero_linkedin_vision: "LinkedIn Vision — thought-leadership framing",
  hero_direct_brand:    "Direct Brand — unattributed visitor, brand-led headline",
};
const PROOF_KEY_LABELS: Record<string, string> = {
  proof_cases:    "Case Studies — concrete ROI and client outcomes",
  proof_vision:   "Analyst Recognition — industry quotes and awards",
  proof_platform: "Platform Scale — reliability stats and capabilities",
};
const CTA_KEY_LABELS: Record<string, string> = {
  cta_guide:    "Guide — nurture intent, downloadable content",
  cta_platform: "Platform — product-led, start building CTA",
  cta_meeting:  "Meeting — sales-led, book a call CTA",
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME PRESETS
// ─────────────────────────────────────────────────────────────────────────────

interface ThemePreset {
  id: string;
  label: string;
  primary: string;
  hover: string;
  active: string;
  subtle: string;
}

const THEME_PRESETS: ThemePreset[] = [
  { id: "indigo",  label: "Indigo (Platform default)", primary: "#6366f1", hover: "#4f46e5", active: "#4338ca", subtle: "#eef2ff" },
  { id: "teal",    label: "Teal",                      primary: "#14b8a6", hover: "#0d9488", active: "#0f766e", subtle: "#f0fdfa" },
  { id: "violet",  label: "Violet",                    primary: "#8b5cf6", hover: "#7c3aed", active: "#6d28d9", subtle: "#f5f3ff" },
  { id: "orange",  label: "Orange",                    primary: "#f97316", hover: "#ea580c", active: "#c2410c", subtle: "#fff7ed" },
  { id: "slate",   label: "Slate / Neutral",            primary: "#475569", hover: "#334155", active: "#1e293b", subtle: "#f8fafc" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────────────────────────────────────

interface WizardFormState {
  // Step 1 — Identity & Package
  tenantId:              string;
  name:                  string;
  canonicalHostname:     string;
  additionalHostnames:   string;  // comma-separated
  packageId:             "essential" | "growth" | "scale";

  // Step 2 — CMS & Decision
  cmsProvider:           "storyblok" | "sanity" | "statamic" | "mock";
  decisionProvider:      "rules" | "ai";
  cmsNotes:              string;

  // Step 3 — Pages, Blocks & Variants
  pageHomepage:          boolean;
  blockHero:             boolean;
  blockProof:            boolean;
  blockCta:              boolean;
  variantsHero:          string[];
  variantsProof:         string[];
  variantsCta:           string[];

  // Step 4 — Contact & Features
  contactEnabled:        boolean;
  contactWebhookUrl:     string;
  featureDiagnosticsBar: boolean;
  featureContactForm:    boolean;
  featureAbTesting:      boolean;
  featureAiProvider:     boolean;

  // Step 5 — Theme
  themePresetId:         string;
  themeRadius:           "sharp" | "balanced" | "soft";
  themeMetaName:         string;
  themeMetaTagline:      string;
}

type FieldErrors = Partial<Record<keyof WizardFormState | "_form", string>>;

const INITIAL_STATE: WizardFormState = {
  tenantId:              "",
  name:                  "",
  canonicalHostname:     "",
  additionalHostnames:   "",
  packageId:             "essential",
  cmsProvider:           "storyblok",
  decisionProvider:      "rules",
  cmsNotes:              "",
  pageHomepage:          true,
  blockHero:             true,
  blockProof:            true,
  blockCta:              true,
  variantsHero:          ["hero_google_problem", "hero_direct_brand"],
  variantsProof:         ["proof_cases", "proof_platform"],
  variantsCta:           ["cta_meeting"],
  contactEnabled:        true,
  contactWebhookUrl:     "",
  featureDiagnosticsBar: false,
  featureContactForm:    true,
  featureAbTesting:      false,
  featureAiProvider:     false,
  themePresetId:         "indigo",
  themeRadius:           "balanced",
  themeMetaName:         "",
  themeMetaTagline:      "",
};

const STEPS = [
  { id: 1, label: "Identity"  },
  { id: 2, label: "Providers" },
  { id: 3, label: "Pages"     },
  { id: 4, label: "Features"  },
  { id: 5, label: "Theme"     },
  { id: 6, label: "Review"    },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validateStep(step: number, state: WizardFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!state.tenantId.trim()) {
      errors.tenantId = "Required.";
    } else if (!/^[a-z0-9-]+$/.test(state.tenantId)) {
      errors.tenantId = "Use only lowercase letters, numbers, and hyphens (e.g. acme-growth).";
    }
    if (!state.name.trim()) {
      errors.name = "Required.";
    }
    if (!state.canonicalHostname.trim()) {
      errors.canonicalHostname = "Required.";
    } else if (/^https?:\/\//i.test(state.canonicalHostname)) {
      errors.canonicalHostname = "Do not include the protocol — use example.com, not https://example.com.";
    }
  }

  if (step === 2) {
    if (state.decisionProvider === "ai" && !state.featureAiProvider) {
      // Will be auto-corrected at generate time, no blocker needed
    }
  }

  if (step === 3) {
    if (state.blockHero && state.variantsHero.length === 0) {
      errors.variantsHero = "Select at least one hero variant, or disable the hero block.";
    }
    if (state.blockProof && state.variantsProof.length === 0) {
      errors.variantsProof = "Select at least one proof variant, or disable the proof block.";
    }
    if (state.blockCta && state.variantsCta.length === 0) {
      errors.variantsCta = "Select at least one CTA variant, or disable the CTA block.";
    }
  }

  if (step === 4) {
    if (state.contactEnabled && state.contactWebhookUrl) {
      try {
        new URL(state.contactWebhookUrl);
      } catch {
        errors.contactWebhookUrl = "Must be a valid URL (e.g. https://n8n.example.com/webhook/contact).";
      }
    }
    if (state.decisionProvider === "ai" && !state.featureAiProvider) {
      errors.featureAiProvider = "AI decision provider selected in Step 2 — this flag should be enabled.";
    }
  }

  if (step === 5) {
    if (!state.themeMetaName.trim()) {
      errors.themeMetaName = "Brand name is required — it appears in the admin UI.";
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function toConstantName(tenantId: string): string {
  return tenantId.toUpperCase().replace(/-/g, "_") + "_TENANT";
}

function formatArray(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[\n      ${items.map(i => `"${i}"`).join(",\n      ")},\n    ]`;
}

function generateConfigCode(state: WizardFormState): string {
  const preset = THEME_PRESETS.find(p => p.id === state.themePresetId) ?? THEME_PRESETS[0];
  const constName = toConstantName(state.tenantId);
  const hostnames = state.additionalHostnames
    .split(",")
    .map(h => h.trim())
    .filter(Boolean);

  const registrationLines = [
    `  "${state.canonicalHostname}": ${constName},`,
    ...hostnames.map(h => `  "${h}": ${constName},`),
  ].join("\n");

  const webhookLine = state.contactEnabled && state.contactWebhookUrl
    ? `\n    webhookUrl: "${state.contactWebhookUrl}",`
    : "";

  const taglineLine = state.themeMetaTagline.trim()
    ? `\n    tagline: "${state.themeMetaTagline}",`
    : "";

  return `// Generated by Tenant Setup Wizard · ${new Date().toISOString().slice(0, 10)}
//
// Next steps:
//   1. Save this file to: tenant/templates/${state.tenantId}-config.ts
//   2. Add the registration block at the bottom to resolve-tenant.ts
//   3. Set required env vars (see docs/new-tenant-setup.md)
//   4. Populate CMS content for the variant keys listed in \`variants\`

import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { neutral } from "@/design-system/theme/tenant-theme";
import { createTenantConfig } from "./base-template";

// ── Brand palette ──────────────────────────────────────────────────────────

const CLIENT_BRAND = {
  primary: "${preset.primary}",
  hover:   "${preset.hover}",
  active:  "${preset.active}",
  subtle:  "${preset.subtle}",
} as const;

// ── Theme ──────────────────────────────────────────────────────────────────

const CLIENT_THEME: TenantTheme = {
  colors: {
    brand: {
      primary:       CLIENT_BRAND.primary,
      primaryHover:  CLIENT_BRAND.hover,
      primaryActive: CLIENT_BRAND.active,
      primarySubtle: CLIENT_BRAND.subtle,
      primaryText:   "#ffffff",
      ring:          CLIENT_BRAND.primary,
      textBrand:     CLIENT_BRAND.hover,
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  neutral[100],
      bgInverse: neutral[900],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "${state.themeRadius}",
  meta: {
    name: "${state.themeMetaName}",${taglineLine}
  },
};

// ── Tenant config ──────────────────────────────────────────────────────────

export const ${constName} = createTenantConfig({
  tenantId:          "${state.tenantId}",
  name:              "${state.name}",
  canonicalHostname: "${state.canonicalHostname}",
  cmsProvider:       "${state.cmsProvider}",
  decisionProvider:  "${state.decisionProvider}",
  theme:             CLIENT_THEME,
  variants: {
    hero:  ${formatArray(state.variantsHero)},
    proof: ${formatArray(state.variantsProof)},
    cta:   ${formatArray(state.variantsCta)},
  },
  blocks: {
    hero:  ${state.blockHero},
    proof: ${state.blockProof},
    cta:   ${state.blockCta},
  },
  pages: {
    homepage: ${state.pageHomepage},
  },
  contact: {
    enabled: ${state.contactEnabled},${webhookLine}
  },
  features: {
    diagnosticsBar:     ${state.featureDiagnosticsBar},
    contactForm:        ${state.featureContactForm},
    abTesting:          ${state.featureAbTesting},
    aiDecisionProvider: ${state.featureAiProvider},
  },
});

// ── Registration (add to resolve-tenant.ts → TENANT_REGISTRY) ─────────────
//
// import { ${constName} } from "./templates/${state.tenantId}-config";
//
// ${registrationLines}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WIZARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TenantSetupWizard() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [copied, setCopied] = useState(false);

  const totalSteps = STEPS.length;

  function patch(partial: Partial<WizardFormState>) {
    setState(prev => ({ ...prev, ...partial }));
    // Clear errors for touched fields
    const touchedKeys = Object.keys(partial) as Array<keyof WizardFormState>;
    setErrors(prev => {
      const next = { ...prev };
      touchedKeys.forEach(k => { delete next[k]; });
      return next;
    });
  }

  function handleNext() {
    const errs = validateStep(step, state);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep(s => Math.min(s + 1, totalSteps));
  }

  function handleBack() {
    setErrors({});
    setStep(s => Math.max(s - 1, 1));
  }

  async function handleCopy() {
    const code = generateConfigCode(state);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API not available — silently fail; user can select + copy
    }
  }

  return (
    <div className="flex flex-col gap-6 px-8 py-8 max-w-3xl">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900">New Tenant</h1>
          <Badge variant="warning" size="sm">Internal</Badge>
        </div>
        <p className="text-sm text-neutral-500">
          Complete all steps to generate a tenant configuration file.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} steps={STEPS} />

      {/* Step content */}
      <Card padding="none" shadow="sm">
        {step === 1 && <StepIdentity    state={state} errors={errors} patch={patch} />}
        {step === 2 && <StepProviders   state={state} errors={errors} patch={patch} />}
        {step === 3 && <StepPages       state={state} errors={errors} patch={patch} />}
        {step === 4 && <StepFeatures    state={state} errors={errors} patch={patch} />}
        {step === 5 && <StepTheme       state={state} errors={errors} patch={patch} />}
        {step === 6 && <StepReview      state={state} copied={copied} onCopy={handleCopy} />}

        {/* Navigation footer */}
        <div className={cn(
          "flex items-center border-t border-neutral-100 px-6 py-4",
          step === 1 ? "justify-end" : "justify-between",
        )}>
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          )}
          {step < totalSteps && (
            <Button variant="primary" size="sm" onClick={handleNext}>
              Continue →
            </Button>
          )}
          {step === totalSteps && (
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "Copy config to clipboard"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: typeof STEPS;
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const isDone    = currentStep > s.id;
        const isActive  = currentStep === s.id;
        const isUpcoming = currentStep < s.id;
        const isLast    = i === steps.length - 1;

        return (
          <div key={s.id} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                isDone    && "border-brand-500 bg-brand-500 text-white",
                isActive  && "border-brand-500 bg-white text-brand-600",
                isUpcoming && "border-neutral-200 bg-white text-neutral-400",
              )}>
                {isDone ? (
                  <svg viewBox="0 0 12 12" className="size-3.5 stroke-current fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                ) : s.id}
              </div>
              <span className={cn(
                "text-xs whitespace-nowrap",
                isActive  && "font-medium text-neutral-800",
                isDone    && "text-brand-600",
                isUpcoming && "text-neutral-400",
              )}>
                {s.label}
              </span>
            </div>
            {/* Connector */}
            {!isLast && (
              <div className={cn(
                "mb-5 mx-1 h-px w-8 flex-1",
                currentStep > s.id ? "bg-brand-300" : "bg-neutral-200",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FORM PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

interface StepProps {
  state:  WizardFormState;
  errors: FieldErrors;
  patch:  (partial: Partial<WizardFormState>) => void;
}

function StepShell({ title, subtitle, children }: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, error, required, children }: {
  label:    string;
  hint?:    string;
  error?:   string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-error-500">*</span>}
      </label>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      {children}
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

const inputCls = (hasError?: boolean) => cn(
  "h-9 w-full rounded-md border px-3 text-sm",
  "text-neutral-900 placeholder:text-neutral-400",
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
  "transition-colors",
  hasError
    ? "border-error-400 bg-error-50"
    : "border-neutral-300 bg-white hover:border-neutral-400",
);

const textareaCls = (hasError?: boolean) => cn(
  "w-full rounded-md border px-3 py-2 text-sm leading-relaxed",
  "text-neutral-900 placeholder:text-neutral-400",
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
  "resize-none transition-colors",
  hasError
    ? "border-error-400 bg-error-50"
    : "border-neutral-300 bg-white hover:border-neutral-400",
);

function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value:    T;
  onChange: (v: T) => void;
  options:  { value: T; label: string; description?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
            value === opt.value
              ? "border-brand-400 bg-brand-50"
              : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
          )}
        >
          <input
            type="radio"
            className="mt-0.5 accent-brand-500"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-neutral-800">{opt.label}</span>
            {opt.description && (
              <span className="text-xs text-neutral-500">{opt.description}</span>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

function CheckGroup({
  options,
  selected,
  onChange,
  error,
}: {
  options:  { value: string; label?: string; sublabel?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  error?:   string;
}) {
  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value],
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1.5">
        {options.map(opt => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
              selected.includes(opt.value)
                ? "border-brand-300 bg-brand-50"
                : "border-neutral-200 bg-white hover:border-neutral-300",
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-brand-500"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs text-neutral-800">{opt.value}</span>
              {opt.sublabel && <span className="text-xs text-neutral-500">{opt.sublabel}</span>}
            </div>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-error-600">{error}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked:     boolean;
  onChange:    (v: boolean) => void;
  label:       string;
  description?: string;
}) {
  return (
    <label className={cn(
      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
      checked
        ? "border-brand-300 bg-brand-50"
        : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
    )}>
      {/* Toggle track */}
      <div className="relative mt-0.5 shrink-0">
        <div className={cn(
          "h-5 w-9 rounded-full transition-colors",
          checked ? "bg-brand-500" : "bg-neutral-300",
        )} />
        <div className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )} />
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        {description && <span className="text-xs text-neutral-500">{description}</span>}
      </div>
    </label>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-neutral-100" />
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-neutral-100" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — IDENTITY & PACKAGE
// ─────────────────────────────────────────────────────────────────────────────

function StepIdentity({ state, errors, patch }: StepProps) {
  return (
    <StepShell
      title="Identity & Package"
      subtitle="Basic tenant identification and the commercial package this client is on."
    >
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Tenant ID"
          hint="Kebab-case slug used in logs and analytics. Cannot be changed after launch."
          error={errors.tenantId}
          required
        >
          <input
            className={inputCls(!!errors.tenantId)}
            value={state.tenantId}
            placeholder="acme-growth"
            onChange={e => patch({ tenantId: e.target.value.toLowerCase() })}
          />
        </Field>

        <Field
          label="Display Name"
          hint="Human-readable name shown in admin UIs."
          error={errors.name}
          required
        >
          <input
            className={inputCls(!!errors.name)}
            value={state.name}
            placeholder="Acme Growth Co."
            onChange={e => patch({ name: e.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Canonical Hostname"
        hint="Primary production hostname — no protocol, no trailing slash."
        error={errors.canonicalHostname}
        required
      >
        <input
          className={inputCls(!!errors.canonicalHostname)}
          value={state.canonicalHostname}
          placeholder="acmegrowth.com"
          onChange={e => patch({ canonicalHostname: e.target.value.replace(/^https?:\/\//i, "") })}
        />
      </Field>

      <Field
        label="Additional Hostnames"
        hint="Other hostnames this tenant answers to — comma-separated. Include www., staging., and Vercel preview URLs."
      >
        <input
          className={inputCls()}
          value={state.additionalHostnames}
          placeholder="www.acmegrowth.com, acmegrowth.vercel.app"
          onChange={e => patch({ additionalHostnames: e.target.value })}
        />
      </Field>

      <Divider label="Package" />

      <Field label="Commercial Package" hint="Determines the capability set and enabled modules.">
        <RadioGroup
          value={state.packageId}
          onChange={v => patch({ packageId: v })}
          options={[
            { value: "essential", label: "Essential", description: "Core adaptive homepage, rules decisioning, contact form, visitor history." },
            { value: "growth",    label: "Growth",    description: "Adds adaptive landing pages, A/B experiment support, analytics dashboard." },
            { value: "scale",     label: "Scale",     description: "Adds AI decisioning and adaptive product/service pages." },
          ]}
        />
      </Field>
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

function StepProviders({ state, errors, patch }: StepProps) {
  return (
    <StepShell
      title="CMS & Decision Providers"
      subtitle="Which backend systems the tenant uses for content and adaptive decisions."
    >
      <Field
        label="CMS Provider"
        hint="Requires the corresponding env var to be set in the deployment environment."
      >
        <RadioGroup
          value={state.cmsProvider}
          onChange={v => patch({ cmsProvider: v })}
          options={[
            { value: "storyblok", label: "Storyblok",        description: "Visual editor, component-based. Requires STORYBLOK_ACCESS_TOKEN." },
            { value: "sanity",    label: "Sanity",            description: "Structured content, powerful GROQ queries. Requires SANITY_PROJECT_ID + SANITY_API_TOKEN." },
            { value: "statamic",  label: "Statamic",          description: "Flat-file / Eloquent. Requires STATAMIC_API_URL + STATAMIC_API_TOKEN." },
            { value: "mock",      label: "Mock (dev / test)", description: "In-memory hardcoded data. No env vars needed. Never use in production." },
          ]}
        />
      </Field>

      <Divider label="Decision Engine" />

      <Field label="Decision Provider">
        <RadioGroup
          value={state.decisionProvider}
          onChange={v => {
            patch({
              decisionProvider: v,
              featureAiProvider: v === "ai" ? true : state.featureAiProvider,
            });
          }}
          options={[
            { value: "rules", label: "Rules",           description: "Ordered rule set evaluated on each request. Zero inference cost. Correct default for all new clients." },
            { value: "ai",    label: "AI (advanced)",   description: "Abstract AI base. Enable only after confidence policy review. Automatically sets featureAiDecisionProvider flag." },
          ]}
        />
      </Field>

      <Field
        label="CMS Notes"
        hint="Internal notes for the implementation team — space ID, credentials location, region. Not used at runtime."
        error={errors.cmsNotes}
      >
        <textarea
          className={textareaCls()}
          rows={3}
          value={state.cmsNotes}
          placeholder="Storyblok space ID: 12345. EU region. Credentials in 1Password → Clients → Acme."
          onChange={e => patch({ cmsNotes: e.target.value })}
        />
      </Field>
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — PAGES, BLOCKS & VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

function StepPages({ state, errors, patch }: StepProps) {
  return (
    <StepShell
      title="Pages, Blocks & Variants"
      subtitle="Which adaptive pages and sections are active, and which variant keys the CMS has content for."
    >
      <Divider label="Page Types" />

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <Toggle
          checked={state.pageHomepage}
          onChange={v => patch({ pageHomepage: v })}
          label="Homepage adaptive pipeline"
          description="The main website homepage. Always enabled for Essential and above."
        />
      </div>

      <Divider label="Page Section Blocks" />

      <p className="text-xs text-neutral-500">
        Disable a block if the client&apos;s design doesn&apos;t include that section. Enabling a block without CMS content will cause the platform to fall back to default content.
      </p>

      <div className="flex flex-col gap-2">
        <Toggle
          checked={state.blockHero}
          onChange={v => patch({ blockHero: v })}
          label="Hero block"
          description="Main headline + subheadline + primary CTA area."
        />
        <Toggle
          checked={state.blockProof}
          onChange={v => patch({ blockProof: v })}
          label="Proof block"
          description="Social proof / evidence section (stat cards, testimonials)."
        />
        <Toggle
          checked={state.blockCta}
          onChange={v => patch({ blockCta: v })}
          label="CTA block"
          description="Standalone call-to-action section."
        />
      </div>

      <Divider label="Variant Keys" />

      <p className="text-xs text-neutral-500">
        Select only the variant keys that have CMS content. The decision engine will only serve keys listed here — selecting a key without content causes a silent fallback.
      </p>

      {state.blockHero && (
        <Field
          label="Hero variants"
          hint="Start with 2. Add a third once the content team has written it."
          error={errors.variantsHero}
        >
          <CheckGroup
            options={HERO_KEYS.map(k => ({ value: k, sublabel: HERO_KEY_LABELS[k] }))}
            selected={state.variantsHero}
            onChange={v => patch({ variantsHero: v })}
            error={errors.variantsHero}
          />
        </Field>
      )}

      {state.blockProof && (
        <Field
          label="Proof variants"
          error={errors.variantsProof}
        >
          <CheckGroup
            options={PROOF_KEYS.map(k => ({ value: k, sublabel: PROOF_KEY_LABELS[k] }))}
            selected={state.variantsProof}
            onChange={v => patch({ variantsProof: v })}
            error={errors.variantsProof}
          />
        </Field>
      )}

      {state.blockCta && (
        <Field
          label="CTA variants"
          error={errors.variantsCta}
        >
          <CheckGroup
            options={CTA_KEYS.map(k => ({ value: k, sublabel: CTA_KEY_LABELS[k] }))}
            selected={state.variantsCta}
            onChange={v => patch({ variantsCta: v })}
            error={errors.variantsCta}
          />
        </Field>
      )}
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — CONTACT & FEATURES
// ─────────────────────────────────────────────────────────────────────────────

function StepFeatures({ state, errors, patch }: StepProps) {
  return (
    <StepShell
      title="Contact & Features"
      subtitle="Contact form settings and runtime feature flags."
    >
      <Divider label="Contact Form" />

      <div className="flex flex-col gap-3">
        <Toggle
          checked={state.contactEnabled}
          onChange={v => patch({ contactEnabled: v, featureContactForm: v })}
          label="Contact form enabled"
          description="Allows POST /api/contact submissions for this tenant."
        />

        {state.contactEnabled && (
          <Field
            label="Per-client n8n webhook URL"
            hint="Leave blank to use the platform-level N8N_CONTACT_WEBHOOK_URL env var. Set this when the client has their own n8n instance."
            error={errors.contactWebhookUrl}
          >
            <input
              className={inputCls(!!errors.contactWebhookUrl)}
              value={state.contactWebhookUrl}
              placeholder="https://n8n.acmegrowth.com/webhook/contact-intake"
              onChange={e => patch({ contactWebhookUrl: e.target.value })}
            />
          </Field>
        )}
      </div>

      <Divider label="Feature Flags" />

      <p className="text-xs text-neutral-500">
        All flags default to their safest production values. Do not enable diagnosticsBar in production.
      </p>

      <div className="flex flex-col gap-2">
        <Toggle
          checked={state.featureDiagnosticsBar}
          onChange={v => patch({ featureDiagnosticsBar: v })}
          label="Diagnostics bar"
          description="Shows the debug overlay in the browser. NEVER enable in production — only for local development."
        />
        <Toggle
          checked={state.featureContactForm}
          onChange={v => patch({ featureContactForm: v })}
          label="Contact form"
          description="Renders the contact form and activates the /api/contact route."
        />
        <Toggle
          checked={state.featureAbTesting}
          onChange={v => patch({ featureAbTesting: v })}
          label="A/B testing"
          description="Queries the experiments table on every request. Enable only when an experiment is configured."
        />
        <Toggle
          checked={state.featureAiProvider}
          onChange={v => patch({ featureAiProvider: v })}
          label="AI decision provider"
          description="Required when decisionProvider is 'ai'. Enables inference cost — review confidence policy first."
        />
      </div>

      {errors.featureAiProvider && (
        <p className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700">
          ⚠ {errors.featureAiProvider}
        </p>
      )}
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — THEME
// ─────────────────────────────────────────────────────────────────────────────

function StepTheme({ state, errors, patch }: StepProps) {
  return (
    <StepShell
      title="Theme"
      subtitle="Brand colours, corner radius, and metadata for the tenant. The selected preset can be further customised after the config is generated."
    >
      <Divider label="Colour Preset" />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEME_PRESETS.map(preset => (
          <label
            key={preset.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
              state.themePresetId === preset.id
                ? "border-brand-400 bg-brand-50"
                : "border-neutral-200 bg-white hover:border-neutral-300",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              checked={state.themePresetId === preset.id}
              onChange={() => patch({ themePresetId: preset.id })}
            />
            {/* Colour swatch */}
            <div className="flex shrink-0 gap-1">
              <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: preset.primary }} />
              <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: preset.subtle }} />
            </div>
            <span className="text-sm text-neutral-800">{preset.label}</span>
            {state.themePresetId === preset.id && (
              <span className="ml-auto text-brand-500">
                <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
                  <path d="M13.5 4.5l-7 7L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </span>
            )}
          </label>
        ))}
      </div>

      <Divider label="Corner Radius" />

      <Field label="Radius personality" hint="Controls the border-radius of buttons, cards, and interactive elements.">
        <RadioGroup
          value={state.themeRadius}
          onChange={v => patch({ themeRadius: v })}
          options={[
            { value: "sharp",    label: "Sharp",    description: "Angular, technical feel. SaaS/startup aesthetic." },
            { value: "balanced", label: "Balanced", description: "Default platform radius. Works for most B2B brands." },
            { value: "soft",     label: "Soft",     description: "Rounded, friendly. Consumer or approachable brand feel." },
          ]}
        />
      </Field>

      <Divider label="Brand Metadata" />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Brand name"
          hint="Appears in admin UIs and the theme meta. Usually the client's full brand name."
          error={errors.themeMetaName}
          required
        >
          <input
            className={inputCls(!!errors.themeMetaName)}
            value={state.themeMetaName}
            placeholder={state.name || "Acme Growth Co."}
            onChange={e => patch({ themeMetaName: e.target.value })}
          />
        </Field>

        <Field
          label="Brand tagline"
          hint="One-line positioning statement. Optional."
        >
          <input
            className={inputCls()}
            value={state.themeMetaTagline}
            placeholder="Growth-driven marketing, simplified."
            onChange={e => patch({ themeMetaTagline: e.target.value })}
          />
        </Field>
      </div>
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — REVIEW & GENERATE
// ─────────────────────────────────────────────────────────────────────────────

function StepReview({
  state,
  copied,
  onCopy,
}: {
  state:  WizardFormState;
  copied: boolean;
  onCopy: () => void;
}) {
  const code = generateConfigCode(state);
  const preset = THEME_PRESETS.find(p => p.id === state.themePresetId) ?? THEME_PRESETS[0];

  return (
    <div className="flex flex-col gap-0">
      {/* Summary */}
      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-neutral-900">Review & Generate</h2>
          <p className="text-sm text-neutral-500">
            Confirm the configuration, then copy the generated TypeScript file.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="Identity">
            <SummaryRow k="tenantId"    v={<code className="font-mono text-xs">{state.tenantId}</code>} />
            <SummaryRow k="name"        v={state.name} />
            <SummaryRow k="hostname"    v={<code className="font-mono text-xs">{state.canonicalHostname}</code>} />
            <SummaryRow k="package"     v={<Badge variant="primary" size="sm">{state.packageId}</Badge>} />
          </SummaryCard>

          <SummaryCard label="Providers">
            <SummaryRow k="cms"       v={<Badge variant="default" size="sm">{state.cmsProvider}</Badge>} />
            <SummaryRow k="decision"  v={<Badge variant="default" size="sm">{state.decisionProvider}</Badge>} />
          </SummaryCard>

          <SummaryCard label="Blocks & Variants">
            {state.blockHero  && <SummaryRow k="hero"  v={<span className="text-xs text-neutral-500">{state.variantsHero.join(", ")}</span>} />}
            {state.blockProof && <SummaryRow k="proof" v={<span className="text-xs text-neutral-500">{state.variantsProof.join(", ")}</span>} />}
            {state.blockCta   && <SummaryRow k="cta"   v={<span className="text-xs text-neutral-500">{state.variantsCta.join(", ")}</span>} />}
          </SummaryCard>

          <SummaryCard label="Theme">
            <SummaryRow k="preset" v={
              <div className="flex items-center gap-2">
                <span className="size-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.primary }} />
                <span className="text-xs text-neutral-700">{preset.label}</span>
              </div>
            } />
            <SummaryRow k="radius" v={<Badge variant="default" size="sm">{state.themeRadius}</Badge>} />
          </SummaryCard>
        </div>
      </div>

      {/* Generated code */}
      <div className="border-t border-neutral-100">
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-700">
              tenant/templates/{state.tenantId || "new-tenant"}-config.ts
            </span>
            <Badge variant="default" size="sm">Generated</Badge>
          </div>
          <button
            onClick={onCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              copied
                ? "bg-success-100 text-success-700"
                : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50",
            )}
          >
            {copied ? (
              <><svg viewBox="0 0 12 12" className="size-3 stroke-current fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5" /></svg> Copied</>
            ) : (
              <><svg viewBox="0 0 12 12" className="size-3 stroke-current fill-none" strokeWidth="1.5"><rect x="4" y="1" width="7" height="9" rx="1"/><path d="M1 4h3M1 7h3M1 4v6a1 1 0 001 1h5"/></svg> Copy</>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto bg-neutral-950 px-6 py-5 text-xs leading-relaxed text-neutral-200 max-h-96">
          {code}
        </pre>
      </div>

      {/* Next steps */}
      <div className="border-t border-neutral-100 px-6 py-4">
        <p className="text-xs font-medium text-neutral-700">After copying:</p>
        <ol className="mt-1.5 flex flex-col gap-1">
          {[
            `Save to tenant/templates/${state.tenantId || "new-tenant"}-config.ts`,
            "Add the hostname entries to resolve-tenant.ts (see comment at bottom of file)",
            `Set required env vars for ${state.cmsProvider} (see docs/new-tenant-setup.md)`,
            "Run npx tsc --noEmit to verify zero errors",
            "Populate CMS content for all selected variant keys",
          ].map((step, i) => (
            <li key={i} className="flex gap-2 text-xs text-neutral-500">
              <span className="shrink-0 font-medium text-neutral-400">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-neutral-400">{k}</span>
      <span className="min-w-0">{v}</span>
    </div>
  );
}

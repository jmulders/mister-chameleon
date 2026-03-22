/**
 * OnboardingForm
 *
 * Client component — the create-tenant form for /admin/onboarding.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   Tenant name     Display name (e.g. "Acme Corp")
 *   Tenant ID       URL-safe slug, auto-generated from name, manually editable
 *   Website URL     Primary hostname (e.g. "acme.com" or "https://acme.com")
 *   Package         starter / growth / pro — drives feature and block defaults
 *   CMS provider    sanity / storyblok / statamic / mock
 *   Theme preset    Filtered to the chosen package's allowedThemes
 *
 * ─── Slug auto-generation ─────────────────────────────────────────────────────
 *
 *   While the user has not manually edited the tenant ID field, it is kept in
 *   sync with the tenant name: lowercase, hyphens, max 32 chars.  The moment
 *   the user edits the ID field directly the auto-sync stops.
 *
 * ─── Package awareness ────────────────────────────────────────────────────────
 *
 *   The package selector shows each option's short description and indicative
 *   price from the PackageOption model (getAllPackageOptions).  Selecting a
 *   package updates the theme selector to only show themes allowed on that tier.
 *   If the current theme is not permitted by the newly selected package, it is
 *   reset to "default" automatically.
 *
 * ─── Submit flow ──────────────────────────────────────────────────────────────
 *
 *   1. User submits the form.
 *   2. createTenantFromOnboardingAction() is called via useTransition.
 *   3a. On success → success panel with link to the new tenant detail page.
 *   3b. On failure → field errors under each affected field + error banner.
 *   3c. Warnings → amber notice above the submit button.
 *
 * ─── Success state ────────────────────────────────────────────────────────────
 *
 *   The form is replaced by a success panel showing the new tenant ID, a link
 *   to /admin/tenants/<id>, and a "Create another" button that resets the form.
 */

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAllPackageOptions, getPackageDefinition } from "@/tenant";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/primitives/Text";
import { TenantReadinessChecklist } from "@/components/admin/TenantReadinessChecklist";
import { createTenantFromOnboardingAction } from "@/app/admin/tenants/actions";
import type { CreateTenantResult } from "@/app/admin/tenants/actions";
import type { PackageKey, CMSProviderName, ThemeKey, TenantSettings } from "@/tenant";
import type { OnboardingInput } from "@/onboarding";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CMS_PROVIDERS: readonly CMSProviderName[] = [
  "sanity", "storyblok", "statamic", "mock",
];

const CMS_DISPLAY: Record<CMSProviderName, string> = {
  sanity:    "Sanity",
  storyblok: "Storyblok",
  statamic:  "Statamic",
  mock:      "Mock (local / dev)",
};

const THEME_DISPLAY: Record<ThemeKey, string> = {
  default: "Default",
  minimal: "Minimal",
  bold:    "Bold",
  custom:  "Custom",
};

/** Minimum package hint for themes not available on every tier. */
const THEME_TIER_HINT: Partial<Record<ThemeKey, string>> = {
  minimal: "Growth or Pro",
  bold:    "Pro only",
  custom:  "Pro only",
};

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

const PACKAGE_BADGE_VARIANT: Record<PackageKey, BadgeVariant> = {
  starter: "default",
  growth:  "primary",
  pro:     "success",
};

// Pre-compute package options once — pure constants, stable across renders.
const PACKAGE_OPTIONS = getAllPackageOptions();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a display name into a kebab-case tenant ID slug.
 * Strips non-alphanumeric characters, collapses whitespace/hyphens,
 * and clamps to 32 characters.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function limitDisplay(n: number): string {
  if (n === Infinity) return "Unlimited";
  if (n === 0)        return "None";
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  tenantName:  string;
  tenantId:    string;
  websiteUrl:  string;
  packageKey:  PackageKey;
  cmsProvider: CMSProviderName;
  themePreset: ThemeKey;
}

const DEFAULT_FORM: FormState = {
  tenantName:  "",
  tenantId:    "",
  websiteUrl:  "",
  packageKey:  "starter",
  cmsProvider: "mock",
  themePreset: "default",
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const inputBase = [
  "w-full rounded-lg border bg-white px-3 py-2",
  "text-sm text-neutral-900 placeholder:text-neutral-400",
  "focus:outline-none focus:ring-2",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
  "transition-colors",
].join(" ");

const inputNormal = "border-neutral-300 focus:border-brand-500 focus:ring-brand-200";
const inputError  = "border-error-400 focus:border-error-500 focus:ring-error-100";

function inputCls(hasError: boolean) {
  return cn(inputBase, hasError ? inputError : inputNormal);
}

const selectBase = [
  "w-full rounded-lg border bg-white px-3 py-2",
  "text-sm text-neutral-900",
  "focus:outline-none focus:ring-2",
  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
  "transition-colors",
].join(" ");

function selectCls(hasError: boolean) {
  return cn(selectBase, hasError ? inputError : inputNormal);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Labelled form field with optional hint and error message. */
function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label:    string;
  hint?:    string;
  error?:   string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-error-500" aria-hidden>*</span>}
      </label>
      {hint && (
        <p className="text-xs text-neutral-400">{hint}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-error-600" role="alert">{error}</p>
      )}
    </div>
  );
}

/**
 * Package summary strip — shows what the selected package includes.
 * Reuses the PackageOption model from getAllPackageOptions().
 */
function PackageSummaryStrip({ packageKey }: { packageKey: PackageKey }) {
  const opt = PACKAGE_OPTIONS.find((o) => o.key === packageKey);
  if (!opt) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <p className="text-xs italic text-neutral-500">{opt.shortDescription}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Chip label="Sites" value={limitDisplay(opt.limits.maxSites)} />
        <Chip label="Experiments" value={limitDisplay(opt.limits.maxExperiments)} />
        <Chip label="Variants / slot" value={limitDisplay(opt.limits.maxVariantsPerSlot)} />
        <Chip label="Price" value={opt.monthlyPriceLabel} />
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-neutral-500">
      <span className="font-medium text-neutral-700">{value}</span>
      <span>{label.toLowerCase()}</span>
    </span>
  );
}

/** Section divider with a title. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP SUMMARY CARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single labelled row in the setup summary card.
 * Shows a text label on the left and a value (plus optional badge) on the right.
 */
function SummaryRow({
  label,
  value,
  badge,
}: {
  label:   string;
  value:   string;
  badge?:  React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span className="text-xs font-medium text-neutral-800">{value}</span>
        {badge}
      </div>
    </div>
  );
}

/**
 * Compact summary of the configuration choices made during onboarding.
 * Shows: package (with tier badge), CMS provider (with dev-only warning if mock),
 * theme preset, and primary URL (with missing warning if blank).
 */
function SetupSummaryCard({
  tenant,
  websiteUrl,
}: {
  tenant:     TenantSettings;
  websiteUrl: string;
}) {
  const pkgLabel   = PACKAGE_DISPLAY[tenant.packageKey] ?? tenant.packageKey;
  const pkgVariant = PACKAGE_BADGE_VARIANT[tenant.packageKey] ?? "default";
  const cmsLabel   = CMS_DISPLAY[tenant.cms.provider as CMSProviderName] ?? tenant.cms.provider;
  const themeLabel = THEME_DISPLAY[tenant.design.theme as ThemeKey]      ?? tenant.design.theme;
  const urlTrimmed = websiteUrl.trim();

  return (
    <Card padding="md" shadow="sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Setup summary
        </p>
      </div>
      <CardContent>
        <SummaryRow
          label="Package"
          value={pkgLabel}
          badge={
            <Badge variant={pkgVariant} size="sm">
              {pkgLabel}
            </Badge>
          }
        />
        <SummaryRow
          label="CMS provider"
          value={cmsLabel}
          badge={
            tenant.cms.provider === "mock" ? (
              <Badge variant="warning" size="sm">Dev only</Badge>
            ) : undefined
          }
        />
        <SummaryRow
          label="Theme preset"
          value={themeLabel}
        />
        <SummaryRow
          label="Primary URL"
          value={urlTrimmed || "—"}
          badge={
            !urlTrimmed ? (
              <Badge variant="warning" size="sm">Missing</Badge>
            ) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function SuccessPanel({
  tenant,
  websiteUrl,
  warnings,
  onCreateAnother,
}: {
  tenant:          TenantSettings;
  websiteUrl:      string;
  warnings?:       string[];
  onCreateAnother: () => void;
}) {
  const tenantId = tenant.tenantId;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Success card */}
      <Card className="border-success-200 bg-success-50">
        <CardContent>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white text-xs font-bold">
              ✓
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-success-800">
                Tenant created successfully
              </p>
              <p className="text-sm text-success-700">
                <span className="font-mono font-medium">{tenantId}</span>{" "}
                has been added to the tenant store.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings from enforcement/substitutions */}
      {warnings && warnings.length > 0 && (
        <Card className="border-warning-200 bg-warning-50">
          <CardContent>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warning-700">
              Settings adjusted
            </p>
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-warning-700">
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Setup summary — package, CMS, theme, URL */}
      <SetupSummaryCard tenant={tenant} websiteUrl={websiteUrl} />

      {/* Before-launch checklist — what still needs attention */}
      <TenantReadinessChecklist
        tenant={tenant}
        websiteUrl={websiteUrl}
        title="Before launch"
      />

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link href={`/admin/tenants/${tenantId}`}>
          <Button variant="primary" size="md">
            Go to tenant admin →
          </Button>
        </Link>
        <Button variant="outline" size="md" onClick={onCreateAnother}>
          Create another tenant
        </Button>
        <Link
          href="/admin/tenants"
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← All tenants
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FORM
// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingForm() {
  const [form, setForm]               = useState<FormState>(DEFAULT_FORM);
  const [slugEdited, setSlugEdited]   = useState(false);
  const [result, setResult]           = useState<CreateTenantResult | null>(null);
  const [isPending, startTransition]  = useTransition();

  // Show success panel when creation succeeded.
  if (result?.ok === true) {
    return (
      <SuccessPanel
        tenant={result.tenant}
        websiteUrl={form.websiteUrl}
        warnings={result.warnings}
        onCreateAnother={() => {
          setForm(DEFAULT_FORM);
          setSlugEdited(false);
          setResult(null);
        }}
      />
    );
  }

  // Field-level errors from the last failed submission.
  const fieldErrors = result?.ok === false ? (result.fieldErrors ?? {}) : {};
  const generalError = result?.ok === false ? result.error : null;

  // The package definition for the currently selected package key.
  const pkgDef       = getPackageDefinition(form.packageKey);
  const allowedThemes = pkgDef.allowedThemes as readonly ThemeKey[];

  // ── Field change handlers ───────────────────────────────────────────────────

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      tenantName: name,
      // Keep slug in sync as long as the user hasn't manually edited it.
      tenantId: slugEdited ? prev.tenantId : slugify(name),
    }));
    setResult(null);
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, tenantId: slug.toLowerCase() }));
    setResult(null);
  }

  function handlePackageChange(key: PackageKey) {
    const newPkg     = getPackageDefinition(key);
    const allowed    = newPkg.allowedThemes as readonly ThemeKey[];
    const theme      = allowed.includes(form.themePreset) ? form.themePreset : "default";
    setForm((prev) => ({ ...prev, packageKey: key, themePreset: theme }));
    setResult(null);
  }

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const input: OnboardingInput = {
      tenantId:    form.tenantId.trim(),
      tenantName:  form.tenantName.trim(),
      websiteUrl:  form.websiteUrl.trim(),
      packageKey:  form.packageKey,
      cmsProvider: form.cmsProvider,
      themePreset: form.themePreset,
    };

    startTransition(async () => {
      const res = await createTenantFromOnboardingAction(input);
      setResult(res);
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-6">

      {/* ── Card 1: Identity ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <SectionTitle>Identity</SectionTitle>
          <Text variant="h4">Tenant details</Text>
          <p className="text-xs text-neutral-400">
            The name and slug uniquely identify this client across the platform.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Tenant name */}
          <Field
            label="Tenant name"
            hint="Human-readable display name, e.g. 'Acme Corp'"
            error={fieldErrors.tenantName}
            required
          >
            <input
              type="text"
              value={form.tenantName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corp"
              autoComplete="off"
              className={inputCls(!!fieldErrors.tenantName)}
            />
          </Field>

          {/* Tenant ID / slug */}
          <Field
            label="Tenant ID (slug)"
            hint="Lowercase, hyphens only, max 32 chars — auto-generated from name"
            error={fieldErrors.tenantId}
            required
          >
            <div className="relative">
              <input
                type="text"
                value={form.tenantId}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-corp"
                autoComplete="off"
                spellCheck={false}
                className={cn(inputCls(!!fieldErrors.tenantId), "pr-20 font-mono")}
              />
              {!slugEdited && form.tenantId && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <Badge variant="default" size="sm">auto</Badge>
                </span>
              )}
            </div>
          </Field>

          {/* Website URL */}
          <Field
            label="Primary website URL"
            hint="The client's production domain, e.g. 'acme.com' or 'https://acme.com'"
            error={fieldErrors.websiteUrl}
            required
          >
            <input
              type="text"
              value={form.websiteUrl}
              onChange={(e) => handleField("websiteUrl", e.target.value)}
              placeholder="acme.com"
              autoComplete="off"
              className={inputCls(!!fieldErrors.websiteUrl)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ── Card 2: Package & Configuration ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <SectionTitle>Package &amp; configuration</SectionTitle>
          <Text variant="h4">Platform settings</Text>
          <p className="text-xs text-neutral-400">
            The package sets feature entitlements and block access. CMS and theme
            can be refined on the tenant detail page after creation.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Package */}
          <Field
            label="Package"
            error={fieldErrors.packageKey}
            required
          >
            <select
              value={form.packageKey}
              onChange={(e) => handlePackageChange(e.target.value as PackageKey)}
              className={selectCls(!!fieldErrors.packageKey)}
            >
              {PACKAGE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                  {opt.monthlyPriceLabel ? ` — ${opt.monthlyPriceLabel}` : ""}
                </option>
              ))}
            </select>
          </Field>

          {/* Package summary */}
          <PackageSummaryStrip packageKey={form.packageKey} />

          {/* CMS provider */}
          <Field
            label="CMS provider"
            hint="Credentials are configured after creation. Use 'Mock' for dev / staging tenants."
            error={fieldErrors.cmsProvider}
            required
          >
            <select
              value={form.cmsProvider}
              onChange={(e) => handleField("cmsProvider", e.target.value as CMSProviderName)}
              className={selectCls(!!fieldErrors.cmsProvider)}
            >
              {ALL_CMS_PROVIDERS.map((p) => (
                <option key={p} value={p}>{CMS_DISPLAY[p]}</option>
              ))}
            </select>
          </Field>

          {/* Theme preset */}
          <Field
            label="Theme preset"
            hint="Only themes available on the selected package are shown."
            error={fieldErrors.themePreset}
            required
          >
            <select
              value={form.themePreset}
              onChange={(e) => handleField("themePreset", e.target.value as ThemeKey)}
              className={selectCls(!!fieldErrors.themePreset)}
            >
              {(["default", "minimal", "bold", "custom"] as ThemeKey[]).map((t) => {
                const allowed = allowedThemes.includes(t);
                return (
                  <option key={t} value={t} disabled={!allowed}>
                    {THEME_DISPLAY[t]}
                    {THEME_TIER_HINT[t] ? ` — ${THEME_TIER_HINT[t]}` : ""}
                    {!allowed ? " (not available)" : ""}
                  </option>
                );
              })}
            </select>
          </Field>
        </CardContent>
      </Card>

      {/* ── General error banner ─────────────────────────────────────────── */}
      {generalError && (
        <div
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-error-700">{generalError}</p>
        </div>
      )}

      {/* ── Submit row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isPending}
          disabled={isPending}
        >
          {isPending ? "Creating…" : "Create tenant"}
        </Button>
        <Link
          href="/admin/tenants"
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

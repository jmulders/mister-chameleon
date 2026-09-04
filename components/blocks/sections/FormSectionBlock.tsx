/**
 * FormSectionBlock
 *
 * Renders a `formSection` content block — a reusable form placed on a page by
 * the CMS via a `formKey` reference.  The form's field structure, validation
 * rules, email routing, and submission behaviour are entirely platform-driven
 * and resolved from the FormDefinition registered under that key.
 *
 * ─── Separation of concerns ───────────────────────────────────────────────────
 *
 *   CMS (FormSectionData)          — placement + copy overrides (title, intro,
 *                                    submitLabel, successMessage) and the
 *                                    post-submit behaviour (message / redirect)
 *   FormDefinition (@/forms)       — field structure, validation, routing intent
 *   FormSectionBlock (here)        — rendering, state, field composition, fetch
 *   POST /api/forms/[formKey]      — server-side validation, email, storage
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data     FormBlockData     { formKey, title?, intro?, submitLabel?,
 *                                successMessage?, postSubmit?, redirectUrl? }
 *   variant  FormSectionVariant  see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — form on a subtle-bg section with top/bottom border separator.
 *             Matches the visual weight of featureGrid and faqSection.
 *
 *   card    — form inside an elevated card on a plain-bg section.
 *             Draws attention to the form; good for standalone form pages.
 *
 *   minimal — no section background or border; form floats on the page
 *             surface.  Best for embedding within article content.
 *
 * ─── Submission flow ─────────────────────────────────────────────────────────
 *
 *   1. User fills in fields and submits the form.
 *   2. FormFields collects field values as a plain object and POSTs JSON to
 *      /api/forms/[formKey].
 *   3. The route validates input against the FormDefinition and returns:
 *        200  { ok: true,  message }           → show success state
 *        422  { ok: false, errors }            → show per-field errors inline
 *        4xx  { ok: false, error }             → show top-level error banner
 *   4. On success, useTenantForm either navigates to the resolved redirect
 *      target (block `redirectUrl` when postSubmit is "redirect", else the
 *      overlay / definition redirectPath) or shows the success message.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --form-bg                  Section background (default variant)
 *   --form-border              Section border colour (default variant)
 *   --form-input-bg            Input field background       (→ Input/Textarea/Select atoms)
 *   --form-input-border        Input field border colour    (→ Input/Textarea/Select atoms)
 *   --form-input-radius        Input field border-radius    (→ Input/Textarea/Select atoms)
 *   --form-input-text          Input field text colour      (→ Input/Textarea/Select atoms)
 *   --form-input-placeholder   Input placeholder            (→ Input/Textarea/Select atoms)
 *   --form-input-focus-ring    Input focus-ring colour      (→ Input/Textarea/Select atoms)
 *   --form-label-color         Field label text colour      (→ FormField atom)
 *   --form-label-weight        Field label font weight      (→ FormField atom)
 *   --form-help-color          Help / hint text colour      (→ FormField atom)
 *   --card-bg / --card-border / --card-radius / --card-shadow
 *                              Card container (card variant only)
 *   --btn-bg / --btn-text / --btn-hover-bg / --btn-radius / --btn-shadow
 *                              Submit button
 *   --color-error-500          Required asterisk + field error text colour (→ FormField atom)
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { getFormDefinition, resolveFormKey } from "@/forms";
import type { FormField } from "@/forms";
import { selectFormRender } from "@/forms/context/resolve";
import { useTenantForm } from "@/components/blocks/forms/useTenantForm";
import { useActiveLocale } from "@/hooks/useActiveLocale";
import { TurnstileWidget } from "@/components/blocks/forms/TurnstileWidget";

// Must match HONEYPOT_FIELD in forms/spam.ts — kept here to avoid importing
// a server-only module into a client component.
const HONEYPOT_FIELD = "_hp" as const;
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { FormSectionVariant } from "@/page-config/block-variants";
import type { FormBlockData } from "@/page-config";
import { Container }  from "@/components/primitives/Container";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { isRenderableMedia } from "@/lib/media/block-media";
import { Section }    from "@/components/primitives/Section";
import { Stack }      from "@/components/primitives/Stack";
import { Text }       from "@/components/primitives/Text";
import { Button }     from "@/components/ui/Button";
import { Input }      from "@/components/ui/Input";
import { Textarea }   from "@/components/ui/Textarea";
import { Select }     from "@/components/ui/Select";
import { FormField as FormFieldAtom } from "@/components/ui/FormField";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormSectionBlockProps {
  data:     FormBlockData;
  variant?: string;
}

// ── Submit state ──────────────────────────────────────────────────────────────


// ── Component ─────────────────────────────────────────────────────────────────

export function FormSectionBlock({ data, variant: rawVariant }: FormSectionBlockProps) {
  const resolved = resolveBlockVariant("formSection", rawVariant) as FormSectionVariant;
  // Normalise canonical spec names → implementation keys.
  // form_inline → default | form_panel → card | form_split stays as form_split
  const variant: FormSectionVariant = (
    resolved === "form_inline" ? "default" :
    resolved === "form_panel"  ? "card"    :
    resolved
  ) as FormSectionVariant;

  // ── Resolve platform-side form definition ──────────────────────────────────
  //
  // The CMS provides a formKey string.  We narrow it to FormKey using the
  // type guard, then look up the registered FormDefinition.  Unknown keys
  // render nothing rather than crashing — forward-compatible with CMS content
  // that references a form not yet registered on this deployment.
  // Resolve the CMS handle to a registered FormKey, tolerating Statamic's
  // snake_case ("locatie_test") vs the code's kebab-case ("locatie-test").
  const resolvedFormKey = resolveFormKey(data.formKey);
  const formDef = resolvedFormKey ? getFormDefinition(resolvedFormKey) : undefined;

  // ── Contextual overlay (rules → segment → copy/fields override) ───────────
  //
  // Fetched on mount from /api/forms/[formKey]/context, passing the path +
  // query the form rendered on. Server resolves the visitor's segment (also
  // using the geo header) and returns copy/field overrides. Until it arrives
  // (or when no rule matches) the base definition + CMS copy are used, so the
  // form is always rendered — the overlay just swaps values in when ready.
  // Shared tenant-form pipeline: contextual overlay + submit + state + analytics.
  const { resolvedForm: overlay, submitState, errorRevision, submit: handleSubmit, fireFormEvent } =
    // Use the CANONICAL registered key so the submit / context URLs
    // (/api/forms/[formKey]) hit the registered definition even when the CMS
    // handle was snake_case. Falls back to the raw value when unresolved (the
    // block then renders nothing anyway — formDef is undefined).
    useTenantForm(resolvedFormKey ?? data.formKey, {
      blockSuccessMessage: data.successMessage,
      blockRedirectUrl:    data.redirectUrl,
      postSubmit:          data.postSubmit,
    });

  // Visitor language, for the default (un-authored) button copy. Read from the
  // `locale` cookie after mount — see useActiveLocale for why not during render.
  const locale             = useActiveLocale();
  const defaultSubmitLabel = locale === "en" ? "Submit"  : "Verstuur";
  const defaultSendingLabel = locale === "en" ? "Sending…" : "Bezig…";

  // ── Effective copy + fields: overlay override → CMS copy → definition ─────
  //
  // `selectFormRender` resolves the effective field set from the two sources —
  // the synchronous code definition and the async overlay (a contextual variant
  // of a code form OR a fully CP-authored CMS form) — and decides whether there
  // is anything to render. Code definitions take precedence; a CMS form renders
  // once its overlay arrives; an unknown formKey renders a clean empty.
  const { fields: effectiveFields, render: hasRenderableForm } =
    selectFormRender(formDef?.fields, overlay?.fields);
  const title          = overlay?.title          ?? data.title          ?? formDef?.title;
  const intro          = overlay?.intro          ?? data.intro          ?? formDef?.description;
  // Default button copy follows the visitor's language. Dutch is the base for
  // these tenants, so only an explicit "en" gets English; an authored label
  // (overlay, then the CMS block) always wins over the default.
  const submitLabel    = overlay?.submitLabel    ?? data.submitLabel    ?? defaultSubmitLabel;
  // Canonical key for the DOM/aria-label. Submit + context URLs are owned by
  // useTenantForm (resolvedFormKey ?? data.formKey), so a CMS form posts to its
  // own handle and a code form to its registered key.
  const effectiveKey   = formDef?.key ?? resolvedFormKey ?? data.formKey;



  // Special-case: interactive ROI calculator
  if (data.formKey === "roi-calculator") {
    return <RoiCalculatorInteractive title={title} intro={intro} />;
  }

  // Guard: nothing to render when the formKey resolves to neither a code
  // FormDefinition nor a CMS-managed form (unknown key → clean empty).
  if (!hasRenderableForm) return null;


  // ── Success state ─────────────────────────────────────────────────────────
  if (submitState.status === "success") {
    return (
      <FormWrapper variant={variant}>
        <Container size="sm">
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            role="status"
            aria-live="polite"
          >
            {/* Checkmark icon */}
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--primary-subtle)" }}
              aria-hidden
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--primary)" }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <Text variant="h3" style={{ color: "var(--text)" }}>
              {submitState.message}
            </Text>
          </div>
        </Container>
      </FormWrapper>
    );
  }

  // ── Form render ────────────────────────────────────────────────────────────

  const fieldErrors  = submitState.status === "fieldErrors" ? submitState.errors : {};
  const globalError  = submitState.status === "error" ? submitState.message : undefined;
  const isSubmitting = submitState.status === "submitting";

  const formContent = (
    <FormFields
      formKey={effectiveKey}
      fields={effectiveFields}
      submitLabel={submitLabel}
      sendingLabel={defaultSendingLabel}
      isSubmitting={isSubmitting}
      fieldErrors={fieldErrors}
      globalError={globalError}
      errorRevision={errorRevision}
      onSubmit={handleSubmit}
      onFormStart={() => fireFormEvent("form_start")}
      turnstileSiteKey={overlay?.turnstile?.siteKey}
    />
  );

  // ── Per-form override layout (forms-as-adaptive-blocks, phase 1) ───────────
  //
  // When the per-form override selects a split template, it takes precedence
  // over the CMS block variant and renders a contact panel (name/role/photo/
  // phone/email) on the chosen side, with the form on the other.

  const formLayout = overlay?.layout;
  if (formLayout && formLayout.template !== "single") {
    const cp = formLayout.contactPanel;
    const panel = cp ? (
      <div className="lg:w-1/3 lg:shrink-0">
        <div className="flex flex-col gap-2">
          {isRenderableMedia(cp.media) ? (
            // New shared media: a bounded panel frame (image or video with facade).
            <div className="mb-2 w-full max-w-xs overflow-hidden rounded-xl">
              <BlockMediaView media={cp.media} />
            </div>
          ) : cp.photoUrl ? (
            // Legacy photoUrl: keep the round avatar.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cp.photoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : null}
          {cp.name && (
            <div style={{ color: "var(--text)", fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)", fontSize: "1.25rem" }}>
              {cp.name}
            </div>
          )}
          {cp.role  && <div style={{ color: "var(--text-muted)" }}>{cp.role}</div>}
          {cp.phone && <a href={`tel:${cp.phone}`} style={{ color: "var(--text)", textDecoration: "none" }}>{cp.phone}</a>}
          {cp.email && <a href={`mailto:${cp.email}`} style={{ color: "var(--text)", textDecoration: "none" }}>{cp.email}</a>}
        </div>
      </div>
    ) : null;
    const formCol = <div className="flex-1 min-w-0">{formContent}</div>;
    return (
      <Section
        spacing="xl"
        style={{
          background:   "var(--form-bg)",
          borderTop:    "1px solid var(--form-border)",
          borderBottom: "1px solid var(--form-border)",
        }}
      >
        <Container size="lg">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
            {formLayout.template === "split-right"
              ? <>{formCol}{panel}</>
              : <>{panel}{formCol}</>}
          </div>
        </Container>
      </Section>
    );
  }

  // ── form_split layout ─────────────────────────────────────────────────────
  //
  // Two-column layout: intro/heading in a narrower left column, form in the
  // wider right column.  Useful for contact and demo-request pages where the
  // intro copy supports the form conversion without hiding the form itself.

  if (variant === "form_split") {
    return (
      <Section
        spacing="xl"
        style={{
          background:   "var(--form-bg)",
          borderTop:    "1px solid var(--form-border)",
          borderBottom: "1px solid var(--form-border)",
        }}
      >
        <Container size="lg">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">

            {/* Intro column */}
            {(title || intro) && (
              <div className="lg:w-1/3 lg:shrink-0">
                <Stack gap={4}>
                  {title && (
                    <Text
                      variant="h2"
                      style={{
                        color:      "var(--text)",
                        fontFamily: "var(--font-heading)",
                        fontWeight: "var(--font-heading-weight)",
                      }}
                    >
                      {title}
                    </Text>
                  )}
                  {intro && (
                    <Text variant="body" style={{ color: "var(--text-muted)" }}>
                      {intro}
                    </Text>
                  )}
                </Stack>
              </div>
            )}

            {/* Form column */}
            <div className="flex-1 min-w-0">
              {formContent}
            </div>

          </div>
        </Container>
      </Section>
    );
  }

  return (
    <FormWrapper variant={variant}>
      <Container size="sm">
        <Stack gap={8}>

          {/* Heading + intro ───────────────────────────────────────────────── */}
          {(title || intro) && (
            <Stack gap={3}>
              {title && (
                <Text
                  variant="h2"
                  style={{
                    color:      "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight)",
                  }}
                >
                  {title}
                </Text>
              )}
              {intro && (
                <Text variant="body" style={{ color: "var(--text-muted)" }}>
                  {intro}
                </Text>
              )}
            </Stack>
          )}

          {/* Form ────────────────────────────────────────────────────────── */}
          {variant === "card" ? (
            <div
              style={{
                backgroundColor: "var(--card-bg)",
                border:          "1px solid var(--card-border)",
                borderRadius:    "var(--card-radius)",
                boxShadow:       "var(--card-shadow)",
                padding:         "2rem",
              }}
            >
              {formContent}
            </div>
          ) : (
            formContent
          )}

        </Stack>
      </Container>
    </FormWrapper>
  );
}

// ── FormWrapper ───────────────────────────────────────────────────────────────

interface FormWrapperProps {
  variant:  FormSectionVariant;
  children: React.ReactNode;
}

function FormWrapper({ variant, children }: FormWrapperProps) {
  if (variant === "minimal") {
    return <div className="py-12">{children}</div>;
  }

  const sectionStyle =
    variant === "default"
      ? {
          background:   "var(--form-bg)",
          borderTop:    "1px solid var(--form-border)",
          borderBottom: "1px solid var(--form-border)",
        }
      : {
          background: "var(--bg)",
        };

  return (
    <Section spacing="xl" style={sectionStyle}>
      {children}
    </Section>
  );
}

// ── FormFields ────────────────────────────────────────────────────────────────

interface FormFieldsProps {
  formKey:       string;
  fields:        readonly FormField[];
  submitLabel:   string;
  /** Button copy while the submission is in flight, in the visitor's language. */
  sendingLabel:  string;
  isSubmitting:  boolean;
  fieldErrors:   Record<string, string>;
  globalError?:  string;
  errorRevision: number;
  onSubmit:      (values: Record<string, string>) => Promise<void>;
  /** Fired once when the visitor first focuses any form field. */
  onFormStart?:  () => void;
  /** Cloudflare Turnstile site key — renders the CAPTCHA widget when set. */
  turnstileSiteKey?: string;
}

function FormFields({
  formKey,
  fields,
  submitLabel,
  sendingLabel,
  isSubmitting,
  fieldErrors,
  globalError,
  errorRevision,
  onSubmit,
  onFormStart,
  turnstileSiteKey,
}: FormFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);

  // Fire form_start exactly once when the visitor first focuses any field.
  // Using a ref (not state) to avoid re-renders on focus.
  const hasStartedRef = useRef(false);
  const handleFormFocus = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    onFormStart?.();
  }, [onFormStart]);

  // Form-prefill (Fase 2): on mount, fetch the known lead's low-sensitivity
  // fields (consent-gated server-side, empty otherwise) and fill EMPTY matching
  // inputs by field key — never clobbering what the visitor has typed. The
  // visitor can always overwrite. See /api/forms/prefill.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/forms/prefill", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { prefill?: Record<string, string> } | null) => {
        if (cancelled || !j?.prefill || !formRef.current) return;
        for (const [key, val] of Object.entries(j.prefill)) {
          const el = formRef.current.elements.namedItem(key) as HTMLInputElement | null;
          if (el && typeof el.value === "string" && el.value === "" && val) el.value = String(val);
        }
      })
      .catch(() => { /* fail-open: no prefill */ });
    return () => { cancelled = true; };
  }, []);

  // Focus the first field with an error after each validation round.
  // Skips the initial mount (errorRevision === 0) so no unwanted auto-focus.
  useEffect(() => {
    if (errorRevision === 0) return;
    if (!formRef.current) return;
    const firstInvalid = formRef.current.querySelector(
      "[aria-invalid=\"true\"]",
    ) as HTMLElement | null;
    firstInvalid?.focus();
  }, [errorRevision]);

  const errorCount = Object.values(fieldErrors).filter(Boolean).length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Collect all field values from the form DOM.  FormData handles every
    // field type (including checkboxes) by name.  Checkbox absent = unchecked.
    const formData = new FormData(e.currentTarget);
    const values: Record<string, string> = {};

    for (const field of fields) {
      if (field.type === "checkbox") {
        // Checkbox: present in FormData when checked, absent when unchecked.
        values[field.key] = formData.has(field.key) ? "true" : "false";
      } else {
        values[field.key] = (formData.get(field.key) as string | null) ?? "";
      }
    }

    // Include honeypot value so the server can verify it is empty.
    values[HONEYPOT_FIELD] = (formData.get(HONEYPOT_FIELD) as string | null) ?? "";

    // Include the Turnstile token when the widget is present (server verifies it).
    if (turnstileSiteKey) {
      values["cf-turnstile-response"] = (formData.get("cf-turnstile-response") as string | null) ?? "";
    }

    void onSubmit(values);
  }

  const errorBannerStyle: React.CSSProperties = {
    padding:         "0.75rem 1rem",
    backgroundColor: "color-mix(in srgb, var(--color-error-500) 10%, transparent)",
    border:          "1px solid color-mix(in srgb, var(--color-error-500) 30%, transparent)",
    borderRadius:    "var(--form-input-radius)",
    color:           "var(--color-error-500)",
    fontSize:        "0.875rem",
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} onFocusCapture={handleFormFocus} noValidate aria-label={formKey}>
      {/*
       * Honeypot — visually off-screen, aria-hidden, not keyboard-reachable.
       * Bots that auto-fill all inputs will fill this; real users never will.
       * display:none is avoided — some bots skip display:none fields.
       */}
      <input
        type="text"
        name={HONEYPOT_FIELD}
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        style={{
          position:   "absolute",
          width:      "1px",
          height:     "1px",
          padding:    0,
          margin:     "-1px",
          overflow:   "hidden",
          clip:       "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border:     0,
        }}
      />

      <Stack gap={5}>

        {/* Global error banner (network / server errors) */}
        {globalError && (
          <div role="alert" style={errorBannerStyle}>
            {globalError}
          </div>
        )}

        {/* Field error summary — announces error count to screen readers and
            gives sighted users a clear top-level cue before scrolling down */}
        {errorCount > 0 && (
          <div role="alert" aria-live="assertive" style={errorBannerStyle}>
            Please correct {errorCount} {errorCount === 1 ? "error" : "errors"} below.
          </div>
        )}

        {/* Fields */}
        {fields.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            error={fieldErrors[field.key]}
          />
        ))}

        {/* Cloudflare Turnstile widget — rendered when a site key is configured. */}
        <TurnstileWidget siteKey={turnstileSiteKey} className="cf-turnstile" />


        {/* Submit button — uses Button atom for consistent token-driven styling */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
            className="w-full"
            style={{
              backgroundColor: "var(--btn-bg)",
              color:           "var(--btn-text)",
              borderRadius:    "var(--btn-radius)",
              boxShadow:       "var(--btn-shadow)",
              fontWeight:      "var(--btn-font-weight)",
            }}
          >
            {isSubmitting ? sendingLabel : submitLabel}
          </Button>
        </div>

      </Stack>

    </form>
  );
}

// ── FieldRenderer ─────────────────────────────────────────────────────────────
//
// Renders a single form field using the appropriate form atom (Input, Textarea,
// Select) wrapped in the FormField atom for label + error + hint wiring.

interface FieldRendererProps {
  field: FormField;
  error?: string;
}

function FieldRenderer({ field, error }: FieldRendererProps) {
  const isRequired = field.validation?.required === true;
  const hasError   = Boolean(error);

  // ── Checkbox (inline layout — not using FormField atom) ────────────────────
  if (field.type === "checkbox") {
    return (
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          id={field.key}
          name={field.key}
          required={isRequired}
          defaultChecked={field.defaultValue === true}
          aria-invalid={hasError || undefined}
          style={{
            marginTop:   "0.125rem",
            width:       "1rem",
            height:      "1rem",
            flexShrink:  0,
            accentColor: "var(--form-input-focus-ring)",
          }}
        />
        <div>
          <label
            htmlFor={field.key}
            className="cursor-pointer text-sm"
            style={{
              fontWeight: "var(--form-label-weight)",
              color:      "var(--form-label-color)",
            }}
          >
            {field.label}
            {isRequired && (
              <span
                aria-hidden
                className="ml-1"
                style={{ color: "var(--color-error-500)" }}
              >
                *
              </span>
            )}
          </label>
          {field.helpText && !hasError && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--form-help-color)" }}>
              {field.helpText}
            </p>
          )}
          {hasError && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-error-500)" }} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Hidden (no wrapper) ────────────────────────────────────────────────────
  if (field.type === "hidden") {
    return (
      <input
        type="hidden"
        id={field.key}
        name={field.key}
        defaultValue={typeof field.defaultValue === "string" ? field.defaultValue : ""}
      />
    );
  }

  // ── Textarea ───────────────────────────────────────────────────────────────
  if (field.type === "textarea") {
    return (
      <FormFieldAtom
        label={field.label}
        htmlFor={field.key}
        required={isRequired}
        hint={field.helpText}
        error={error}
      >
        {(errorId) => (
          <Textarea
            id={field.key}
            name={field.key}
            placeholder={field.placeholder}
            required={isRequired}
            rows={5}
            error={hasError}
            aria-invalid={hasError || undefined}
            aria-describedby={errorId}
          />
        )}
      </FormFieldAtom>
    );
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  if (field.type === "select") {
    return (
      <FormFieldAtom
        label={field.label}
        htmlFor={field.key}
        required={isRequired}
        hint={field.helpText}
        error={error}
      >
        {(errorId) => (
          <Select
            id={field.key}
            name={field.key}
            required={isRequired}
            defaultValue={typeof field.defaultValue === "string" ? field.defaultValue : ""}
            error={hasError}
            aria-invalid={hasError || undefined}
            aria-describedby={errorId}
          >
            <option value="" disabled>
              {field.placeholder ?? "Select an option"}
            </option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        )}
      </FormFieldAtom>
    );
  }

  // ── text | email | tel | url ───────────────────────────────────────────────
  return (
    <FormFieldAtom
      label={field.label}
      htmlFor={field.key}
      required={isRequired}
      hint={field.helpText}
      error={error}
    >
      {(errorId) => (
        <Input
          type={field.type}
          id={field.key}
          name={field.key}
          placeholder={field.placeholder}
          required={isRequired}
          error={hasError}
          aria-invalid={hasError || undefined}
          aria-describedby={errorId}
        />
      )}
    </FormFieldAtom>
  );
}

// ── RoiCalculatorInteractive ──────────────────────────────────────────────────
//
// Rendered when formKey === "roi-calculator".  Entirely client-side — no form
// submission.  All state is local; results update live as sliders move.

interface RoiCalculatorInteractiveProps {
  title?: string;
  intro?: string;
}

type LiftScenario = "conservative" | "moderate" | "aggressive";

const LIFT_LABELS: Record<LiftScenario, string> = {
  conservative: "Conservative (25%)",
  moderate:     "Moderate (35%)",
  aggressive:   "Aggressive (50%)",
};

const LIFT_VALUES: Record<LiftScenario, number> = {
  conservative: 0.25,
  moderate:     0.35,
  aggressive:   0.50,
};

const GROWTH_PLAN_MONTHLY = 349; // € / month baseline

function fmtEur(n: number): string {
  return "€" + Math.round(n).toLocaleString("en-GB");
}

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

function RoiCalculatorInteractive({ title, intro }: RoiCalculatorInteractiveProps) {
  const [visitors,        setVisitors]        = useState(10_000);
  const [conversionRate,  setConversionRate]  = useState(2.0);    // %
  const [contractValue,   setContractValue]   = useState(5_000);  // €
  const [liftScenario,    setLiftScenario]    = useState<LiftScenario>("moderate");

  const liftFactor        = LIFT_VALUES[liftScenario];
  const currentConv       = visitors * (conversionRate / 100);
  const projectedConv     = currentConv * (1 + liftFactor);
  const extraConv         = projectedConv - currentConv;
  const extraPipeline     = extraConv * contractValue;
  const annualLift        = extraPipeline * 12;
  const roiMultiple       = extraPipeline / GROWTH_PLAN_MONTHLY;

  // ── Styles (all inline with CSS variables, no Tailwind) ───────────────────

  const sectionStyle: React.CSSProperties = {
    background:   "var(--form-bg, var(--bg-subtle, #f8f9fa))",
    borderTop:    "1px solid var(--form-border, var(--border))",
    borderBottom: "1px solid var(--form-border, var(--border))",
    padding:      "5rem 1.5rem",
  };

  const gridStyle: React.CSSProperties = {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "3rem",
    maxWidth:            "1100px",
    margin:              "0 auto",
  };

  const headingStyle: React.CSSProperties = {
    color:      "var(--text)",
    fontFamily: "var(--font-heading)",
    fontWeight: "var(--font-heading-weight, 700)",
    fontSize:   "clamp(1.75rem, 3vw, 2.5rem)",
    lineHeight: 1.2,
    marginBottom: "0.75rem",
  };

  const introStyle: React.CSSProperties = {
    color:        "var(--text-muted)",
    fontSize:     "1.0625rem",
    lineHeight:   1.6,
    marginBottom: "2.5rem",
  };

  const labelStyle: React.CSSProperties = {
    display:      "block",
    color:        "var(--form-label-color, var(--text))",
    fontWeight:   "var(--form-label-weight, 600)",
    fontSize:     "0.875rem",
    marginBottom: "0.375rem",
  };

  const valueTagStyle: React.CSSProperties = {
    display:         "inline-block",
    backgroundColor: "var(--primary-subtle, color-mix(in srgb, var(--primary) 12%, transparent))",
    color:           "var(--primary)",
    borderRadius:    "0.375rem",
    padding:         "0.125rem 0.5rem",
    fontSize:        "0.8125rem",
    fontWeight:      600,
    marginLeft:      "0.5rem",
    verticalAlign:   "middle",
  };

  const sliderStyle: React.CSSProperties = {
    width:       "100%",
    marginTop:   "0.5rem",
    accentColor: "var(--primary)",
    cursor:      "pointer",
  };

  const sliderGroupStyle: React.CSSProperties = {
    marginBottom: "1.75rem",
  };

  const scenarioGroupStyle: React.CSSProperties = {
    display:       "flex",
    gap:           "0.625rem",
    flexWrap:      "wrap",
    marginTop:     "0.5rem",
  };

  const resultsPanelStyle: React.CSSProperties = {
    backgroundColor: "var(--card-bg, var(--bg))",
    border:          "1px solid var(--card-border, var(--border))",
    borderRadius:    "var(--card-radius, 1rem)",
    boxShadow:       "var(--card-shadow, 0 4px 24px rgba(0,0,0,0.08))",
    padding:         "2rem",
    display:         "flex",
    flexDirection:   "column",
    gap:             "0",
  };

  const resultsPanelHeadingStyle: React.CSSProperties = {
    color:        "var(--text)",
    fontFamily:   "var(--font-heading)",
    fontWeight:   700,
    fontSize:     "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "1.5rem",
    opacity:      0.55,
  };

  const resultRowStyle: React.CSSProperties = {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "baseline",
    padding:        "0.875rem 0",
    borderBottom:   "1px solid var(--form-border, var(--border, rgba(0,0,0,0.08)))",
  };

  const resultLabelStyle: React.CSSProperties = {
    color:    "var(--text-muted)",
    fontSize: "0.9375rem",
  };

  const resultValueStyle: React.CSSProperties = {
    color:      "var(--text)",
    fontWeight: 700,
    fontSize:   "1rem",
  };

  const highlightRowStyle: React.CSSProperties = {
    ...resultRowStyle,
    borderBottom:    "none",
    marginTop:       "0.5rem",
    padding:         "1rem 1.25rem",
    backgroundColor: "var(--primary-subtle, color-mix(in srgb, var(--primary) 10%, transparent))",
    borderRadius:    "0.75rem",
  };

  const highlightLabelStyle: React.CSSProperties = {
    ...resultLabelStyle,
    color:      "var(--primary)",
    fontWeight: 600,
  };

  const highlightValueStyle: React.CSSProperties = {
    ...resultValueStyle,
    color:    "var(--primary)",
    fontSize: "1.375rem",
  };

  const ctaStyle: React.CSSProperties = {
    display:         "block",
    width:           "100%",
    textAlign:       "center",
    marginTop:       "1.5rem",
    padding:         "0.875rem 1.5rem",
    backgroundColor: "var(--btn-bg, var(--primary))",
    color:           "var(--btn-text, #fff)",
    borderRadius:    "var(--btn-radius, 0.5rem)",
    boxShadow:       "var(--btn-shadow, 0 2px 8px rgba(0,0,0,0.15))",
    fontWeight:      "var(--btn-font-weight, 700)" as React.CSSProperties["fontWeight"],
    fontSize:        "1rem",
    textDecoration:  "none",
    border:          "none",
    cursor:          "pointer",
    transition:      "opacity 0.15s",
  };

  const subNoteStyle: React.CSSProperties = {
    textAlign:  "center",
    color:      "var(--text-muted)",
    fontSize:   "0.78125rem",
    marginTop:  "0.75rem",
    lineHeight: 1.4,
  };

  return (
    <section style={sectionStyle} aria-label="ROI Calculator">
      {/* Responsive wrapper — collapses to single column on narrow viewports */}
      <style>{`
        @media (max-width: 768px) {
          .roi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto 3rem" }}>
        {title && <h2 style={headingStyle}>{title}</h2>}
        {intro && <p style={introStyle}>{intro}</p>}
      </div>

      {/* ── Two-column grid ────────────────────────────────────────────────── */}
      <div className="roi-grid" style={gridStyle}>

        {/* ── Left: Inputs ─────────────────────────────────────────────────── */}
        <div>

          {/* Monthly visitors */}
          <div style={sliderGroupStyle}>
            <label style={labelStyle}>
              Monthly visitors
              <span style={valueTagStyle}>{fmtNum(visitors)}</span>
            </label>
            <input
              type="range"
              min={1_000}
              max={500_000}
              step={1_000}
              value={visitors}
              onChange={(e) => setVisitors(Number(e.target.value))}
              style={sliderStyle}
              aria-label="Monthly visitors"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              <span>1,000</span><span>500,000</span>
            </div>
          </div>

          {/* Current conversion rate */}
          <div style={sliderGroupStyle}>
            <label style={labelStyle}>
              Current conversion rate
              <span style={valueTagStyle}>{conversionRate.toFixed(1)}%</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={10}
              step={0.1}
              value={conversionRate}
              onChange={(e) => setConversionRate(Number(e.target.value))}
              style={sliderStyle}
              aria-label="Current conversion rate"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              <span>0.1%</span><span>10%</span>
            </div>
          </div>

          {/* Average contract value */}
          <div style={sliderGroupStyle}>
            <label style={labelStyle}>
              Average contract value
              <span style={valueTagStyle}>{fmtEur(contractValue)}</span>
            </label>
            <input
              type="range"
              min={100}
              max={50_000}
              step={100}
              value={contractValue}
              onChange={(e) => setContractValue(Number(e.target.value))}
              style={sliderStyle}
              aria-label="Average contract value"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              <span>€100</span><span>€50,000</span>
            </div>
          </div>

          {/* Lift scenario */}
          <div style={{ marginBottom: "0.375rem" }}>
            <span style={labelStyle}>Lift scenario</span>
            <div style={scenarioGroupStyle} role="group" aria-label="Lift scenario">
              {(Object.keys(LIFT_LABELS) as LiftScenario[]).map((key) => {
                const isActive = liftScenario === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLiftScenario(key)}
                    aria-pressed={isActive}
                    style={{
                      padding:         "0.5rem 1rem",
                      borderRadius:    "2rem",
                      border:          isActive
                        ? "2px solid var(--primary)"
                        : "2px solid var(--form-border, var(--border, rgba(0,0,0,0.15)))",
                      backgroundColor: isActive
                        ? "var(--primary-subtle, color-mix(in srgb, var(--primary) 12%, transparent))"
                        : "transparent",
                      color:           isActive ? "var(--primary)" : "var(--text-muted)",
                      fontWeight:      isActive ? 700 : 400,
                      fontSize:        "0.875rem",
                      cursor:          "pointer",
                      transition:      "all 0.15s",
                      whiteSpace:      "nowrap",
                    }}
                  >
                    {LIFT_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Right: Results panel ──────────────────────────────────────────── */}
        <div style={resultsPanelStyle}>
          <p style={resultsPanelHeadingStyle}>Your projected results</p>

          <div style={resultRowStyle}>
            <span style={resultLabelStyle}>Current monthly conversions</span>
            <span style={resultValueStyle}>{fmtNum(currentConv)}</span>
          </div>

          <div style={resultRowStyle}>
            <span style={resultLabelStyle}>Projected monthly conversions</span>
            <span style={resultValueStyle}>{fmtNum(projectedConv)}</span>
          </div>

          <div style={resultRowStyle}>
            <span style={resultLabelStyle}>Extra conversions / month</span>
            <span style={{ ...resultValueStyle, color: "var(--primary)" }}>+{fmtNum(extraConv)}</span>
          </div>

          <div style={resultRowStyle}>
            <span style={resultLabelStyle}>Extra pipeline / month</span>
            <span style={{ ...resultValueStyle, color: "var(--primary)" }}>{fmtEur(extraPipeline)}</span>
          </div>

          <div style={resultRowStyle}>
            <span style={resultLabelStyle}>Annual revenue lift</span>
            <span style={{ ...resultValueStyle, fontSize: "1.125rem" }}>{fmtEur(annualLift)}</span>
          </div>

          {/* ROI highlight */}
          <div style={highlightRowStyle}>
            <span style={highlightLabelStyle}>ROI vs Growth plan</span>
            <span style={highlightValueStyle}>{roiMultiple.toFixed(1)}× / month</span>
          </div>

          {/* CTA */}
          <Link
            href="/contact"
            style={ctaStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
          >
            Start growing — talk to us
          </Link>
          <p style={subNoteStyle}>
            Based on Growth plan at {fmtEur(GROWTH_PLAN_MONTHLY)}/month &bull; No commitment required
          </p>

        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loose type guard: asserts that the API response JSON has at minimum an `ok`
 * boolean.  Further narrowing happens at the call site.
 */

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
 *                                    submitLabel, successMessage)
 *   FormDefinition (@/forms)       — field structure, validation, routing intent
 *   FormSectionBlock (here)        — rendering, state, field composition, fetch
 *   POST /api/forms/[formKey]      — server-side validation, email, storage
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data     FormBlockData     { formKey, title?, intro?, submitLabel?,
 *                                successMessage? }
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
 *   4. Redirect (formDef.action.redirectPath) is not yet handled here — Fm5+.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --form-bg                  Section background (default variant)
 *   --form-border              Section border colour (default variant)
 *   --form-input-bg            Input field background
 *   --form-input-border        Input field border colour
 *   --form-input-radius        Input field border-radius
 *   --form-input-text          Input field text colour
 *   --form-input-placeholder   Input placeholder text colour
 *   --form-input-focus-ring    Input focus-ring colour
 *   --form-label-color         Field label text colour
 *   --form-label-weight        Field label font weight
 *   --form-help-color          Help / hint text colour
 *   --card-bg / --card-border / --card-radius / --card-shadow
 *                              Card container (card variant only)
 *   --btn-bg / --btn-text / --btn-hover-bg / --btn-radius / --btn-shadow
 *                              Submit button
 *   --radius-interactive       Interactive element radius (inputs, button)
 *   --transition-base          Hover/focus transition timing
 *   --color-error-500          Required asterisk + field error text colour
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { getFormDefinition, isFormKey } from "@/forms";
import type { FormField } from "@/forms";

// Must match HONEYPOT_FIELD in forms/spam.ts — kept here to avoid importing
// a server-only module into a client component.
const HONEYPOT_FIELD = "_hp" as const;
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { FormSectionVariant } from "@/page-config/block-variants";
import type { FormBlockData } from "@/page-config";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FormSectionBlockProps {
  data:     FormBlockData;
  variant?: string;
}

// ── Submit state ──────────────────────────────────────────────────────────────

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success";  message: string }
  | { status: "fieldErrors"; errors: Record<string, string> }
  | { status: "error";    message: string };

// ── Component ─────────────────────────────────────────────────────────────────

export function FormSectionBlock({ data, variant: rawVariant }: FormSectionBlockProps) {
  const variant = resolveBlockVariant("formSection", rawVariant) as FormSectionVariant;

  // ── Resolve platform-side form definition ──────────────────────────────────
  //
  // The CMS provides a formKey string.  We narrow it to FormKey using the
  // type guard, then look up the registered FormDefinition.  Unknown keys
  // render nothing rather than crashing — forward-compatible with CMS content
  // that references a form not yet registered on this deployment.
  const formDef = isFormKey(data.formKey)
    ? getFormDefinition(data.formKey)
    : undefined;

  // ── Merge CMS copy overrides over definition defaults ─────────────────────
  const title          = data.title          ?? formDef?.title;
  const intro          = data.intro          ?? formDef?.description;
  const submitLabel    = data.submitLabel    ?? "Submit";
  const successMessage = data.successMessage ?? formDef?.action.successMessage
    ?? "Thank you — your submission has been received.";

  // ── Submit state ───────────────────────────────────────────────────────────
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  // Incremented each time field errors are set — even when the same errors
  // re-occur on a second attempt.  Used as a stable useEffect dependency in
  // FormFields to trigger focus-first-error without over-firing.
  const [errorRevision, setErrorRevision] = useState(0);

  // Guard: nothing to render when formKey is not registered
  if (!formDef) return null;

  // ── Submit handler ─────────────────────────────────────────────────────────
  //
  // Collects field values from the form element, POSTs JSON to the platform
  // submit endpoint, and transitions submit state based on the response.

  async function handleSubmit(values: Record<string, string>): Promise<void> {
    setSubmitState({ status: "submitting" });

    try {
      const res = await fetch(`/api/forms/${formDef!.key}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });

      const json = await res.json() as unknown;

      if (!isResponseShape(json)) {
        setSubmitState({ status: "error", message: "Submission failed. Please try again." });
        return;
      }

      if (json.ok) {
        setSubmitState({
          status:  "success",
          message: (json as { ok: true; message: string }).message ?? successMessage,
        });
        return;
      }

      // Validation errors (422)
      if ("errors" in json && json.errors && typeof json.errors === "object") {
        setSubmitState({
          status: "fieldErrors",
          errors: json.errors as Record<string, string>,
        });
        setErrorRevision(r => r + 1);
        return;
      }

      // Other 4xx / 5xx
      const errorMessage = "error" in json && typeof json.error === "string"
        ? json.error
        : "Submission failed. Please try again.";
      setSubmitState({ status: "error", message: errorMessage });

    } catch {
      setSubmitState({ status: "error", message: "Network error. Please check your connection and try again." });
    }
  }

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

  const fieldErrors = submitState.status === "fieldErrors" ? submitState.errors : {};
  const globalError = submitState.status === "error" ? submitState.message : undefined;
  const isSubmitting = submitState.status === "submitting";

  const formContent = (
    <FormFields
      formKey={formDef.key}
      fields={formDef.fields}
      submitLabel={submitLabel}
      isSubmitting={isSubmitting}
      fieldErrors={fieldErrors}
      globalError={globalError}
      errorRevision={errorRevision}
      onSubmit={handleSubmit}
    />
  );

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
  isSubmitting:  boolean;
  fieldErrors:   Record<string, string>;
  globalError?:  string;
  errorRevision: number;
  onSubmit:      (values: Record<string, string>) => Promise<void>;
}

function FormFields({
  formKey,
  fields,
  submitLabel,
  isSubmitting,
  fieldErrors,
  globalError,
  errorRevision,
  onSubmit,
}: FormFieldsProps) {
  const formRef = useRef<HTMLFormElement>(null);

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
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label={formKey}>
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

        {/* Submit button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            style={{
              display:         "inline-flex",
              alignItems:      "center",
              justifyContent:  "center",
              gap:             "0.5rem",
              padding:         "0.625rem 1.5rem",
              backgroundColor: isSubmitting ? "var(--btn-hover-bg)" : "var(--btn-bg)",
              color:           "var(--btn-text)",
              borderRadius:    "var(--btn-radius)",
              boxShadow:       "var(--btn-shadow)",
              fontWeight:      "var(--btn-font-weight)",
              fontSize:        "0.875rem",
              lineHeight:      "1.25rem",
              border:          "none",
              cursor:          isSubmitting ? "not-allowed" : "pointer",
              opacity:         isSubmitting ? 0.7 : 1,
              transition:      "background-color var(--transition-base), opacity var(--transition-base)",
              width:           "100%",
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--btn-hover-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--btn-bg)";
              }
            }}
          >
            {isSubmitting && (
              /* Minimal spinner using CSS border trick */
              <span
                aria-hidden
                style={{
                  display:      "inline-block",
                  width:        "0.875rem",
                  height:       "0.875rem",
                  border:       "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation:    "spin 0.6s linear infinite",
                }}
              />
            )}
            {isSubmitting ? "Sending…" : submitLabel}
          </button>
        </div>

      </Stack>

      {/* Spinner keyframes — injected once per form instance */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}

// ── FieldRenderer ─────────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField;
  error?: string;
}

function FieldRenderer({ field, error }: FieldRendererProps) {
  const isRequired = field.validation?.required === true;
  const hasError   = Boolean(error);
  const errorId    = hasError ? `${field.key}-error` : undefined;

  const labelEl = (
    <label
      htmlFor={field.key}
      style={{
        display:      "block",
        fontSize:     "0.875rem",
        fontWeight:   "var(--form-label-weight)",
        color:        "var(--form-label-color)",
        marginBottom: "0.375rem",
      }}
    >
      {field.label}
      {isRequired && (
        <span
          aria-hidden
          style={{ color: "var(--color-error-500)", marginLeft: "0.25rem" }}
        >
          *
        </span>
      )}
    </label>
  );

  const baseInputStyle: React.CSSProperties = {
    display:         "block",
    width:           "100%",
    padding:         "0.5rem 0.75rem",
    backgroundColor: "var(--form-input-bg)",
    border:          hasError
      ? "1px solid var(--color-error-500)"
      : "1px solid var(--form-input-border)",
    borderRadius:    "var(--form-input-radius)",
    color:           "var(--form-input-text)",
    fontSize:        "0.875rem",
    lineHeight:      "1.5",
    outline:         "none",
    transition:      "border-color var(--transition-base), box-shadow var(--transition-base)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = hasError
      ? "var(--color-error-500)"
      : "var(--form-input-focus-ring)";
    e.currentTarget.style.boxShadow = hasError
      ? `0 0 0 3px color-mix(in srgb, var(--color-error-500) 15%, transparent)`
      : `0 0 0 3px color-mix(in srgb, var(--form-input-focus-ring) 20%, transparent)`;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = hasError
      ? "var(--color-error-500)"
      : "var(--form-input-border)";
    e.currentTarget.style.boxShadow = "none";
  };

  // ── Error message ──────────────────────────────────────────────────────────
  const errorEl = hasError ? (
    <p
      id={errorId}
      role="alert"
      style={{
        fontSize:  "0.75rem",
        color:     "var(--color-error-500)",
        marginTop: "0.25rem",
      }}
    >
      {error}
    </p>
  ) : null;

  // ── Checkbox (inline layout) ───────────────────────────────────────────────
  if (field.type === "checkbox") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
        <input
          type="checkbox"
          id={field.key}
          name={field.key}
          required={isRequired}
          defaultChecked={field.defaultValue === true}
          aria-describedby={errorId}
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
            style={{
              fontSize:   "0.875rem",
              fontWeight: "var(--form-label-weight)",
              color:      "var(--form-label-color)",
              cursor:     "pointer",
            }}
          >
            {field.label}
            {isRequired && (
              <span
                aria-hidden
                style={{ color: "var(--color-error-500)", marginLeft: "0.25rem" }}
              >
                *
              </span>
            )}
          </label>
          {field.helpText && (
            <p style={{ fontSize: "0.75rem", color: "var(--form-help-color)", marginTop: "0.125rem" }}>
              {field.helpText}
            </p>
          )}
          {errorEl}
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
      <div>
        {labelEl}
        <textarea
          id={field.key}
          name={field.key}
          placeholder={field.placeholder}
          required={isRequired}
          rows={5}
          aria-describedby={errorId}
          aria-invalid={hasError || undefined}
          style={{ ...baseInputStyle, resize: "vertical" }}
          onFocus={handleFocus as React.FocusEventHandler<HTMLTextAreaElement>}
          onBlur={handleBlur   as React.FocusEventHandler<HTMLTextAreaElement>}
        />
        {field.helpText && !hasError && (
          <p style={{ fontSize: "0.75rem", color: "var(--form-help-color)", marginTop: "0.25rem" }}>
            {field.helpText}
          </p>
        )}
        {errorEl}
      </div>
    );
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  if (field.type === "select") {
    return (
      <div>
        {labelEl}
        <select
          id={field.key}
          name={field.key}
          required={isRequired}
          defaultValue={typeof field.defaultValue === "string" ? field.defaultValue : ""}
          aria-describedby={errorId}
          aria-invalid={hasError || undefined}
          style={baseInputStyle}
          onFocus={handleFocus as React.FocusEventHandler<HTMLSelectElement>}
          onBlur={handleBlur   as React.FocusEventHandler<HTMLSelectElement>}
        >
          <option value="" disabled>
            {field.placeholder ?? "Select an option"}
          </option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.helpText && !hasError && (
          <p style={{ fontSize: "0.75rem", color: "var(--form-help-color)", marginTop: "0.25rem" }}>
            {field.helpText}
          </p>
        )}
        {errorEl}
      </div>
    );
  }

  // ── text | email | tel | url ───────────────────────────────────────────────
  return (
    <div>
      {labelEl}
      <input
        type={field.type}
        id={field.key}
        name={field.key}
        placeholder={field.placeholder}
        required={isRequired}
        aria-describedby={errorId}
        aria-invalid={hasError || undefined}
        style={baseInputStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {field.helpText && !hasError && (
        <p style={{ fontSize: "0.75rem", color: "var(--form-help-color)", marginTop: "0.25rem" }}>
          {field.helpText}
        </p>
      )}
      {errorEl}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loose type guard: asserts that the API response JSON has at minimum an `ok`
 * boolean.  Further narrowing happens at the call site.
 */
function isResponseShape(value: unknown): value is { ok: boolean } {
  return typeof value === "object" && value !== null && "ok" in value;
}

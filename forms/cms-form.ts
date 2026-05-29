/**
 * CMS Form Loader
 *
 * TypeScript type definitions that mirror the Sanity `formDefinition`,
 * `formFieldDef`, and `emailAction` schemas, plus a runtime loader that
 * fetches a form definition document from Sanity by its slug name.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   CMS (Sanity)
 *     formDefinition document   ← authored by operators
 *          ↓  fetchCMSFormByName("contact-form", "workengine")
 *   CMSFormDefinition           ← YOU ARE HERE
 *          ↓  toPlatformFields()
 *   FormField[]                 ← consumed by validateSubmission()
 *          ↓  dispatchCMSEmailActions()
 *   Sent emails                 ← uses mail-transport.ts
 *
 * ─── Two-source form resolution ──────────────────────────────────────────────
 *
 *   Platform-defined forms (contact, application, appointment) are resolved
 *   first from the code registry via isFormKey() / getFormDefinition().
 *
 *   When the formKey does NOT match a platform-registered key, the API route
 *   falls through to fetchCMSFormByName() which loads the definition from
 *   Sanity at runtime.
 *
 * ─── GROQ query ───────────────────────────────────────────────────────────────
 *
 *   *[_type == "formDefinition"
 *     && name.current == $name
 *     && isActive == true
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *   ][0]
 *
 * ─── Template variables ───────────────────────────────────────────────────────
 *
 *   emailAction.subject / body support {{key}} placeholders:
 *     - any field key defined in the form (e.g. {{email}}, {{naam}})
 *     - system vars: {{formName}}, {{submittedAt}}, {{tenantName}}
 *
 * ─── Adapter ──────────────────────────────────────────────────────────────────
 *
 *   toPlatformFields() converts CMSFormFieldDef[] into FormField[] so the
 *   existing validateSubmission() function can validate CMS-defined forms
 *   without modification.
 */

import "server-only";

import type { FormField, FormFieldOption } from "@/forms/types";
import { logger }                          from "@/lib/logger";

// ══════════════════════════════════════════════════════════════════════════════
// CMS TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Field types supported by the CMS form definition editor.
 * Mirrors the FIELD_TYPES list in cms/schemas/objects/formFieldDef.ts.
 */
export type CMSFormFieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "number"
  | "date"
  | "hidden"
  | "consent";

/** Option entry for select / radio field types. */
export interface CMSFormFieldOption {
  readonly label: string;
  readonly value: string;
}

/** Optional validation rules stored with a CMS field definition. */
export interface CMSFormFieldValidation {
  readonly minLength?:      number;
  readonly maxLength?:      number;
  readonly pattern?:        string;
  readonly patternMessage?: string;
}

/**
 * A single field definition as stored in a Sanity formDefinition document.
 * Mirrors the formFieldDef object schema.
 */
export interface CMSFormFieldDef {
  readonly key:           string;
  readonly label:         string;
  readonly type:          CMSFormFieldType;
  readonly required?:     boolean;
  readonly placeholder?:  string;
  readonly helpText?:     string;
  readonly defaultValue?: string;
  readonly options?:      readonly CMSFormFieldOption[];
  readonly validation?:   CMSFormFieldValidation;
}

/**
 * Recipient resolution mode for an email action.
 *
 *   fixed  — static address(es) from the `recipient` string
 *   field  — read the address from a submitted field (e.g. {{email}})
 */
export type CMSEmailRecipientType = "fixed" | "field";

/**
 * Content format for a CMS email action.
 *
 *   text  — plain text only (default)
 *   html  — HTML body
 *   both  — multipart; email clients prefer HTML, fall back to text
 */
export type CMSEmailContentFormat = "text" | "html" | "both";

/**
 * A single email action as stored in a Sanity formDefinition document.
 * Mirrors the emailAction object schema.
 */
export interface CMSEmailAction {
  readonly actionType:     "confirmation" | "backoffice";
  readonly enabled:        boolean;
  readonly recipientType:  CMSEmailRecipientType;
  readonly recipient:      string;
  readonly subject:        string;
  readonly body?:          string;
  readonly contentFormat?: CMSEmailContentFormat;
  readonly replyTo?:       string;
}

/**
 * A complete CMS-managed form definition as loaded from Sanity.
 * Mirrors the formDefinition document schema.
 */
export interface CMSFormDefinition {
  readonly _id:                string;
  readonly name:               { current: string };
  readonly title:              string;
  readonly tenantId?:          string;
  readonly isActive:           boolean;
  readonly successMessage?:    string;
  readonly successRedirectUrl?: string;
  readonly storeSubmissions:   boolean;
  readonly fields:             readonly CMSFormFieldDef[];
  readonly emailActions?:      readonly CMSEmailAction[];
}

// ══════════════════════════════════════════════════════════════════════════════
// GROQ QUERY
// ══════════════════════════════════════════════════════════════════════════════

const CMS_FORM_QUERY = /* groq */ `
  *[_type == "formDefinition"
    && name.current == $name
    && isActive == true
    && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
  ][0] {
    _id,
    name,
    title,
    tenantId,
    isActive,
    successMessage,
    successRedirectUrl,
    storeSubmissions,
    fields[] {
      key,
      label,
      type,
      required,
      placeholder,
      helpText,
      defaultValue,
      options[] { label, value },
      validation { minLength, maxLength, pattern, patternMessage }
    },
    emailActions[] {
      actionType,
      enabled,
      recipientType,
      recipient,
      subject,
      body,
      contentFormat,
      replyTo
    }
  }
`.trim();

// ══════════════════════════════════════════════════════════════════════════════
// LOADER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches a CMS-managed form definition by its slug name and optional tenantId.
 *
 * Resolution order:
 *   1. Active formDefinition where name.current == $name AND tenantId == $tenantId
 *   2. Active formDefinition where name.current == $name AND tenantId is not set
 *      (shared / platform-level form available to all tenants)
 *
 * Returns null when:
 *   - Sanity is not configured (no SANITY_PROJECT_ID)
 *   - No active form with that name exists for the tenant
 *   - Any fetch error occurs (logged, never thrown)
 *
 * @param name      The form's slug identifier (formDefinition.name.current)
 * @param tenantId  Optional tenant slug to scope the lookup
 */
export async function fetchCMSFormByName(
  name:      string,
  tenantId?: string | null,
): Promise<CMSFormDefinition | null> {
  // Lazily import the Sanity client so this module does not break when Sanity
  // is not configured (the client throws on instantiation when vars are absent).
  let createClient: typeof import("@sanity/client").createClient;
  try {
    ({ createClient } = await import("@sanity/client"));
  } catch {
    // @sanity/client not installed — CMS forms not available.
    return null;
  }

  // Pull Sanity config from env without throwing when it's not set.
  const projectId = process.env.SANITY_PROJECT_ID;
  if (!projectId) {
    // Sanity not configured — silently return null.
    return null;
  }

  const dataset    = process.env.SANITY_DATASET    ?? "production";
  const apiVersion = process.env.SANITY_API_VERSION ?? "2024-01-01";
  const token      =
    process.env.SANITY_READ_TOKEN ??
    process.env.SANITY_API_TOKEN ??
    process.env.SANITY_API_WRITE_TOKEN;

  try {
    const client = createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      token,
    });

    const result = await client.fetch<CMSFormDefinition | null>(
      CMS_FORM_QUERY,
      { name, tenantId: tenantId ?? null },
    );

    return result ?? null;
  } catch (err) {
    logger.warn("[forms/cms-form] Failed to fetch CMS form definition", {
      name,
      tenantId,
      error: String(err),
    });
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADAPTER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Converts a CMS form's field definitions into the `FormField[]` shape that
 * `validateSubmission()` expects.
 *
 * CMS-specific types (radio, number, date, consent) are mapped to the closest
 * platform equivalent:
 *
 *   radio    → "select"  (same validation semantics, different render)
 *   number   → "text"    (string validation; caller may add pattern rule)
 *   date     → "text"    (date inputs arrive as strings in FormData)
 *   consent  → "checkbox" (GDPR consent = boolean; required by default)
 *
 * @param cmsFields  The fields array from a CMSFormDefinition.
 * @returns A FormField array ready for validateSubmission().
 */
export function toPlatformFields(cmsFields: readonly CMSFormFieldDef[]): FormField[] {
  return cmsFields.map((f): FormField => {
    const baseValidation = {
      required:       f.required ?? false,
      minLength:      f.validation?.minLength,
      maxLength:      f.validation?.maxLength,
      pattern:        f.validation?.pattern,
      patternMessage: f.validation?.patternMessage,
      // Activate email-format check on email-type fields
      email:  f.type === "email" ? true : undefined,
    };

    // Remove undefined keys to keep the validation object lean.
    const validation = Object.fromEntries(
      Object.entries(baseValidation).filter(([, v]) => v !== undefined),
    ) as FormField["validation"];

    switch (f.type) {
      case "select":
      case "radio":
        return {
          key:          f.key,
          type:         "select",
          label:        f.label,
          placeholder:  f.placeholder,
          helpText:     f.helpText,
          defaultValue: f.defaultValue,
          options:      (f.options ?? []).map(({ label, value }) => ({ label, value } as FormFieldOption)),
          validation:   Object.keys(validation ?? {}).length > 0 ? validation : undefined,
        };

      case "checkbox":
      case "consent": {
        // consent fields are required checkboxes by default
        const consentValidation = f.type === "consent"
          ? { ...validation, required: true }
          : validation;
        return {
          key:          f.key,
          type:         "checkbox",
          label:        f.label,
          helpText:     f.helpText,
          defaultValue: false,
          validation:   Object.keys(consentValidation ?? {}).length > 0
            ? consentValidation
            : undefined,
        };
      }

      case "hidden":
        return {
          key:          f.key,
          type:         "hidden",
          label:        f.label,
          defaultValue: f.defaultValue ?? "",
        };

      // text, email, tel, textarea, number, date all map to text-like fields
      default: {
        const platformType =
          f.type === "email"    ? "email"    :
          f.type === "tel"      ? "tel"      :
          f.type === "textarea" ? "textarea" :
          "text";

        return {
          key:          f.key,
          type:         platformType,
          label:        f.label,
          placeholder:  f.placeholder,
          helpText:     f.helpText,
          defaultValue: f.defaultValue,
          validation:   Object.keys(validation ?? {}).length > 0 ? validation : undefined,
        };
      }
    }
  });
}

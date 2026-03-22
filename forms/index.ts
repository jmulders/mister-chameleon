/**
 * Forms module — barrel export
 *
 * Reusable, platform-driven form definition layer.
 *
 * Forms are defined once in code and referenced by key from CMS content
 * blocks.  The platform resolves the definition at render / submission time —
 * the CMS never dictates field structure, validation rules, or routing config.
 *
 * ─── Public surface ────────────────────────────────────────────────────────────
 *
 *   Types
 *   ─────
 *   FormKey                      — union of all registered form keys
 *   FormDefinition               — top-level form definition shape
 *   FormField                    — discriminated union of all field types
 *   TextFormField                — text / email / textarea / tel / url / hidden field
 *   SelectFormField              — select field with options list
 *   CheckboxFormField            — boolean checkbox field
 *   FormFieldType                — union of HTML input type strings
 *   FormFieldOption              — value + label pair for select fields
 *   FormFieldValidation          — declarative validation constraint object
 *   FormActionConfig             — submission behaviour flags + UX config
 *   FormEmailRouting             — email routing configuration (both directions)
 *   BackofficeNotificationConfig — routing for the internal team notification
 *   SubmitterConfirmationConfig  — routing for the submitter acknowledgement
 *
 *   Helpers
 *   ───────
 *   getFormDefinition(key)       — resolve a FormDefinition by key
 *   getAllFormDefinitions()      — all registered definitions (for admin UIs, tests)
 *   isFormKey(value)             — type-guard: narrow a string to FormKey
 *
 * ─── Usage examples ────────────────────────────────────────────────────────────
 *
 *   // Resolve a form definition from a CMS block's formKey field:
 *   import { getFormDefinition, isFormKey } from "@/forms";
 *   const def = isFormKey(block.formKey)
 *     ? getFormDefinition(block.formKey)
 *     : undefined;
 *
 *   // Enumerate all forms in an admin picker:
 *   import { getAllFormDefinitions } from "@/forms";
 *   const options = getAllFormDefinitions().map(f => ({ value: f.key, label: f.title }));
 *
 *   // Type a server action parameter:
 *   import type { FormKey, FormDefinition } from "@/forms";
 *   async function handleSubmit(key: FormKey, data: Record<string, string>) { … }
 *
 * ─── What is NOT exported ──────────────────────────────────────────────────────
 *
 *   Individual definition files (forms/definitions/*.ts) are internal.
 *   Import via the helpers above — never import definition files directly.
 *   This keeps the internal organisation flexible for future refactoring.
 *
 *   Server-only modules (email dispatch, submission storage, spam protection)
 *   are NOT re-exported from this barrel.  Importing them here would pull
 *   server-side dependencies (database client, secret env vars, "server-only"
 *   guard) into the client bundle whenever a Client Component imports @/forms.
 *
 *   Server code should import them directly from their sub-modules:
 *     import { storeSubmission }              from "@/forms/storage";
 *     import { dispatchBackofficeNotification,
 *               dispatchSubmitterConfirmation } from "@/forms/email";
 *     import { checkHoneypot, checkRateLimit,
 *               resolveClientIp }              from "@/forms/spam";
 *
 *   Or use the named server-only barrel for a single convenient import:
 *     import { storeSubmission, dispatchBackofficeNotification } from "@/forms/server";
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  FormKey,
  FormDefinition,
  FormField,
  TextFormField,
  SelectFormField,
  CheckboxFormField,
  FormFieldType,
  FormFieldOption,
  FormFieldValidation,
  FormActionConfig,
  FormEmailRouting,
  BackofficeNotificationConfig,
  SubmitterConfirmationConfig,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

export {
  getFormDefinition,
  getAllFormDefinitions,
  isFormKey,
} from "./registry";

// ── Validation ────────────────────────────────────────────────────────────────

export type { FieldErrors, ValidationResult } from "./validation";
export { validateField, validateSubmission, interpolateTemplate } from "./validation";

// ── Server-only exports ───────────────────────────────────────────────────────
//
// Email dispatch (forms/email.ts), submission storage (forms/storage.ts), and
// spam protection (forms/spam.ts) are intentionally NOT exported from this
// barrel.  They carry `import "server-only"` and would contaminate the client
// bundle if re-exported here.
//
// Use @/forms/server (the named server-only barrel) or import directly from
// the sub-module paths listed in the header comment above.

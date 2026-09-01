/**
 * Forms — type definitions
 *
 * Defines the platform's internal, CMS-agnostic model for reusable form
 * definitions. Forms are platform-driven: they are defined once in code,
 * referenced by key from CMS content blocks, and resolved at render time
 * by the platform — not reconstructed from raw CMS fields on every page.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   CMS content block (formKey reference)
 *        ↓  getFormDefinition(key)
 *   FormDefinition                  ← YOU ARE HERE
 *        ↓  server action / API route
 *   validated submission + email dispatch + optional storage
 *
 * ─── Design constraints ───────────────────────────────────────────────────────
 *
 *   1. Form definitions are platform-side only.
 *      They are never stored in or derived from the CMS.  The CMS places a
 *      form on a page by referencing a FormKey string — the platform resolves
 *      what that form looks like and how it behaves.
 *
 *   2. Definitions are tenant-reusable.
 *      A FormDefinition describes field structure, validation, and routing
 *      intent.  Deployment-specific values (recipient addresses, webhook URLs)
 *      are optional on the definition and fall back to tenant config or env
 *      vars at runtime — so the same definition works across tenants.
 *
 *   3. Validation rules are declared, not executed.
 *      FormFieldValidation describes constraints as a data object.  The
 *      runtime (server action / API route) executes the validation.  This
 *      keeps the model serialisable and usable for both server-side
 *      validation and client-side progressive enhancement without a shared
 *      validation library.
 *
 *   4. Email routing structure is separate from action flags.
 *      FormActionConfig carries the boolean flags (enabled/disabled).
 *      FormEmailRouting carries the structural routing shape (field mappings,
 *      subject templates, optional default addresses).
 *
 * ─── Module structure ─────────────────────────────────────────────────────────
 *
 *   types.ts          ← YOU ARE HERE — all type definitions
 *   definitions/
 *     contact.ts      — contact form definition
 *     application.ts  — application form definition
 *   registry.ts       — FORM_REGISTRY + getFormDefinition() + getAllFormDefinitions()
 *   index.ts          — barrel export
 */

// ═════════════════════════════════════════════════════════════════════════════
// FORM KEY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The set of named forms available on the platform.
 *
 *   contact     — Visitor inquiry form (name + email + message).
 *                 Routed to the business inbox with full session enrichment.
 *
 *   application — Job / service application form (name + email + position +
 *                 cover letter + optional LinkedIn/portfolio URLs).
 *                 Routed to the careers inbox.
 *
 *   appointment — Intake / discovery appointment request form (name + email +
 *                 phone + company + preferred date/time + message).
 *                 Used on the join page for candidate/employer onboarding calls.
 *
 * IMPORTANT: New form types are added here as additional string literals.
 * Adding a key here alone is not sufficient — a FormDefinition must also be
 * registered in forms/registry.ts for the key to be resolvable at runtime.
 */
export type FormKey = "contact" | "application" | "appointment" | "newsletter" | "locatie-test";

// ═════════════════════════════════════════════════════════════════════════════
// FORM FIELD
// ═════════════════════════════════════════════════════════════════════════════

// ── Field types ───────────────────────────────────────────────────────────────

/**
 * The set of HTML input types a form field may represent.
 *
 * These map directly to HTML input/textarea/select elements:
 *
 *   text      — single-line text input (<input type="text">)
 *   email     — email address input (<input type="email">)
 *   textarea  — multi-line text input (<textarea>)
 *   tel       — telephone number input (<input type="tel">)
 *   url       — URL input (<input type="url">)
 *   select    — dropdown select (<select>); requires `options`
 *   checkbox  — boolean toggle (<input type="checkbox">)
 *   hidden    — non-rendered field with a preset value; useful for form
 *               routing metadata (e.g. a form variant key passed to the handler)
 */
export type FormFieldType =
  | "text"
  | "email"
  | "textarea"
  | "tel"
  | "url"
  | "select"
  | "checkbox"
  | "hidden";

// ── Field option (select) ─────────────────────────────────────────────────────

/**
 * A single option within a select-type form field.
 *
 * `value` is the machine-readable string stored on submission.
 * `label` is the human-readable string shown in the dropdown.
 */
export interface FormFieldOption {
  readonly value: string;
  readonly label: string;
}

// ── Validation rules ──────────────────────────────────────────────────────────

/**
 * Validation constraints for a single form field.
 *
 * These are declarative rules — they describe what is valid, not how to
 * validate it.  The runtime (server action / API route) executes the checks.
 *
 * ─── Field reference ──────────────────────────────────────────────────────────
 *
 *   required        — field must be present and non-empty after trimming.
 *
 *   minLength       — minimum character count (post-trim); for text fields.
 *
 *   maxLength       — maximum character count (post-trim); for text fields.
 *
 *   email           — value must match a plausible email address pattern.
 *                     Set true on fields of type "email" for explicit server
 *                     validation (in addition to HTML5 client validation).
 *
 *   url             — value must be a plausible absolute URL.
 *                     Applied to type "url" fields when the field is non-empty.
 *
 *   pattern         — RegExp source string.  The handler constructs
 *                     `new RegExp(pattern)` and tests the value against it.
 *                     JSON-serialisable (no RegExp literal).
 *
 *   patternMessage  — Human-readable error shown when `pattern` fails.
 *                     Falls back to a generic "Invalid format" message when absent.
 *
 *   min / max       — Numeric bounds for tel / number fields after parsing.
 *                     Currently informational — not enforced by the base handler.
 */
export interface FormFieldValidation {
  readonly required?:       boolean;
  readonly minLength?:      number;
  readonly maxLength?:      number;
  readonly email?:          boolean;
  readonly url?:            boolean;
  readonly pattern?:        string;
  readonly patternMessage?: string;
  readonly min?:            number;
  readonly max?:            number;
}

// ── Base field ────────────────────────────────────────────────────────────────

/**
 * Fields shared by all form field variants.
 *
 *   key          — Stable machine identifier. Used as the property name in the
 *                  validated submission object and in email template placeholders
 *                  (e.g. `{{name}}`, `{{email}}`).  Must be unique within a form.
 *
 *   type         — HTML input type; determines which field variant applies.
 *
 *   label        — Human-readable label rendered above the input.
 *
 *   placeholder  — Placeholder text rendered inside the input when empty.
 *                  Omit for checkbox and hidden fields.
 *
 *   helpText     — Optional short hint rendered below the label or field.
 *                  Use for format guidance (e.g. "Include country code").
 *
 *   defaultValue — Pre-populated value on form mount.  String for text fields,
 *                  boolean for checkboxes.  Hidden fields typically carry a
 *                  static defaultValue that is passed through on submission.
 *
 *   validation   — Declarative constraint object; absent means no validation.
 */
interface FormFieldBase {
  readonly key:           string;
  readonly type:          FormFieldType;
  readonly label:         string;
  readonly placeholder?:  string;
  readonly helpText?:     string;
  readonly defaultValue?: string | boolean;
  readonly validation?:   FormFieldValidation;
}

// ── Field variants (discriminated union) ──────────────────────────────────────

/**
 * A text-like single-value field.
 * Covers: text, email, textarea, tel, url, hidden.
 */
export interface TextFormField extends FormFieldBase {
  readonly type: "text" | "email" | "textarea" | "tel" | "url" | "hidden";
}

/**
 * A select field with a fixed list of options.
 *
 * `options` is an ordered list of value/label pairs rendered as <option>
 * elements.  The first option is selected by default unless `defaultValue`
 * is set to a specific value.
 */
export interface SelectFormField extends FormFieldBase {
  readonly type:    "select";
  readonly options: readonly FormFieldOption[];
}

/**
 * A boolean checkbox field.
 *
 * `defaultValue` must be a boolean when provided.
 * The validated submission value is `"true"` or `"false"` (string) to keep
 * the submission type consistent across all field types.
 */
export interface CheckboxFormField extends FormFieldBase {
  readonly type:          "checkbox";
  readonly defaultValue?: boolean;
}

/**
 * Discriminated union of all supported form field types.
 *
 * Narrow on `type` to access fields specific to a field variant:
 * @example
 * function renderField(field: FormField) {
 *   switch (field.type) {
 *     case "select":   return <Select options={field.options} />;
 *     case "checkbox": return <Checkbox defaultChecked={field.defaultValue} />;
 *     default:         return <Input type={field.type} />;
 *   }
 * }
 */
export type FormField = TextFormField | SelectFormField | CheckboxFormField;

// ═════════════════════════════════════════════════════════════════════════════
// FORM ACTION CONFIG
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Configures what happens after a validated form submission is accepted.
 *
 * ─── Flag semantics ───────────────────────────────────────────────────────────
 *
 *   storeSubmissions
 *     Write the submission to the platform's submissions store (e.g. the
 *     Supabase `form_submissions` table).  Set true on all forms where a
 *     persistent audit trail is required (contact, application).
 *     Set false for low-stakes forms where storage cost is not justified.
 *
 *   notifyBackoffice
 *     Trigger an internal notification (email, Slack, or webhook) to the
 *     backoffice team.  Requires a FormEmailRouting.backoffice config on the
 *     parent FormDefinition to be meaningful.
 *
 *   sendConfirmation
 *     Send an acknowledgement email to the submitter.  Requires a
 *     FormEmailRouting.confirmation config with an `emailField` pointing to
 *     the field that holds the submitter's email address.
 *
 * ─── Downstream integration ───────────────────────────────────────────────────
 *
 *   webhookUrl
 *     Optional submission webhook fired after successful validation and storage.
 *     When set, the handler POSTs the enriched submission payload to this URL.
 *
 *     Resolution priority (highest first):
 *       1. FormActionConfig.webhookUrl  (definition-level override)
 *       2. TenantContactConfig.webhookUrl  (tenant-level override)
 *       3. N8N_CONTACT_WEBHOOK_URL env var  (platform-level default)
 *
 *     Omit to fall through to tenant / env-var resolution.
 *
 * ─── UX ───────────────────────────────────────────────────────────────────────
 *
 *   successMessage
 *     Plain-text message shown to the submitter after a successful submission.
 *     Falls back to a generic platform default when absent.
 *
 *   redirectPath
 *     Optional pathname to redirect the user to after successful submission
 *     (e.g. "/thank-you").  When set, `successMessage` is ignored on redirect.
 *     Must be a relative path (no protocol/hostname) for security.
 */
export interface FormActionConfig {
  /** Persist the submission to the platform's storage layer */
  readonly storeSubmissions:  boolean;
  /** Fire an internal notification to the backoffice team on submission */
  readonly notifyBackoffice:  boolean;
  /** Send a confirmation acknowledgement to the submitter */
  readonly sendConfirmation:  boolean;
  /**
   * Definition-level webhook URL override.
   * Omit to fall through to tenant config → env var resolution.
   */
  readonly webhookUrl?:       string;
  /**
   * Success message shown to the submitter after accepted submission.
   * Displayed in-place (no redirect) when `redirectPath` is absent.
   */
  readonly successMessage?:   string;
  /**
   * Relative path to redirect the submitter to after successful submission.
   * Example: "/thank-you". When set, `successMessage` is ignored on redirect.
   */
  readonly redirectPath?:     string;
}

// ═════════════════════════════════════════════════════════════════════════════
// FORM EMAIL ROUTING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for the backoffice notification email sent on submission.
 *
 * ─── Template placeholders ────────────────────────────────────────────────────
 *
 *   The `subject` field supports `{{fieldKey}}` placeholder interpolation.
 *   At send time, the handler replaces each `{{key}}` with the corresponding
 *   validated field value from the submission.  For example:
 *
 *     subject: "New contact from {{name}}"
 *     → resolves to "New contact from Jane Smith" at runtime
 *
 * ─── Address resolution ───────────────────────────────────────────────────────
 *
 *   `to` and `from` are optional at the definition level.  When absent, the
 *   handler resolves them from tenant config or platform env vars:
 *
 *     to   → BACKOFFICE_EMAIL env var or tenant notification config
 *     from → MAIL_FROM_ADDRESS env var or tenant notification config
 *
 *   Setting these on the definition locks the routing for this form type,
 *   regardless of tenant.  Useful when different forms route to different
 *   internal inboxes (e.g. contact → hello@, applications → careers@).
 */
export interface BackofficeNotificationConfig {
  /**
   * Internal recipient address(es) for this form's notification emails.
   * Omit to fall through to tenant / env-var resolution.
   */
  readonly to?:            readonly string[];
  /**
   * Sender address for backoffice notification emails.
   * Omit to fall through to tenant / env-var resolution.
   */
  readonly from?:          string;
  /**
   * Email subject template.
   * Supports `{{fieldKey}}` placeholder interpolation from submission values.
   * Example: "New application from {{name}} — {{position}}"
   */
  readonly subject:        string;
  /**
   * The form field key whose submitted value becomes the Reply-To address.
   * Typically set to the email field key so the team can reply directly to
   * the submitter without manually looking up their address.
   * Example: "email"
   */
  readonly replyToField?:  string;
}

/**
 * Configuration for the acknowledgement email sent to the submitter.
 *
 * ─── Template placeholders ────────────────────────────────────────────────────
 *
 *   `subject` and `body` support `{{fieldKey}}` placeholder interpolation,
 *   same as BackofficeNotificationConfig.subject.
 *
 * ─── Address resolution ───────────────────────────────────────────────────────
 *
 *   `from` is optional; resolves from tenant config / env vars when absent.
 *   `emailField` is required — it identifies which form field holds the
 *   submitter's email address so the handler knows where to send the email.
 */
export interface SubmitterConfirmationConfig {
  /**
   * The form field key that holds the submitter's email address.
   * This field's submitted value becomes the confirmation email's recipient.
   * Required — without this, the handler cannot route the confirmation.
   * Example: "email"
   */
  readonly emailField:  string;
  /**
   * Sender address for the confirmation email.
   * Omit to fall through to tenant / env-var resolution.
   */
  readonly from?:       string;
  /**
   * Confirmation email subject template.
   * Supports `{{fieldKey}}` placeholder interpolation.
   * Example: "We received your message, {{name}}"
   */
  readonly subject:     string;
  /**
   * Optional plain-text / Markdown body template for the confirmation email.
   * Supports `{{fieldKey}}` placeholder interpolation.
   * When absent, the handler renders a minimal platform default body.
   */
  readonly body?:       string;
}

/**
 * Email routing configuration for a form.
 *
 * Combines two optional routing directions:
 *
 *   backoffice   — notification fired to the internal team on each submission
 *   confirmation — acknowledgement sent to the submitter after submission
 *
 * The corresponding action flags (notifyBackoffice / sendConfirmation) on
 * FormActionConfig control whether each direction is active.  Both fields
 * here are optional so a form can configure only the directions it uses.
 *
 * @example
 * emailRouting: {
 *   backoffice: {
 *     to:           ["hello@example.com"],
 *     subject:      "New contact from {{name}}",
 *     replyToField: "email",
 *   },
 *   confirmation: {
 *     emailField: "email",
 *     subject:    "We received your message",
 *   },
 * }
 */
export interface FormEmailRouting {
  /** Backoffice notification routing — sent to the internal team */
  readonly backoffice?:    BackofficeNotificationConfig;
  /** Submitter confirmation routing — sent to the person who submitted */
  readonly confirmation?:  SubmitterConfirmationConfig;
}

// ═════════════════════════════════════════════════════════════════════════════
// FORM DEFINITION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The complete, platform-side definition of a reusable form.
 *
 * A FormDefinition is the single source of truth for everything the platform
 * needs to render, validate, and process a form type.  It is:
 *
 *   - Defined once in code (forms/definitions/*.ts)
 *   - Registered by key in the FORM_REGISTRY (forms/registry.ts)
 *   - Referenced from CMS content blocks by FormKey string only
 *   - Resolved at render/submission time via getFormDefinition(key)
 *
 * ─── Separation of concerns ───────────────────────────────────────────────────
 *
 *   FormDefinition   — What the form is: field structure, validation, routing intent.
 *   FormActionConfig — What happens on submission: flags, webhook, UX.
 *   FormEmailRouting — Where emails go: addresses, subject templates, field mappings.
 *
 *   Page placement (which page, which position) lives entirely in the CMS.
 *   The platform resolves the definition from the formKey reference on the block.
 *
 * ─── Tenant reusability ───────────────────────────────────────────────────────
 *
 *   FormDefinitions are tenant-agnostic by default.  Deployment-specific
 *   values (recipient addresses, webhook URLs) are optional on the definition
 *   and resolved from tenant config or env vars at runtime.  The same
 *   "contact" definition works for every tenant; only the routing addresses differ.
 *
 * @example
 * const def = getFormDefinition("contact");
 * def.key              // "contact"
 * def.title            // "Contact Us"
 * def.fields           // [nameField, emailField, messageField]
 * def.action.notifyBackoffice  // true
 * def.emailRouting?.backoffice?.subject  // "New contact from {{name}}"
 */
export interface FormDefinition {
  /**
   * Stable machine identifier.  Matches the FormKey union.
   * Used for registry lookup, analytics event naming, and CMS reference.
   */
  readonly key:           FormKey;

  /**
   * Human-readable form title.
   * Rendered as the form's <h2> / heading in the form component.
   * Example: "Contact Us", "Apply Now"
   */
  readonly title:         string;

  /**
   * Optional short description rendered below the form title.
   * Use for brief context about what the form is for or what to expect.
   */
  readonly description?:  string;

  /**
   * Ordered array of form fields.
   *
   * Rendered top-to-bottom in array order.  The order is part of the
   * definition — do not sort or reorder at render time.
   *
   * Each field has a unique `key` within this form, used as:
   *   - The HTML `name` / `id` attribute
   *   - The property key in the validated submission object
   *   - The `{{key}}` placeholder token in email subject/body templates
   */
  readonly fields:        readonly FormField[];

  /**
   * Submission action configuration.
   *
   * Declares the three behavioural flags (storeSubmissions, notifyBackoffice,
   * sendConfirmation) plus optional downstream integration config.
   */
  readonly action:        FormActionConfig;

  /**
   * Email routing configuration for this form.
   *
   * Required when action.notifyBackoffice or action.sendConfirmation is true
   * (though not enforced at the type level — the handler logs a warning when
   * a flag is true but the corresponding routing config is absent).
   *
   * Absent for forms that use only webhook dispatch (action.webhookUrl) or
   * pure storage with no email output.
   */
  readonly emailRouting?: FormEmailRouting;
}

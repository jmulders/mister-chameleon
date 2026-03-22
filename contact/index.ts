/**
 * Contact module — barrel export
 *
 * Public API for the contact form orchestration layer.
 * Import from "@/contact" to access payload types, the builder function,
 * and the n8n dispatch helper.
 *
 * Internal module structure:
 *
 *   types.ts
 *     ContactFormFields, ContactFormRequest
 *     ContactCampaignContext, ContactSessionContext
 *     ContactServedExperience, ContactPageContext
 *     N8nContactPayload, ContactSubmissionResult
 *
 *   build-contact-context-payload.ts
 *     buildContactContextPayload()  — pure payload assembler
 *     sendToN8n()                   — n8n webhook dispatcher
 *     BuildContactPayloadInput      — input type for the builder
 *
 * Usage pattern (in the API route handler):
 *
 *   import { buildContactContextPayload, sendToN8n } from "@/contact";
 *
 *   const payload = buildContactContextPayload({ formFields, context, history, ... });
 *   const result  = await sendToN8n(payload);
 */

// Types
export type {
  ContactFormFields,
  ContactFormRequest,
  ContactCampaignContext,
  ContactSessionContext,
  ContactServedExperience,
  ContactPageContext,
  N8nContactPayload,
  ContactSubmissionResult,
} from "./types";

// Builder + dispatcher
export {
  buildContactContextPayload,
  sendToN8n,
} from "./build-contact-context-payload";
export type { BuildContactPayloadInput } from "./build-contact-context-payload";

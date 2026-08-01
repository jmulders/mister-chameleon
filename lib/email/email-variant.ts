/**
 * Email variants (adaptive-emails, rule-selected).
 *
 * An email variant is the unit the decision engine chooses per recipient for a
 * given template. It carries presentation overrides — subject, preheader, and/or
 * the block set — layered on top of the resolved template (tenant override over
 * the code default). The adaptive block CONTENT still comes from the rules plan
 * + blocks library, exactly as before; a variant only reshapes the envelope.
 *
 * These are pure types (no server-only imports) so the authoring editor (client)
 * and the catalogue/actions (server) can both use them. The loader that reads a
 * variant from the `email:<templateKey>` adaptive-block row lives in
 * lib/email/adaptive-email.ts (server-only).
 */

import type { EmailBlockEntry } from "./adaptive-email";

/** The per-recipient variant payload stored alongside adaptive-block variants. */
export interface EmailVariantContent {
  /** Subject line override (may contain {name} / {company}). */
  subject?:   string;
  /** Inbox preview text override (may contain {name} / {company}). */
  preheader?: string;
  /**
   * Block set override — adaptive block keys ("hero", …) plus "footer" and
   * free-text / html entries, in order. When present and non-empty it REPLACES
   * the resolved template's block list for this recipient.
   */
  blocks?:    EmailBlockEntry[];
}

/** An authored email variant: its key/label plus the content payload. */
export interface EmailVariantEntry {
  variantKey: string;
  label?:     string;
  content:    EmailVariantContent;
}

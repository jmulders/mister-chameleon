/**
 * Block Content Contracts — Type Definitions
 *
 * A BlockContentContract is the authoritative specification for what content
 * a block type requires and supports.  It serves as a single source of truth
 * consumed by:
 *
 *   • CMS schema authoring   — which fields to add, which to mark required
 *   • Blueprint seeding      — what data to seed when applying a blueprint
 *   • Page generation        — what content to scaffold for each block
 *   • Preview safety         — whether a page has enough data to render
 *   • Validation             — runtime check before publishing
 *
 * ─── Design principles ───────────────────────────────────────────────────────
 *
 *   • Contracts describe CONTENT STRUCTURE, not visual layout.
 *     (Variants control layout; they are separate from contracts.)
 *
 *   • "required" means broken or empty if absent.
 *     "optional" means a sensible default exists and the block still renders.
 *
 *   • Context slots (hero, proof, cta) are documented as contracts but are
 *     NOT ContentBlockKey entries — they are rendered via the decision engine.
 *
 *   • Contracts are runtime-accessible (plain objects, not pure types).
 *     This enables validation, seeding, and admin tooling at runtime.
 */

import type { PageTypeKey, SiteModelKey } from "../site-models/types";

// ── Field type vocabulary ─────────────────────────────────────────────────────

export type BlockContractFieldType =
  | "string"          // plain text
  | "richText"        // Portable Text / markdown body
  | "number"
  | "boolean"
  | "url"
  | "image"           // { src, alt }
  | "cta"             // { label, href, variant? }
  | "array"           // homogeneous array; see `itemShape`
  | "object"          // nested object; see `objectShape`
  | "enum";           // fixed set; see `allowedValues`

// ── Field definition ──────────────────────────────────────────────────────────

export interface BlockContractField {
  /**
   * Exact field name in the BlockData TypeScript interface.
   * Use dot notation for nested paths (e.g. "primaryCta.label").
   */
  name:          string;
  /** TypeScript / vocabulary type */
  type:          BlockContractFieldType | string;
  /** One-line description for CMS field hints and docs */
  description:   string;
  /** Minimum number of array items (for array fields) */
  minItems?:     number;
  /** Maximum number of array items (for array fields) */
  maxItems?:     number;
  /** Allowed enum values (for enum fields) */
  allowedValues?: string[];
  /** Sub-field names for object/array-of-object fields (informational) */
  subFields?:    string[];
  /** Example value used for blueprint seeding and preview */
  example?:      unknown;
}

// ── Validation rule ───────────────────────────────────────────────────────────

export interface BlockValidationRule {
  /** Unique stable identifier (e.g. "gallery_min_items") */
  id:            string;
  /** Human-readable description shown in validation output */
  description:   string;
  /**
   * Runtime validator.
   * Returns null if valid; an error message string if invalid.
   * Receives the raw block data as Record<string, unknown>.
   */
  validate:      (data: Record<string, unknown>) => string | null;
}

// ── The contract ──────────────────────────────────────────────────────────────

export interface BlockContentContract {
  /**
   * Canonical block type identifier.
   *
   * For content blocks this matches ContentBlockKey from tenant/types.ts.
   * For context slots ("hero", "proof", "cta") this is the slot id.
   */
  blockType:         string;

  /**
   * Human-facing label shown in admin UI and validation reports.
   */
  label:             string;

  /**
   * One-line description of what the block does.
   */
  description:       string;

  /**
   * TypeScript BlockData interface name in page-config/types.ts.
   * Empty string for context slots (no BlockData interface).
   */
  dataType:          string;

  /**
   * True for hero/proof/cta context slots — rendered via the decision
   * engine and not part of the static content block system.
   */
  isContextSlot?:    boolean;

  /**
   * Alias keys used in blueprint page templates that resolve to this block.
   * E.g. "cardGrid" in page templates resolves to "listing".
   * Allows template authors to use intuitive names without breaking contracts.
   */
  templateAliases?:  string[];

  /**
   * Required fields — block will produce a broken or empty render if absent.
   * Validation fails when any of these are missing or empty.
   */
  required:          BlockContractField[];

  /**
   * Optional fields — block renders with defaults when absent.
   * Validation passes when these are absent.
   */
  optional:          BlockContractField[];

  /**
   * Page types where this block is typically appropriate.
   * Informational — used for admin suggestion logic, not hard enforcement.
   */
  supportedPageTypes: PageTypeKey[];

  /**
   * Site models where this block is commonly used.
   * Used for model-compatibility filtering in the setup wizard.
   */
  supportedModels:   SiteModelKey[];

  /**
   * Additional validation rules beyond required-field presence.
   * Applied in order; all failures are collected (not short-circuited).
   */
  rules?:            BlockValidationRule[];
}

// ── Validation result ─────────────────────────────────────────────────────────

export interface BlockValidationError {
  /** The block type being validated */
  blockType:  string;
  /** The rule or field that failed */
  field:      string;
  /** Human-readable message */
  message:    string;
  /** Error severity */
  severity:   "error" | "warning";
}

export interface BlockValidationResult {
  /** True only when there are zero errors (warnings are allowed) */
  valid:      boolean;
  errors:     BlockValidationError[];
  warnings:   BlockValidationError[];
}

// ── Page validation result ────────────────────────────────────────────────────

export interface PageValidationResult {
  /** Overall validity — false if any block has errors */
  valid:        boolean;
  /** Slug of the page being validated */
  slug:         string;
  /** Per-block results (only blocks with issues included) */
  blockResults: Array<{
    blockType:  string;
    blockIndex: number;
    result:     BlockValidationResult;
  }>;
}

// ── Seed content item ─────────────────────────────────────────────────────────

/**
 * A minimal content seed — the smallest valid data set that satisfies a
 * block contract.  Used for blueprint application and Storybook fixtures.
 */
export type BlockContentSeed = Record<string, unknown>;

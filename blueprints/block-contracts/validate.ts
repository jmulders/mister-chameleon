/**
 * Block Content Validation (Part 5)
 *
 * Runtime validation that checks whether block content satisfies its contract.
 * Used for:
 *
 *   • Pre-publish safety checks    — catch broken pages before they go live
 *   • Blueprint seeding validation — verify generated content is renderable
 *   • Admin preview warnings       — surface warnings to editors
 *   • CI content audits            — catch regressions in content quality
 *
 * ─── Validation levels ───────────────────────────────────────────────────────
 *
 *   ERROR   → Block will render broken or empty.
 *             Example: richText with no body, formSection with no formKey.
 *
 *   WARNING → Block renders but is incomplete or likely suboptimal.
 *             Example: ctaSection with no title (renders fine, but weaker).
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { validateBlock, validatePage } from "@/blueprints/block-contracts/validate";
 *
 *   // Single block:
 *   const result = validateBlock("formSection", { formKey: "contact", submitLabel: "Verstuur" });
 *   if (!result.valid) console.error(result.errors);
 *
 *   // Whole page:
 *   const pageResult = validatePage("/contact", [
 *     { blockType: "textSection", data: { heading: "Contact" } },
 *     { blockType: "formSection", data: { formKey: "contact_default", submitLabel: "Verstuur" } },
 *   ]);
 */

import type {
  BlockValidationResult,
  BlockValidationError,
  PageValidationResult,
} from "./types";
import { getBlockContract } from "./contracts";

// ── Internal helpers ──────────────────────────────────────────────────────────

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string")  return value.trim() === "";
  if (Array.isArray(value))       return value.length === 0;
  return false;
}

function makeError(
  blockType: string,
  field:     string,
  message:   string,
  severity:  "error" | "warning" = "error",
): BlockValidationError {
  return { blockType, field, message, severity };
}

// ── Core validation function ──────────────────────────────────────────────────

/**
 * Validate a block's content data against its registered contract.
 *
 * @param blockType  The ContentBlockKey or context-slot id
 * @param data       Raw content data (Record<string, unknown>)
 * @returns          { valid, errors, warnings }
 */
export function validateBlock(
  blockType: string,
  data:      Record<string, unknown>,
): BlockValidationResult {
  const errors:   BlockValidationError[] = [];
  const warnings: BlockValidationError[] = [];

  const contract = getBlockContract(blockType);

  if (!contract) {
    // Unknown block type — emit a warning but don't hard-fail
    warnings.push(makeError(
      blockType,
      "_contract",
      `No content contract registered for block type "${blockType}". Validation skipped.`,
      "warning",
    ));
    return { valid: true, errors, warnings };
  }

  // ── 1. Required field checks ───────────────────────────────────────────────

  for (const field of contract.required) {
    const value = data[field.name];

    if (isEmpty(value)) {
      errors.push(makeError(
        blockType,
        field.name,
        `Required field "${field.name}" (${field.description}) is missing or empty.`,
      ));
      continue;
    }

    // For array fields: check minItems
    if (Array.isArray(value) && field.minItems !== undefined && value.length < field.minItems) {
      errors.push(makeError(
        blockType,
        field.name,
        `"${field.name}" must have at least ${field.minItems} item(s) (found ${value.length}).`,
      ));
    }
  }

  // ── 2. Optional field quality warnings ────────────────────────────────────

  for (const field of contract.optional) {
    const value = data[field.name];

    // For optional array fields that have a minItems hint — warn if present but empty
    if (Array.isArray(value) && field.minItems !== undefined && value.length < field.minItems) {
      warnings.push(makeError(
        blockType,
        field.name,
        `Optional field "${field.name}" is present but has fewer than ${field.minItems} item(s) (found ${value.length}). Block may render poorly.`,
        "warning",
      ));
    }
  }

  // ── 3. Custom validation rules ────────────────────────────────────────────

  if (contract.rules) {
    for (const rule of contract.rules) {
      const message = rule.validate(data);
      if (message !== null) {
        errors.push(makeError(blockType, rule.id, message));
      }
    }
  }

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
  };
}

// ── Page-level validation ─────────────────────────────────────────────────────

export interface PageBlockInput {
  blockType: string;
  data:      Record<string, unknown>;
}

/**
 * Validate all blocks on a page.
 * Returns a page-level result containing per-block results for blocks
 * that have warnings or errors.
 *
 * @param slug    Page slug (for reporting)
 * @param blocks  Ordered array of block type + data pairs
 */
export function validatePage(
  slug:   string,
  blocks: PageBlockInput[],
): PageValidationResult {
  const blockResults: PageValidationResult["blockResults"] = [];
  let pageValid = true;

  for (let i = 0; i < blocks.length; i++) {
    const { blockType, data } = blocks[i]!;
    const result = validateBlock(blockType, data);

    if (!result.valid || result.warnings.length > 0) {
      blockResults.push({ blockType, blockIndex: i, result });
    }

    if (!result.valid) {
      pageValid = false;
    }
  }

  return { valid: pageValid, slug, blockResults };
}

// ── Blueprint seed validation ─────────────────────────────────────────────────

/**
 * Validate a blueprint's seeded content — the content generated when a
 * blueprint is applied to a tenant.
 *
 * Returns a map of slug → PageValidationResult for pages that have issues.
 */
export function validateBlueprintSeed(
  pages: Array<{ slug: string; blocks: PageBlockInput[] }>,
): Map<string, PageValidationResult> {
  const results = new Map<string, PageValidationResult>();

  for (const page of pages) {
    const result = validatePage(page.slug, page.blocks);
    if (!result.valid || result.blockResults.length > 0) {
      results.set(page.slug, result);
    }
  }

  return results;
}

// ── Convenience: check contract completeness ─────────────────────────────────

/**
 * Check whether data contains at minimum all required fields with non-empty values.
 * Returns true if the block is safe to render.
 */
export function isBlockSafeToRender(
  blockType: string,
  data:      Record<string, unknown>,
): boolean {
  return validateBlock(blockType, data).valid;
}

/**
 * Return a human-readable validation report for a single block.
 * Useful for logging, admin tooltips, and CI output.
 */
export function formatValidationReport(
  blockType: string,
  result:    BlockValidationResult,
): string {
  if (result.valid && result.warnings.length === 0) {
    return `✓ ${blockType}: valid`;
  }

  const lines: string[] = [`✗ ${blockType}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`];

  for (const e of result.errors) {
    lines.push(`  ERROR   [${e.field}] ${e.message}`);
  }
  for (const w of result.warnings) {
    lines.push(`  WARNING [${w.field}] ${w.message}`);
  }

  return lines.join("\n");
}

// ── CMS schema validation hints ───────────────────────────────────────────────

/**
 * Generate Sanity schema validation hints for a block type.
 *
 * Returns an array of descriptive strings that can be used to guide
 * manual addition of `.validation()` calls to Sanity schema field definitions.
 *
 * These are NOT code — they are documentation for CMS schema authors.
 *
 * Usage:
 *   const hints = getCmsValidationHints("formSection");
 *   // → [
 *   //   "formKey: Rule.required().error('Form key is required')",
 *   //   "submitLabel: Rule.required().error('Submit label is required')",
 *   // ]
 */
export function getCmsValidationHints(blockType: string): string[] {
  const contract = getBlockContract(blockType);
  if (!contract) return [];

  const hints: string[] = [];

  for (const field of contract.required) {
    if (field.type === "array" && field.minItems) {
      hints.push(
        `${field.name}: Rule.required().min(${field.minItems}).error('${field.description} — minimum ${field.minItems} item(s)')`,
      );
    } else {
      hints.push(
        `${field.name}: Rule.required().error('${field.description}')`,
      );
    }
  }

  for (const rule of contract.rules ?? []) {
    hints.push(`// Custom rule "${rule.id}": ${rule.description}`);
  }

  return hints;
}

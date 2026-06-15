/**
 * Context-slot block-type recognition (Statamic page_blocks Replicator).
 *
 * A Context Slot can appear under two set-handles, both carrying the same
 * slot_type / variant_key / is_active / enabled contract:
 *
 *   context_slot     — legacy / hand-built set (imports the mrc_context_slot fieldset)
 *   mc_context_slot  — platform-provisioned set (imports the mc_context_slot fieldset
 *                      written by `php please mc:sync`)
 *
 * The runtime treats them identically. Centralising the check here keeps every
 * gate consistent: the page-blocks → sections mapper, the provider's variant-
 * catalogue filter, and the preview/contact context-config builders.
 */
export const CONTEXT_SLOT_BLOCK_TYPES = ["context_slot", "mc_context_slot"] as const;

/**
 * True when a raw page_blocks `type` value denotes a Context Slot set.
 * Accepts the plain string handle (REST API / on-disk YAML). Augmented objects
 * from the CP live-preview postMessage are normalised to a string by the caller
 * before reaching this check, so a non-string input safely returns false.
 */
export function isContextSlotBlockType(type: unknown): boolean {
  return typeof type === "string"
    && (CONTEXT_SLOT_BLOCK_TYPES as readonly string[]).includes(type);
}

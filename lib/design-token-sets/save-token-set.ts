/**
 * save-token-set
 *
 * The validate-then-store core behind the design-token-set save/update server
 * actions, split out so it can be unit-tested without an auth session. Tokens
 * are validated with validateDesignTokenUpload before being written, so a set
 * always stores a known-good upload payload. The normalized tokens from the
 * validator are what gets stored.
 */

import { upsertDesignTokenSet } from "./design-token-sets-store";
import type { DesignTokenSet } from "./design-token-sets-store";

/**
 * The token-upload validator, injected by the caller. Matches the shape of
 * validateDesignTokenUpload (tenant/design-token-validator.ts). It is injected
 * rather than imported here so this module (and its tests) do not pull in the
 * validator's heavy theme-config import chain.
 */
export type TokenValidator = (raw: unknown) =>
  | { ok: true; tokens: unknown }
  | { ok: false; errors: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = { from: (table: string) => any };

export interface SaveTokenSetInput {
  /** Present for an update (rename / edit); absent for a create. */
  id?:                 string;
  /** null = platform-wide set; a tenant id = tenant-scoped set. */
  tenantId:            string | null;
  name:                string;
  /** Raw token upload payload (untrusted; validated here). */
  tokens:              unknown;
  baseTheme?:          string | null;
  typographyOverride?: Record<string, unknown> | null;
}

export type SaveTokenSetResult =
  | { ok: true;  id: string }
  | { ok: false; errors: string[] };

/**
 * Validate a token payload and upsert it as a design token set. Returns the
 * validation errors when the payload is invalid; nothing is written in that
 * case.
 */
export async function saveTokenSet(
  input:    SaveTokenSetInput,
  validate: TokenValidator,
  db?:      DbLike,
): Promise<SaveTokenSetResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, errors: ["A name is required."] };

  const validation = validate(input.tokens);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const res = await upsertDesignTokenSet(
    {
      ...(input.id ? { id: input.id } : {}),
      tenantId:           input.tenantId,
      name,
      tokens:             validation.tokens as unknown as Record<string, unknown>,
      baseTheme:          input.baseTheme ?? null,
      typographyOverride: input.typographyOverride ?? null,
    },
    db,
  );

  if (!res.ok) return { ok: false, errors: [res.error] };
  return { ok: true, id: res.id };
}

/**
 * Build the token upload payload to apply for a stored set: its `tokens` plus
 * the optional `base_theme` / `typography_override` columns folded into the
 * upload's `theme` / `typography` fields (without clobbering values the tokens
 * already carry). The result is passed to the existing applyDesignTokensAction.
 */
export function tokenSetToUploadPayload(set: DesignTokenSet): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...set.tokens };

  if (set.baseTheme && payload.theme === undefined) {
    payload.theme = set.baseTheme;
  }
  if (set.typographyOverride && Object.keys(set.typographyOverride).length > 0) {
    const existing = (payload.typography as Record<string, unknown> | undefined) ?? {};
    payload.typography = { ...existing, ...set.typographyOverride };
  }

  return payload;
}

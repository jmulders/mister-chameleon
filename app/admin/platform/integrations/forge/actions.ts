/**
 * Forge Integration — Server Actions
 *
 * Thin wrappers around platform/platform-store for the
 * /admin/platform/integrations/forge page.
 *
 * ─── Security contract ────────────────────────────────────────────────────────
 *
 *   Reads strip the apiKey before returning; only `hasApiKey` (boolean) is
 *   returned to the caller.  Non-secret fields (defaultServerId, gitRepository,
 *   gitBranch, phpVersion) are returned as-is.
 *
 *   Writes accept the apiKey but never echo it back.
 *
 * ─── Test connection ──────────────────────────────────────────────────────────
 *
 *   testForgeConnectionAction calls the Forge /servers endpoint to verify
 *   the stored API token is valid.  Returns server count on success.
 */

"use server";

import { revalidatePath }             from "next/cache";
import {
  getPlatformForgeSettings,
  savePlatformForgeSettings,
  forgeFlags,
}                                     from "@/platform/platform-store";

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Load Forge integration status, stripped of secrets.
 */
export async function getPlatformForgeSettingsAction(): Promise<
  | {
      ok:             true;
      hasApiKey:      boolean;
      defaultServerId: number | null;
      gitRepository:  string;
      gitBranch:      string;
      phpVersion:     string;
      isConfigured:   boolean;
      updatedAt:      string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformForgeSettings();
  if (!result.ok) return result;

  const flags = forgeFlags(result.data);

  return {
    ok:              true,
    hasApiKey:       flags.hasApiKey,
    defaultServerId: flags.defaultServerId,
    gitRepository:   flags.gitRepository,
    gitBranch:       flags.gitBranch,
    phpVersion:      flags.phpVersion,
    isConfigured:    flags.isConfigured,
    updatedAt:       result.updatedAt,
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Save Forge integration settings.
 *
 * Pass `apiKey: ""` to clear the stored token.
 * Pass `apiKey: undefined` to leave the existing token untouched.
 * Same semantics apply to other fields.
 */
export async function savePlatformForgeSettingsAction(input: {
  apiKey?:          string;
  defaultServerId?: number | null;
  gitRepository?:   string;
  gitBranch?:       string;
  phpVersion?:      string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey          = input.apiKey          !== undefined ? input.apiKey.trim() : undefined;
  const gitRepository   = input.gitRepository   !== undefined ? input.gitRepository.trim() : undefined;
  const gitBranch       = input.gitBranch       !== undefined ? input.gitBranch.trim() : undefined;
  const phpVersion      = input.phpVersion      !== undefined ? input.phpVersion.trim() : undefined;
  const defaultServerId = input.defaultServerId;

  const MAX_LEN = 512;
  for (const [field, value] of [
    ["API key",        apiKey],
    ["Git repository", gitRepository],
    ["Git branch",     gitBranch],
    ["PHP version",    phpVersion],
  ] as [string, string | undefined][]) {
    if (value !== undefined && value.length > MAX_LEN) {
      return { ok: false, error: `${field} must be ${MAX_LEN} characters or fewer.` };
    }
  }

  const result = await savePlatformForgeSettings({
    apiKey,
    defaultServerId: defaultServerId ?? undefined,
    gitRepository,
    gitBranch,
    phpVersion,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/forge");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── Test connection ────────────────────────────────────────────────────────────

/**
 * Ping the Forge API with the stored API token.
 * Lists servers to verify authentication and returns the server count.
 */
export async function testForgeConnectionAction(): Promise<
  | { ok: true;  serverCount: number; message: string }
  | { ok: false; error: string }
> {
  const result = await getPlatformForgeSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const apiKey = result.data.apiKey ?? process.env["FORGE_API_TOKEN"] ?? "";
  if (!apiKey) {
    return { ok: false, error: "No API token configured. Save an API token first." };
  }

  try {
    const resp = await fetch("https://forge.laravel.com/api/v1/servers", {
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        Accept:         "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { message?: string };
      return {
        ok:    false,
        error: body?.message ?? `Forge API returned HTTP ${resp.status}`,
      };
    }

    const body = await resp.json() as { servers?: unknown[] };
    const serverCount = body.servers?.length ?? 0;

    return {
      ok:          true,
      serverCount,
      message:     `Connected — ${serverCount} server${serverCount === 1 ? "" : "s"} found`,
    };
  } catch (err) {
    return {
      ok:    false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── List servers ───────────────────────────────────────────────────────────────

/**
 * Return a list of available Forge servers (id + name) for the server-selector
 * dropdown in the deploy panel.
 */
export async function listForgeServersAction(): Promise<
  | { ok: true;  servers: { id: number; name: string; ip: string; status: string }[] }
  | { ok: false; error: string }
> {
  const result = await getPlatformForgeSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const apiKey = result.data.apiKey ?? process.env["FORGE_API_TOKEN"] ?? "";
  if (!apiKey) {
    return { ok: false, error: "Forge API token not configured." };
  }

  try {
    const resp = await fetch("https://forge.laravel.com/api/v1/servers", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept:        "application/json",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { message?: string };
      return { ok: false, error: body?.message ?? `Forge API returned HTTP ${resp.status}` };
    }

    const body = await resp.json() as { servers?: Array<{ id: number; name: string; ip_address: string; status: string }> };
    const servers = (body.servers ?? []).map((s) => ({
      id:     s.id,
      name:   s.name,
      ip:     s.ip_address,
      status: s.status,
    }));

    return { ok: true, servers };
  } catch (err) {
    return {
      ok:    false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

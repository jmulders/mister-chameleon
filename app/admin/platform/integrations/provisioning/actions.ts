/**
 * Provisioning Integration — Server Actions
 *
 * Manages the GitHub + Ploi Cloud credentials used to auto-create per-tenant
 * CMS repos and Ploi applications. Secret-safe: tokens are never echoed back —
 * only `hasToken` booleans + non-secret config cross the server→client boundary.
 */

"use server";

import { revalidatePath } from "next/cache";
import {
  getPlatformGithubSettings, savePlatformGithubSettings, githubFlags, resolveGithubToken,
  getPlatformPloiSettings,   savePlatformPloiSettings,   ploiFlags,   resolvePloiToken,
} from "@/platform/platform-store";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";

export interface ProvisioningStatus {
  ok: true;
  github: ReturnType<typeof githubFlags> & { updatedAt: string | null };
  ploi:   ReturnType<typeof ploiFlags>   & { updatedAt: string | null };
}

export async function getProvisioningSettingsAction(): Promise<
  ProvisioningStatus | { ok: false; error: string }
> {
  await getRequiredAdminSession();
  const [gh, ploi] = await Promise.all([getPlatformGithubSettings(), getPlatformPloiSettings()]);
  if (!gh.ok)   return { ok: false, error: gh.error };
  if (!ploi.ok) return { ok: false, error: ploi.error };
  return {
    ok: true,
    github: { ...githubFlags(gh.data), updatedAt: gh.updatedAt },
    ploi:   { ...ploiFlags(ploi.data), updatedAt: ploi.updatedAt },
  };
}

export async function saveGithubSettingsAction(input: {
  token?:         string;
  templateOwner?: string;
  templateRepo?:  string;
  repoOwner?:     string;
  privateRepos?:  boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const result = await savePlatformGithubSettings({
    token:         input.token         !== undefined ? input.token.trim()         : undefined,
    templateOwner: input.templateOwner !== undefined ? input.templateOwner.trim() : undefined,
    templateRepo:  input.templateRepo  !== undefined ? input.templateRepo.trim()  : undefined,
    repoOwner:     input.repoOwner      !== undefined ? input.repoOwner.trim()     : undefined,
    privateRepos:  input.privateRepos,
  });
  if (!result.ok) return result;
  revalidatePath("/admin/platform/integrations/provisioning");
  return { ok: true };
}

export async function savePloiSettingsAction(input: {
  apiToken?:       string;
  team?:           string;
  phpVersion?:     string;
  platformApiUrl?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();
  const result = await savePlatformPloiSettings({
    apiToken:       input.apiToken       !== undefined ? input.apiToken.trim()       : undefined,
    team:           input.team           !== undefined ? input.team.trim()           : undefined,
    phpVersion:     input.phpVersion     !== undefined ? input.phpVersion.trim()     : undefined,
    platformApiUrl: input.platformApiUrl !== undefined ? input.platformApiUrl.trim() : undefined,
  });
  if (!result.ok) return result;
  revalidatePath("/admin/platform/integrations/provisioning");
  return { ok: true };
}

/** Verify the GitHub token by hitting /user. */
export async function testGithubConnectionAction(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  await getRequiredAdminSession();
  const gh = await getPlatformGithubSettings();
  if (!gh.ok) return { ok: false, error: gh.error };
  const token = resolveGithubToken(gh.data);
  if (!token) return { ok: false, error: "No GitHub token configured (and no GITHUB_TOKEN env)." };
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "mc-provisioner" },
      cache: "no-store",
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { message?: string };
      return { ok: false, error: b.message ?? `GitHub API returned HTTP ${res.status}` };
    }
    const b = await res.json() as { login?: string };
    return { ok: true, message: `Connected as ${b.login ?? "unknown"}.` };
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Verify the Ploi token with a harmless dry-run apply of a no-op (empty metadata). */
export async function testPloiConnectionAction(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  await getRequiredAdminSession();
  const ploi = await getPlatformPloiSettings();
  if (!ploi.ok) return { ok: false, error: ploi.error };
  const token = resolvePloiToken(ploi.data);
  if (!token) return { ok: false, error: "No Ploi Cloud token configured (and no PLOI_CLOUD_TOKEN env)." };
  try {
    // A GET against the apply endpoint or any authed endpoint verifies the token.
    const res = await fetch("https://api.ploi.cloud/api/v1/infrastructure/apply?dry_run=true", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/yaml", Accept: "application/json", "User-Agent": "mc-provisioner" },
      body: "apiVersion: v1\nkind: Infrastructure\nmetadata:\n  name: __conn_test__\n",
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `Ploi Cloud rejected the token (HTTP ${res.status}).` };
    }
    // Any non-auth response (even a validation error) means the token authenticated.
    return { ok: true, message: "Token accepted by Ploi Cloud." };
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

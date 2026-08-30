/**
 * Interest Profiles — Server Actions
 *
 * All mutations to the interest_profiles table go through these validated
 * server actions. The UI calls them from client forms; the server is always
 * the authoritative validator.
 *
 * ─── Action inventory ─────────────────────────────────────────────────────────
 *
 *   listInterestProfilesAction()
 *     Returns all interest profiles (active + inactive) for the admin list.
 *
 *   createInterestProfileAction(input)
 *     Validates and inserts a new profile row.
 *     - key:  URL-safe slug, 1–60 chars (lowercase, alphanumeric, hyphens, underscores)
 *     - name: non-empty, ≤ 80 chars
 *     - description: optional, ≤ 500 chars
 *     - tags: array of { keyword: string (non-empty), weight: number (0.1–10) }
 *     - is_active: defaults to true
 *
 *   updateInterestProfileAction(id, input)
 *     Partially updates a profile. Mutable: name, description, tags, is_active.
 *     Immutable: id, key, created_at.
 *
 *   deleteInterestProfileAction(id)
 *     Permanently removes a profile.
 */

"use server";

import { revalidatePath }             from "next/cache";
import {
  listAllInterestProfiles,
  getInterestProfileById,
  createInterestProfile,
  updateInterestProfile,
  deleteInterestProfile,
  upsertPlatformCatalog,
} from "@/interest-profiles/repository";
import type { InterestProfile, InterestTag } from "@/interest-profiles/types";

// ── Shared result type ────────────────────────────────────────────────────────

export type ProfileActionResult =
  | { ok: true;  profile: InterestProfile }
  | { ok: false; error: string; fieldErrors?: string[] };

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_KEY_LENGTH  = 60;
const MAX_NAME_LENGTH = 80;
const MAX_DESC_LENGTH = 500;
const KEY_PATTERN     = /^[a-z0-9_-]{1,60}$/;

const MIN_TAG_WEIGHT  = 0.1;
const MAX_TAG_WEIGHT  = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateTags(raw: unknown): { tags: InterestTag[]; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(raw)) {
    return { tags: [], errors: ["tags: must be an array"] };
  }

  const tags: InterestTag[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;

    const keyword = typeof item.keyword === "string" ? item.keyword.trim().toLowerCase() : "";
    if (keyword.length === 0) {
      errors.push(`tags[${i}]: keyword is required`);
      continue;
    }

    const weight = Number(item.weight);
    if (isNaN(weight) || weight < MIN_TAG_WEIGHT || weight > MAX_TAG_WEIGHT) {
      errors.push(`tags[${i}]: weight must be between ${MIN_TAG_WEIGHT} and ${MAX_TAG_WEIGHT}`);
      continue;
    }

    tags.push({ keyword, weight: Math.round(weight * 100) / 100 });
  }

  // Check for duplicate keywords.
  const seen = new Set<string>();
  for (const tag of tags) {
    if (seen.has(tag.keyword)) {
      errors.push(`tags: duplicate keyword "${tag.keyword}"`);
    }
    seen.add(tag.keyword);
  }

  return { tags, errors };
}

// ── listInterestProfilesAction ────────────────────────────────────────────────

export async function listInterestProfilesAction(): Promise<
  { ok: true; data: InterestProfile[] } | { ok: false; error: string }
> {
  return listAllInterestProfiles();
}

// ── getInterestProfileByIdAction ──────────────────────────────────────────────

/**
 * Fetches a single interest profile by ID.
 * Used by the edit page so it can load one profile directly instead of
 * fetching all profiles and filtering client-side.
 */
export async function getInterestProfileByIdAction(
  id: string,
): Promise<{ ok: true; data: InterestProfile } | { ok: false; error: string }> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Profile ID is required." };
  }
  return getInterestProfileById(id);
}

// ── createInterestProfileAction ───────────────────────────────────────────────

export async function createInterestProfileAction(
  input: unknown,
): Promise<ProfileActionResult> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid input: expected an object." };
  }

  const raw    = input as Record<string, unknown>;
  const errors: string[] = [];

  // ── key ─────────────────────────────────────────────────────────────────────
  const rawKey = typeof raw.key === "string" ? raw.key.trim().toLowerCase() : "";
  if (rawKey.length === 0) {
    errors.push("key: required");
  } else if (!KEY_PATTERN.test(rawKey)) {
    errors.push(
      `key: 1: ${MAX_KEY_LENGTH} chars; lowercase letters, digits, hyphens, and underscores only`,
    );
  }

  // ── name ─────────────────────────────────────────────────────────────────────
  const rawName = typeof raw.name === "string" ? raw.name.trim() : "";
  if (rawName.length === 0) {
    errors.push("name: required");
  } else if (rawName.length > MAX_NAME_LENGTH) {
    errors.push(`name: must be ≤ ${MAX_NAME_LENGTH} characters`);
  }

  // ── description (optional) ───────────────────────────────────────────────────
  const rawDesc = typeof raw.description === "string" ? raw.description.trim() : "";
  if (rawDesc.length > MAX_DESC_LENGTH) {
    errors.push(`description: must be ≤ ${MAX_DESC_LENGTH} characters`);
  }

  // ── tags ─────────────────────────────────────────────────────────────────────
  const { tags, errors: tagErrors } = validateTags(raw.tags ?? []);
  errors.push(...tagErrors);

  // ── is_active (optional, defaults to true) ───────────────────────────────────
  const isActive = raw.is_active !== false;

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: errors,
    };
  }

  const result = await createInterestProfile({
    key:         rawKey,
    name:        rawName,
    description: rawDesc || null,
    tags,
    is_active:   isActive,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, profile: result.data };
}

// ── updateInterestProfileAction ───────────────────────────────────────────────

export async function updateInterestProfileAction(
  id: string,
  input: unknown,
): Promise<ProfileActionResult> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Profile ID is required." };
  }
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid input: expected an object." };
  }

  const raw    = input as Record<string, unknown>;
  const errors: string[] = [];
  const patch: Record<string, unknown> = {};

  // ── name ─────────────────────────────────────────────────────────────────────
  if ("name" in raw) {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name.length === 0) {
      errors.push("name: required");
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.push(`name: must be ≤ ${MAX_NAME_LENGTH} characters`);
    } else {
      patch.name = name;
    }
  }

  // ── description ──────────────────────────────────────────────────────────────
  if ("description" in raw) {
    const desc = typeof raw.description === "string" ? raw.description.trim() : "";
    if (desc.length > MAX_DESC_LENGTH) {
      errors.push(`description: must be ≤ ${MAX_DESC_LENGTH} characters`);
    } else {
      patch.description = desc || null;
    }
  }

  // ── tags ─────────────────────────────────────────────────────────────────────
  if ("tags" in raw) {
    const { tags, errors: tagErrors } = validateTags(raw.tags);
    if (tagErrors.length > 0) {
      errors.push(...tagErrors);
    } else {
      patch.tags = tags;
    }
  }

  // ── is_active ────────────────────────────────────────────────────────────────
  if ("is_active" in raw) {
    patch.is_active = raw.is_active !== false;
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}).`,
      fieldErrors: errors,
    };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No fields provided to update." };
  }

  const result = await updateInterestProfile(id, patch as Parameters<typeof updateInterestProfile>[1]);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, profile: result.data };
}

// ── deleteInterestProfileAction ───────────────────────────────────────────────

export async function deleteInterestProfileAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Profile ID is required." };
  }

  const result = await deleteInterestProfile(id);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

// ── seedPlatformCatalogAction ─────────────────────────────────────────────────

/**
 * Seeds (or reseeds) the canonical 20-profile platform catalog.
 *
 * Deletes all existing platform-wide profiles (tenant_id IS NULL) and inserts
 * the full catalog from `interest-profiles/catalog.ts`.  Safe to call at any
 * time — tenant-scoped profiles are never touched.
 */
export async function seedPlatformCatalogAction(): Promise<
  { ok: true; inserted: number } | { ok: false; error: string }
> {
  const result = await upsertPlatformCatalog();
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/admin/interest-profiles");
  return { ok: true, inserted: result.data.inserted };
}

/**
 * Form-compatible void wrapper around `seedPlatformCatalogAction`.
 * Used by the `<form action={...}>` in the admin UI; discards the result
 * (the page re-renders via revalidatePath after the catalog is seeded).
 */
export async function seedPlatformCatalogFormAction(): Promise<void> {
  await seedPlatformCatalogAction();
}

"use client";

/**
 * Tenant Admin — Edit Interest Profile
 *
 * Loads a single interest profile by ID and presents the edit form.
 * Only tenant-scoped profiles (tenant_id = tenantId) are editable here.
 * If the profile is platform-wide, a read-only banner is shown with a link
 * to the global admin.
 *
 * ─── Access model ────────────────────────────────────────────────────────────
 *
 *   Tenant-scoped profiles → full edit + delete
 *   Platform-wide profiles → read-only view + redirect link to global admin
 */

import { use }                          from "react";
import { useRouter }                    from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { ProfileForm }                  from "@/app/admin/interest-profiles/_components/ProfileForm";
import {
  getTenantInterestProfileAction,
  updateTenantInterestProfileAction,
  deleteTenantInterestProfileAction,
} from "../actions";
import type { ProfileFormValues } from "@/app/admin/interest-profiles/_components/ProfileForm";
import type { InterestProfile }   from "@/interest-profiles/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Platform-profile read-only banner ─────────────────────────────────────────

function PlatformProfileBanner({ profile }: { profile: InterestProfile }) {
  const ctxVarKey  = profile.key
    .charAt(0).toUpperCase() + profile.key.slice(1)
    .replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
  const ctxVarName = `interest${ctxVarKey}Score`;

  return (
    <div className="p-8 max-w-3xl space-y-4">
      {/* Read-only notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">Platform-wide profile</p>
        <p className="mt-1">
          This profile is managed at the platform level and is inherited by all tenants.
          To edit it, go to the{" "}
          <a
            href={`/admin/interest-profiles/${profile.id}`}
            className="font-medium underline underline-offset-2 hover:text-amber-700"
          >
            global interest profiles admin
          </a>
          .
        </p>
      </div>

      {/* Profile summary */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider text-xs mb-2">Profile</p>
          <p className="text-lg font-semibold text-neutral-900">{profile.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <span>Key: <code className="font-mono text-neutral-600">{profile.key}</code></span>
            <span>·</span>
            <span>Context: <code className="font-mono text-neutral-600">{ctxVarName}</code></span>
            <span>·</span>
            <span className={profile.isActive ? "text-success-600" : "text-neutral-400"}>
              {profile.isActive ? "● Active" : "○ Inactive"}
            </span>
          </div>
          {profile.description && (
            <p className="mt-2 text-sm text-neutral-600">{profile.description}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Keywords</p>
          {profile.tags.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">No keywords</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {profile.tags.map((tag, i) => (
                <span
                  key={`${tag.keyword}-${i}`}
                  className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                >
                  {tag.keyword}
                  <span className="ml-1 text-neutral-400">×{tag.weight}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditTenantInterestProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string; profileId: string }>;
}) {
  const { tenantId, profileId } = use(params);
  const router                  = useRouter();
  const listHref                = `/admin/tenants/${tenantId}/audience/interests`;

  const [profile,       setProfile]       = useState<InterestProfile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting,    startDeleteTrans] = useTransition();

  // Load profile on mount.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getTenantInterestProfileAction(tenantId, profileId);
      if (cancelled) return;

      if (!result.ok) {
        setLoadError(result.error);
      } else {
        setProfile(result.profile);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [tenantId, profileId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSubmit(values: ProfileFormValues) {
    const result = await updateTenantInterestProfileAction(tenantId, profileId, {
      name:        values.name,
      description: values.description,
      tags:        values.tags,
      is_active:   values.is_active,
    });
    if (result.ok) {
      setProfile(result.profile);
    }
    return result;
  }

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    startDeleteTrans(async () => {
      setDeleteError(null);
      const result = await deleteTenantInterestProfileAction(tenantId, profileId);
      if (!result.ok) {
        setDeleteError(result.error);
        setConfirmDelete(false);
      } else {
        router.push(listHref);
      }
    });
  }

  // ── Loading / error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center py-24">
        <svg className="h-6 w-6 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-2xl">
        <a href={listHref} className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700">
          ← Interest profiles
        </a>
        <div className="mt-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3">
          <p className="text-sm font-medium text-error-700">Failed to load profile</p>
          <p className="text-xs text-error-600 mt-0.5">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isPlatform = !profile.tenantId;
  const ctxVarKey  = profile.key
    .charAt(0).toUpperCase() + profile.key.slice(1)
    .replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
  const ctxVarName = `interest${ctxVarKey}Score`;

  return (
    <div className="p-8 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <a
          href={listHref}
          className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← Interest profiles
        </a>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900">{profile.name}</h1>
          <span className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            profile.isActive
              ? "bg-success-50 text-success-700"
              : "bg-neutral-100 text-neutral-500",
          ].join(" ")}>
            {profile.isActive ? "● Active" : "○ Inactive"}
          </span>
          {isPlatform && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Platform
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
          <span>Key: <code className="font-mono text-neutral-600">{profile.key}</code></span>
          <span>·</span>
          <span>Context: <code className="font-mono text-neutral-600">{ctxVarName}</code></span>
          <span>·</span>
          <span>{profile.tags.length} keyword{profile.tags.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── Platform profile: read-only view ─────────────────────────────── */}
      {isPlatform ? (
        <PlatformProfileBanner profile={profile} />
      ) : (
        <>
          {/* ── Editable profile form ─────────────────────────────────────── */}
          <ProfileForm
            profile={profile}
            onSubmit={handleSubmit}
            submitLabel="Save changes"
            cancelHref={listHref}
          />

          {/* ── Danger zone ───────────────────────────────────────────────── */}
          <div className="mt-12 rounded-xl border border-error-200 bg-error-50 p-6">
            <h2 className="text-sm font-semibold text-error-800">Danger zone</h2>
            <p className="mt-1 text-xs text-error-600 max-w-sm">
              Permanently delete this interest profile and all its keyword/weight configuration.
              This cannot be undone. Any context variables derived from this profile will no
              longer be populated for this tenant.
            </p>

            {deleteError && (
              <p className="mt-2 text-xs text-error-700 font-medium">{deleteError}</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className={[
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  confirmDelete
                    ? "bg-error-600 text-white hover:bg-error-700 disabled:opacity-60"
                    : "border border-error-300 bg-white text-error-700 hover:bg-error-100",
                ].join(" ")}
              >
                {isDeleting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting…
                  </>
                ) : confirmDelete ? (
                  "Confirm delete"
                ) : (
                  "Delete profile"
                )}
              </button>
              {confirmDelete && !isDeleting && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm text-error-500 hover:text-error-700 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

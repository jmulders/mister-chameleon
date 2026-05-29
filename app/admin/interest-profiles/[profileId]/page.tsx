"use client";

/**
 * Admin — Edit Interest Profile
 *
 * Loads an existing interest profile by ID and renders the ProfileForm
 * pre-populated with current values. Also provides a delete section for
 * permanently removing the profile.
 *
 * ─── Data loading ─────────────────────────────────────────────────────────────
 *
 *   This is a Client Component (uses useParams, useState, useEffect).
 *   It fetches the profile directly via getInterestProfileByIdAction, which
 *   wraps the repository's getInterestProfileById — one DB round-trip for
 *   the single profile rather than fetching the full catalog.
 */

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { ProfileForm }                         from "../_components/ProfileForm";
import {
  getInterestProfileByIdAction,
  updateInterestProfileAction,
  deleteInterestProfileAction,
} from "../actions";
import type { ProfileFormValues } from "../_components/ProfileForm";
import type { InterestProfile }   from "@/interest-profiles/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditInterestProfilePage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = typeof params.profileId === "string" ? params.profileId : "";

  const [profile,        setProfile]        = useState<InterestProfile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [deleteError,    setDeleteError]    = useState<string | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [isDeleting,     startDeleteTrans]  = useTransition();

  // Load profile on mount — fetches only this profile, not the full catalog
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getInterestProfileByIdAction(id);
      if (cancelled) return;

      if (!result.ok) {
        setLoadError(result.error);
      } else {
        setProfile(result.data);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSubmit(values: ProfileFormValues) {
    // key is immutable — don't send it in the update payload
    const result = await updateInterestProfileAction(id, {
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
      const result = await deleteInterestProfileAction(id);
      if (!result.ok) {
        setDeleteError(result.error);
        setConfirmDelete(false);
      } else {
        router.push("/admin/interest-profiles");
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
        <a href="/admin/interest-profiles" className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700">
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

  // Derive the per-profile context variable name (handles both hyphens and underscores)
  const ctxVarKey = profile.key
    .replace(/[-_](.)/g, (_: string, c: string) => (c as string).toUpperCase())
    .replace(/^(.)/, (c: string) => (c as string).toUpperCase());
  const ctxVarName = `interest${ctxVarKey}Score`;

  return (
    <div className="p-8 max-w-2xl">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <a
          href="/admin/interest-profiles"
          className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← Interest profiles
        </a>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">{profile.name}</h1>
          <span className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            profile.isActive
              ? "bg-success-50 text-success-700"
              : "bg-neutral-100 text-neutral-500",
          ].join(" ")}>
            {profile.isActive ? "● Active" : "○ Inactive"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
          <span>Key: <code className="font-mono text-neutral-600">{profile.key}</code></span>
          <span>·</span>
          <span>Context: <code className="font-mono text-neutral-600">{ctxVarName}</code></span>
          <span>·</span>
          <span>{profile.tags.length} keyword{profile.tags.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── Edit form ────────────────────────────────────────────────────────── */}
      <ProfileForm
        profile={profile}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
        cancelHref="/admin/interest-profiles"
      />

      {/* ── Danger zone ──────────────────────────────────────────────────────── */}
      <div className="mt-12 rounded-xl border border-error-200 bg-error-50 p-6">
        <h2 className="text-sm font-semibold text-error-800">Danger zone</h2>
        <p className="mt-1 text-xs text-error-600 max-w-sm">
          Permanently delete this interest profile and all its keyword/weight configuration.
          This cannot be undone. Any context variables derived from this profile will no longer
          be populated.
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
    </div>
  );
}

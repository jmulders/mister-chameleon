"use client";

/**
 * ProfileForm
 *
 * Shared form component for creating and editing interest profiles.
 * Used by both /admin/interest-profiles/new and /admin/interest-profiles/[profileId].
 *
 * ─── Tag editor ───────────────────────────────────────────────────────────────
 *
 *   Tags are managed as a local array in React state. The operator adds rows
 *   via the "Add keyword" button and removes them with the "×" button.
 *   Each row has a keyword text input and a weight number input (0.1–10, step 0.1).
 *
 * ─── Submission ───────────────────────────────────────────────────────────────
 *
 *   The form calls the provided `onSubmit` async function with the structured
 *   payload. The parent page handles the actual server action call and redirect.
 */

import { useState, useTransition } from "react";
import type { InterestProfile, InterestTag } from "@/interest-profiles/types";
import { AvatarPicker } from "@/components/admin/AvatarPicker";
import type { AdminAvatarConfig } from "@/components/admin/avatar-util";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileFormValues {
  key:         string;  // only used on create; immutable after
  name:        string;
  description: string;
  tags:        Array<{ keyword: string; weight: number }>;
  is_active:   boolean;
  avatar:      AdminAvatarConfig | null;
}

interface ProfileFormProps {
  /**
   * When editing an existing profile, pass it here to pre-populate the form.
   * Omit for the create form.
   */
  profile?:   InterestProfile;
  /** Called when the form is submitted. Return a { ok, error?, fieldErrors? } object. */
  onSubmit:   (values: ProfileFormValues) => Promise<{ ok: boolean; error?: string; fieldErrors?: string[] }>;
  /** Label on the submit button. Defaults to "Save". */
  submitLabel?: string;
  /** Label on the cancel link. Defaults to "Cancel". */
  cancelHref?: string;
}

// ── Tag row ───────────────────────────────────────────────────────────────────

interface TagRowProps {
  tag:      { keyword: string; weight: number };
  index:    number;
  onChange: (index: number, field: "keyword" | "weight", value: string) => void;
  onRemove: (index: number) => void;
}

function TagRow({ tag, index, onChange, onRemove }: TagRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={tag.keyword}
        onChange={(e) => onChange(index, "keyword", e.target.value)}
        placeholder="keyword"
        className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-neutral-500 whitespace-nowrap">weight</label>
        <input
          type="number"
          value={tag.weight}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => onChange(index, "weight", e.target.value)}
          className="w-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-error-50 hover:text-error-600 transition-colors"
        aria-label="Remove keyword"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── ProfileForm ───────────────────────────────────────────────────────────────

export function ProfileForm({
  profile,
  onSubmit,
  submitLabel = "Save",
  cancelHref  = "/admin/interest-profiles",
}: ProfileFormProps) {
  const isEditing = !!profile;

  // ── Local state ─────────────────────────────────────────────────────────────

  const [key,         setKey]         = useState(profile?.key         ?? "");
  const [name,        setName]        = useState(profile?.name        ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [isActive,    setIsActive]    = useState(profile?.isActive    ?? true);
  const [avatar,      setAvatar]      = useState<AdminAvatarConfig | null>(profile?.avatar ?? null);
  const [tags,        setTags]        = useState<Array<{ keyword: string; weight: number }>>(
    profile?.tags ? [...profile.tags] : [],
  );

  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isPending,   startTransition] = useTransition();

  // ── Tag handlers ─────────────────────────────────────────────────────────────

  function handleTagChange(index: number, field: "keyword" | "weight", value: string) {
    setTags((prev) => {
      const next = [...prev];
      if (field === "keyword") {
        next[index] = { ...next[index], keyword: value };
      } else {
        next[index] = { ...next[index], weight: parseFloat(value) || 1 };
      }
      return next;
    });
  }

  function handleTagRemove(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTagAdd() {
    setTags((prev) => [...prev, { keyword: "", weight: 1 }]);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors([]);

    startTransition(async () => {
      const result = await onSubmit({
        avatar,
        key:         key.trim().toLowerCase(),
        name:        name.trim(),
        description: description.trim(),
        tags,
        is_active:   isActive,
      });

      if (!result.ok) {
        setError(result.error ?? "An unexpected error occurred.");
        setFieldErrors(result.fieldErrors ?? []);
      }
      // On success, the parent page handles redirect
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3">
          <p className="text-sm font-medium text-error-700">{error}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              {fieldErrors.map((fe, i) => (
                <li key={i} className="text-xs text-error-600">{fe}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Key (create only) ────────────────────────────────────────────────── */}
      {!isEditing && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-900">
            Profile key <span className="text-error-500">*</span>
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. logistics"
            pattern="[a-z0-9_-]{1,60}"
            required
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="text-xs text-neutral-400">
            URL-safe slug — lowercase letters, digits, hyphens, and underscores. Immutable after creation.
            This becomes the per-profile context variable:{" "}
            <code className="font-mono bg-neutral-100 px-1 rounded text-neutral-600">
              interest{key
                ? key
                    .replace(/[-_](.)/g, (_: string, c: string) => (c as string).toUpperCase())
                    .replace(/^(.)/, (c: string) => (c as string).toUpperCase())
                : "KeyScore"}Score
            </code>
          </p>
        </div>
      )}

      {/* ── Name ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-900">
          Name <span className="text-error-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Logistics & Supply Chain"
          maxLength={80}
          required
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="text-xs text-neutral-400">Human-readable label shown in admin UI and debug views.</p>
      </div>

      {/* ── Description ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-900">
          Description <span className="text-neutral-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this interest profile represents and when it activates…"
          rows={3}
          maxLength={500}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
        />
      </div>

      {/* ── Avatar ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-900">
          Avatar <span className="text-neutral-400 font-normal">(optional)</span>
        </label>
        <AvatarPicker value={avatar} onChange={setAvatar} name={name} seed={key} />
      </div>

      {/* ── Status ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive((v) => !v)}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
            isActive ? "bg-brand-600" : "bg-neutral-200",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
              isActive ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
        <span className="text-sm font-medium text-neutral-900">
          {isActive ? "Active" : "Inactive"}
        </span>
        <span className="text-xs text-neutral-400">
          {isActive
            ? "This profile is evaluated by the scoring engine on every page request."
            : "This profile is skipped by the scoring engine."}
        </span>
      </div>

      {/* ── Tags ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium text-neutral-900">
            Keywords &amp; weights
          </label>
          <p className="mt-0.5 text-xs text-neutral-400">
            These must match the <code className="font-mono bg-neutral-100 px-1 rounded">metaKeywords</code> set
            on CMS pages (case-insensitive). Higher weight = stronger signal.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {tags.length === 0 && (
            <p className="text-sm text-neutral-400 italic py-2">
              No keywords yet. Add at least one to start scoring visitors.
            </p>
          )}
          {tags.map((tag, i) => (
            <TagRow
              key={i}
              tag={tag}
              index={i}
              onChange={handleTagChange}
              onRemove={handleTagRemove}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleTagAdd}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add keyword
        </button>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : submitLabel}
        </button>
        <a
          href={cancelHref}
          className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

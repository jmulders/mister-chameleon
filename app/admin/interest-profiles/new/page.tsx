"use client";

/**
 * Admin — New Interest Profile
 *
 * Form page for creating a new interest profile.
 * Calls createInterestProfileAction on submit and redirects to
 * /admin/interest-profiles on success.
 */

import { useRouter }       from "next/navigation";
import { ProfileForm }     from "../_components/ProfileForm";
import { createInterestProfileAction } from "../actions";
import type { ProfileFormValues } from "../_components/ProfileForm";

export default function NewInterestProfilePage() {
  const router = useRouter();

  async function handleSubmit(values: ProfileFormValues) {
    const result = await createInterestProfileAction(values);
    if (result.ok) {
      router.push("/admin/interest-profiles");
    }
    return result;
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <a
          href="/admin/interest-profiles"
          className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← Interest profiles
        </a>
        <h1 className="text-2xl font-bold text-neutral-900">New interest profile</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Define a named interest area with keywords and weights. The scoring engine
          will accumulate visitor keyword clouds and score them against this profile.
        </p>
      </div>

      <ProfileForm
        onSubmit={handleSubmit}
        submitLabel="Create profile"
        cancelHref="/admin/interest-profiles"
      />
    </div>
  );
}

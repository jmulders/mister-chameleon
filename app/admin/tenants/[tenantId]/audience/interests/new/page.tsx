"use client";

/**
 * Tenant Admin — New Interest Profile
 *
 * Form page for creating a new tenant-scoped interest profile.
 * Calls createTenantInterestProfileAction on submit and redirects back to the
 * tenant's interest profiles list on success.
 */

import { use }          from "react";
import { useRouter }    from "next/navigation";
import { ProfileForm }  from "@/app/admin/interest-profiles/_components/ProfileForm";
import { createTenantInterestProfileAction } from "../actions";
import type { ProfileFormValues } from "@/app/admin/interest-profiles/_components/ProfileForm";

export default function NewTenantInterestProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const router       = useRouter();
  const listHref     = `/admin/tenants/${tenantId}/audience/interests`;

  async function handleSubmit(values: ProfileFormValues) {
    const result = await createTenantInterestProfileAction(tenantId, values);
    if (result.ok) {
      router.push(listHref);
    }
    return result;
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <a
          href={listHref}
          className="mb-3 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← Interest profiles
        </a>
        <h1 className="text-xl font-semibold text-neutral-900">New interest profile</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Define a tenant-specific interest area with keywords and weights.
          This profile will be evaluated alongside platform-wide profiles at runtime.
        </p>
      </div>

      <ProfileForm
        onSubmit={handleSubmit}
        submitLabel="Create profile"
        cancelHref={listHref}
      />
    </div>
  );
}

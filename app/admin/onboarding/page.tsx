/**
 * Admin — New Tenant Onboarding
 *
 * Route: /admin/onboarding
 *
 * Provides a simple create-tenant form using the onboarding intake model.
 * Delegates all state, validation feedback, and action calls to the
 * OnboardingForm client component.
 *
 * This page is a lightweight Server Component shell — no data fetching
 * required because the form derives its options from pure package constants
 * at render time.
 */

import { Text } from "@/components/primitives/Text";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = {
  title: "New Tenant: Admin",
};

export default function AdminOnboardingPage() {
  return (
    <div className="p-8">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <Text variant="h2">Create new tenant</Text>
        <Text variant="body-sm" color="muted" className="mt-1">
          Complete the intake fields below to create a new client tenant.
          Settings are derived from the chosen package and can be refined on
          the tenant detail page after creation.
        </Text>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <OnboardingForm />
    </div>
  );
}

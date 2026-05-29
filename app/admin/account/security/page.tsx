import { cookies }    from "next/headers";
import { redirect }   from "next/navigation";
import {
  verifySession,
  ADMIN_TOKEN_COOKIE,
} from "@/lib/admin-auth/session";
import { findAdminUserById } from "@/data/admin-auth";
import { TwoFactorSetupPanel } from "./TwoFactorSetupPanel";

/**
 * Security Settings Page — /admin/account/security
 *
 * Displays the current 2FA status for the signed-in admin user and renders
 * the appropriate panel:
 *
 *   • 2FA disabled: shows the "Enable 2FA" setup flow (QR code, verification).
 *   • 2FA enabled:  shows management options (disable, regenerate backup codes).
 *
 * The interactive parts (forms, QR code reveal, backup code display) live in
 * TwoFactorSetupPanel, a Client Component that calls Server Actions.
 */

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function SecuritySettingsPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  const session     = token ? await verifySession(token) : null;
  if (!session) redirect("/admin/login");

  const user = await findAdminUserById(session.sub);
  if (!user) redirect("/admin/login");

  // ── Flash messages ────────────────────────────────────────────────────────
  const errorMessages: Record<string, string> = {
    invalid_code: "That code was incorrect or has expired.",
    no_2fa:       "2FA is not currently enabled on your account.",
  };
  const successMessages: Record<string, string> = {
    "2fa_disabled": "Two-factor authentication has been disabled.",
  };

  const errorMessage   = error   ? (errorMessages[error]     ?? "An error occurred.")    : null;
  const successMessage = success ? (successMessages[success]  ?? null)                    : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Security settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage two-factor authentication for your admin account.
        </p>
      </div>

      {/* Flash banners */}
      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* Account info */}
      <section className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-medium text-neutral-700">Signed in as</p>
        <p className="mt-1 text-base font-semibold text-neutral-900">{user.name}</p>
        <p className="text-sm text-neutral-500">{user.email}</p>
      </section>

      {/* 2FA panel */}
      <TwoFactorSetupPanel
        twoFaEnabled={user.two_factor_enabled}
        backupCodeCount={user.two_factor_backup_codes?.length ?? 0}
      />
    </div>
  );
}

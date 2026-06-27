/**
 * Admin — Tenant Workspace › Integrations › Calendar
 *
 * Per-tenant Google Calendar booking config. Authentication uses the shared
 * platform service account; this page only sets which calendar to book into
 * and its working hours. Reachable at
 * /admin/tenants/[tenantId]/integrations/calendar.
 */

import Link               from "next/link";
import { notFound }        from "next/navigation";
import { getTenantCalendarSettingsAction } from "./actions";
import { TenantCalendarClient }            from "./_components/TenantCalendarClient";

export default async function TenantCalendarPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const result = await getTenantCalendarSettingsAction(tenantId);
  if (!result.ok) notFound();

  const { config, platformServiceAccountEmail, platformConfigured } = result.data;

  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div>
        <Link
          href={`/admin/tenants/${tenantId}/integrations`}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Integrations
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Calendar booking</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Let visitors of{" "}
          <code className="font-mono text-xs">{tenantId}</code> book an appointment into
          this tenant&apos;s own Google Calendar. Credentials are shared from{" "}
          <Link href="/admin/platform/integrations/calendar" className="underline hover:text-neutral-800">
            Platform → Integrations → Calendar
          </Link>
          .
        </p>
      </div>

      <TenantCalendarClient
        tenantId={tenantId}
        initial={config}
        platformServiceAccountEmail={platformServiceAccountEmail}
        platformConfigured={platformConfigured}
      />
    </div>
  );
}

import { getGoogleCalendarSettingsAction, saveGoogleCalendarSettingsAction, clearGoogleCalendarSettingsAction } from "./actions";
import { GoogleCalendarClient } from "./_components/GoogleCalendarClient";

export default async function GoogleCalendarIntegrationPage() {
  const result = await getGoogleCalendarSettingsAction();

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Platform — Google Calendar</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Service Account credentials voor de demo-boekingspagina (<code>/book-demo</code>).
          Slotvragen checken automatisch je agenda op bezette tijden.
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Veilig opgeslagen.</strong>{" "}
        De private key wordt versleuteld opgeslagen (AES-256-GCM) en nooit teruggestuurd naar de browser.
        Env vars (<code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> etc.) werken als fallback maar zijn niet meer nodig.
      </div>

      {!result.ok ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Fout bij laden:</strong> {result.error}
        </div>
      ) : (
        <GoogleCalendarClient
          initialConfig={result.config}
          onSave={saveGoogleCalendarSettingsAction}
          onClear={clearGoogleCalendarSettingsAction}
        />
      )}
    </div>
  );
}

/**
 * DailyCronPanel — when the daily cron last ran and what each job did.
 *
 * Server component. A cron that stops is silent by nature; this is the place
 * where its silence shows.
 */

import { dailyRunHealth, type DailyRunRecord, type DailyRunState } from "@/lib/cron/daily-run";

const HEADLINE: Record<DailyRunState, string> = {
  never:  "No run on record",
  stale:  "The last run is too long ago",
  failed: "The last run had failures",
  ok:     "The last run went well",
};

const EXPLANATION: Record<DailyRunState, string> = {
  never:
    "The daily cron has not reported in since this panel was added. If this still says so the morning after a deploy, the cron is not reaching the app.",
  stale:
    "The cron should run every night at 03:00 UTC. Retention purges, renewals and the ad sync have not run since.",
  failed:
    "At least one job did not finish. The jobs below show which one and why.",
  ok:
    "Every job finished.",
};

const TONE: Record<DailyRunState, string> = {
  never:  "border-amber-200 bg-amber-50 text-amber-900",
  stale:  "border-red-200 bg-red-50 text-red-900",
  failed: "border-red-200 bg-red-50 text-red-900",
  ok:     "border-green-200 bg-green-50 text-green-900",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Hours up to two days, whole days after that. */
export function formatAge(ageHours: number): string {
  if (ageHours < 48) return `${ageHours} ${ageHours === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(ageHours / 24)} days ago`;
}

function formatSummary(summary: Record<string, number | boolean> | undefined): string {
  if (!summary) return "";
  return Object.entries(summary)
    .filter(([key]) => key !== "durationMs")
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
}

export function DailyCronPanel({ record, nowMs }: { record: DailyRunRecord | null; nowMs: number }) {
  const health = dailyRunHealth(record, nowMs);

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border px-4 py-3 text-sm ${TONE[health.state]}`} data-state={health.state}>
        <p className="font-semibold">{HEADLINE[health.state]}</p>
        <p className="mt-1">
          {record && health.ageHours !== null && <>Finished {formatWhen(record.finishedAt)}, {formatAge(health.ageHours)}. </>}
          {EXPLANATION[health.state]}
        </p>
      </div>

      {(health.state === "never" || health.state === "stale") && (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>Vercel, project, Settings, Cron Jobs: is <code>/api/cron/daily</code> listed and enabled?</li>
          <li>Press Run there and open the log of that run. A 401 means <code>CRON_SECRET</code> is not set in the production environment variables.</li>
          <li>A 500 means the cron arrived and a job failed. Reload this page to see which.</li>
        </ol>
      )}

      {record && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-4 font-medium">Job</th>
                <th className="py-2 pr-4 font-medium">Result</th>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {record.results.map((job) => (
                <tr key={job.path} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs text-neutral-700">{job.path.replace("/api/cron/", "")}</td>
                  <td className={`py-2 pr-4 font-medium ${job.ok ? "text-green-700" : "text-red-700"}`}>
                    {job.ok ? "Done" : "Failed"}
                  </td>
                  <td className="py-2 pr-4 text-neutral-600">{job.durationMs} ms</td>
                  <td className="py-2 text-neutral-600">{job.error ?? formatSummary(job.summary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

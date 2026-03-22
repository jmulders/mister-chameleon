import Link from "next/link";
import { listRecentSessions } from "@/data/repositories/analytics-repository";
import type { SessionRow } from "@/data/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";

/**
 * Dashboard — Sessions List
 *
 * Displays the 50 most recent visitor sessions in a scannable table.
 * Each row links through to the session detail page.
 * Server Component — data fetched at request time.
 */
export const metadata = { title: "Sessions · Dashboard" };

const PAGE_SIZE = 50;

export default async function DashboardSessionsPage() {
  const result = await listRecentSessions(PAGE_SIZE, 0);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <PageHeader total={null} showing={0} />
        <DbError message={result.error} />
      </div>
    );
  }

  const { sessions, total } = result.data;

  return (
    <div className="flex flex-col gap-6 px-8 py-8">
      <PageHeader total={total} showing={sessions.length} />

      {sessions.length === 0 ? (
        <Card padding="lg" shadow="none" className="border-dashed">
          <CardContent className="py-12 text-center">
            <Text variant="body-sm" color="muted">
              No sessions recorded yet. Visit the homepage to generate the first
              one.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <Card padding="none" shadow="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Session ID
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Created
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Source
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Device
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Visit
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500">
                    Path
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="border-t border-neutral-100 px-4 py-3">
              <Text variant="caption" color="muted">
                Showing {PAGE_SIZE} of {total.toLocaleString()} sessions.
                Pagination coming soon.
              </Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader({
  total,
  showing,
}: {
  total: number | null;
  showing: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <Text variant="h2" as="h1">
          Sessions
        </Text>
        <Text variant="body-sm" color="muted">
          {total === null
            ? "Could not load session count."
            : total === 0
              ? "No sessions recorded yet."
              : `Showing ${showing} of ${total.toLocaleString()} sessions, newest first.`}
        </Text>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: SessionRow }) {
  return (
    <tr className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Session ID — truncated, links to detail */}
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/sessions/${session.id}`}
          className="font-mono text-xs text-brand-600 hover:text-brand-800 hover:underline"
          title={session.id}
        >
          {session.id.slice(0, 8)}&hellip;
        </Link>
      </td>

      {/* Created at */}
      <td className="px-4 py-3 text-xs text-neutral-500 tabular-nums whitespace-nowrap">
        <time dateTime={session.created_at}>
          {formatDate(session.created_at)}
        </time>
      </td>

      {/* Source */}
      <td className="px-4 py-3">
        <SourceBadge source={session.source} />
      </td>

      {/* Device */}
      <td className="px-4 py-3">
        <Badge
          variant={session.device === "mobile" ? "default" : "outline"}
          size="sm"
        >
          {session.device}
        </Badge>
      </td>

      {/* Visit type */}
      <td className="px-4 py-3">
        <Badge
          variant={session.visit_type === "new" ? "success" : "default"}
          size="sm"
        >
          {session.visit_type}
        </Badge>
      </td>

      {/* Pathname */}
      <td className="px-4 py-3 font-mono text-xs text-neutral-500">
        {session.pathname}
      </td>
    </tr>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, "primary" | "default" | "warning" | "outline"> = {
    linkedin: "primary",
    google: "warning",
    direct: "default",
  };
  const variant = map[source] ?? "outline";
  return (
    <Badge variant={variant} size="sm">
      {source}
    </Badge>
  );
}

function DbError({ message }: { message: string }) {
  return (
    <Card padding="md" shadow="none" className="border-red-200 bg-red-50">
      <CardContent>
        <Text variant="body-sm" className="text-red-700">
          <strong>Database error.</strong> {message}
        </Text>
      </CardContent>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats an ISO timestamp as a compact, readable date+time string.
 * Uses UTC to keep server and client renders consistent.
 */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchSessionDetail } from "@/data/repositories/analytics-repository";
import type { SessionRow, ServedVariantRow, EventRow } from "@/data/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";

/**
 * Session Detail Page
 *
 * Renders three data panels for a single visitor session:
 *   1. Context        — the stored SessionRow fields
 *   2. Served Variants — the hero/proof/cta keys and the decision reason
 *   3. Events         — chronological event log with payload display
 *
 * Falls back to `notFound()` when the session id doesn't exist.
 * Server Component — all data fetched at request time.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Session ${id.slice(0, 8)} · Dashboard` };
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const result = await fetchSessionDetail(id);

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-8 py-8">
        <BackLink />
        <Card padding="md" shadow="none" className="border-red-200 bg-red-50">
          <CardContent>
            <Text variant="body-sm" className="text-red-700">
              <strong>Database error.</strong> {result.error}
            </Text>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result.data) {
    notFound();
  }

  const { session, variants, events } = result.data;

  return (
    <div className="flex flex-col gap-6 px-8 py-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <BackLink />
        <div className="flex items-baseline gap-3">
          <Text variant="h2" as="h1">
            Session
          </Text>
          <code className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-sm text-neutral-600">
            {session.id}
          </code>
        </div>
        <Text variant="body-sm" color="muted">
          Created{" "}
          <time dateTime={session.created_at}>
            {formatDateTime(session.created_at)}
          </time>
        </Text>
      </div>

      {/* Three panels */}
      <div className="flex flex-col gap-6">
        <ContextPanel session={session} />
        <VariantsPanel variants={variants} />
        <EventsPanel events={events} />
        <AIPanel />
      </div>
    </div>
  );
}

// ── Back link ─────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/dashboard/sessions"
      className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
    >
      <span aria-hidden>←</span> All sessions
    </Link>
  );
}

// ── Context panel ─────────────────────────────────────────────────────────────

function ContextPanel({ session }: { session: SessionRow }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "source",      value: <SourceBadge source={session.source} /> },
    { label: "device",      value: <Badge variant="outline" size="sm">{session.device}</Badge> },
    { label: "visit_type",  value: (
        <Badge variant={session.visit_type === "new" ? "success" : "default"} size="sm">
          {session.visit_type}
        </Badge>
      ),
    },
    { label: "pathname",    value: <MonoValue>{session.pathname}</MonoValue> },
    { label: "referrer",    value: session.referrer
        ? <MonoValue truncate>{session.referrer}</MonoValue>
        : <NullValue /> },
    { label: "utm_source",  value: session.utm_source  ?? <NullValue /> },
    { label: "utm_medium",  value: session.utm_medium  ?? <NullValue /> },
    { label: "utm_campaign",value: session.utm_campaign ?? <NullValue /> },
  ];

  return (
    <PanelCard title="Context">
      <PropGrid rows={rows} />
    </PanelCard>
  );
}

// ── Variants panel ────────────────────────────────────────────────────────────

function VariantsPanel({ variants }: { variants: ServedVariantRow[] }) {
  if (variants.length === 0) {
    return (
      <PanelCard title="Served Variants">
        <Text variant="body-sm" color="muted">
          No variants recorded for this session.
        </Text>
      </PanelCard>
    );
  }

  return (
    <PanelCard title="Served Variants" count={variants.length}>
      <div className="flex flex-col gap-4">
        {variants.map((v) => (
          <div key={v.id} className="flex flex-col gap-2">
            <PropGrid
              rows={[
                { label: "hero_key",  value: <MonoValue>{v.hero_key}</MonoValue> },
                { label: "proof_key", value: <MonoValue>{v.proof_key}</MonoValue> },
                { label: "cta_key",   value: <MonoValue>{v.cta_key}</MonoValue> },
                { label: "reason",    value: <span className="text-sm text-neutral-700">{v.reason}</span> },
                { label: "recorded",  value: <span className="text-xs text-neutral-500">{formatDateTime(v.created_at)}</span> },
              ]}
            />
            {variants.length > 1 && (
              <hr className="border-neutral-100" />
            )}
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

// ── Events panel ──────────────────────────────────────────────────────────────

function EventsPanel({ events }: { events: EventRow[] }) {
  return (
    <PanelCard title="Events" count={events.length}>
      {events.length === 0 ? (
        <Text variant="body-sm" color="muted">
          No events recorded for this session.
        </Text>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="pb-2 pr-6 font-medium text-neutral-400 text-xs">
                  Time (UTC)
                </th>
                <th className="pb-2 pr-6 font-medium text-neutral-400 text-xs">
                  Event
                </th>
                <th className="pb-2 font-medium text-neutral-400 text-xs">
                  Payload
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-neutral-50 last:border-0"
                >
                  <td className="py-2 pr-6 font-mono text-xs text-neutral-400 tabular-nums whitespace-nowrap">
                    <time dateTime={event.created_at}>
                      {formatTime(event.created_at)}
                    </time>
                  </td>
                  <td className="py-2 pr-6">
                    <EventTypeBadge eventType={event.event_type} />
                  </td>
                  <td className="py-2">
                    <PayloadDisplay payload={event.payload} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

// ── AI panel (placeholder) ────────────────────────────────────────────────────

function AIPanel() {
  return (
    <PanelCard title="AI Shadow Log">
      <div className="flex items-center gap-2">
        <Badge variant="outline" size="sm">
          Not yet recorded
        </Badge>
        <Text variant="body-sm" color="muted">
          AI decision traces will appear here once the AI layer is instrumented.
        </Text>
      </div>
    </PanelCard>
  );
}

// ── Shared panel primitives ───────────────────────────────────────────────────

function PanelCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" shadow="none">
      <CardHeader className="border-b border-neutral-100 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Text variant="label" as="h2">
            {title}
          </Text>
          {count !== undefined && (
            <Badge variant="default" size="sm">
              {count}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 py-4">{children}</CardContent>
    </Card>
  );
}

function PropGrid({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="font-mono text-xs text-neutral-400 self-center">
            {label}
          </dt>
          <dd className="min-w-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MonoValue({
  children,
  truncate = false,
}: {
  children: React.ReactNode;
  truncate?: boolean;
}) {
  return (
    <span
      className={`font-mono text-xs text-neutral-800${truncate ? " block truncate max-w-xs" : ""}`}
      title={truncate && typeof children === "string" ? children : undefined}
    >
      {children}
    </span>
  );
}

function NullValue() {
  return <span className="text-xs text-neutral-300 italic">null</span>;
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, "primary" | "default" | "warning" | "outline"> = {
    linkedin: "primary",
    google: "warning",
    direct: "default",
  };
  return (
    <Badge variant={map[source] ?? "outline"} size="sm">
      {source}
    </Badge>
  );
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  const map: Record<string, "primary" | "success" | "default"> = {
    page_view: "default",
    cta_click: "success",
  };
  return (
    <Badge variant={map[eventType] ?? "outline"} size="sm">
      {eventType}
    </Badge>
  );
}

function PayloadDisplay({ payload }: { payload: Record<string, unknown> }) {
  const isEmpty =
    payload === null ||
    payload === undefined ||
    Object.keys(payload).length === 0;

  if (isEmpty) {
    return <span className="text-xs text-neutral-300">{"{}"}</span>;
  }

  return (
    <code className="rounded bg-neutral-50 px-1.5 py-0.5 font-mono text-xs text-neutral-600 break-all">
      {JSON.stringify(payload)}
    </code>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

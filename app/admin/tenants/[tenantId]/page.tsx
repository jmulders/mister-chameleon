/**
 * Admin — Tenant Overview (Cockpit)
 *
 * At-a-glance view for an individual tenant with quick-access action cards,
 * identity information, readiness status, and a config snapshot.
 */

import { cookies }       from "next/headers";
import { notFound }      from "next/navigation";
import Link              from "next/link";
import { getTenantById }        from "@/tenant/server";
import { getPackageDefinition } from "@/tenant";
import { DEV_TENANT_COOKIE }    from "@/tenant/dev-tenant-cookie";
import { Badge }                from "@/components/ui/Badge";
import { TenantStatusPanel }    from "@/components/admin/TenantStatusPanel";
import { TenantReadinessChecklist } from "@/components/admin/TenantReadinessChecklist";
import { AdvertiserOverview }      from "./_components/AdvertiserOverview";
import { fetchAdsOverviewAction }  from "./ads/actions";
import { parseAvatarConfig, avatarEmojiBgClass } from "@/components/admin/avatar-util";
import type { TenantSettings, PackageKey } from "@/tenant/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

function packageVariant(key: PackageKey): BadgeVariant {
  switch (key) {
    case "starter": return "default";
    case "growth":  return "primary";
    case "pro":     return "success";
  }
}

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

function isTenantActive(tenant: TenantSettings): boolean {
  const pkg = getPackageDefinition(tenant.packageKey);
  return !!(tenant.features?.analytics && pkg.allowedFeatures?.analytics);
}

function avatarColor(id: string): string {
  const colours = [
    "bg-indigo-100 text-indigo-700",
    "bg-violet-100 text-violet-700",
    "bg-cyan-100 text-cyan-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
  ];
  return colours[(id.charCodeAt(0) ?? 0) % colours.length];
}

// ── Quick action card ─────────────────────────────────────────────────────────

interface ActionCardProps {
  href:        string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  external?:   boolean;
  muted?:      boolean;
}

function ActionCard({ href, label, description, icon, external, muted }: ActionCardProps) {
  const classes = `group flex items-start gap-3 rounded-xl border p-4 transition-all hover:shadow-sm ${
    muted
      ? "border-neutral-200 bg-white hover:border-neutral-300"
      : "border-neutral-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
  }`;

  const content = (
    <>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${muted ? "bg-neutral-100 text-neutral-500" : "bg-indigo-100 text-indigo-600"} group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${muted ? "text-neutral-600" : "text-neutral-900"}`}>{label}</p>
        <p className="mt-0.5 text-xs text-neutral-400 leading-relaxed">{description}</p>
      </div>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminTenantOverviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);

  if (!tenant) notFound();

  const isActive = isTenantActive(tenant);
  const initials = (tenant.name ?? tenant.tenantId).slice(0, 2).toUpperCase();
  const color    = avatarColor(tenant.tenantId);
  const av       = parseAvatarConfig(tenant.avatar ?? null);

  // Advertiser tenants get a focused ad-account cockpit instead of the
  // personalization dashboard (no site to personalize → Setup/Design/CMS/AI
  // are noise). See AdvertiserOverview.
  if (tenant.tenantRole === "advertiser") {
    const ov = await fetchAdsOverviewAction(tenantId);
    const activeCampaigns    = ov.ads.filter((a) => a.status === "active").length;
    const approvedPublishers = ov.publishers.filter((p) => p.status === "approved").length;
    return (
      <AdvertiserOverview
        tenantId={tenantId}
        tenantName={tenant.name ?? tenant.tenantId}
        initials={initials}
        color={color}
        isActive={isActive}
        walletBalanceCents={ov.walletBalance ?? 0}
        activeCampaigns={activeCampaigns}
        approvedPublishers={approvedPublishers}
        siteKey={ov.siteKey}
      />
    );
  }

  const devActiveTenantId: string | null =
    process.env.NODE_ENV === "development"
      ? ((await cookies()).get(DEV_TENANT_COOKIE)?.value ?? null)
      : null;
  const isActiveDevTenant = devActiveTenantId === tenantId;

  const base = `/admin/tenants/${tenantId}`;

  return (
    <div className="flex flex-col min-h-full bg-neutral-50">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-200 bg-white px-8 py-6">
        <div className="flex items-start justify-between gap-4">

          {/* Left: avatar + identity */}
          <div className="flex items-center gap-4">
            {av?.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={av.url} alt="" aria-hidden="true" className="size-14 shrink-0 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ${av?.kind === "emoji" ? avatarEmojiBgClass(av.color, tenant.tenantId) : color}`}>
                {av?.kind === "emoji" ? av.value : initials}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-semibold text-neutral-900">
                  {tenant.name ?? tenant.tenantId}
                </h1>
                <Badge variant={packageVariant(tenant.packageKey)} size="md">
                  {PACKAGE_DISPLAY[tenant.packageKey]}
                </Badge>
                <Badge variant={isActive ? "success" : "outline"} size="md" dot>
                  {isActive ? "Active" : "Inactive"}
                </Badge>
                {isActiveDevTenant && (
                  <Badge variant="warning" size="md" dot>
                    Dev override
                  </Badge>
                )}
              </div>

              {/* Meta row */}
              <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-neutral-400">
                  ID: <code className="font-mono text-neutral-600">{tenant.tenantId}</code>
                </span>
                {tenant.slug && (
                  <span className="text-xs text-neutral-400">
                    Slug: <code className="font-mono text-neutral-600">{tenant.slug}</code>
                  </span>
                )}
                {tenant.primaryDomain && (
                  <a
                    href={`https://${tenant.primaryDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    {tenant.primaryDomain}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: primary action */}
          {tenant.primaryDomain && (
            <a
              href={`https://${tenant.primaryDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:text-neutral-900 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open site
            </a>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 p-8 space-y-8 max-w-6xl">

        {/* Quick action cards */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Quick actions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ActionCard
              href={`${base}/setup`}
              label="Setup"
              description="Readiness checklist, CMS provisioning, domain configuration"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/design`}
              label="Design"
              description="Visual token editor, theme presets, custom palette"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <circle cx="13.5" cy="6.5" r=".5"/>
                  <circle cx="17.5" cy="10.5" r=".5"/>
                  <circle cx="8.5" cy="7.5" r=".5"/>
                  <circle cx="6.5" cy="12.5" r=".5"/>
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/settings`}
              label="Settings"
              description="Identity, package tier, CMS and AI configuration"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/rules`}
              label="Rules"
              description="Decision engine rules, themes, content slot conditions"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/billing`}
              label="Billing"
              description="Subscription plan, session credits, payment history"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/content`}
              label="CMS"
              description="Page inventory, content blocks, CMS connection"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/ai`}
              label="AI"
              description="Decision engine config, AI mode, model selection"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/debug`}
              label="Debug"
              description="Debug overlay, dev override cookie, context inspector"
              muted
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M12 22a7 7 0 0 0 7-7H5a7 7 0 0 0 7 7z"/>
                  <path d="M12 15v-3M9 9l3-3 3 3M5.07 11H2M22 11h-3.07M5 19H2M22 19h-3M19 9l1.25-2.5M5 9 3.75 6.5"/>
                </svg>
              }
            />
          </div>
        </section>

        {/* Readiness checklist */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Readiness
          </h2>
          <TenantReadinessChecklist tenant={tenant} />
        </section>

        {/* Config snapshot */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Configuration snapshot
          </h2>
          <TenantStatusPanel tenant={tenant} />
        </section>

      </div>
    </div>
  );
}

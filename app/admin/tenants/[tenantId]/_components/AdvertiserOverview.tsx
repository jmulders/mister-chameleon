/**
 * Advertiser tenant overview (cockpit).
 *
 * Shown instead of the personalization dashboard when a tenant is an ad account
 * (tenantRole = advertiser). An advertiser has no website to personalize, so the
 * generic Setup/Design/Rules/CMS/AI cards are noise. This surface shows only what
 * an advertiser cares about: account status (wallet, live campaigns, publishers)
 * and links to Ads, Billing, SiteKey and account settings.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

function euros(cents: number | null | undefined): string {
  return "€" + (Number(cents ?? 0) / 100).toFixed(2);
}

interface CardProps {
  href:        string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  muted?:      boolean;
}

function ActionCard({ href, label, description, icon, muted }: CardProps) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-xl border p-4 transition-all hover:shadow-sm ${
        muted
          ? "border-neutral-200 bg-white hover:border-neutral-300"
          : "border-neutral-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
      }`}
    >
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${muted ? "bg-neutral-100 text-neutral-500" : "bg-indigo-100 text-indigo-600"} group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${muted ? "text-neutral-600" : "text-neutral-900"}`}>{label}</p>
        <p className="mt-0.5 text-xs text-neutral-400 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neutral-900">{value}</div>
      {hint && <div className={`mt-1 text-xs ${tone === "warn" ? "text-amber-700" : "text-neutral-400"}`}>{hint}</div>}
    </div>
  );
}

export function AdvertiserOverview({
  tenantId, tenantName, initials, color, isActive,
  walletBalanceCents, activeCampaigns, approvedPublishers, siteKey,
}: {
  tenantId:           string;
  tenantName:         string;
  initials:           string;
  color:              string;
  isActive:           boolean;
  walletBalanceCents: number;
  activeCampaigns:    number;
  approvedPublishers: number;
  siteKey:            string | null;
}) {
  const base = `/admin/tenants/${tenantId}`;
  const walletEmpty = walletBalanceCents <= 0;

  return (
    <div className="flex flex-col min-h-full bg-neutral-50">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="border-b border-neutral-200 bg-white px-8 py-6">
        <div className="flex items-center gap-4">
          <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ${color}`}>
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-neutral-900">{tenantName}</h1>
              <Badge variant="primary" size="md">Advertiser</Badge>
              <Badge variant={isActive ? "success" : "outline"} size="md" dot>
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="mt-1.5 text-xs text-neutral-400">
              ID: <code className="font-mono text-neutral-600">{tenantId}</code>
              <span className="ml-3">Ad account, billed per impression/click against a prepaid wallet.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 p-8 space-y-8 max-w-6xl">

        {/* Account status */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Account</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Wallet balance"
              value={euros(walletBalanceCents)}
              hint={walletEmpty ? "Empty. Ads won't serve until funded." : "Available ad budget."}
              tone={walletEmpty ? "warn" : undefined}
            />
            <StatTile label="Live campaigns" value={String(activeCampaigns)} hint="Ads currently set to active." />
            <StatTile label="Approved publishers" value={String(approvedPublishers)} hint="Sites allowed to show your ads." />
          </div>
          {walletEmpty && (
            <div className="mt-3">
              <Link href={`${base}/billing`} className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Add funds
              </Link>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ActionCard
              href={`${base}/ads`}
              label="Ads"
              description="Campaigns, creatives, publishers and performance stats"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/billing`}
              label="Billing"
              description="Wallet balance, add funds, ad spend and transactions"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/snippet`}
              label="SiteKey"
              description="Your ad account key and how publishers embed your ads"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M4 17l6-6-6-6"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
              }
            />
            <ActionCard
              href={`${base}/settings`}
              label="Settings"
              description="Account identity and access"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              }
            />
          </div>
        </section>

        {siteKey && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Ad account key</h2>
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-neutral-600">Publishers reference this key to serve your ads.</p>
              <code className="mt-2 inline-block rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700">{siteKey}</code>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

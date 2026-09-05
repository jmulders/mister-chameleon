/**
 * Demo rollout — per-demo DNS step (pure, dependency-injected).
 *
 * Strato does NOT support wildcard DNS, and its only "own nameservers" option is
 * domain-wide (which would break Strato-hosted @misterchameleon.nl mail). So each
 * demo gets its OWN subdomain (`<slug>.demo.misterchameleon.nl`) and needs ONE
 * CNAME record set at the DNS provider. The Vercel side is automated; this module
 * decides what that one manual record must say.
 *
 * It registers the demo host on the Vercel project and reads back the CNAME
 * target Vercel recommends for it (a project-specific `*.vercel-dns-NNN.com`),
 * falling back to the legacy `cname.vercel-dns.com` (still accepted by Vercel)
 * when Vercel is unconfigured, errors, or returns no value.
 *
 * FAIL-OPEN: every failure path returns a usable DNS hint plus a warning — the
 * rollout never breaks on a Vercel hiccup. The Vercel calls are injected so this
 * stays a pure unit (the server action passes the real @/lib/vercel-domains fns).
 */

/** Legacy CNAME target — still accepted by Vercel; used when no project-specific value is available. */
export const LEGACY_DEMO_CNAME = "cname.vercel-dns.com";

/** The Vercel operations this step needs, injected so the module is pure/testable. */
export interface DemoDnsDeps {
  isVercelConfigured: () => boolean;
  addVercelDomain: (host: string) => Promise<
    | { ok: true; alreadyVerified: boolean }
    | { ok: false; error: string }
  >;
  getVercelRecommendedCname: (host: string) => Promise<
    | { ok: true; cname: string | null }
    | { ok: false; error: string }
  >;
}

export interface DemoDnsStep {
  /** Rollout step entries to append (Vercel-domain registration outcome). */
  steps:         { label: string; ok: boolean; note: string }[];
  /** Non-fatal warnings to append. */
  warnings:      string[];
  /** DNS record host/prefix relative to the misterchameleon.nl zone, e.g. "acme.demo". */
  dnsHost:       string;
  /** CNAME value the operator must point dnsHost at (Vercel's, or the legacy fallback). */
  dnsCnameValue: string;
  /** True when dnsCnameValue is the legacy fallback rather than Vercel's project-specific value. */
  dnsIsFallback: boolean;
}

/**
 * Register the demo host on Vercel (idempotent, fail-open) and resolve the single
 * CNAME the operator still has to set at their DNS provider.
 *
 * @param demoHost  Full host, e.g. "acme.demo.misterchameleon.nl".
 * @param slug      Tenant slug, e.g. "acme" — the DNS host becomes "<slug>.demo".
 */
export async function resolveDemoDnsStep(
  demoHost: string,
  slug: string,
  deps: DemoDnsDeps,
): Promise<DemoDnsStep> {
  const dnsHost = `${slug}.demo`;
  const steps: DemoDnsStep["steps"] = [];
  const warnings: string[] = [];
  // Default to the legacy fallback; upgraded to Vercel's value when we get one.
  let dnsCnameValue = LEGACY_DEMO_CNAME;
  let dnsIsFallback = true;

  if (!deps.isVercelConfigured()) {
    steps.push({ label: "Vercel domain", ok: true, note: "skipped — Vercel not configured" });
    warnings.push(
      `Vercel is not configured, so ${demoHost} was not registered automatically. ` +
      `Add it in Vercel, then set the CNAME below to the value Vercel shows.`,
    );
    return { steps, warnings, dnsHost, dnsCnameValue, dnsIsFallback };
  }

  const add = await deps.addVercelDomain(demoHost);
  if (!add.ok) {
    steps.push({ label: `Vercel domain ${demoHost}`, ok: false, note: add.error });
    warnings.push(
      `Vercel domain add failed: ${add.error}. The rollout otherwise succeeded; ` +
      `set the CNAME below manually (${LEGACY_DEMO_CNAME} works as a fallback).`,
    );
    return { steps, warnings, dnsHost, dnsCnameValue, dnsIsFallback };
  }
  steps.push({
    label: `Vercel domain ${demoHost}`,
    ok:    true,
    note:  add.alreadyVerified ? "added (verified)" : "added (DNS pending)",
  });

  const cfg = await deps.getVercelRecommendedCname(demoHost);
  if (cfg.ok && cfg.cname) {
    dnsCnameValue = cfg.cname;
    dnsIsFallback = false;
  } else {
    const why = cfg.ok ? "Vercel returned no recommended CNAME" : cfg.error;
    warnings.push(
      `Could not read Vercel's recommended CNAME (${why}); using the legacy ` +
      `fallback ${LEGACY_DEMO_CNAME}, which Vercel still accepts.`,
    );
  }

  return { steps, warnings, dnsHost, dnsCnameValue, dnsIsFallback };
}

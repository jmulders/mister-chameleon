/**
 * Lead Base — built-in hot-lead Slack alert.
 *
 * On qualification, if the tenant configured a Slack incoming-webhook URL and the
 * lead's hot-score clears their threshold, POST a compact message — a sales alert
 * without needing Make/Zapier. Fire-and-forget + fail-open. See docs/lead-base-design.md.
 */

import "server-only";

import { getAbmNotifySettings } from "@/lib/abm/abm-store";
import { leadScore }            from "./lead-scoring";
import type { LeadPerson }      from "./record-visitor-profile";
import type { GatedProfilePatch } from "./profile-gate";
import { logger }               from "@/lib/logger";

const TIMEOUT_MS = 2500;

export async function sendHotLeadAlert(args: {
  tenantId:    string;
  patch:       GatedProfilePatch;
  person:      LeadPerson | null;
  intentScore: number | null;
  visitCount:  number;
}): Promise<void> {
  try {
    const settings = await getAbmNotifySettings(args.tenantId);
    if (!settings.slackUrl) return;

    const score = leadScore({
      identityLevel: args.patch.identityLevel,
      intentScore:   args.intentScore,
      lastSeenAt:    new Date().toISOString(), // just qualified → most recent
      visitCount:    args.visitCount,
    });
    if (score < settings.minScore) return;

    const who = args.person && (args.person.firstName || args.person.lastName)
      ? `${[args.person.firstName, args.person.lastName].filter(Boolean).join(" ")}${args.person.jobTitle ? `, ${args.person.jobTitle}` : ""}`
      : "Unnamed visitor";
    const company = args.patch.companyName ?? "Unknown company";
    const lines = [
      `🔥 *Hot lead* (score ${score}) — ${args.patch.status.toUpperCase()}`,
      `*${company}* · ${who}`,
      args.patch.companyIndustry ? `Industry: ${args.patch.companyIndustry}` : null,
      args.patch.funnelStage ? `Funnel: ${args.patch.funnelStage}` : null,
      args.person?.linkedinUrl ? `<${args.person.linkedinUrl}|LinkedIn>` : null,
    ].filter(Boolean);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(settings.slackUrl, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ text: lines.join("\n") }),
        signal:  controller.signal,
      });
      if (!res.ok) logger.warn("[lead-base] Slack alert non-2xx", { status: res.status });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    logger.warn("[lead-base] sendHotLeadAlert failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

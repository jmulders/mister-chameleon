/**
 * Outbound-webhook URL safety (pure, no I/O).
 *
 * Operator-configured webhook URLs are trusted admin input, but we still refuse
 * obviously-unsafe targets as a defence-in-depth SSRF guard: the URL must be an
 * absolute https URL to a public host, never http, never a loopback / private /
 * link-local host. Used both at config time (rule validation) and at fire time.
 */

/** True when the URL is a safe outbound webhook target. */
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // Named internal hosts.
  if (host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  // Loopback / unspecified.
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return false;
  // Private IPv4 ranges + link-local.
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  // IPv6 unique-local / link-local.
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return false;

  return true;
}

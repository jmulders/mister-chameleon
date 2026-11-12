/**
 * Fetching a URL that someone else chose.
 *
 * A server-side fetch of a caller-supplied URL can be pointed at things only
 * the server can reach: localhost, the private network, the cloud metadata
 * address. Checking the hostname text is not enough, because a public name can
 * resolve to a private address and a public URL can redirect to one. So:
 *
 *   - the host is resolved and every address it resolves to must be public;
 *   - redirects are followed by hand, and each hop gets the same check.
 *
 * One gap remains: the name is resolved once for the check and again by fetch,
 * so a DNS answer that changes in between is not caught. Closing that needs a
 * pinned connection, which fetch does not offer.
 */
import "server-only";

import { lookup } from "node:dns/promises";
import { isPrivateAddress } from "./private-address";

export class BlockedUrlError extends Error {
  constructor(reason: string) {
    super(`Blocked URL: ${reason}`);
    this.name = "BlockedUrlError";
  }
}

/** Throws BlockedUrlError unless the URL is http(s) on a publicly routable host. */
export async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("scheme");
  }
  if (url.username || url.password) throw new BlockedUrlError("credentials");

  // URL keeps the brackets on an IPv6 literal.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "" || host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    throw new BlockedUrlError("host");
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("unresolvable host");
  }
  if (addresses.length === 0) throw new BlockedUrlError("unresolvable host");
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new BlockedUrlError("private address");
  }
}

/**
 * fetch() for a caller-supplied URL: public hosts only, redirects re-checked.
 * Throws BlockedUrlError when the URL or a redirect target is not allowed.
 */
export async function fetchPublicUrl(
  input: URL,
  init: Omit<RequestInit, "redirect"> = {},
  maxRedirects = 4,
): Promise<Response> {
  let current = input;
  for (let hop = 0; ; hop++) {
    await assertPublicHttpUrl(current);
    const res = await fetch(current.toString(), { ...init, redirect: "manual" });

    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    if (hop >= maxRedirects) throw new BlockedUrlError("too many redirects");

    // Drain the redirect body so the connection can be reused.
    await res.body?.cancel().catch(() => undefined);
    current = new URL(location, current);
  }
}

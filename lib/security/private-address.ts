/**
 * Is this IP address one that only the server's own network can reach?
 *
 * Pure, so it can be tested without a network. Used by public-fetch.ts.
 */

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return (
    a === 0 ||                          // "this" network
    a === 10 ||                         // private
    a === 127 ||                        // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) ||         // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) ||         // private
    (a === 192 && b === 0) ||           // IETF protocol assignments, TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224                            // multicast, reserved, broadcast
  );
}

/** True for loopback, private, link-local and otherwise non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = parseIpv4(ip);
  if (v4) return isPrivateIpv4(v4);

  const v6 = ip.toLowerCase().replace(/%.*$/, ""); // drop a zone id
  if (!v6.includes(":")) return true;              // not an address at all: refuse

  if (v6 === "::" || v6 === "::1") return true;

  // IPv4 carried inside IPv6: ::ffff:1.2.3.4 or ::ffff:0102:0304
  const mapped = /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v6);
  if (mapped) {
    const inner = parseIpv4(mapped[1]);
    return inner ? isPrivateIpv4(inner) : true;
  }
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIpv4([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }

  const first = parseInt(v6.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 || // ff00::/8 multicast
    first === 0x64 ||              // 64:ff9b::/96 NAT64 maps onto IPv4
    first === 0x2002               // 6to4 maps onto IPv4
  );
}

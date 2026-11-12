/**
 * Addresses a server-side fetch of a caller's URL must never reach.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { isPrivateAddress } from "../../lib/security/private-address.ts";

describe("isPrivateAddress", () => {
  it("refuses loopback, private and link-local IPv4", () => {
    for (const ip of [
      "127.0.0.1", "127.9.9.9", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1",
      "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    ]) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "76.76.21.21", "100.63.0.1", "193.0.0.1"]) {
      assert.equal(isPrivateAddress(ip), false, ip);
    }
  });

  it("refuses loopback, local and IPv4-carrying IPv6", () => {
    for (const ip of [
      "::1", "::", "fe80::1", "fe80::1%eth0", "fc00::1", "fd12:3456::1", "ff02::1",
      "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "2002:7f00:1::",
    ]) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
  });

  it("allows public IPv6", () => {
    for (const ip of ["2606:4700:4700::1111", "2a00:1450:400e:80e::200e", "::ffff:8.8.8.8", "::ffff:808:808"]) {
      assert.equal(isPrivateAddress(ip), false, ip);
    }
  });

  it("refuses anything that is not an address", () => {
    for (const ip of ["", "localhost", "example.com", "1.2.3", "999.1.1.1"]) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
  });
});

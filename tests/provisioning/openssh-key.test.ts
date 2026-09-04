/**
 * OpenSSH key encoding.
 *
 * The point of this module is that Node CANNOT produce a private key ssh(1)
 * will load — `ssh-keygen -y` on a PKCS#8 ed25519 key says "invalid format".
 * So the test that matters is the one that runs the real ssh-keygen against
 * generated output and checks it derives the matching public half. Everything
 * else here is structure.
 */

import { describe, it }        from "node:test";
import assert                  from "node:assert/strict";
import { execFileSync }        from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir }              from "node:os";
import { join }                from "node:path";

import { generateOpenSshKeyPair, toOpenSshPublicKey } from "../../lib/provisioning/openssh-key.ts";

/** True when ssh-keygen is on this machine — it is on macOS and CI images. */
function hasSshKeygen(): boolean {
  try { execFileSync("ssh-keygen", ["-?"], { stdio: "ignore" }); return true; }
  catch (err) {
    // ssh-keygen exits non-zero for -?, but ENOENT means it isn't installed.
    return (err as { code?: string }).code !== "ENOENT";
  }
}

describe("generateOpenSshKeyPair", () => {
  it("emits a public key in the one-line format GitHub accepts", () => {
    const { publicKey } = generateOpenSshKeyPair("ploi-cms-content");
    assert.match(publicKey, /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/]+ ploi-cms-content$/);
  });

  it("emits a private key in the openssh-key-v1 container, not PKCS#8", () => {
    const { privateKey } = generateOpenSshKeyPair();
    assert.ok(privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----\n"));
    assert.ok(privateKey.trimEnd().endsWith("-----END OPENSSH PRIVATE KEY-----"));
    // The PKCS#8 header is exactly what ssh(1) refuses.
    assert.ok(!privateKey.includes("BEGIN PRIVATE KEY"));
    const body = Buffer.from(privateKey.split("\n").slice(1, -2).join(""), "base64");
    assert.equal(body.subarray(0, 15).toString("binary"), "openssh-key-v1\0");
  });

  it("generates a different key each time", () => {
    const a = generateOpenSshKeyPair();
    const b = generateOpenSshKeyPair();
    assert.notEqual(a.publicKey,  b.publicKey);
    assert.notEqual(a.privateKey, b.privateKey);
  });

  it("omits the trailing space when there is no comment", () => {
    const { publicKey } = generateOpenSshKeyPair();
    assert.equal(publicKey.split(" ").length, 2);
  });

  it("rejects a DER of the wrong length rather than emitting a broken key", () => {
    assert.throws(
      () => toOpenSshPublicKey("-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----"),
      /Unexpected ed25519 public key DER length/,
    );
  });
});

describe("generateOpenSshKeyPair — against the real ssh-keygen", { skip: !hasSshKeygen() }, () => {
  it("produces a private key ssh(1) loads, deriving the same public half", () => {
    const { publicKey, privateKey } = generateOpenSshKeyPair("ploi-cms-content");
    const dir = mkdtempSync(join(tmpdir(), "mc-ssh-"));
    try {
      const keyPath = join(dir, "id_ed25519");
      writeFileSync(keyPath, privateKey, { mode: 0o600 });

      // -y reads the PRIVATE key and prints the public half it derives. It fails
      // outright on a format ssh(1) cannot parse, which is the regression guard.
      const derived = execFileSync("ssh-keygen", ["-y", "-f", keyPath], { encoding: "utf8" }).trim();

      // -y echoes the comment stored inside the private key too, so this is a
      // full-line match: type, key material and comment all round-trip.
      assert.equal(derived, publicKey);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the two halves share a fingerprint — they are one pair", () => {
    const { publicKey, privateKey } = generateOpenSshKeyPair("ploi-cms-content");
    const dir = mkdtempSync(join(tmpdir(), "mc-ssh-"));
    try {
      const keyPath = join(dir, "id_ed25519");
      writeFileSync(keyPath, privateKey, { mode: 0o600 });
      writeFileSync(`${keyPath}.pub`, `${publicKey}\n`);

      const fp = (f: string) => execFileSync("ssh-keygen", ["-l", "-f", f], { encoding: "utf8" }).split(" ")[1];
      assert.equal(fp(keyPath), fp(`${keyPath}.pub`));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

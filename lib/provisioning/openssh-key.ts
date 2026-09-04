/**
 * OpenSSH key encoding for generated deploy keys.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * Node can generate an ed25519 pair but can only export it as PKCS#8 / SPKI PEM,
 * and OpenSSH cannot read a PKCS#8 ed25519 private key at all:
 *
 *     $ ssh-keygen -y -f key.pem
 *     Load key "key.pem": invalid format
 *
 * The container's deploy script writes `STATAMIC_GIT_SSH_KEY` straight to
 * `~/.ssh/id_ed25519`, so the key has to be in the format ssh(1) actually reads:
 * the "openssh-key-v1" container. These two functions convert Node's DER output
 * into that, and into the `ssh-ed25519 AAAA…` one-liner GitHub wants for the
 * public half.
 *
 * Pure and synchronous — no I/O, no crypto beyond re-framing bytes Node already
 * produced. The output is verified against `ssh-keygen -y` in the tests.
 *
 * ─── Format reference ────────────────────────────────────────────────────────
 *
 * Public (one line):
 *     ssh-ed25519 <base64( string "ssh-ed25519" ++ string pub32 )> <comment>
 *
 * Private (PEM-armoured "OPENSSH PRIVATE KEY", unencrypted):
 *     "openssh-key-v1\0"
 *     string ciphername = "none"
 *     string kdfname    = "none"
 *     string kdfoptions = ""
 *     uint32 nkeys      = 1
 *     string publickey  = string "ssh-ed25519" ++ string pub32
 *     string encrypted  = uint32 check ++ uint32 check (equal, since unencrypted)
 *                         ++ string "ssh-ed25519" ++ string pub32
 *                         ++ string (seed32 ++ pub32) ++ string comment
 *                         ++ padding 1,2,3,… up to the 8-byte block size
 */

import { generateKeyPairSync } from "crypto";

const KEY_TYPE   = "ssh-ed25519";
const AUTH_MAGIC = "openssh-key-v1\0";
/** Unencrypted keys still pad to a block size, and OpenSSH uses 8. */
const BLOCK_SIZE = 8;

/** SSH wire format: a 4-byte big-endian length followed by the bytes. */
function sshString(value: Buffer | string): Buffer {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  const len  = Buffer.alloc(4);
  len.writeUInt32BE(body.length, 0);
  return Buffer.concat([len, body]);
}

function uint32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

/** Strip PEM armour and decode the DER body. */
function derFromPem(pem: string): Buffer {
  const body = pem.replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, "");
  return Buffer.from(body, "base64");
}

/**
 * The raw 32-byte halves live at the end of their DER structures, both of which
 * are fixed-length for ed25519: SPKI is 44 bytes (12-byte header + key), PKCS#8
 * is 48 (16-byte header + seed). Taking the last 32 bytes is exact, not a guess
 * — but the length is asserted so a future key type can't silently produce a
 * garbage key.
 */
function raw32(der: Buffer, expectedLength: number, what: string): Buffer {
  if (der.length !== expectedLength) {
    throw new Error(`Unexpected ed25519 ${what} DER length ${der.length} (expected ${expectedLength}).`);
  }
  return der.subarray(der.length - 32);
}

/** SPKI PEM → the `ssh-ed25519 AAAA…` line GitHub accepts as a deploy key. */
export function toOpenSshPublicKey(spkiPem: string, comment = ""): string {
  const pub  = raw32(derFromPem(spkiPem), 44, "public key");
  const blob = Buffer.concat([sshString(KEY_TYPE), sshString(pub)]);
  const line = `${KEY_TYPE} ${blob.toString("base64")}`;
  return comment ? `${line} ${comment}` : line;
}

/** PKCS#8 + SPKI PEM → an unencrypted "OPENSSH PRIVATE KEY" that ssh(1) reads. */
export function toOpenSshPrivateKey(pkcs8Pem: string, spkiPem: string, comment = ""): string {
  const seed = raw32(derFromPem(pkcs8Pem), 48, "private key");
  const pub  = raw32(derFromPem(spkiPem), 44, "public key");

  const publicBlob = Buffer.concat([sshString(KEY_TYPE), sshString(pub)]);

  // Both check ints must match; that is how ssh(1) verifies a correct decrypt.
  // There is nothing to decrypt here, so any value works — a constant keeps the
  // output deterministic for a given key, which makes the tests readable.
  const check = uint32(0x6d63_6831); // "mch1"
  let privateSection = Buffer.concat([
    check,
    check,
    sshString(KEY_TYPE),
    sshString(pub),
    sshString(Buffer.concat([seed, pub])), // ed25519 "private key" = seed ++ public
    sshString(comment),
  ]);

  const padLength = (BLOCK_SIZE - (privateSection.length % BLOCK_SIZE)) % BLOCK_SIZE;
  if (padLength > 0) {
    privateSection = Buffer.concat([
      privateSection,
      Buffer.from(Array.from({ length: padLength }, (_, i) => i + 1)),
    ]);
  }

  const body = Buffer.concat([
    Buffer.from(AUTH_MAGIC, "binary"),
    sshString("none"),   // ciphername
    sshString("none"),   // kdfname
    sshString(""),       // kdfoptions
    uint32(1),           // number of keys
    sshString(publicBlob),
    sshString(privateSection),
  ]);

  const b64   = body.toString("base64");
  const lines = b64.match(/.{1,70}/g) ?? [];
  return [
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    ...lines,
    "-----END OPENSSH PRIVATE KEY-----",
    "",
  ].join("\n");
}

/** A fresh ed25519 pair, already in the formats GitHub and ssh(1) want. */
export function generateOpenSshKeyPair(comment = ""): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding:  { type: "spki",  format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return {
    publicKey:  toOpenSshPublicKey(publicKey, comment),
    privateKey: toOpenSshPrivateKey(privateKey, publicKey, comment),
  };
}

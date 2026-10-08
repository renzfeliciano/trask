import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Deliberately uniform: callers and logs never learn which part of a payload was wrong.
const INVALID_PAYLOAD = "Invalid encrypted payload";

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Encryption key must be ${String(KEY_BYTES)} bytes`);
  }
}

// Buffer's base64url decoder is lenient (it skips junk and ignores trailing bits), so require the
// canonical encoding: anything that does not round-trip exactly was not produced by `encrypt`.
function decodeSegment(segment: string): Buffer {
  const bytes = Buffer.from(segment, "base64url");
  if (bytes.toString("base64url") !== segment) throw new Error(INVALID_PAYLOAD);
  return bytes;
}

/** AES-256-GCM. Returns `v1.<iv>.<tag>.<ciphertext>` with base64url segments and a fresh random IV. */
export function encrypt(plaintext: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** Inverse of `encrypt`. Throws on a malformed payload, a wrong key, or any tampering. */
export function decrypt(payload: string, key: Buffer): string {
  assertKey(key);
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error(INVALID_PAYLOAD);

  const iv = decodeSegment(parts[1] ?? "");
  const tag = decodeSegment(parts[2] ?? "");
  const ciphertext = decodeSegment(parts[3] ?? "");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error(INVALID_PAYLOAD);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(INVALID_PAYLOAD);
  }
}

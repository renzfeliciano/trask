import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/server/crypto/encryption";
import { safeEqual } from "@/server/crypto/compare";

const key = randomBytes(32);

function flipChar(segment: string, index: number): string {
  const original = segment.charAt(index);
  const replacement = original === "A" ? "B" : "A";
  return segment.slice(0, index) + replacement + segment.slice(index + 1);
}

describe("encrypt / decrypt", () => {
  it("round-trips text, including empty and non-ASCII", () => {
    for (const text of ["hello", "", "naïve — 日本語 😀", "x".repeat(10_000)]) {
      expect(decrypt(encrypt(text, key), key)).toBe(text);
    }
  });

  it("produces a v1 payload of four base64url segments", () => {
    const parts = encrypt("hello", key).split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(parts.slice(1).every((p) => /^[A-Za-z0-9_-]*$/.test(p))).toBe(true);
    expect(Buffer.from(parts[1] as string, "base64url")).toHaveLength(12);
    expect(Buffer.from(parts[2] as string, "base64url")).toHaveLength(16);
  });

  it("produces different payloads for the same plaintext", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });

  it("does not contain the plaintext", () => {
    expect(encrypt("super-secret-token", key)).not.toContain("super-secret-token");
  });

  it("throws when a ciphertext character is flipped", () => {
    const [v, iv, tag, ct] = encrypt("hello world", key).split(".") as [
      string,
      string,
      string,
      string,
    ];
    expect(() => decrypt([v, iv, tag, flipChar(ct, 0)].join("."), key)).toThrow();
    expect(() => decrypt([v, iv, tag, flipChar(ct, ct.length - 1)].join("."), key)).toThrow();
  });

  it("throws when the tag or IV is tampered with", () => {
    const [v, iv, tag, ct] = encrypt("hello world", key).split(".") as [
      string,
      string,
      string,
      string,
    ];
    expect(() => decrypt([v, iv, flipChar(tag, 0), ct].join("."), key)).toThrow();
    expect(() => decrypt([v, flipChar(iv, 0), tag, ct].join("."), key)).toThrow();
  });

  it("throws with the wrong key", () => {
    expect(() => decrypt(encrypt("hello", key), randomBytes(32))).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => encrypt("hello", randomBytes(16))).toThrow();
    expect(() => decrypt(encrypt("hello", key), randomBytes(16))).toThrow();
  });

  it.each([
    ["empty payload", ""],
    ["too few segments", "v1.abc.def"],
    ["too many segments", "v1.a.b.c.d"],
    ["unknown version", "v2.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA."],
    ["short IV", "v1.AAAA.AAAAAAAAAAAAAAAAAAAAAA."],
    ["short tag", "v1.AAAAAAAAAAAAAAAA.AAAA."],
    ["non-base64url characters", "v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.!!!"],
  ])("rejects a malformed payload: %s", (_label, payload) => {
    expect(() => decrypt(payload, key)).toThrow();
  });

  it("does not echo plaintext or key material in error messages", () => {
    const payload = encrypt("super-secret-token", key);
    try {
      decrypt(payload, randomBytes(32));
      expect.unreachable("decrypt should have thrown");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain("super-secret-token");
      expect(message).not.toContain(key.toString("hex"));
    }
  });
});

describe("safeEqual", () => {
  it("returns true for equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });

  it("returns false for same-length different strings", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths without throwing", () => {
    expect(safeEqual("a", "abc")).toBe(false);
    expect(safeEqual("abc", "a")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});

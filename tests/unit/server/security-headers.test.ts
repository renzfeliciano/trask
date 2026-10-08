import { buildCsp, generateNonce, securityHeaders } from "@/server/http/security-headers";

describe("buildCsp", () => {
  it("emits the exact production policy", () => {
    expect(buildCsp("abc", { dev: false })).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'nonce-abc' 'strict-dynamic'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; "),
    );
  });

  it("binds scripts to the nonce and forbids framing and plugins", () => {
    const csp = buildCsp("abc", { dev: false });
    expect(csp).toContain("'nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows unsafe-eval only in development", () => {
    expect(buildCsp("abc", { dev: false })).not.toContain("unsafe-eval");
    expect(buildCsp("abc", { dev: true })).toContain("'strict-dynamic' 'unsafe-eval'");
  });
});

describe("generateNonce", () => {
  it("returns a base64 value that differs on every call", () => {
    const first = generateNonce();
    expect(first).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(generateNonce()).not.toBe(first);
  });
});

describe("securityHeaders", () => {
  it("sets the hardening headers with exact values", () => {
    expect(securityHeaders()).toEqual({
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
  });

  it("sets no CORS headers", () => {
    const names = Object.keys(securityHeaders()).map((name) => name.toLowerCase());
    expect(names.filter((name) => name.startsWith("access-control-"))).toEqual([]);
  });
});

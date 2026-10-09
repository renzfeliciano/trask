import { buildCsp, generateNonce, securityHeaders } from "@/server/http/security-headers";

describe("buildCsp", () => {
  it("emits the exact production policy", () => {
    expect(buildCsp("abc", { dev: false, appUrl: "https://trask.example" })).toBe(
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
    const csp = buildCsp("abc", { dev: false, appUrl: "https://trask.example" });
    expect(csp).toContain("'nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows unsafe-eval only in development", () => {
    expect(buildCsp("abc", { dev: false, appUrl: undefined })).not.toContain("unsafe-eval");
    expect(buildCsp("abc", { dev: true, appUrl: undefined })).toContain(
      "'strict-dynamic' 'unsafe-eval'",
    );
  });

  // WebKit applies upgrade-insecure-requests even to http://localhost, so on a plain-HTTP origin
  // every script and stylesheet would be rewritten to an https:// URL that does not exist.
  it("omits upgrade-insecure-requests only when the app is served over plain HTTP", () => {
    expect(buildCsp("abc", { dev: false, appUrl: "http://localhost:3100" })).not.toContain(
      "upgrade-insecure-requests",
    );
    expect(buildCsp("abc", { dev: false, appUrl: "https://trask.example" })).toMatch(
      /; upgrade-insecure-requests$/,
    );
  });

  it("keeps upgrade-insecure-requests when the app URL is missing or unparseable (fail secure)", () => {
    expect(buildCsp("abc", { dev: false, appUrl: undefined })).toMatch(
      /; upgrade-insecure-requests$/,
    );
    expect(buildCsp("abc", { dev: false, appUrl: "not a url" })).toMatch(
      /; upgrade-insecure-requests$/,
    );
    expect(buildCsp("abc", { dev: false, appUrl: "HTTP://localhost" })).not.toContain(
      "upgrade-insecure-requests",
    );
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

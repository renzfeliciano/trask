import "server-only";

/** A fresh, unguessable per-request value for the CSP nonce. */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * The Content-Security-Policy for one request. Scripts run only with the request's nonce (and what
 * those scripts load, via 'strict-dynamic'). `style-src 'unsafe-inline'` is a deliberate trade-off:
 * Tailwind and Radix set inline styles at runtime, and style injection is a far smaller risk than
 * script injection (recorded in the threat model). 'unsafe-eval' is development-only: React uses
 * eval there to rebuild server stack traces.
 *
 * `upgrade-insecure-requests` is left out only when APP_URL is explicitly plain HTTP (a local
 * `next start`): WebKit applies it even to http://localhost and rewrites every script and stylesheet to
 * an https:// URL that does not exist. A missing or unparseable APP_URL keeps it (fail secure).
 */
export function buildCsp(
  nonce: string,
  opts: { dev: boolean; appUrl: string | undefined },
): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isPlainHttp(opts.appUrl)) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function isPlainHttp(appUrl: string | undefined): boolean {
  if (!appUrl || !URL.canParse(appUrl)) return false;
  return new URL(appUrl).protocol === "http:";
}

/** Static response headers for every response. Deliberately no CORS headers: the app is same-origin only. */
export function securityHeaders(): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

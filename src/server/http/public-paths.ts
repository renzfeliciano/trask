import "server-only";

/** Better Auth's session cookie, plain and with the `__Secure-` prefix it gets over HTTPS. */
export const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

/**
 * Whether the request carries a session cookie. Presence only: the cookie is verified against the
 * database where data is read, so this just decides sign-in redirects early.
 */
export function hasSessionCookie(cookies: { has(name: string): boolean }): boolean {
  return SESSION_COOKIE_NAMES.some((name) => cookies.has(name));
}

// Default-deny: anything not listed here needs a session. Each entry is spelled out on purpose.
const PUBLIC_EXACT = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/health",
  "/.well-known/security.txt",
  // Next internals and static files that public pages need to render.
  "/_next/image",
  "/favicon.ico",
  "/manifest.webmanifest",
]);

const PUBLIC_PREFIXES = ["/legal/", "/api/auth/", "/_next/static/", "/brand/"];

// File-convention icons: /icon.png, /icon1.png, /apple-icon.png, and /icon/<id> for generated sets.
const ICON_FILE = /^\/(?:icon|apple-icon)\d{0,3}$/;
const ICON_EXTENSION = /^[a-z0-9]{1,5}$/;
const ICON_SET_MEMBER = /^\/(?:icon|apple-icon)\/[\w-]+$/;

function isIconPath(path: string): boolean {
  if (ICON_SET_MEMBER.test(path)) return true;
  const dot = path.indexOf(".");
  if (dot === -1) return ICON_FILE.test(path);
  return ICON_FILE.test(path.slice(0, dot)) && ICON_EXTENSION.test(path.slice(dot + 1));
}

const DEV_UI_PATH = "/dev/ui";

function withoutTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Whether a path may be served without a session. */
export function isPublicPath(pathname: string): boolean {
  const path = withoutTrailingSlash(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length)) {
    return true;
  }
  if (isIconPath(path)) return true;
  return process.env.NODE_ENV !== "production" && path === DEV_UI_PATH;
}

const BLOCKED_EXTENSIONS = [".map", ".zip", ".tar", ".gz", ".bak", ".sql", ".env"];
const WELL_KNOWN = ".well-known";

/**
 * Paths that never exist for a real user: dotfiles and dot-directories (except a leading
 * `/.well-known/`), source maps, and archive, backup, dump and env files. They get a 404 before
 * anything else, whether or not a file with that name exists. Percent-escapes are decoded first,
 * so `/%2eenv` cannot slip past; an undecodable path is blocked.
 */
export function isBlockedPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  const lower = decoded.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((extension) => lower.endsWith(extension))) return true;

  const segments = decoded.split(/[/\\]/).filter((segment) => segment !== "");
  return segments.some(
    (segment, index) => segment.startsWith(".") && !(index === 0 && segment === WELL_KNOWN),
  );
}

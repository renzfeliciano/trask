import {
  hasSessionCookie,
  isBlockedPath,
  isDevOnlyPath,
  isPublicPath,
  SESSION_COOKIE_NAMES,
} from "@/server/http/public-paths";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isPublicPath", () => {
  it.each([
    "/",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/legal/privacy",
    "/legal/terms",
    "/api/health",
    "/api/auth/sign-in",
    "/api/auth/callback/github",
    "/.well-known/security.txt",
    "/_next/static/chunks/main-abc.js",
    "/_next/static/css/app.css",
    "/_next/image",
    "/favicon.ico",
    "/icon.png",
    "/icon1.png",
    "/icon/small",
    "/apple-icon.png",
    // The URLs `next build` emits for src/app/icon.svg, apple-icon.tsx and icon1.tsx (generateImageMetadata).
    "/icon.svg",
    "/apple-icon",
    "/icon1/192",
    "/icon1/512",
    "/icon1/maskable",
    "/manifest.webmanifest",
    "/brand/mascot/welcome.webp",
    "/sign-in/",
  ])("allows %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/w/acme",
    "/w/acme/b/1",
    "/api/tasks",
    "/api",
    "/api/healthz",
    "/api/health/deep",
    "/api/authz",
    "/sign-in/extra",
    "/legal",
    "/settings",
    "/_next/data/build/index.json",
    "/_next/static",
    "/_next/imagex",
    "/favicon.icox",
    "/iconography",
    "/icon.png/extra",
    "/icon1/192/extra",
    "/icon1234/192",
    "/brand",
    "/brandx/logo.png",
    "/.well-known/other",
  ])("denies %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("serves /dev/ui outside production only", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isPublicPath("/dev/ui")).toBe(true);
    vi.stubEnv("NODE_ENV", "test");
    expect(isPublicPath("/dev/ui")).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(isPublicPath("/dev/ui")).toBe(false);
  });

  it("recognizes dev-only paths, with or without a trailing slash", () => {
    for (const path of ["/dev/ui", "/dev/ui/", "/dev/ui/extra"])
      expect(isDevOnlyPath(path)).toBe(true);
    for (const path of ["/", "/dev", "/dev/uix", "/w/dev/ui"])
      expect(isDevOnlyPath(path)).toBe(false);
  });

  // Dev tooling (HMR socket, dev overlay, source lookups) must work before anyone signs in.
  const DEV_TOOLING = [
    "/_next/webpack-hmr",
    "/_next/data/development/index.json",
    "/_next/static",
    "/__nextjs_original-stack-frames",
    "/__nextjs_source-map",
    "/__nextjs_launch-editor",
  ];

  it.each(DEV_TOOLING)("allows %s in development", (path) => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(DEV_TOOLING)("denies %s outside development", (path) => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isPublicPath(path)).toBe(false);
    vi.stubEnv("NODE_ENV", "test");
    expect(isPublicPath(path)).toBe(false);
  });

  it("does not open look-alike paths in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isPublicPath("/_nextx/a")).toBe(false);
    expect(isPublicPath("/w/acme/_next/a")).toBe(false);
    expect(isPublicPath("/_next")).toBe(false);
  });
});

describe("isBlockedPath", () => {
  it.each([
    "/.env",
    "/.env.local",
    "/.git/config",
    "/a/.hidden/b",
    "/..",
    "/a/../b",
    "/%2eenv",
    "/%2E%2e/secret",
    "/.well-known/.env",
    "/backup.zip",
    "/BACKUP.ZIP",
    "/dump.tar",
    "/dump.gz",
    "/db.bak",
    "/db.sql",
    "/prod.env",
    "/_next/static/x.js.map",
    "/%",
    "/a%2f.env",
  ])("blocks %s", (path) => {
    expect(isBlockedPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/.well-known/security.txt",
    "/sign-in",
    "/w/acme/b/1",
    "/brand/mascot/welcome.webp",
    "/api/health",
    "/legal/terms",
  ])("allows %s", (path) => {
    expect(isBlockedPath(path)).toBe(false);
  });
});

describe("hasSessionCookie", () => {
  const jar = (...names: string[]) => ({ has: (name: string) => names.includes(name) });

  it("names both the plain and the Secure-prefixed Better Auth cookie", () => {
    expect(SESSION_COOKIE_NAMES).toEqual([
      "better-auth.session_token",
      "__Secure-better-auth.session_token",
    ]);
  });

  it("accepts either cookie", () => {
    expect(hasSessionCookie(jar("better-auth.session_token"))).toBe(true);
    expect(hasSessionCookie(jar("__Secure-better-auth.session_token"))).toBe(true);
  });

  it("rejects other cookies and an empty jar", () => {
    expect(hasSessionCookie(jar("theme", "session"))).toBe(false);
    expect(hasSessionCookie(jar())).toBe(false);
  });
});

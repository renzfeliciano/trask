import { expect, test, type APIResponse } from "@playwright/test";

// Plain HTTP requests (no browser, no redirect following): these pin what the server sends.
const noRedirects = { maxRedirects: 0 } as const;

function header(response: APIResponse, name: string): string | undefined {
  return response.headersArray().find((h) => h.name.toLowerCase() === name)?.value;
}

test.describe("security headers", () => {
  test("every response carries the pinned headers and a nonce CSP", async ({ request }) => {
    // One of each response kind the proxy produces: page, route handler, its own 404s, and its sign-in redirect.
    const responses: [path: string, status: number][] = [
      ["/", 200],
      ["/api/health", 200],
      ["/.env", 404],
      ["/dev/ui", 404],
      ["/w/acme", 303],
    ];
    for (const [path, status] of responses) {
      const response = await request.get(path, noRedirects);
      expect(response.status(), path).toBe(status);

      expect(header(response, "strict-transport-security"), path).toBe(
        "max-age=63072000; includeSubDomains",
      );
      expect(header(response, "x-content-type-options"), path).toBe("nosniff");
      expect(header(response, "referrer-policy"), path).toBe("strict-origin-when-cross-origin");
      expect(header(response, "permissions-policy"), path).toBe(
        "camera=(), microphone=(), geolocation=(), payment=()",
      );
      expect(header(response, "cross-origin-opener-policy"), path).toBe("same-origin");

      const csp = header(response, "content-security-policy");
      expect(csp, path).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'(?:;|$)/);
      expect(csp, path).not.toContain("unsafe-eval");
      expect(csp, path).toContain("default-src 'self'");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).toContain("object-src 'none'");

      expect(header(response, "x-powered-by"), path).toBeUndefined();
      expect(header(response, "access-control-allow-origin"), path).toBeUndefined();
    }
  });

  test("the nonce is fresh per request and stamped on the page's scripts", async ({ request }) => {
    const nonceOf = (csp: string | undefined) => /'nonce-([^']+)'/.exec(csp ?? "")?.[1];

    const first = await request.get("/");
    const second = await request.get("/");
    const nonce = nonceOf(header(first, "content-security-policy"));

    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe(nonceOf(header(second, "content-security-policy")));
    expect(await first.text()).toContain(`nonce="${nonce ?? ""}"`);
  });
});

test.describe("default-deny proxy", () => {
  for (const path of ["/.env", "/.git/config", "/backup.zip", "/_next/static/chunks/main.js.map"]) {
    test(`${path} is a 404`, async ({ request }) => {
      const response = await request.get(path, noRedirects);
      expect(response.status()).toBe(404);
    });
  }

  for (const path of ["/dev/ui", "/dev/%75i"]) {
    test(`${path} does not exist in a production build`, async ({ request }) => {
      const response = await request.get(path, noRedirects);
      expect(response.status()).toBe(404);
    });
  }

  test("a workspace path without a session redirects to sign-in with the path preserved", async ({
    request,
    baseURL,
  }) => {
    const response = await request.get("/w/acme", noRedirects);

    expect(response.status()).toBe(303);
    expect(header(response, "cache-control")).toBe("private, no-store");
    const location = new URL(header(response, "location") ?? "", baseURL);
    expect(location.pathname).toBe("/sign-in");
    expect(location.search).toBe("?next=%2Fw%2Facme");
  });

  // Hostile paths and `next` values must never yield a redirect that leaves the site. The URLs are built
  // as absolute strings: a bare "//evil.com" would be read as a protocol-relative URL by the HTTP client.
  test("hostile redirect targets never produce an off-site Location", async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "").origin;
    // Each row pins the status and, for redirects, where it goes. Sign-in is public, so a hostile `next`
    // there is just a request to a page: it must not redirect at all. Next itself collapses doubled slashes
    // with a same-site 308 before the proxy runs; the proxy sanitizes what it puts in `next`.
    type Expected =
      | { status: number; location?: undefined }
      | { status: number; location: string; next?: string };
    const attempts: [path: string, expected: Expected][] = [
      ["/sign-in?next=//evil.com", { status: 404 }],
      ["/sign-in?next=%2F%2Fevil.com", { status: 404 }],
      ["/sign-in?next=/%5Cevil.com", { status: 404 }],
      ["/sign-in?next=https://evil.com", { status: 404 }],
      ["//evil.com", { status: 308, location: "/evil.com" }],
      ["/w//evil.com", { status: 308, location: "/w/evil.com" }],
      ["/w/..//evil.com", { status: 308, location: "/evil.com" }],
      ["/%2F%2Fevil.com", { status: 303, location: "/sign-in", next: "/" }],
      [
        "/w/acme?next=//evil.com",
        { status: 303, location: "/sign-in", next: "/w/acme?next=%2F%2Fevil.com" },
      ],
    ];

    let redirects = 0;
    for (const [attempt, expected] of attempts) {
      const response = await request.get(`${origin}${attempt}`, noRedirects);
      expect(response.status(), attempt).toBe(expected.status);

      const location = header(response, "location");
      if (expected.location === undefined) {
        expect(location, attempt).toBeUndefined();
        continue;
      }

      redirects += 1;
      const target = new URL(location ?? "", origin);
      expect(target.origin, attempt).toBe(origin);
      expect(target.pathname, attempt).toBe(expected.location);
      if ("next" in expected) {
        const next = target.searchParams.get("next") ?? "";
        expect(next, attempt).toBe(expected.next);
        expect(/^\/(?![/\\])/.test(next), `${attempt} -> next=${next}`).toBe(true);
      }
    }
    // Guards against the loop passing without ever seeing a redirect.
    expect(redirects).toBe(attempts.filter(([, { location }]) => location !== undefined).length);
    expect(redirects).toBeGreaterThan(0);
  });
});

test.describe("health", () => {
  test("reports ok and is never cached", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(header(response, "cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

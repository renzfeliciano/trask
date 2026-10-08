import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const request = (path: string, init?: { cookie?: string }) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: init?.cookie ? { cookie: init.cookie } : {},
  });

describe("proxy", () => {
  it("lets a public page through with a nonce CSP and the security headers", () => {
    const response = proxy(request("/sign-in"));

    expect(response.status).toBe(200);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(response.headers.get("cache-control")).not.toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("forwards the same nonce and CSP to the app on the request", () => {
    const response = proxy(request("/"));

    const nonce = /'nonce-([^']+)'/.exec(
      response.headers.get("content-security-policy") ?? "",
    )?.[1];
    expect(nonce).toBeTruthy();
    // NextResponse.next({ request: { headers } }) exposes overridden request headers this way.
    expect(response.headers.get("x-middleware-override-headers")).toContain("x-nonce");
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(
      response.headers.get("content-security-policy"),
    );
  });

  it("uses a different nonce for every request", () => {
    const first = proxy(request("/")).headers.get("x-middleware-request-x-nonce");
    const second = proxy(request("/")).headers.get("x-middleware-request-x-nonce");
    expect(first).not.toBe(second);
  });

  it("answers 404 for blocked paths, even public-looking ones", () => {
    for (const path of ["/.env", "/.git/config", "/backup.zip", "/_next/static/x.js.map"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(404);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("redirects a private path without a session to sign-in, keeping a safe next", () => {
    const response = proxy(request("/w/acme?task=TRK-42"));

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/w/acme?task=TRK-42");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("falls back to / when the requested path is not a safe redirect target", () => {
    const response = proxy(request("//evil.com"));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/");
  });

  it("lets a private path through with no-store when a session cookie is present", () => {
    const response = proxy(request("/w/acme", { cookie: "better-auth.session_token=x" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

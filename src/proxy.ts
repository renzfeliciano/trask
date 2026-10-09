import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  hasSessionCookie,
  isBlockedPath,
  isDevOnlyPath,
  isPublicPath,
} from "@/server/http/public-paths";
import { buildCsp, generateNonce, securityHeaders } from "@/server/http/security-headers";

// Next 16's proxy (the former middleware): default-deny gate plus per-request CSP nonce.
// The rules live in src/server/http; this file only composes them.
// No matcher on purpose: it must also see static and public files so blocked paths 404 everywhere.

function withSecurityHeaders(response: NextResponse, csp: string): NextResponse {
  for (const [name, value] of Object.entries(securityHeaders())) response.headers.set(name, value);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    appUrl: process.env.APP_URL,
  });
  const { pathname, search } = request.nextUrl;

  if (
    isBlockedPath(pathname) ||
    (process.env.NODE_ENV === "production" && isDevOnlyPath(pathname))
  ) {
    return withSecurityHeaders(new NextResponse(null, { status: 404 }), csp);
  }

  const isPublic = isPublicPath(pathname);

  if (!isPublic && !hasSessionCookie(request.cookies)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", safeRedirectPath(pathname + search));
    // 303 so a rejected form post is retried as a plain GET of the sign-in page.
    const redirect = NextResponse.redirect(signIn, 303);
    redirect.headers.set("Cache-Control", "private, no-store");
    return withSecurityHeaders(redirect, csp);
  }

  // Next reads the nonce from the CSP on the forwarded request and stamps it on its own scripts;
  // x-nonce lets server components read it (see src/server/http/nonce.ts).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!isPublic) response.headers.set("Cache-Control", "private, no-store");
  return withSecurityHeaders(response, csp);
}

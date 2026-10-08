// Open-redirect guard for the `next` query parameter and request paths. Accepts only same-origin,
// absolute paths ("/..."); anything else yields the fallback.

const MAX_DECODE_PASSES = 3;
const PLACEHOLDER_ORIGIN = "http://safe-redirect.invalid";

// ASCII control characters: C0 range plus DEL. Covers CR, LF, tab and NUL, which browsers strip or
// treat as terminators and which enable header injection or `/<tab>/host` tricks.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function isUnsafe(value: string): boolean {
  if (
    CONTROL_CHARS.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return true;
  }

  // The URL parser normalizes dot segments and backslashes, so `/.//evil.com`, `/a/..//evil.com`
  // and `/./\evil.com` all become the protocol-relative `//evil.com`. Reject anything that does,
  // or that leaves our origin, in case downstream code (rewrites, `new URL`) normalizes it.
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN);
    return (
      url.origin !== PLACEHOLDER_ORIGIN ||
      url.pathname.startsWith("//") ||
      url.pathname.startsWith("/\\")
    );
  } catch {
    return true;
  }
}

/**
 * Returns `input` unchanged when it is a safe same-origin path, otherwise `fallback`.
 * Every decoding of the input (a proxy or the router may decode again) must also be safe.
 */
export function safeRedirectPath(input: string | null | undefined, fallback = "/"): string {
  if (!input) return fallback;

  let current = input;
  for (let pass = 0; ; pass++) {
    if (isUnsafe(current)) return fallback;

    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return fallback; // malformed percent escape
    }
    if (decoded === current) break;
    if (pass + 1 >= MAX_DECODE_PASSES) return fallback; // still changing: nested encoding, refuse
    current = decoded;
  }

  return input;
}

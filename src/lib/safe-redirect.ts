// Open-redirect guard for the `next` query parameter and request paths. Accepts only same-origin,
// absolute paths ("/..."); anything else yields the fallback.

const MAX_DECODE_PASSES = 3;
const PLACEHOLDER_ORIGIN = "http://safe-redirect.invalid";

// ASCII control characters: C0 range plus DEL. Covers CR, LF, tab and NUL, which browsers strip or
// treat as terminators and which enable header injection or `/<tab>/host` tricks.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function isUnsafe(value: string): boolean {
  return (
    CONTROL_CHARS.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  );
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

  // Belt and braces: the URL parser must agree the path stays on our origin.
  try {
    if (new URL(input, PLACEHOLDER_ORIGIN).origin !== PLACEHOLDER_ORIGIN) return fallback;
  } catch {
    return fallback;
  }

  return input;
}

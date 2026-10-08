import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    "/",
    "/w/acme/b/1?task=TRK-42",
    "/w/acme/b/1?task=TRK-42#comments",
    "/settings",
    "/w/a%20b/c",
    "/w/acme?next=%2Fother",
  ])("keeps the same-origin path %j", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/w/acme"],
    ["absolute https", "https://evil.com"],
    ["absolute http", "http://evil.com/x"],
    ["backslash authority", "/\\evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,x"],
    ["encoded CRLF", "/%0d%0aSet-Cookie:x"],
    ["encoded LF", "/%0a/evil.com"],
    ["raw CR", "/ok\rinjected"],
    ["raw LF", "/ok\ninjected"],
    ["raw tab", "/\t/evil.com"],
    ["raw NUL", "/ok\u0000"],
    ["raw DEL", "/ok\u007f"],
    ["encoded NUL", "/ok%00"],
    ["encoded slash pair", "/%2fevil.com"],
    ["encoded second slash", "/%2Fevil.com"],
    ["encoded backslash", "/%5cevil.com"],
    ["encoded first slash", "%2f%2fevil.com"],
    ["double-encoded slash pair", "/%252fevil.com"],
    ["triple-encoded slash pair", "/%25252fevil.com"],
    ["encoded tab between slashes", "/%09/evil.com"],
    ["malformed percent escape", "/%E0%A4%A"],
    ["dot segment before empty segment", "/.//evil.com"],
    ["parent segment before empty segment", "/..//evil.com"],
    ["dot-dot collapsing to empty segment", "/a/..//evil.com"],
    ["dot then backslash", "/./\\evil.com"],
    ["encoded dot segment", "/%2e//evil.com"],
    ["double-encoded dot segment", "/%252e//evil.com"],
    ["relative path", "w/acme"],
    ["leading space", " //evil.com"],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("falls back for %s: %j", (_label, input) => {
    expect(safeRedirectPath(input)).toBe("/");
  });

  it("falls back for null and undefined", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
  });

  it("uses the supplied fallback", () => {
    expect(safeRedirectPath("//evil.com", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/ok", "/dashboard")).toBe("/ok");
  });
});

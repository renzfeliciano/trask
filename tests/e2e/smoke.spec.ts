import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function landing(page: Page, colorScheme: "light" | "dark") {
  // next-themes follows the system scheme by default, so emulating it picks the theme.
  await page.emulateMedia({ colorScheme });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveClass(
    colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/,
  );
}

test.describe("landing page", () => {
  test("renders the brand and a single h1", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle("TRASK");
    await expect(page.getByText("TRASK", { exact: true })).toBeVisible();
    const headings = page.getByRole("heading", { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText("Work moves here.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`has no WCAG A/AA violations in ${colorScheme} mode`, async ({ page }) => {
      await landing(page, colorScheme);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(violations).toEqual([]);
    });
  }

  test("toggles the dark class on <html>", async ({ page }) => {
    await landing(page, "light");
    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: "Switch theme" });

    await toggle.click();
    await expect(html).toHaveClass(/\bdark\b/);
    await toggle.click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  // Review Focus 3: a strict CSP can silently block Next's runtime or the theme script. A blocked script
  // logs a console error (and, if it was the app's own, a page error), so both are watched across navigation.
  test("raises no Content Security Policy violations or page errors", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/Content Security Policy|Refused to/i.test(text)) problems.push(`console: ${text}`);
    });
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

    await page.goto("/");
    await page.getByRole("button", { name: "Switch theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.goto("/");
    await page.reload();
    await page.waitForLoadState("networkidle");

    expect(problems).toEqual([]);
  });
});

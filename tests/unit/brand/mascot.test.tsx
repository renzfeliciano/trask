// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Mascot } from "@/components/brand/mascot";
import { MASCOT_MANIFEST, MASCOT_STATES } from "@/components/brand/mascot-manifest";
import { EmptyState } from "@/components/ui/empty-state";

type Asset = { light: string | null; dark: string | null };

// The component reads the manifest object, so tests swap entries on a mutable copy and restore them after.
const files = vi.hoisted(() => {
  const manifest: Record<string, Asset> = {};
  const original: Record<string, Asset> = {};
  return { manifest, original };
});

vi.mock("@/components/brand/mascot-manifest", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/brand/mascot-manifest")>();
  Object.assign(files.original, structuredClone(real.MASCOT_MANIFEST));
  Object.assign(files.manifest, structuredClone(real.MASCOT_MANIFEST));
  return { ...real, MASCOT_MANIFEST: files.manifest };
});

afterEach(() => {
  Object.assign(files.manifest, structuredClone(files.original));
});

const SPEC_STATES = [
  "welcome",
  "empty",
  "creating",
  "done",
  "searching",
  "no-results",
  "focus",
  "error",
];

describe("mascot manifest", () => {
  it("has an entry for exactly the spec's eight states", () => {
    expect([...MASCOT_STATES].sort()).toEqual([...SPEC_STATES].sort());
    expect(Object.keys(MASCOT_MANIFEST).sort()).toEqual([...SPEC_STATES].sort());
  });

  it("points every light asset at the interim WebP under /brand/mascot/", () => {
    for (const [state, asset] of Object.entries(MASCOT_MANIFEST)) {
      expect(asset.light).toBe(`/brand/mascot/${state}.webp`);
    }
  });
});

describe("<Mascot />", () => {
  it("falls back to the logo mark when the state has no artwork yet", () => {
    files.manifest.empty = { light: null, dark: null };
    const { container } = render(<Mascot state="empty" />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('svg[data-slot="logo-mark"]')).not.toBeNull();
  });

  it("renders the artwork as a decorative image", () => {
    const { container } = render(<Mascot state="empty" />);
    const images = container.querySelectorAll("img");

    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("alt")).toBe("");
    expect(images[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(images[0]?.getAttribute("src")).toContain(
      encodeURIComponent("/brand/mascot/empty.webp"),
    );
  });

  // Theme is a class on <html> (next-themes, attribute="class"), so the swap is CSS: both files are in
  // the markup and `dark:` utilities show exactly one. No flash, no hydration mismatch.
  it("shows the dark file under the dark theme when one exists", () => {
    files.manifest.done = {
      light: "/brand/mascot/done.webp",
      dark: "/brand/mascot/done-dark.webp",
    };
    const { container } = render(<Mascot state="done" />);
    const [lightImage, darkImage] = container.querySelectorAll("img");

    expect(lightImage?.getAttribute("src")).toContain(
      encodeURIComponent("/brand/mascot/done.webp"),
    );
    expect(lightImage?.className).toContain("dark:hidden");
    expect(darkImage?.getAttribute("src")).toContain(
      encodeURIComponent("/brand/mascot/done-dark.webp"),
    );
    expect(darkImage?.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(darkImage?.className).toContain("dark:block");
    expect(darkImage?.getAttribute("aria-hidden")).toBe("true");
  });

  it("reuses the light file in dark mode when no dark file exists", () => {
    const { container } = render(<Mascot state="done" />);
    const images = container.querySelectorAll("img");

    expect(images).toHaveLength(1);
    expect(images[0]?.className).not.toContain("dark:hidden");
  });

  it("is hidden from assistive technology as a whole", () => {
    const { container } = render(<Mascot state="welcome" size="lg" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("EmptyState with a mascot", () => {
  it("still carries its meaning in text", () => {
    render(
      <EmptyState
        mascot="empty"
        title="Nothing here yet."
        description="Add a task to get this board moving."
      />,
    );

    expect(screen.getByRole("heading", { name: "Nothing here yet." })).toBeTruthy();
    expect(screen.getByText("Add a task to get this board moving.")).toBeTruthy();
  });
});

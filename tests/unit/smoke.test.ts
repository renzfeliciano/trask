import { cn } from "@/lib/cn";

test("cn merges conflicting tailwind classes", () => {
  expect(cn("p-2", "p-4")).toBe("p-4");
});

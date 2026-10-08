"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

// Sonner's own stylesheet supplies layout and motion (it skips animation under reduced motion).
// These variables map its surface onto TRASK tokens; globals.css overrides the font, shadow and
// description colour, which Sonner hard-codes.
const TOKENS = {
  "--normal-bg": "var(--surface)",
  "--normal-text": "var(--foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius-md)",
} as CSSProperties;

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      style={TOKENS}
    />
  );
}

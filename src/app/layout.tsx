import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getRequestNonce } from "@/server/http/nonce";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRASK",
  description: "Work should move, not become clutter.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reads the proxy's per-request CSP nonce. Next stamps it on its own scripts automatically; the
  // theme provider (wired in the design-system task) will take `const nonce = await getRequestNonce()`
  // for the one inline script it adds. Until then the call only opts every page into dynamic rendering.
  await getRequestNonce();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

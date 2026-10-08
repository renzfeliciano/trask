import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/cn";
import { getRequestNonce } from "@/server/http/nonce";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRASK",
  description: "Work moves here.",
};

export const viewport: Viewport = {
  // Lets pages paint under the notch and home indicator; layouts pad with env(safe-area-inset-*).
  viewportFit: "cover",
  // Browser chrome matches the app background in each scheme (--background).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d1f" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The proxy's per-request CSP nonce. Next stamps it on its own scripts; the theme provider needs it
  // for the one inline script that sets the theme class before first paint. Reading it also makes
  // every page dynamically rendered, which nonces require.
  const nonce = await getRequestNonce();

  return (
    // next-themes sets the class on <html> before hydration, so React must not flag the mismatch.
    <html lang="en" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
      <body className="min-h-dvh">
        <ThemeProvider nonce={nonce}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

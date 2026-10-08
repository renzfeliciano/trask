import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "@/components/brand/app-icon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TRASK",
    short_name: "TRASK",
    description: "Work moves here.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7ff",
    theme_color: BRAND_COLORS.primary,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon1/192", sizes: "192x192", type: "image/png" },
      { src: "/icon1/512", sizes: "512x512", type: "image/png" },
      { src: "/icon1/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

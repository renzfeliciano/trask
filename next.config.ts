import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // Mascot art ships as transparent WebP; browsers that accept AVIF get the smaller file.
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

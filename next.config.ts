import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: static shell is prerendered, per-request data streams in behind <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  // pg / Prisma driver adapter must run as native Node modules, not bundled.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "sharp"],
  // Allow a higher quality tier for photos and the logo (default only permits 75).
  images: { qualities: [75, 90] },
  turbopack: {
    root: path.resolve("."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

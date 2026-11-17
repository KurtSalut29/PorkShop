import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: static shell is prerendered, per-request data streams in behind <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  // pg / Prisma driver adapter must run as native Node modules, not bundled.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "sharp"],
  // Other devices may open the dev server (`npm run dev`) by this laptop's Wi-Fi address or
  // through a tunnel, e.g. panelists during a demo. Only affects development; see SETUP.md.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app"],
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

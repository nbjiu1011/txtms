import type { NextConfig } from "next";

/** Origin of the Spring Boot API. Browser calls stay same-origin through the `/api` rewrite. */
const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:4245").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // The dev server may also be opened through the public domain behind the reverse proxy.
  allowedDevOrigins: ["txtms.tagoplus.co.kr"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tailwind runs on the global stylesheet only. A `*.css` glob with `as: "*.css"` would turn
      // `*.module.css` into global CSS (empty class maps) and needlessly process node_modules CSS.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;

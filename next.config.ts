import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/flights/:id/scrape/",
        destination: "http://127.0.0.1:8789/scrape/:id",
      },
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8788/api/:path*",
      },
    ];
  },
};

export default nextConfig;

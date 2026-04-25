import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const dbApiBaseUrl = process.env.DB_API_BASE_URL;

    if (!dbApiBaseUrl) {
      console.warn(
        "DB_API_BASE_URL is not set; falling back to https://dev.doubleu.team/db-api"
      );
    }

    const resolvedUrl = (
      dbApiBaseUrl ?? "https://dev.doubleu.team/db-api"
    ).replace(/\/$/, "");

    return [
      {
        source: "/db-api/:path*",
        destination: `${resolvedUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

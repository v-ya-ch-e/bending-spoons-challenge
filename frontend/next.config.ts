import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const dbApiBaseUrl = (
      process.env.DB_API_BASE_URL ?? "https://dev.doubleu.team/db-api"
    ).replace(/\/$/, "");

    return [
      {
        source: "/db-api/:path*",
        destination: `${dbApiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

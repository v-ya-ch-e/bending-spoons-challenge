import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const dbApiBaseUrl = process.env.DB_API_BASE_URL;

    if (!dbApiBaseUrl) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "DB_API_BASE_URL environment variable is required in production."
        );
      }
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

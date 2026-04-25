import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const dbApiBaseUrl = process.env.DB_API_BASE_URL ?? "http://127.0.0.1:8001";

    return [
      {
        source: "/db-api/:path*",
        destination: `${dbApiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const dbApiBaseUrl = process.env.DB_API_BASE_URL;
    const backendApiBaseUrl = process.env.BACKEND_API_BASE_URL;
    const isDevelopment = process.env.NODE_ENV === "development";

    if (!dbApiBaseUrl) {
      console.warn(
        "DB_API_BASE_URL is not set; falling back to https://dev.doubleu.team/db-api"
      );
    }

    if (!backendApiBaseUrl) {
      console.warn(
        `BACKEND_API_BASE_URL is not set; falling back to ${
          isDevelopment ? "http://127.0.0.1:8000" : "https://dev.doubleu.team/api"
        }`
      );
    }

    const resolvedUrl = (
      dbApiBaseUrl ?? "https://dev.doubleu.team/db-api"
    ).replace(/\/$/, "");
    const resolvedBackendUrl = (
      backendApiBaseUrl ??
      (isDevelopment ? "http://127.0.0.1:8000" : "https://dev.doubleu.team/api")
    ).replace(/\/$/, "");

    return [
      {
        source: "/db-api/:path*",
        destination: `${resolvedUrl}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${resolvedBackendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;

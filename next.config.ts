import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // Next.js API routes that should NOT be proxied to FastAPI
        {
          source: "/api/transcribe",
          destination: "/api/transcribe",
        },
      ],
      afterFiles: [],
      fallback: [
        // Everything else proxied to FastAPI
        {
          source: "/api/:path*",
          destination: `${apiUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;

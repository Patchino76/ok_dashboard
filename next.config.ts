import type { NextConfig } from "next";

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
          destination: "http://127.0.0.1:8000/api/:path*",
        },
      ],
    };
  },
};

export default nextConfig;

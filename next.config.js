/** @type {import('next').NextConfig} */
const apiUrl = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

module.exports = {
  distDir: ".next",

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  reactStrictMode: false,

  images: {
    unoptimized: true,
  },

  poweredByHeader: false,

  env: {
    API_SERVER_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/transcribe", destination: "/api/transcribe" },
      ],
      afterFiles: [],
      fallback: [
        { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
        { source: "/docs", destination: `${apiUrl}/docs` },
        { source: "/openapi.json", destination: `${apiUrl}/openapi.json` },
      ],
    };
  },
};

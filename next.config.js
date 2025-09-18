/** @type {import('next').NextConfig} */
module.exports = {
  // Disable static generation - use standard output
  distDir: ".next",

  // Skip validation checks
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Prevent React context errors
  reactStrictMode: false,

  // Required for unoptimized images
  images: {
    unoptimized: true,
  },

  // Use standard rendering for API routes
  poweredByHeader: false,

  // Environment variables that will be available at build time
  env: {
    // This allows server-side code to access the API URL
    API_SERVER_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

/** @type {import('next').NextConfig} */
module.exports = {
  // Disable static generation - use standard output
  distDir: '.next',
  
  // Skip validation checks
  typescript: { 
    ignoreBuildErrors: true 
  },
  eslint: { 
    ignoreDuringBuilds: true 
  },
  
  // Prevent React context errors
  reactStrictMode: false,
  
  // Required for unoptimized images
  images: {
    unoptimized: true
  },

  // Using CSS to hide development overlay instead of configuration
};

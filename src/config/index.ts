// Configuration file for environment-specific settings

// Get the current environment
const isDevelopment = process.env.NODE_ENV !== 'production';

// Define API URLs (only used by Next.js API routes)
const API_URLS = {
  development: 'http://localhost:8000',
  production: 'http://em-m-db4.ellatzite-med.com:8001'
};

// This URL is only used by Next.js API routes as a proxy to the backend
// Frontend components now use relative URLs to Next.js API routes
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (isDevelopment ? API_URLS.development : API_URLS.production);

// Export environment information
export const config = {
  apiUrl: API_URL,
  environment: isDevelopment ? 'development' : 'production',
};

export default config;

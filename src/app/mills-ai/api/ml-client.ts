import axios from 'axios';

// Create a client specifically for ML API endpoints
export const mlApiClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/ml`,  // Use env var for better browser compatibility
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add response interceptor for error handling
mlApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('ML API request failed:', error)
    console.error('Request URL:', error.config?.url)
    console.error('Base URL:', error.config?.baseURL)
    return Promise.reject(error)
  }
);

// Export as default for backward compatibility
export default mlApiClient;

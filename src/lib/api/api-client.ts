import axios from 'axios';

// Use relative URL to go through Next.js proxy
// This ensures all API calls go through the server proxy which handles the actual backend URL
const API_BASE_URL = '/api';

// Create a centralized API client that will be used throughout the app
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Log the base URL being used
console.log(`API client initialized with baseURL: ${API_BASE_URL}`);

// Add interceptor to log all requests for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;

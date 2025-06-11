import axios from 'axios';

// Create a centralized API client that will be used throughout the app
const apiClient = axios.create({
  baseURL: 'http://em-m-db4.ellatzite-med.com:8001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

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

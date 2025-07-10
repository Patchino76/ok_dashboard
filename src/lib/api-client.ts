import axios from 'axios'

// Create a base API client instance
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Create a specific client for ML API endpoints
const mlApiClient = axios.create({
  baseURL: 'http://localhost:8000',  // Direct connection to FastAPI server
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle API errors (can add global error handling here)
    console.error('API request failed:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for ML API client too
mlApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle API errors (can add global error handling here)
    console.error('ML API request failed:', error)
    return Promise.reject(error)
  }
)

export { apiClient, mlApiClient }

import axios from 'axios'

// Create a base API client instance
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
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

export { apiClient }

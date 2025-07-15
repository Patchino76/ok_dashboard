import axios from 'axios'

// Create a client specifically for ML API endpoints
export const mlApiClient = axios.create({
  // Use absolute URL to the Python backend server instead of relative URL
  baseURL: 'http://localhost:8000/api/v1/ml',
  headers: {
    'Content-Type': 'application/json'
  }
})

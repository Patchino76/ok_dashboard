import axios from 'axios';

// Create API client pointing to the FastAPI backend
const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/v1/ml',  // Direct connection to FastAPI ML router
  headers: {
    'Content-Type': 'application/json'
  }
});

export default apiClient;

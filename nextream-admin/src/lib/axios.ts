import axios from 'axios';

// Create an axios instance with the base URL from environment variables
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8800',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the token to all requests
api.interceptors.request.use(
  (config) => {
    // Get the token from localStorage if it exists
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin-auth-token') : null;
    
    // If the token exists, add it to the headers
    if (token) {
      config.headers.token = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api; 
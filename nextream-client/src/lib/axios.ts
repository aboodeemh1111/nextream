import axios from 'axios';

// Create an axios instance with a relative base URL to work with Next.js rewrites
const api = axios.create({
  baseURL: '/api', // This will be rewritten by Next.js to the appropriate URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the token to all requests
api.interceptors.request.use(
  (config) => {
    // Get the token from localStorage if it exists
    let token = null;
    
    if (typeof window !== 'undefined') {
      // Try to get the token from the user object first
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.accessToken;
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
      
      // Fallback to auth-token if user object doesn't exist
      if (!token) {
        token = localStorage.getItem('auth-token');
      }
    }
    
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

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  (error) => {
    // Avoid console.error here — Next.js treats it as a Console Error overlay.
    // Callers (AuthContext, pages) surface actionable messages to the UI.
    if (process.env.NODE_ENV === 'development') {
      const status = error.response?.status;
      const data = error.response?.data;
      console.warn(
        `API ${status ?? 'error'}: ${error.config?.method?.toUpperCase() ?? ''} ${error.config?.url ?? ''} —`,
        typeof data === 'string' ? data : data?.message || error.message
      );
    }
    return Promise.reject(error);
  }
);

export default api; 
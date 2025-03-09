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
    
    // Log the request for debugging
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      headers: config.headers
    });
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export default api; 
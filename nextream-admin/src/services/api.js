"use client";

import axios from "axios";
import Cookies from "js-cookie";

// Create an axios instance with default config. Use Next.js rewrite proxy to avoid CORS.
const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to add the auth token to every request
api.interceptors.request.use(
  (config) => {
    let token = null;
    if (typeof window !== "undefined") {
      try {
        const storedUser = localStorage.getItem("admin");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          token = parsed?.accessToken || null;
        }
      } catch {}
      if (!token) {
        token = Cookies.get("admin") || null;
      }
    }

    if (token) {
      config.headers["token"] = `Bearer ${token}`;
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
    return response;
  },
  (error) => {
    // Handle 401 errors (unauthorized)
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth-token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

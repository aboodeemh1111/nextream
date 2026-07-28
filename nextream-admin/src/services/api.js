"use client";

import axios from "axios";
import Cookies from "js-cookie";

// Next.js rewrite proxy (/api -> API server) avoids browser CORS in dev.
const api = axios.create({
  baseURL: "/api",
  // Uploads only hit this client for short JSON calls (presign/complete).
  // The file bytes go straight to the bucket via XHR, so this timeout is fine.
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

function readAdminToken() {
  if (typeof window === "undefined") return null;

  try {
    const storedUser = localStorage.getItem("admin");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed?.accessToken) return parsed.accessToken;
    }
  } catch {
    // fall through to cookie
  }

  return Cookies.get("admin") || null;
}

api.interceptors.request.use(
  (config) => {
    const token = readAdminToken();
    if (token) {
      config.headers.token = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("admin");
      Cookies.remove("admin");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

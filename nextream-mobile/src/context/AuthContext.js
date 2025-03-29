import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { API_URL } from "../config";

// Create the Auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user data from secure storage on app start
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userJson = await SecureStore.getItemAsync("user");
        const token = await SecureStore.getItemAsync("token");

        if (userJson && token) {
          const userData = JSON.parse(userJson);
          setUser(userData);

          // Set default axios auth header
          axios.defaults.headers.common["token"] = `Bearer ${token}`;

          // Verify token is still valid with the server
          try {
            await axios.get(`${API_URL}/api/users/profile`, {
              headers: { token: `Bearer ${token}` },
            });
            console.log("User session validated");
          } catch (err) {
            console.log("Token validation failed, logging out");
            logout();
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      const { _id, username, isAdmin, accessToken, ...userData } =
        response.data;

      // We don't want to store admin users in the mobile app as it's for regular users
      if (isAdmin) {
        setError(
          "Admin accounts cannot use the mobile app. Please use a regular user account."
        );
        setLoading(false);
        return;
      }

      // Store user data securely
      const user = { _id, username, ...userData };
      await SecureStore.setItemAsync("user", JSON.stringify(user));
      await SecureStore.setItemAsync("token", accessToken);

      // Set default axios auth header
      axios.defaults.headers.common["token"] = `Bearer ${accessToken}`;

      setUser(user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to login. Please check your credentials."
      );
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (username, email, password) => {
    try {
      setLoading(true);
      setError(null);

      await axios.post(`${API_URL}/api/auth/register`, {
        username,
        email,
        password,
      });

      // Auto login after successful registration
      await login(email, password);
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
      console.error("Registration error:", err);
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Clear stored data
      await SecureStore.deleteItemAsync("user");
      await SecureStore.deleteItemAsync("token");

      // Clear axios auth header
      delete axios.defaults.headers.common["token"];

      // Clear user state
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Check if token is expired
  const isTokenExpired = (token) => {
    if (!token) return true;

    try {
      // JWT tokens are in the format: header.payload.signature
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      const { exp } = JSON.parse(jsonPayload);
      const expired = Date.now() >= exp * 1000;

      return expired;
    } catch (error) {
      console.error("Error checking token expiration:", error);
      return true;
    }
  };

  // Update user profile
  const updateProfile = async (updatedData) => {
    try {
      setLoading(true);
      setError(null);

      const token = await SecureStore.getItemAsync("token");

      const response = await axios.put(`${API_URL}/api/users`, updatedData, {
        headers: { token: `Bearer ${token}` },
      });

      const updatedUser = { ...user, ...response.data };

      // Update stored user data
      await SecureStore.setItemAsync("user", JSON.stringify(updatedUser));

      setUser(updatedUser);
      return { success: true };
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
      console.error("Update profile error:", err);
      return { success: false, error: err.response?.data?.message };
    } finally {
      setLoading(false);
    }
  };

  // Provide the auth context value
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Create a default admin user with a valid token
  const defaultUser = {
    _id: "1",
    username: "admin",
    email: "admin@example.com",
    isAdmin: true,
    accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZjFhZjY0NjI5NzAyOWY5ZmY3ZWM4YiIsImlzQWRtaW4iOnRydWUsImlhdCI6MTcxMDM0NjA4NSwiZXhwIjoxNzEwNzc4MDg1fQ.7_Y_5ylxcRXKvUCm6OGa9VqxY8YgXr5JJpB8K-6vXhE"
  };

  // Initialize state with default admin user
  const [user, setUser] = useState(defaultUser);

  const login = (userData) => {
    console.log('Login bypassed for development');
    setUser(userData);
  };

  const logout = () => {
    setUser(defaultUser); // Reset to default user instead of null
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
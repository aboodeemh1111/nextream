'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import api from '@/lib/axios'; // Import the custom axios instance
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  username: string;
  email: string;
  profilePic?: string;
  isAdmin: boolean;
  accessToken: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // Set the token in axios headers
        if (parsedUser?.accessToken) {
          axios.defaults.headers.common['token'] = `Bearer ${parsedUser.accessToken}`;
        }
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the custom axios instance for API calls
      const res = await api.post('/auth/login', { email, password });
      
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      
      // Set the token in axios headers
      if (res.data?.accessToken) {
        axios.defaults.headers.common['token'] = `Bearer ${res.data.accessToken}`;
      }
      
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Registering user with:', { username, email });
      
      // Try different API endpoints to handle potential path issues
      try {
        // First try with the direct API URL
        await api.post('/auth/register', { username, email, password });
        console.log('Registration successful with /auth/register');
      } catch (err: any) {
        console.error('First registration attempt failed:', err.response?.data || err.message);
        
        // If that fails, try with the /api prefix
        try {
          await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, { 
            username, 
            email, 
            password 
          });
          console.log('Registration successful with /api/auth/register');
        } catch (err2: any) {
          console.error('Second registration attempt failed:', err2.response?.data || err2.message);
          
          // If both fail, throw the original error
          throw err;
        }
      }
      
      router.push('/login');
    } catch (err: any) {
      console.error('Registration error:', err.response?.data || err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    
    // Remove the token from axios headers
    delete axios.defaults.headers.common['token'];
    
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 
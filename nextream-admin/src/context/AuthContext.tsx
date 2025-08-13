'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import api from '@/services/api';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

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
    const storedUser = localStorage.getItem('admin');
    const storedToken = Cookies.get('admin');
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Ensure the token in the user object matches the cookie
        parsedUser.accessToken = storedToken;
        
        if (!parsedUser.isAdmin) {
          console.error('Non-admin user found in storage');
          localStorage.removeItem('admin');
          Cookies.remove('admin');
          setLoading(false);
        } else {
          // Set default axios auth header
          axios.defaults.headers.common['token'] = `Bearer ${storedToken}`;
          console.log('Setting auth token:', `Bearer ${storedToken.substring(0, 15)}...`);
          
          // Verify token is valid by making a test request
          api.get('/users/profile', {
            headers: {
              token: `Bearer ${storedToken}`
            }
          })
          .then(() => {
            setUser(parsedUser);
            console.log('User authenticated successfully');
          })
          .catch(err => {
            console.error('Token validation failed:', err.response?.data || err.message);
            localStorage.removeItem('admin');
            Cookies.remove('admin');
            delete axios.defaults.headers.common['token'];
          })
          .finally(() => {
            setLoading(false);
          });
        }
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('admin');
        Cookies.remove('admin');
        delete axios.defaults.headers.common['token'];
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await api.post('/auth/login', { email, password });
      
      // Check if user is admin
      if (!res.data.isAdmin) {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }
      
      // Store user in localStorage and cookies
      localStorage.setItem('admin', JSON.stringify(res.data));
      Cookies.set('admin', res.data.accessToken, { expires: 7 }); // Expires in 7 days
      
      // Set default axios auth header
      axios.defaults.headers.common['token'] = `Bearer ${res.data.accessToken}`;
      console.log('Setting auth token on login:', `Bearer ${res.data.accessToken.substring(0, 15)}...`);
      
      setUser(res.data);
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Invalid credentials');
      localStorage.removeItem('admin');
      Cookies.remove('admin');
      delete axios.defaults.headers.common['token'];
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('admin');
    Cookies.remove('admin');
    delete axios.defaults.headers.common['token'];
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
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
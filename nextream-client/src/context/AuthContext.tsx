'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import api from '@/lib/axios'; // Import the custom axios instance
import { storedToken } from '@/lib/fcm';
import { unregisterDevice } from '@/lib/notifications';
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
        // Set the token in axios headers.
        //
        // Push registration deliberately does *not* happen here any more. It used
        // to, and it called Notification.requestPermission() on every page load —
        // so the prompt appeared before the viewer had done anything to explain
        // it, and a dismissal is a permanent `denied` that no API can re-ask.
        // NotificationsProvider now refreshes an already-granted registration on
        // load, and only the settings page can prompt. See lib/fcm.ts.
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
      
      // Set the token in axios headers. NotificationsProvider picks the new token
      // up and refreshes any push registration this browser already granted.
      if (res.data?.accessToken) {
        axios.defaults.headers.common['token'] = `Bearer ${res.data.accessToken}`;
      }
      
      router.push('/');
    } catch (err: any) {
      const data = err.response?.data;
      const message =
        (typeof data === 'string' && data) ||
        data?.message ||
        err.message ||
        'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Registering user with:', { username, email });
      
      // Use the local API endpoint which will be proxied through Next.js rewrites
      await api.post('/auth/register', { username, email, password });
      console.log('Registration successful');
      
      router.push('/login');
    } catch (err: any) {
      const data = err.response?.data;
      const message =
        (typeof data === 'string' && data) ||
        data?.message ||
        'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Unhook this browser from the account's pushes *before* the credentials go,
    // since the request needs them. Otherwise a signed-out device keeps buzzing
    // with the previous account's notifications — on a shared computer, to
    // whoever is sitting at it next.
    //
    // The FCM token itself is kept: the permission is still granted, so the next
    // person to sign in is registered silently by NotificationsProvider.
    const pushToken = storedToken();
    if (pushToken) unregisterDevice(pushToken).catch(() => {});

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
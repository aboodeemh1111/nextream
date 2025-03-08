'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { FaLock, FaEnvelope, FaExclamationTriangle, FaInfoCircle, FaSpinner } from 'react-icons/fa';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const { login, user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await login(email, password);
      setLoginAttempts(0); // Reset attempts on successful login
    } catch (err) {
      setLoginAttempts(prev => prev + 1);
      console.error('Login submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if we should show additional help based on login attempts
  const showAdditionalHelp = loginAttempts >= 2;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-red-600">NEXTREAM</h1>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your admin account
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
            <div className="flex items-center">
              <FaExclamationTriangle className="mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {showAdditionalHelp && (
              <div className="mt-2 text-sm">
                <p>Make sure you:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Are using an admin account (regular user accounts cannot access the admin panel)</li>
                  <li>Have entered the correct email and password</li>
                  <li>Have a stable internet connection</li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        {!error && showAdditionalHelp && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-md" role="alert">
            <div className="flex">
              <FaInfoCircle className="mr-2 flex-shrink-0" />
              <span>For demo purposes, you can use: <strong>admin@example.com</strong> / <strong>password</strong></span>
            </div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full pl-10 pr-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-red-600 hover:text-red-500">
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isSubmitting || loading) && (
                <FaSpinner className="animate-spin mr-2" />
              )}
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div className="text-center text-sm text-gray-500 mt-4">
            <p>Use admin credentials to access the dashboard.</p>
            <p className="mt-1">Demo: <span className="font-semibold">admin@example.com</span> / <span className="font-semibold">password</span></p>
            <p className="mt-2 text-xs">Note: This is a demo account. In a production environment, you would use your own admin credentials.</p>
          </div>
        </form>
      </div>
    </div>
  );
} 
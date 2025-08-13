'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { FaEnvelope, FaLock } from 'react-icons/fa';

export default function Login() {
  const AnimatedBackground = dynamic(() => import('@/components/AnimatedBackground'), { ssr: false });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { login, user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Animated background (CSS-driven, no heavy canvas) */}
      <AnimatedBackground />

      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-fuchsia-600/30 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-16 h-64 w-64 rounded-full bg-red-500/20 blur-3xl animate-pulse" />

      {/* Navbar */}
      <div className="relative z-10 px-4 py-6">
        <Link href="/" className="font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-fuchsia-500 to-cyan-400 text-3xl">
          NEXTREAM
        </Link>
      </div>

      {/* Login Form */}
      <div className="relative z-10 flex justify-center items-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl shadow-red-900/10">
          <div className="p-8">
            <h1 className="text-3xl font-extrabold mb-2 text-white">
              Welcome back
            </h1>
            <p className="text-sm text-gray-400 mb-6">Sign in to continue watching</p>

            {error && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-200 p-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <FaEnvelope />
                </span>
                <input
                  type="email"
                  placeholder="Email or phone number"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder:text-gray-400 border border-white/10"
                  required
                />
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <FaLock />
                </span>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder:text-gray-400 border border-white/10"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-600 via-fuchsia-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-fuchsia-600 focus:ring-fuchsia-500 border-gray-300 rounded bg-white/10"
                  />
                  <label htmlFor="remember" className="ml-2 text-gray-400 text-sm">
                    Remember me
                  </label>
                </div>
                
                <a href="#" className="text-gray-400 text-sm hover:text-white">
                  Need help?
                </a>
              </div>
            </form>

            <div className="mt-8">
              <p className="text-gray-400">
                New to Nextream?{' '}
                <Link href="/register" className="text-white hover:underline">
                  Sign up now
                </Link>
              </p>
              
              <p className="text-gray-500 text-xs mt-4">
                Protected by reCAPTCHA to ensure you're not a bot.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
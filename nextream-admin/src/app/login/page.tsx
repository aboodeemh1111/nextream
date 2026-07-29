"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import StreamNetworkBackground from "@/components/StreamNetworkBackground";
import Image from "next/image";
import {
  FaLock,
  FaEnvelope,
  FaExclamationTriangle,
  FaInfoCircle,
  FaSpinner,
} from "react-icons/fa";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const { login, user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
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
      setLoginAttempts((prev) => prev + 1);
      console.error("Login submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if we should show additional help based on login attempts
  const showAdditionalHelp = loginAttempts >= 2;

  const glassField =
    "appearance-none relative block w-full rounded-xl pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-background/35 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 disabled:opacity-60";

  return (
    <div className="relative isolate min-h-screen flex items-center justify-center overflow-hidden bg-background py-12 px-4 sm:px-6 lg:px-8">
      <StreamNetworkBackground />
      <div className="relative z-10 max-w-md w-full space-y-8 overflow-hidden rounded-2xl border border-white/50 dark:border-white/10 bg-card/45 dark:bg-card/40 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.45)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/35">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent dark:from-white/10"
        />

        <div className="relative text-center">
          <Image src="/logo.png" alt="Nextream" width={140} height={50} className="h-12 w-auto mx-auto drop-shadow-sm" />
          <h2 className="mt-4 text-xl font-bold text-foreground">
            Admin Dashboard
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your admin account
          </p>
        </div>

        {error && (
          <div
            className="relative rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300 backdrop-blur-md"
            role="alert"
          >
            <div className="flex items-center">
              <FaExclamationTriangle className="mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {showAdditionalHelp && (
              <div className="mt-2 text-sm">
                <p>Make sure you:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>
                    Are using an admin account (regular user accounts cannot
                    access the admin panel)
                  </li>
                  <li>Have entered the correct email and password</li>
                  <li>Have a stable internet connection</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {!error && showAdditionalHelp && (
          <div
            className="relative rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 text-sky-800 dark:text-sky-200 backdrop-blur-md"
            role="alert"
          >
            <div className="flex">
              <FaInfoCircle className="mr-2 flex-shrink-0" />
              <span>
                For demo purposes, you can use:{" "}
                <strong>user55@gmail.com</strong> / <strong>123</strong>
              </span>
            </div>
          </div>
        )}

        <form className="relative mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <div className="mb-4">
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={glassField}
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
                  <FaLock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={glassField}
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
                className="h-4 w-4 rounded border-white/40 bg-background/40 text-red-600 focus:ring-primary/40 dark:border-white/15"
                disabled={isSubmitting}
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm text-foreground"
              >
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <a
                href="#"
                className="font-medium text-red-600 hover:text-red-500"
              >
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="group relative w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-red-600/90 hover:bg-red-600 border border-white/20 shadow-[0_8px_24px_rgba(220,38,38,0.28),inset_0_1px_0_0_rgba(255,255,255,0.25)] backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(isSubmitting || loading) && (
                <FaSpinner className="animate-spin mr-2" />
              )}
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  FaExclamationTriangle,
  FaInfoCircle,
  FaLock,
  FaEnvelope,
} from "react-icons/fa";
import FuturisticAdminBackground from "@/components/FuturisticAdminBackground";
import FuturisticAdminInput from "@/components/FuturisticAdminInput";
import FuturisticAdminButton from "@/components/FuturisticAdminButton";
import FuturisticAdminCard from "@/components/FuturisticAdminCard";

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

  return (
    <div className="relative min-h-screen w-full bg-slate-900 overflow-hidden">
      {/* Animated Futuristic Background */}
      <FuturisticAdminBackground />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
                NEXTREAM
              </span>
              <span className="text-white ml-1">Admin</span>
            </h1>
            <p className="mt-2 text-slate-400">Content Management System</p>
          </div>

          <FuturisticAdminCard className="w-full" glowColor="blue">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">Admin Access</h2>
              <p className="text-sm text-slate-400 mt-1">
                Sign in to manage your streaming platform
              </p>
            </div>

            {error && (
              <div
                className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-500/30"
                role="alert"
              >
                <div className="flex items-center">
                  <FaExclamationTriangle className="text-red-400 mr-3 flex-shrink-0" />
                  <span className="text-red-200">{error}</span>
                </div>
                {showAdditionalHelp && (
                  <div className="mt-3 text-sm text-red-200/80">
                    <p>Make sure you:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
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
                className="mb-6 p-4 rounded-lg bg-blue-900/30 border border-blue-500/30"
                role="alert"
              >
                <div className="flex">
                  <FaInfoCircle className="text-blue-400 mr-3 flex-shrink-0" />
                  <span className="text-blue-200">
                    For demo purposes, you can use:{" "}
                    <span className="font-semibold">admin@example.com</span> /{" "}
                    <span className="font-semibold">password</span>
                  </span>
                </div>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <FuturisticAdminInput
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  icon="email"
                  label="Email"
                />

                <FuturisticAdminInput
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  icon="password"
                  label="Password"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 opacity-0 absolute"
                    />
                    <div
                      className={`
                        w-4 h-4 border rounded 
                        flex items-center justify-center
                        transition-all duration-200
                        ${
                          rememberMe
                            ? "bg-blue-500 border-blue-500"
                            : "bg-slate-700 border-slate-600"
                        }
                      `}
                    >
                      {rememberMe && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M5 13l4 4L19 7"
                          ></path>
                        </svg>
                      )}
                    </div>
                  </div>
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-slate-400 cursor-pointer"
                  >
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a
                    href="#"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <FuturisticAdminButton
                  type="submit"
                  loading={isSubmitting || loading}
                  fullWidth
                >
                  Sign in
                </FuturisticAdminButton>
              </div>

              <div className="text-center text-sm text-slate-400 mt-4">
                <p>For technical support, contact your system administrator</p>
              </div>
            </form>
          </FuturisticAdminCard>

          <div className="text-center mt-8 text-sm text-slate-500">
            <p>
              © {new Date().getFullYear()} Nextream Admin. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

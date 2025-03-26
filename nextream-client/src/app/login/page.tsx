"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FuturisticBackground from "@/components/FuturisticBackground";
import FuturisticInput from "@/components/FuturisticInput";
import FuturisticButton from "@/components/FuturisticButton";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login, user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Animated Futuristic Background */}
      <FuturisticBackground />

      {/* Blurred glass overlay */}
      <div className="absolute inset-0 z-0 bg-black/10 backdrop-blur-[2px]"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navbar */}
        <div className="px-6 py-6">
          <Link href="/" className="flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 font-bold text-3xl tracking-wider">
              NEXTREAM
            </span>
            <div className="ml-2 w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
          </Link>
        </div>

        {/* Login Form */}
        <div className="flex-1 flex justify-center items-center px-4">
          <div className="w-full max-w-md p-8 rounded-xl backdrop-blur-md bg-black/30 border border-blue-500/20 shadow-xl shadow-blue-900/20">
            <div className="mb-8">
              <h1 className="text-white text-3xl font-bold tracking-wide">
                Welcome Back
              </h1>
              <p className="text-gray-400 mt-2">
                Sign in to continue your streaming experience
              </p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500/50 text-white p-4 rounded-md mb-6 backdrop-blur-sm">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-2 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <FuturisticInput
                  type="email"
                  placeholder="Email or phone number"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <FuturisticInput
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2">
                <FuturisticButton type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </FuturisticButton>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center">
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 opacity-0 absolute"
                    />
                    <div
                      className={`border ${
                        rememberMe
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 border-transparent"
                          : "border-blue-500/40 bg-gray-800/60"
                      } h-4 w-4 rounded-sm flex items-center justify-center transition-all duration-300`}
                    >
                      {rememberMe && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
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
                    htmlFor="remember"
                    className="ml-2 text-gray-300 text-sm cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>

                <a
                  href="#"
                  className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                >
                  Need help?
                </a>
              </div>
            </form>

            <div className="mt-10 pt-4 border-t border-blue-500/20">
              <p className="text-gray-300">
                New to Nextream?{" "}
                <Link
                  href="/register"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                >
                  Sign up now
                </Link>
              </p>

              <p className="text-gray-500 text-sm mt-4">
                This page is protected by Google reCAPTCHA to ensure you're not
                a bot.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

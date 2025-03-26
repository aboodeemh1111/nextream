"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FuturisticBackground from "@/components/FuturisticBackground";
import FuturisticInput from "@/components/FuturisticInput";
import FuturisticButton from "@/components/FuturisticButton";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const { register, user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordError("");
    await register(username, email, password);
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

        {/* Register Form */}
        <div className="flex-1 flex justify-center items-center px-4">
          <div className="w-full max-w-md p-8 rounded-xl backdrop-blur-md bg-black/30 border border-blue-500/20 shadow-xl shadow-blue-900/20">
            <div className="mb-8">
              <h1 className="text-white text-3xl font-bold tracking-wide">
                Create Account
              </h1>
              <p className="text-gray-400 mt-2">
                Join Nextream to start your streaming journey
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
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <FuturisticInput
                  type="email"
                  placeholder="Email"
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

              <div>
                <FuturisticInput
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={
                    passwordError
                      ? "border-red-500/60 ring-1 ring-red-500/60"
                      : ""
                  }
                />
                {passwordError && (
                  <p className="text-red-400 text-sm mt-1.5 ml-1">
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <FuturisticButton type="submit" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Account"}
                </FuturisticButton>
              </div>
            </form>

            <div className="mt-10 pt-4 border-t border-blue-500/20">
              <p className="text-gray-300">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                >
                  Sign in
                </Link>
              </p>

              <p className="text-gray-500 text-sm mt-4">
                By signing up, you agree to our Terms of Use and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

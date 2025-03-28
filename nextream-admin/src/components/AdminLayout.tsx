"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import Header from "./Header";
import FuturisticAdminBackground from "./FuturisticAdminBackground";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showBackground, setShowBackground] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="relative flex justify-center items-center h-screen bg-[var(--color-bg-primary)]">
        <FuturisticAdminBackground />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-[var(--color-accent-primary)] animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-[var(--color-accent-secondary)] animate-spin animation-delay-500"></div>
          </div>
          <p className="mt-4 text-[var(--color-text-secondary)]">
            Loading admin panel...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] relative overflow-hidden">
      {/* Animated background (only visible on certain pages or conditions) */}
      {showBackground && (
        <div className="fixed inset-0 z-0 opacity-30">
          <FuturisticAdminBackground />
        </div>
      )}

      {/* Glass overlay for better readability */}
      <div className="fixed inset-0 z-0 backdrop-blur-[1px] bg-[var(--color-bg-primary)]/10 pointer-events-none"></div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col w-full md:ml-64 relative z-10 transition-all duration-300 ease-in-out">
        <Header />

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        <footer className="bg-glass py-4 px-6 text-center text-[var(--color-text-muted)] text-sm">
          <p>
            © {new Date().getFullYear()} Nextream Admin. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;

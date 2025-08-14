"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 text-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col w-full md:ml-64 transition-all duration-300 ease-in-out">
        <Header />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-900 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        <footer className="bg-gray-950 border-t border-gray-800 py-4 px-6 text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} Nextream Admin</p>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;

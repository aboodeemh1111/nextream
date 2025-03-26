"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FaHome,
  FaUsers,
  FaFilm,
  FaListUl,
  FaChartLine,
  FaCog,
  FaSignOutAlt,
  FaPlus,
  FaBars,
  FaTimes,
  FaChevronRight,
  FaComment,
} from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initialize on mount

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menuItems = [
    { name: "Dashboard", icon: <FaHome className="text-lg" />, path: "/" },
    { name: "Users", icon: <FaUsers className="text-lg" />, path: "/users" },
    { name: "Movies", icon: <FaFilm className="text-lg" />, path: "/movies" },
    { name: "Lists", icon: <FaListUl className="text-lg" />, path: "/lists" },
    {
      name: "Reviews",
      icon: <FaComment className="text-lg" />,
      path: "/reviews",
    },
    {
      name: "Analytics",
      icon: <FaChartLine className="text-lg" />,
      path: "/analytics",
    },
    {
      name: "Test Upload",
      icon: <FaPlus className="text-lg" />,
      path: "/test-upload",
    },
    {
      name: "Settings",
      icon: <FaCog className="text-lg" />,
      path: "/settings",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === path;
    }
    return pathname?.startsWith(path);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Close mobile sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById("mobile-sidebar");
      if (isMobileOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileOpen]);

  // Close mobile sidebar when navigating
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-slate-800 text-white md:hidden focus:outline-none"
        onClick={toggleMobileSidebar}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={toggleMobileSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        id="mobile-sidebar"
        className={`
          fixed top-0 left-0 h-full bg-slate-900 text-white z-40
          transition-all duration-300 ease-in-out shadow-xl
          border-r border-slate-700/50 backdrop-blur-sm
          ${isCollapsed ? "w-20" : "w-64"} 
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} 
          md:translate-x-0
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <Link href="/" className="flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 text-2xl font-bold">
              N
            </span>
            {!isCollapsed && (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 font-bold text-xl ml-1">
                EXTREAM
              </span>
            )}
          </Link>
          <button
            className="text-slate-400 hover:text-white hidden md:block focus:outline-none"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <FaChevronRight /> : <FaTimes />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-6 px-2">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.path}
                  className={`
                    flex items-center px-4 py-3 rounded-lg transition-all duration-200
                    ${
                      isActive(item.path)
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    }
                    relative group overflow-hidden
                  `}
                >
                  {/* Icon pulse animation for active items */}
                  {isActive(item.path) && (
                    <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  )}

                  {/* Icon */}
                  <span className="flex-shrink-0 z-10">{item.icon}</span>

                  {/* Label */}
                  {!isCollapsed && (
                    <span className="ml-3 font-medium z-10">{item.name}</span>
                  )}

                  {/* Highlight effect for active items */}
                  {isActive(item.path) && (
                    <span className="absolute right-0 top-0 h-full w-1 bg-blue-400"></span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 w-full border-t border-slate-700/50 p-4">
          <button
            onClick={handleLogout}
            className={`
              flex items-center text-slate-300 hover:text-white transition-colors w-full
              px-4 py-2 rounded-lg hover:bg-slate-800/70
              ${isCollapsed ? "justify-center" : ""}
            `}
          >
            <FaSignOutAlt className="text-lg" />
            {!isCollapsed && <span className="ml-3 font-medium">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  FaBell,
  FaUser,
  FaSearch,
  FaCog,
  FaSignOutAlt,
  FaQuestion,
  FaMoon,
  FaSun,
} from "react-icons/fa";
import FuturisticAdminInput from "./FuturisticAdminInput";

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode for admin panel
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (showNotifications) setShowNotifications(false);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (showDropdown) setShowDropdown(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // In a real app, you would implement dark mode functionality here
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mock notifications
  const notifications = [
    { id: 1, text: "New user registered", time: "5 minutes ago", read: false },
    { id: 2, text: "New movie uploaded", time: "1 hour ago", read: false },
    { id: 3, text: "System update completed", time: "2 hours ago", read: true },
  ];

  return (
    <header className="backdrop-blur-md bg-slate-800/40 border-b border-slate-700/50 py-3 px-4 md:px-6 flex items-center justify-between shadow-md">
      {/* Left section - Brand (visible on mobile) */}
      <div className="flex items-center md:hidden">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
          NEXTREAM
        </h1>
      </div>

      {/* Middle section - Search */}
      <div className="hidden md:block flex-1 max-w-xl mx-4">
        <FuturisticAdminInput
          type="text"
          placeholder="Search content, users, settings..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          icon="search"
        />
      </div>

      {/* Right section - User actions */}
      <div className="flex items-center space-x-1 md:space-x-4">
        {/* Help button */}
        <button className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors hidden md:block">
          <FaQuestion className="text-lg" />
        </button>

        {/* Dark mode toggle */}
        <button
          className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors hidden md:block"
          onClick={toggleDarkMode}
        >
          {darkMode ? (
            <FaSun className="text-lg" />
          ) : (
            <FaMoon className="text-lg" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-700/50 transition-colors relative"
            onClick={toggleNotifications}
            aria-label="Notifications"
          >
            <FaBell className="text-lg" />
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notifications.filter((n) => !n.read).length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 backdrop-blur-sm rounded-lg shadow-lg py-2 z-50 border border-slate-700/70 max-h-96 overflow-y-auto">
              <div className="px-4 py-2 border-b border-slate-700/50">
                <h3 className="font-semibold text-slate-200">Notifications</h3>
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400 text-center">
                  No notifications
                </div>
              ) : (
                <div>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-slate-700/50 border-l-4 ${
                        notification.read
                          ? "border-transparent"
                          : "border-blue-500"
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-200">
                        {notification.text}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {notification.time}
                      </p>
                    </div>
                  ))}
                  <div className="px-4 py-2 border-t border-slate-700/50 text-center">
                    <button className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User profile */}
        <div className="relative" ref={dropdownRef}>
          <div
            className="flex items-center space-x-2 cursor-pointer p-1 rounded-full hover:bg-slate-700/50 transition-colors"
            onClick={toggleDropdown}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
              {user?.profilePic ? (
                <Image
                  src={user.profilePic}
                  alt={user.username || "User"}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              ) : (
                <FaUser className="text-slate-300" />
              )}
            </div>
            <span className="hidden md:inline-block text-sm font-medium text-slate-200">
              {user?.username || "Admin"}
            </span>
          </div>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 backdrop-blur-sm rounded-lg shadow-lg py-2 z-50 border border-slate-700/70">
              <div className="px-4 py-3 border-b border-slate-700/50">
                <p className="text-sm font-medium text-slate-200">
                  {user?.username || "Admin"}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user?.email || "admin@example.com"}
                </p>
              </div>

              <Link
                href="/profile"
                className="flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <FaUser className="mr-3 text-slate-400" /> Profile
              </Link>

              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <FaCog className="mr-3 text-slate-400" /> Settings
              </Link>

              <div className="border-t border-slate-700/50 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <FaSignOutAlt className="mr-3 text-slate-400" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

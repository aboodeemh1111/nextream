'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FaBell, FaUser, FaSearch, FaCog, FaSignOutAlt, FaQuestion, FaMoon, FaSun, FaDesktop } from 'react-icons/fa';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (showNotifications) setShowNotifications(false);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (showDropdown) setShowDropdown(false);
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = () => {
    if (!mounted) return <FaDesktop className="text-lg" />;
    if (theme === 'light') return <FaSun className="text-lg" />;
    if (theme === 'dark') return <FaMoon className="text-lg" />;
    return <FaDesktop className="text-lg" />;
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mock notifications
  const notifications = [
    { id: 1, text: 'New user registered', time: '5 minutes ago', read: false },
    { id: 2, text: 'New movie uploaded', time: '1 hour ago', read: false },
    { id: 3, text: 'System update completed', time: '2 hours ago', read: true },
  ];

  return (
    <header className="bg-card border-b border-border py-3 px-4 md:px-6 flex items-center justify-between shadow-sm">
      {/* Left section - Brand (visible on mobile) */}
      <div className="flex items-center md:hidden">
        <Image src="/logo.png" alt="Nextream" width={100} height={32} className="h-6 w-auto" />
      </div>

      {/* Middle section - Search */}
      <div className="hidden md:block flex-1 max-w-xl mx-4">
        <div className={`relative transition-all duration-200 ${searchFocused ? 'scale-105' : ''}`}>
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-background border border-border text-foreground placeholder:text-muted-foreground px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <FaSearch className="absolute right-4 top-3 text-muted-foreground" />
        </div>
      </div>

      {/* Right section - User actions */}
      <div className="flex items-center space-x-1 md:space-x-4">
        {/* Help button */}
        <button className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors hidden md:block">
          <FaQuestion className="text-lg" />
        </button>

        {/* Theme toggle: light → dark → system */}
        <button
          className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
          onClick={cycleTheme}
          aria-label={`Theme: ${mounted ? theme ?? 'system' : 'system'}. Click to cycle.`}
          title={mounted ? `Theme: ${theme}` : 'Theme'}
        >
          <ThemeIcon />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors relative"
            onClick={toggleNotifications}
            aria-label="Notifications"
          >
            <FaBell className="text-lg" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {notifications.filter(n => !n.read).length}
            </span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-popover text-popover-foreground rounded-lg shadow-lg py-2 z-50 border border-border max-h-96 overflow-y-auto">
              <div className="px-4 py-2 border-b border-border">
                <h3 className="font-semibold text-foreground">Notifications</h3>
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No notifications
                </div>
              ) : (
                <div>
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-muted border-l-4 ${notification.read ? 'border-transparent' : 'border-red-500'}`}
                    >
                      <p className="text-sm font-medium text-foreground">{notification.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                    </div>
                  ))}
                  <div className="px-4 py-2 border-t border-border text-center">
                    <button className="text-sm text-red-500 hover:text-red-400 font-medium">
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
            className="flex items-center space-x-2 cursor-pointer p-1 rounded-full hover:bg-muted transition-colors"
            onClick={toggleDropdown}
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {user?.profilePic ? (
                <Image
                  src={user.profilePic}
                  alt={user.username || 'User'}
                  width={32}
                  height={32}
                  className="object-cover"
                />
              ) : (
                <FaUser className="text-muted-foreground" />
              )}
            </div>
            <span className="hidden md:inline-block text-sm font-medium text-foreground">
              {user?.username || 'User'}
            </span>
          </div>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-popover text-popover-foreground rounded-lg shadow-lg py-2 z-50 border border-border">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-foreground">{user?.username || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
              </div>

              <Link href="/profile" className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted">
                <FaUser className="mr-3 text-muted-foreground" /> Profile
              </Link>

              <Link href="/settings" className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-muted">
                <FaCog className="mr-3 text-muted-foreground" /> Settings
              </Link>

              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <FaSignOutAlt className="mr-3 text-muted-foreground" /> Logout
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

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  FaChevronRight
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
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

    window.addEventListener('resize', handleResize);
    handleResize(); // Initialize on mount
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { name: 'Dashboard', icon: <FaHome className="text-lg" />, path: '/' },
    { name: 'Users', icon: <FaUsers className="text-lg" />, path: '/users' },
    { name: 'Movies', icon: <FaFilm className="text-lg" />, path: '/movies' },
    { name: 'Lists', icon: <FaListUl className="text-lg" />, path: '/lists' },
    { name: 'Analytics', icon: <FaChartLine className="text-lg" />, path: '/analytics' },
    { name: 'Test Upload', icon: <FaPlus className="text-lg" />, path: '/test-upload' },
    { name: 'Settings', icon: <FaCog className="text-lg" />, path: '/settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
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
    router.push('/login');
  };

  // Close mobile sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('mobile-sidebar');
      if (isMobileOpen && sidebar && !sidebar.contains(event.target as Node)) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileOpen]);

  // Close mobile sidebar when navigating
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-800 text-white md:hidden focus:outline-none focus:ring-2 focus:ring-red-500"
        onClick={toggleMobileSidebar}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggleMobileSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside 
        id="mobile-sidebar"
        className={`
          fixed top-0 left-0 h-full bg-gray-900 text-white z-40
          transition-all duration-300 ease-in-out shadow-xl
          ${isCollapsed ? 'w-20' : 'w-64'} 
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <Link href="/" className="flex items-center">
            <span className="text-red-600 text-2xl font-bold">N</span>
            {!isCollapsed && (
              <span className="font-bold text-red-600 text-xl ml-1">EXTREAM</span>
            )}
          </Link>
          <button 
            className="text-gray-400 hover:text-white hidden md:block focus:outline-none"
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
                    flex items-center px-4 py-3 rounded-lg transition-colors
                    ${isActive(item.path) 
                      ? 'bg-red-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
                  `}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && (
                    <span className="ml-3 font-medium">{item.name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 w-full border-t border-gray-800 p-4">
          <button
            onClick={handleLogout}
            className={`
              flex items-center text-gray-300 hover:text-white transition-colors w-full
              px-4 py-2 rounded-lg hover:bg-gray-800
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <FaSignOutAlt className="text-lg" />
            {!isCollapsed && (
              <span className="ml-3 font-medium">Logout</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 
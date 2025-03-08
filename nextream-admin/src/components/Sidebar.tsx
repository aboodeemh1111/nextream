'use client';

import { useState } from 'react';
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
  FaTimes
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const menuItems = [
    { name: 'Dashboard', icon: <FaHome />, path: '/' },
    { name: 'Users', icon: <FaUsers />, path: '/users' },
    { name: 'Movies', icon: <FaFilm />, path: '/movies' },
    { name: 'Lists', icon: <FaListUl />, path: '/lists' },
    { name: 'Analytics', icon: <FaChartLine />, path: '/analytics' },
    { name: 'Test Upload', icon: <FaPlus />, path: '/test-upload' },
    { name: 'Settings', icon: <FaCog />, path: '/settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === path;
    }
    return pathname.startsWith(path);
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

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-gray-800 text-white md:hidden"
        onClick={toggleMobileSidebar}
      >
        {isMobileOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar for Mobile */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden ${isMobileOpen ? 'block' : 'hidden'}`}
        onClick={toggleMobileSidebar}
      ></div>

      <aside 
        className={`
          fixed top-0 left-0 h-full bg-gray-900 text-white z-40
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'} 
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h1 className={`font-bold text-red-600 text-xl ${isCollapsed ? 'hidden' : 'block'}`}>
            NEXTREAM ADMIN
          </h1>
          <button 
            className="text-gray-400 hover:text-white hidden md:block"
            onClick={toggleSidebar}
          >
            {isCollapsed ? <FaBars /> : <FaTimes />}
          </button>
        </div>

        <nav className="mt-6">
          <ul>
            {menuItems.map((item) => (
              <li key={item.name} className="mb-2">
                <Link
                  href={item.path}
                  className={`
                    flex items-center px-4 py-3 hover:bg-gray-800 transition-colors
                    ${isActive(item.path) ? 'bg-gray-800 border-l-4 border-red-600' : ''}
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className={`ml-4 ${isCollapsed ? 'hidden' : 'block'}`}>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full border-t border-gray-800 p-4">
          <button
            onClick={handleLogout}
            className={`
              flex items-center text-gray-400 hover:text-white transition-colors
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <FaSignOutAlt />
            <span className={`ml-4 ${isCollapsed ? 'hidden' : 'block'}`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Content Wrapper */}
      <div 
        className={`
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}
        `}
      >
        {/* This is where the main content will go */}
      </div>
    </>
  );
};

export default Sidebar; 
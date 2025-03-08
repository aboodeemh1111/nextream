'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FaBell, FaUser, FaSearch, FaCog, FaSignOutAlt } from 'react-icons/fa';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <header className="bg-gray-800 text-white py-3 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center">
        <div className="md:hidden w-8"></div>
        <h1 className="text-xl font-bold text-red-600 md:hidden">NEXTREAM</h1>
      </div>
      
      <div className="flex-1 max-w-xl mx-4 hidden md:block">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <FaSearch className="absolute right-4 top-3 text-gray-400" />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="text-gray-300 hover:text-white relative">
          <FaBell className="text-xl" />
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            3
          </span>
        </button>
        
        <div className="relative">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={toggleDropdown}
          >
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
              {user?.profilePic ? (
                <Image 
                  src={user.profilePic} 
                  alt={user.username} 
                  width={32} 
                  height={32} 
                  className="object-cover"
                />
              ) : (
                <FaUser className="text-white" />
              )}
            </div>
            <span className="hidden md:inline-block">{user?.username}</span>
          </div>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-700">
              <Link href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center">
                <FaUser className="mr-2" /> Profile
              </Link>
              <Link href="/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center">
                <FaCog className="mr-2" /> Settings
              </Link>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
              >
                <FaSignOutAlt className="mr-2" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header; 
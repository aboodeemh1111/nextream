'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FaSearch, FaBell, FaUser, FaSignOutAlt, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
      setShowSearch(false);
    }
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      // Focus the input when search is shown
      setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }, 100);
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-black bg-opacity-90' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="text-red-600 font-bold text-2xl mr-8">
            NEXTREAM
          </Link>
          <div className="hidden md:flex space-x-6">
            <Link href="/" className="text-white hover:text-gray-300">
              Home
            </Link>
            <Link href="/movies" className="text-white hover:text-gray-300">
              Movies
            </Link>
            <Link href="/series" className="text-white hover:text-gray-300">
              Series
            </Link>
            <Link href="/mylist" className="text-white hover:text-gray-300">
              My List
            </Link>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Desktop Search */}
          <div className="relative hidden md:block">
            <form onSubmit={handleSearch}>
              <input 
                type="text" 
                id="search-input-desktop"
                placeholder="Search titles, genres..." 
                className="bg-black bg-opacity-50 text-white px-3 py-1 pl-10 rounded-full border border-gray-600 focus:outline-none focus:border-gray-400 w-48 transition-all duration-300 focus:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="absolute left-3 top-2 text-gray-400">
                <FaSearch />
              </button>
            </form>
          </div>
          
          {/* Mobile Search Icon */}
          <button 
            onClick={toggleSearch} 
            className="text-white md:hidden"
            aria-label="Search"
          >
            {showSearch ? <FaTimes /> : <FaSearch />}
          </button>
          
          <FaBell className="text-white" />
          
          <div className="relative">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={() => setShowDropdown(!showDropdown)}
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
            </div>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-black bg-opacity-90 rounded-md shadow-lg py-1 z-50 border border-gray-800">
                <div className="px-4 py-2 text-sm text-gray-300 border-b border-gray-800">
                  {user?.username}
                </div>
                <Link href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
                  Profile
                </Link>
                <Link href="/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
                  Settings
                </Link>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 flex items-center"
                >
                  <FaSignOutAlt className="mr-2" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Search Bar - Full Width */}
      {showSearch && (
        <div className="w-full bg-black bg-opacity-90 py-3 px-4 md:hidden">
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text" 
              id="search-input"
              placeholder="Search titles, genres..." 
              className="bg-black bg-opacity-50 text-white px-3 py-2 pl-10 rounded-full border border-gray-600 focus:outline-none focus:border-gray-400 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="absolute left-3 top-2.5 text-gray-400">
              <FaSearch />
            </button>
          </form>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 
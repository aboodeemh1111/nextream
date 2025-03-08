'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { FaSearch, FaBell, FaUser, FaSignOutAlt, FaTimes, FaFilter } from 'react-icons/fa';
import axios from 'axios';

interface SearchSuggestion {
  _id: string;
  title: string;
  img: string;
  imgSm?: string;
  genre?: string;
  year?: string;
  isSeries?: boolean;
}

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchType, setSearchType] = useState<string>('all');
  const [searchGenre, setSearchGenre] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }

    // Handle clicks outside of search suggestions
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        setIsLoading(true);
        const res = await axios.get(`/api/movies/suggestions?q=${encodeURIComponent(searchTerm)}`, {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        });
        setSuggestions(res.data);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search suggestions
    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim()) {
        fetchSuggestions();
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, user]);

  const handleLogout = () => {
    logout();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Save to recent searches
      const updatedSearches = [
        searchTerm.trim(),
        ...recentSearches.filter(s => s !== searchTerm.trim())
      ].slice(0, 5); // Keep only 5 most recent searches
      
      setRecentSearches(updatedSearches);
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      
      // Build search URL with parameters
      let searchUrl = `/search?q=${encodeURIComponent(searchTerm.trim())}`;
      if (searchType !== 'all') {
        searchUrl += `&type=${searchType}`;
      }
      if (searchGenre) {
        searchUrl += `&genre=${encodeURIComponent(searchGenre)}`;
      }
      
      router.push(searchUrl);
      setSearchTerm('');
      setShowSuggestions(false);
      setShowSearch(false);
      setShowAdvancedSearch(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    router.push(`/details/${suggestion._id}`);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleRecentSearchClick = (term: string) => {
    setSearchTerm(term);
    handleSearch(new Event('submit') as unknown as React.FormEvent);
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      // Focus the input when search is shown
      setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }, 100);
    } else {
      setShowSuggestions(false);
      setShowAdvancedSearch(false);
    }
  };

  const toggleAdvancedSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowAdvancedSearch(!showAdvancedSearch);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    const searchInput = document.getElementById('search-input') || document.getElementById('search-input-desktop');
    if (searchInput) searchInput.focus();
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
          <div className="relative hidden md:block" ref={searchRef}>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input 
                  type="text" 
                  id="search-input-desktop"
                  placeholder="Search titles, genres..." 
                  className="bg-black bg-opacity-50 text-white px-3 py-1 pl-10 rounded-full border border-gray-600 focus:outline-none focus:border-gray-400 w-48 transition-all duration-300 focus:w-64"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                <button type="submit" className="absolute left-3 top-2 text-gray-400">
                  <FaSearch />
                </button>
                {searchTerm && (
                  <button 
                    type="button" 
                    className="absolute right-10 top-2 text-gray-400 hover:text-white"
                    onClick={clearSearch}
                  >
                    <FaTimes size={14} />
                  </button>
                )}
                <button 
                  type="button" 
                  className={`absolute right-3 top-2 ${showAdvancedSearch ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}
                  onClick={toggleAdvancedSearch}
                  aria-label="Advanced Search"
                >
                  <FaFilter size={14} />
                </button>
              </div>
              
              {/* Advanced Search Options */}
              {showAdvancedSearch && (
                <div className="absolute top-full mt-2 right-0 bg-black bg-opacity-90 rounded-md shadow-lg p-4 w-64 border border-gray-800 z-50">
                  <h3 className="text-white text-sm font-semibold mb-3">Advanced Search</h3>
                  
                  <div className="mb-3">
                    <label className="block text-gray-300 text-xs mb-1">Type</label>
                    <select 
                      className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="movie">Movies</option>
                      <option value="series">Series</option>
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-gray-300 text-xs mb-1">Genre</label>
                    <select 
                      className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                      value={searchGenre}
                      onChange={(e) => setSearchGenre(e.target.value)}
                    >
                      <option value="">Any Genre</option>
                      <option value="action">Action</option>
                      <option value="comedy">Comedy</option>
                      <option value="crime">Crime</option>
                      <option value="fantasy">Fantasy</option>
                      <option value="historical">Historical</option>
                      <option value="horror">Horror</option>
                      <option value="romance">Romance</option>
                      <option value="sci-fi">Sci-fi</option>
                      <option value="thriller">Thriller</option>
                      <option value="western">Western</option>
                      <option value="animation">Animation</option>
                      <option value="drama">Drama</option>
                      <option value="documentary">Documentary</option>
                    </select>
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full bg-red-600 text-white text-sm py-1 rounded hover:bg-red-700"
                  >
                    Search
                  </button>
                </div>
              )}
              
              {/* Search Suggestions */}
              {showSuggestions && (searchTerm.trim().length > 0 || recentSearches.length > 0) && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-black bg-opacity-90 rounded-md shadow-lg py-2 border border-gray-800 z-50 max-h-96 overflow-y-auto">
                  {isLoading && (
                    <div className="px-4 py-2 text-gray-400 text-sm">Loading...</div>
                  )}
                  
                  {!isLoading && searchTerm.trim().length > 0 && suggestions.length === 0 && (
                    <div className="px-4 py-2 text-gray-400 text-sm">No results found</div>
                  )}
                  
                  {suggestions.length > 0 && (
                    <div>
                      <div className="px-4 py-1 text-xs text-gray-500 uppercase">Suggestions</div>
                      {suggestions.map((suggestion) => (
                        <div 
                          key={suggestion._id} 
                          className="px-4 py-2 hover:bg-gray-800 cursor-pointer flex items-center"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          <div className="w-10 h-10 mr-3 relative flex-shrink-0">
                            <Image 
                              src={suggestion.imgSm || suggestion.img} 
                              alt={suggestion.title}
                              fill
                              sizes="40px"
                              className="object-cover rounded"
                            />
                          </div>
                          <div>
                            <div className="text-white text-sm">{suggestion.title}</div>
                            <div className="text-gray-400 text-xs flex items-center">
                              <span className="mr-2">{suggestion.isSeries ? 'Series' : 'Movie'}</span>
                              {suggestion.year && <span className="mr-2">• {suggestion.year}</span>}
                              {suggestion.genre && <span>• {suggestion.genre}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {recentSearches.length > 0 && searchTerm.trim().length === 0 && (
                    <div>
                      <div className="px-4 py-1 text-xs text-gray-500 uppercase">Recent Searches</div>
                      {recentSearches.map((term, index) => (
                        <div 
                          key={index} 
                          className="px-4 py-2 hover:bg-gray-800 cursor-pointer flex items-center"
                          onClick={() => handleRecentSearchClick(term)}
                        >
                          <FaSearch className="text-gray-400 mr-3" />
                          <span className="text-white text-sm">{term}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
        <div className="w-full bg-black bg-opacity-90 py-3 px-4 md:hidden" ref={searchRef}>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input 
                type="text" 
                id="search-input"
                placeholder="Search titles, genres..." 
                className="bg-black bg-opacity-50 text-white px-3 py-2 pl-10 rounded-full border border-gray-600 focus:outline-none focus:border-gray-400 w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              <button type="submit" className="absolute left-3 top-2.5 text-gray-400">
                <FaSearch />
              </button>
              {searchTerm && (
                <button 
                  type="button" 
                  className="absolute right-10 top-2.5 text-gray-400 hover:text-white"
                  onClick={clearSearch}
                >
                  <FaTimes size={14} />
                </button>
              )}
              <button 
                type="button" 
                className={`absolute right-3 top-2.5 ${showAdvancedSearch ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}
                onClick={toggleAdvancedSearch}
                aria-label="Advanced Search"
              >
                <FaFilter size={14} />
              </button>
            </div>
            
            {/* Mobile Advanced Search */}
            {showAdvancedSearch && (
              <div className="mt-3 bg-black bg-opacity-90 rounded-md p-3 border border-gray-800">
                <div className="mb-2">
                  <label className="block text-gray-300 text-xs mb-1">Type</label>
                  <select 
                    className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="movie">Movies</option>
                    <option value="series">Series</option>
                  </select>
                </div>
                
                <div className="mb-2">
                  <label className="block text-gray-300 text-xs mb-1">Genre</label>
                  <select 
                    className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
                    value={searchGenre}
                    onChange={(e) => setSearchGenre(e.target.value)}
                  >
                    <option value="">Any Genre</option>
                    <option value="action">Action</option>
                    <option value="comedy">Comedy</option>
                    <option value="crime">Crime</option>
                    <option value="fantasy">Fantasy</option>
                    <option value="historical">Historical</option>
                    <option value="horror">Horror</option>
                    <option value="romance">Romance</option>
                    <option value="sci-fi">Sci-fi</option>
                    <option value="thriller">Thriller</option>
                    <option value="western">Western</option>
                    <option value="animation">Animation</option>
                    <option value="drama">Drama</option>
                    <option value="documentary">Documentary</option>
                  </select>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white text-sm py-1 rounded hover:bg-red-700"
                >
                  Search
                </button>
              </div>
            )}
            
            {/* Mobile Search Suggestions */}
            {showSuggestions && (searchTerm.trim().length > 0 || recentSearches.length > 0) && (
              <div className="mt-2 bg-black bg-opacity-90 rounded-md shadow-lg py-2 border border-gray-800 max-h-96 overflow-y-auto">
                {isLoading && (
                  <div className="px-4 py-2 text-gray-400 text-sm">Loading...</div>
                )}
                
                {!isLoading && searchTerm.trim().length > 0 && suggestions.length === 0 && (
                  <div className="px-4 py-2 text-gray-400 text-sm">No results found</div>
                )}
                
                {suggestions.length > 0 && (
                  <div>
                    <div className="px-4 py-1 text-xs text-gray-500 uppercase">Suggestions</div>
                    {suggestions.map((suggestion) => (
                      <div 
                        key={suggestion._id} 
                        className="px-4 py-2 hover:bg-gray-800 cursor-pointer flex items-center"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <div className="w-10 h-10 mr-3 relative flex-shrink-0">
                          <Image 
                            src={suggestion.imgSm || suggestion.img} 
                            alt={suggestion.title}
                            fill
                            sizes="40px"
                            className="object-cover rounded"
                          />
                        </div>
                        <div>
                          <div className="text-white text-sm">{suggestion.title}</div>
                          <div className="text-gray-400 text-xs flex items-center">
                            <span className="mr-2">{suggestion.isSeries ? 'Series' : 'Movie'}</span>
                            {suggestion.year && <span className="mr-2">• {suggestion.year}</span>}
                            {suggestion.genre && <span>• {suggestion.genre}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {recentSearches.length > 0 && searchTerm.trim().length === 0 && (
                  <div>
                    <div className="px-4 py-1 text-xs text-gray-500 uppercase">Recent Searches</div>
                    {recentSearches.map((term, index) => (
                      <div 
                        key={index} 
                        className="px-4 py-2 hover:bg-gray-800 cursor-pointer flex items-center"
                        onClick={() => handleRecentSearchClick(term)}
                      >
                        <FaSearch className="text-gray-400 mr-3" />
                        <span className="text-white text-sm">{term}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 
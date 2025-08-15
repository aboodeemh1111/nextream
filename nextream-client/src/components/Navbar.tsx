"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  FaSearch,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaTimes,
  FaFilter,
} from "react-icons/fa";
import axios from "axios";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchType, setSearchType] = useState<string>("all");
  const [searchGenre, setSearchGenre] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      _id: string;
      title?: string;
      body?: string;
      data?: any;
      read?: boolean;
      createdAt?: string;
    }>
  >([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    // Load recent searches from localStorage
    const savedSearches = localStorage.getItem("recentSearches");
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }

    // Handle clicks outside of search and notifications
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
    if (!user?.accessToken) return;
    try {
      setNotifLoading(true);
      const res = await axios.get("/api/notifications", {
        headers: { token: `Bearer ${user.accessToken}` },
      });
      const items = Array.isArray(res.data) ? res.data : [];
      setNotifications(items);
      setNotifUnread(items.filter((n: any) => !n.read).length);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (user?.accessToken) {
      fetchNotifications().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.accessToken]);

  const openNotification = async (n: {
    _id: string;
    data?: any;
    read?: boolean;
  }) => {
    try {
      if (!n.read) {
        await axios.patch(`/api/notifications/${n._id}/read`, null, {
          headers: { token: `Bearer ${user?.accessToken}` },
        });
        setNotifications((prev) =>
          prev.map((it) => (it._id === n._id ? { ...it, read: true } : it))
        );
        setNotifUnread((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      // ignore
    }
    const link = n?.data?.deepLink || "/";
    router.push(link);
    setShowNotifications(false);
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        setIsLoading(true);
        const res = await axios.get(
          `/api/movies/suggestions?q=${encodeURIComponent(searchTerm)}`,
          {
            headers: {
              token: `Bearer ${user?.accessToken}`,
            },
          }
        );
        setSuggestions(res.data);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
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
        ...recentSearches.filter((s) => s !== searchTerm.trim()),
      ].slice(0, 5); // Keep only 5 most recent searches

      setRecentSearches(updatedSearches);
      localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));

      // Build search URL with parameters
      let searchUrl = `/search?q=${encodeURIComponent(searchTerm.trim())}`;
      if (searchType !== "all") {
        searchUrl += `&type=${searchType}`;
      }
      if (searchGenre) {
        searchUrl += `&genre=${encodeURIComponent(searchGenre)}`;
      }

      router.push(searchUrl);
      setSearchTerm("");
      setShowSuggestions(false);
      setShowSearch(false);
      setShowAdvancedSearch(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    router.push(`/details/${suggestion._id}`);
    setSearchTerm("");
    setShowSuggestions(false);
  };

  const handleRecentSearchClick = (term: string) => {
    setSearchTerm(term);
    handleSearch(new Event("submit") as unknown as React.FormEvent);
  };

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      // Focus the input when search is shown
      setTimeout(() => {
        const searchInput = document.getElementById("search-input");
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
    setSearchTerm("");
    setSuggestions([]);
    const searchInput =
      document.getElementById("search-input") ||
      document.getElementById("search-input-desktop");
    if (searchInput) searchInput.focus();
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-black/80 backdrop-blur-md"
          : "bg-gradient-to-b from-black/60 to-transparent"
      }`}
    >
      {/* Decorative gradient underline */}
      <div className="pointer-events-none absolute inset-x-0 top-full h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />

      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="mr-8">
            <span className="font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-fuchsia-500 to-cyan-400 text-2xl">
              NEXTREAM
            </span>
          </Link>
          <div className="hidden md:flex space-x-6">
            <Link href="/" className="text-white/90 hover:text-white">
              Home
            </Link>
            <Link href="/movies" className="text-white/90 hover:text-white">
              Movies
            </Link>
            <Link href="/series" className="text-white/90 hover:text-white">
              Series
            </Link>
            <Link href="/mylist" className="text-white/90 hover:text-white">
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
                <button
                  type="submit"
                  className="absolute left-3 top-2 text-gray-400"
                >
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
                  className={`absolute right-3 top-2 ${
                    showAdvancedSearch ? "text-red-500" : "text-gray-400"
                  } hover:text-red-500`}
                  onClick={toggleAdvancedSearch}
                  aria-label="Advanced Search"
                >
                  <FaFilter size={14} />
                </button>
              </div>

              {/* Advanced Search Options */}
              {showAdvancedSearch && (
                <div className="absolute top-full mt-2 right-0 bg-black/70 backdrop-blur-md rounded-xl shadow-2xl p-4 w-64 border border-white/10 z-50">
                  <h3 className="text-white text-sm font-semibold mb-3">
                    Advanced Search
                  </h3>

                  <div className="mb-3">
                    <label className="block text-gray-300 text-xs mb-1">
                      Type
                    </label>
                    <select
                      className="w-full bg-white/5 text-white text-sm rounded px-2 py-1 border border-white/10"
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                    >
                      <option className="bg-black text-white" value="all">
                        All
                      </option>
                      <option className="bg-black text-white" value="movie">
                        Movies
                      </option>
                      <option className="bg-black text-white" value="series">
                        Series
                      </option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="block text-gray-300 text-xs mb-1">
                      Genre
                    </label>
                    <select
                      className="w-full bg-white/5 text-white text-sm rounded px-2 py-1 border border-white/10"
                      value={searchGenre}
                      onChange={(e) => setSearchGenre(e.target.value)}
                    >
                      <option className="bg-black text-white" value="">
                        Any Genre
                      </option>
                      <option className="bg-black text-white" value="action">
                        Action
                      </option>
                      <option className="bg-black text-white" value="comedy">
                        Comedy
                      </option>
                      <option className="bg-black text-white" value="crime">
                        Crime
                      </option>
                      <option className="bg-black text-white" value="fantasy">
                        Fantasy
                      </option>
                      <option
                        className="bg-black text-white"
                        value="historical"
                      >
                        Historical
                      </option>
                      <option className="bg-black text-white" value="horror">
                        Horror
                      </option>
                      <option className="bg-black text-white" value="romance">
                        Romance
                      </option>
                      <option className="bg-black text-white" value="sci-fi">
                        Sci-fi
                      </option>
                      <option className="bg-black text-white" value="thriller">
                        Thriller
                      </option>
                      <option className="bg-black text-white" value="western">
                        Western
                      </option>
                      <option className="bg-black text-white" value="animation">
                        Animation
                      </option>
                      <option className="bg-black text-white" value="drama">
                        Drama
                      </option>
                      <option
                        className="bg-black text-white"
                        value="documentary"
                      >
                        Documentary
                      </option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-red-600 via-fuchsia-600 to-cyan-600 text-white text-sm py-1.5 rounded-lg hover:opacity-90"
                  >
                    Search
                  </button>
                </div>
              )}

              {/* Search Suggestions */}
              {showSuggestions &&
                (searchTerm.trim().length > 0 || recentSearches.length > 0) && (
                  <div className="absolute top-full mt-2 left-0 right-0 bg-black bg-opacity-90 rounded-md shadow-lg py-2 border border-gray-800 z-50 max-h-96 overflow-y-auto">
                    {isLoading && (
                      <div className="px-4 py-2 text-gray-400 text-sm">
                        Loading...
                      </div>
                    )}

                    {!isLoading &&
                      searchTerm.trim().length > 0 &&
                      suggestions.length === 0 && (
                        <div className="px-4 py-2 text-gray-400 text-sm">
                          No results found
                        </div>
                      )}

                    {suggestions.length > 0 && (
                      <div>
                        <div className="px-4 py-1 text-xs text-gray-500 uppercase">
                          Suggestions
                        </div>
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
                              <div className="text-white text-sm">
                                {suggestion.title}
                              </div>
                              <div className="text-gray-400 text-xs flex items-center">
                                <span className="mr-2">
                                  {suggestion.isSeries ? "Series" : "Movie"}
                                </span>
                                {suggestion.year && (
                                  <span className="mr-2">
                                    • {suggestion.year}
                                  </span>
                                )}
                                {suggestion.genre && (
                                  <span>• {suggestion.genre}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {recentSearches.length > 0 &&
                      searchTerm.trim().length === 0 && (
                        <div>
                          <div className="px-4 py-1 text-xs text-gray-500 uppercase">
                            Recent Searches
                          </div>
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

          <div className="hidden md:block w-px h-6 bg-white/10" />
          <div className="relative" ref={notifRef}>
            <button
              className="relative text-white/90 hover:text-white"
              aria-label="Notifications"
              onClick={() => {
                const next = !showNotifications;
                setShowNotifications(next);
                if (next) fetchNotifications();
              }}
            >
              <FaBell />
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full">
                  {notifUnread}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-black/70 backdrop-blur-md rounded-xl shadow-2xl border border-white/10 z-50">
                <div className="px-4 py-2 text-sm text-gray-300 border-b border-gray-800 flex items-center justify-between">
                  <span>Notifications</span>
                  <button
                    className="text-xs text-gray-400 hover:text-white"
                    onClick={() => fetchNotifications()}
                  >
                    Refresh
                  </button>
                </div>
                {notifLoading ? (
                  <div className="p-4 text-gray-400 text-sm">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-gray-400 text-sm">
                    No notifications
                  </div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {notifications.map((n) => (
                      <li
                        key={n._id}
                        className={`p-3 cursor-pointer hover:bg-white/5 ${
                          n.read ? "opacity-80" : ""
                        }`}
                        onClick={() => openNotification(n)}
                      >
                        <div className="text-white text-sm font-medium line-clamp-1">
                          {n.title || "Notification"}
                        </div>
                        {n.body && (
                          <div className="text-gray-300 text-xs mt-0.5 line-clamp-2">
                            {n.body}
                          </div>
                        )}
                        {n.createdAt && (
                          <div className="text-gray-500 text-[11px] mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <div
              className="flex items-center cursor-pointer"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden backdrop-blur">
                {user?.profilePic ? (
                  <Image
                    src={user.profilePic}
                    alt={user.username}
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                ) : (
                  <FaUser className="text-white/90" />
                )}
              </div>
            </div>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-black/70 backdrop-blur-md rounded-xl shadow-2xl py-2 z-50 border border-white/10">
                <div className="px-4 py-2 text-sm text-gray-300 border-b border-gray-800">
                  {user?.username}
                </div>
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10 flex items-center"
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
        <div
          className="w-full bg-black/70 backdrop-blur-md py-3 px-4 md:hidden"
          ref={searchRef}
        >
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                id="search-input"
                placeholder="Search titles, genres..."
                className="bg-white/5 text-white px-3 py-2 pl-10 rounded-full border border-white/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              <button
                type="submit"
                className="absolute left-3 top-2.5 text-gray-400"
              >
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
                className={`absolute right-3 top-2.5 ${
                  showAdvancedSearch ? "text-red-500" : "text-gray-400"
                } hover:text-red-500`}
                onClick={toggleAdvancedSearch}
                aria-label="Advanced Search"
              >
                <FaFilter size={14} />
              </button>
            </div>

            {/* Mobile Advanced Search */}
            {showAdvancedSearch && (
              <div className="mt-3 bg-black/70 backdrop-blur-md rounded-xl p-3 border border-white/10">
                <div className="mb-2">
                  <label className="block text-gray-300 text-xs mb-1">
                    Type
                  </label>
                  <select
                    className="w-full bg-white/5 text-white text-sm rounded px-2 py-1 border border-white/10"
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                  >
                    <option className="bg-black text-white" value="all">
                      All
                    </option>
                    <option className="bg-black text-white" value="movie">
                      Movies
                    </option>
                    <option className="bg-black text-white" value="series">
                      Series
                    </option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="block text-gray-300 text-xs mb-1">
                    Genre
                  </label>
                  <select
                    className="w-full bg-white/5 text-white text-sm rounded px-2 py-1 border border-white/10"
                    value={searchGenre}
                    onChange={(e) => setSearchGenre(e.target.value)}
                  >
                    <option className="bg-black text-white" value="">
                      Any Genre
                    </option>
                    <option className="bg-black text-white" value="action">
                      Action
                    </option>
                    <option className="bg-black text-white" value="comedy">
                      Comedy
                    </option>
                    <option className="bg-black text-white" value="crime">
                      Crime
                    </option>
                    <option className="bg-black text-white" value="fantasy">
                      Fantasy
                    </option>
                    <option className="bg-black text-white" value="historical">
                      Historical
                    </option>
                    <option className="bg-black text-white" value="horror">
                      Horror
                    </option>
                    <option className="bg-black text-white" value="romance">
                      Romance
                    </option>
                    <option className="bg-black text-white" value="sci-fi">
                      Sci-fi
                    </option>
                    <option className="bg-black text-white" value="thriller">
                      Thriller
                    </option>
                    <option className="bg-black text-white" value="western">
                      Western
                    </option>
                    <option className="bg-black text-white" value="animation">
                      Animation
                    </option>
                    <option className="bg-black text-white" value="drama">
                      Drama
                    </option>
                    <option className="bg-black text-white" value="documentary">
                      Documentary
                    </option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-600 via-fuchsia-600 to-cyan-600 text-white text-sm py-1.5 rounded-lg hover:opacity-90"
                >
                  Search
                </button>
              </div>
            )}

            {/* Mobile Search Suggestions */}
            {showSuggestions &&
              (searchTerm.trim().length > 0 || recentSearches.length > 0) && (
                <div className="mt-2 bg-black/70 backdrop-blur-md rounded-xl shadow-2xl py-2 border border-white/10 max-h-96 overflow-y-auto">
                  {isLoading && (
                    <div className="px-4 py-2 text-gray-400 text-sm">
                      Loading...
                    </div>
                  )}

                  {!isLoading &&
                    searchTerm.trim().length > 0 &&
                    suggestions.length === 0 && (
                      <div className="px-4 py-2 text-gray-400 text-sm">
                        No results found
                      </div>
                    )}

                  {suggestions.length > 0 && (
                    <div>
                      <div className="px-4 py-1 text-xs text-gray-500 uppercase">
                        Suggestions
                      </div>
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
                            <div className="text-white text-sm">
                              {suggestion.title}
                            </div>
                            <div className="text-gray-400 text-xs flex items-center">
                              <span className="mr-2">
                                {suggestion.isSeries ? "Series" : "Movie"}
                              </span>
                              {suggestion.year && (
                                <span className="mr-2">
                                  • {suggestion.year}
                                </span>
                              )}
                              {suggestion.genre && (
                                <span>• {suggestion.genre}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {recentSearches.length > 0 &&
                    searchTerm.trim().length === 0 && (
                      <div>
                        <div className="px-4 py-1 text-xs text-gray-500 uppercase">
                          Recent Searches
                        </div>
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

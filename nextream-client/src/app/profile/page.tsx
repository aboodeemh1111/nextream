'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUser, FaEdit, FaLock, FaSignOutAlt, FaHistory, FaHeart, FaList, FaEye, FaClock } from 'react-icons/fa';
import MovieCard from '@/components/MovieCard';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgSm?: string;
  year?: string;
  genre?: string;
  duration?: string;
}

interface WatchHistoryItem {
  movie: Movie;
  watchedAt: string;
  progress: number;
  completed: boolean;
  _id: string;
}

interface CurrentlyWatchingItem {
  movie: Movie;
  lastWatchedAt: string;
  progress: number;
  _id: string;
}

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  profilePic: string;
  myList: Movie[];
  favorites: Movie[];
  watchHistory: WatchHistoryItem[];
  currentlyWatching: CurrentlyWatchingItem[];
  watchlist: Movie[];
  preferences?: any;
}

interface ProfileSummary {
  username: string;
  profilePic?: string;
  subscriptionStatus?: { plan?: string; isActive?: boolean };
  preferences?: any;
  metrics: { totalWatchTime: number; totalTitlesWatched: number; inProgress: number; favoritesCount: number; myListCount: number };
  topGenres: { genre: string; count: number }[];
  recentLogins: { date?: string; device?: string; location?: string }[];
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/users/profile', {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        setProfile(res.data);
        // Fetch summary
        const sum = await axios.get('/api/users/profile/summary', {
          headers: { token: `Bearer ${user.accessToken}` }
        });
        setSummary(sum.data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user, router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <div className="text-white text-xl">{error || 'Profile not available'}</div>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Profile Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile.profilePic ? (
              <Image 
                src={profile.profilePic} 
                alt={profile.username} 
                width={128} 
                height={128} 
                className="object-cover w-full h-full"
              />
            ) : (
              <FaUser className="text-gray-500 text-5xl" />
            )}
          </div>
          
          <div className="text-center md:text-left">
            <h1 className="text-white text-3xl font-bold mb-2">{profile.username}</h1>
            <p className="text-gray-400 mb-2">{profile.email}</p>
            {summary?.subscriptionStatus?.plan && (
              <p className="text-xs inline-block px-2 py-1 rounded bg-red-600/20 text-red-400 mb-4">
                Plan: {summary.subscriptionStatus.plan} {summary.subscriptionStatus?.isActive ? '(Active)' : '(Inactive)'}
              </p>
            )}
            
            <button 
              className="bg-gray-700 text-white px-4 py-2 rounded flex items-center mx-auto md:mx-0 hover:bg-gray-600"
              onClick={() => router.push('/profile/edit')}
            >
              <FaEdit className="mr-2" /> Edit Profile
            </button>
          </div>
        </div>

        {/* Quick Stats + Top Genres */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total watch time</p>
              <p className="text-white text-2xl font-semibold">{Math.round(summary.metrics.totalWatchTime / 60)} min</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Titles watched</p>
              <p className="text-white text-2xl font-semibold">{summary.metrics.totalTitlesWatched}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">In progress</p>
              <p className="text-white text-2xl font-semibold">{summary.metrics.inProgress}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Favorites</p>
              <p className="text-white text-2xl font-semibold">{summary.metrics.favoritesCount}</p>
            </div>
            <div className="md:col-span-2 bg-gray-800 rounded-lg p-4">
              <p className="text-white text-lg font-semibold mb-2">Top genres</p>
              <div className="flex flex-wrap gap-2">
                {summary.topGenres.length === 0 ? (
                  <span className="text-gray-400 text-sm">No data yet</span>
                ) : summary.topGenres.map((g) => (
                  <span key={g.genre} className="px-2 py-1 rounded bg-white/10 text-white text-sm">
                    {g.genre} <span className="text-gray-400">×{g.count}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 bg-gray-800 rounded-lg p-4">
              <p className="text-white text-lg font-semibold mb-2">Recent logins</p>
              {summary.recentLogins.length === 0 ? (
                <p className="text-gray-400 text-sm">No recent login data</p>
              ) : (
                <ul className="text-gray-300 text-sm space-y-1">
                  {summary.recentLogins.map((l, idx) => (
                    <li key={idx}>
                      {formatDate(l.date || new Date().toISOString())} • {l.device || 'device'} • {l.location || 'unknown'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-gray-700 mb-6">
          <button 
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'profile' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('profile')}
          >
            Overview
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'watching' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('watching')}
          >
            <FaEye className="inline mr-1" /> Continue Watching
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'mylist' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('mylist')}
          >
            <FaList className="inline mr-1" /> My List
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'favorites' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('favorites')}
          >
            <FaHeart className="inline mr-1" /> Favorites
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'watchlist' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('watchlist')}
          >
            <FaClock className="inline mr-1" /> Want to Watch
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'history' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('history')}
          >
            <FaHistory className="inline mr-1" /> Watch History
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="mt-6">
          {/* Overview Tab */}
          {activeTab === 'profile' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Continue Watching Section */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-white text-lg font-semibold mb-4 flex items-center">
                    <FaEye className="mr-2" /> Continue Watching
                  </h2>
                  
                  {profile.currentlyWatching.length === 0 ? (
                    <p className="text-gray-400 text-sm">No shows in progress</p>
                  ) : (
                    <div className="space-y-4">
                      {profile.currentlyWatching.slice(0, 3).map((item) => (
                        <div key={item._id} className="flex items-center">
                          <div className="w-16 h-16 relative flex-shrink-0 mr-3">
                            <Image 
                              src={item.movie.imgSm || item.movie.img} 
                              alt={item.movie.title}
                              fill
                              sizes="64px"
                              className="object-cover rounded"
                            />
                          </div>
                          <div>
                            <h3 className="text-white text-sm font-medium">{item.movie.title}</h3>
                            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                              <div 
                                className="bg-red-600 h-1.5 rounded-full" 
                                style={{ width: `${item.progress}%` }}
                              ></div>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">
                              {calculateTimeAgo(item.lastWatchedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {profile.currentlyWatching.length > 3 && (
                        <button 
                          className="text-gray-400 text-sm hover:text-white"
                          onClick={() => setActiveTab('watching')}
                        >
                          View all ({profile.currentlyWatching.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* My List Section */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-white text-lg font-semibold mb-4 flex items-center">
                    <FaList className="mr-2" /> My List
                  </h2>
                  
                  {profile.myList.length === 0 ? (
                    <p className="text-gray-400 text-sm">No titles in your list</p>
                  ) : (
                    <div className="space-y-4">
                      {profile.myList.slice(0, 3).map((movie) => (
                        <div key={movie._id} className="flex items-center">
                          <div className="w-16 h-16 relative flex-shrink-0 mr-3">
                            <Image 
                              src={movie.imgSm || movie.img} 
                              alt={movie.title}
                              fill
                              sizes="64px"
                              className="object-cover rounded"
                            />
                          </div>
                          <div>
                            <h3 className="text-white text-sm font-medium">{movie.title}</h3>
                            <p className="text-gray-400 text-xs">{movie.year}</p>
                          </div>
                        </div>
                      ))}
                      
                      {profile.myList.length > 3 && (
                        <button 
                          className="text-gray-400 text-sm hover:text-white"
                          onClick={() => setActiveTab('mylist')}
                        >
                          View all ({profile.myList.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Favorites Section */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-white text-lg font-semibold mb-4 flex items-center">
                    <FaHeart className="mr-2" /> Favorites
                  </h2>
                  
                  {profile.favorites.length === 0 ? (
                    <p className="text-gray-400 text-sm">No favorites added</p>
                  ) : (
                    <div className="space-y-4">
                      {profile.favorites.slice(0, 3).map((movie) => (
                        <div key={movie._id} className="flex items-center">
                          <div className="w-16 h-16 relative flex-shrink-0 mr-3">
                            <Image 
                              src={movie.imgSm || movie.img} 
                              alt={movie.title}
                              fill
                              sizes="64px"
                              className="object-cover rounded"
                            />
                          </div>
                          <div>
                            <h3 className="text-white text-sm font-medium">{movie.title}</h3>
                            <p className="text-gray-400 text-xs">{movie.year}</p>
                          </div>
                        </div>
                      ))}
                      
                      {profile.favorites.length > 3 && (
                        <button 
                          className="text-gray-400 text-sm hover:text-white"
                          onClick={() => setActiveTab('favorites')}
                        >
                          View all ({profile.favorites.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Continue Watching Tab */}
          {activeTab === 'watching' && (
            <div>
              <h2 className="text-white text-xl font-bold mb-4">Continue Watching</h2>
              
              {profile.currentlyWatching.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                  <FaEye className="text-gray-500 text-5xl mx-auto mb-4" />
                  <h3 className="text-white text-lg mb-2">No shows in progress</h3>
                  <p className="text-gray-400">
                    Start watching a show or movie and it will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {profile.currentlyWatching.map((item) => (
                    <div key={item._id} className="bg-gray-800 rounded-lg overflow-hidden">
                      <div className="relative h-40">
                        <Image 
                          src={item.movie.imgSm || item.movie.img} 
                          alt={item.movie.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="w-full bg-gray-700 rounded-full h-1.5">
                            <div 
                              className="bg-red-600 h-1.5 rounded-full" 
                              style={{ width: `${item.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="text-white font-medium mb-1">{item.movie.title}</h3>
                        <div className="flex justify-between items-center">
                          <p className="text-gray-400 text-sm">{item.movie.year}</p>
                          <p className="text-gray-400 text-xs">
                            {calculateTimeAgo(item.lastWatchedAt)}
                          </p>
                        </div>
                        <button 
                          className="w-full mt-3 bg-red-600 text-white py-1.5 rounded hover:bg-red-700"
                          onClick={() => router.push(`/watch?videoId=${item.movie._id}`)}
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* My List Tab */}
          {activeTab === 'mylist' && (
            <div>
              <h2 className="text-white text-xl font-bold mb-4">My List</h2>
              
              {profile.myList.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                  <FaList className="text-gray-500 text-5xl mx-auto mb-4" />
                  <h3 className="text-white text-lg mb-2">Your list is empty</h3>
                  <p className="text-gray-400">
                    Add shows and movies to your list to watch them later.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {profile.myList.map((movie) => (
                    <div key={movie._id} className="h-[200px]">
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Favorites Tab */}
          {activeTab === 'favorites' && (
            <div>
              <h2 className="text-white text-xl font-bold mb-4">Favorites</h2>
              
              {profile.favorites.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                  <FaHeart className="text-gray-500 text-5xl mx-auto mb-4" />
                  <h3 className="text-white text-lg mb-2">No favorites yet</h3>
                  <p className="text-gray-400">
                    Add shows and movies to your favorites to find them easily.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {profile.favorites.map((movie) => (
                    <div key={movie._id} className="h-[200px]">
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Watchlist Tab */}
          {activeTab === 'watchlist' && (
            <div>
              <h2 className="text-white text-xl font-bold mb-4">Want to Watch</h2>
              
              {profile.watchlist.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                  <FaClock className="text-gray-500 text-5xl mx-auto mb-4" />
                  <h3 className="text-white text-lg mb-2">Your watchlist is empty</h3>
                  <p className="text-gray-400">
                    Add shows and movies you want to watch in the future.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {profile.watchlist.map((movie) => (
                    <div key={movie._id} className="h-[200px]">
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Watch History Tab */}
          {activeTab === 'history' && (
            <div>
              <h2 className="text-white text-xl font-bold mb-4">Watch History</h2>
              
              {profile.watchHistory.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                  <FaHistory className="text-gray-500 text-5xl mx-auto mb-4" />
                  <h3 className="text-white text-lg mb-2">No watch history</h3>
                  <p className="text-gray-400">
                    Your watch history will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.watchHistory.map((item) => (
                    <div key={item._id} className="bg-gray-800 rounded-lg p-4 flex items-center">
                      <div className="w-20 h-20 relative flex-shrink-0 mr-4">
                        <Image 
                          src={item.movie.imgSm || item.movie.img} 
                          alt={item.movie.title}
                          fill
                          sizes="80px"
                          className="object-cover rounded"
                        />
                      </div>
                      <div className="flex-grow">
                        <h3 className="text-white font-medium">{item.movie.title}</h3>
                        <p className="text-gray-400 text-sm">{item.movie.year}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          Watched on {formatDate(item.watchedAt)}
                        </p>
                      </div>
                      <button 
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 ml-4"
                        onClick={() => router.push(`/watch?videoId=${item.movie._id}`)}
                      >
                        Watch Again
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import MovieCard from '@/components/MovieCard';
import { useAuth } from '@/context/AuthContext';
import { FaSearch, FaFilter } from 'react-icons/fa';

interface Movie {
  _id: string;
  title: string;
  desc: string;
  img: string;
  imgTitle?: string;
  imgSm?: string;
  trailer?: string;
  year?: string;
  limit?: number;
  genre?: string;
  duration?: string;
  isSeries?: boolean;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all';
  const genre = searchParams.get('genre') || '';
  
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim() || !user) return;

      try {
        setLoading(true);
        setError(null);
        
        // Build query parameters
        let apiUrl = `/api/movies/search?q=${encodeURIComponent(query)}`;
        
        if (type === 'movie') {
          apiUrl += '&isSeries=false';
        } else if (type === 'series') {
          apiUrl += '&isSeries=true';
        }
        
        if (genre) {
          apiUrl += `&genre=${encodeURIComponent(genre)}`;
        }
        
        const res = await axios.get(apiUrl, {
          headers: {
            token: `Bearer ${user.accessToken}`,
          },
        });
        
        setResults(res.data);
        
        // Set active filters for display
        const filters = [];
        if (type !== 'all') filters.push(type === 'movie' ? 'Movies' : 'Series');
        if (genre) filters.push(genre.charAt(0).toUpperCase() + genre.slice(1));
        setActiveFilters(filters);
        
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to load search results');
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query, type, genre, user]);

  return (
    <main className="min-h-screen bg-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-2">
            Search Results for "{query}"
          </h1>
          <div className="flex flex-wrap items-center">
            <p className="text-gray-400 mr-4">
              {results.length} {results.length === 1 ? 'result' : 'results'} found
            </p>
            
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center mt-2">
                <FaFilter className="text-gray-400 mr-2" />
                <span className="text-gray-400 mr-2">Filters:</span>
                {activeFilters.map((filter, index) => (
                  <span key={index} className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2 mb-1">
                    {filter}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="text-white text-center py-12">{error}</div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <FaSearch className="text-gray-500 text-5xl mx-auto mb-4" />
            <h2 className="text-white text-xl mb-2">No results found</h2>
            <p className="text-gray-400">
              We couldn't find any titles matching "{query}"{activeFilters.length > 0 ? ' with the selected filters' : ''}.
            </p>
            {activeFilters.length > 0 && (
              <p className="text-gray-400 mt-2">
                Try broadening your search by removing some filters.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((movie) => (
              <div key={movie._id} className="h-[200px]">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 
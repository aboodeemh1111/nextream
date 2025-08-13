'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MovieCard from './MovieCard';
import RowHeader from './RowHeader';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';

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
}

interface List {
  _id: string;
  title: string;
  type: string;
  genre: string;
  content: Movie[];
}

interface MovieListProps {
  listId: string;
  title?: string;
  cardSize?: 'small' | 'medium' | 'large';
}

const MovieList = ({ listId, title, cardSize = 'medium' }: MovieListProps) => {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [visibleItems, setVisibleItems] = useState(6);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const getList = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/lists/find/${listId}`, {
          headers: {
            token: `Bearer ${user?.accessToken}`,
          },
        });
        setList(res.data);
      } catch (err) {
        setError('Failed to load list');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getList();
  }, [listId, user]);

  useEffect(() => {
    const updateVisibleItems = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleItems(2); // Mobile: 2 items
      } else if (width < 768) {
        setVisibleItems(3); // Small tablets: 3 items
      } else if (width < 1024) {
        setVisibleItems(4); // Tablets: 4 items
      } else if (width < 1280) {
        setVisibleItems(5); // Small desktops: 5 items
      } else {
        setVisibleItems(6); // Large desktops: 6 items
      }
    };

    updateVisibleItems();
    window.addEventListener('resize', updateVisibleItems);
    
    return () => {
      window.removeEventListener('resize', updateVisibleItems);
    };
  }, []);

  const handleClick = (direction: 'left' | 'right') => {
    if (!listRef.current || !list?.content.length) return;
    
    const maxSlides = Math.ceil(list.content.length / visibleItems) - 1;
    
    if (direction === 'left' && slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
    }
    
    if (direction === 'right' && slideIndex < maxSlides) {
      setSlideIndex(slideIndex + 1);
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      handleClick('right');
    }
    
    if (isRightSwipe) {
      handleClick('left');
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (loading) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <div className="text-white">{error || 'No list available'}</div>
      </div>
    );
  }

  // Calculate the width of each item based on the number of visible items
  const itemWidth = `${100 / visibleItems}%`;
  
  // Calculate the transform distance for sliding
  const transformDistance = slideIndex * 100;

  return (
    <div className="mb-8" ref={containerRef}>
      <RowHeader title={title || list.title} exploreHref={`/movies?list=${list._id}`} />
      
      <div 
        className="relative group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slideIndex > 0 && (
          <button
            className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 text-white rounded-r-md p-1 sm:p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            onClick={() => handleClick('left')}
            aria-label="Previous"
          >
            <FaChevronLeft className="text-sm sm:text-base md:text-lg" />
          </button>
        )}
        
        <div className="overflow-hidden px-4">
          <div 
            ref={listRef}
            className="flex transition-transform duration-500 ease-in-out snap-x snap-mandatory"
            style={{ transform: `translateX(-${transformDistance}%)` }}
          >
            {list.content.map((movie) => (
              <div 
                key={movie._id} 
                className="flex-shrink-0 px-1 sm:px-2 snap-start"
                style={{ width: itemWidth }}
              >
                <MovieCard movie={movie} size={cardSize} />
              </div>
            ))}
          </div>
        </div>
        
        {slideIndex < Math.ceil(list.content.length / visibleItems) - 1 && (
          <button
            className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 text-white rounded-l-md p-1 sm:p-2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            onClick={() => handleClick('right')}
            aria-label="Next"
          >
            <FaChevronRight className="text-sm sm:text-base md:text-lg" />
          </button>
        )}
        
        {/* Pagination indicators for mobile */}
        <div className="flex justify-center mt-2 md:hidden">
          {Array.from({ length: Math.ceil(list.content.length / visibleItems) }).map((_, index) => (
            <button
              key={index}
              className={`h-1.5 mx-1 rounded-full transition-all ${
                index === slideIndex ? 'w-4 bg-red-600' : 'w-1.5 bg-gray-600'
              }`}
              onClick={() => setSlideIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MovieList; 
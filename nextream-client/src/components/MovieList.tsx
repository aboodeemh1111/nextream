'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MovieCard from './MovieCard';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

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

const MovieList = ({ listId }: { listId: string }) => {
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getList = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/lists/find/${listId}`);
        setList(res.data);
      } catch (err) {
        setError('Failed to load list');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getList();
  }, [listId]);

  const handleClick = (direction: 'left' | 'right') => {
    if (!listRef.current) return;
    
    const distance = listRef.current.getBoundingClientRect().width / 4;
    const maxSlides = list?.content.length ? Math.ceil(list.content.length / 4) - 1 : 0;
    
    if (direction === 'left' && slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
      listRef.current.style.transform = `translateX(-${(slideIndex - 1) * distance}px)`;
    }
    
    if (direction === 'right' && slideIndex < maxSlides) {
      setSlideIndex(slideIndex + 1);
      listRef.current.style.transform = `translateX(-${(slideIndex + 1) * distance}px)`;
    }
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

  return (
    <div className="mb-8">
      <h2 className="text-white text-xl font-semibold mb-4 px-4">{list.title}</h2>
      
      <div className="relative group">
        <FaChevronLeft 
          className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white text-2xl z-10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleClick('left')}
        />
        
        <div className="overflow-hidden px-4">
          <div 
            ref={listRef}
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: 'translateX(0)' }}
          >
            {list.content.map((movie) => (
              <div key={movie._id} className="min-w-[25%] px-2">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        </div>
        
        <FaChevronRight 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-2xl z-10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleClick('right')}
        />
      </div>
    </div>
  );
};

export default MovieList; 
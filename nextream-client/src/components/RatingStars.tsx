'use client';

import { useState, useEffect } from 'react';
import { FaStar, FaRegStar, FaStarHalfAlt } from 'react-icons/fa';

interface RatingStarsProps {
  rating?: number;
  totalStars?: number;
  size?: number;
  color?: string;
  interactive?: boolean;
  precision?: 'half' | 'full';
  onChange?: (rating: number) => void;
  onRatingChange?: (rating: number) => void; // For backward compatibility
  className?: string;
}

const RatingStars: React.FC<RatingStarsProps> = ({
  rating = 0,
  totalStars = 5,
  size = 24,
  color = '#FFD700', // Gold color
  interactive = false,
  precision = 'full',
  onChange,
  onRatingChange,
  className = '',
}) => {
  const [currentRating, setCurrentRating] = useState(rating);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    setCurrentRating(rating);
  }, [rating]);

  const handleClick = (selectedRating: number) => {
    if (!interactive) return;
    
    setCurrentRating(selectedRating);
    
    // Support both onChange and onRatingChange props for backward compatibility
    if (onChange) {
      onChange(selectedRating);
    }
    
    if (onRatingChange) {
      onRatingChange(selectedRating);
    }
  };

  const handleMouseEnter = (hoveredRating: number) => {
    if (!interactive) return;
    setHoverRating(hoveredRating);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setHoverRating(0);
  };

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const displayRating = hoverRating || currentRating;
    
    // For non-interactive or full precision, use simple logic
    if (!interactive || precision === 'full') {
      if (starValue <= displayRating) {
        return <FaStar key={index} size={size} color={color} />;
      } else {
        return <FaRegStar key={index} size={size} color={color} />;
      }
    }
    
    // For half-star precision
    if (starValue <= displayRating) {
      return <FaStar key={index} size={size} color={color} />;
    } else if (starValue - 0.5 <= displayRating) {
      return <FaStarHalfAlt key={index} size={size} color={color} />;
    } else {
      return <FaRegStar key={index} size={size} color={color} />;
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {Array.from({ length: totalStars }).map((_, index) => (
        <span
          key={index}
          onClick={() => handleClick(index + 1)}
          onMouseEnter={() => handleMouseEnter(index + 1)}
          onMouseLeave={handleMouseLeave}
          className={`${interactive ? 'cursor-pointer' : ''} inline-block`}
          role={interactive ? 'button' : undefined}
          aria-label={interactive ? `Rate ${index + 1} out of ${totalStars} stars` : undefined}
        >
          {renderStar(index)}
        </span>
      ))}
    </div>
  );
};

export default RatingStars; 
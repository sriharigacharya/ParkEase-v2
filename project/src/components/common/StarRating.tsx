import React from 'react';
import { Star } from 'lucide-react';

type StarRatingProps = {
  rating: number;
  maxRating?: number;
  size?: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
};

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 24,
  onChange,
  readonly = false,
}) => {
  const handleClick = (selectedRating: number) => {

    console.log('[StarRating] handleClick called.');
    console.log('[StarRating] readonly:', readonly);
    console.log('[StarRating] selectedRating:', selectedRating);
    console.log('[StarRating] onChange prop exists:', !!onChange);

    
    if (!readonly && onChange) {
      onChange(selectedRating);
    }
  };

  return (
    <div className="flex">
      {[...Array(maxRating)].map((_, index) => {
        const ratingValue = index + 1;
        return (
          <button
            type="button"
            key={index}
            onClick={() => handleClick(ratingValue)}
            className={`${
              readonly ? 'cursor-default' : 'cursor-pointer'
            } transition-colors duration-200 focus:outline-none`}
            disabled={readonly}
            aria-label={`${ratingValue} stars`}
          >
            <Star
              size={size}
              className={`transition-all duration-300 ${
                ratingValue <= rating
                  ? 'text-primary-400 fill-primary-400'
                  : 'text-primary-200'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
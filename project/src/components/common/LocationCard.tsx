import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Car, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import StarRating from './StarRating';

type LocationCardProps = {
  id: number;
  name: string;
  distance?: number; // in kilometers
  availableSlots: number;
  totalSlots: number;
  averageRating: number;
  coverImageUrl: string;
};

const LocationCard: React.FC<LocationCardProps> = ({
  id,
  name,
  distance,
  availableSlots,
  totalSlots,
  averageRating,
  coverImageUrl,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBookClick = () => {
    if (user) {
      navigate(`/user/dashboard?locationId=${id}`);
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="h-48 overflow-hidden">
        <img
          src={coverImageUrl || 'https://images.pexels.com/photos/1756957/pexels-photo-1756957.jpeg'}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-5">
        <h3 className="text-xl font-semibold text-secondary-900 mb-2">{name}</h3>
        
        <div className="flex items-center text-sm text-secondary-600 mb-2">
          <MapPin className="w-4 h-4 mr-1" />
          {distance ? `${distance.toFixed(1)} km away` : 'Distance not available'}
        </div>
        
        <div className="flex justify-between mb-3">
          <div className="flex items-center text-sm">
            <Car className="w-4 h-4 mr-1 text-primary-600" />
            <span className="text-secondary-700">
              <span className={availableSlots === 0 ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
                {availableSlots}
              </span>
              /{totalSlots} slots
            </span>
          </div>
          <div className="flex items-center">
            <StarRating rating={averageRating} size={16} readonly />
            <span className="ml-1 text-sm text-secondary-700">({averageRating.toFixed(1)})</span>
          </div>
        </div>
        
        <button
          onClick={handleBookClick}
          disabled={availableSlots === 0}
          className={`w-full py-2 rounded-md font-medium transition-colors ${
            availableSlots === 0
              ? 'bg-secondary-200 text-secondary-500 cursor-not-allowed'
              : 'bg-primary-500 text-white hover:bg-primary-600'
          }`}
        >
          {user ? 'Book Now' : 'Login to Book'}
        </button>
      </div>
    </div>
  );
};

export default LocationCard;
// HomePage.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Make sure axios is imported
import { MapPin } from 'lucide-react';
import LocationCard from '../components/common/LocationCard';
import LocationFilters, { FilterValues } from '../components/filters/LocationFilters';

type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  totalSlots: number;
  availableSlots: number;
  coverImageUrl: string;
  averageRating: number; // Ensure your API returns this as a number
  distance?: number;
  // Add feedbackCount if your public API provides it and you need it for LocationCard
  // feedbackCount?: number;
};

const HomePage: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.error('Error getting user location:', error);
            // setError('Unable to get your location. Please enable location services.'); 
            // You might want to handle this more gracefully, e.g., don't sort by distance
          }
        );
      } else {
        // setError('Geolocation is not supported by this browser.');
        console.warn('Geolocation is not supported by this browser.');
      }
    };
    getUserLocation();
  }, []);

  useEffect(() => {
    const fetchLocationsData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors

        // Replace mock data with an API call
        // Assuming your public endpoint for locations is GET /api/locations
        const response = await axios.get('/api/locations'); 
        let fetchedLocations: Location[] = response.data;

        // IMPORTANT: Check if backend data needs transformation
        // (like snake_case to camelCase, or string numbers to actual numbers)
        // If your /api/locations endpoint sends snake_case or averageRating as a string,
        // you'll need to transform it here, similar to what we did for AdminLocations.
        // Example transformation (adapt as needed):
        fetchedLocations = fetchedLocations.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          latitude: loc.latitude, // Ensure these are numbers
          longitude: loc.longitude, // Ensure these are numbers
          totalSlots: loc.totalSlots || loc.total_slots, // Handle potential casing
          availableSlots: loc.availableSlots || loc.available_slots,
          coverImageUrl: loc.coverImageUrl || loc.cover_image_url,
          averageRating: typeof loc.averageRating === 'string' 
                            ? parseFloat(loc.averageRating) 
                            : (loc.averageRating || (typeof loc.average_rating === 'string' ? parseFloat(loc.average_rating) : loc.average_rating) || 0),
          // distance will be calculated next
        }));

        console.log('Fetched and Transformed Locations (HomePage):', fetchedLocations); // <<--- ADD OR CONFIRM THIS LOG

        if (userCoords) {
          fetchedLocations.forEach(location => {
            if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
                location.distance = calculateDistance(
                    userCoords.lat,
                    userCoords.lng,
                    location.latitude,
                    location.longitude
                );
            } else {
                location.distance = undefined; // Or some default large value
            }
          });
          fetchedLocations.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        }

        setLocations(fetchedLocations);
        setFilteredLocations(fetchedLocations);
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Failed to load parking locations. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchLocationsData();
  }, [userCoords]); // Re-fetch if userCoords change to recalculate distances and sort

  const handleFilterChange = (filters: FilterValues) => {
    // ... (your existing filter logic should work if locations data is correct) ...
    const filtered = locations.filter(location => {
      const distanceFilter = !userCoords || typeof location.distance === 'undefined' || location.distance <= filters.distance;
      const slotsFilter = location.availableSlots >= filters.minAvailableSlots;
      const ratingFilter = location.averageRating >= filters.minRating;
      return distanceFilter && slotsFilter && ratingFilter;
    });
    setFilteredLocations(filtered);
  };

  // ... rest of your component (return JSX) ...
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Find Parking Near You</h1>
        <p className="text-secondary-600">
          Discover available parking spots in your area, check real-time availability, and book in advance.
        </p>
      </div>
      
      {userCoords ? (
        <div className="flex items-center text-sm text-primary-600 mb-6">
          <MapPin className="h-5 w-5 mr-1" />
          <span>Using your current location ({userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)})</span>
        </div>
      ) : (
        <div className="flex items-center text-sm text-secondary-500 mb-6">
          <MapPin className="h-5 w-5 mr-1" />
          <span>Enable location services to find nearby parking or view all locations.</span>
        </div>
      )}
      
      <LocationFilters onFilterChange={handleFilterChange} />
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-4 bg-red-50 rounded-md">{error}</div>
      ) : filteredLocations.length === 0 ? (
        <div className="text-center p-8 bg-secondary-50 rounded-lg">
          <p className="text-lg text-secondary-700">No parking locations found matching your filters.</p>
          <p className="text-sm text-secondary-500 mt-2">Try adjusting your filter settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocations.map(location => (
            <LocationCard
              key={location.id}
              id={location.id}
              name={location.name}
              distance={location.distance}
              availableSlots={location.availableSlots}
              totalSlots={location.totalSlots}
              averageRating={location.averageRating}
              coverImageUrl={location.coverImageUrl}
              // feedbackCount={location.feedbackCount} // Add if needed by LocationCard and provided by API
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;

// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { MapPin } from 'lucide-react';
// import LocationCard from '../components/common/LocationCard';
// import LocationFilters, { FilterValues } from '../components/filters/LocationFilters';

// type Location = {
//   id: number;
//   name: string;
//   latitude: number;
//   longitude: number;
//   totalSlots: number;
//   availableSlots: number;
//   coverImageUrl: string;
//   averageRating: number;
//   distance?: number;
// };

// const HomePage: React.FC = () => {
//   const [locations, setLocations] = useState<Location[]>([]);
//   const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
//   const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   // Function to calculate distance between two coordinates in km
//   const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
//     const R = 6371; // Radius of the Earth in km
//     const dLat = (lat2 - lat1) * Math.PI / 180;
//     const dLon = (lon2 - lon1) * Math.PI / 180;
//     const a = 
//       Math.sin(dLat/2) * Math.sin(dLat/2) +
//       Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
//       Math.sin(dLon/2) * Math.sin(dLon/2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return R * c;
//   };

//   // Get user's location on component mount
//   useEffect(() => {
//     const getUserLocation = () => {
//       if (navigator.geolocation) {
//         navigator.geolocation.getCurrentPosition(
//           (position) => {
//             setUserCoords({
//               lat: position.coords.latitude,
//               lng: position.coords.longitude
//             });
//           },
//           (error) => {
//             console.error('Error getting user location:', error);
//             setError('Unable to get your location. Please enable location services.');
//           }
//         );
//       } else {
//         setError('Geolocation is not supported by this browser.');
//       }
//     };

//     getUserLocation();
//   }, []);

//   // Fetch parking locations
//   useEffect(() => {
//     const fetchLocations = async () => {
//       try {
//         setLoading(true);
//         // Call to API would be here
//         // For now, we'll use mock data
//         const mockLocations: Location[] = [
//           {
//             id: 1,
//             name: 'Downtown Parking',
//             latitude: 40.7128,
//             longitude: -74.0060,
//             totalSlots: 100,
//             availableSlots: 25,
//             coverImageUrl: 'https://images.pexels.com/photos/1756957/pexels-photo-1756957.jpeg',
//             averageRating: 4.5
//           },
//           {
//             id: 2,
//             name: 'Central Mall Parking',
//             latitude: 40.7138,
//             longitude: -74.0070,
//             totalSlots: 200,
//             availableSlots: 0,
//             coverImageUrl: 'https://images.pexels.com/photos/3215608/pexels-photo-3215608.jpeg',
//             averageRating: 3.8
//           },
//           {
//             id: 3,
//             name: 'Airport Parking',
//             latitude: 40.7148,
//             longitude: -74.0080,
//             totalSlots: 500,
//             availableSlots: 120,
//             coverImageUrl: 'https://images.pexels.com/photos/1004076/pexels-photo-1004076.jpeg',
//             averageRating: 4.2
//           },
//           {
//             id: 4,
//             name: 'Riverside Parking',
//             latitude: 40.7158,
//             longitude: -74.0090,
//             totalSlots: 80,
//             availableSlots: 15,
//             coverImageUrl: 'https://images.pexels.com/photos/3574441/pexels-photo-3574441.jpeg',
//             averageRating: 3.5
//           },
//           {
//             id: 5,
//             name: 'City Center Parking',
//             latitude: 40.7168,
//             longitude: -74.0100,
//             totalSlots: 150,
//             availableSlots: 42,
//             coverImageUrl: 'https://images.pexels.com/photos/586584/pexels-photo-586584.jpeg',
//             averageRating: 4.8
//           },
//           {
//             id: 6,
//             name: 'Park Plaza',
//             latitude: 40.7178,
//             longitude: -74.0110,
//             totalSlots: 120,
//             availableSlots: 5,
//             coverImageUrl: 'https://images.pexels.com/photos/1004145/pexels-photo-1004145.jpeg',
//             averageRating: 4.0
//           }
//         ];

//         // Calculate distances if user coords are available
//         if (userCoords) {
//           mockLocations.forEach(location => {
//             location.distance = calculateDistance(
//               userCoords.lat,
//               userCoords.lng,
//               location.latitude,
//               location.longitude
//             );
//           });

//           // Sort by distance
//           mockLocations.sort((a, b) => (a.distance || 999) - (b.distance || 999));
//         }

//         setLocations(mockLocations);
//         setFilteredLocations(mockLocations);
//       } catch (error) {
//         console.error('Error fetching locations:', error);
//         setError('Failed to load parking locations. Please try again later.');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchLocations();
//   }, [userCoords]);

//   const handleFilterChange = (filters: FilterValues) => {
//     const filtered = locations.filter(location => {
//       // Filter by distance if user location is available
//       const distanceFilter = !userCoords || !location.distance || location.distance <= filters.distance;
      
//       // Filter by minimum available slots
//       const slotsFilter = location.availableSlots >= filters.minAvailableSlots;
      
//       // Filter by minimum rating
//       const ratingFilter = location.averageRating >= filters.minRating;
      
//       return distanceFilter && slotsFilter && ratingFilter;
//     });
    
//     setFilteredLocations(filtered);
//   };

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-secondary-900 mb-2">Find Parking Near You</h1>
//         <p className="text-secondary-600">
//           Discover available parking spots in your area, check real-time availability, and book in advance.
//         </p>
//       </div>
      
//       {userCoords ? (
//         <div className="flex items-center text-sm text-primary-600 mb-6">
//           <MapPin className="h-5 w-5 mr-1" />
//           <span>Using your current location</span>
//         </div>
//       ) : (
//         <div className="flex items-center text-sm text-secondary-500 mb-6">
//           <MapPin className="h-5 w-5 mr-1" />
//           <span>Enable location services to find nearby parking</span>
//         </div>
//       )}
      
//       <LocationFilters onFilterChange={handleFilterChange} />
      
//       {loading ? (
//         <div className="flex justify-center items-center h-64">
//           <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
//         </div>
//       ) : error ? (
//         <div className="text-center text-red-500 p-4 bg-red-50 rounded-md">{error}</div>
//       ) : filteredLocations.length === 0 ? (
//         <div className="text-center p-8 bg-secondary-50 rounded-lg">
//           <p className="text-lg text-secondary-700">No parking locations found matching your filters.</p>
//           <p className="text-sm text-secondary-500 mt-2">Try adjusting your filter settings.</p>
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           {filteredLocations.map(location => (
//             <LocationCard
//               key={location.id}
//               id={location.id}
//               name={location.name}
//               distance={location.distance}
//               availableSlots={location.availableSlots}
//               totalSlots={location.totalSlots}
//               averageRating={location.averageRating}
//               coverImageUrl={location.coverImageUrl}
//             />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// export default HomePage;
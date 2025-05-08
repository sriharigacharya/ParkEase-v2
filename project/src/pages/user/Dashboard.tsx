// src/pages/user/Dashboard.tsx (UserDashboard.tsx)

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Clock, MapPin, AlertCircle, CheckCircle, Car as CarIcon, Loader2, Info } from 'lucide-react'; // Added CarIcon, Loader2, Info
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import StarRating from '../../components/common/StarRating'; // Adjust path if needed

dayjs.extend(isBetween);

type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  totalSlots: number;
  availableSlots: number; // Physical drive-up slots
  coverImageUrl: string;
  averageRating: number;
};

type BookingAvailabilityResponse = {
    isBookable: boolean;
    message: string;
    slotsAvailableForBooking?: number;
    bookingCapacityForLocation?: number;
    currentBookedCountInSlot?: number;
};

const UserDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false); // For booking submission spinner
  const [error, setError] = useState<string | null>(null); // For general/submission errors
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [bookingData, setBookingData] = useState({
    startTime: '',
    endTime: '',
    licensePlateBooked: '', // New field for optional license plate
  });

  // New state for booking availability check
  const [bookingAvailability, setBookingAvailability] = useState<BookingAvailabilityResponse | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);


  const fetchLocation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setBookingAvailability(null); // Reset availability when location changes
    try {
      const response = await axios.get(`/api/locations/${id}`);
      setLocation(response.data);
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('Failed to load location details. Please ensure the location exists or try again.');
      setLocation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const locationId = searchParams.get('locationId');
    if (locationId) {
      fetchLocation(locationId);
    } else {
      navigate('/user/bookings');
    }
  }, [searchParams, navigate, fetchLocation]);


  const checkBookingAvailability = useCallback(async (locationIdParam: number, startTimeParam: string, endTimeParam: string) => {
    if (!startTimeParam || !endTimeParam || !dayjs(startTimeParam).isValid() || !dayjs(endTimeParam).isValid() || dayjs(endTimeParam).isBefore(dayjs(startTimeParam))) {
      setBookingAvailability(null);
      return;
    }
    setIsCheckingAvailability(true);
    setBookingAvailability(null); // Clear previous while checking
    setError(null); 
    try {
      const response = await axios.get(`/api/locations/${locationIdParam}/booking-availability`, {
        params: {
          startTime: dayjs(startTimeParam).toISOString(),
          endTime: dayjs(endTimeParam).toISOString(),
        },
      });
      setBookingAvailability(response.data);
    } catch (err: any) {
      console.error('Error checking booking availability:', err);
      setBookingAvailability({ 
        isBookable: false, 
        message: err.response?.data?.message || "Could not check slot availability. Please try again." 
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, []); // No dependencies, it's a static utility essentially triggered by other effects/handlers

  // useEffect to check availability when times change (with debounce)
  useEffect(() => {
    if (location && bookingData.startTime && bookingData.endTime &&
        dayjs(bookingData.startTime).isValid() && dayjs(bookingData.endTime).isValid() &&
        dayjs(bookingData.endTime).isAfter(dayjs(bookingData.startTime)) &&
        dayjs(bookingData.startTime).isAfter(dayjs().subtract(1, 'minute'))) { // Prevent check for past times

      const handler = setTimeout(() => {
        checkBookingAvailability(location.id, bookingData.startTime, bookingData.endTime);
      }, 700); // Debounce for 700ms

      return () => {
        clearTimeout(handler);
      };
    } else {
      setBookingAvailability(null); // Clear availability if times are invalid/incomplete
    }
  }, [location, bookingData.startTime, bookingData.endTime, checkBookingAvailability]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBookingData(prev => ({
      ...prev,
      [name]: name === 'licensePlateBooked' ? value.toUpperCase() : value,
    }));

    if (name === 'startTime') {
        if (bookingData.endTime && dayjs(value).isAfter(dayjs(bookingData.endTime))) {
            setBookingData(prev => ({ ...prev, endTime: '' })); // Clear end time if start is after it
        }
        // Also clear end time if start time is made empty or invalid
        if (!value || !dayjs(value).isValid()) {
             setBookingData(prev => ({ ...prev, endTime: '' }));
        }
    }
    // Clear availability message on any input change for time
    if (name === 'startTime' || name === 'endTime') {
        setBookingAvailability(null);
        setIsCheckingAvailability(false); // Stop any ongoing check visual
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    
    setError(null); // Clear previous general errors
    setSuccessMessage(null);

    const STime = dayjs(bookingData.startTime);
    const ETime = dayjs(bookingData.endTime);

    if (!STime.isValid() || !ETime.isValid()) {
      setError('Please enter valid start and end times.'); return;
    }
    if (ETime.isBefore(STime) || ETime.isSame(STime)) {
      setError('End time must be after start time.'); return;
    }
    if (STime.isBefore(dayjs())) {
      setError('Start time cannot be in the past.'); return;
    }

    // Re-check or use current availability state before submitting
    if (!bookingAvailability) {
        // If for some reason availability hasn't been checked yet for current times, check it now.
        if (location && STime.isValid() && ETime.isValid() && ETime.isAfter(STime)) {
            await checkBookingAvailability(location.id, STime.toISOString(), ETime.toISOString());
            // The state update is async, so we might need to use a local variable from the response
            // or simply return and let the user click again if the state updates the button.
            // For simplicity here, we'll assume user clicks again if button enables.
            // Or better, use the result of this check directly.
            // This part can be complex to handle seamlessly without a state management library.
            // Let's assume the useEffect for availability check has run.
            setError("Please wait for availability check or ensure times are valid.");
            return;
        }
    }
    
    if (bookingAvailability && !bookingAvailability.isBookable) {
        setError(bookingAvailability.message || "Selected time slot is not available for booking.");
        return;
    }


    setIsBooking(true); // Spinner for booking submission

    try {
      await axios.post('/api/locations/bookings', { 
        parkingLocationId: location.id,
        startTime: STime.toISOString(),
        endTime: ETime.toISOString(),
        licensePlateBooked: bookingData.licensePlateBooked.trim() || null, // Send null if empty
      });

      setSuccessMessage(`Booking successful for ${location.name}! You will be redirected shortly.`);
      setBookingData({ startTime: '', endTime: '', licensePlateBooked: '' });
      setBookingAvailability(null); // Clear availability after successful booking
      // No need to refetch location here as booking doesn't change physical slots.

      setTimeout(() => {
        navigate('/user/bookings');
      }, 3000);

    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  if (loading && searchParams.get('locationId')) { 
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-500"></div>
      </div>
    );
  }
  
  if (!location && !searchParams.get('locationId')) {
    return null; 
  }

  const minStartTime = dayjs().add(5, 'minute').format('YYYY-MM-DDTHH:mm');
  const minEndTime = bookingData.startTime && dayjs(bookingData.startTime).isValid()
    ? dayjs(bookingData.startTime).add(15, 'minute').format('YYYY-MM-DDTHH:mm') // Min 15 min booking
    : minStartTime; // Fallback if startTime is not valid yet

  const isBookingButtonDisabled = 
    isBooking || 
    isCheckingAvailability || 
    !bookingAvailability || 
    !bookingAvailability.isBookable ||
    !bookingData.startTime || // ensure times are selected
    !bookingData.endTime;


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Book a Parking Spot</h1>
        <p className="text-secondary-600">
          {location
            ? `Reserve your parking spot at ${location.name}`
            : 'Loading location details or redirecting...'} 
        </p>
      </div>

      {error && ( // General errors shown at top
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
            <AlertCircle className="h-5 w-5 mr-3" />
            <p>{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md flex items-center" role="alert">
            <CheckCircle className="h-5 w-5 mr-3" />
            <p>{successMessage}</p>
        </div>
      )}

      {location ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <img
              src={location.coverImageUrl || 'https://via.placeholder.com/400x200.png?text=Parking+Location'}
              alt={location.name}
              className="w-full h-56 object-cover"
            />
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-secondary-900 mb-4">{location.name}</h2>
              <div className="space-y-3">
                <div className="flex items-center text-secondary-700">
                  <MapPin className="h-5 w-5 mr-2 text-primary-600" />
                  <span>
                    {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center text-secondary-700">
                  <StarRating rating={location.averageRating || 0} readonly size={20}/>
                  <span className="ml-2">
                    {(location.averageRating || 0).toFixed(1)} stars
                  </span>
                </div>
                <div className="text-secondary-700">
                  Physical Drive-up Slots: <span className={`font-semibold ${location.availableSlots > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {location.availableSlots}
                  </span> / {location.totalSlots}
                  <p className="text-xs text-secondary-500 mt-1">(This shows current physical drive-up availability. Booking availability for a specific time is checked below.)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
            <h3 className="text-xl font-semibold text-secondary-900 mb-6 border-b pb-3">Make a Reservation</h3>
            <form onSubmit={handleBooking} className="space-y-6">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-secondary-700 mb-1">Start Time</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400 pointer-events-none" />
                  <input type="datetime-local" id="startTime" name="startTime" value={bookingData.startTime} onChange={handleInputChange} min={minStartTime}
                    className="pl-10 w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm"
                    required disabled={isBooking} />
                </div>
              </div>
              
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-secondary-700 mb-1">End Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400 pointer-events-none" />
                  <input type="datetime-local" id="endTime" name="endTime" value={bookingData.endTime} onChange={handleInputChange} min={minEndTime}
                    className="pl-10 w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm"
                    required disabled={isBooking || !bookingData.startTime} /> 
                </div>
              </div>

              <div>
                <label htmlFor="licensePlateBooked" className="block text-sm font-medium text-secondary-700 mb-1">
                    License Plate (Optional)
                </label>
                <div className="relative">
                  <CarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400 pointer-events-none" />
                  <input
                    type="text"
                    id="licensePlateBooked"
                    name="licensePlateBooked"
                    value={bookingData.licensePlateBooked}
                    onChange={handleInputChange}
                    placeholder="e.g., ABC123"
                    className="pl-10 w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm"
                    disabled={isBooking}
                  />
                </div>
              </div>

              {/* Availability Check Display */}
              <div className="h-10 mt-2"> {/* Reserve space for the message */}
                {isCheckingAvailability && (
                  <div className="flex items-center text-sm text-primary-600">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Checking booking availability...
                  </div>
                )}
                {bookingAvailability && !isCheckingAvailability && (
                  <div className={`text-sm p-2 rounded-md flex items-center ${bookingAvailability.isBookable ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {bookingAvailability.isBookable ? <CheckCircle className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    {bookingAvailability.message}
                  </div>
                )}
              </div>

              <button type="submit" disabled={isBookingButtonDisabled}
                className={`w-full py-3 px-4 rounded-md text-white font-semibold transition-colors text-base flex items-center justify-center
                  ${isBooking ? 'bg-primary-400 cursor-wait' : 
                  !bookingData.startTime || !bookingData.endTime || !bookingAvailability || !bookingAvailability.isBookable || isCheckingAvailability
                    ? 'bg-secondary-300 text-secondary-500 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                }`}
              >
                {isBooking ? (
                  <> <Loader2 className="animate-spin h-5 w-5 mr-2"/> Processing... </>
                ) : isCheckingAvailability ? (
                  <> <Loader2 className="animate-spin h-5 w-5 mr-2"/> Checking... </>
                ) : !bookingAvailability?.isBookable && bookingData.startTime && bookingData.endTime ? (
                    'Not Available for Booking'
                ) : (
                    'Confirm Booking'
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        !loading && ( 
            <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <MapPin className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-secondary-900 mb-2">
                    {error ? "Location Error" : "No Location Specified"}
                </h2>
                <p className="text-secondary-600">
                    {error || "Please select a location from the homepage to make a booking."}
                </p>
                <button 
                    onClick={() => navigate('/')} 
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
                    Back to Homepage
                </button>
            </div>
        )
      )}
    </div>
  );
};

export default UserDashboard;

// import React, { useState, useEffect } from 'react';
// import { useSearchParams } from 'react-router-dom';
// import axios from 'axios';
// import { Calendar, Clock, MapPin } from 'lucide-react';
// import dayjs from 'dayjs';
// import StarRating from '../../components/common/StarRating';

// type Location = {
//   id: number;
//   name: string;
//   latitude: number;
//   longitude: number;
//   totalSlots: number;
//   availableSlots: number;
//   coverImageUrl: string;
//   averageRating: number;
// };

// const UserDashboard: React.FC = () => {
//   const [searchParams] = useSearchParams();
//   const [location, setLocation] = useState<Location | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [bookingData, setBookingData] = useState({
//     startTime: '',
//     endTime: '',
//   });

//   useEffect(() => {
//     const locationId = searchParams.get('locationId');
//     if (locationId) {
//       fetchLocation(locationId);
//     } else {
//       setLoading(false);
//     }
//   }, [searchParams]);

//   const fetchLocation = async (id: string) => {
//     try {
//       const response = await axios.get(`/api/locations/${id}`);
//       setLocation(response.data);
//       setLoading(false);
//     } catch (error) {
//       console.error('Error fetching location:', error);
//       setError('Failed to load location details');
//       setLoading(false);
//     }
//   };

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value } = e.target;
//     setBookingData(prev => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleBooking = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!location) return;

//     try {
//       await axios.post('/api/bookings', {
//         parkingLocationId: location.id,
//         startTime: bookingData.startTime,
//         endTime: bookingData.endTime,
//       });

//       // Reset form and show success message
//       setBookingData({
//         startTime: '',
//         endTime: '',
//       });
//       // You might want to redirect to booking history or show a success message
//     } catch (error) {
//       console.error('Error creating booking:', error);
//       setError('Failed to create booking');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex justify-center items-center h-64">
//         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-secondary-900 mb-2">Book a Parking Spot</h1>
//         <p className="text-secondary-600">
//           {location
//             ? `Reserve your parking spot at ${location.name}`
//             : 'Select a parking location to make a reservation'}
//         </p>
//       </div>

//       {error && (
//         <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
//           <p className="text-red-700">{error}</p>
//         </div>
//       )}

//       {location ? (
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//           <div className="bg-white rounded-lg shadow-md overflow-hidden">
//             <img
//               src={location.coverImageUrl || 'https://images.pexels.com/photos/1756957/pexels-photo-1756957.jpeg'}
//               alt={location.name}
//               className="w-full h-48 object-cover"
//             />
//             <div className="p-6">
//               <h2 className="text-2xl font-semibold text-secondary-900 mb-4">{location.name}</h2>
//               <div className="space-y-3">
//                 <div className="flex items-center text-secondary-600">
//                   <MapPin className="h-5 w-5 mr-2" />
//                   <span>
//                     {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
//                   </span>
//                 </div>
//                 <div className="flex items-center">
//                   <StarRating rating={location.averageRating} readonly />
//                   <span className="ml-2 text-secondary-600">
//                     {location.averageRating.toFixed(1)} out of 5
//                   </span>
//                 </div>
//                 <div className="text-secondary-600">
//                   Available Slots: <span className="font-semibold text-secondary-900">
//                     {location.availableSlots}
//                   </span> / {location.totalSlots}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h3 className="text-xl font-semibold text-secondary-900 mb-4">Make a Reservation</h3>
//             <form onSubmit={handleBooking} className="space-y-6">
//               <div>
//                 <label className="block text-sm font-medium text-secondary-700 mb-2">
//                   Start Time
//                 </label>
//                 <div className="relative">
//                   <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
//                   <input
//                     type="datetime-local"
//                     name="startTime"
//                     value={bookingData.startTime}
//                     onChange={handleInputChange}
//                     min={dayjs().format('YYYY-MM-DDTHH:mm')}
//                     className="pl-10 w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
//                     required
//                   />
//                 </div>
//               </div>
              
//               <div>
//                 <label className="block text-sm font-medium text-secondary-700 mb-2">
//                   End Time
//                 </label>
//                 <div className="relative">
//                   <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
//                   <input
//                     type="datetime-local"
//                     name="endTime"
//                     value={bookingData.endTime}
//                     onChange={handleInputChange}
//                     min={bookingData.startTime || dayjs().format('YYYY-MM-DDTHH:mm')}
//                     className="pl-10 w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
//                     required
//                   />
//                 </div>
//               </div>

//               <button
//                 type="submit"
//                 disabled={location.availableSlots === 0}
//                 className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
//                   location.availableSlots === 0
//                     ? 'bg-secondary-300 cursor-not-allowed'
//                     : 'bg-primary-600 hover:bg-primary-700'
//                 }`}
//               >
//                 {location.availableSlots === 0 ? 'No Slots Available' : 'Book Now'}
//               </button>
//             </form>
//           </div>
//         </div>
//       ) : (
//         <div className="text-center py-12 bg-white rounded-lg shadow-md">
//           <MapPin className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
//           <h2 className="text-xl font-semibold text-secondary-900 mb-2">
//             No Location Selected
//           </h2>
//           <p className="text-secondary-600">
//             Please select a parking location from the homepage to make a reservation.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// };

// export default UserDashboard;
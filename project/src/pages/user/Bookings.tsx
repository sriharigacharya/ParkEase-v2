// src/pages/user/Bookings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { Calendar, Clock, MapPin, AlertCircle, CheckCircle, XCircle, MessageSquare, Car as CarIcon, TrendingUp, LogIn as LogInIcon, LogOut as LogOutIcon } from 'lucide-react'; // Added LogInIcon, LogOutIcon
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

type Booking = {
  id: number;
  startTime: string;
  endTime: string;
  locationName: string;
  locationId: number;
  status: string;
  licensePlateBooked?: string;
  actualEntryTime?: string | null; // New field
  actualExitTime?: string | null;
  finalCost?: number | null;
};

interface ErrorResponseData {
  message?: string;
}

const UserBookings: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatUserDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('ddd, MMM D, YY, h:mm A');
  };

  const fetchBookings = useCallback(async (isManualRefresh = false) => {
    if (!isManualRefresh && bookings.length > 0) {
      // For automatic refresh, don't show main loader
    } else {
      setLoading(true);
    }
    setFetchError(null);

    try {
      const response = await axios.get('/api/locations/bookings', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (response.data && Array.isArray(response.data)) {
        const mappedBookings = response.data.map((b: any) => ({
          id: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          locationName: b.locationName || 'N/A',
          locationId: b.locationId,
          status: b.status,
          licensePlateBooked: b.licensePlateBooked,
          actualEntryTime: b.actualEntryTime, // Map new field
          actualExitTime: b.actualExitTime, 
          finalCost: b.finalCost,          
        }));
        setBookings(mappedBookings);
      } else {
        console.error('Invalid response format for bookings:', response.data);
        setFetchError('Failed to load bookings: Invalid server response.');
      }
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      const axiosErr = err as AxiosError<ErrorResponseData>;
      if (axiosErr.isAxiosError && axiosErr.response?.status === 401) {
        navigate('/login');
      } else {
        setFetchError(axiosErr.response?.data?.message || 'Failed to load booking history.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, bookings.length]);

  useEffect(() => {
    fetchBookings(true); 

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBookings();
      }
    };
    const handleFocus = () => {
      fetchBookings();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchBookings]);

  const handleCancelBooking = async (bookingId: number) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const response = await axios.patch(`/api/locations/bookings/${bookingId}/cancel`);
      setActionSuccess(response.data.message || 'Booking cancelled successfully!');
      fetchBookings(true);
    } catch (err: any) {
      const axiosErr = err as AxiosError<ErrorResponseData>;
      setActionError(axiosErr.response?.data?.message || 'Failed to cancel booking.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading && bookings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-secondary-900 mb-2">My Bookings</h1>
            <p className="text-secondary-600">View and manage your parking reservations.</p>
        </div>
        <button
            onClick={() => fetchBookings(true)}
            disabled={loading}
            className="px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-primary-300 flex items-center"
        >
            <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001a7.5 7.5 0 0 0-1.962-4.288l-3.03 3.03ZM2.25 12c0-2.968 1.845-5.503 4.5-6.592l3.03 3.03A7.466 7.466 0 0 0 9.348 16.023L6.318 19.053A7.485 7.485 0 0 1 2.25 12Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25a7.5 7.5 0 0 1 7.5 7.5c0 .803-.132 1.576-.372 2.298l-3.03-3.03A7.466 7.466 0 0 0 14.652 7.977L11.622 4.947A7.485 7.485 0 0 1 12 2.25Zm0 19.5a7.5 7.5 0 0 1-7.5-7.5c0-.803.132-1.576-.372-2.298l3.03 3.03c.178.19.374.362.58.516l3.03 3.03A7.485 7.485 0 0 1 12 21.75Z" />
            </svg>
            Refresh
        </button>
      </div>

      {fetchError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <AlertCircle className="h-5 w-5 mr-3" /> <p>{fetchError}</p>
        </div>
      )}
      {actionError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <AlertCircle className="h-5 w-5 mr-3" /> <p>{actionError}</p>
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <CheckCircle className="h-5 w-5 mr-3" /> <p>{actionSuccess}</p>
        </div>
      )}

      {bookings.length === 0 && !fetchError && !loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-xl">
          <Calendar className="h-16 w-16 text-secondary-400 mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-secondary-900 mb-2">
            No Bookings Yet
          </h2>
          <p className="text-secondary-600 mb-6">
            You haven't made any parking reservations.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors">
            Find Parking
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map(booking => {
            const now = dayjs();
            const startTime = dayjs(booking.startTime);
            const endTime = dayjs(booking.endTime);

            let statusText = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
            let statusColorClasses = 'bg-secondary-100 text-secondary-800 border-secondary-400';

            if (booking.status === 'cancelled') {
              statusText = 'Cancelled';
              statusColorClasses = 'bg-red-100 text-red-700 border-red-500';
            } else if (booking.status === 'completed') {
              statusText = 'Completed';
              statusColorClasses = 'bg-gray-200 text-gray-800 border-gray-500';
            } else if (booking.status === 'checked-in') {
              statusText = 'Checked-In / Active';
              statusColorClasses = 'bg-green-100 text-green-700 border-green-500';
            } else if (booking.status === 'confirmed') {
              if (startTime.isAfter(now)) {
                statusText = 'Upcoming';
                statusColorClasses = 'bg-blue-100 text-blue-700 border-blue-500';
              } else if (now.isBetween(startTime, endTime, null, '[]')) {
                statusText = 'Due for Check-in'; 
                statusColorClasses = 'bg-yellow-100 text-yellow-700 border-yellow-500';
              } else { 
                statusText = 'Missed';
                statusColorClasses = 'bg-orange-100 text-orange-700 border-orange-500';
              }
            }
            
            const canLeaveFeedback = booking.status === 'completed';
            const canCancel = booking.status === 'confirmed' && startTime.isAfter(now.add(1, 'hour')); 

            return (
              <div
                key={booking.id}
                className={`bg-white rounded-lg shadow-lg overflow-hidden border-l-4 ${statusColorClasses.split(' ')[2]}`}
              >
                <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
                        <div>
                            <div className="flex items-center text-xl font-semibold text-secondary-900 mb-1">
                                <MapPin className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0" />
                                {booking.locationName}
                            </div>
                            <p className="text-xs text-secondary-500 ml-7">(Booking ID: {booking.id})</p>
                        </div>
                        <div className={`mt-2 sm:mt-0 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${statusColorClasses}`}>
                            {statusText}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-secondary-700 mb-4">
                        <div className="flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-secondary-500 flex-shrink-0" />
                            <div>
                                <span className="font-medium block text-xs text-secondary-500">Scheduled Entry</span>
                                {formatUserDateTime(booking.startTime)}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <Clock className="h-5 w-5 mr-2 text-secondary-500 flex-shrink-0" />
                            <div>
                                <span className="font-medium block text-xs text-secondary-500">Scheduled Exit</span>
                                {formatUserDateTime(booking.endTime)}
                            </div>
                        </div>
                        
                        {/* Display Actual Entry Time if available (for checked-in or completed) */}
                        {(booking.status === 'checked-in' || booking.status === 'completed') && booking.actualEntryTime && (
                            <div className="flex items-center">
                                <LogInIcon className="h-5 w-5 mr-2 text-green-600 flex-shrink-0" />
                                <div>
                                    <span className="font-medium block text-xs text-secondary-500">Actual Entry</span>
                                    {formatUserDateTime(booking.actualEntryTime)}
                                </div>
                            </div>
                        )}

                        {/* Display Actual Exit Time if booking is completed */}
                        {booking.status === 'completed' && booking.actualExitTime && (
                            <div className="flex items-center">
                                <LogOutIcon className="h-5 w-5 mr-2 text-red-600 flex-shrink-0" />
                                <div>
                                    <span className="font-medium block text-xs text-secondary-500">Actual Exit</span>
                                    {formatUserDateTime(booking.actualExitTime)}
                                </div>
                            </div>
                        )}

                        {booking.licensePlateBooked && (
                           <div className="flex items-center"> {/* Placed it after time details for better flow */}
                                <CarIcon className="h-5 w-5 mr-2 text-secondary-500 flex-shrink-0" />
                                <div>
                                    <span className="font-medium block text-xs text-secondary-500">License Plate</span>
                                    {booking.licensePlateBooked}
                                </div>
                            </div>
                        )}
                        
                        {(booking.status === 'completed' && booking.finalCost !== null && booking.finalCost !== undefined) && (
                            <div className="flex items-center">
                                <TrendingUp className="h-5 w-5 mr-2 text-green-600 flex-shrink-0" />
                                <div>
                                    <span className="font-medium block text-xs text-secondary-500">Final Cost</span>
                                    ₹{Number(booking.finalCost).toFixed(2)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {(canLeaveFeedback || canCancel) && (
                    <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-200 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                    {canLeaveFeedback && (
                        <button
                        onClick={() => navigate(`/user/feedback?bookingId=${booking.id}&locationId=${booking.locationId}&locationName=${encodeURIComponent(booking.locationName)}`)}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-md shadow-sm transition-colors disabled:opacity-70"
                        >
                        <MessageSquare className="h-4 w-4 mr-1.5" /> Leave Feedback
                        </button>
                    )}
                    {canCancel && (
                        <button
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md shadow-sm transition-colors disabled:opacity-70"
                        >
                        <XCircle className="h-4 w-4 mr-1.5" /> Cancel Booking
                        </button>
                    )}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserBookings;









// // src/pages/user/Bookings.tsx
// import React, { useState, useEffect, useCallback } from 'react';
// import axios, { AxiosError } from 'axios'; // AxiosError is imported
// import { Calendar, Clock, MapPin, AlertCircle, CheckCircle, XCircle, MessageSquare, Car as CarIcon, TrendingUp } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import dayjs from 'dayjs';
// import isBetween from 'dayjs/plugin/isBetween';

// dayjs.extend(isBetween);

// type Booking = {
//   id: number;
//   startTime: string;
//   endTime: string;
//   locationName: string;
//   locationId: number;
//   status: string;
//   licensePlateBooked?: string;
//   actualExitTime?: string | null;
//   finalCost?: number | null;
// };

// // Define the expected structure of error response data if it contains a message
// interface ErrorResponseData {
//   message?: string;
// }

// const UserBookings: React.FC = () => {
//   const navigate = useNavigate();
//   const [bookings, setBookings] = useState<Booking[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [fetchError, setFetchError] = useState<string | null>(null);
//   const [actionError, setActionError] = useState<string | null>(null);
//   const [actionSuccess, setActionSuccess] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const formatUserDateTime = (dateString?: string | null) => {
//     if (!dateString) return 'N/A';
//     return dayjs(dateString).format('ddd, MMM D, YY, h:mm A');
//   };

//   const fetchBookings = useCallback(async (isManualRefresh = false) => {
//     if (!isManualRefresh && bookings.length > 0) {
//       // For automatic refresh, don't show main loader if data already exists
//     } else {
//       setLoading(true);
//     }
//     setFetchError(null);

//     try {
//       const response = await axios.get('/api/locations/bookings', {
//         headers: { // Cache-busting headers
//           'Cache-Control': 'no-cache, no-store, must-revalidate',
//           'Pragma': 'no-cache',
//           'Expires': '0',
//         },
//       });

//       if (response.data && Array.isArray(response.data)) {
//         const mappedBookings = response.data.map((b: any) => ({
//           id: b.id,
//           startTime: b.startTime,
//           endTime: b.endTime,
//           locationName: b.locationName || 'N/A',
//           locationId: b.locationId,
//           status: b.status,
//           licensePlateBooked: b.licensePlateBooked,
//           actualExitTime: b.actualExitTime, 
//           finalCost: b.finalCost,          
//         }));
//         setBookings(mappedBookings);
//       } else {
//         console.error('Invalid response format for bookings:', response.data);
//         setFetchError('Failed to load bookings: Invalid server response.');
//       }
//     } catch (err: any) {
//       console.error('Error fetching bookings:', err);
//       // Use AxiosError with a generic type for the expected response.data structure
//       const axiosErr = err as AxiosError<ErrorResponseData>;
//       if (axiosErr.isAxiosError && axiosErr.response?.status === 401) {
//         navigate('/login');
//       } else {
//         setFetchError(axiosErr.response?.data?.message || 'Failed to load booking history.');
//       }
//     } finally {
//       setLoading(false);
//     }
//   }, [navigate, bookings.length]);

//   useEffect(() => {
//     fetchBookings(true); 

//     const handleVisibilityChange = () => {
//       if (document.visibilityState === 'visible') {
//         fetchBookings();
//       }
//     };
//     const handleFocus = () => {
//       fetchBookings();
//     };
//     document.addEventListener('visibilitychange', handleVisibilityChange);
//     window.addEventListener('focus', handleFocus);
//     return () => {
//       document.removeEventListener('visibilitychange', handleVisibilityChange);
//       window.removeEventListener('focus', handleFocus);
//     };
//   }, [fetchBookings]);

//   const handleCancelBooking = async (bookingId: number) => {
//     if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       const response = await axios.patch(`/api/locations/bookings/${bookingId}/cancel`);
//       setActionSuccess(response.data.message || 'Booking cancelled successfully!');
//       fetchBookings(true);
//     } catch (err: any) {
//       console.error('Error cancelling booking:', err);
//       const axiosErr = err as AxiosError<ErrorResponseData>;
//       setActionError(axiosErr.response?.data?.message || 'Failed to cancel booking.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };
  
//   if (loading && bookings.length === 0) {
//     return (
//       <div className="flex justify-center items-center h-64">
//         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       <div className="mb-8 flex justify-between items-center">
//         <div>
//             <h1 className="text-3xl font-bold text-secondary-900 mb-2">My Bookings</h1>
//             <p className="text-secondary-600">View and manage your parking reservations.</p>
//         </div>
//         <button
//             onClick={() => fetchBookings(true)}
//             disabled={loading}
//             className="px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-primary-300 flex items-center"
//         >
//             <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001a7.5 7.5 0 0 0-1.962-4.288l-3.03 3.03ZM2.25 12c0-2.968 1.845-5.503 4.5-6.592l3.03 3.03A7.466 7.466 0 0 0 9.348 16.023L6.318 19.053A7.485 7.485 0 0 1 2.25 12Z" />
//               <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25a7.5 7.5 0 0 1 7.5 7.5c0 .803-.132 1.576-.372 2.298l-3.03-3.03A7.466 7.466 0 0 0 14.652 7.977L11.622 4.947A7.485 7.485 0 0 1 12 2.25Zm0 19.5a7.5 7.5 0 0 1-7.5-7.5c0-.803.132-1.576-.372-2.298l3.03 3.03c.178.19.374.362.58.516l3.03 3.03A7.485 7.485 0 0 1 12 21.75Z" />
//             </svg>
//             Refresh
//         </button>
//       </div>

//       {fetchError && (
//         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
//           <AlertCircle className="h-5 w-5 mr-3" /> <p>{fetchError}</p>
//         </div>
//       )}
//       {actionError && (
//         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
//           <AlertCircle className="h-5 w-5 mr-3" /> <p>{actionError}</p>
//         </div>
//       )}
//       {actionSuccess && (
//         <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md flex items-center" role="alert">
//           <CheckCircle className="h-5 w-5 mr-3" /> <p>{actionSuccess}</p>
//         </div>
//       )}

//       {bookings.length === 0 && !fetchError && !loading ? (
//         <div className="text-center py-12 bg-white rounded-lg shadow-xl">
//           <Calendar className="h-16 w-16 text-secondary-400 mx-auto mb-6" />
//           <h2 className="text-2xl font-semibold text-secondary-900 mb-2">
//             No Bookings Yet
//           </h2>
//           <p className="text-secondary-600 mb-6">
//             You haven't made any parking reservations.
//           </p>
//           <button 
//             onClick={() => navigate('/')}
//             className="px-6 py-2 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors">
//             Find Parking
//           </button>
//         </div>
//       ) : (
//         <div className="space-y-6">
//           {bookings.map(booking => {
//             const now = dayjs();
//             const startTime = dayjs(booking.startTime);
//             const endTime = dayjs(booking.endTime);

//             let statusText = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
//             let statusColorClasses = 'bg-secondary-100 text-secondary-800 border-secondary-400';

//             if (booking.status === 'cancelled') {
//               statusText = 'Cancelled';
//               statusColorClasses = 'bg-red-100 text-red-700 border-red-500';
//             } else if (booking.status === 'completed') {
//               statusText = 'Completed';
//               statusColorClasses = 'bg-gray-200 text-gray-800 border-gray-500';
//             } else if (booking.status === 'checked-in') {
//               statusText = 'Checked-In / Active';
//               statusColorClasses = 'bg-green-100 text-green-700 border-green-500';
//             } else if (booking.status === 'confirmed') {
//               if (startTime.isAfter(now)) {
//                 statusText = 'Upcoming';
//                 statusColorClasses = 'bg-blue-100 text-blue-700 border-blue-500';
//               } else if (now.isBetween(startTime, endTime, null, '[]')) {
//                 statusText = 'Due for Check-in'; 
//                 statusColorClasses = 'bg-yellow-100 text-yellow-700 border-yellow-500';
//               } else { 
//                 statusText = 'Missed';
//                 statusColorClasses = 'bg-orange-100 text-orange-700 border-orange-500';
//               }
//             }
            
//             const canLeaveFeedback = booking.status === 'completed';
//             const canCancel = booking.status === 'confirmed' && startTime.isAfter(now.add(1, 'hour')); 

//             return (
//               <div
//                 key={booking.id}
//                 className={`bg-white rounded-lg shadow-lg overflow-hidden border-l-4 ${statusColorClasses.split(' ')[2]}`}
//               >
//                 <div className="p-6">
//                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
//                         <div>
//                             <div className="flex items-center text-xl font-semibold text-secondary-900 mb-1">
//                                 <MapPin className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0" />
//                                 {booking.locationName}
//                             </div>
//                             <p className="text-xs text-secondary-500 ml-7">(Booking ID: {booking.id})</p>
//                         </div>
//                         <div className={`mt-2 sm:mt-0 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${statusColorClasses}`}>
//                             {statusText}
//                         </div>
//                     </div>

//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-secondary-700 mb-4">
//                         <div className="flex items-center">
//                             <Calendar className="h-5 w-5 mr-2 text-secondary-500 flex-shrink-0" />
//                             <div>
//                                 <span className="font-medium block text-xs text-secondary-500">Scheduled Entry</span>
//                                 {formatUserDateTime(booking.startTime)}
//                             </div>
//                         </div>
//                         <div className="flex items-center">
//                             <Clock className="h-5 w-5 mr-2 text-secondary-500 flex-shrink-0" />
//                             <div>
//                                 <span className="font-medium block text-xs text-secondary-500">Scheduled Exit</span>
//                                 {formatUserDateTime(booking.endTime)}
//                             </div>
//                         </div>
//                         {booking.licensePlateBooked && (
//                            <div className="flex items-center md:col-span-2">
//                                 <CarIcon className="h-5 w-5 mr-2 text-secondary-500 flex-shrink-0" />
//                                 <div>
//                                     <span className="font-medium block text-xs text-secondary-500">License Plate</span>
//                                     {booking.licensePlateBooked}
//                                 </div>
//                             </div>
//                         )}
//                         {booking.status === 'completed' && (
//                             <>
//                                 {booking.actualExitTime && (
//                                     <div className="flex items-center">
//                                         <Clock className="h-5 w-5 mr-2 text-green-600 flex-shrink-0" />
//                                         <div>
//                                             <span className="font-medium block text-xs text-secondary-500">Actual Exit</span>
//                                             {formatUserDateTime(booking.actualExitTime)}
//                                         </div>
//                                     </div>
//                                 )}
//                                 {(booking.finalCost !== null && booking.finalCost !== undefined) && (
//                                     <div className="flex items-center">
//                                         <TrendingUp className="h-5 w-5 mr-2 text-green-600 flex-shrink-0" />
//                                         <div>
//                                             <span className="font-medium block text-xs text-secondary-500">Final Cost</span>
//                                             ₹{Number(booking.finalCost).toFixed(2)}
//                                         </div>
//                                     </div>
//                                 )}
//                             </>
//                         )}
//                     </div>
//                 </div>
                
//                 {(canLeaveFeedback || canCancel) && (
//                     <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-200 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
//                     {canLeaveFeedback && (
//                         <button
//                         onClick={() => navigate(`/user/feedback?bookingId=${booking.id}&locationId=${booking.locationId}&locationName=${encodeURIComponent(booking.locationName)}`)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-md shadow-sm transition-colors disabled:opacity-70"
//                         >
//                         <MessageSquare className="h-4 w-4 mr-1.5" /> Leave Feedback
//                         </button>
//                     )}
//                     {canCancel && (
//                         <button
//                         onClick={() => handleCancelBooking(booking.id)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md shadow-sm transition-colors disabled:opacity-70"
//                         >
//                         <XCircle className="h-4 w-4 mr-1.5" /> Cancel Booking
//                         </button>
//                     )}
//                     </div>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// };

// export default UserBookings;





// // // src/pages/user/Bookings.tsx

// // import React, { useState, useEffect } from 'react';
// // import axios from 'axios';
// // import { Calendar, Clock, MapPin } from 'lucide-react';
// // import dayjs from 'dayjs';
// // import isBetween from 'dayjs/plugin/isBetween'; // Import for isActive calculation

// // dayjs.extend(isBetween); // Extend dayjs with the isBetween plugin

// // type Booking = {
// //   id: number;
// //   startTime: string;      // Changed from start_time
// //   endTime: string;        // Changed from end_time
// //   locationName: string;   // Changed from location_name
// //   locationId: number;     // Changed from location_id
// // };

// // const UserBookings: React.FC = () => {
// //   const [bookings, setBookings] = useState<Booking[]>([]);
// //   const [loading, setLoading] = useState(true);
// //   const [error, setError] = useState<string | null>(null);

// //   useEffect(() => {
// //     fetchBookings();
// //   }, []);

// //   const fetchBookings = async () => {
// //     setLoading(true);
// //     setError(null);
// //     try {
// //       // === CORRECTED API PATH HERE ===
// //       const response = await axios.get('/api/locations/bookings'); 
// //       setBookings(response.data);
// //     } catch (err: any) { 
// //       console.error('Error fetching bookings:', err);
// //       setError(err.response?.data?.message || 'Failed to load booking history');
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   if (loading) {
// //     return (
// //       <div className="flex justify-center items-center h-64">
// //         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
// //       <div className="mb-8">
// //         <h1 className="text-3xl font-bold text-secondary-900 mb-2">My Bookings</h1>
// //         <p className="text-secondary-600">
// //           View and manage your parking reservations.
// //         </p>
// //       </div>

// //       {error && (
// //         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
// //           <p className="font-bold">Error</p>
// //           <p>{error}</p>
// //         </div>
// //       )}

// //       {bookings.length === 0 && !error && !loading ? (
// //         <div className="text-center py-12 bg-white rounded-lg shadow-md">
// //           <Calendar className="h-16 w-16 text-secondary-400 mx-auto mb-4" />
// //           <h2 className="text-xl font-semibold text-secondary-900 mb-2">
// //             No Bookings Yet
// //           </h2>
// //           <p className="text-secondary-600">
// //             You haven't made any parking reservations yet.
// //           </p>
// //         </div>
// //       ) : (
// //         <div className="space-y-6">
// //           {bookings.map(booking => {
// //             const isUpcoming = dayjs(booking.startTime).isAfter(dayjs());
// //             const isActive = dayjs().isBetween(dayjs(booking.startTime), dayjs(booking.endTime));
            
// //             return (
// //               <div
// //                 key={booking.id}
// //                 className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
// //                   isActive
// //                     ? 'border-green-500'
// //                     : isUpcoming
// //                     ? 'border-primary-500'
// //                     : 'border-secondary-300'
// //                 }`}
// //               >
// //                 <div className="flex flex-col md:flex-row md:items-center md:justify-between">
// //                   <div className="mb-4 md:mb-0">
// //                     <div className="flex items-center text-lg font-semibold text-secondary-900 mb-2">
// //                       <MapPin className="h-5 w-5 mr-2 text-primary-600" />
// //                       {/* === CORRECTED PROPERTY ACCESS (camelCase) === */}
// //                       {booking.locationName} 
// //                     </div>
// //                     <div className="space-y-2 text-secondary-600">
// //                       <div className="flex items-center">
// //                         <Calendar className="h-4 w-4 mr-2" />
// //                         <span>
// //                           {/* === CORRECTED PROPERTY ACCESS (camelCase) === */}
// //                           {dayjs(booking.startTime).format('MMM D, YYYY')} 
// //                         </span>
// //                       </div>
// //                       <div className="flex items-center">
// //                         <Clock className="h-4 w-4 mr-2" />
// //                         <span>
// //                           {/* === CORRECTED PROPERTY ACCESS (camelCase) === */}
// //                           {dayjs(booking.startTime).format('h:mm A')} - {dayjs(booking.endTime).format('h:mm A')}
// //                         </span>
// //                       </div>
// //                     </div>
// //                   </div>
// //                   <div className="flex items-center mt-4 md:mt-0">
// //                     <span
// //                       className={`px-3 py-1 rounded-full text-sm font-medium ${
// //                         isActive
// //                           ? 'bg-green-100 text-green-800'
// //                           : isUpcoming
// //                           ? 'bg-primary-100 text-primary-800'
// //                           : 'bg-secondary-100 text-secondary-800'
// //                       }`}
// //                     >
// //                       {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Past'}
// //                     </span>
// //                   </div>
// //                 </div>
// //               </div>
// //             );
// //           })}
// //         </div>
// //       )}
// //     </div>
// //   );
// // };

// // export default UserBookings;

// // import React, { useState, useEffect } from 'react';
// // import axios from 'axios';
// // import { Calendar, Clock, MapPin } from 'lucide-react';
// // import dayjs from 'dayjs';

// // type Booking = {
// //   id: number;
// //   start_time: string;
// //   end_time: string;
// //   location_name: string;
// //   location_id: number;
// // };

// // const UserBookings: React.FC = () => {
// //   const [bookings, setBookings] = useState<Booking[]>([]);
// //   const [loading, setLoading] = useState(true);
// //   const [error, setError] = useState<string | null>(null);

// //   useEffect(() => {
// //     fetchBookings();
// //   }, []);

// //   const fetchBookings = async () => {
// //     try {
// //       const response = await axios.get('/api/bookings');
// //       setBookings(response.data);
// //       setLoading(false);
// //     } catch (error) {
// //       console.error('Error fetching bookings:', error);
// //       setError('Failed to load booking history');
// //       setLoading(false);
// //     }
// //   };

// //   if (loading) {
// //     return (
// //       <div className="flex justify-center items-center h-64">
// //         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
// //       <div className="mb-8">
// //         <h1 className="text-3xl font-bold text-secondary-900 mb-2">My Bookings</h1>
// //         <p className="text-secondary-600">
// //           View and manage your parking reservations.
// //         </p>
// //       </div>

// //       {error && (
// //         <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
// //           <p className="text-red-700">{error}</p>
// //         </div>
// //       )}

// //       {bookings.length === 0 ? (
// //         <div className="text-center py-12 bg-white rounded-lg shadow-md">
// //           <Calendar className="h-12 w-12 text-secondary-400 mx-auto mb-4" />
// //           <h2 className="text-xl font-semibold text-secondary-900 mb-2">
// //             No Bookings Yet
// //           </h2>
// //           <p className="text-secondary-600">
// //             You haven't made any parking reservations yet.
// //           </p>
// //         </div>
// //       ) : (
// //         <div className="space-y-6">
// //           {bookings.map(booking => {
// //             const isUpcoming = dayjs(booking.start_time).isAfter(dayjs());
// //             const isActive = dayjs().isBetween(dayjs(booking.start_time), dayjs(booking.end_time));
            
// //             return (
// //               <div
// //                 key={booking.id}
// //                 className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
// //                   isActive
// //                     ? 'border-green-500'
// //                     : isUpcoming
// //                     ? 'border-primary-500'
// //                     : 'border-secondary-300'
// //                 }`}
// //               >
// //                 <div className="flex flex-col md:flex-row md:items-center md:justify-between">
// //                   <div className="mb-4 md:mb-0">
// //                     <div className="flex items-center text-lg font-semibold text-secondary-900 mb-2">
// //                       <MapPin className="h-5 w-5 mr-2 text-primary-600" />
// //                       {booking.location_name}
// //                     </div>
// //                     <div className="space-y-2 text-secondary-600">
// //                       <div className="flex items-center">
// //                         <Calendar className="h-4 w-4 mr-2" />
// //                         <span>
// //                           {dayjs(booking.start_time).format('MMM D, YYYY')}
// //                         </span>
// //                       </div>
// //                       <div className="flex items-center">
// //                         <Clock className="h-4 w-4 mr-2" />
// //                         <span>
// //                           {dayjs(booking.start_time).format('h:mm A')} - {dayjs(booking.end_time).format('h:mm A')}
// //                         </span>
// //                       </div>
// //                     </div>
// //                   </div>
// //                   <div className="flex items-center">
// //                     <span
// //                       className={`px-3 py-1 rounded-full text-sm font-medium ${
// //                         isActive
// //                           ? 'bg-green-100 text-green-800'
// //                           : isUpcoming
// //                           ? 'bg-primary-100 text-primary-800'
// //                           : 'bg-secondary-100 text-secondary-800'
// //                       }`}
// //                     >
// //                       {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Past'}
// //                     </span>
// //                   </div>
// //                 </div>
// //               </div>
// //             );
// //           })}
// //         </div>
// //       )}
// //     </div>
// //   );
// // };

// // export default UserBookings;
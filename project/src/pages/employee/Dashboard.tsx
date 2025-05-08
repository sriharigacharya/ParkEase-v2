// src/pages/employee/EmployeeDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios'; // AxiosError is imported
import dayjs from 'dayjs';
import { Car, LogIn, LogOut, MapPin, Clock, CheckSquare, XSquare, UserCheck, ListChecks, AlertTriangle, Info, Ban, UserMinus } from 'lucide-react';

type LocationDetails = {
  id: number;
  name: string;
  totalSlots: number;
  availableSlots: number;
};

type VehicleSession = {
  id: number;
  licensePlate: string;
  entryTime: string;
  exitTime?: string | null;
  cost?: number | null;
  bookingId?: number | null;
};

type LocationBooking = {
  bookingId: number;
  userId: number;
  userName: string;
  startTime: string;
  endTime: string;
  status: string;
  licensePlateBooked?: string | null;
  checkedInLicensePlate?: string | null;
};

// Define the expected structure of error response data if it contains a message
interface ErrorResponseData {
  message?: string;
}

const EmployeeDashboard: React.FC = () => {
  const [location, setLocation] = useState<LocationDetails | null>(null);
  const [parkedVehicles, setParkedVehicles] = useState<VehicleSession[]>([]);
  const [recentActivity, setRecentActivity] = useState<VehicleSession[]>([]);
  const [locationBookings, setLocationBookings] = useState<LocationBooking[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [licensePlateInput, setLicensePlateInput] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState<number>(0); // Retained for potential future use

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
      setPageError(null);
    }
    setActionError(null);
    setActionSuccess(null);

    let locationDetailsPromiseFailed = false;

    try {
      const [locationRes, allVehicleSessionsRes, rateRes, locationBookingsRes] = await Promise.allSettled([
        axios.get('/api/employee/location'),
        axios.get('/api/employee/vehicles'),
        axios.get('/api/settings/rate'), 
        axios.get('/api/employee/location-bookings')
      ]);

      if (locationRes.status === 'fulfilled') {
        const fetchedLocation: LocationDetails = {
          id: locationRes.value.data.id,
          name: locationRes.value.data.name,
          totalSlots: locationRes.value.data.totalSlots || locationRes.value.data.total_slots,
          availableSlots: locationRes.value.data.availableSlots || locationRes.value.data.available_slots,
        };
        setLocation(fetchedLocation);
      } else {
        locationDetailsPromiseFailed = true;
        console.error("Failed to fetch location details:", locationRes.reason);
        throw locationRes.reason; 
      }

      if (allVehicleSessionsRes.status === 'fulfilled') {
        const fetchedSessions: VehicleSession[] = (allVehicleSessionsRes.value.data || []).map((v: any) => ({
          id: v.id,
          licensePlate: v.licensePlate || v.license_plate,
          entryTime: v.entryTime || v.entry_time,
          exitTime: v.exitTime || v.exit_time,
          cost: v.cost,
          bookingId: v.bookingId === undefined ? null : v.bookingId
        }));
        
        console.log("ALL FETCHED SESSIONS (Raw data from /api/employee/vehicles):", JSON.stringify(fetchedSessions, null, 2));
        
        setRecentActivity(fetchedSessions.sort((a, b) => dayjs(b.entryTime).valueOf() - dayjs(a.entryTime).valueOf()));
        
        const filteredForParked = fetchedSessions.filter(v => {
          const isNotExited = !v.exitTime;
          const isPureDriveUp = v.bookingId === null;

          console.log(
            `Filtering Session ID: ${v.id}, LP: ${v.licensePlate}, ` +
            `bookingId: '${v.bookingId}' (type: ${typeof v.bookingId}), ` +
            `exitTime: ${v.exitTime}, ` +
            `isPureDriveUpCheck: ${isPureDriveUp}, isNotExitedCheck: ${isNotExited}`
          );
          return isNotExited && isPureDriveUp;
        });

        console.log("FILTERED SESSIONS FOR PARKEDVEHICLES DROPDOWN (should be pure drive-ups):", JSON.stringify(filteredForParked, null, 2));
        setParkedVehicles(filteredForParked);
      } else {
        console.error("Failed to fetch vehicle sessions:", (allVehicleSessionsRes as PromiseRejectedResult).reason);
        setRecentActivity([]);
        setParkedVehicles([]);
      }

      if (rateRes.status === 'fulfilled' && rateRes.value.data) {
        setHourlyRate(rateRes.value.data.hourlyRate || rateRes.value.data.hourly_rate || 0);
      } else {
        if (rateRes.status === 'rejected') {
          console.warn("Failed to fetch hourly rate from /api/settings/rate (request rejected).", rateRes.reason);
        } else {
          console.warn("Fetched hourly rate from /api/settings/rate, but no data or invalid data.", "Received value:", rateRes.value);
        }
      }

      if (locationBookingsRes.status === 'fulfilled') {
        const fetchedLocationBookings: LocationBooking[] = (locationBookingsRes.value.data || []).map((b: any) => ({
          bookingId: b.bookingId,
          userId: b.userId,
          userName: b.userName || b.user_name || `User ID: ${b.userId}`,
          startTime: b.startTime || b.start_time,
          endTime: b.endTime || b.end_time,
          status: b.status,
          licensePlateBooked: b.licensePlateBooked || b.license_plate_booked,
          checkedInLicensePlate: b.checkedInLicensePlate || b.checked_in_license_plate,
        }));
        setLocationBookings(fetchedLocationBookings.sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()));
      } else {
        console.error("Failed to fetch location bookings:", (locationBookingsRes as PromiseRejectedResult).reason);
        setLocationBookings([]);
      }

      if (isInitialLoad && !locationDetailsPromiseFailed) {
        setPageError(null);
      }

    } catch (err: any) {
      console.error('Error in fetchDashboardData catch block:', err);
      const axiosErr = err as AxiosError<ErrorResponseData>; // Corrected Type Assertion
      const specificApiMessage = axiosErr.isAxiosError && axiosErr.response?.data?.message;
      const genericDashboardMessage = 'Failed to load essential dashboard data. Please contact support.';
      
      let finalErrorMessageToShow = specificApiMessage || genericDashboardMessage;

      if (locationDetailsPromiseFailed) {
        setLocation(null);
        finalErrorMessageToShow = specificApiMessage || "No parking location assigned or location not found. Please contact administrator.";
      }
      
      if (isInitialLoad) {
        setPageError(finalErrorMessageToShow);
      } else {
        setActionError(finalErrorMessageToShow);
      }
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, []); 

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  const handleBookedUserCheckIn = async (booking: LocationBooking) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
  
    let licensePlateForCheckIn = booking.checkedInLicensePlate || booking.licensePlateBooked || '';
    
    if (!licensePlateForCheckIn.trim()) {
      const userInput = window.prompt(`Enter vehicle license plate for ${booking.userName}'s booking (ID ${booking.bookingId}):`);
      if (userInput === null) { 
        setIsSubmitting(false);
        return;
      }
      licensePlateForCheckIn = userInput.trim();
      if (!licensePlateForCheckIn) {
        setActionError("License plate is required for checking in a booking.");
        setIsSubmitting(false);
        return;
      }
    }
  
    try {
      const response = await axios.post(`/api/employee/bookings/${booking.bookingId}/checkin`, {
        licensePlate: licensePlateForCheckIn.toUpperCase()
      });
      setActionSuccess(`Booking ID ${booking.bookingId} (LP: ${licensePlateForCheckIn.toUpperCase()}) checked in. ${response.data.message || ''}`);
      fetchDashboardData();
    } catch (err: any) {
      const axiosErr = err as AxiosError<ErrorResponseData>; // Corrected Type Assertion
      setActionError(axiosErr.isAxiosError && axiosErr.response?.data?.message || `Failed to check in booking ID ${booking.bookingId}.`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleBookedUserCheckOut = async (booking: LocationBooking) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const response = await axios.post(`/api/employee/bookings/${booking.bookingId}/checkout`);
      const cost = response.data.cost;
      const lp = booking.checkedInLicensePlate || booking.licensePlateBooked || 'N/A';
      
      const successMessage = `Booking ID ${booking.bookingId} (LP: ${lp}) checked out. Cost: ${cost !== undefined && cost !== null ? `₹${Number(cost).toFixed(2)}` : 'N/A'}`;
      setActionSuccess(successMessage);
      fetchDashboardData();
    } catch (err: any) {
      const axiosErr = err as AxiosError<ErrorResponseData>; // Corrected Type Assertion
      setActionError(axiosErr.isAxiosError && axiosErr.response?.data?.message || `Failed to check out booking ID ${booking.bookingId}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeCancelBooking = async (bookingId: number, userName: string) => {
    if (!window.confirm(`Are you sure you want to cancel the booking for ${userName} (ID: ${bookingId})? This action cannot be undone.`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await axios.post(`/api/employee/bookings/${bookingId}/cancel-by-employee`);
      setActionSuccess(`Booking ID ${bookingId} for ${userName} has been cancelled successfully.`);
      fetchDashboardData();
    } catch (err: any) {
      const axiosErr = err as AxiosError<ErrorResponseData>; // Corrected Type Assertion
      setActionError(axiosErr.isAxiosError && axiosErr.response?.data?.message || `Failed to cancel booking ID ${bookingId}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDriveUpCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licensePlateInput.trim()) {
      setActionError('Please enter a license plate number for drive-up.');
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await axios.post(`/api/employee/checkin`, { licensePlate: licensePlateInput.toUpperCase() });
      setActionSuccess(`Vehicle ${licensePlateInput.toUpperCase()} checked in successfully as drive-up.`);
      setLicensePlateInput('');
      fetchDashboardData();
    } catch (err: any) {
      const axiosErr = err as AxiosError<ErrorResponseData>; // Corrected Type Assertion
      setActionError(axiosErr.isAxiosError && axiosErr.response?.data?.message || 'Failed to check in drive-up vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDriveUpCheckOut = async () => {
    if (!selectedVehicleId) {
      setActionError('Please select a drive-up vehicle to check out.');
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const response = await axios.post(`/api/employee/checkout`, { vehicleId: parseInt(selectedVehicleId, 10) });
      const cost = response.data.cost;
      const checkedOutVehicle = recentActivity.find(v => v.id === parseInt(selectedVehicleId, 10));
      const message = `Drive-up vehicle ${checkedOutVehicle?.licensePlate || ''} checked out. Cost: ${cost !== undefined && cost !== null ? `₹${Number(cost).toFixed(2)}` : 'N/A'}`;
      setActionSuccess(message);
      setSelectedVehicleId('');
      fetchDashboardData();
    } catch (err: any) {
      const axiosErr = err as AxiosError<ErrorResponseData>; // Corrected Type Assertion
      setActionError(axiosErr.isAxiosError && axiosErr.response?.data?.message || 'Failed to check out drive-up vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('MMM D, YY, h:mm A');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-secondary-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600"></div>
        <p className="ml-4 text-lg text-secondary-700">Loading Dashboard...</p>
      </div>
    );
  }

  if (pageError && !location) { 
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-semibold text-red-700 mb-2">Error Loading Dashboard</h2>
        <p className="text-secondary-600">{pageError}</p>
        <button
          onClick={() => fetchDashboardData(true)}
          disabled={isSubmitting}
          className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-primary-300">
          Try Again
        </button>
      </div>
    );
  }

  const todayBookings = locationBookings.filter(b =>
    (b.status === 'confirmed' || b.status === 'checked-in') &&
    dayjs(b.startTime).isSame(dayjs(), 'day')
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-secondary-900 mb-1">Employee Dashboard</h1>
      </div>

      {actionError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow-md flex items-center">
          <XSquare className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{actionError}</p>
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md shadow-md flex items-center">
          <CheckSquare className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{actionSuccess}</p>
        </div>
      )}
      {pageError && location && (
         <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md shadow-md flex items-center">
           <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{pageError}</p>
         </div>
      )}

      {location && (
        <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center mb-1">
                <MapPin className="h-7 w-7 text-primary-600 mr-2.5" />
                <h2 className="text-3xl font-semibold text-secondary-800">{location.name}</h2>
              </div>
              <p className="text-secondary-600 ml-10 text-sm">Your assigned parking location</p>
            </div>
            <div className="mt-4 md:mt-0 text-center md:text-right">
              <div className="bg-primary-50 px-5 py-3.5 rounded-lg inline-block shadow">
                <p className="text-base text-primary-700 font-medium">Physical Slots Availability</p>
                <p className="text-5xl font-bold text-primary-600">
                  {location.availableSlots}
                  <span className="text-2xl text-primary-500"> / {location.totalSlots}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="w-full bg-secondary-200 rounded-full h-5 overflow-hidden shadow-inner">
              <div
                className={`bg-gradient-to-r ${location.totalSlots > 0 && location.availableSlots / location.totalSlots >= 0.2 ? 'from-primary-500 to-primary-700' : 'from-red-500 to-red-700'} h-5 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-medium`}
                style={{ width: `${location.totalSlots > 0 ? (location.availableSlots / location.totalSlots) * 100 : 0}%` }}
              >
                {location.totalSlots > 0 ? `${(location.availableSlots / location.totalSlots * 100).toFixed(0)}% Available` : '0% Available'}
              </div>
            </div>
            <div className="flex justify-between text-xs text-secondary-500 mt-1.5">
              <span>{location.totalSlots - location.availableSlots} Physical Slots Occupied</span>
              <span>Total Physical Slots: {location.totalSlots}</span>
            </div>
          </div>
        </div>
      )}

      {location && (
        <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">
          <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
            <ListChecks className="h-7 w-7 text-blue-600 mr-2.5" />
            Today's User Bookings ({todayBookings.length})
          </h2>
          {todayBookings.length > 0 ? (
            <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-2">
              {todayBookings.map(booking => (
                <div key={booking.bookingId} className="p-4 bg-secondary-50 rounded-lg border border-secondary-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="flex-grow">
                    <p className="font-medium text-secondary-900 text-lg">{booking.userName}
                      {booking.status === 'checked-in' && <span className="ml-2 text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Checked-In</span>}
                      {booking.status === 'confirmed' && <span className="ml-2 text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">Confirmed</span>}
                    </p>
                    <p className="text-sm text-secondary-600">
                      <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
                      {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}
                    </p>
                    {booking.licensePlateBooked && <p className="text-sm text-secondary-500 mt-0.5"><Car className="inline h-4 w-4 mr-1 align-text-bottom" /> Pre-reg LP: {booking.licensePlateBooked}</p>}
                    {booking.checkedInLicensePlate && booking.status === 'checked-in' && <p className="text-sm text-green-600 mt-0.5"><Car className="inline h-4 w-4 mr-1 align-text-bottom" /> Checked-in LP: {booking.checkedInLicensePlate}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0 sm:w-auto w-full shrink-0">
                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => handleBookedUserCheckIn(booking)}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-3 py-2 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
                      >
                        <UserCheck className="h-4 w-4 mr-1.5" /> Check-In
                      </button>
                    )}
                    {booking.status === 'checked-in' && (
                      <button
                        onClick={() => handleBookedUserCheckOut(booking)}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-3 py-2 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
                      >
                        <UserMinus className="h-4 w-4 mr-1.5" /> Check-Out User
                      </button>
                    )}
                    {(booking.status === 'confirmed' || booking.status === 'checked-in') && (
                      <button
                        onClick={() => handleEmployeeCancelBooking(booking.bookingId, booking.userName)}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-3 py-2 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
                      >
                        <Ban className="h-4 w-4 mr-1.5" /> Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 px-4 bg-secondary-50 rounded-md">
              <Info className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
              <p className="text-secondary-600">No user bookings for today are currently 'confirmed' or 'checked-in'.</p>
            </div>
          )}
        </div>
      )}

      {location && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
              <LogIn className="h-7 w-7 text-green-600 mr-2.5" />
              Drive-Up Vehicle Check-In
            </h2>
            {location.availableSlots > 0 ? (
              <form onSubmit={handleDriveUpCheckIn} className="space-y-5">
                <div>
                  <label htmlFor="licensePlateInput" className="block text-sm font-medium text-secondary-700 mb-1.5">
                    License Plate Number
                  </label>
                  <input
                    type="text"
                    id="licensePlateInput"
                    value={licensePlateInput}
                    onChange={(e) => setLicensePlateInput(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-secondary-400"
                    placeholder="e.g., ABC1234"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || location.availableSlots === 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md shadow hover:shadow-md transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Car className="h-5 w-5 mr-2" /> Check In Drive-Up Vehicle
                </button>
              </form>
            ) : (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex items-center">
                  <XSquare className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-700">No drive-up parking spaces available. Drive-up check-in is disabled.</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
              <LogOut className="h-7 w-7 text-red-600 mr-2.5" />
              Drive-Up Vehicle Check-Out
            </h2>
            {parkedVehicles.length > 0 ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                    Select Parked Drive-Up Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  >
                    <option value="">-- Select Drive-Up Vehicle --</option>
                    {parkedVehicles.map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.licensePlate} (In: {formatDateTime(vehicle.entryTime)})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleDriveUpCheckOut}
                  disabled={isSubmitting || !selectedVehicleId}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-md shadow hover:shadow-md transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckSquare className="h-5 w-5 mr-2" /> Check Out Drive-Up Vehicle
                </button>
              </div>
            ) : (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
                <div className="flex items-center">
                  <Car className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-700">No pure drive-up vehicles currently parked.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {location && (
        <div className="mt-10">
          <h2 className="text-2xl font-semibold text-secondary-800 mb-6">Recent Vehicle Activity at {location.name}</h2>
          {recentActivity.length > 0 ? (
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-secondary-200">
                  <thead className="bg-secondary-100">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Type</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">License Plate</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Check-In</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Check-Out</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Cost</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-secondary-200">
                    {recentActivity.map((vehicle) => (
                      <tr key={`session-${vehicle.id}`} className="hover:bg-secondary-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {vehicle.bookingId ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Booking</span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">Drive-Up</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Car className="h-5 w-5 text-primary-600 mr-3 flex-shrink-0" />
                            <span className="font-medium text-secondary-900">{vehicle.licensePlate}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">{formatDateTime(vehicle.entryTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">{formatDateTime(vehicle.exitTime)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                          {vehicle.cost !== null && vehicle.cost !== undefined ? `₹${Number(vehicle.cost).toFixed(2)}` : (vehicle.exitTime ? 'N/A' : '–')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {vehicle.exitTime ? (
                            <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-secondary-100 text-secondary-800 shadow-sm">Departed</span>
                          ) : (
                            <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 shadow-sm">Parked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            !loading && <div className="mt-6 text-center text-secondary-500 py-8 bg-white rounded-xl shadow-xl"><Info className="inline h-5 w-5 mr-2 align-text-bottom" />No vehicle activity to display for this location.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;

// // src/pages/employee/EmployeeDashboard.tsx
// import React, { useState, useEffect, useCallback } from 'react';
// import axios from 'axios';
// import dayjs from 'dayjs';
// import { Car, LogIn, LogOut, MapPin, Clock, CheckSquare, XSquare, UserCheck, ListChecks, AlertTriangle, Info, Ban, UserMinus } from 'lucide-react';

// type LocationDetails = {
//   id: number;
//   name: string;
//   totalSlots: number;
//   availableSlots: number;
// };

// type VehicleSession = { // Represents entries from vehicle_sessions table
//   id: number;
//   licensePlate: string;
//   entryTime: string;
//   exitTime?: string | null;
//   cost?: number | null;
//   bookingId?: number | null; // Will be non-null if this session originated from a booking
// };

// type LocationBooking = { // Represents entries from bookings table
//   bookingId: number;
//   userId: number;
//   userName: string;
//   startTime: string;
//   endTime: string;
//   status: string;
//   licensePlateBooked?: string | null;
//   checkedInLicensePlate?: string | null;
// };

// const EmployeeDashboard: React.FC = () => {
//   const [location, setLocation] = useState<LocationDetails | null>(null);
//   // parkedVehicles is used for the "Drive-Up Vehicle Check-Out" dropdown.
//   // It will be filtered to show ONLY pure drive-ups (bookingId is null).
//   const [parkedVehicles, setParkedVehicles] = useState<VehicleSession[]>([]);
//   // recentActivity can show all vehicle_sessions (drive-ups and booking-related).
//   const [recentActivity, setRecentActivity] = useState<VehicleSession[]>([]);
//   const [locationBookings, setLocationBookings] = useState<LocationBooking[]>([]);

//   const [loading, setLoading] = useState(true);
//   const [pageError, setPageError] = useState<string | null>(null);
//   const [actionError, setActionError] = useState<string | null>(null);
//   const [actionSuccess, setActionSuccess] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [licensePlateInput, setLicensePlateInput] = useState('');
//   const [selectedVehicleId, setSelectedVehicleId] = useState<string>(''); // For drive-up checkout dropdown
//   const [hourlyRate, setHourlyRate] = useState<number>(0); // For display purposes, actual cost from backend

//   const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
//     if (isInitialLoad) {
//       setLoading(true);
//       setPageError(null);
//     }
//     setActionError(null);
//     setActionSuccess(null);

//     try {
//       const [locationRes, allVehicleSessionsRes, rateRes, locationBookingsRes] = await Promise.allSettled([
//         axios.get('/api/employee/location'),
//         axios.get('/api/employee/vehicles'), // Fetches ALL vehicle_sessions
//         axios.get('/api/settings/rate'),    // This API endpoint needs to exist on backend
//         axios.get('/api/employee/location-bookings')
//       ]);

//       if (locationRes.status === 'fulfilled') {
//         const fetchedLocation: LocationDetails = {
//           id: locationRes.value.data.id,
//           name: locationRes.value.data.name,
//           totalSlots: locationRes.value.data.totalSlots || locationRes.value.data.total_slots,
//           availableSlots: locationRes.value.data.availableSlots || locationRes.value.data.available_slots,
//         };
//         setLocation(fetchedLocation);
//       } else {
//         throw locationRes.reason;
//       }

//       if (allVehicleSessionsRes.status === 'fulfilled') {
//         const fetchedSessions: VehicleSession[] = (allVehicleSessionsRes.value.data || []).map((v: any) => ({
//           id: v.id,
//           licensePlate: v.licensePlate || v.license_plate,
//           entryTime: v.entryTime || v.entry_time,
//           exitTime: v.exitTime || v.exit_time,
//           cost: v.cost,
//           bookingId: v.bookingId || v.booking_id
//         }));

//         console.log("ALL FETCHED SESSIONS (Raw data from /api/employee/vehicles):", JSON.stringify(fetchedSessions, null, 2));
//         // Recent activity shows all sessions
//         setRecentActivity(fetchedSessions.sort((a, b) => dayjs(b.entryTime).valueOf() - dayjs(a.entryTime).valueOf()));
//         // Parked vehicles for the dropdown list: active sessions that are PURE drive-ups (bookingId is null)
//         setParkedVehicles(fetchedSessions.filter(v => !v.exitTime && v.bookingId === null));
//       } else {
//         console.error("Failed to fetch vehicle sessions:", allVehicleSessionsRes.reason);
//         setRecentActivity([]);
//         setParkedVehicles([]);
//       }

//       if (rateRes.status === 'fulfilled' && rateRes.value.data) {
//         // Successfully fetched rate and data exists
//         setHourlyRate(rateRes.value.data.hourlyRate || rateRes.value.data.hourly_rate || 0);
//       } else {
//         // This 'else' block is entered if:
//         // 1. rateRes.status is 'rejected' (e.g., API call failed with 404)
//         // OR
//         // 2. rateRes.status is 'fulfilled' BUT rateRes.value.data is falsy

//         if (rateRes.status === 'rejected') {
//           // Case 1: The promise for fetching the rate was rejected
//           console.warn(
//             "Failed to fetch hourly rate from /api/settings/rate (request rejected). Ensure endpoint exists on backend.",
//             rateRes.reason // Now TypeScript knows rateRes is PromiseRejectedResult, so .reason is safe
//           );
//         } else {
//           // Case 2: The promise was fulfilled, but rateRes.value.data was falsy (e.g., null, undefined, empty response)
//           // TypeScript knows rateRes here is PromiseFulfilledResult
//           console.warn(
//             "Fetched hourly rate from /api/settings/rate, but no data was returned or data was invalid.",
//             "Received value:", rateRes.value // Log the actual value for debugging
//           );
//         }
//         // In either failure case, hourlyRate remains 0 or its previous value.
//         // Cost calculations rely on the backend, so this primarily affects optional display.
//         // You could explicitly set setHourlyRate(0) here if desired on any failure.
//       }

//       if (locationBookingsRes.status === 'fulfilled') {
//         const fetchedLocationBookings: LocationBooking[] = (locationBookingsRes.value.data || []).map((b: any) => ({
//           bookingId: b.bookingId,
//           userId: b.userId,
//           userName: b.userName || b.user_name || `User ID: ${b.userId}`,
//           startTime: b.startTime || b.start_time,
//           endTime: b.endTime || b.end_time,
//           status: b.status,
//           licensePlateBooked: b.licensePlateBooked || b.license_plate_booked,
//           checkedInLicensePlate: b.checkedInLicensePlate || b.checked_in_license_plate,
//         }));
//         setLocationBookings(fetchedLocationBookings.sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()));
//       } else {
//         console.error("Failed to fetch location bookings:", locationBookingsRes.reason);
//         setLocationBookings([]);
//       }

//       if (isInitialLoad && locationRes.status === 'fulfilled') setPageError(null);

//     } catch (err: any) {
//       console.error('Error fetching critical dashboard data:', err);
//       const errorMessage = err.response?.data?.message || 'Failed to load essential dashboard data. Please contact support.';
//       if (isInitialLoad) setPageError(errorMessage); else setActionError(errorMessage);

//       if (err.response?.config?.url?.includes('/api/employee/location') && (err.response?.status === 403 || err.response?.status === 404)) {
//         setLocation(null);
//         setPageError(err.response?.data?.message || "No parking location assigned or location not found. Please contact administrator.")
//       }
//     } finally {
//       if (isInitialLoad) setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchDashboardData(true);
//   }, [fetchDashboardData]);

//   const handleBookedUserCheckIn = async (booking: LocationBooking) => {
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
 
//     let licensePlateForCheckIn = booking.checkedInLicensePlate || booking.licensePlateBooked || '';
    
//     if (!licensePlateForCheckIn.trim()) {
//       const userInput = window.prompt(`Enter vehicle license plate for ${booking.userName}'s booking (ID ${booking.bookingId}):`);
      
//       if (userInput === null) {
//         setIsSubmitting(false);
//         return;
//       }
//       licensePlateForCheckIn = userInput.trim();
      
//       if (!licensePlateForCheckIn) {
//         setActionError("License plate is required for checking in a booking.");
//         setIsSubmitting(false);
//         return;
//       }
//     }
 
//     try {
//       // Backend now creates a vehicle_session and updates booking to 'checked-in'
//       // It also decrements available_slots.
//       const response = await axios.post(`/api/employee/bookings/${booking.bookingId}/checkin`, {
//         licensePlate: licensePlateForCheckIn.toUpperCase()
//       });
            
//       setActionSuccess(`Booking ID ${booking.bookingId} (LP: ${licensePlateForCheckIn.toUpperCase()}) checked in. ${response.data.message || ''}`);
//       fetchDashboardData(); // Crucial to refresh all data from backend
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || `Failed to check in booking ID ${booking.bookingId}.`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };
  
//   const handleBookedUserCheckOut = async (booking: LocationBooking) => {
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       // This dedicated route finds the booking's vehicle_session and checks it out
//       const response = await axios.post(`/api/employee/bookings/${booking.bookingId}/checkout`);
//       const cost = response.data.cost;
//       const lp = booking.checkedInLicensePlate || booking.licensePlateBooked || 'N/A';
      
//       const successMessage = `Booking ID ${booking.bookingId} (LP: ${lp}) checked out. Cost: ${cost !== undefined && cost !== null ? `₹${Number(cost).toFixed(2)}` : 'N/A'}`;
//       setActionSuccess(successMessage);
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || `Failed to check out booking ID ${booking.bookingId}.`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleEmployeeCancelBooking = async (bookingId: number, userName: string) => {
//     if (!window.confirm(`Are you sure you want to cancel the booking for ${userName} (ID: ${bookingId})? This action cannot be undone.`)) {
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       await axios.post(`/api/employee/bookings/${bookingId}/cancel-by-employee`);
//       setActionSuccess(`Booking ID ${bookingId} for ${userName} has been cancelled successfully.`);
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || `Failed to cancel booking ID ${bookingId}.`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDriveUpCheckIn = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!licensePlateInput.trim()) {
//       setActionError('Please enter a license plate number for drive-up.');
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       await axios.post(`/api/employee/checkin`, { licensePlate: licensePlateInput.toUpperCase() });
//       setActionSuccess(`Vehicle ${licensePlateInput.toUpperCase()} checked in successfully as drive-up.`);
//       setLicensePlateInput('');
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || 'Failed to check in drive-up vehicle.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDriveUpCheckOut = async () => { // This is for PURE drive-ups from the dropdown
//     if (!selectedVehicleId) {
//       setActionError('Please select a drive-up vehicle to check out.');
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       const response = await axios.post(`/api/employee/checkout`, { vehicleId: parseInt(selectedVehicleId, 10) });
//       const cost = response.data.cost;
//       // Find the vehicle from recentActivity to display its license plate
//       const checkedOutVehicle = recentActivity.find(v => v.id === parseInt(selectedVehicleId, 10));
//       const message = `Drive-up vehicle ${checkedOutVehicle?.licensePlate || ''} checked out. Cost: ${cost !== undefined && cost !== null ? `₹${Number(cost).toFixed(2)}` : 'N/A'}`;
//       setActionSuccess(message);
//       setSelectedVehicleId('');
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || 'Failed to check out drive-up vehicle.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formatDateTime = (dateString: string | null | undefined) => {
//     if (!dateString) return 'N/A';
//     return dayjs(dateString).format('MMM D, YY, h:mm A');
//   };

//   if (loading) {
//     return (
//       <div className="flex justify-center items-center h-screen bg-secondary-50">
//         <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600"></div>
//         <p className="ml-4 text-lg text-secondary-700">Loading Dashboard...</p>
//       </div>
//     );
//   }

//   if (pageError && !location) {
//     return (
//       <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
//         <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
//         <h2 className="text-2xl font-semibold text-red-700 mb-2">Error Loading Dashboard</h2>
//         <p className="text-secondary-600">{pageError}</p>
//         <button
//           onClick={() => fetchDashboardData(true)}
//           disabled={isSubmitting}
//           className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-primary-300">
//           Try Again
//         </button>
//       </div>
//     );
//   }

//   // Filter for bookings to display in "Today's User Bookings"
//   // Shows bookings that are 'confirmed' or 'checked-in' and relevant for today.
//   const todayBookings = locationBookings.filter(b =>
//     (b.status === 'confirmed' || b.status === 'checked-in') &&
//     dayjs(b.startTime).isSame(dayjs(), 'day') // Simple filter for today's start, adjust if needed
//   );

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       <div className="mb-8">
//         <h1 className="text-4xl font-bold text-secondary-900 mb-1">Employee Dashboard</h1>
//       </div>

//       {actionError && (
//         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow-md flex items-center">
//           <XSquare className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{actionError}</p>
//         </div>
//       )}
//       {actionSuccess && (
//         <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md shadow-md flex items-center">
//           <CheckSquare className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{actionSuccess}</p>
//         </div>
//       )}

//       {location && (
//         <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">
//           <div className="flex flex-col md:flex-row md:items-center md:justify-between">
//             <div>
//               <div className="flex items-center mb-1">
//                 <MapPin className="h-7 w-7 text-primary-600 mr-2.5" />
//                 <h2 className="text-3xl font-semibold text-secondary-800">{location.name}</h2>
//               </div>
//               <p className="text-secondary-600 ml-10 text-sm">Your assigned parking location</p>
//             </div>
//             <div className="mt-4 md:mt-0 text-center md:text-right">
//               <div className="bg-primary-50 px-5 py-3.5 rounded-lg inline-block shadow">
//                 <p className="text-base text-primary-700 font-medium">Physical Slots Availability</p>
//                 <p className="text-5xl font-bold text-primary-600">
//                   {location.availableSlots}
//                   <span className="text-2xl text-primary-500"> / {location.totalSlots}</span>
//                 </p>
//               </div>
//             </div>
//           </div>
//           <div className="mt-5">
//             <div className="w-full bg-secondary-200 rounded-full h-5 overflow-hidden shadow-inner">
//               <div
//                 className={`bg-gradient-to-r ${location.totalSlots > 0 && location.availableSlots / location.totalSlots >= 0.2 ? 'from-primary-500 to-primary-700' : 'from-red-500 to-red-700'} h-5 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-medium`}
//                 style={{ width: `${location.totalSlots > 0 ? (location.availableSlots / location.totalSlots) * 100 : 0}%` }}
//               >
//                 {location.totalSlots > 0 ? `${(location.availableSlots / location.totalSlots * 100).toFixed(0)}% Available` : '0% Available'}
//               </div>
//             </div>
//             <div className="flex justify-between text-xs text-secondary-500 mt-1.5">
//               <span>{location.totalSlots - location.availableSlots} Physical Slots Occupied</span>
//               <span>Total Physical Slots: {location.totalSlots}</span>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* User Bookings Check-In & Check-Out & Cancellation Section */}
//       {location && (
//         <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">
//           <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
//             <ListChecks className="h-7 w-7 text-blue-600 mr-2.5" />
//             Today's User Bookings ({todayBookings.length})
//           </h2>
//           {todayBookings.length > 0 ? (
//             <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-2">
//               {todayBookings.map(booking => (
//                 <div key={booking.bookingId} className="p-4 bg-secondary-50 rounded-lg border border-secondary-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-shadow">
//                   <div className="flex-grow">
//                     <p className="font-medium text-secondary-900 text-lg">{booking.userName}
//                       {booking.status === 'checked-in' && <span className="ml-2 text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Checked-In</span>}
//                       {booking.status === 'confirmed' && <span className="ml-2 text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">Confirmed</span>}
//                     </p>
//                     <p className="text-sm text-secondary-600">
//                       <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
//                       {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}
//                     </p>
//                     {booking.licensePlateBooked && <p className="text-sm text-secondary-500 mt-0.5"><Car className="inline h-4 w-4 mr-1 align-text-bottom" /> Pre-reg LP: {booking.licensePlateBooked}</p>}
//                     {booking.checkedInLicensePlate && booking.status === 'checked-in' && <p className="text-sm text-green-600 mt-0.5"><Car className="inline h-4 w-4 mr-1 align-text-bottom" /> Checked-in LP: {booking.checkedInLicensePlate}</p>}
//                   </div>
//                   <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0 sm:w-auto w-full shrink-0">
//                     {booking.status === 'confirmed' && (
//                       <button
//                         onClick={() => handleBookedUserCheckIn(booking)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto px-3 py-2 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
//                       >
//                         <UserCheck className="h-4 w-4 mr-1.5" /> Check-In
//                       </button>
//                     )}
//                     {booking.status === 'checked-in' && (
//                       <button
//                         onClick={() => handleBookedUserCheckOut(booking)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto px-3 py-2 text-xs bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
//                       >
//                         <UserMinus className="h-4 w-4 mr-1.5" /> Check-Out User
//                       </button>
//                     )}
//                     {(booking.status === 'confirmed' || booking.status === 'checked-in') && (
//                       <button
//                         onClick={() => handleEmployeeCancelBooking(booking.bookingId, booking.userName)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto px-3 py-2 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
//                       >
//                         <Ban className="h-4 w-4 mr-1.5" /> Cancel Booking
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="text-center py-6 px-4 bg-secondary-50 rounded-md">
//               <Info className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
//               <p className="text-secondary-600">No user bookings for today are currently 'confirmed' or 'checked-in'.</p>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Drive-up Check-in/Check-out Forms */}
//       {location && (
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
//           <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
//             <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
//               <LogIn className="h-7 w-7 text-green-600 mr-2.5" />
//               Drive-Up Vehicle Check-In
//             </h2>
//             {location.availableSlots > 0 ? (
//               <form onSubmit={handleDriveUpCheckIn} className="space-y-5">
//                 <div>
//                   <label htmlFor="licensePlateInput" className="block text-sm font-medium text-secondary-700 mb-1.5">
//                     License Plate Number
//                   </label>
//                   <input
//                     type="text"
//                     id="licensePlateInput"
//                     value={licensePlateInput}
//                     onChange={(e) => setLicensePlateInput(e.target.value.toUpperCase())}
//                     className="w-full px-4 py-2.5 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-secondary-400"
//                     placeholder="e.g., ABC1234"
//                     required
//                     disabled={isSubmitting}
//                   />
//                 </div>
//                 <button
//                   type="submit"
//                   disabled={isSubmitting || location.availableSlots === 0}
//                   className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md shadow hover:shadow-md transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
//                 >
//                   <Car className="h-5 w-5 mr-2" /> Check In Drive-Up Vehicle
//                 </button>
//               </form>
//             ) : (
//               <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
//                 <div className="flex items-center">
//                   <XSquare className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
//                   <p className="text-sm text-red-700">No drive-up parking spaces available. Drive-up check-in is disabled.</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
//             <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
//               <LogOut className="h-7 w-7 text-red-600 mr-2.5" />
//               Drive-Up Vehicle Check-Out
//             </h2>
//             {/* parkedVehicles now only contains pure drive-ups due to frontend filter */}
//             {parkedVehicles.length > 0 ? (
//               <div className="space-y-5">
//                 <div>
//                   <label className="block text-sm font-medium text-secondary-700 mb-1.5">
//                     Select Parked Drive-Up Vehicle
//                   </label>
//                   <select
//                     value={selectedVehicleId}
//                     onChange={(e) => setSelectedVehicleId(e.target.value)}
//                     disabled={isSubmitting}
//                     className="w-full px-4 py-2.5 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
//                   >
//                     <option value="">-- Select Drive-Up Vehicle --</option>
//                     {parkedVehicles.map(vehicle => ( // This list is now filtered to pure drive-ups
//                       <option key={vehicle.id} value={vehicle.id}>
//                         {vehicle.licensePlate} (In: {formatDateTime(vehicle.entryTime)})
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <button
//                   onClick={handleDriveUpCheckOut}
//                   disabled={isSubmitting || !selectedVehicleId}
//                   className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-md shadow hover:shadow-md transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
//                 >
//                   <CheckSquare className="h-5 w-5 mr-2" /> Check Out Drive-Up Vehicle
//                 </button>
//               </div>
//             ) : (
//               <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
//                 <div className="flex items-center">
//                   <Car className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
//                   <p className="text-sm text-blue-700">No pure drive-up vehicles currently parked.</p>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Recent Drive-Up Activity Table */}
//       {location && (
//         <div className="mt-10">
//           <h2 className="text-2xl font-semibold text-secondary-800 mb-6">Recent Vehicle Activity at {location.name}</h2>
//           {/* recentActivity now includes both drive-ups and booking-related sessions */}
//           {recentActivity.length > 0 ? (
//             <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
//               <div className="overflow-x-auto">
//                 <table className="min-w-full divide-y divide-secondary-200">
//                   <thead className="bg-secondary-100">
//                     <tr>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Type</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">License Plate</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Check-In</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Check-Out</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Cost</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Status</th>
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white divide-y divide-secondary-200">
//                     {recentActivity.map((vehicle) => (
//                       <tr key={`session-${vehicle.id}`} className="hover:bg-secondary-50 transition-colors"> {/* Ensure unique key */}
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           {vehicle.bookingId ? (
//                             <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Booking</span>
//                           ) : (
//                             <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">Drive-Up</span>
//                           )}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="flex items-center">
//                             <Car className="h-5 w-5 text-primary-600 mr-3 flex-shrink-0" />
//                             <span className="font-medium text-secondary-900">{vehicle.licensePlate}</span>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">{formatDateTime(vehicle.entryTime)}</td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">{formatDateTime(vehicle.exitTime)}</td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
//                           {/* Display cost from session if available, rely on backend calculation */}
//                           {vehicle.cost !== null && vehicle.cost !== undefined ? `₹${Number(vehicle.cost).toFixed(2)}` : (vehicle.exitTime ? 'N/A' : '–')}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           {vehicle.exitTime ? (
//                             <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-secondary-100 text-secondary-800 shadow-sm">Departed</span>
//                           ) : (
//                             <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 shadow-sm">Parked</span>
//                           )}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           ) : (
//             !loading && <div className="mt-6 text-center text-secondary-500 py-8 bg-white rounded-xl shadow-xl"><Info className="inline h-5 w-5 mr-2 align-text-bottom" />No vehicle activity to display for this location.</div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default EmployeeDashboard;




// // src/pages/employee/EmployeeDashboard.tsx
// import React, { useState, useEffect, useCallback } from 'react';
// import axios from 'axios';
// import dayjs from 'dayjs';
// import { Car, LogIn, LogOut, MapPin, Clock, CheckSquare, XSquare, UserCheck, ListChecks, AlertTriangle, Info, Ban } from 'lucide-react';
// // If you plan to use toast notifications:
// // import { toast } from 'react-toastify';
// // import 'react-toastify/dist/ReactToastify.css';

// type LocationDetails = {
//   id: number;
//   name: string;
//   totalSlots: number;
//   availableSlots: number; // Physical slots available for drive-up
// };

// type VehicleSession = {
//   id: number;
//   licensePlate: string;
//   entryTime: string;
//   exitTime?: string | null;
//   cost?: number | null;
//   bookingId?: number | null; // Link to booking if it was a booked check-in
// };

// type LocationBooking = {
//   bookingId: number;
//   userId: number;
//   userName: string;
//   startTime: string;
//   endTime: string;
//   status: string; // e.g., 'confirmed', 'checked-in', 'completed', 'cancelled'
//   licensePlateBooked?: string | null;
//   checkedInLicensePlate?: string | null;
// };

// const EmployeeDashboard: React.FC = () => {
//   const [location, setLocation] = useState<LocationDetails | null>(null);
//   const [parkedVehicles, setParkedVehicles] = useState<VehicleSession[]>([]);
//   const [recentActivity, setRecentActivity] = useState<VehicleSession[]>([]);
//   const [locationBookings, setLocationBookings] = useState<LocationBooking[]>([]);

//   const [loading, setLoading] = useState(true);
//   const [pageError, setPageError] = useState<string | null>(null);
//   const [actionError, setActionError] = useState<string | null>(null);
//   const [actionSuccess, setActionSuccess] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const [licensePlateInput, setLicensePlateInput] = useState('');
//   const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
//   const [hourlyRate, setHourlyRate] = useState<number>(0);

//   const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
//     if (isInitialLoad) {
//       setLoading(true);
//       setPageError(null);
//     }
//     setActionError(null);
//     setActionSuccess(null);

//     try {
//       const [locationRes, driveUpVehiclesRes, rateRes, locationBookingsRes] = await Promise.allSettled([
//         axios.get('/api/employee/location'),
//         axios.get('/api/employee/vehicles'),
//         axios.get('/api/settings/rate'),
//         axios.get('/api/employee/location-bookings')
//       ]);

//       if (locationRes.status === 'fulfilled') {
//         const fetchedLocation: LocationDetails = {
//           id: locationRes.value.data.id,
//           name: locationRes.value.data.name,
//           totalSlots: locationRes.value.data.totalSlots || locationRes.value.data.total_slots,
//           availableSlots: locationRes.value.data.availableSlots || locationRes.value.data.available_slots,
//         };
//         setLocation(fetchedLocation);
//       } else {
//         throw locationRes.reason; // Throw if critical location data fails
//       }

//       if (driveUpVehiclesRes.status === 'fulfilled') {
//         const fetchedDriveUpVehicles: VehicleSession[] = (driveUpVehiclesRes.value.data || []).map((v: any) => ({
//           id: v.id,
//           licensePlate: v.licensePlate || v.license_plate,
//           entryTime: v.entryTime || v.entry_time,
//           exitTime: v.exitTime || v.exit_time,
//           cost: v.cost,
//           bookingId: v.bookingId || v.booking_id
//         }));
//         setRecentActivity(fetchedDriveUpVehicles.sort((a, b) => dayjs(b.entryTime).valueOf() - dayjs(a.entryTime).valueOf()));
//         setParkedVehicles(fetchedDriveUpVehicles.filter(v => !v.exitTime));
//       } else {
//         console.error("Failed to fetch drive-up vehicles:", driveUpVehiclesRes.reason);
//         // Not setting pageError here, dashboard can partially function
//       }

//       if (rateRes.status === 'fulfilled') {
//         setHourlyRate(rateRes.value.data.hourlyRate || rateRes.value.data.hourly_rate || 0);
//       } else {
//         console.error("Failed to fetch hourly rate:", rateRes.reason);
//       }

//       if (locationBookingsRes.status === 'fulfilled') {
//         const fetchedLocationBookings: LocationBooking[] = (locationBookingsRes.value.data || []).map((b: any) => ({
//           bookingId: b.bookingId,
//           userId: b.userId,
//           userName: b.userName || b.user_name || `User ID: ${b.userId}`,
//           startTime: b.startTime || b.start_time,
//           endTime: b.endTime || b.end_time,
//           status: b.status,
//           licensePlateBooked: b.licensePlateBooked || b.license_plate_booked,
//           checkedInLicensePlate: b.checkedInLicensePlate || b.checked_in_license_plate,
//         }));
//         setLocationBookings(fetchedLocationBookings.sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()));
//       } else {
//         console.error("Failed to fetch location bookings:", locationBookingsRes.reason);
//       }

//       if (isInitialLoad && locationRes.status === 'fulfilled') setPageError(null);

//     } catch (err: any) {
//       console.error('Error fetching critical dashboard data:', err);
//       const errorMessage = err.response?.data?.message || 'Failed to load essential dashboard data. Please contact support.';
//       if (isInitialLoad) setPageError(errorMessage); else setActionError(errorMessage);

//       if (err.response?.config?.url?.includes('/api/employee/location') && (err.response?.status === 403 || err.response?.status === 404)) {
//         setLocation(null);
//         setPageError(err.response?.data?.message || "No parking location assigned or location not found. Please contact administrator.")
//       }
//     } finally {
//       if (isInitialLoad) setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchDashboardData(true);
//   }, [fetchDashboardData]);


//   const handleBookedUserCheckIn = async (booking: LocationBooking) => {
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
  
//     // Initialize with empty string if both values are null/undefined
//     let licensePlateForCheckIn = booking.checkedInLicensePlate || booking.licensePlateBooked || '';
    
//     // If we still don't have a license plate, prompt the user
//     if (!licensePlateForCheckIn) {
//       const userInput = window.prompt(`Enter vehicle license plate for ${booking.userName}'s booking (ID ${booking.bookingId}):`);
      
//       // If user cancels the prompt
//       if (userInput === null) {
//         setIsSubmitting(false);
//         return;
//       }
      
//       // Use the user input (which could be empty string)
//       licensePlateForCheckIn = userInput.trim();
      
//       if (!licensePlateForCheckIn) {
//         setActionError("License plate is required for checking in a booking.");
//         setIsSubmitting(false);
//         return;
//       }
//     }
  
//     try {
//       await axios.post(`/api/employee/bookings/${booking.bookingId}/checkin`, {
//         licensePlate: licensePlateForCheckIn.toUpperCase()
//       });
//       setActionSuccess(`Booking ID ${booking.bookingId} (User: ${booking.userName}, LP: ${licensePlateForCheckIn.toUpperCase()}) checked in successfully.`);
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || `Failed to check in booking ID ${booking.bookingId}.`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleEmployeeCancelBooking = async (bookingId: number, userName: string) => {
//     if (!window.confirm(`Are you sure you want to cancel the booking for ${userName} (ID: ${bookingId})? This action cannot be undone.`)) {
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       await axios.post(`/api/employee/bookings/${bookingId}/cancel-by-employee`);
//       setActionSuccess(`Booking ID ${bookingId} for ${userName} has been cancelled successfully.`);
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || `Failed to cancel booking ID ${bookingId}.`);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDriveUpCheckIn = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!licensePlateInput.trim()) {
//       setActionError('Please enter a license plate number for drive-up.');
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       await axios.post(`/api/employee/checkin`, { licensePlate: licensePlateInput.toUpperCase() });
//       setActionSuccess(`Vehicle ${licensePlateInput.toUpperCase()} checked in successfully.`);
//       setLicensePlateInput('');
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || 'Failed to check in vehicle. No available slots or other error.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDriveUpCheckOut = async () => {
//     if (!selectedVehicleId) {
//       setActionError('Please select a vehicle to check out.');
//       return;
//     }
//     setActionError(null);
//     setActionSuccess(null);
//     setIsSubmitting(true);
//     try {
//       const response = await axios.post(`/api/employee/checkout`, { vehicleId: parseInt(selectedVehicleId, 10) });
//       const cost = response.data.cost;
//       const checkedOutVehicle = recentActivity.find(v => v.id === parseInt(selectedVehicleId, 10));
//       const message = `Vehicle ${checkedOutVehicle?.licensePlate || ''} checked out. Cost: ${hourlyRate > 0 && cost !== undefined ? `₹${Number(cost).toFixed(2)}` : 'N/A'}`;
//       setActionSuccess(message);
//       setSelectedVehicleId('');
//       fetchDashboardData();
//     } catch (err: any) {
//       setActionError(err.response?.data?.message || 'Failed to check out vehicle.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formatDateTime = (dateString: string | null | undefined) => {
//     if (!dateString) return 'N/A';
//     return dayjs(dateString).format('MMM D, YY, h:mm A');
//   };

//   if (loading) {
//     return (
//       <div className="flex justify-center items-center h-screen bg-secondary-50">
//         <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-600"></div>
//         <p className="ml-4 text-lg text-secondary-700">Loading Dashboard...</p>
//       </div>
//     );
//   }

//   if (pageError && !location) {
//     return (
//       <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
//         <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
//         <h2 className="text-2xl font-semibold text-red-700 mb-2">Error Loading Dashboard</h2>
//         <p className="text-secondary-600">{pageError}</p>
//         <button
//           onClick={() => fetchDashboardData(true)}
//           disabled={isSubmitting}
//           className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-primary-300">
//           Try Again
//         </button>
//       </div>
//     );
//   }

//   const todayBookings = locationBookings.filter(b =>
//     (b.status === 'confirmed' || b.status === 'checked-in') &&
//     dayjs(b.startTime).isSame(dayjs(), 'day')
//   );

//   return (
//     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//       <div className="mb-8">
//         <h1 className="text-4xl font-bold text-secondary-900 mb-1">Employee Dashboard</h1>
//       </div>

//       {actionError && (
//         <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md shadow-md flex items-center">
//           <XSquare className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{actionError}</p>
//         </div>
//       )}
//       {actionSuccess && (
//         <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md shadow-md flex items-center">
//           <CheckSquare className="h-5 w-5 mr-3 flex-shrink-0" /> <p>{actionSuccess}</p>
//         </div>
//       )}

//       {location && (
//         <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">
//           <div className="flex flex-col md:flex-row md:items-center md:justify-between">
//             <div>
//               <div className="flex items-center mb-1">
//                 <MapPin className="h-7 w-7 text-primary-600 mr-2.5" />
//                 <h2 className="text-3xl font-semibold text-secondary-800">{location.name}</h2>
//               </div>
//               <p className="text-secondary-600 ml-10 text-sm">Your assigned parking location</p>
//             </div>
//             <div className="mt-4 md:mt-0 text-center md:text-right">
//               <div className="bg-primary-50 px-5 py-3.5 rounded-lg inline-block shadow">
//                 <p className="text-base text-primary-700 font-medium">Drive-Up Availability</p>
//                 <p className="text-5xl font-bold text-primary-600">
//                   {location.availableSlots}
//                   <span className="text-2xl text-primary-500"> / {location.totalSlots}</span>
//                 </p>
//               </div>
//             </div>
//           </div>
//           <div className="mt-5">
//             <div className="w-full bg-secondary-200 rounded-full h-5 overflow-hidden shadow-inner">
//               <div
//                 className={`bg-gradient-to-r ${location.availableSlots / location.totalSlots >= 0.2 ? 'from-primary-500 to-primary-700' : 'from-red-500 to-red-700'} h-5 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-white text-xs font-medium`}
//                 style={{ width: `${location.totalSlots > 0 ? ((location.totalSlots - (location.totalSlots - location.availableSlots)) / location.totalSlots) * 100 : 0}%` }}
//               >
//                 {location.totalSlots > 0 ? `${(((location.totalSlots - (location.totalSlots - location.availableSlots)) / location.totalSlots) * 100).toFixed(0)}% Available for Drive-up` : '0% Available'}
//               </div>
//             </div>
//             <div className="flex justify-between text-xs text-secondary-500 mt-1.5">
//               <span>{location.totalSlots - location.availableSlots} Drive-ups Currently Parked</span>
//               <span>Total Physical Slots: {location.totalSlots}</span>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* User Bookings Check-In & Cancellation Section */}
//       {location && (
//         <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">
//           <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
//             <ListChecks className="h-7 w-7 text-blue-600 mr-2.5" />
//             Today's User Bookings ({todayBookings.length})
//           </h2>
//           {todayBookings.length > 0 ? (
//             <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-2">
//               {todayBookings.map(booking => (
//                 <div key={booking.bookingId} className="p-4 bg-secondary-50 rounded-lg border border-secondary-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-shadow">
//                   <div className="flex-grow">
//                     <p className="font-medium text-secondary-900 text-lg">{booking.userName}
//                       {booking.status === 'checked-in' && <span className="ml-2 text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full">Checked-In</span>}
//                       {booking.status === 'cancelled' && <span className="ml-2 text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded-full">Cancelled</span>}
//                     </p>
//                     <p className="text-sm text-secondary-600">
//                       <Clock className="inline h-4 w-4 mr-1 align-text-bottom" />
//                       {formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}
//                     </p>
//                     {booking.licensePlateBooked && <p className="text-sm text-secondary-500 mt-0.5"><Car className="inline h-4 w-4 mr-1 align-text-bottom" /> Pre-registered LP: {booking.licensePlateBooked}</p>}
//                     {booking.checkedInLicensePlate && booking.status === 'checked-in' && <p className="text-sm text-green-600 mt-0.5"><Car className="inline h-4 w-4 mr-1 align-text-bottom" /> Checked-in LP: {booking.checkedInLicensePlate}</p>}
//                   </div>
//                   <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0 sm:w-auto w-full shrink-0">
//                     {booking.status === 'confirmed' && (
//                       <button
//                         onClick={() => handleBookedUserCheckIn(booking)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto px-3 py-2 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
//                       >
//                         <UserCheck className="h-4 w-4 mr-1.5" /> Check-In User
//                       </button>
//                     )}
//                     {(booking.status === 'confirmed' || booking.status === 'checked-in') && ( // Allow cancellation if confirmed or even if checked-in (admin override)
//                       <button
//                         onClick={() => handleEmployeeCancelBooking(booking.bookingId, booking.userName)}
//                         disabled={isSubmitting}
//                         className="w-full sm:w-auto px-3 py-2 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md transition-all"
//                       >
//                         <Ban className="h-4 w-4 mr-1.5" /> Cancel Booking
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="text-center py-6 px-4 bg-secondary-50 rounded-md">
//               <Info className="h-8 w-8 text-secondary-400 mx-auto mb-2" />
//               <p className="text-secondary-600">No user bookings scheduled for check-in today at this location.</p>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Drive-up Check-in/Check-out Forms */}
//       {location && (
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
//           <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
//             <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
//               <LogIn className="h-7 w-7 text-green-600 mr-2.5" />
//               Drive-Up Vehicle Check-In
//             </h2>
//             {location.availableSlots > 0 ? (
//               <form onSubmit={handleDriveUpCheckIn} className="space-y-5">
//                 <div>
//                   <label htmlFor="licensePlateInput" className="block text-sm font-medium text-secondary-700 mb-1.5">
//                     License Plate Number
//                   </label>
//                   <input
//                     type="text"
//                     id="licensePlateInput"
//                     value={licensePlateInput}
//                     onChange={(e) => setLicensePlateInput(e.target.value.toUpperCase())}
//                     className="w-full px-4 py-2.5 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-secondary-400"
//                     placeholder="e.g., ABC1234"
//                     required
//                     disabled={isSubmitting}
//                   />
//                 </div>
//                 <button
//                   type="submit"
//                   disabled={isSubmitting || location.availableSlots === 0}
//                   className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md shadow hover:shadow-md transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
//                 >
//                   <Car className="h-5 w-5 mr-2" /> Check In Drive-Up Vehicle
//                 </button>
//               </form>
//             ) : (
//               <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
//                 <div className="flex items-center">
//                   <XSquare className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
//                   <p className="text-sm text-red-700">No drive-up parking spaces available. Drive-up check-in is disabled.</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">
//             <h2 className="text-2xl font-semibold text-secondary-800 mb-5 flex items-center">
//               <LogOut className="h-7 w-7 text-red-600 mr-2.5" />
//               Drive-Up Vehicle Check-Out
//             </h2>
//             {parkedVehicles.length > 0 ? (
//               <div className="space-y-5">
//                 <div>
//                   <label className="block text-sm font-medium text-secondary-700 mb-1.5">
//                     Select Parked Drive-Up Vehicle
//                   </label>
//                   <select
//                     value={selectedVehicleId}
//                     onChange={(e) => setSelectedVehicleId(e.target.value)}
//                     disabled={isSubmitting}
//                     className="w-full px-4 py-2.5 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
//                   >
//                     <option value="">-- Select Vehicle --</option>
//                     {parkedVehicles.map(vehicle => (
//                       <option key={vehicle.id} value={vehicle.id}>
//                         {vehicle.licensePlate} (In: {formatDateTime(vehicle.entryTime)})
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <button
//                   onClick={handleDriveUpCheckOut}
//                   disabled={isSubmitting || !selectedVehicleId}
//                   className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-md shadow hover:shadow-md transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
//                 >
//                   <CheckSquare className="h-5 w-5 mr-2" /> Check Out Drive-Up Vehicle
//                 </button>
//               </div>
//             ) : (
//               <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
//                 <div className="flex items-center">
//                   <Car className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
//                   <p className="text-sm text-blue-700">No drive-up vehicles currently parked.</p>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Recent Drive-Up Activity Table */}
//       {location && (
//         <div className="mt-10">
//           <h2 className="text-2xl font-semibold text-secondary-800 mb-6">Recent Drive-Up Activity at {location.name}</h2>
//           {recentActivity.length > 0 ? (
//             <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
//               <div className="overflow-x-auto">
//                 <table className="min-w-full divide-y divide-secondary-200">
//                   <thead className="bg-secondary-100">
//                     <tr>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">License Plate</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Check-In</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Check-Out</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Cost</th>
//                       <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-secondary-600 uppercase tracking-wider">Status</th>
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white divide-y divide-secondary-200">
//                     {recentActivity.map((vehicle) => (
//                       <tr key={vehicle.id} className="hover:bg-secondary-50 transition-colors">
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="flex items-center">
//                             <Car className="h-5 w-5 text-primary-600 mr-3 flex-shrink-0" />
//                             <span className="font-medium text-secondary-900">{vehicle.licensePlate}</span>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">{formatDateTime(vehicle.entryTime)}</td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-600">{formatDateTime(vehicle.exitTime)}</td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
//                           {vehicle.cost !== null && vehicle.cost !== undefined && hourlyRate > 0 ? `₹${Number(vehicle.cost).toFixed(2)}` : (vehicle.exitTime ? 'N/A' : '–')}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           {vehicle.exitTime ? (
//                             <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-secondary-100 text-secondary-800 shadow-sm">Departed</span>
//                           ) : (
//                             <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 shadow-sm">Parked</span>
//                           )}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           ) : (
//             !loading && <div className="mt-6 text-center text-secondary-500 py-8 bg-white rounded-xl shadow-xl"><Info className="inline h-5 w-5 mr-2 align-text-bottom" />No drive-up vehicle activity to display for this location.</div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default EmployeeDashboard;
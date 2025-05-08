// src/pages/admin/AdminBookingsDisplay.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import { AlertCircle, CalendarDays, ListFilter } from 'lucide-react'; // Import necessary icons

// Define the structure of a Booking object based on backend response
type Booking = {
    id: number;
    userName: string;
    userEmail: string;
    locationName: string;
    startTime: string; // ISO date string
    endTime: string;   // ISO date string
    status: string;
    license_plate_booked?: string | null;
    checked_in_license_plate?: string | null;
    actualEntryTime?: string | null; // ISO date string
    createdAt: string; // ISO date string
    checkedInByEmployeeName?: string | null;
};

const AdminBookingsDisplay: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Add state for filters if needed, e.g., date range, status, location
    // const [filter, setFilter] = useState({ status: '', locationId: '', dateRange: null });

    useEffect(() => {
        const fetchBookings = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get('/api/admin/bookings');
                setBookings(response.data);
            } catch (err: any) {
                console.error('Error fetching bookings for admin:', err);
                setError(err.response?.data?.message || 'Failed to load bookings.');
            } finally {
                setLoading(false);
            }
        };
        fetchBookings();
    }, []); // Add dependencies if you implement filtering

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        return dayjs(dateString).format('MMM D, YYYY h:mm A');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
                    <AlertCircle className="h-5 w-5 mr-3" /> <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-secondary-900">All Bookings</h1>
                {/* Add Filter UI here if needed, e.g., using ListFilter icon */}
            </div>

            {bookings.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-lg shadow">
                    <CalendarDays size={48} className="mx-auto text-secondary-400 mb-4" />
                    <p className="text-secondary-600 text-lg">No bookings found.</p>
                </div>
            ) : (
                <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary-200">
                        <thead className="bg-secondary-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Location</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Start Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">End Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Plate Booked</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Actual Entry</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Created At</th>
                                {/* Add more columns if needed, e.g., checkedInByEmployeeName */}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-secondary-200">
                            {bookings.map((booking) => (
                                <tr key={booking.id} className="hover:bg-secondary-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">{booking.id}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">
                                        <div>{booking.userName}</div>
                                        <div className="text-xs text-secondary-500">{booking.userEmail}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">{booking.locationName}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">{formatDate(booking.startTime)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">{formatDate(booking.endTime)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                                booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                        booking.status === 'checked-in' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-800'
                                            }`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">{booking.license_plate_booked || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-700">{formatDate(booking.actualEntryTime)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">{formatDate(booking.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminBookingsDisplay;
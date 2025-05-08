// src/pages/admin/SettingsPage.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, AlertCircle, CheckCircle } from 'lucide-react';

const AdminSettingsPage: React.FC = () => {
    const [currentRate, setCurrentRate] = useState<number | null>(null);
    const [newRate, setNewRate] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Fetch the current hourly rate on component mount
    useEffect(() => {
        const fetchCurrentRate = async () => {
            setLoading(true);
            setError(null);
            try {
                // IMPORTANT: You will need to create this GET endpoint on your backend
                const response = await axios.get('/api/admin/current-rate');
                setCurrentRate(response.data.hourlyRate);
                setNewRate(response.data.hourlyRate.toString()); // Pre-fill input with current rate
            } catch (err) {
                console.error('Error fetching current rate:', err);
                setError('Failed to load current hourly rate. Please try again.');
                setCurrentRate(0); // Default or indicate error
                setNewRate('0');
            } finally {
                setLoading(false);
            }
        };

        fetchCurrentRate();
    }, []);

    const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewRate(e.target.value);
    };

    const handleSubmitRate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        const rateValue = parseFloat(newRate);
        if (isNaN(rateValue) || rateValue < 0) {
            setError('Please enter a valid non-negative number for the hourly rate.');
            setIsSubmitting(false);
            return;
        }

        try {
            // Use your existing POST endpoint to update the rate
            const response = await axios.post('/api/admin/rate', { hourlyRate: rateValue });
            setCurrentRate(response.data.hourlyRate); // Update displayed current rate
            setNewRate(response.data.hourlyRate.toString()); // Reset input to new current rate
            setSuccessMessage(`Hourly rate successfully updated to ₹${response.data.hourlyRate.toFixed(2)}.`);
        } catch (err: any) {
            console.error('Error updating hourly rate:', err);
            setError(err.response?.data?.message || 'Failed to update hourly rate. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-secondary-900 mb-2">Admin Settings</h1>
                <p className="text-secondary-600">Manage system-wide settings.</p>
            </div>

            <div className="bg-white shadow-md rounded-lg p-6 md:p-8">
                <h2 className="text-xl font-semibold text-secondary-800 mb-6 border-b pb-4">
                    Parking Rate Management
                </h2>

                {loading && (
                    <div className="flex justify-center items-center my-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                        <span className="ml-3 text-secondary-600">Loading current rate...</span>
                    </div>
                )}

                {!loading && currentRate !== null && (
                    <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-md flex items-center">
                        <IndianRupee className="h-6 w-6 text-primary-600 mr-3" />
                        <div>
                            <p className="text-sm text-primary-700 font-medium">Current Hourly Rate:</p>
                            <p className="text-2xl font-bold text-primary-600">₹{currentRate.toFixed(2)}</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        <p>{error}</p>
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <p>{successMessage}</p>
                    </div>
                )}

                <form onSubmit={handleSubmitRate} className="space-y-6">
                    <div>
                        <label htmlFor="hourlyRate" className="block text-sm font-medium text-secondary-700 mb-1">
                            Set New Hourly Rate (₹)
                        </label>
                        <input
                            type="number"
                            id="hourlyRate"
                            name="hourlyRate"
                            value={newRate}
                            onChange={handleRateChange}
                            min="0"
                            step="0.01"
                            className="w-full px-4 py-2 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            placeholder="e.g., 2.50"
                            disabled={isSubmitting || loading}
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting || loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300"
                        >
                            {isSubmitting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            ) : (
                                'Update Hourly Rate'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminSettingsPage;
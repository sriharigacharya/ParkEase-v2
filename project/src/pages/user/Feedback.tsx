// src/pages/user/Feedback.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import StarRating from '../../components/common/StarRating'; // Adjust path if StarRating is elsewhere
import { AlertCircle, CheckCircle } from 'lucide-react';

const UserFeedback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null); // Renamed to avoid conflict
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null); // For errors like no locationId

  useEffect(() => {
    const locId = searchParams.get('locationId');
    const locName = searchParams.get('locationName');
    if (locId) {
      setLocationId(locId);
      setLocationName(locName || `Location ID: ${locId}`);
      setPageError(null);
    } else {
      setPageError("No parking location specified. Please go back to your bookings and select 'Leave Feedback' for a specific location.");
      setLocationId(null); // Ensure locationId is null if not found
    }
  }, [searchParams]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationId) {
      setFormError("Cannot submit feedback without a location ID.");
      return;
    }
    if (rating === 0) {
      setFormError('Please select a star rating.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      await axios.post('/api/locations/feedback', { // Path is correct
        parkingLocationId: parseInt(locationId, 10),
        rating,
        message,
      });
      setSuccessMessage('Thank you! Your feedback has been submitted successfully. Redirecting...');
      setRating(0); // Reset form
      setMessage('');
      setTimeout(() => {
        navigate('/user/bookings'); 
      }, 3000);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setFormError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageError) {
      return (
          <div className="max-w-xl mx-auto px-4 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700">{pageError}</p>
            <button 
                onClick={() => navigate('/user/bookings')} 
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
                Go to My Bookings
            </button>
          </div>
      );
  }
  
  if (!locationId && !pageError) {
      // Should be caught by pageError, but as a fallback or if loading location data
      return (
          <div className="max-w-xl mx-auto px-4 py-8 text-center">
              <p className="text-secondary-600">Loading...</p>
          </div>
      );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Submit Feedback</h1>
        {locationName && <p className="text-secondary-600">For: <span className="font-semibold">{locationName}</span></p>}
      </div>

      {formError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <AlertCircle className="h-5 w-5 mr-3" />
          <p>{formError}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <CheckCircle className="h-5 w-5 mr-3" />
          <p>{successMessage}</p>
        </div>
      )}

      {locationId && !successMessage && (
        <form onSubmit={handleSubmitFeedback} className="bg-white shadow-xl rounded-lg p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Your Rating <span className="text-red-500">*</span>
            </label>
            {/* Ensure StarRating component is correctly imported and used */}
            <StarRating rating={rating} onChange={setRating} size={32} /> 
            {rating === 0 && formError?.includes("rating") && <p className="text-xs text-red-500 mt-1">Please select a star rating.</p>}
          </div>

          <div>
            <label htmlFor="feedbackMessage" className="block text-sm font-medium text-secondary-700 mb-1">
              Your Feedback (Optional)
            </label>
            <textarea
              id="feedbackMessage"
              name="feedbackMessage"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Tell us about your experience..."
              disabled={isSubmitting}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                'Submit Feedback'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UserFeedback;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare } from 'lucide-react';
import StarRating from '../../components/common/StarRating';
import dayjs from 'dayjs';

type Feedback = {
  id: number;
  rating: number;
  message: string;
  created_at: string;
  user_name: string;
  location_name: string;
  location_id: number;
};

const AdminFeedback: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const response = await axios.get('/api/admin/feedbacks');
      setFeedbacks(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      setError('Failed to load feedback');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-secondary-900">User Feedback</h1>
        <p className="mt-2 text-secondary-600">
          Review feedback and ratings from users across all parking locations.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {feedbacks.map(feedback => (
            <div key={feedback.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900">
                    {feedback.location_name}
                  </h3>
                  <p className="text-sm text-secondary-600">
                    by {feedback.user_name} • {dayjs(feedback.created_at).format('MMM D, YYYY')}
                  </p>
                </div>
                <StarRating rating={feedback.rating} readonly size={20} />
              </div>
              {feedback.message && (
                <div className="mt-4 flex items-start">
                  <MessageSquare className="h-5 w-5 text-secondary-400 mr-2 mt-0.5" />
                  <p className="text-secondary-700">{feedback.message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;
import React, { useState, useEffect, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Car, Users, MapPin, Star, IndianRupee, MessageSquare, CalendarPlus, Briefcase, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path if needed
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// --- Type Definitions ---
type DashboardStats = {
  totalLocations: number;
  totalEmployees: number;
  totalBookings: number;
  averageRating: number;
  hourlyRate: number;
};

type LocationStatus = {
  id: number;
  name: string;
  availableSlots: number;
  totalSlots: number;
  // Add other properties from the /api/admin/locations response if needed for display
};

type RecentActivity = {
  id: string;
  type: 'booking' | 'feedback'; // Simplified based on current backend implementation
  description: string;
  timestamp: string; // ISO date string or string convertible to Date
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const response = await axios.get('/api/admin/dashboard-stats');
        setStats(response.data);
        setDashboardError(null); // Clear previous error
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setDashboardError('Failed to load dashboard statistics.');
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch recent activity
  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoadingActivity(true);
        const response = await axios.get('/api/admin/recent-activity');
        setRecentActivity(response.data);
      } catch (err) {
        console.error('Error fetching recent activity:', err);
        // Optionally set a specific error for activity section
      } finally {
        setLoadingActivity(false);
      }
    };
    fetchRecentActivity();
  }, []);

  // Fetch location statuses
  useEffect(() => {
    const fetchLocationStatuses = async () => {
      try {
        setLoadingLocations(true);
        const response = await axios.get('/api/admin/locations');
        // Using the full location data, take top 5 or filter as needed
        setLocationStatuses(response.data.slice(0, 5)); 
      } catch (err) {
        console.error('Error fetching location statuses:', err);
        // Optionally set a specific error for locations section
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocationStatuses();
  }, []);

  const StatCard: React.FC<{
    title: string;
    value: number | string | undefined | null; // Allow null for initial state
    icon: React.ReactNode;
    suffix?: string;
    to: string;
    loading?: boolean;
  }> = ({ title, value, icon, suffix = '', to, loading }) => (
    <Link
      to={to}
      className="bg-white rounded-lg shadow-md p-6 flex items-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 min-h-[120px]"
    >
      <div className="rounded-full bg-primary-100 p-4 mr-4 self-start mt-1">
        {icon}
      </div>
      <div className="flex-grow">
        <p className="text-secondary-500 text-sm">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mt-1"></div>
        ) : (
          <p className="text-secondary-900 text-2xl font-semibold">
            {value === null || value === undefined ? 'N/A' : value}
            {suffix && (value !== null && value !== undefined && value !== 'N/A') && <span className="text-base text-secondary-500 ml-1">{suffix}</span>}
          </p>
        )}
      </div>
    </Link>
  );

  const getActivityIcon = (type?: string): ReactNode => {
    switch (type) {
      case 'booking':
        return <CalendarPlus className="h-5 w-5 text-green-700" />;
      case 'feedback':
        return <MessageSquare className="h-5 w-5 text-blue-700" />;
      // Add more cases as your backend /recent-activity expands
      // case 'employee':
      //   return <Users className="h-5 w-5 text-purple-700" />;
      // case 'rate_update':
      //    return <IndianRupee className="h-5 w-5 text-yellow-700" />;
      default:
        return <Briefcase className="h-5 w-5 text-gray-700" />;
    }
  };
  
  const getLocationStatusColor = (available: number, total: number): string => {
    if (total === 0) return 'bg-gray-100 text-gray-800';
    if (available <= 0) return 'bg-red-100 text-red-800'; // Changed to <= 0 for clarity
    const percentage = (available / total) * 100;
    if (percentage < 25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  if (dashboardError && !loadingStats) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-red-600 bg-red-50 border border-red-200 rounded-md text-center p-6">{dashboardError}</div>;
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Admin Dashboard</h1>
        <p className="text-secondary-600">
          Welcome back, {user?.name || 'Admin'}! Here's an overview of your parking management system.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Parking Locations"
          value={stats?.totalLocations}
          icon={<MapPin className="h-6 w-6 text-primary-600" />}
          to="/admin/locations"
          loading={loadingStats}
        />
        <StatCard
          title="Employees"
          value={stats?.totalEmployees}
          icon={<Users className="h-6 w-6 text-primary-600" />}
          to="/admin/employees"
          loading={loadingStats}
        />
        <StatCard
          title="Active Bookings"
          value={stats?.totalBookings}
          icon={<Car className="h-6 w-6 text-primary-600" />}
          to="/admin/bookings" // You might need an admin page to view all bookings
          loading={loadingStats}
        />
        <StatCard
          title="Average Rating"
          value={stats?.averageRating !== null && stats?.averageRating !== undefined ? stats.averageRating.toFixed(1) : undefined}
          icon={<Star className="h-6 w-6 text-primary-600" />}
          suffix="/ 5"
          to="/admin/feedbacks" // Changed from /admin/feedback to /admin/feedbacks to match admin.js route
          loading={loadingStats}
        />
        <StatCard
          title="Hourly Rate"
          value={stats?.hourlyRate !== null && stats?.hourlyRate !== undefined ? stats.hourlyRate.toFixed(2) : undefined}
          icon={<IndianRupee className="h-6 w-6 text-primary-600" />}
          suffix="/ hr"
          to="/admin/settings" // Link to manage settings, including hourly rate
          loading={loadingStats}
        />
         <StatCard 
            title="Manage Settings"
            value="" // No specific value, just a link
            icon={<SettingsIcon className="h-6 w-6 text-primary-600" />}
            to="/admin/settings"
            loading={loadingStats && stats === null} // Only show loading skeleton if all stats are loading
        />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-secondary-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Link
            to="/admin/locations" // Link to the page where locations can be added/managed
            className="bg-primary-600 text-white rounded-lg py-3 px-4 text-center font-medium hover:bg-primary-700 transition-colors"
          >
            Manage Locations
          </Link>
          <Link
            to="/admin/employees" // Link to the page where employees can be added/managed
            className="bg-primary-600 text-white rounded-lg py-3 px-4 text-center font-medium hover:bg-primary-700 transition-colors"
          >
            Manage Employees
          </Link>
          <Link
            to="/admin/feedbacks" // Link to view all feedback (new route in admin.js is /feedbacks)
            className="bg-primary-600 text-white rounded-lg py-3 px-4 text-center font-medium hover:bg-primary-700 transition-colors"
          >
            View User Feedback
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-secondary-800 mb-4">Recent Activity</h2>
          {loadingActivity ? (
            Array.from({ length: 3 }).map((_, index) => ( // Skeleton loader for activity
              <div key={index} className="flex items-start py-2 mb-2">
                <div className="p-2 rounded-full mr-3 mt-1 bg-gray-200 h-8 w-8 animate-pulse"></div>
                <div className="flex-grow">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))
          ) : recentActivity.length === 0 ? (
            <p className="text-secondary-600">No recent activity to display.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start">
                  <div className={`p-2 rounded-full mr-3 mt-1 bg-opacity-20 ${
                      activity.type === 'booking' ? 'bg-green-200' : 
                      activity.type === 'feedback' ? 'bg-blue-200' : 
                      'bg-gray-200'}` // Adjusted icon background
                    }>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div>
                    <p className="text-sm text-secondary-800">{activity.description}</p>
                    <p className="text-xs text-secondary-500">{dayjs(activity.timestamp).fromNow()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-secondary-800 mb-4">Location Status (Top 5)</h2>
          {loadingLocations ? (
             Array.from({ length: 3 }).map((_, index) => ( // Skeleton loader for locations
                <div key={index} className="flex justify-between items-center py-3 mb-2 border-b border-secondary-200 last:border-b-0">
                    <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                </div>
             ))
          ) : locationStatuses.length === 0 ? (
            <p className="text-secondary-600">No locations to display status for.</p>
          ) : (
            <div className="space-y-3">
              {locationStatuses.map(loc => (
                <div key={loc.id} className="flex justify-between items-center pb-2 border-b border-secondary-200 last:border-b-0 last:pb-0">
                  <span className="text-secondary-800 truncate max-w-[60%]">{loc.name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLocationStatusColor(loc.availableSlots, loc.totalSlots)}`}>
                    {loc.availableSlots <= 0 && loc.totalSlots > 0 ? 'Full' : `${loc.availableSlots}/${loc.totalSlots} available`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';

// Public pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'; // Assuming this is src/pages/admin/AdminDashboard.tsx
import AdminLocations from './pages/admin/Locations';
import AdminEmployees from './pages/admin/Employees';
import AdminFeedback from './pages/admin/Feedback';
import AdminSettingsPage from './pages/admin/SettingsPage'; // <<-- NEW: Import the SettingsPage component
import AdminBookingsDisplay from './pages/admin/AdminBookingsDisplay';
// Employee pages
import EmployeeDashboard from './pages/employee/Dashboard';

// User pages
import UserDashboard from './pages/user/Dashboard';
import UserBookings from './pages/user/Bookings';
import UserFeedback from './pages/user/Feedback';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-primary-50">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Admin Routes */}
              <Route 
                path="/admin/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/locations" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLocations />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/employees" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminEmployees />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/feedbacks" // Corrected from "/admin/feedback" to match your AdminDashboard link
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminFeedback />
                  </ProtectedRoute>
                } 
              />
              {/* 👇 NEW ADMIN SETTINGS ROUTE ADDED HERE 👇 */}
              <Route 
                path="/admin/settings" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminSettingsPage /> 
                  </ProtectedRoute>
                } 
              />
              <Route 
              path="/admin/bookings" 
                element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBookingsDisplay />
                  </ProtectedRoute>
                  }
              />
              
              {/* Employee Routes */}
              <Route 
                path="/employee/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['employee']}>
                    <EmployeeDashboard />
                  </ProtectedRoute>
                } 
              />
              
              {/* User Routes */}
              <Route 
                path="/user/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['user']}>
                    <UserDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/user/bookings" 
                element={
                  <ProtectedRoute allowedRoles={['user']}>
                    <UserBookings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/user/feedback" 
                element={
                  <ProtectedRoute allowedRoles={['user']}>
                    <UserFeedback />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

// import React from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { AuthProvider } from './contexts/AuthContext';
// import ProtectedRoute from './components/common/ProtectedRoute';
// import Navbar from './components/common/Navbar';
// import Footer from './components/common/Footer';

// // Public pages
// import HomePage from './pages/HomePage';
// import LoginPage from './pages/LoginPage';
// import RegisterPage from './pages/RegisterPage';

// // Admin pages
// import AdminDashboard from './pages/admin/Dashboard';
// import AdminLocations from './pages/admin/Locations';
// import AdminEmployees from './pages/admin/Employees';
// import AdminFeedback from './pages/admin/Feedback';

// // Employee pages
// import EmployeeDashboard from './pages/employee/Dashboard';

// // User pages
// import UserDashboard from './pages/user/Dashboard';
// import UserBookings from './pages/user/Bookings';
// import UserFeedback from './pages/user/Feedback';

// function App() {
//   return (
//     <AuthProvider>
//       <Router>
//         <div className="flex flex-col min-h-screen bg-primary-50">
//           <Navbar />
//           <main className="flex-grow">
//             <Routes>
//               {/* Public Routes */}
//               <Route path="/" element={<HomePage />} />
//               <Route path="/login" element={<LoginPage />} />
//               <Route path="/register" element={<RegisterPage />} />
              
//               {/* Admin Routes */}
//               <Route 
//                 path="/admin/dashboard" 
//                 element={
//                   <ProtectedRoute allowedRoles={['admin']}>
//                     <AdminDashboard />
//                   </ProtectedRoute>
//                 } 
//               />
//               <Route 
//                 path="/admin/locations" 
//                 element={
//                   <ProtectedRoute allowedRoles={['admin']}>
//                     <AdminLocations />
//                   </ProtectedRoute>
//                 } 
//               />
//               <Route 
//                 path="/admin/employees" 
//                 element={
//                   <ProtectedRoute allowedRoles={['admin']}>
//                     <AdminEmployees />
//                   </ProtectedRoute>
//                 } 
//               />
//               <Route 
//                 path="/admin/feedback" 
//                 element={
//                   <ProtectedRoute allowedRoles={['admin']}>
//                     <AdminFeedback />
//                   </ProtectedRoute>
//                 } 
//               />
              
//               {/* Employee Routes */}
//               <Route 
//                 path="/employee/dashboard" 
//                 element={
//                   <ProtectedRoute allowedRoles={['employee']}>
//                     <EmployeeDashboard />
//                   </ProtectedRoute>
//                 } 
//               />
              
//               {/* User Routes */}
//               <Route 
//                 path="/user/dashboard" 
//                 element={
//                   <ProtectedRoute allowedRoles={['user']}>
//                     <UserDashboard />
//                   </ProtectedRoute>
//                 } 
//               />
//               <Route 
//                 path="/user/bookings" 
//                 element={
//                   <ProtectedRoute allowedRoles={['user']}>
//                     <UserBookings />
//                   </ProtectedRoute>
//                 } 
//               />
//               <Route 
//                 path="/user/feedback" 
//                 element={
//                   <ProtectedRoute allowedRoles={['user']}>
//                     <UserFeedback />
//                   </ProtectedRoute>
//                 } 
//               />
//             </Routes>
//           </main>
//           <Footer />
//         </div>
//       </Router>
//     </AuthProvider>
//   );
// }

// export default App;
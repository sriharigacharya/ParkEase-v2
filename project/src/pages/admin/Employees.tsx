// src/pages/admin/AdminEmployees.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserPlus, Building, Edit3, Trash2, X, Save, AlertCircle } from 'lucide-react';

// Types remain the same
type Employee = {
  id: number;
  name: string;
  email: string;
  parkingLocationId: number;
  locationName: string; // Assuming this comes from a JOIN in the backend GET /api/admin/employees
};

type Location = {
  id: number;
  name: string;
};

// Initial form data for adding
const initialAddFormData = {
  name: '',
  email: '',
  password: '',
  parkingLocationId: '',
};

// Initial form data for editing (password excluded for now)
const initialEditFormData = {
  id: 0, // Will be set when editing
  name: '',
  email: '',
  parkingLocationId: '',
};


const AdminEmployees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false); // For disabling buttons during API calls
  
  // UI States
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form Data States
  const [addFormData, setAddFormData] = useState(initialAddFormData);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null); // Employee being edited
  const [editFormData, setEditFormData] = useState(initialEditFormData);

  // Feedback States
  const [error, setError] = useState<string | null>(null); // General fetch or submit error
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const fetchEmployees = async () => {
    setLoading(true);
    clearMessages();
    try {
      const response = await axios.get('/api/admin/employees');
      setEmployees(response.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Failed to load employees. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await axios.get('/api/admin/locations'); // Assuming this endpoint exists for admins
      setLocations(response.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
      // Not critical enough to set a general error, maybe a small inline message if needed
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, []);

  const handleAddInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setActionInProgress(true);
    try {
      // Note: The API endpoint for adding a single employee is typically singular, e.g., /api/admin/employee
      // Your current code uses /api/admin/employee - let's assume it's correct.
      // The backend needs to ensure the 'role' for this new user is set to 'employee'.
      await axios.post('/api/admin/employee', addFormData);
      setSuccessMessage('Employee added successfully!');
      setAddFormData(initialAddFormData);
      setShowAddForm(false);
      fetchEmployees(); // Refresh list
    } catch (err: any) {
      console.error('Error adding employee:', err);
      setError(err.response?.data?.message || 'Failed to add employee.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleEditClick = (employee: Employee) => {
    clearMessages();
    setEditingEmployee(employee);
    setEditFormData({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      parkingLocationId: employee.parkingLocationId.toString(), // Ensure it's a string for select value
    });
    setShowEditModal(true);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    clearMessages();
    setActionInProgress(true);

    // Prepare data for PUT/PATCH (excluding ID from body if it's in URL, or including if API expects it)
    // For simplicity, let's send name, email, parkingLocationId.
    // Password update is more complex and typically handled separately or with more checks.
    const updateData = {
        name: editFormData.name,
        email: editFormData.email,
        parkingLocationId: parseInt(editFormData.parkingLocationId, 10), // Ensure it's a number
        // Do not send password unless it's being changed and handled securely by backend
    };

    try {
      await axios.put(`/api/admin/employee/${editingEmployee.id}`, updateData);
      setSuccessMessage('Employee updated successfully!');
      setShowEditModal(false);
      setEditingEmployee(null);
      fetchEmployees(); // Refresh list
    } catch (err: any) {
      console.error('Error updating employee:', err);
      setError(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteClick = async (employeeId: number) => {
    clearMessages();
    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      setActionInProgress(true);
      try {
        await axios.delete(`/api/admin/employee/${employeeId}`);
        setSuccessMessage('Employee deleted successfully!');
        fetchEmployees(); // Refresh list
      } catch (err: any) {
        console.error('Error deleting employee:', err);
        setError(err.response?.data?.message || 'Failed to delete employee.');
      } finally {
        setActionInProgress(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-secondary-900">Employees Management</h1>
        <button
          onClick={() => { setShowAddForm(!showAddForm); clearMessages(); if (showAddForm) setAddFormData(initialAddFormData); }}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
          disabled={actionInProgress}
        >
          {showAddForm ? (
            <><X className="h-5 w-5 mr-2" />Cancel Add</>
          ) : (
            <><UserPlus className="h-5 w-5 mr-2" />Add Employee</>
          )}
        </button>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          <AlertCircle className="h-5 w-5 mr-3" /> <p>{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-md flex items-center" role="alert">
          {/* Using a generic icon or CheckCircle from lucide if available */}
          <Users className="h-5 w-5 mr-3" /> {/* Placeholder icon */}
          <p>{successMessage}</p>
        </div>
      )}

      {/* Add Employee Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8 transition-all duration-300 ease-in-out">
          <h2 className="text-xl font-semibold text-secondary-800 mb-4">Add New Employee</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Full Name</label>
              <input type="text" name="name" value={addFormData.name} onChange={handleAddInputChange} required 
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Email Address</label>
              <input type="email" name="email" value={addFormData.email} onChange={handleAddInputChange} required
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Password</label>
              <input type="password" name="password" value={addFormData.password} onChange={handleAddInputChange} required
                     className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Assign Parking Location</label>
              <select name="parkingLocationId" value={addFormData.parkingLocationId} onChange={handleAddInputChange} required
                      className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select a location</option>
                {locations.map(location => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={() => { setShowAddForm(false); setAddFormData(initialAddFormData); clearMessages(); }}
                    className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors disabled:opacity-50"
                    disabled={actionInProgress}>
              Cancel
            </button>
            <button type="submit" disabled={actionInProgress}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center disabled:opacity-50">
              <UserPlus className="h-5 w-5 mr-2" /> Add Employee
            </button>
          </div>
        </form>
      )}

      {/* Edit Employee Modal/Form */}
      {showEditModal && editingEmployee && (
         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
            <form onSubmit={handleEditSubmit} className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-secondary-800">Edit Employee: {editingEmployee.name}</h2>
                    <button type="button" onClick={() => { setShowEditModal(false); setEditingEmployee(null); clearMessages();}} 
                            className="text-secondary-500 hover:text-secondary-700">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Full Name</label>
                        <input type="text" name="name" value={editFormData.name} onChange={handleEditInputChange} required 
                            className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Email Address</label>
                        <input type="email" name="email" value={editFormData.email} onChange={handleEditInputChange} required
                            className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    {/* Password editing is omitted for simplicity; usually a separate flow or requires current pass */}
                    <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-1">Assign Parking Location</label>
                        <select name="parkingLocationId" value={editFormData.parkingLocationId} onChange={handleEditInputChange} required
                                className="w-full px-3 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="">Select a location</option>
                            {locations.map(location => (
                                <option key={location.id} value={location.id}>{location.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-8 flex justify-end space-x-3">
                    <button type="button" onClick={() => { setShowEditModal(false); setEditingEmployee(null); clearMessages(); }}
                            className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors disabled:opacity-50"
                            disabled={actionInProgress}>
                        Cancel
                    </button>
                    <button type="submit" disabled={actionInProgress}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center disabled:opacity-50">
                        <Save className="h-5 w-5 mr-2" /> Save Changes
                    </button>
                </div>
            </form>
        </div>
      )}


      {/* Employees Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : !error && employees.length === 0 ? (
        <div className="text-center py-10">
            <Users size={48} className="mx-auto text-secondary-400 mb-4" />
            <p className="text-secondary-600">No employees found. Click "Add Employee" to get started.</p>
        </div>
      ) : !error ? (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Assigned Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-secondary-200">
              {employees.map(employee => (
                <tr key={employee.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-secondary-900">{employee.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-secondary-600">{employee.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-secondary-600">
                      <Building className="h-4 w-4 mr-1.5 text-secondary-400" />
                      {employee.locationName || 'N/A'} {/* Display N/A if locationName is not present */}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                        onClick={() => handleEditClick(employee)} 
                        disabled={actionInProgress}
                        className="text-primary-600 hover:text-primary-800 mr-3 disabled:opacity-50"
                        title="Edit Employee">
                        <Edit3 size={18}/>
                    </button>
                    <button 
                        onClick={() => handleDeleteClick(employee.id)}
                        disabled={actionInProgress}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        title="Delete Employee">
                        <Trash2 size={18}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export default AdminEmployees;